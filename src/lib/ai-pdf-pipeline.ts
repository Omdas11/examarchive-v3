import { InputFile } from "node-appwrite/file";
import { marked } from "marked";
import {
  adminStorage,
  BUCKET_ID,
  ID,
  getAppwriteFileDownloadUrl,
} from "@/lib/appwrite";

function buildPdfHtml(markdown: string): string {
  const cleanMarkdown = markdown
    .replace(/\\\$/g, "$")
    .replace(/\\\\\(/g, "\\(")
    .replace(/\\\\\)/g, "\\)");
  const htmlContent = marked.parse(cleanMarkdown);
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
    body { font-family: "Inter", Arial, sans-serif; line-height: 1.65; color: #1f2937; padding: 0; margin: 0; }
    main { padding: 0 4mm; }
    @page { margin: 12mm 10mm; }
    h1, h2, h3 { color: #4f46e5; }
    h1, h2, h3 { page-break-after: avoid; }
    h1 { border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
    p, li { font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
    th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
    th { background-color: #f3f4f6; }
    body::after {
      content: "EXAMARCHIVE";
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 8rem;
      font-weight: 700;
      color: rgba(79, 70, 229, 0.05);
      z-index: -1;
      pointer-events: none;
    }
  </style>
</head>
<body><main>${htmlContent}</main></body>
</html>`;
}

function buildHeaderHtml(): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" />
<style>
  body {
    font-family: "Inter", Arial, sans-serif;
    font-size: 10px;
    color: #6b7280;
    margin: 0;
    padding: 0 10mm 5px;
    width: 100%;
    display: flex;
    justify-content: space-between;
    border-bottom: 1px solid #e5e7eb;
    box-sizing: border-box;
  }
</style></head><body>
  <span>ExamArchive Study Notes</span>
  <span>Model: Gemini 3.1 Flash Lite</span>
</body></html>`;
}

function buildFooterHtml(): string {
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" />
<style>
  body {
    font-family: "Inter", Arial, sans-serif;
    font-size: 10px;
    color: #6b7280;
    margin: 0;
    padding: 5px 10mm 0;
    width: 100%;
    display: flex;
    justify-content: space-between;
    border-top: 1px solid #e5e7eb;
    box-sizing: border-box;
  }
</style></head><body>
  <span>Generated on ${dateStr}</span>
  <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
</body></html>`;
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

function buildGotenbergEndpoint(baseUrl: string, endpointPath: string): string {
  return new URL(endpointPath, baseUrl).toString();
}

export async function renderMarkdownPdfToAppwrite(args: {
  markdown: string;
  fileBaseName: string;
  fileName?: string;
  gotenbergUrl?: string;
}): Promise<{ fileId: string; fileUrl: string }> {
  const effectiveGotenbergUrl = args.gotenbergUrl || process.env.AZURE_GOTENBERG_URL;
  if (!effectiveGotenbergUrl) {
    throw new Error("AZURE_GOTENBERG_URL is required.");
  }
  const normalizedBaseUrl = effectiveGotenbergUrl.trim().replace(/\/+$/, "");
  let gotenbergUrl: URL;
  try {
    gotenbergUrl = new URL(normalizedBaseUrl);
  } catch {
    throw new Error("Invalid AZURE_GOTENBERG_URL.");
  }
  if (!/^https?:$/.test(gotenbergUrl.protocol)) {
    throw new Error("AZURE_GOTENBERG_URL must use HTTP or HTTPS.");
  }
  const primaryEndpoint = buildGotenbergEndpoint(gotenbergUrl.toString(), "/forms/chromium/convert/html");
  const fallbackEndpoint = buildGotenbergEndpoint(gotenbergUrl.toString(), "/convert/html");
  const html = buildPdfHtml(args.markdown);
  const headerHtml = buildHeaderHtml();
  const footerHtml = buildFooterHtml();
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

  let gotenbergEndpoint = primaryEndpoint;
  let response = await fetch(gotenbergEndpoint, {
    method: "POST",
    body: buildFormData(),
  });
  if (response.status === 404) {
    console.warn(`[ai-pdf-pipeline] Primary Gotenberg endpoint returned 404 (${primaryEndpoint}). Retrying fallback endpoint.`);
    gotenbergEndpoint = fallbackEndpoint;
    response = await fetch(gotenbergEndpoint, {
      method: "POST",
      body: buildFormData(),
    });
  }
  if (!response.ok) {
    const errorText = (await response.text()).trim().slice(0, 2000);
    throw new Error(
      `Gotenberg Error (${response.status}) at ${gotenbergEndpoint}: ${errorText || response.statusText || "Unknown error"}`,
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
