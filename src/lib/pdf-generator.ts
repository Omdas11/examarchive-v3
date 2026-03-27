/**
 * Server-side PDF generation using Puppeteer.
 * Converts HTML content to PDF with strict page limits.
 *
 * Note: In serverless environments (Vercel), ensure you have:
 * - Added @sparticuz/chromium to dependencies
 * - Set appropriate memory limits for your function
 * - Consider using edge runtime if available
 */

import puppeteer, { type Page } from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import sanitizeHtml from "sanitize-html";
import { marked } from "marked";
import katex from "katex";

const katexCSS =
  ".katex { font: normal 1em 'Times New Roman', serif; }" +
  ".katex-display { margin: 0.8em 0; }" +
  ".katex .mord { font: normal 1em 'Times New Roman', serif; }";

export interface PDFGenerationOptions {
  html: string;
  maxPages: number;
  title?: string;
  meta?: {
    topic?: string;
    model?: string;
    modelLabel?: string;
    generatedAt?: string;
  };
}

export interface PDFGenerationResult {
  buffer: Buffer;
  actualPages: number;
}

/**
 * Sanitize rich HTML content before rendering in Puppeteer.
 * Allows common editorial tags/attributes used by markdownToHTML output while
 * stripping scripts, unsafe protocols, and event-handler attributes.
 */
export function sanitizeHtmlLikeContent(input: string): string {
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
      "mfrac",
      "msqrt",
      "mspace",
      "mstyle",
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

/**
 * Generate a PDF from HTML content with strict page enforcement.
 * If content exceeds maxPages, it will be truncated.
 */
export async function generatePDF(
  options: PDFGenerationOptions
): Promise<PDFGenerationResult> {
  const { html, maxPages, title = "Document" } = options;
  const safeMaxPages = Math.max(1, Math.floor(maxPages));
  const safeHtml = sanitizeHtmlLikeContent(html);
  const watermarkDataUrl = buildWatermarkDataUrl();

  let browser;
  try {
    // Launch browser with Chromium for Vercel/serverless compatibility
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1280, height: 720 },
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();

    // Keep header area empty; footer handles pagination and attribution.
    const headerTemplate = `<div></div>`;

    const footerTemplate = `
      <style>
        .footer {
          font-family: 'Georgia', 'Times New Roman', serif;
          font-size: 9pt;
          color: #4b5563;
          padding: 8px 24px 12px 24px;
          width: 100%;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .page-info {
          font-variant-numeric: tabular-nums;
        }
      </style>
      <div class="footer">
        <span>ExamArchive ©</span>
        <span class="page-info">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>`;

    const styledHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>${katexCSS}</style>
  <style>
    html, body {
      width: 100%;
      box-sizing: border-box;
    }
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 100%;
      margin: 0;
      padding: 0 0 32px 0;
      background-image: url('${watermarkDataUrl}');
      background-repeat: repeat;
      background-size: 240px 240px;
      background-position: 0 0;
      background-attachment: fixed;
    }
    .doc-body {
      max-width: 720px;
      margin: 0 auto;
      padding: 16px 12px 32px;
      box-sizing: border-box;
      width: 100%;
    }
    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 0.5em 0;
    }
    h2 {
      font-size: 16pt;
      font-weight: bold;
      color: #003B49;
      margin: 1.2em 0 0.6em 0;
      border-bottom: 1px solid #003B49;
      padding-bottom: 0.2em;
    }
    h3 {
      font-size: 13pt;
      font-weight: bold;
      color: #003B49;
      margin: 1em 0 0.5em 0;
    }
    h4 {
      font-size: 11pt;
      font-weight: bold;
      margin: 0.8em 0 0.4em 0;
    }
    p {
      margin: 0.5em 0;
      text-align: justify;
      overflow-wrap: break-word;
      word-break: break-word;
    }
    ul, ol {
      margin: 0.5em 0;
      padding-left: 1.5em;
    }
    li {
      margin: 0.3em 0;
      overflow-wrap: break-word;
    }
    code {
      font-family: 'Courier New', monospace;
      background: #f4f4f4;
      padding: 0.1em 0.3em;
      border-radius: 3px;
      font-size: 10pt;
    }
    pre {
      background: #f4f4f4;
      padding: 0.8em;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 9pt;
      line-height: 1.4;
      white-space: pre-wrap;
      overflow-wrap: break-word;
      word-break: break-word;
    }
    pre code {
      background: none;
      padding: 0;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 0.8em 0;
      font-size: 10pt;
      table-layout: fixed;
      overflow-wrap: break-word;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 0.4em 0.6em;
      text-align: left;
    }
    th {
      background: #003B49;
      color: white;
      font-weight: bold;
    }
    tr:nth-child(even) {
      background: #f9f9f9;
    }
    blockquote {
      border-left: 3px solid #D3273E;
      padding-left: 1em;
      margin: 0.8em 0;
      color: #555;
      font-style: italic;
    }
    strong {
      font-weight: bold;
    }
    em {
      font-style: italic;
    }
    .page-break {
      page-break-after: always;
    }
    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 9pt;
      color: #666;
      padding: 0.5em 0;
    }
  </style>
</head>
<body>
  <div class="doc-body">
    ${safeHtml}
  </div>
</body>
</html>
    `;

    await page.setContent(styledHTML, { waitUntil: "networkidle0" });

    // Estimate pages before generating to avoid closing the page prematurely
    const estimatedPages = await estimatePageCount(page);
    const cappedPages = Math.min(safeMaxPages, Math.max(1, estimatedPages));

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate,
      margin: { top: "40px", bottom: "55px", left: "18mm", right: "18mm" },
      preferCSSPageSize: true,
      pageRanges: `1-${safeMaxPages}`,
    });

    await browser.close();

    return {
      buffer: Buffer.from(pdfBuffer),
      actualPages: cappedPages,
    };
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Estimate page count from content.
 * This is a rough approximation based on content length.
 */
async function estimatePageCount(page: Page): Promise<number> {
  try {
    // Get the body height and estimate pages
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    const A4_HEIGHT_PX = 1122; // Approximate A4 height in pixels at 96 DPI
    const estimatedPages = Math.ceil(bodyHeight / A4_HEIGHT_PX);
    return estimatedPages;
  } catch {
    return 1;
  }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Convert markdown (with LaTeX) to HTML.
 */
export function markdownToHTML(markdown: string): string {
  const raw = markdown || "";
  const withMath = renderMath(raw);

  marked.setOptions({
    gfm: true,
    breaks: true,
  });

  const html = marked.parse(withMath);
  return typeof html === "string" ? html : "";
}

function renderMath(input: string): string {
  // simple replacement before markdown parsing; avoids raw LaTeX leaking through
  const replaceDisplay = input.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => {
    try {
      return katex.renderToString(expr, { displayMode: true, throwOnError: false, strict: "ignore" });
    } catch {
      return `<pre>${escapeHtml(expr)}</pre>`;
    }
  });

  return replaceDisplay.replace(/(^|[^\\])\$([^$\n]+?)\$/g, (match, prefix, expr) => {
    try {
      return `${prefix}${katex.renderToString(expr, { displayMode: false, throwOnError: false, strict: "ignore" })}`;
    } catch {
      return `${prefix}<code>${escapeHtml(expr)}</code>`;
    }
  });
}

function buildWatermarkDataUrl(): string {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="260" height="260">
  <text x="20" y="150"
    transform="rotate(45 130 130)"
    fill="#000000"
    opacity="0.08"
    font-family="Georgia, Times New Roman, serif"
    font-size="28">ExamArchive</text>
</svg>`;
const svgBase64 = Buffer.from(svg, "utf8").toString("base64");
return `data:image/svg+xml;base64,${svgBase64}`;
}
