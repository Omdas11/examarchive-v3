/* eslint-disable no-console */
const { Client, Databases, Storage, Query, ID } = require("node-appwrite");
const { InputFile } = require("node-appwrite/file");
const { randomInt } = require("node:crypto");
const sanitizeHtml = require("sanitize-html");

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = process.env.GEMINI_MODEL_ID || "gemini-3.1-flash-lite-preview";
const GEMINI_COOLDOWN_MS = 3000;
const LOGICAL_CHUNK_COUNT = 5;
const geminiRequestTimeoutRaw = Number(process.env.GEMINI_REQUEST_TIMEOUT_MS);
const geminiMaxAttemptsRaw = Number(process.env.GEMINI_MAX_ATTEMPTS);
const geminiBaseBackoffRaw = Number(process.env.GEMINI_BASE_BACKOFF_MS);
const tavilyTimeoutRaw = Number(process.env.TAVILY_TIMEOUT_MS);
const GEMINI_REQUEST_TIMEOUT_MS = Number.isFinite(geminiRequestTimeoutRaw)
  ? Math.max(1_000, geminiRequestTimeoutRaw)
  : 45_000;
const DEFAULT_GEMINI_MAX_ATTEMPTS = Number.isInteger(geminiMaxAttemptsRaw)
  ? Math.max(1, geminiMaxAttemptsRaw)
  : 3;
const DEFAULT_GEMINI_BASE_BACKOFF_MS = Number.isFinite(geminiBaseBackoffRaw)
  ? Math.max(250, geminiBaseBackoffRaw)
  : 1500;
const GEMINI_RETRYABLE_MAX_ATTEMPTS = Math.max(5, DEFAULT_GEMINI_MAX_ATTEMPTS);
const GEMINI_STRICT_BACKOFF_BASE_MS = Math.max(3000, DEFAULT_GEMINI_BASE_BACKOFF_MS);
const TAVILY_TIMEOUT_MS = Number.isFinite(tavilyTimeoutRaw)
  ? Math.max(1_000, tavilyTimeoutRaw)
  : 8_000;

const DATABASE_ID = process.env.DATABASE_ID || "examarchive";
const JOB_COLLECTION_ID = process.env.AI_JOBS_COLLECTION_ID || "ai_generation_jobs";
const SYLLABUS_TABLE_COLLECTION_ID = process.env.SYLLABUS_TABLE_COLLECTION_ID || "Syllabus_Table";
const QUESTIONS_TABLE_COLLECTION_ID = process.env.QUESTIONS_TABLE_COLLECTION_ID || "Questions_Table";
const PAPERS_BUCKET_ID = process.env.APPWRITE_BUCKET_ID || "papers";
const CACHED_UNIT_NOTES_BUCKET_ID = process.env.CACHED_UNIT_NOTES_BUCKET_ID || "cached-unit-notes";
const CACHED_SOLVED_PAPERS_BUCKET_ID = process.env.CACHED_SOLVED_PAPERS_BUCKET_ID || "cached-solved-papers";
const NOTIFY_COMPLETION_PATH = "/api/ai/notify-completion";
const NOTIFY_WEBHOOK_ERROR_LOG_MAX_CHARS = 2_000;
const MAX_LOGGED_CALLBACK_URL_CHARS = 500;
const COMPLETION_WEBHOOK_DELAY_MS = 2_000;
const GOTENBERG_CONVERT_ENDPOINT_PATH = "/forms/chromium/convert/html";
const GOTENBERG_TIMEOUT_MS = 60_000;
const GOTENBERG_MAX_ATTEMPTS = 3;
const GOTENBERG_BASE_BACKOFF_MS = 1_500;
const GOTENBERG_MAX_BACKOFF_MS = 6_000;
const TRUSTED_GOTENBERG_HOST_SUFFIX = ".hf.space";
const MAX_SAFE_PDF_FILENAME_CORE_LENGTH = 120;
const MARKED_FALLBACK_LOG_PREFIX = "[pdf-generator] Falling back to basic markdown parser.";
const MAX_RANDOM_NAMESPACE_INT = 0x1_0000_0000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function splitIntoLogicalChunks(items, chunkCount) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const safeChunkCount = Math.max(1, Math.min(chunkCount, items.length));
  const baseSize = Math.floor(items.length / safeChunkCount);
  const remainder = items.length % safeChunkCount;
  const chunks = [];
  let start = 0;
  for (let index = 0; index < safeChunkCount; index += 1) {
    const size = baseSize + (index < remainder ? 1 : 0);
    const end = start + size;
    chunks.push(items.slice(start, end));
    start = end;
  }
  return chunks.filter((chunk) => chunk.length > 0);
}

function splitSyllabusIntoSubTopics(syllabusContent) {
  return String(syllabusContent || "")
    .split(/(?:(?<=[.;])\s*|\n{2,})/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function markdownToBasicHtml(markdown) {
  const source = String(markdown || "").replace(/\r\n/g, "\n");
  const lines = source.split("\n");
  const htmlLines = [];
  let paragraph = [];
  let inList = false;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    htmlLines.push("<p>" + escapeHtml(paragraph.join(" ")) + "</p>");
    paragraph = [];
  };
  const closeList = () => {
    if (!inList) return;
    htmlLines.push("</ul>");
    inList = false;
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      closeList();
      return;
    }
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      closeList();
      const level = headingMatch[1].length;
      htmlLines.push("<h" + level + ">" + escapeHtml(headingMatch[2]) + "</h" + level + ">");
      return;
    }
    const bulletMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    if (bulletMatch) {
      flushParagraph();
      if (!inList) {
        htmlLines.push("<ul>");
        inList = true;
      }
      htmlLines.push("<li>" + escapeHtml(bulletMatch[1]) + "</li>");
      return;
    }
    closeList();
    paragraph.push(trimmed);
  });

  flushParagraph();
  closeList();
  return htmlLines.join("\n");
}

async function parseMarkdownToHtml(markdown) {
  try {
    const markedModule = await import("marked");
    let markedParser = null;
    if (markedModule && typeof markedModule.marked?.parse === "function") {
      markedParser = markedModule.marked;
    } else if (markedModule?.default && typeof markedModule.default.marked?.parse === "function") {
      markedParser = markedModule.default.marked;
    } else if (markedModule?.default && typeof markedModule.default.parse === "function") {
      markedParser = markedModule.default;
    }
    if (!markedParser) {
      console.warn(`${MARKED_FALLBACK_LOG_PREFIX} Marked parser was not found on module exports.`);
      return markdownToBasicHtml(markdown);
    }
    const parsedHtml = typeof markedParser?.parse === "function"
      ? markedParser.parse(markdown, { gfm: true, breaks: true })
      : "";
    if (typeof parsedHtml === "string" && parsedHtml.trim()) {
      return parsedHtml;
    }
    console.warn(`${MARKED_FALLBACK_LOG_PREFIX} Marked parse output was empty.`);
  } catch {
    console.warn(`${MARKED_FALLBACK_LOG_PREFIX} Marked import failed.`);
  }
  return markdownToBasicHtml(markdown);
}

function normalizeBearerToken(rawToken) {
  const token = String(rawToken || "").trim();
  if (!token) return "";
  return /^Bearer\s+/i.test(token) ? token : `Bearer ${token}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const MALFORMED_LATEX_COMMAND_PATTERN = /(^|[^A-Za-z0-9_])(?:l|\|)(frac|vec|pi|mu|chi|alpha|beta|gamma|theta|lambda|tau|circ|sqrt|text|hat|sin|cos)\b/g;
const ESCAPED_DISPLAY_MATH_PATTERN = /\\\$\\\$([\s\S]*?)\\\$\\\$/g;
// Keep inline-math unescape conservative so literal currency/prose "\$" does not become a math delimiter.
// We only unescape when the content starts/ends with math-like tokens and contains no nested escaped dollar.
const ESCAPED_INLINE_MATH_PATTERN = /\\\$(?!\$)([\\A-Za-z0-9({\[](?:(?!\\\$)[^\n])*?[\\A-Za-z0-9)}\]])\\\$(?!\$)/g;

function isEscapedAtIndex(value, index) {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

function convertDollarMathToBracketMath(text) {
  const source = String(text || "");
  let output = "";
  let cursor = 0;
  let mode = null;
  let openingIndex = -1;
  let contentStartIndex = -1;
  let delimiterSize = 1;
  let index = 0;

  while (index < source.length) {
    if (source[index] !== "$" || isEscapedAtIndex(source, index)) {
      index += 1;
      continue;
    }
    const isDisplayDelimiter =
      index + 1 < source.length
      && source[index + 1] === "$"
      && !isEscapedAtIndex(source, index + 1);
    const nextDelimiterSize = isDisplayDelimiter ? 2 : 1;
    const nextMode = isDisplayDelimiter ? "display" : "inline";

    if (mode === null) {
      output += source.slice(cursor, index);
      mode = nextMode;
      delimiterSize = nextDelimiterSize;
      openingIndex = index;
      contentStartIndex = index + nextDelimiterSize;
      index += nextDelimiterSize;
      continue;
    }

    if (
      (mode === "display" && nextMode === "display" && nextDelimiterSize === delimiterSize)
      || (mode === "inline" && nextMode === "inline" && nextDelimiterSize === delimiterSize)
    ) {
      const expression = source.slice(contentStartIndex, index);
      if (mode === "inline" && expression.includes("\n")) {
        output += source.slice(openingIndex, index + nextDelimiterSize);
      } else {
        output += mode === "display"
          ? `\\[${expression}\\]`
          : `\\(${expression}\\)`;
      }
      index += nextDelimiterSize;
      cursor = index;
      mode = null;
      openingIndex = -1;
      contentStartIndex = -1;
      delimiterSize = 1;
      continue;
    }

    index += 1;
  }

  if (mode !== null && openingIndex >= 0) {
    output += source.slice(openingIndex);
    return output;
  }
  output += source.slice(cursor);
  return output;
}

function sanitizeAiMath(text) {
  if (!text) return text;

  let cleaned = text;
  // 1. Unescape Markdown Delimiters
  const displayMathBlocks = [];
  cleaned = cleaned.replace(ESCAPED_DISPLAY_MATH_PATTERN, (_, inner) => {
    const placeholder = `@@DISPLAY_MATH_${displayMathBlocks.length}@@`;
    displayMathBlocks.push(`$$${inner}$$`);
    return placeholder;
  });
  cleaned = cleaned.replace(ESCAPED_INLINE_MATH_PATTERN, (_, inner) => `$${inner}$`);
  displayMathBlocks.forEach((value, index) => {
    cleaned = cleaned.replace(`@@DISPLAY_MATH_${index}@@`, () => value);
  });
  cleaned = cleaned.replace(/\\_/g, "_");      // Unescape underscores
  cleaned = cleaned.replace(/\\\^/g, "^");     // Unescape carets
  cleaned = cleaned.replace(/\\{/g, "{");      // Unescape curly braces
  cleaned = cleaned.replace(/\\}/g, "}");
  cleaned = cleaned.replace(/\\\\\(/g, "\\(");
  cleaned = cleaned.replace(/\\\\\)/g, "\\)");
  cleaned = cleaned.replace(/\\\\\[/g, "\\[");
  cleaned = cleaned.replace(/\\\\\]/g, "\\]");

  // 2. Fix the "l" and "|" backslash hallucination
  cleaned = cleaned.replace(
    MALFORMED_LATEX_COMMAND_PATTERN,
    (_, prefix, command) => `${prefix}\\${command}`,
  );

  // 3. Fix the weird caret hallucination (e.g., r^{\wedge}3 -> r^3)
  cleaned = cleaned.replace(/\^\{\\wedge\}/g, "^");
  cleaned = cleaned.replace(/\{\\wedge\}/g, "^");
  cleaned = convertDollarMathToBracketMath(cleaned);

  return cleaned;
}

function extractSyllabusHighlights(markdown) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const startIndex = lines.findIndex((line) => /^#{1,6}\s*Syllabus Highlights\b/i.test(line.trim()));
  if (startIndex < 0) return [];
  const highlights = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    if (/^#{1,6}\s+/.test(line)) break;
    const bulletMatch = line.match(/^[-*+]\s+(.*)$/);
    if (bulletMatch?.[1]?.trim()) {
      highlights.push(bulletMatch[1].trim());
      if (highlights.length >= 8) break;
    }
  }
  return highlights;
}

function protectBracketMath(markdown) {
  const protectedBlocks = [];
  const protectedInline = [];
  const source = String(markdown || "");
  const tokenNamespace = "EXAMARCHIVE_MATH_"
    + Date.now().toString(36)
    + "_"
    + randomInt(0, MAX_RANDOM_NAMESPACE_INT).toString(36);
  const protectDelimitedMath = ({ input, openingDelimiter, closingDelimiter, bucket, tokenPrefix, singleLineOnly }) => {
    let output = "";
    let cursor = 0;
    while (cursor < input.length) {
      const openIndex = input.indexOf(openingDelimiter, cursor);
      if (openIndex < 0) {
        output += input.slice(cursor);
        break;
      }
      if (isEscapedAtIndex(input, openIndex)) {
        output += input.slice(cursor, openIndex + 1);
        cursor = openIndex + 1;
        continue;
      }

      const expressionStart = openIndex + openingDelimiter.length;
      let searchIndex = expressionStart;
      let closeIndex = -1;
      while (searchIndex < input.length) {
        const candidateCloseIndex = input.indexOf(closingDelimiter, searchIndex);
        if (candidateCloseIndex < 0) break;
        if (singleLineOnly && input.slice(expressionStart, candidateCloseIndex).includes("\n")) break;
        if (!isEscapedAtIndex(input, candidateCloseIndex)) {
          closeIndex = candidateCloseIndex;
          break;
        }
        searchIndex = candidateCloseIndex + 1;
      }

      if (closeIndex < 0) {
        output += input.slice(cursor);
        break;
      }

      output += input.slice(cursor, openIndex);
      const rawMath = input.slice(openIndex, closeIndex + closingDelimiter.length);
      const token = `@@${tokenNamespace}_${tokenPrefix}_${bucket.length}@@`;
      bucket.push(rawMath);
      output += token;
      cursor = closeIndex + closingDelimiter.length;
    }
    return output;
  };

  let protectedMarkdown = protectDelimitedMath({
    input: source,
    openingDelimiter: "\\[",
    closingDelimiter: "\\]",
    bucket: protectedBlocks,
    tokenPrefix: "EXAMARCHIVE_DISPLAY_MATH",
    singleLineOnly: false,
  });
  protectedMarkdown = protectDelimitedMath({
    input: protectedMarkdown,
    openingDelimiter: "\\(",
    closingDelimiter: "\\)",
    bucket: protectedInline,
    tokenPrefix: "EXAMARCHIVE_INLINE_MATH",
    singleLineOnly: true,
  });

  const restore = (value) => {
    let restored = String(value || "");
    protectedBlocks.forEach((expression, index) => {
      restored = restored.replaceAll(`@@${tokenNamespace}_EXAMARCHIVE_DISPLAY_MATH_${index}@@`, expression);
    });
    protectedInline.forEach((expression, index) => {
      restored = restored.replaceAll(`@@${tokenNamespace}_EXAMARCHIVE_INLINE_MATH_${index}@@`, expression);
    });
    return restored;
  };

  return { protectedMarkdown, restore };
}

function sanitizeGeneratedHtml(html) {
  return sanitizeHtml(String(html || ""), {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "h1",
      "h2",
      "section",
      "main",
      "article",
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      "*": ["class"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowProtocolRelative: false,
  });
}

function buildCoverPageHtml({ title, markdown }) {
  const highlights = extractSyllabusHighlights(markdown)
    .map((highlight) => "<li>" + escapeHtml(highlight) + "</li>")
    .join("");
  const generatedAt = new Date().toISOString().slice(0, 10);

  return [
    "<section class=\"cover-page\">",
    "<h1>ExamArchive Notes Dossier</h1>",
    "<p class=\"cover-title\">" + escapeHtml(title) + "</p>",
    "<p class=\"cover-date\"><strong>Generated:</strong> " + escapeHtml(generatedAt) + "</p>",
    highlights ? "<h2>Syllabus Highlights</h2>" : "",
    highlights ? "<ul>" + highlights + "</ul>" : "",
    "</section>",
  ].join("");
}

function buildHeaderHtml() {
  return [
    "<!DOCTYPE html>",
    "<html lang=\"en\"><head><meta charset=\"UTF-8\"/>",
    "<style>",
    "body{font-family:Inter,Arial,sans-serif;font-size:10px;color:#7a3a3a;margin:0;padding:0 1in 5px;width:100%;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e5e7eb;box-sizing:border-box;}",
    ".brand{font-weight:700;letter-spacing:0.06em;}",
    "</style></head><body>",
    "<span class=\"brand\">EXAMARCHIVE</span>",
    "<span></span>",
    "</body></html>",
  ].join("");
}

function buildFooterHtml(userEmail) {
  const safeEmail = String(userEmail || "").trim();
  const watermarkText = safeEmail ? "Personalized copy for " + escapeHtml(safeEmail) : "";
  return [
    "<!DOCTYPE html>",
    "<html lang=\"en\"><head><meta charset=\"UTF-8\"/><style>",
    "body{font-family:Helvetica,sans-serif;font-size:10px;width:100%;margin:0;padding:0 20mm;box-sizing:border-box;}",
    ".footer-container{display:flex;justify-content:space-between;width:100%;}",
    ".footer-left{color:#800000;opacity:0.8;}",
    ".footer-right{color:#800000;text-align:right;white-space:nowrap;}",
    "</style></head><body>",
    "<div class=\"footer-container\">",
    "<div class=\"footer-left\">" + watermarkText + "</div>",
    "<div class=\"footer-right\">Page <span class=\"pageNumber\"></span></div>",
    "</div>",
    "</body></html>",
  ].join("");
}

async function markdownToPdfHtml(markdown, title) {
  const { protectedMarkdown, restore } = protectBracketMath(markdown);
  const parsedHtml = await parseMarkdownToHtml(protectedMarkdown);
  const restoredHtml = restore(typeof parsedHtml === "string" ? parsedHtml : "");
  const renderedMarkdown = sanitizeGeneratedHtml(restoredHtml);
  const coverPageHtml = buildCoverPageHtml({ title, markdown });
  const watermarkSvg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><text x="50%" y="50%" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700" fill="#800000" fill-opacity="0.08" transform="rotate(-45 150 150)" text-anchor="middle">EXAMARCHIVE</text></svg>`,
  );
  return [
    "<!doctype html>",
    "<html><head><meta charset=\"utf-8\"/>",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"/>",
    "<title>" + escapeHtml(title) + "</title>",
    "<link href=\"https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap\" rel=\"stylesheet\">",
    "<script>",
    "MathJax = {",
    "tex: {",
    "inlineMath: [[\"\\\\(\", \"\\\\)\"]],",
    "displayMath: [[\"\\\\[\", \"\\\\]\"]],",
    "},",
    "svg: { fontCache: \"global\" },",
    "};",
    "</script>",
    "<script id=\"MathJax-script\" async src=\"https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js\"></script>",
    "<style>",
    "@page{size:A4;margin:15mm;}",
    "body{font-family:'Inter',sans-serif;font-size:12pt;line-height:1.6;color:#231515;padding:0;margin:0;width:100%;box-sizing:border-box;background-image:url(\"data:image/svg+xml," + watermarkSvg + "\");background-size:230px 230px;background-repeat:repeat;}",
    "main{padding:0;margin:0;width:100%;box-sizing:border-box;}",
    ".cover-page{page-break-after:always;min-height:92vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:0 12mm;}",
    ".cover-page h1{margin:0 0 16px;border-bottom:none;font-size:34px;letter-spacing:0.04em;color:#800000;}",
    ".cover-page .cover-title{margin:0 0 8px;font-size:16px;color:#4b1f1f;}",
    ".cover-page .cover-date{margin:0 0 18px;font-size:13px;color:#6e1111;}",
    ".cover-page h2{border-left:none;color:#800000;margin-bottom:8px;padding-left:0;}",
    ".cover-page ul{display:inline-block;text-align:left;margin:0;padding-left:18px;}",
    "h1,h2,h3,h4,h5,h6{color:#800000;line-height:1.35;}",
    "h1{border-bottom:1px solid #e8d8d8;padding-bottom:6px;}",
    "pre{background:#101828;color:#f8fafc;padding:12px;border-radius:6px;overflow:auto;}",
    "code{background:#f4f4f5;padding:0.1em 0.3em;border-radius:4px;}",
    "blockquote{border-left:3px solid #800000;padding-left:10px;color:#6e1111;}",
    "img{max-width:100%;height:auto;}",
    "</style>",
    "</head><body>",
    "<main>",
    coverPageHtml,
    "<article>" + renderedMarkdown + "</article>",
    "</main>",
    "</body></html>",
  ].join("");
}

function validateGotenbergUrl(rawUrl) {
  const normalized = String(rawUrl || "").trim();
  if (!normalized) {
    throw new Error("Missing GOTENBERG_URL in function environment.");
  }
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("Invalid GOTENBERG_URL in function environment.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("GOTENBERG_URL must use HTTPS.");
  }
  const normalizedHost = parsed.hostname.toLowerCase();
  const trustedHostPattern = /^[a-z0-9-]+\.hf\.space$/;
  if (!trustedHostPattern.test(normalizedHost)) {
    throw new Error(`GOTENBERG_URL must target a trusted ${TRUSTED_GOTENBERG_HOST_SUFFIX} host.`);
  }
  return parsed.toString();
}

function normalizeGotenbergWaitDelay(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "5s";
  return /^\d+(?:ms|s|m|h)$/i.test(trimmed) ? trimmed : "5s";
}

function shouldRetryGotenbergStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function normalizeSafePdfCoreName(rawTitle) {
  const rawValue = String(rawTitle || "generated_document");
  const baseValue = rawValue.toLowerCase().endsWith(".pdf")
    ? rawValue.slice(0, -4)
    : rawValue;
  const isAsciiAlphaNumeric = (char) =>
    (char >= "a" && char <= "z")
    || (char >= "A" && char <= "Z")
    || (char >= "0" && char <= "9");
  const mappedChars = [];
  let previousWasUnderscore = false;
  for (const char of baseValue) {
    const normalizedChar = (isAsciiAlphaNumeric(char) || char === "-" || char === "_") ? char : "_";
    if (normalizedChar === "_") {
      if (previousWasUnderscore) continue;
      previousWasUnderscore = true;
      mappedChars.push(normalizedChar);
      continue;
    }
    previousWasUnderscore = false;
    mappedChars.push(normalizedChar);
  }
  let normalized = mappedChars.join("");
  while (normalized.startsWith("_")) normalized = normalized.slice(1);
  while (normalized.endsWith("_")) normalized = normalized.slice(0, -1);
  if (!normalized) normalized = "generated_document";
  return normalized.slice(0, MAX_SAFE_PDF_FILENAME_CORE_LENGTH);
}

async function renderMarkdownToPdfBuffer(markdown, title, options = {}) {
  const gotenbergUrl = validateGotenbergUrl(process.env.GOTENBERG_URL);
  const gotenbergAuthToken = normalizeBearerToken(process.env.GOTENBERG_AUTH_TOKEN);
  if (!gotenbergAuthToken) {
    throw new Error("Missing GOTENBERG_AUTH_TOKEN in function environment.");
  }

  const html = await markdownToPdfHtml(markdown, title);
  const headerHtml = buildHeaderHtml();
  const footerHtml = buildFooterHtml(options.userEmail);
  const endpoint = new URL(GOTENBERG_CONVERT_ENDPOINT_PATH, gotenbergUrl).toString();
  let lastError = null;

  for (let attempt = 1; attempt <= GOTENBERG_MAX_ATTEMPTS; attempt += 1) {
    try {
      const form = new FormData();
      form.append("files", new Blob([html], { type: "text/html" }), "index.html");
      form.append("files", new Blob([headerHtml], { type: "text/html" }), "header.html");
      form.append("files", new Blob([footerHtml], { type: "text/html" }), "footer.html");
      form.append("displayHeaderFooter", "true");
      form.append("marginTop", "0.79");
      form.append("marginBottom", "0.79");
      form.append("marginLeft", "0.79");
      form.append("marginRight", "0.79");
      form.append("printBackground", "true");
      form.append("waitDelay", normalizeGotenbergWaitDelay(process.env.GOTENBERG_WAIT_DELAY));
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: gotenbergAuthToken },
        body: form,
        signal: AbortSignal.timeout(GOTENBERG_TIMEOUT_MS),
      });
      if (!response.ok) {
        const responseBody = await response.text().catch(() => "");
        const statusError = new Error(
          `Gotenberg request failed (${response.status}): ${responseBody.slice(0, NOTIFY_WEBHOOK_ERROR_LOG_MAX_CHARS)}`,
        );
        statusError.status = response.status;
        throw statusError;
      }
      const pdfArrayBuffer = await response.arrayBuffer();
      return Buffer.from(pdfArrayBuffer);
    } catch (error) {
      lastError = error;
      const status = Number(error?.status || 0);
      const canRetry = shouldRetryGotenbergStatus(status) || !status;
      if (!canRetry || attempt >= GOTENBERG_MAX_ATTEMPTS) {
        break;
      }
      const backoffMs = Math.min(
        GOTENBERG_MAX_BACKOFF_MS,
        GOTENBERG_BASE_BACKOFF_MS * attempt,
      );
      await sleep(backoffMs);
    }
  }
  throw lastError || new Error("Failed to render PDF with Gotenberg.");
}

async function runGeminiCompletion({ apiKey, prompt, model }) {
  let response;
  try {
    response = await fetch(
      `${GEMINI_ENDPOINT}/models/${encodeURIComponent(model || DEFAULT_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 4000, temperature: 0.4 },
        }),
        signal: AbortSignal.timeout(GEMINI_REQUEST_TIMEOUT_MS),
      },
    );
  } catch (error) {
    const isTimeout = error && typeof error === "object" && error.name === "TimeoutError";
    const requestError = new Error(
      isTimeout
        ? `Gemini request timed out after ${GEMINI_REQUEST_TIMEOUT_MS}ms.`
        : `Gemini request failed: ${String(error?.message || error)}`,
    );
    requestError.code = isTimeout ? "GEMINI_TIMEOUT" : "GEMINI_REQUEST_FAILED";
    throw requestError;
  }
  const bodyText = await response.text();
  if (!response.ok) {
    const error = new Error(`Gemini request failed (status ${response.status})`);
    error.status = response.status;
    error.responseBody = bodyText;
    throw error;
  }
  let payload = {};
  try {
    payload = JSON.parse(bodyText);
  } catch {
    throw new Error("Gemini returned invalid JSON.");
  }
  const content = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Gemini returned empty content.");
  }
  return content;
}

function isRetryableGeminiStatus(status) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function isHighRetryBudgetGeminiStatus(status) {
  return status === 429 || (status >= 500 && status <= 599);
}

async function runGeminiCompletionWithRetry({ apiKey, prompt, model }) {
  let lastError = null;
  for (let attempt = 1; attempt <= GEMINI_RETRYABLE_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await runGeminiCompletion({ apiKey, prompt, model });
    } catch (error) {
      lastError = error;
      const status = Number(error?.status || 0);
      const canRetry = isRetryableGeminiStatus(status) || !status;
      const maxAttemptsForError = isHighRetryBudgetGeminiStatus(status)
        ? GEMINI_RETRYABLE_MAX_ATTEMPTS
        : DEFAULT_GEMINI_MAX_ATTEMPTS;
      if (!canRetry || attempt >= maxAttemptsForError) {
        throw error;
      }
      const delay = GEMINI_STRICT_BACKOFF_BASE_MS * (2 ** (attempt - 1));
      console.warn(`[Gemini Attempt ${attempt}] Failed with status ${status}. Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  throw lastError || new Error("Gemini generation failed.");
}

function getNotesSystemPrompt() {
  return String(process.env.UNIT_NOTES_SYSTEM_PROMPT || "").trim() || [
    "INSTRUCTIONS:",
    "You are an academic formatting engine. You MUST output your response matching this exact Markdown template. Use double line breaks (\\n\\n) between all sections and bullet points.",
    "You are writing a comprehensive, university-level textbook chapter. You MUST write a minimum of 3000 words.",
    "DO NOT summarize. Expand on EVERY single concept in the syllabus with exhaustive theoretical depth, historical context, and multiple worked examples.",
    "If the syllabus contains multiple sub-topics, dedicate at least 3-4 dense paragraphs to each individual sub-topic.",
    "",
    "=== BEGIN TEMPLATE ===",
    "## Syllabus Highlights",
    "* {Highlight 1}",
    "",
    "* {Highlight 2}",
    "",
    "## {Topic Title}",
    "{Theoretical Explanation}",
    "",
    "### Theoretical Worked Example",
    "**Problem:** {Problem statement}",
    "",
    "**Solution:**",
    "1. {Step 1}",
    "2. {Step 2}",
    "",
    "**Conclusion:** {Conclusion}",
    "=== END TEMPLATE ===",
    "",
    "MATH RULES:",
    "- You MUST use \\( and \\) for inline LaTeX math. Example: The energy is \\(E = mc^2\\).",
    "- Block math MUST be written as:",
    "\\[",
    "F = G \\frac{m_1 m_2}{r^2}",
    "\\]",
    "- NEVER use the $ symbol for math.",
    "- ALWAYS use the backslash \\ for commands (e.g., \\frac, \\pi, \\mu).",
    "- When writing numericals, step-by-step solutions, or mathematical derivations, you MUST use block math (\\[...\\]). Do not bury equations inside a text paragraph. Every equation step must start on a new line.",
  ].join("\n");
}

function getSolvedPaperSystemPrompt() {
  return String(process.env.SOLVED_PAPER_SYSTEM_PROMPT || "").trim() || [
    "Answer all questions below in markdown.",
    "Answer every question in this chunk.",
    "Use clear markdown headings by question.",
    "Keep explanations exam-focused and concise.",
    "Do not add a top-level document title.",
  ].join("\n");
}

async function fetchTavilyContext(query) {
  const tavilyApiKey = String(process.env.TAVILY_API_KEY || "").trim();
  if (!tavilyApiKey || !query.trim()) {
    return "";
  }

  let response;
  try {
    response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyApiKey,
        query,
        search_depth: "advanced",
        max_results: 5,
        include_answer: true,
        include_raw_content: false,
      }),
      signal: AbortSignal.timeout(TAVILY_TIMEOUT_MS),
    });
  } catch {
    return "";
  }
  if (!response.ok) {
    return "";
  }
  const payload = await response.json().catch(() => null);
  const answer = typeof payload?.answer === "string" ? payload.answer.trim() : "";
  const results = Array.isArray(payload?.results) ? payload.results : [];
  const snippets = results
    .slice(0, 5)
    .map((item, index) => {
      const title = typeof item?.title === "string" ? item.title.trim() : `Result ${index + 1}`;
      const content = typeof item?.content === "string" ? item.content.trim() : "";
      const url = typeof item?.url === "string" ? item.url.trim() : "";
      return [title, content, url ? `Source: ${url}` : ""].filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n\n");

  return [answer ? `Summary:\n${answer}` : "", snippets ? `References:\n${snippets}` : ""]
    .filter(Boolean)
    .join("\n\n");
}

function formatWorkerErrorMessage(error) {
  if (!(error instanceof Error)) return String(error).slice(0, 2000);
  const details = [error.message];
  if (typeof error.code !== "undefined") details.push(`code=${String(error.code)}`);
  if (typeof error.status !== "undefined") details.push(`status=${String(error.status)}`);
  const cause = error.cause;
  if (cause instanceof Error && cause.message) {
    details.push(`cause=${cause.message}`);
  }
  return details.filter(Boolean).join(" | ").slice(0, 2000);
}

function parseFunctionInput(rawInput) {
  if (rawInput === null || typeof rawInput === "undefined") return {};
  if (typeof rawInput === "object") return rawInput;
  if (typeof rawInput !== "string") {
    throw new Error("Function payload must be an object or JSON string.");
  }
  const trimmed = rawInput.trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error("Function payload must be valid JSON.");
  }
}

function isBodyWrappedPayload(value) {
  return (
    value
    && typeof value === "object"
    && !Array.isArray(value)
    && !value.jobId
    && !value.payload
    && Object.hasOwn(value, "body")
  );
}

async function updateJob(db, jobId, payload) {
  await db.updateDocument(DATABASE_ID, JOB_COLLECTION_ID, jobId, payload);
}

function buildJobTitle(payload) {
  if (payload.jobType === "solved-paper") {
    return `${payload.paperCode}_${payload.year || "latest"}_solved_paper.pdf`;
  }
  return `${payload.paperCode}_Unit_${payload.unitNumber}_Notes.pdf`;
}

function normalizeAbsoluteHttpUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  // Block malformed "double protocol" values that URL() can parse unexpectedly (e.g. https://https://...).
  if (/^https?:\/\/https?:\/\//i.test(value)) return "";
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    const webhookSecret = String(process.env.AI_JOB_WEBHOOK_SECRET || "").trim();
    if (webhookSecret && parsed.protocol !== "https:") {
      console.error("[pdf-generator] Webhook URL rejected: HTTPS required when AI_JOB_WEBHOOK_SECRET is configured.", {
        protocol: parsed.protocol,
        callbackUrl: value.slice(0, MAX_LOGGED_CALLBACK_URL_CHARS),
        truncated: value.length > MAX_LOGGED_CALLBACK_URL_CHARS,
      });
      return "";
    }
    return parsed.toString();
  } catch (error) {
    console.error("[pdf-generator] Invalid completion callback URL received.", {
      callbackUrl: value.slice(0, MAX_LOGGED_CALLBACK_URL_CHARS),
      truncated: value.length > MAX_LOGGED_CALLBACK_URL_CHARS,
      error: String(error?.message || error),
    });
    return "";
  }
}

function buildTrustedSiteUrlFromVercelUrl(rawVercelUrl) {
  const normalizedVercelUrl = String(rawVercelUrl || "").trim().replace(/^https?:\/\//i, "");
  if (!normalizedVercelUrl) return "";
  return normalizeAbsoluteHttpUrl(`https://${normalizedVercelUrl}`);
}

function shouldUsePreviewWebhookUrl({ canonicalUrl, previewUrl, vercelEnv }) {
  if (!previewUrl) return false;
  if (!canonicalUrl) return true;
  if (String(vercelEnv || "").trim().toLowerCase() !== "preview") return false;
  try {
    return new URL(canonicalUrl).origin !== new URL(previewUrl).origin;
  } catch {
    return true;
  }
}

function resolveCallbackBaseSiteUrl() {
  const siteUrl = normalizeAbsoluteHttpUrl(String(process.env.SITE_URL || "").trim());
  const nextPublicSiteUrl = normalizeAbsoluteHttpUrl(String(process.env.NEXT_PUBLIC_SITE_URL || "").trim());
  const canonicalSiteUrl = siteUrl || nextPublicSiteUrl;
  const trustedVercelSiteUrl = buildTrustedSiteUrlFromVercelUrl(
    String(process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL || "").trim(),
  );
  const vercelEnv = String(process.env.VERCEL_ENV || "").trim().toLowerCase();
  if (shouldUsePreviewWebhookUrl({ canonicalUrl: canonicalSiteUrl, previewUrl: trustedVercelSiteUrl, vercelEnv })) {
    return trustedVercelSiteUrl.replace(/\/+$/, "");
  }
  return (canonicalSiteUrl || trustedVercelSiteUrl).replace(/\/+$/, "");
}

function resolveNotifyCompletionUrl(callbackUrl) {
  const callbackOverride = normalizeAbsoluteHttpUrl(callbackUrl);
  if (callbackOverride) {
    // The webhook secret (AI_JOB_WEBHOOK_SECRET) is the authentication layer that
    // protects the notify-completion endpoint. Origin-based restrictions are
    // intentionally omitted here to allow Vercel Preview deployment URLs to
    // deliver webhooks successfully. Log the override URL for audit visibility.
    console.log("[pdf-generator] Using callbackOverride for completion webhook.", { callbackOverride });
    return { url: callbackOverride, reason: "callback_override" };
  }
  const siteUrl = resolveCallbackBaseSiteUrl();
  if (!siteUrl) {
    console.error("[pdf-generator] CRITICAL: No valid base URL found (checked SITE_URL, NEXT_PUBLIC_SITE_URL, and VERCEL_URL); completion webhook cannot be delivered safely.", {
      hasCallbackUrl: false,
    });
    return { url: "", reason: "missing_base_url" };
  }
  try {
    const baseUrl = new URL(siteUrl);
    return { url: new URL(NOTIFY_COMPLETION_PATH, `${baseUrl.toString()}/`).toString(), reason: "site_url" };
  } catch {
    return { url: "", reason: "invalid_site_url" };
  }
}

function getNotifyCompletionUrl(callbackUrl) {
  return resolveNotifyCompletionUrl(callbackUrl).url;
}

async function notifyCompletionWebhook({ jobId, status, fileId, userId, userEmail, callbackUrl }) {
  if (!resolveCallbackBaseSiteUrl()) {
    console.error("[pdf-generator] CRITICAL: No base URL environment variable found (SITE_URL, NEXT_PUBLIC_SITE_URL, or VERCEL_URL); notify-completion webhook delivery may be skipped.");
  }
  const notifyResolution = resolveNotifyCompletionUrl(callbackUrl);
  const notifyUrl = notifyResolution.url;
  if (!notifyUrl) {
    console.error("[pdf-generator] Completion webhook callback skipped due to URL resolution failure.", {
      reason: notifyResolution.reason,
      hasCallbackUrl: Boolean(String(callbackUrl || "").trim()),
      hasSiteUrl: Boolean(String(process.env.SITE_URL || "").trim()),
      hasNextPublicSiteUrl: Boolean(String(process.env.NEXT_PUBLIC_SITE_URL || "").trim()),
      hasVercelUrl: Boolean(String(process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL || "").trim()),
    });
    return;
  }
  const headers = { "Content-Type": "application/json" };
  const webhookSecret = String(process.env.AI_JOB_WEBHOOK_SECRET || "").trim();
  if (webhookSecret) {
    headers.Authorization = normalizeBearerToken(webhookSecret);
  }
  const callbackPayload = {
    jobId: String(jobId || "").trim(),
    status: String(status || "").trim().toLowerCase(),
    fileId: String(fileId || "").trim(),
  };
  const normalizedUserId = String(userId || "").trim();
  const normalizedUserEmail = String(userEmail || "").trim();
  if (normalizedUserId) {
    callbackPayload.userId = normalizedUserId;
  }
  if (normalizedUserEmail) {
    callbackPayload.userEmail = normalizedUserEmail;
  }

  const maxAttempts = 3;
  const baseBackoffMs = 300;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response;
    try {
      response = await fetch(notifyUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(callbackPayload),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) {
        console.error("[pdf-generator] Completion webhook request error after all attempts.", {
          url: notifyUrl,
          attempts: maxAttempts,
          message: error instanceof Error ? error.message : String(error),
          error,
        });
        return;
      }
      console.error("[pdf-generator] Completion webhook request error (will retry).", {
        attempt,
        maxAttempts,
        url: notifyUrl,
        message: error instanceof Error ? error.message : String(error),
        error,
      });
      // Jitter from 0.85 to 1.15 (0.01 increments) helps avoid synchronized retry bursts.
      const jitter = randomInt(85, 116) / 100;
      const backoffMs = baseBackoffMs * (2 ** (attempt - 1)) * jitter;
      await sleep(backoffMs);
      continue;
    }

    console.log("[pdf-generator] Completion webhook callback response received.", {
      url: notifyUrl,
      status: response.status,
      ok: response.ok,
      attempt,
    });

    if (!response.ok) {
      const responseBody = await response.text().catch(() => "");
      const shouldRetry = response.status === 429 || response.status >= 500;
      if (shouldRetry && attempt < maxAttempts) {
        console.error("[pdf-generator] Completion webhook request failed (will retry).", {
          attempt,
          maxAttempts,
          status: response.status,
          body: responseBody.slice(0, NOTIFY_WEBHOOK_ERROR_LOG_MAX_CHARS),
        });
        // Jitter from 0.85 to 1.15 (0.01 increments) helps avoid synchronized retry bursts.
        const jitter = randomInt(85, 116) / 100;
        const backoffMs = baseBackoffMs * (2 ** (attempt - 1)) * jitter;
        await sleep(backoffMs);
        continue;
      }
      console.error("[pdf-generator] Completion webhook request failed after all attempts.", {
        status: response.status,
        body: responseBody.slice(0, NOTIFY_WEBHOOK_ERROR_LOG_MAX_CHARS),
        attempts: attempt,
      });
      return;
    }

    return;
  }
  if (lastError) {
    console.error("[pdf-generator] Completion webhook request failed.", {
      url: notifyUrl,
      message: lastError instanceof Error ? lastError.message : String(lastError),
    });
  }
}

async function generateNotesPayload(db, payload) {
  const syllabusRes = await db.listDocuments(DATABASE_ID, SYLLABUS_TABLE_COLLECTION_ID, [
    Query.equal("university", payload.university),
    Query.equal("course", payload.course),
    Query.equal("stream", payload.stream),
    Query.equal("type", payload.type),
    Query.equal("paper_code", payload.paperCode),
    Query.equal("unit_number", payload.unitNumber),
    Query.limit(1),
  ]);
  const syllabusDoc = syllabusRes.documents?.[0];
  if (!syllabusDoc) {
    throw new Error("No syllabus data found for this unit.");
  }

  const syllabusContent = String(syllabusDoc.syllabus_content || "").trim();
  const subTopics = splitSyllabusIntoSubTopics(syllabusContent);
  if (subTopics.length === 0) {
    throw new Error("No sub-topics found for this unit.");
  }

  const chunks = splitIntoLogicalChunks(subTopics, LOGICAL_CHUNK_COUNT);
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiApiKey) throw new Error("Missing GEMINI_API_KEY.");

  const generated = [];
  for (const [index, topicsChunk] of chunks.entries()) {
    if (index > 0) {
      await sleep(GEMINI_COOLDOWN_MS);
    }
    const prompt = `${getNotesSystemPrompt()}

University: ${payload.university}
Course: ${payload.course}
Stream: ${payload.stream}
Type: ${payload.type}
Paper Code: ${payload.paperCode}
Unit Number: ${payload.unitNumber}
Chunk: ${index + 1}/${chunks.length}

Sub-topics:
${topicsChunk.map((topic, i) => `${i + 1}. ${topic}`).join("\n")}
`;
    const geminiResponseText = await runGeminiCompletionWithRetry({
      apiKey: geminiApiKey,
      prompt,
      model: payload.model || DEFAULT_MODEL,
    });
    const finalMarkdown = sanitizeAiMath(geminiResponseText);
    generated.push(finalMarkdown);
  }

  return generated.join("\n\n---\n\n");
}

async function generateSolvedPaperPayload(db, payload) {
  const questionsRes = await db.listDocuments(DATABASE_ID, QUESTIONS_TABLE_COLLECTION_ID, [
    Query.equal("university", payload.university),
    Query.equal("course", payload.course),
    Query.equal("stream", payload.stream),
    Query.equal("type", payload.type),
    Query.equal("paper_code", payload.paperCode),
    Query.equal("year", payload.year),
    Query.orderAsc("question_no"),
    Query.limit(500),
  ]);
  const questions = (questionsRes.documents || []).filter(
    (doc) => typeof doc.question_content === "string" && doc.question_content.trim().length > 0,
  );
  if (questions.length === 0) {
    throw new Error("No questions found for this paper/year.");
  }

  const chunks = splitIntoLogicalChunks(questions, LOGICAL_CHUNK_COUNT);
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiApiKey) throw new Error("Missing GEMINI_API_KEY.");
  const tavilyContext = await fetchTavilyContext(
    `${payload.university} ${payload.course} ${payload.paperCode} ${payload.year} solved paper key points`,
  );

  const solved = [];
  for (const [index, questionsChunk] of chunks.entries()) {
    if (index > 0) {
      await sleep(GEMINI_COOLDOWN_MS);
    }
    const prompt = `${getSolvedPaperSystemPrompt()}

University: ${payload.university}
Course: ${payload.course}
Stream: ${payload.stream}
Type: ${payload.type}
Paper Code: ${payload.paperCode}
Year: ${payload.year}
Chunk: ${index + 1}/${chunks.length}

Questions:
${questionsChunk.map((questionDoc, qIndex) => {
  const qNo = String(questionDoc.question_no || qIndex + 1).trim();
  const qSub = typeof questionDoc.question_subpart === "string" ? questionDoc.question_subpart.trim() : "";
  const marks = questionDoc.marks ?? "N/A";
  const content = String(questionDoc.question_content || "").trim();
  return `Q${qNo}${qSub ? `(${qSub})` : ""} [${marks} marks]\n${content}`;
}).join("\n\n")}
${tavilyContext ? `\n\nWeb context (Tavily):\n${tavilyContext}` : ""}
`;
    const geminiResponseText = await runGeminiCompletionWithRetry({
      apiKey: geminiApiKey,
      prompt,
      model: payload.model || DEFAULT_MODEL,
    });
    const finalMarkdown = sanitizeAiMath(geminiResponseText);
    solved.push(finalMarkdown);
  }
  return solved.join("\n\n---\n\n");
}

async function processGenerationJob(rawInput, options = {}) {
  const endpoint = String(process.env.APPWRITE_ENDPOINT || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "").trim();
  const projectId = String(process.env.APPWRITE_PROJECT_ID || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "").trim();
  const apiKey = String(process.env.APPWRITE_API_KEY || "").trim();
  if (!endpoint || !projectId || !apiKey) {
    throw new Error("Missing APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, or APPWRITE_API_KEY.");
  }

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const db = new Databases(client);
  const storage = new Storage(client);

  const outer = parseFunctionInput(rawInput);
  const parsed = isBodyWrappedPayload(outer)
    ? parseFunctionInput(outer.body)
    : outer;
  const jobId = String(parsed.jobId || "").trim();
  const payload = typeof parsed.payload === "string"
    ? parseFunctionInput(parsed.payload)
    : (parsed.payload && typeof parsed.payload === "object" ? parsed.payload : parsed);
  if (!jobId) throw new Error("Missing jobId in function payload.");

  await updateJob(db, jobId, {
    status: "running",
    started_at: new Date().toISOString(),
    progress_percent: 10,
    error_message: "",
  });

  try {
    const normalizedJobType = String(payload.jobType || "").trim().toLowerCase();
    let markdown = "";
    if (normalizedJobType !== "notes" && normalizedJobType !== "solved-paper") {
      throw new Error(`Unsupported jobType "${payload.jobType}".`);
    }

    const normalizeRequiredCacheSegment = (value, fieldName) => {
      const normalizedValue = String(value ?? "").trim();
      if (!normalizedValue) {
        throw new Error(`Missing ${fieldName} in payload for ${normalizedJobType} cache key.`);
      }
      return normalizedValue;
    };
    const normalizeOptionalCacheSegment = (value, fallbackValue) => {
      const normalizedValue = String(value ?? "").trim();
      return normalizedValue.length > 0 ? normalizedValue : fallbackValue;
    };
    const cacheScopeSegment = normalizedJobType === "notes"
      ? normalizeRequiredCacheSegment(payload.unitNumber, "unitNumber")
      : normalizeRequiredCacheSegment(payload.year, "year");
    const cacheKeySegments = [
      normalizeRequiredCacheSegment(payload.paperCode, "paperCode"),
      cacheScopeSegment,
      normalizeRequiredCacheSegment(payload.stream, "stream"),
      normalizeRequiredCacheSegment(payload.course, "course"),
      normalizeRequiredCacheSegment(payload.type, "type"),
      normalizeRequiredCacheSegment(payload.university, "university"),
      normalizeOptionalCacheSegment(payload.semester, "na"),
      normalizeOptionalCacheSegment(payload.model, DEFAULT_MODEL),
    ];
    const cacheKey = cacheKeySegments.join("_").replace(/[^a-zA-Z0-9_-]/g, "_");
    const legacyCacheKey = [
      normalizeRequiredCacheSegment(payload.paperCode, "paperCode"),
      cacheScopeSegment,
      normalizeRequiredCacheSegment(payload.stream, "stream"),
      normalizeRequiredCacheSegment(payload.course, "course"),
      normalizeRequiredCacheSegment(payload.type, "type"),
    ].join("_").replace(/[^a-zA-Z0-9_-]/g, "_");
    const cacheFileName = `${cacheKey}.md`;
    const legacyCacheFileName = `${legacyCacheKey}.md`;
    const cacheBucketId = normalizedJobType === "notes"
      ? CACHED_UNIT_NOTES_BUCKET_ID
      : CACHED_SOLVED_PAPERS_BUCKET_ID;
    let loadedFromCache = false;

    // Fast path: cachedMarkdown was pre-fetched by the route dispatcher and
    // injected into the execution payload to avoid an extra storage round-trip
    // and to guarantee the LLM is bypassed (saves API credits).
    if (typeof payload.cachedMarkdown === "string") {
      const trimmedCachedMarkdown = payload.cachedMarkdown.trim();
      if (trimmedCachedMarkdown) {
        markdown = trimmedCachedMarkdown;
        loadedFromCache = true;
        console.log("[pdf-generator] Using cachedMarkdown from dispatch payload (global cache hit).", {
          jobId,
          jobType: normalizedJobType,
          markdownLength: trimmedCachedMarkdown.length,
        });
      }
    }

    let cacheFileId = "";
    if (!loadedFromCache) {
      try {
        const cachedFiles = await storage.listFiles(cacheBucketId, [
          Query.search("name", cacheKey),
        Query.orderDesc("$createdAt"),
        Query.limit(10),
      ]);
      const exactMatch = Array.isArray(cachedFiles.files)
        ? (
          cachedFiles.files.find((file) => String(file.name || "").trim() === cacheFileName)
          || cachedFiles.files.find((file) => String(file.name || "").trim() === legacyCacheFileName)
        )
        : null;
      const cachedFile = exactMatch;
      if (cachedFile && cachedFile.$id) {
        const cachedMarkdownBuffer = await storage.getFileDownload(cacheBucketId, cachedFile.$id);
        const cachedMarkdown = Buffer.from(cachedMarkdownBuffer).toString("utf8");
        if (cachedMarkdown.trim()) {
          markdown = cachedMarkdown;
          loadedFromCache = true;
          cacheFileId = String(cachedFile.$id);
          console.log("[pdf-generator] Loaded markdown from cache bucket.", {
            jobId,
            jobType: normalizedJobType,
            cacheBucketId,
            cacheFileId,
            cacheFileName: String(cachedFile.name || ""),
          });
        }
      }
    } catch (cacheReadError) {
        console.warn("[pdf-generator] Markdown cache read failed. Proceeding with fresh generation.", {
          jobId,
          jobType: normalizedJobType,
          cacheBucketId,
          cacheKey,
          message: cacheReadError instanceof Error ? cacheReadError.message : String(cacheReadError),
        });
      }
    } // end if (!loadedFromCache) – file-cache lookup

    if (!loadedFromCache) {
      if (normalizedJobType === "notes") {
        markdown = await generateNotesPayload(db, payload);
      } else {
        markdown = await generateSolvedPaperPayload(db, payload);
      }
      try {
        const cacheFile = await storage.createFile(
          cacheBucketId,
          ID.unique(),
          InputFile.fromBuffer(Buffer.from(markdown, "utf8"), cacheFileName),
        );
        cacheFileId = String(cacheFile.$id);
      } catch (cacheWriteError) {
        const contextMessage = "[pdf-generator] Markdown cache write failed. Without the markdown cache the generation result will be lost.";
        console.error(contextMessage, {
          jobId,
          jobType: normalizedJobType,
          cacheBucketId,
          cacheKey,
          message: cacheWriteError instanceof Error ? cacheWriteError.message : String(cacheWriteError),
        });
        const wrappedError = new Error(
          `${contextMessage}: ${cacheWriteError instanceof Error ? cacheWriteError.message : String(cacheWriteError)}`,
        );
        wrappedError.cause = cacheWriteError;
        throw wrappedError;
      }
    }
    markdown = sanitizeAiMath(markdown);

    await updateJob(db, jobId, { progress_percent: 80 });

    const pdfTitle = buildJobTitle(payload);
    const pdfBuffer = await renderMarkdownToPdfBuffer(markdown, pdfTitle, {
      userEmail: String(payload.userEmail || "").trim(),
    });
    const safePdfCoreName = normalizeSafePdfCoreName(pdfTitle);
    const safePdfFileName = `${safePdfCoreName}.pdf`;
    const pdfFile = await storage.createFile(
      PAPERS_BUCKET_ID,
      ID.unique(),
      InputFile.fromBuffer(pdfBuffer, safePdfFileName),
    );
    const pdfFileId = String(pdfFile?.$id || "").trim();
    if (!pdfFileId) {
      throw new Error("PDF upload completed without returning a valid file ID.");
    }

    await updateJob(db, jobId, {
      status: "completed",
      progress_percent: 100,
      // result_file_id now points to a concrete PDF file in PAPERS_BUCKET_ID.
      result_file_id: pdfFileId,
      completed_at: new Date().toISOString(),
    });
    await sleep(COMPLETION_WEBHOOK_DELAY_MS);
    try {
      await notifyCompletionWebhook({
        jobId,
        status: "completed",
        fileId: pdfFileId,
        userId: String(payload.userId || "").trim(),
        userEmail: String(payload.userEmail || "").trim(),
        callbackUrl: String(payload.callbackUrl || "").trim(),
      });
    } catch (webhookError) {
      console.warn(
        `[pdf-generator] completion webhook failed for job ${jobId}: ${formatWorkerErrorMessage(webhookError)}`,
      );
    }

    return { ok: true, jobId, fileId: pdfFileId };
  } catch (error) {
    await updateJob(db, jobId, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: formatWorkerErrorMessage(error),
    }).catch((err) => console.error("Failed to update job status to failed:", err));
    try {
      await notifyCompletionWebhook({
        jobId,
        status: "failed",
        fileId: "",
        userId: String(payload.userId || "").trim(),
        userEmail: String(payload.userEmail || "").trim(),
        callbackUrl: String(payload.callbackUrl || "").trim(),
      });
    } catch (webhookError) {
      console.error("[pdf-generator] failed to deliver completion webhook.", {
        jobId,
        error: webhookError?.stack || String(webhookError),
      });
    }
    throw error;
  }
}

module.exports = async ({ req, res, log, error }) => {
  try {
    const rawInput = req?.body || process.env.APPWRITE_FUNCTION_EVENT_DATA || process.env.APPWRITE_FUNCTION_DATA || "{}";
    const result = await processGenerationJob(rawInput);
    if (typeof log === "function") log(`[pdf-generator] completed job ${result.jobId}`);
    if (res && typeof res.json === "function") {
      return res.json(result);
    }
    return result;
  } catch (err) {
    if (typeof error === "function") error(err?.stack || String(err));
    if (res && typeof res.json === "function") {
      return res.json({ ok: false, message: String(err?.message || err) }, 500);
    }
    throw err;
  }
};

module.exports.processGenerationJob = processGenerationJob;
module.exports.notifyCompletionWebhook = notifyCompletionWebhook;
module.exports.getNotifyCompletionUrl = getNotifyCompletionUrl;
module.exports.runGeminiCompletionWithRetry = runGeminiCompletionWithRetry;
module.exports.sanitizeAiMath = sanitizeAiMath;
module.exports.markdownToPdfHtml = markdownToPdfHtml;
