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

export interface PDFGenerationOptions {
  html: string;
  maxPages: number;
  title?: string;
}

export interface PDFGenerationResult {
  buffer: Buffer;
  actualPages: number;
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

    // Set content with base styles
    const styledHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: A4;
      margin: 2cm 2cm 3cm 2cm;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 100%;
      margin: 0;
      padding: 0;
      position: relative;
    }
    /* Watermark */
    body::before {
      content: 'ExamArchive';
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 80pt;
      color: rgba(211, 39, 62, 0.08);
      font-weight: bold;
      z-index: -1;
      pointer-events: none;
    }
    /* Header with timestamp */
    .doc-header {
      margin-bottom: 1.5em;
      padding-bottom: 0.5em;
      border-bottom: 2px solid #D3273E;
    }
    .doc-title {
      font-size: 18pt;
      font-weight: bold;
      color: #D3273E;
      margin: 0;
    }
    .doc-meta {
      font-size: 9pt;
      color: #666;
      margin-top: 0.5em;
    }
    h1 {
      font-size: 20pt;
      font-weight: bold;
      color: #D3273E;
      margin: 1.2em 0 0.5em 0;
      border-bottom: 2px solid #D3273E;
      padding-bottom: 0.3em;
    }
    h2 {
      font-size: 16pt;
      font-weight: bold;
      color: #D3273E;
      margin: 1.2em 0 0.6em 0;
      border-bottom: 1px solid #D3273E;
      padding-bottom: 0.2em;
    }
    h3 {
      font-size: 13pt;
      font-weight: bold;
      color: #D3273E;
      margin: 1em 0 0.5em 0;
    }
    h4 {
      font-size: 11pt;
      font-weight: bold;
      color: #003B49;
      margin: 0.8em 0 0.4em 0;
    }
    p {
      margin: 0.5em 0;
      text-align: justify;
    }
    ul, ol {
      margin: 0.5em 0;
      padding-left: 1.5em;
    }
    li {
      margin: 0.3em 0;
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
      border-left: 3px solid #D3273E;
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
    hr {
      border: none;
      border-top: 1px solid #ddd;
      margin: 1em 0;
    }
    .footer {
      position: fixed;
      bottom: 1cm;
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
  <div class="doc-header">
    <div class="doc-title">${escapeHtml(title)}</div>
    <div class="doc-meta">Generated on ${new Date().toLocaleString()} | ExamArchive</div>
  </div>
  ${html}
  <div class="footer">
    ExamArchive - Free Past Papers & Study Materials | examarchive.dev
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
 * Convert markdown to HTML (improved conversion for PDF generation)
 */
export function markdownToHTML(markdown: string): string {
  let html = markdown;

  // First, protect code blocks and LaTeX from being escaped
  const codeBlocks: string[] = [];
  html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
    codeBlocks.push(code);
    return `___CODE_BLOCK_${codeBlocks.length - 1}___`;
  });

  // Protect inline code
  const inlineCodes: string[] = [];
  html = html.replace(/`([^`]+)`/g, (match, code) => {
    inlineCodes.push(code);
    return `___INLINE_CODE_${inlineCodes.length - 1}___`;
  });

  // Escape HTML entities
  html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Convert headers (must be on their own line)
  html = html.replace(/^#### (.*$)/gim, "<h4>$1</h4>");
  html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
  html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
  html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");

  // Convert tables (simplified markdown table support)
  html = html.replace(/\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/gm, (match, header, rows) => {
    const headerCells = header.split("|").filter((c: string) => c.trim()).map((c: string) => `<th>${c.trim()}</th>`).join("");
    const bodyRows = rows.trim().split("\n").map((row: string) => {
      const cells = row.split("|").filter((c: string) => c.trim()).map((c: string) => `<td>${c.trim()}</td>`).join("");
      return `<tr>${cells}</tr>`;
    }).join("");
    return `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
  });

  // Bold and italic (order matters!)
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/___(.+?)___(?!CODE|INLINE)/g, "<strong><em>$1</em></strong>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");

  // Unordered lists (must process before paragraphs)
  html = html.replace(/^[\*\-] (.+)$/gim, "<li>$1</li>");

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gim, "<li>$1</li>");

  // Wrap consecutive list items in ul/ol tags
  html = html.replace(/(<li>.*?<\/li>(\n|$))+/g, (match) => {
    return `<ul>${match}</ul>`;
  });

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Blockquotes
  html = html.replace(/^&gt; (.+$)/gim, "<blockquote>$1</blockquote>");

  // Horizontal rules
  html = html.replace(/^---+$/gim, "<hr>");

  // Paragraphs (split by double newlines)
  html = html.split(/\n\n+/).map(block => {
    // Don't wrap if already a block element
    if (block.match(/^<(h[1-6]|table|ul|ol|blockquote|pre|hr)/)) {
      return block;
    }
    // Replace single newlines with <br> within paragraphs
    block = block.replace(/\n/g, "<br>");
    return `<p>${block}</p>`;
  }).join("\n");

  // Restore code blocks
  html = html.replace(/___CODE_BLOCK_(\d+)___/g, (match, index) => {
    return `<pre><code>${codeBlocks[parseInt(index)]}</code></pre>`;
  });

  // Restore inline code
  html = html.replace(/___INLINE_CODE_(\d+)___/g, (match, index) => {
    return `<code>${inlineCodes[parseInt(index)]}</code>`;
  });

  // Clean up
  html = html.replace(/<p><\/p>/g, "");
  html = html.replace(/<p><br><\/p>/g, "");
  html = html.replace(/<ul>\s*<\/ul>/g, "");
  html = html.replace(/<ol>\s*<\/ol>/g, "");

  return html;
}
