import { InputFile } from "node-appwrite/file";
import { marked } from "marked";
import {
  adminStorage,
  BUCKET_ID,
  ID,
  getAppwriteFileUrl,
} from "@/lib/appwrite";

const DEFAULT_GOTENBERG_URL = "http://104.208.116.97:3000/forms/chromium/convert/html";

function buildPdfHtml(markdown: string): string {
  const htmlContent = marked.parse(markdown);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
  <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
  <style>
    body { font-family: Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; }
    @page { margin: 20mm; }
    h1, h2, h3 { page-break-after: avoid; }
  </style>
</head>
<body>${htmlContent}</body>
</html>`;
}

export async function renderMarkdownPdfToAppwrite(args: {
  markdown: string;
  fileBaseName: string;
  gotenbergUrl?: string;
}): Promise<{ fileId: string; fileUrl: string }> {
  const html = buildPdfHtml(args.markdown);
  const formData = new FormData();
  formData.append("files", new Blob([html], { type: "text/html" }), "index.html");
  formData.append("waitDelay", "5s");

  const response = await fetch(args.gotenbergUrl || DEFAULT_GOTENBERG_URL, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    throw new Error(`Gotenberg PDF generation failed (status ${response.status})`);
  }

  const pdfBuffer = Buffer.from(await response.arrayBuffer());
  const storage = adminStorage();
  const fileId = ID.unique();
  const inputFile = InputFile.fromBuffer(
    pdfBuffer,
    `${args.fileBaseName.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`,
  );
  await storage.createFile(BUCKET_ID, fileId, inputFile);
  return { fileId, fileUrl: getAppwriteFileUrl(fileId) };
}
