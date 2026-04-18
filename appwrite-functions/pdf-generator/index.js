/* eslint-disable no-console */
const { Client, Databases, Storage, Query, ID } = require("node-appwrite");
const { InputFile } = require("node-appwrite/file");
const katex = require("katex");
const sanitizeHtml = require("sanitize-html");
const he = require("he");

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = process.env.GEMINI_MODEL_ID || "gemini-3.1-flash-lite-preview";
const GEMINI_COOLDOWN_MS = 3000;
const LOGICAL_CHUNK_COUNT = 5;
const geminiRequestTimeoutRaw = Number(process.env.GEMINI_REQUEST_TIMEOUT_MS);
const geminiMaxAttemptsRaw = Number(process.env.GEMINI_MAX_ATTEMPTS);
const geminiBaseBackoffRaw = Number(process.env.GEMINI_BASE_BACKOFF_MS);
const gotenbergRequestTimeoutRaw = Number(process.env.GOTENBERG_REQUEST_TIMEOUT_MS);
const gotenbergMaxAttemptsRaw = Number(process.env.GOTENBERG_MAX_ATTEMPTS);
const gotenbergBaseBackoffRaw = Number(process.env.GOTENBERG_BASE_BACKOFF_MS);
const gotenbergMaxHtmlBytesRaw = Number(process.env.GOTENBERG_MAX_HTML_BYTES);
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
const GOTENBERG_ENDPOINT_PATH = "/forms/chromium/convert/html";
const GOTENBERG_MERGE_ENDPOINT_PATH = "/forms/pdfengines/merge";
const TRUSTED_GOTENBERG_HOST_SUFFIX = ".hf.space";
const MARKDOWN_SECTION_DELIMITER = "\n\n---\n\n";
const MARKDOWN_SECTION_DELIMITER_REGEX = /\n{2,}---\n{2,}/;
const MATHJAX_CONFIG_SCRIPT = 'window.MathJax={tex:{inlineMath:[["$","$"],["\\\\(","\\\\)"]],displayMath:[["$$","$$"],["\\\\[","\\\\]"]]}};';
const MATHJAX_CDN_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
const BRAND_WATERMARK_SVG = encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
    <text
      x="50%"
      y="50%"
      font-family="Inter, Arial, sans-serif"
      font-size="22"
      font-weight="700"
      fill="#800000"
      fill-opacity="0.08"
      transform="rotate(-45 150 150)"
      text-anchor="middle"
    >
      EXAMARCHIVE
    </text>
  </svg>
`);
const BRAND_WATERMARK_DATA_URL = `data:image/svg+xml,${BRAND_WATERMARK_SVG}`;
const GOTENBERG_REQUEST_TIMEOUT_MS = Number.isFinite(gotenbergRequestTimeoutRaw)
  ? Math.max(1_000, gotenbergRequestTimeoutRaw)
  : 45_000;
const GOTENBERG_MAX_ATTEMPTS = Number.isInteger(gotenbergMaxAttemptsRaw)
  ? Math.max(1, gotenbergMaxAttemptsRaw)
  : 3;
const GOTENBERG_BASE_BACKOFF_MS = Number.isFinite(gotenbergBaseBackoffRaw)
  ? Math.max(250, gotenbergBaseBackoffRaw)
  : 1500;
const GOTENBERG_MAX_HTML_BYTES = Number.isFinite(gotenbergMaxHtmlBytesRaw)
  ? Math.max(256_000, gotenbergMaxHtmlBytesRaw)
  : 1_500_000;
const GOTENBERG_ERROR_LOG_MAX_CHARS = 2_000;
const TAVILY_TIMEOUT_MS = Number.isFinite(tavilyTimeoutRaw)
  ? Math.max(1_000, tavilyTimeoutRaw)
  : 8_000;

const DATABASE_ID = process.env.DATABASE_ID || "examarchive";
const JOB_COLLECTION_ID = process.env.AI_JOBS_COLLECTION_ID || "ai_generation_jobs";
const SYLLABUS_TABLE_COLLECTION_ID = process.env.SYLLABUS_TABLE_COLLECTION_ID || "Syllabus_Table";
const QUESTIONS_TABLE_COLLECTION_ID = process.env.QUESTIONS_TABLE_COLLECTION_ID || "Questions_Table";
const PAPERS_BUCKET_ID = process.env.APPWRITE_BUCKET_ID || "papers";
const NOTIFY_COMPLETION_PATH = "/api/ai/notify-completion";
const NOTIFY_WEBHOOK_ERROR_LOG_MAX_CHARS = 2_000;
const MAX_LOGGED_CALLBACK_URL_CHARS = 500;

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

function sanitizeHtmlText(value) {
  return he.encode(value ?? "");
}

function wrapHtmlTag(tagName, safeInnerHtml) {
  return ["<", tagName, ">", safeInnerHtml, "</", tagName, ">"].join("");
}

const PDF_DOCUMENT_STYLES = [
  "body { font-family: Inter, Arial, sans-serif; color: #2b1a1a; margin: 0; line-height: 1.7; font-size: 15px; }",
  `body { background-image: url("${BRAND_WATERMARK_DATA_URL}"); background-size: 300px 300px; background-repeat: repeat; }`,
  "main { padding: 16mm 12mm; }",
  "h1, h2, h3, h4, h5, h6 { color: #800000; margin: 1.2em 0 0.5em; line-height: 1.3; }",
  "h1 { font-size: 28px; border-bottom: 2px solid #e7d8d8; padding-bottom: 8px; }",
  "h2 { font-size: 22px; }",
  "h3 { font-size: 18px; }",
  "p, ul, ol, blockquote { margin: 0.7em 0; }",
  "code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace; background: #f3f4f6; padding: 0.1em 0.35em; border-radius: 4px; }",
  "pre { background: #0b1020; color: #f8fafc; padding: 14px; border-radius: 8px; overflow-x: auto; }",
  "blockquote { border-left: 4px solid #800000; padding-left: 12px; color: #6e1111; }",
  ".watermark { position: fixed; right: 20px; bottom: 14px; font-size: 11px; color: #800000; opacity: 0.65; }",
  ".katex-display { margin: 1em 0; }",
].join("");

function renderLatexMathMl(markdown) {
  const source = String(markdown || "");
  return source
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, expression) => katex.renderToString(String(expression).trim(), {
      throwOnError: false,
      displayMode: true,
      output: "mathml",
    }))
    .replace(/\$([^\n$]+?)\$/g, (_, expression) => katex.renderToString(String(expression).trim(), {
      throwOnError: false,
      displayMode: false,
      output: "mathml",
    }));
}

function sanitizeGeneratedHtml(input) {
  return sanitizeHtml(input, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "h1",
      "h2",
      "img",
      "span",
      "math",
      "semantics",
      "mrow",
      "mi",
      "mo",
      "mn",
      "msup",
      "msub",
      "msubsup",
      "mfrac",
      "msqrt",
      "mroot",
      "munder",
      "mover",
      "munderover",
      "mspace",
      "mstyle",
      "mtext",
      "mphantom",
      "mpadded",
      "menclose",
      "mtable",
      "mtr",
      "mtd",
      "annotation",
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      span: ["class"],
      math: ["xmlns", "display"],
      annotation: ["encoding"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      img: ["data"],
    },
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowProtocolRelative: false,
  });
}

function renderHtmlDocument({ safeTitle, safeParagraphsHtml }) {
  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    '<meta charset="utf-8"/>',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    '<link rel="preconnect" href="https://fonts.googleapis.com"/>',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>',
    '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet"/>',
    `<script>${MATHJAX_CONFIG_SCRIPT}</script>`,
    `<script defer src="${MATHJAX_CDN_SCRIPT_URL}"></script>`,
    wrapHtmlTag("title", safeTitle),
    wrapHtmlTag("style", PDF_DOCUMENT_STYLES),
    "</head>",
    "<body>",
    "<main>",
    safeParagraphsHtml,
    "</main>",
    '<div class="watermark">Generated by ExamArchive AI</div>',
    "</body>",
    "</html>",
  ].join("");
}

let markedParserPromise = null;

function assertMarkedParser(parserCandidate) {
  if (!parserCandidate || typeof parserCandidate.parse !== "function") {
    throw new Error("Invalid marked parser: expected an object with a parse() function.");
  }
  return parserCandidate;
}

async function loadMarkedParser() {
  if (!markedParserPromise) {
    markedParserPromise = import("marked").then((module) => assertMarkedParser(module.marked));
  }
  return markedParserPromise;
}

async function markdownToSimpleHtml(markdown, title, markedParser) {
  const markdownWithMathMl = renderLatexMathMl(markdown);
  const htmlFromMarkdown = markedParser.parse(markdownWithMathMl, { gfm: true, breaks: true });
  const safeParagraphsHtml = sanitizeGeneratedHtml(String(htmlFromMarkdown || ""));

  return renderHtmlDocument({
    safeTitle: sanitizeHtmlText(title),
    safeParagraphsHtml,
  });
}

function optimizeHtmlForGotenberg(html) {
  const originalHtml = String(html || "");
  const originalBytes = Buffer.byteLength(originalHtml, "utf8");
  if (originalBytes <= GOTENBERG_MAX_HTML_BYTES) {
    return { html: originalHtml, originalBytes, optimizedBytes: originalBytes, strippedInlineImages: 0 };
  }

  let strippedInlineImages = 0;
  const optimizedHtml = originalHtml.replace(
    /<img\b[^>]*\bsrc=(["'])data:image\/[^"']+\1[^>]*>/gi,
    () => {
      strippedInlineImages += 1;
      return "";
    },
  );
  const optimizedBytes = Buffer.byteLength(optimizedHtml, "utf8");
  return { html: optimizedHtml, originalBytes, optimizedBytes, strippedInlineImages };
}

function normalizeGotenbergWaitDelay(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "5s";
  return /^\d+(?:ms|s|m|h)$/i.test(trimmed) ? trimmed : "5s";
}

function normalizeBearerToken(rawToken) {
  const token = String(rawToken || "").trim();
  if (!token) return "";
  return /^Bearer\s+/i.test(token) ? token : `Bearer ${token}`;
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
  const content = payload?.candidates?.[0]?.content?.parts?.[0]?.text?.trim?.();
  if (!content) {
    throw new Error("Gemini returned empty content.");
  }
  return content;
}

function isRetryableGeminiStatus(status) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function runGeminiCompletionWithRetry({ apiKey, prompt, model }) {
  let lastError = null;
  for (let attempt = 1; attempt <= DEFAULT_GEMINI_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await runGeminiCompletion({ apiKey, prompt, model });
    } catch (error) {
      lastError = error;
      const status = Number(error?.status || 0);
      const canRetry = isRetryableGeminiStatus(status) || !status;
      if (!canRetry || attempt >= DEFAULT_GEMINI_MAX_ATTEMPTS) {
        throw error;
      }
      await sleep(DEFAULT_GEMINI_BASE_BACKOFF_MS * (2 ** (attempt - 1)));
    }
  }
  throw lastError || new Error("Gemini generation failed.");
}

function getNotesSystemPrompt() {
  return String(process.env.UNIT_NOTES_SYSTEM_PROMPT || "").trim() || [
    "Create high-quality markdown notes for this university syllabus chunk.",
    "Use markdown headings and subheadings.",
    "Include concise explanations with examples where relevant.",
    "Keep content exam-focused and syllabus-aligned.",
    "Do not include a standalone document title.",
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

function validateGotenbergUrl(raw, endpointPath = GOTENBERG_ENDPOINT_PATH) {
  const normalizedRaw = String(raw || "").trim().replace(/\/+$/, "");
  let baseUrl;
  try {
    baseUrl = new URL(normalizedRaw);
  } catch {
    throw new Error("Invalid GOTENBERG_URL in function environment.");
  }
  if (baseUrl.protocol !== "https:") {
    throw new Error("GOTENBERG_URL must use HTTPS.");
  }
  if (!baseUrl.hostname.toLowerCase().endsWith(TRUSTED_GOTENBERG_HOST_SUFFIX)) {
    throw new Error(`GOTENBERG_URL must target a trusted ${TRUSTED_GOTENBERG_HOST_SUFFIX} host.`);
  }
  const endpointUrl = new URL(endpointPath, `${baseUrl.origin}/`);
  return endpointUrl.toString();
}

function shouldRetryGotenberg(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function logFullGotenberg5xx(context, bodyText) {
  const normalizedBody = String(bodyText || "");
  const totalLength = normalizedBody.length;
  const hasContent = totalLength > 0;
  const truncatedBody = hasContent && totalLength > GOTENBERG_ERROR_LOG_MAX_CHARS
    ? `${normalizedBody.slice(0, GOTENBERG_ERROR_LOG_MAX_CHARS)}... [truncated]`
    : (hasContent ? normalizedBody : "<empty>");
  console.error(`[pdf-generator] ${context} 5xx response body:`, {
    body: truncatedBody,
    totalLength,
    truncated: hasContent && totalLength > GOTENBERG_ERROR_LOG_MAX_CHARS,
  });
}

async function renderWithGotenberg(markdown, fileName, markedParser) {
  const gotenbergUrl = String(process.env.GOTENBERG_URL || "").trim();
  const gotenbergAuthToken = String(process.env.GOTENBERG_AUTH_TOKEN || "").trim();
  const waitDelay = normalizeGotenbergWaitDelay(process.env.GOTENBERG_WAIT_DELAY);
  if (!gotenbergUrl) throw new Error("Missing GOTENBERG_URL in function environment.");
  if (!gotenbergAuthToken) throw new Error("Missing GOTENBERG_AUTH_TOKEN in function environment.");
  const endpointUrl = new URL(validateGotenbergUrl(gotenbergUrl, GOTENBERG_ENDPOINT_PATH));
  const mergeEndpointUrl = new URL(validateGotenbergUrl(gotenbergUrl, GOTENBERG_MERGE_ENDPOINT_PATH));

  const html = await markdownToSimpleHtml(markdown, fileName, markedParser);
  const optimizedHtml = optimizeHtmlForGotenberg(html);
  if (optimizedHtml.strippedInlineImages > 0) {
    console.warn("[pdf-generator] Removed inline base64 images from oversized HTML payload.", {
      strippedInlineImages: optimizedHtml.strippedInlineImages,
      originalBytes: optimizedHtml.originalBytes,
      optimizedBytes: optimizedHtml.optimizedBytes,
      maxAllowedBytes: GOTENBERG_MAX_HTML_BYTES,
    });
  }
  const headers = { Authorization: normalizeBearerToken(gotenbergAuthToken) };

  async function renderHtmlWithRetry(htmlString, name = "index.html") {
    let lastError = null;
    for (let attempt = 1; attempt <= GOTENBERG_MAX_ATTEMPTS; attempt += 1) {
      const form = new FormData();
      form.append("files", new Blob([htmlString], { type: "text/html" }), name);
      form.append("printBackground", "true");
      // Gotenberg expects duration literals (for example: 500ms, 2s, 1m) as multipart form fields.
      form.append("waitDelay", waitDelay);
      try {
        const response = await fetch(endpointUrl.toString(), {
          method: "POST",
          headers,
          body: form,
          signal: AbortSignal.timeout(GOTENBERG_REQUEST_TIMEOUT_MS),
        });
        if (!response.ok) {
          const bodyText = await response.text().catch(() => "");
          if (response.status >= 500) {
            logFullGotenberg5xx("Gotenberg", bodyText);
          }
          const msg = `Gotenberg request failed (${response.status}): ${bodyText.slice(0, GOTENBERG_ERROR_LOG_MAX_CHARS)}`;
          if (attempt < GOTENBERG_MAX_ATTEMPTS && shouldRetryGotenberg(response.status)) {
            console.error(`[pdf-generator] ${msg}`);
            await sleep(GOTENBERG_BASE_BACKOFF_MS * (2 ** (attempt - 1)));
            continue;
          }
          const httpError = new Error(msg);
          httpError.name = "GotenbergHttpError";
          throw httpError;
        }
        const pdfArrayBuffer = await response.arrayBuffer();
        return Buffer.from(pdfArrayBuffer);
      } catch (error) {
        lastError = error;
        const isTimeout = error && typeof error === "object" && error.name === "TimeoutError";
        const isHttpError = error && typeof error === "object" && error.name === "GotenbergHttpError";
        if (attempt >= GOTENBERG_MAX_ATTEMPTS) {
          break;
        }
        if (isHttpError) {
          console.error(
            `[pdf-generator] Gotenberg non-retryable HTTP error at attempt ${attempt}/${GOTENBERG_MAX_ATTEMPTS}: ${formatWorkerErrorMessage(error)}`,
          );
          throw error;
        }
        if (isTimeout) {
          console.error(`[pdf-generator] Gotenberg timeout at attempt ${attempt}/${GOTENBERG_MAX_ATTEMPTS}`);
        } else {
          console.error(
            `[pdf-generator] Gotenberg request error at attempt ${attempt}/${GOTENBERG_MAX_ATTEMPTS}: ${formatWorkerErrorMessage(error)}`,
          );
        }
        await sleep(GOTENBERG_BASE_BACKOFF_MS * (2 ** (attempt - 1)));
      }
    }
    throw lastError || new Error("Gotenberg request failed.");
  }

  async function mergePdfParts(pdfParts) {
    const form = new FormData();
    pdfParts.forEach((pdfPart, index) => {
      form.append("files", new Blob([pdfPart], { type: "application/pdf" }), `part-${index + 1}.pdf`);
    });
    const response = await fetch(mergeEndpointUrl.toString(), {
      method: "POST",
      headers,
      body: form,
      signal: AbortSignal.timeout(GOTENBERG_REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      if (response.status >= 500) {
        logFullGotenberg5xx("Gotenberg merge", bodyText);
      }
      throw new Error(`Gotenberg merge failed (${response.status}): ${bodyText.slice(0, GOTENBERG_ERROR_LOG_MAX_CHARS)}`);
    }
    const mergedArrayBuffer = await response.arrayBuffer();
    return Buffer.from(mergedArrayBuffer);
  }

  function splitMarkdownBySize(markdownContent, maxBytes) {
    const content = String(markdownContent || "");
    const contentBytes = Buffer.byteLength(content, "utf8");
    if (contentBytes <= maxBytes) return [content];
    const targetMidpoint = Math.floor(content.length / 2);
    const headingMatches = [];
    const headingRegex = /^#+\s.+$/gm;
    let match;
    while ((match = headingRegex.exec(content)) !== null) {
      headingMatches.push({ index: match.index, text: match[0] });
    }
    const delimiterMatches = [];
    const delimiterRegex = /\n{2,}---\n{2,}/g;
    while ((match = delimiterRegex.exec(content)) !== null) {
      delimiterMatches.push({ index: match.index, length: match[0].length });
    }
    const paragraphMatches = [];
    const paragraphRegex = /\n{2,}/g;
    while ((match = paragraphRegex.exec(content)) !== null) {
      paragraphMatches.push({ index: match.index, length: match[0].length });
    }
    const allBoundaries = [
      ...headingMatches.map((m) => ({ index: m.index, priority: 1 })),
      ...delimiterMatches.map((m) => ({ index: m.index, priority: 2 })),
      ...paragraphMatches.map((m) => ({ index: m.index, priority: 3 })),
    ].sort((a, b) => {
      const distA = Math.abs(a.index - targetMidpoint);
      const distB = Math.abs(b.index - targetMidpoint);
      if (distA !== distB) return distA - distB;
      return a.priority - b.priority;
    });
    let splitIndex = allBoundaries.length > 0 ? allBoundaries[0].index : Math.floor(content.length / 2);
    if (splitIndex === 0) splitIndex = Math.floor(content.length / 2);
    const partA = content.slice(0, splitIndex).trim();
    const partB = content.slice(splitIndex).trim();
    return [partA, partB].filter(Boolean);
  }

  if (optimizedHtml.optimizedBytes > GOTENBERG_MAX_HTML_BYTES) {
    const normalizedMarkdown = String(markdown || "");
    const splitOnDelimiters = normalizedMarkdown
      .split(MARKDOWN_SECTION_DELIMITER_REGEX)
      .map((segment) => segment.trim())
      .filter(Boolean);
    if (splitOnDelimiters.length >= 2) {
      const sectionBytes = splitOnDelimiters.map((segment) => Buffer.byteLength(segment, "utf8"));
      const totalSectionBytes = sectionBytes.reduce((sum, bytes) => sum + bytes, 0);
      const targetPartBytes = Math.ceil(totalSectionBytes / 2);
      const partASections = [];
      const partBSections = [];
      let partABytes = 0;
      splitOnDelimiters.forEach((segment, index) => {
        const segmentBytes = sectionBytes[index];
        const remainingSections = splitOnDelimiters.length - index;
        // Keep at least one section in Part B while balancing bytes into Part A.
        const canAddToPartA = partASections.length === 0 || (partABytes < targetPartBytes && remainingSections > 1);
        if (canAddToPartA) {
          partASections.push(segment);
          partABytes += segmentBytes;
          return;
        }
        partBSections.push(segment);
      });
      const markdownPartA = partASections.join(MARKDOWN_SECTION_DELIMITER);
      const markdownPartB = partBSections.join(MARKDOWN_SECTION_DELIMITER);
      if (!markdownPartA || !markdownPartB) {
        console.error("[pdf-generator] Delimiter-based split produced empty part. Falling back to byte-based split.", {
          originalBytes: optimizedHtml.originalBytes,
          optimizedBytes: optimizedHtml.optimizedBytes,
          maxAllowedBytes: GOTENBERG_MAX_HTML_BYTES,
        });
        const byteSplitParts = splitMarkdownBySize(normalizedMarkdown, GOTENBERG_MAX_HTML_BYTES);
        if (byteSplitParts.length < 2) {
          const oversizeError = new Error("Cannot split oversized HTML: content exceeds maximum size and no valid split points found.");
          console.error("[pdf-generator] Byte-based split failed to produce two parts.", {
            optimizedBytes: optimizedHtml.optimizedBytes,
            maxAllowedBytes: GOTENBERG_MAX_HTML_BYTES,
          });
          throw oversizeError;
        }
        console.warn("[pdf-generator] Oversized payload detected. Rendering in two parts using byte-based split and merging PDFs.", {
          originalBytes: optimizedHtml.originalBytes,
          optimizedBytes: optimizedHtml.optimizedBytes,
          maxAllowedBytes: GOTENBERG_MAX_HTML_BYTES,
        });
        const htmlPartA = await markdownToSimpleHtml(byteSplitParts[0], `${fileName} (Part 1)`, markedParser);
        const htmlPartB = await markdownToSimpleHtml(byteSplitParts[1], `${fileName} (Part 2)`, markedParser);
        const optimizedPartAResult = optimizeHtmlForGotenberg(htmlPartA);
        const optimizedPartBResult = optimizeHtmlForGotenberg(htmlPartB);
        if (
          optimizedPartAResult.optimizedBytes > GOTENBERG_MAX_HTML_BYTES
          || optimizedPartBResult.optimizedBytes > GOTENBERG_MAX_HTML_BYTES
        ) {
          const oversizeError = new Error("Split rendering parts still exceed max HTML bytes after byte-based optimization.");
          console.error("[pdf-generator] Byte-based split parts remain oversized after optimization.", {
            partABytes: optimizedPartAResult.optimizedBytes,
            partBBytes: optimizedPartBResult.optimizedBytes,
            maxAllowedBytes: GOTENBERG_MAX_HTML_BYTES,
          });
          throw oversizeError;
        }
        const optimizedPartA = optimizedPartAResult.html;
        const optimizedPartB = optimizedPartBResult.html;
        const partPdfA = await renderHtmlWithRetry(optimizedPartA, "index.html");
        const partPdfB = await renderHtmlWithRetry(optimizedPartB, "index.html");
        return mergePdfParts([partPdfA, partPdfB]);
      }
      console.warn("[pdf-generator] Oversized payload detected. Rendering in two parts and merging PDFs.", {
        originalBytes: optimizedHtml.originalBytes,
        optimizedBytes: optimizedHtml.optimizedBytes,
        maxAllowedBytes: GOTENBERG_MAX_HTML_BYTES,
      });
      const htmlPartA = await markdownToSimpleHtml(markdownPartA, `${fileName} (Part 1)`, markedParser);
      const htmlPartB = await markdownToSimpleHtml(markdownPartB, `${fileName} (Part 2)`, markedParser);
      const optimizedPartAResult = optimizeHtmlForGotenberg(htmlPartA);
      const optimizedPartBResult = optimizeHtmlForGotenberg(htmlPartB);
      if (
        optimizedPartAResult.optimizedBytes > GOTENBERG_MAX_HTML_BYTES
        || optimizedPartBResult.optimizedBytes > GOTENBERG_MAX_HTML_BYTES
      ) {
        const oversizeError = new Error("Split rendering parts still exceed max HTML bytes after optimization.");
        console.error("[pdf-generator] Split parts remain oversized after optimization.", {
          partABytes: optimizedPartAResult.optimizedBytes,
          partBBytes: optimizedPartBResult.optimizedBytes,
          maxAllowedBytes: GOTENBERG_MAX_HTML_BYTES,
        });
        throw oversizeError;
      }
      const optimizedPartA = optimizedPartAResult.html;
      const optimizedPartB = optimizedPartBResult.html;
      const partPdfA = await renderHtmlWithRetry(optimizedPartA, "index.html");
      const partPdfB = await renderHtmlWithRetry(optimizedPartB, "index.html");
      return mergePdfParts([partPdfA, partPdfB]);
    }
    console.error("[pdf-generator] Oversized HTML with insufficient delimiters for safe split.", {
      optimizedBytes: optimizedHtml.optimizedBytes,
      maxAllowedBytes: GOTENBERG_MAX_HTML_BYTES,
      delimiterCount: splitOnDelimiters.length,
    });
    const byteSplitParts = splitMarkdownBySize(normalizedMarkdown, GOTENBERG_MAX_HTML_BYTES);
    if (byteSplitParts.length < 2) {
      const oversizeError = new Error("Cannot split oversized HTML: content exceeds maximum size and no valid split points found.");
      console.error("[pdf-generator] Byte-based split failed to produce two parts for oversized content.", {
        optimizedBytes: optimizedHtml.optimizedBytes,
        maxAllowedBytes: GOTENBERG_MAX_HTML_BYTES,
      });
      throw oversizeError;
    }
    console.warn("[pdf-generator] Oversized payload detected. Rendering in two parts using byte-based split and merging PDFs.", {
      originalBytes: optimizedHtml.originalBytes,
      optimizedBytes: optimizedHtml.optimizedBytes,
      maxAllowedBytes: GOTENBERG_MAX_HTML_BYTES,
    });
    const htmlPartA = await markdownToSimpleHtml(byteSplitParts[0], `${fileName} (Part 1)`, markedParser);
    const htmlPartB = await markdownToSimpleHtml(byteSplitParts[1], `${fileName} (Part 2)`, markedParser);
    const optimizedPartAResult = optimizeHtmlForGotenberg(htmlPartA);
    const optimizedPartBResult = optimizeHtmlForGotenberg(htmlPartB);
    if (
      optimizedPartAResult.optimizedBytes > GOTENBERG_MAX_HTML_BYTES
      || optimizedPartBResult.optimizedBytes > GOTENBERG_MAX_HTML_BYTES
    ) {
      const oversizeError = new Error("Split rendering parts still exceed max HTML bytes after byte-based optimization.");
      console.error("[pdf-generator] Byte-based split parts remain oversized after optimization.", {
        partABytes: optimizedPartAResult.optimizedBytes,
        partBBytes: optimizedPartBResult.optimizedBytes,
        maxAllowedBytes: GOTENBERG_MAX_HTML_BYTES,
      });
      throw oversizeError;
    }
    const optimizedPartA = optimizedPartAResult.html;
    const optimizedPartB = optimizedPartBResult.html;
    const partPdfA = await renderHtmlWithRetry(optimizedPartA, "index.html");
    const partPdfB = await renderHtmlWithRetry(optimizedPartB, "index.html");
    return mergePdfParts([partPdfA, partPdfB]);
  }
  return renderHtmlWithRetry(optimizedHtml.html, "index.html");
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

function resolveNotifyCompletionUrl(callbackUrl) {
  const siteUrl = normalizeAbsoluteHttpUrl(String(process.env.SITE_URL || "").trim()).replace(/\/+$/, "");
  if (!siteUrl) {
    console.error("[pdf-generator] CRITICAL: SITE_URL is missing or invalid; completion webhook cannot be delivered safely.", {
      hasCallbackUrl: Boolean(String(callbackUrl || "").trim()),
    });
    return { url: "", reason: callbackUrl ? "no_valid_callback_and_missing_site_url" : "missing_site_url" };
  }
  try {
    const baseUrl = new URL(siteUrl);
    const callbackOverride = normalizeAbsoluteHttpUrl(callbackUrl);
    if (callbackOverride) {
      const callbackUrlObject = new URL(callbackOverride);
      if (callbackUrlObject.origin === baseUrl.origin) {
        return { url: callbackUrlObject.toString(), reason: "callback_override" };
      }
      console.error("[pdf-generator] Rejected callback override with mismatched origin.", {
        callbackOrigin: callbackUrlObject.origin,
        siteOrigin: baseUrl.origin,
      });
      return { url: "", reason: "callback_origin_mismatch" };
    }
    return { url: new URL(NOTIFY_COMPLETION_PATH, `${baseUrl.toString()}/`).toString(), reason: "site_url" };
  } catch {
    return { url: "", reason: "invalid_site_url" };
  }
}

function getNotifyCompletionUrl(callbackUrl) {
  return resolveNotifyCompletionUrl(callbackUrl).url;
}

async function notifyCompletionWebhook({ jobId, status, fileId, userId, userEmail, callbackUrl }) {
  if (!String(process.env.SITE_URL || "").trim()) {
    console.error("[pdf-generator] CRITICAL: SITE_URL env is missing; notify-completion webhook delivery may be skipped.");
  }
  const notifyResolution = resolveNotifyCompletionUrl(callbackUrl);
  const notifyUrl = notifyResolution.url;
  if (!notifyUrl) {
    console.error("[pdf-generator] Completion webhook callback skipped due to URL resolution failure.", {
      reason: notifyResolution.reason,
      hasCallbackUrl: Boolean(String(callbackUrl || "").trim()),
      hasSiteUrl: Boolean(String(process.env.SITE_URL || "").trim()),
    });
    return;
  }
  const headers = { "Content-Type": "application/json" };
  const webhookSecret = String(process.env.AI_JOB_WEBHOOK_SECRET || "").trim();
  if (webhookSecret) {
    headers.Authorization = `Bearer ${webhookSecret}`;
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
      console.error(`[pdf-generator] Completion webhook request error at attempt ${attempt}/${maxAttempts}.`, {
        url: notifyUrl,
        message: error instanceof Error ? error.message : String(error),
        error,
      });
      const jitter = Math.random() * 0.3 + 0.85;
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
        console.error(`[pdf-generator] Completion webhook request failed at attempt ${attempt}/${maxAttempts} (will retry).`, {
          status: response.status,
          body: responseBody.slice(0, NOTIFY_WEBHOOK_ERROR_LOG_MAX_CHARS),
        });
        const jitter = Math.random() * 0.3 + 0.85;
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
    const responseText = await runGeminiCompletionWithRetry({
      apiKey: geminiApiKey,
      prompt,
      model: payload.model || DEFAULT_MODEL,
    });
    generated.push(responseText);
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
    const responseText = await runGeminiCompletionWithRetry({
      apiKey: geminiApiKey,
      prompt,
      model: payload.model || DEFAULT_MODEL,
    });
    solved.push(responseText);
  }
  return solved.join("\n\n---\n\n");
}

async function processGenerationJob(rawInput, options = {}) {
  const markedParser = Object.hasOwn(options, "markedParser")
    ? assertMarkedParser(options.markedParser)
    : await loadMarkedParser();
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
    if (normalizedJobType === "notes") {
      markdown = await generateNotesPayload(db, payload);
    } else if (normalizedJobType === "solved-paper") {
      markdown = await generateSolvedPaperPayload(db, payload);
    } else {
      throw new Error(`Unsupported jobType "${payload.jobType}".`);
    }
    await updateJob(db, jobId, { progress_percent: 80 });

    const fileName = buildJobTitle(payload);
    const pdfBuffer = await renderWithGotenberg(markdown, fileName, markedParser);
    const created = await storage.createFile(
      PAPERS_BUCKET_ID,
      ID.unique(),
      InputFile.fromBuffer(pdfBuffer, fileName),
    );

    await updateJob(db, jobId, {
      status: "completed",
      progress_percent: 100,
      result_file_id: String(created.$id),
      completed_at: new Date().toISOString(),
    });
    await notifyCompletionWebhook({
      jobId,
      status: "completed",
      fileId: String(created.$id),
      userId: String(payload.userId || "").trim(),
      userEmail: String(payload.userEmail || "").trim(),
      callbackUrl: String(payload.callbackUrl || "").trim(),
    });

    return { ok: true, jobId, fileId: String(created.$id) };
  } catch (error) {
    await updateJob(db, jobId, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: formatWorkerErrorMessage(error),
    }).catch(() => {});
    await notifyCompletionWebhook({
      jobId,
      status: "failed",
      fileId: "",
      userId: String(payload.userId || "").trim(),
      userEmail: String(payload.userEmail || "").trim(),
      callbackUrl: String(payload.callbackUrl || "").trim(),
    });
    throw error;
  }
}

module.exports = async ({ req, res, log, error }) => {
  try {
    const { marked } = await import("marked");
    const rawInput = req?.body || process.env.APPWRITE_FUNCTION_EVENT_DATA || process.env.APPWRITE_FUNCTION_DATA || "{}";
    const result = await processGenerationJob(rawInput, { markedParser: marked });
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
