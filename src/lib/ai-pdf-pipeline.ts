import { InputFile } from "node-appwrite/file";
import { marked } from "marked";
import {
  adminStorage,
  BUCKET_ID,
  ID,
  getAppwriteFileUrl,
} from "@/lib/appwrite";

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

function buildSafePdfFileName(args: { fileBaseName: string; fileName?: string }): string {
  const baseFallback = args.fileBaseName.trim() || "generated_document";
  const candidate = (args.fileName || `${baseFallback}.pdf`).trim();
  const normalizedCandidate = candidate.replace(/[^a-zA-Z0-9._-]/g, "_");
  const withoutExtension = normalizedCandidate.replace(/\.pdf$/i, "");
  const coreName = withoutExtension.replace(/[^a-zA-Z0-9]+/g, "");
  const safeCore = coreName.length > 0 ? withoutExtension : "generated_document";
  return `${safeCore}.pdf`;
}

export async function renderMarkdownPdfToAppwrite(args: {
  markdown: string;
  fileBaseName: string;
  fileName?: string;
  gotenbergUrl?: string;
}): Promise<{ fileId: string; fileUrl: string }> {
  const effectiveGotenbergUrl =
    args.gotenbergUrl ||
    process.env.AZURE_GOTENBERG_URL;
  if (!effectiveGotenbergUrl) {
    throw new Error("AZURE_GOTENBERG_URL is required.");
  }
  let gotenbergUrl: URL;
  try {
    gotenbergUrl = new URL(effectiveGotenbergUrl);
  } catch {
    throw new Error("Invalid AZURE_GOTENBERG_URL.");
  }
  if (!/^https?:$/.test(gotenbergUrl.protocol)) {
    throw new Error("AZURE_GOTENBERG_URL must use HTTP or HTTPS.");
  }
  const html = buildPdfHtml(args.markdown);
  const formData = new FormData();
  formData.append("files", new Blob([html], { type: "text/html" }), "index.html");
  formData.append("waitDelay", process.env.GOTENBERG_WAIT_DELAY || "5s");

  const response = await fetch(gotenbergUrl.toString(), {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    throw new Error(`Gotenberg PDF generation failed (status ${response.status})`);
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
  await storage.createFile(BUCKET_ID, fileId, inputFile);
  return { fileId, fileUrl: getAppwriteFileUrl(fileId) };
}
