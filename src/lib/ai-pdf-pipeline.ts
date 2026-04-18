import { InputFile } from "node-appwrite/file";
import katex from "katex";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import {
  adminStorage,
  BUCKET_ID,
  ID,
  getAppwriteFileDownloadUrl,
} from "@/lib/appwrite";
import { formatIstDateTime } from "@/lib/datetime";

const DEFAULT_PDF_MODEL_NAME = "Gemini 3.1 Flash Lite";
const DEFAULT_GOTENBERG_REQUEST_TIMEOUT_MS = 45_000;
const DEFAULT_GOTENBERG_MAX_ATTEMPTS = 3;
const DEFAULT_GOTENBERG_RETRY_DELAY_MS = 1_500;
const GOTENBERG_CONVERT_ENDPOINT_PATH = "/forms/chromium/convert/html";
const GOTENBERG_LEGACY_CONVERT_ENDPOINT_PATH = "/convert/html";
const GOTENBERG_REQUEST_TIMEOUT_MS = Number.isFinite(Number(process.env.GOTENBERG_REQUEST_TIMEOUT_MS))
  ? Math.max(1_000, Number(process.env.GOTENBERG_REQUEST_TIMEOUT_MS))
  : DEFAULT_GOTENBERG_REQUEST_TIMEOUT_MS;
const GOTENBERG_MAX_ATTEMPTS = Number.isInteger(Number(process.env.GOTENBERG_MAX_ATTEMPTS))
  ? Math.max(1, Number(process.env.GOTENBERG_MAX_ATTEMPTS))
  : DEFAULT_GOTENBERG_MAX_ATTEMPTS;
const GOTENBERG_RETRY_DELAY_MS = Number.isFinite(Number(process.env.GOTENBERG_RETRY_DELAY_MS))
  ? Math.max(250, Number(process.env.GOTENBERG_RETRY_DELAY_MS))
  : DEFAULT_GOTENBERG_RETRY_DELAY_MS;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postToGotenbergWithRetry(args: {
  baseUrl: string;
  endpointPath: string;
  headers?: HeadersInit;
  buildFormData: () => FormData;
}): Promise<Response> {
  const gotenbergBase = args.baseUrl.trim();
  if (!gotenbergBase) {
    throw new Error("Gotenberg base URL is required.");
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(gotenbergBase);
  } catch {
    throw new Error("Invalid GOTENBERG_URL.");
  }
  if (!/^https?:$/.test(baseUrl.protocol)) {
    throw new Error("GOTENBERG_URL must use HTTP or HTTPS.");
  }
  const normalizedBaseHost = baseUrl.hostname.toLowerCase();

  let endpointUrl: URL;
  try {
    endpointUrl = new URL(args.endpointPath, baseUrl.toString());
  } catch {
    throw new Error("Invalid Gotenberg endpoint path.");
  }
  if (!/^https?:$/.test(endpointUrl.protocol)) {
    throw new Error("Refusing Gotenberg endpoint with unsupported protocol.");
  }
  if (![GOTENBERG_CONVERT_ENDPOINT_PATH, GOTENBERG_LEGACY_CONVERT_ENDPOINT_PATH].includes(endpointUrl.pathname)) {
    throw new Error("Refusing unexpected Gotenberg endpoint path.");
  }
  if (endpointUrl.hostname.toLowerCase() !== normalizedBaseHost) {
    throw new Error("Refusing non-whitelisted Gotenberg host.");
  }
  if (!endpointUrl.toString().startsWith(`${baseUrl.origin}/`)) {
    throw new Error("Refusing Gotenberg endpoint outside trusted origin.");
  }

  let lastErrorMessage = "Unknown error";
  for (let attempt = 1; attempt <= GOTENBERG_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(endpointUrl, {
        method: "POST",
        headers: args.headers,
        body: args.buildFormData(),
        signal: AbortSignal.timeout(GOTENBERG_REQUEST_TIMEOUT_MS),
      });
      if (response.status >= 500 && attempt < GOTENBERG_MAX_ATTEMPTS) {
        const errorPreview = (await response.text()).trim().slice(0, 500);
        lastErrorMessage = `${response.status} ${errorPreview || response.statusText || "Unknown error"}`.trim();
        console.error("[ai-pdf-pipeline] Gotenberg Error Body:", errorPreview || response.statusText || "Unknown error");
        console.warn("[ai-pdf-pipeline] Gotenberg returned retryable 5xx response; retrying.", {
          status: response.status,
          endpoint: endpointUrl.toString(),
          attempt,
          maxAttempts: GOTENBERG_MAX_ATTEMPTS,
          error: errorPreview || response.statusText || "Unknown error",
        });
        await sleep(GOTENBERG_RETRY_DELAY_MS * attempt);
        continue;
      }
      return response;
    } catch (error) {
      lastErrorMessage = error instanceof Error ? error.message : String(error);
      if (attempt < GOTENBERG_MAX_ATTEMPTS) {
        console.warn("[ai-pdf-pipeline] Gotenberg request failed; retrying.", {
          endpoint: endpointUrl.toString(),
          attempt,
          maxAttempts: GOTENBERG_MAX_ATTEMPTS,
          error,
        });
        await sleep(GOTENBERG_RETRY_DELAY_MS * attempt);
        continue;
      }
    }
  }
  throw new Error(`Gotenberg request failed after ${GOTENBERG_MAX_ATTEMPTS} attempts at ${endpointUrl.toString()}: ${lastErrorMessage}`);
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
      // Inline `$...$` must stay on a single line. If newline appears before a closing
      // inline delimiter, treat it as plain text and restart scanning after the newline.
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

  let output = markdown;
  output = output.replace(/\\\[([\s\S]+?)\\\]/g, (_match, expression: string) =>
    renderExpression(expression, true));
  output = output.replace(/\\\(([\s\S]+?)\\\)/g, (_match, expression: string) =>
    renderExpression(expression, false));
  output = renderDollarDelimitedMath(output);
  return output;
}

export function buildPdfHtml(args: {
  markdown: string;
  modelName?: string;
  generatedAtIso?: string;
  reRenderedAtIso?: string;
  paperCode?: string;
  paperName?: string;
  unitNumber?: number;
  unitName?: string;
  year?: number;
  syllabusContent?: string;
}): string {
  const {
    markdown,
    modelName,
    generatedAtIso,
    reRenderedAtIso,
    paperCode,
    paperName,
    unitNumber,
    unitName,
    year,
    syllabusContent,
  } = args;
  const ESCAPED_DOLLAR_PLACEHOLDER = "__EXAMARCHIVE_ESCAPED_DOLLAR_PLACEHOLDER__";
  const cleanMarkdown = markdown
    .replace(/\\\$/g, ESCAPED_DOLLAR_PLACEHOLDER)
    .replace(/\\\\\(/g, "\\(")
    .replace(/\\\\\)/g, "\\)");
  const markdownWithRenderedMath = renderLatexToMathMl(cleanMarkdown)
    .replaceAll(ESCAPED_DOLLAR_PLACEHOLDER, "$");
  const parsedHtml = marked.parse(markdownWithRenderedMath);
  // marked.parse can be configured to be async; guard non-string outputs defensively.
  const htmlContent = sanitizeGeneratedHtml(
    typeof parsedHtml === "string" ? parsedHtml : "",
  );
  const watermarkSvg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><text x="50%" y="50%" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700" fill="#800000" fill-opacity="0.08" transform="rotate(-45 150 150)" text-anchor="middle">EXAMARCHIVE</text></svg>`,
  );
  const ABBREV_DOT_RE = /(?:\d+(?:st|nd|rd|th)|\b(?:vs|etc|i\.e|e\.g|cf|al|dr|prof|mr|mrs|ms|st|nd))\./gi;
  const ABBREV_PLACEHOLDER = "\x00";
  const splitSyllabusItems = (input: string): string[] => {
    const trimmed = input.trim();
    if (!trimmed) return [];
    if (/\r?\n/.test(trimmed)) {
      return trimmed
        .split(/\r?\n+/)
        .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
        .filter(Boolean);
    }
    if (trimmed.includes(";")) {
      return trimmed.split(";").map((entry) => entry.trim()).filter(Boolean);
    }
    const protected_ = trimmed.replace(
      ABBREV_DOT_RE,
      (m) => m.slice(0, -1) + ABBREV_PLACEHOLDER,
    );
    return protected_
      .split(/\.\s+(?=[A-Za-z0-9])/)
      .map((entry) => entry.replace(/\x00/g, ".").trim().replace(/\.$/, ""))
      .filter(Boolean);
  };
  const syllabusBullets = splitSyllabusItems(syllabusContent ?? "")
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  const safePaperName = typeof paperName === "string" ? paperName.trim() : "";
  const safeUnitName = typeof unitName === "string" ? unitName.trim() : "";
  const safeModelName = (modelName || DEFAULT_PDF_MODEL_NAME).trim() || DEFAULT_PDF_MODEL_NAME;
  const generatedAtLabel = formatHeaderTimestamp(generatedAtIso || new Date().toISOString());
  const reRenderAtLabel = formatHeaderTimestamp(reRenderedAtIso);
  const unitLabel = safeUnitName
    ? (typeof unitNumber === "number" ? `${safeUnitName} (Unit ${unitNumber})` : safeUnitName)
    : (typeof unitNumber === "number" ? `Unit ${unitNumber}` : "");
  const coverDetails = [
    paperCode ? `<p><strong>Paper Code:</strong> ${escapeHtml(paperCode)}</p>` : "",
    safePaperName ? `<p><strong>Paper Name:</strong> ${escapeHtml(safePaperName)}</p>` : "",
    unitLabel ? `<p><strong>Unit:</strong> ${escapeHtml(unitLabel)}</p>` : "",
    `<p><strong>Model:</strong> ${escapeHtml(safeModelName)}</p>`,
    generatedAtLabel ? `<p><strong>Generated at:</strong> ${escapeHtml(generatedAtLabel)}</p>` : "",
    reRenderAtLabel ? `<p><strong>Re-rendered at:</strong> ${escapeHtml(reRenderAtLabel)}</p>` : "",
    typeof year === "number" ? `<p><strong>Year:</strong> ${year}</p>` : "",
  ].filter(Boolean).join("");
  const coverSection = coverDetails || syllabusBullets
    ? `<section class="cover-page">
         <h1>ExamArchive Notes Dossier</h1>
         <div class="cover-meta">${coverDetails}</div>
         ${syllabusBullets ? `<h2>Syllabus Highlights</h2><ul>${syllabusBullets}</ul>` : ""}
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
    .cover-page h2 {
      border-left: none;
      color: #800000;
      margin-bottom: 8px;
      padding-left: 0;
    }
    .cover-page ul {
      display: inline-block;
      text-align: left;
      margin: 0;
      padding-left: 18px;
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

export function buildSafePdfFileName(args: { fileBaseName: string; fileName?: string }): string {
  const baseFallback = args.fileBaseName.trim() || "generated_document";
  const candidate = (args.fileName || `${baseFallback}.pdf`).trim();
  const normalizedCandidate = candidate.replace(/[^a-zA-Z0-9._-]/g, "_");
  const withoutExtension = normalizedCandidate.replace(/\.pdf$/i, "");
  const coreName = withoutExtension.replace(/[^a-zA-Z0-9]+/g, "");
  const safeCore = coreName.length > 0 ? withoutExtension : "generated_document";
  return `${safeCore}.pdf`;
}

function buildGotenbergEndpoint(baseUrl: string, endpointPath: string): string {
  return new URL(endpointPath, baseUrl).toString();
}

function normalizeGotenbergAuthToken(rawToken: string): string {
  const trimmed = rawToken.trim();
  const isWrappedInDoubleQuotes = trimmed.length >= 2 && trimmed.startsWith("\"") && trimmed.endsWith("\"");
  const isWrappedInSingleQuotes = trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'");
  const unquoted =
    isWrappedInDoubleQuotes || isWrappedInSingleQuotes
      ? trimmed.slice(1, -1).trim()
      : trimmed;
  return unquoted.replace(/^Bearer\s+/i, "").trim();
}

export async function renderMarkdownPdfToAppwrite(args: {
  markdown: string;
  fileBaseName: string;
  fileName?: string;
  gotenbergUrl: string;
  gotenbergAuthToken?: string;
  modelName?: string;
  generatedAtIso?: string;
  reRenderedAtIso?: string;
  paperCode?: string;
  paperName?: string;
  unitNumber?: number;
  unitName?: string;
  year?: number;
  syllabusContent?: string;
  userEmail?: string;
}): Promise<{ fileId: string; fileUrl: string }> {
  const configuredGotenbergUrl = (
    args.gotenbergUrl
    || process.env.GOTENBERG_URL
    || process.env.AZURE_GOTENBERG_URL
    || ""
  ).trim();
  if (!configuredGotenbergUrl) {
    throw new Error("Missing GOTENBERG_URL or AZURE_GOTENBERG_URL environment variable.");
  }
  const gotenbergAuthToken = normalizeGotenbergAuthToken(
    args.gotenbergAuthToken ?? process.env.GOTENBERG_AUTH_TOKEN ?? "",
  );
  const requestHeaders = gotenbergAuthToken
    ? { Authorization: `Bearer ${gotenbergAuthToken}` }
    : undefined;
  let gotenbergBaseUrl: URL;
  try {
    gotenbergBaseUrl = new URL(configuredGotenbergUrl);
  } catch {
    throw new Error("Invalid GOTENBERG_URL.");
  }
  if (!/^https?:$/.test(gotenbergBaseUrl.protocol)) {
    throw new Error("GOTENBERG_URL must use HTTP or HTTPS.");
  }
  const primaryEndpoint = buildGotenbergEndpoint(gotenbergBaseUrl.toString(), GOTENBERG_CONVERT_ENDPOINT_PATH);
  const fallbackEndpoint = buildGotenbergEndpoint(gotenbergBaseUrl.toString(), GOTENBERG_LEGACY_CONVERT_ENDPOINT_PATH);
  const html = buildPdfHtml({
    markdown: args.markdown,
    modelName: args.modelName,
    generatedAtIso: args.generatedAtIso,
    reRenderedAtIso: args.reRenderedAtIso,
    paperCode: args.paperCode,
    paperName: args.paperName,
    unitNumber: args.unitNumber,
    unitName: args.unitName,
    year: args.year,
    syllabusContent: args.syllabusContent,
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
    formData.append("waitDelay", process.env.GOTENBERG_WAIT_DELAY || "5s");
    return formData;
  };

  let gotenbergEndpointPath = GOTENBERG_CONVERT_ENDPOINT_PATH;
  let response = await postToGotenbergWithRetry({
    baseUrl: configuredGotenbergUrl,
    endpointPath: gotenbergEndpointPath,
    headers: requestHeaders,
    buildFormData,
  });
  if (response.status === 404) {
    console.warn(`[ai-pdf-pipeline] Primary Gotenberg endpoint returned 404 (${primaryEndpoint}). Retrying fallback endpoint.`);
    gotenbergEndpointPath = GOTENBERG_LEGACY_CONVERT_ENDPOINT_PATH;
    response = await postToGotenbergWithRetry({
      baseUrl: configuredGotenbergUrl,
      endpointPath: gotenbergEndpointPath,
      headers: requestHeaders,
      buildFormData,
    });
  }
  if (response.status !== 200) {
    const errorText = (await response.text()).trim().slice(0, 2000);
    console.error("[ai-pdf-pipeline] Gotenberg Error Body:", errorText || response.statusText || "Unknown error");
    console.error("[ai-pdf-pipeline] Gotenberg non-200 response.", {
      status: response.status,
      endpoint: primaryEndpoint,
      error: errorText || response.statusText || "Unknown error",
    });
    throw new Error(
      `Gotenberg Error (${response.status}) at ${
        gotenbergEndpointPath === GOTENBERG_LEGACY_CONVERT_ENDPOINT_PATH ? fallbackEndpoint : primaryEndpoint
      }: ${errorText || response.statusText || "Unknown error"}`,
    );
  }

  const pdfBuffer = Buffer.from(await response.arrayBuffer());
  const storage = adminStorage();
  const fileId = ID.unique();
  const finalPdfFileName = buildSafePdfFileName({
    fileBaseName: args.fileBaseName,
    fileName: args.fileName,
  });
  const inputFile = InputFile.fromBuffer(
    pdfBuffer,
    finalPdfFileName,
  );
  try {
    await storage.createFile(BUCKET_ID, fileId, inputFile);
  } catch (error) {
    const appwriteMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Appwrite Error: ${appwriteMessage}`);
  }
  return { fileId, fileUrl: getAppwriteFileDownloadUrl(fileId) };
}
