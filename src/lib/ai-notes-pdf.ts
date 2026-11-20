/**
 * AI Notes — Cloudflare-native PDF rendering (2026-11-20).
 *
 * Adapted from src/lib/ai-pdf-pipeline.ts (Appwrite edition): the HTML
 * builder is the same, but nothing here imports node-appwrite or
 * @/lib/appwrite, so it bundles for Workers.
 *
 * BLOCKER (2026-11-20): the Gotenberg Space URL is NOT set on the Worker.
 * It lives only as the GitHub secret GOTENBERG_URL — no value was found in
 * the repo, docs, workspace files, memory, or Vercel env, and HF author
 * lookup for "omdas11" lists no public spaces. Until the user sets
 * GOTENBERG_URL (+ GOTENBERG_AUTH_TOKEN) as Worker secrets,
 * renderAiNotesPdf throws AiNotesPdfError with code PDF_NOT_CONFIGURED,
 * and the generate route answers 503 without charging or consuming the
 * daily free PDF. Do NOT guess a URL.
 */
import katex from "katex";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { formatIstDateTime } from "./datetime";

const DEFAULT_PDF_MODEL_NAME = "Gemini 3.5 Flash Lite";
const DEFAULT_GOTENBERG_REQUEST_TIMEOUT_MS = 45_000;
const DEFAULT_GOTENBERG_MAX_ATTEMPTS = 3;
const DEFAULT_GOTENBERG_RETRY_DELAY_MS = 1_500;
const GOTENBERG_CONVERT_ENDPOINT_PATH = "/forms/chromium/convert/html";
const TRUSTED_GOTENBERG_HOST_SUFFIX = ".hf.space";

export class AiNotesPdfError extends Error {
  constructor(
    public readonly code: "PDF_NOT_CONFIGURED" | "PDF_RENDER_FAILED",
    message: string,
  ) {
    super(message);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"'`]/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "\"":
        return "&quot;";
      case "'":
        return "&#039;";
      case "`":
        return "&#96;";
      default:
        return ch;
    }
  });
}

function sanitizeGeneratedHtml(input: string): string {
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
      span: ["class", "style"],
      math: ["xmlns", "display"],
      annotation: ["encoding"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowProtocolRelative: false,
  });
}

function renderLatexToMathMl(markdown: string): string {
  const renderExpression = (expression: string, displayMode: boolean) =>
    katex.renderToString(expression.trim(), {
      throwOnError: false,
      displayMode,
      output: "mathml",
    });

  const isEscaped = (source: string, index: number): boolean => {
    let backslashCount = 0;
    for (let i = index - 1; i >= 0 && source[i] === "\\"; i -= 1) {
      backslashCount += 1;
    }
    return backslashCount % 2 === 1;
  };

  const renderDollarDelimitedMath = (source: string): string => {
    let output = "";
    let cursor = 0;
    let i = 0;
    let mode: "inline" | "display" | null = null;
    let openingIndex = -1;
    let contentStart = -1;
    let delimiterSize = 1;

    while (i < source.length) {
      if (mode === "inline" && source[i] === "\n") {
        output += source.slice(openingIndex, i + 1);
        mode = null;
        i += 1;
        cursor = i;
        continue;
      }
      if (source[i] !== "$" || isEscaped(source, i)) {
        i += 1;
        continue;
      }
      const isDisplayDelimiter =
        i + 1 < source.length && source[i + 1] === "$" && !isEscaped(source, i + 1);
      const currentDelimiterSize = isDisplayDelimiter ? 2 : 1;
      const currentMode: "inline" | "display" = isDisplayDelimiter ? "display" : "inline";

      if (mode === null) {
        output += source.slice(cursor, i);
        mode = currentMode;
        delimiterSize = currentDelimiterSize;
        openingIndex = i;
        contentStart = i + currentDelimiterSize;
        i += currentDelimiterSize;
        cursor = i;
        continue;
      }

      if (mode !== currentMode || currentDelimiterSize !== delimiterSize) {
        i += 1;
        continue;
      }

      const expression = source.slice(contentStart, i);
      output += renderExpression(expression, mode === "display");
      i += delimiterSize;
      cursor = i;
      mode = null;
      openingIndex = -1;
      contentStart = -1;
      delimiterSize = 1;
    }

    if (mode !== null && openingIndex >= 0) {
      output += source.slice(openingIndex);
      return output;
    }

    output += source.slice(cursor);
    return output;
  };

  return renderDollarDelimitedMath(markdown);
}

export function buildAiNotesPdfHtml(args: {
  markdown: string;
  modelName?: string;
  generatedAtIso?: string;
  paperCode?: string;
  paperName?: string;
  topic?: string;
}): string {
  const { markdown, modelName, generatedAtIso, paperCode, paperName, topic } =
    args;
  const markdownWithRenderedMath = renderLatexToMathMl(markdown);
  const parsedHtml = marked.parse(markdownWithRenderedMath);
  const htmlContent = sanitizeGeneratedHtml(
    typeof parsedHtml === "string" ? parsedHtml : "",
  );
  const watermarkSvg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><text x="50%" y="50%" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700" fill="#800000" fill-opacity="0.08" transform="rotate(-45 150 150)" text-anchor="middle">EXAMARCHIVE</text></svg>`,
  );
  const safeModelName =
    (modelName || DEFAULT_PDF_MODEL_NAME).trim() || DEFAULT_PDF_MODEL_NAME;
  const generatedAtLabel = formatHeaderTimestamp(
    generatedAtIso || new Date().toISOString(),
  );
  const coverDetails = [
    paperCode
      ? `<p><strong>Paper Code:</strong> ${escapeHtml(paperCode)}</p>`
      : "",
    paperName
      ? `<p><strong>Paper Name:</strong> ${escapeHtml(paperName)}</p>`
      : "",
    topic ? `<p><strong>Topic:</strong> ${escapeHtml(topic)}</p>` : "",
    `<p><strong>Model:</strong> ${escapeHtml(safeModelName)}</p>`,
    generatedAtLabel
      ? `<p><strong>Generated at:</strong> ${escapeHtml(generatedAtLabel)}</p>`
      : "",
  ]
    .filter(Boolean)
    .join("");
  const coverSection = coverDetails
    ? `<section class="cover-page">
         <h1>AI Notes</h1>
         <div class="cover-meta">${coverDetails}</div>
       </section>`
    : "";
  const thankYouHtml = `<p class="thank-you-inline">Thank you for learning with ExamArchive. Your PDF was generated successfully. <a href="https://www.examarchive.dev" target="_blank" rel="noopener noreferrer">Visit ExamArchive homepage</a>.</p>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
  <script>
    MathJax = {
      tex: {
        inlineMath: [["$", "$"], ["\\\\(", "\\\\)"]],
        displayMath: [["$$", "$$"], ["\\\\[", "\\\\]"]],
      },
      svg: { fontCache: "global" },
    };
  </script>
  <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>
  <style>
    body {
      font-family: "Inter", Arial, sans-serif;
      line-height: 1.65;
      color: #2b1a1a;
      padding: 0;
      margin: 0;
      background-image: url("data:image/svg+xml,${watermarkSvg}");
      background-size: 230px 230px;
      background-repeat: repeat;
    }
    main { padding: 0 4mm; }
    @page { size: A4; margin: 12mm 10mm; }
    h1, h2, h3 { color: #800000; }
    h1, h2, h3 { page-break-after: avoid; }
    h1 { border-bottom: 2px solid #e7d8d8; padding-bottom: 8px; }
    h2 { border-left: 4px solid #800000; padding-left: 8px; }
    p, li { font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
    th, td { border: 1px solid #e7d8d8; padding: 8px; text-align: left; }
    th { background-color: #fbf4f4; color: #6e1111; }
    .cover-page {
      page-break-after: always;
      min-height: 92vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 0 12mm;
    }
    .cover-page h1 {
      margin: 0 0 16px;
      border-bottom: none;
      font-size: 34px;
      letter-spacing: 0.04em;
    }
    .cover-page .cover-meta {
      margin-bottom: 12px;
    }
    .cover-page .cover-meta p {
      margin: 3px 0;
      font-size: 15px;
    }
    .thank-you-inline {
      margin-top: 18px;
      padding-top: 10px;
      border-top: 1px solid #e7d8d8;
      font-size: 13px;
      color: #6e1111;
    }
    .thank-you-inline a {
      color: #800000;
      font-weight: 700;
      text-decoration: underline;
    }
  </style>
</head>
<body><main>${coverSection}${htmlContent}${thankYouHtml}</main></body>
</html>`;
}

function formatHeaderTimestamp(value: string | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${formatIstDateTime(date)} IST`;
}

function buildHeaderHtml(): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" />
<style>
  body {
    font-family: "Inter", Arial, sans-serif;
    font-size: 10px;
    color: #7a3a3a;
    margin: 0;
    padding: 0 10mm 5px;
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid #e5e7eb;
    box-sizing: border-box;
  }
  .brand {
    font-weight: 700;
    letter-spacing: 0.06em;
  }
</style></head><body>
  <span class="brand">EXAMARCHIVE</span>
  <span></span>
</body></html>`;
}

function buildFooterHtml(userEmail?: string): string {
  const safeEmail = typeof userEmail === "string" ? userEmail.trim() : "";
  const footerWatermark = safeEmail ? `Personalized copy for ${escapeHtml(safeEmail)}` : "";
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" />
<style>
  body {
    font-family: "Inter", Arial, sans-serif;
    font-size: 11px;
    color: #800000;
    margin: 0;
    padding: 5px 10mm 0;
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    box-sizing: border-box;
  }
  .footer-watermark {
    font-size: 9px;
    opacity: 0.75;
    letter-spacing: 0.02em;
  }
</style></head><body>
  <span class="footer-watermark">${footerWatermark}</span>
  <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
</body></html>`;
}

export function buildSafePdfFileName(args: {
  fileBaseName: string;
  fileName?: string;
}): string {
  const baseFallback = args.fileBaseName.trim() || "ai-notes";
  const candidate = (args.fileName || `${baseFallback}.pdf`).trim();
  const normalizedCandidate = candidate.replace(/[^a-zA-Z0-9._-]/g, "_");
  const withoutExtension = normalizedCandidate.replace(/\.pdf$/i, "");
  const safeCore = withoutExtension.length > 0 ? withoutExtension : "ai-notes";
  return `${safeCore}.pdf`;
}

function normalizeGotenbergAuthToken(rawToken: string): string {
  const trimmed = rawToken.trim();
  const isWrappedInDoubleQuotes =
    trimmed.length >= 2 && trimmed.startsWith("\"") && trimmed.endsWith("\"");
  const isWrappedInSingleQuotes =
    trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'");
  const unquoted =
    isWrappedInDoubleQuotes || isWrappedInSingleQuotes
      ? trimmed.slice(1, -1).trim()
      : trimmed;
  return unquoted.replace(/^Bearer\s+/i, "").trim();
}

/**
 * Render notes markdown to a PDF buffer via the HF Gotenberg Space.
 * Throws AiNotesPdfError PDF_NOT_CONFIGURED when GOTENBERG_URL or
 * GOTENBERG_AUTH_TOKEN is missing — the caller must surface that as a
 * 503 and must NOT charge credits or consume the daily free PDF.
 */
export async function renderAiNotesPdf(args: {
  markdown: string;
  gotenbergUrl?: string;
  gotenbergAuthToken?: string;
  modelName?: string;
  generatedAtIso?: string;
  paperCode?: string;
  paperName?: string;
  topic?: string;
  userEmail?: string;
}): Promise<Buffer> {
  const configuredUrl = (args.gotenbergUrl ?? "").trim();
  const authToken = normalizeGotenbergAuthToken(args.gotenbergAuthToken ?? "");
  if (!configuredUrl || !authToken) {
    throw new AiNotesPdfError(
      "PDF_NOT_CONFIGURED",
      "PDF rendering is not configured: the Gotenberg service URL is missing on this deployment.",
    );
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(configuredUrl);
  } catch {
    throw new AiNotesPdfError("PDF_NOT_CONFIGURED", "Invalid GOTENBERG_URL.");
  }
  if (baseUrl.protocol !== "https:") {
    throw new AiNotesPdfError("PDF_NOT_CONFIGURED", "GOTENBERG_URL must use HTTPS.");
  }
  if (!baseUrl.hostname.toLowerCase().endsWith(TRUSTED_GOTENBERG_HOST_SUFFIX)) {
    throw new AiNotesPdfError(
      "PDF_NOT_CONFIGURED",
      "GOTENBERG_URL must use a trusted Hugging Face domain.",
    );
  }
  const endpointUrl = new URL(GOTENBERG_CONVERT_ENDPOINT_PATH, baseUrl.toString());
  if (endpointUrl.hostname.toLowerCase() !== baseUrl.hostname.toLowerCase()) {
    throw new AiNotesPdfError(
      "PDF_NOT_CONFIGURED",
      "Refusing non-whitelisted Gotenberg host.",
    );
  }

  const html = buildAiNotesPdfHtml({
    markdown: args.markdown,
    modelName: args.modelName,
    generatedAtIso: args.generatedAtIso,
    paperCode: args.paperCode,
    paperName: args.paperName,
    topic: args.topic,
  });
  const headerHtml = buildHeaderHtml();
  const footerHtml = buildFooterHtml(args.userEmail);
  const buildFormData = () => {
    const formData = new FormData();
    formData.append("files", new Blob([html], { type: "text/html" }), "index.html");
    formData.append("files", new Blob([headerHtml], { type: "text/html" }), "header.html");
    formData.append("files", new Blob([footerHtml], { type: "text/html" }), "footer.html");
    formData.append("marginTop", "1.2");
    formData.append("marginBottom", "1.2");
    formData.append("marginLeft", "1");
    formData.append("marginRight", "1");
    formData.append("displayHeaderFooter", "true");
    formData.append("printBackground", "true");
    formData.append("waitDelay", "5s");
    return formData;
  };

  let lastErrorMessage = "Unknown error";
  for (let attempt = 1; attempt <= DEFAULT_GOTENBERG_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(endpointUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: buildFormData(),
        signal: AbortSignal.timeout(DEFAULT_GOTENBERG_REQUEST_TIMEOUT_MS),
      });
      if (response.status >= 500 && attempt < DEFAULT_GOTENBERG_MAX_ATTEMPTS) {
        lastErrorMessage = `${response.status} ${(await response.text()).trim().slice(0, 500)}`;
        await sleep(DEFAULT_GOTENBERG_RETRY_DELAY_MS * attempt);
        continue;
      }
      if (response.status !== 200) {
        const errorText = (await response.text()).trim().slice(0, 2000);
        throw new AiNotesPdfError(
          "PDF_RENDER_FAILED",
          `Gotenberg Error (${response.status}): ${errorText || response.statusText || "Unknown error"}`,
        );
      }
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (error instanceof AiNotesPdfError) throw error;
      lastErrorMessage = error instanceof Error ? error.message : String(error);
      if (attempt < DEFAULT_GOTENBERG_MAX_ATTEMPTS) {
        await sleep(DEFAULT_GOTENBERG_RETRY_DELAY_MS * attempt);
        continue;
      }
    }
  }
  throw new AiNotesPdfError(
    "PDF_RENDER_FAILED",
    `Gotenberg request failed after ${DEFAULT_GOTENBERG_MAX_ATTEMPTS} attempts: ${lastErrorMessage}`,
  );
}
