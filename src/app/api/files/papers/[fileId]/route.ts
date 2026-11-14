import { type NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth";
import {
  adminStorage,
  adminDatabases,
  BUCKET_ID,
  CACHED_UNIT_NOTES_BUCKET_ID,
  CACHED_SOLVED_PAPERS_BUCKET_ID,
  DATABASE_ID,
  COLLECTION,
  Query,
} from "@/lib/appwrite";
import { AppwriteException } from "node-appwrite";
import { isValidSignedPdfDownloadToken } from "@/lib/pdf-download-link";
import { renderMarkdownToPdfBuffer } from "@/lib/ai-pdf-pipeline";
import { applyDownloadWatermark } from "@/lib/pdf-watermark";

export const dynamic = "force-dynamic";
// Allow up to 120 s for Gotenberg to render the PDF before Vercel kills the
// function.  This must be set explicitly because the default (10 s on Hobby,
// 30 s on Pro) is too short for a full PDF render pass.
export const maxDuration = 120;

/**
 * Bots allowed to crawl the site (Google, Gemini, Claude, ChatGPT). They may
 * read pages, but they may NOT download PDFs — they get a friendly message
 * telling the person to visit the link instead.
 */
const ALLOWED_BOT_SUBSTRINGS = [
  "Googlebot",
  "Google-Extended",
  "Gemini",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
];

/** Common bot / automation markers in a User-Agent. */
const BOT_SUBSTRINGS = [
  "bot",
  "crawler",
  "spider",
  "scraper",
  "HeadlessChrome",
  "curl",
  "python",
  "Go-http-client",
  "scrapy",
  "PostmanRuntime",
  "facebookexternalhit",
  "Twitterbot",
  "Slackbot",
  "LinkedInBot",
  "WhatsApp",
  "TelegramBot",
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
  "PetalBot",
  "Bytespider",
  "YandexBot",
  "Bingbot",
  "DuckDuckBot",
  "Baiduspider",
  "Sogou",
  "Exabot",
];

function isAllowedChatbot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return ALLOWED_BOT_SUBSTRINGS.some((s) => ua.includes(s.toLowerCase()));
}

function isBot(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return BOT_SUBSTRINGS.some((s) => ua.includes(s.toLowerCase()));
}

/**
 * Friendly page for the allowed chatbots (Google, Gemini, Claude, ChatGPT)
 * when they try to download a PDF. Bots are blocked from downloading; the
 * message tells the person to visit the link on examarchive.dev instead.
 */
function botDownloadBlockedPage(): NextResponse {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Bots cannot download PDFs — ExamArchive</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="font-family: system-ui, sans-serif; max-width: 560px; margin: 48px auto; padding: 0 16px; line-height: 1.6;"><h1>Please visit the link instead</h1><p>Bots are blocked from downloading PDFs on ExamArchive. If you are a person, please visit <a href="https://examarchive.dev">examarchive.dev</a> to view and download this paper.</p><p><a href="https://examarchive.dev">Go to examarchive.dev</a></p></body></html>`;
  return new NextResponse(html, {
    status: 403,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function sanitizeDownloadFilename(name: string): string {
  const trimmed = name.trim();
  const safe = trimmed.replace(/[\r\n"]/g, "").replace(/[/\\:*?<>|]/g, "_");
  return safe.length > 0 ? safe : "examarchive.pdf";
}

function buildPdfFileNameFromPayload(payload: Record<string, unknown>): string {
  const paperCode =
    typeof payload.paperCode === "string" ? payload.paperCode.trim() : "document";
  const jobType = typeof payload.jobType === "string" ? payload.jobType : "";
  if (jobType === "solved-paper") {
    const year = typeof payload.year === "number" ? `_${payload.year}` : "";
    return `${paperCode}${year}_solved_paper.pdf`;
  }
  const unitNumber =
    typeof payload.unitNumber === "number" ? payload.unitNumber : "";
  return unitNumber
    ? `${paperCode}_Unit_${unitNumber}_Notes.pdf`
    : `${paperCode}_Notes.pdf`;
}

function getAppwriteErrorCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const withCode = error as { code?: unknown };
  if (typeof withCode.code === "number") return withCode.code;
  if (typeof withCode.code === "string") {
    const parsed = Number(withCode.code);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function isMissingOrInvalidAppwriteFileError(error: unknown): boolean {
  const code = getAppwriteErrorCode(error);
  return code === 404 || code === 400;
}

/**
 * GET /api/files/papers/[fileId]
 *
 * Dynamic Markdown-to-PDF delivery route.
 *
 * When the `fileId` belongs to an AI generation job (stored as a markdown
 * cache file in the `cached-unit-notes/` or `cached-solved-papers/` folders
 * of the `paper-markdown` bucket), this route
 * fetches the `.md` file, converts it to PDF on-the-fly via Gotenberg, and
 * streams the result back to the user as `application/pdf`.
 *
 * Legacy paper files that live directly in the `papers` bucket are served as
 * before (pass-through proxy).
 *
 * Requires either:
 * - an authenticated user session, or
 * - a valid HMAC-signed download token generated for email delivery links.
 *
 * NOTE: downloads used to also require an hCaptcha token (`ctoken`). The
 * hCaptcha secret in Vercel never matched the site key, so the check
 * rejected every solved checkbox and downloads were broken for everyone.
 * The gate was removed (2026-11-14); a logged-in session is enough again.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;

  if (!fileId) {
    return new NextResponse("Missing file ID", { status: 400 });
  }

  // Bots are blocked from downloading PDFs. The allowed chatbots (Google,
  // Gemini, Claude, ChatGPT) get a friendly message telling the person to
  // visit the link instead; every other bot gets a plain 403. This runs
  // before any auth/Appwrite work so bot hits cost no database reads.
  const userAgent = request.headers.get("user-agent") || "";
  if (isBot(userAgent)) {
    if (isAllowedChatbot(userAgent)) {
      return botDownloadBlockedPage();
    }
    return new NextResponse("Forbidden: bots cannot download PDFs.", {
      status: 403,
    });
  }

  const signedUserId = request.nextUrl.searchParams.get("uid") || "";
  const signedExpires = request.nextUrl.searchParams.get("exp") || "";
  const signedToken = request.nextUrl.searchParams.get("token") || "";
  const hasValidSignedToken = isValidSignedPdfDownloadToken({
    fileId,
    userId: signedUserId,
    expires: signedExpires,
    token: signedToken,
  });

  let user = null;
  // A download needs an authenticated session or a signed token
  // (AI-generated PDF links). No CAPTCHA token is required — the hCaptcha
  // gate was removed (2026-11-14) after its secret proved wrong and it
  // blocked every download.
  if (!hasValidSignedToken) {
    user = await getServerUser();
    if (!user) {
      // Redirect unauthenticated visitors to the login page instead of
      // returning a raw 401 so the browser navigates to sign-in when the
      // PDF is opened in a new tab.
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }
  if (!user) {
    user = await getServerUser();
  }

  const requestedDownload = request.nextUrl.searchParams.get("download") === "1";
  const shouldDownload = hasValidSignedToken || (!!user && requestedDownload);

  try {
    const storage = adminStorage();
    const db = adminDatabases();

    // ── Step 1: Prefer concrete PDF files from papers bucket ──────────────
    try {
      const fileMeta = shouldDownload
        ? await storage.getFile(BUCKET_ID, fileId)
        : null;
      const resolvedFileName = shouldDownload
        ? sanitizeDownloadFilename(fileMeta?.name || "examarchive.pdf")
        : null;
      const fallbackHeaderFileName = resolvedFileName
        ? resolvedFileName.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
        : null;
      const encodedLegacyFileName = resolvedFileName
        ? encodeURIComponent(resolvedFileName)
        : null;
      const rawFileBuffer = shouldDownload
        ? await storage.getFileDownload(BUCKET_ID, fileId)
        : await storage.getFileView(BUCKET_ID, fileId);

      // Apply watermark only on downloads so inline previews are unaffected.
      if (shouldDownload) {
        let isAiGeneratedPdf = false;
        try {
          const matchedJobs = await db.listDocuments(
            DATABASE_ID,
            COLLECTION.ai_generation_jobs,
            [
              Query.equal("result_file_id", fileId),
              Query.limit(1),
            ],
          );
          isAiGeneratedPdf = matchedJobs.total > 0 || matchedJobs.documents.length > 0;
        } catch (lookupErr) {
          console.warn(
            "[api/files/papers] Could not determine whether file already has generation watermark; applying download watermark as fallback.",
            { fileId, error: lookupErr },
          );
        }

        let body: ArrayBuffer;
        if (!isAiGeneratedPdf) {
          try {
            body = await applyDownloadWatermark(rawFileBuffer as ArrayBuffer);
          } catch (wmErr) {
            console.warn("[api/files/papers] Watermark failed; serving original:", wmErr);
            body = rawFileBuffer as ArrayBuffer;
          }
        } else {
          // AI-generated PDFs already include an embedded watermark from the generator;
          // applying the download watermark again causes a visible double watermark.
          body = rawFileBuffer as ArrayBuffer;
        }
        return new NextResponse(body, {
          headers: {
            "Content-Type": "application/pdf",
            "Cache-Control": "private, max-age=3600",
            "Content-Disposition": `attachment; filename="${fallbackHeaderFileName}"; filename*=UTF-8''${encodedLegacyFileName}`,
          },
        });
      }

      return new NextResponse(rawFileBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Cache-Control": "private, max-age=3600",
          "Content-Disposition": "inline",
        },
      });
    } catch (papersErr) {
      if (!isMissingOrInvalidAppwriteFileError(papersErr)) {
        throw papersErr;
      }
    }

    // ── Step 2: Fallback dynamic markdown-to-PDF path ────────────────────
    // For older jobs where result_file_id may point to a markdown cache file,
    // look up ai_generation_jobs and render markdown on-demand.
    let jobPayload: Record<string, unknown> = {};
    let resolvedJob: Record<string, unknown> | null = null;
    let markdown: string | null = null;

    try {
      const jobsResult = await db.listDocuments(
        DATABASE_ID,
        COLLECTION.ai_generation_jobs,
        [
          Query.equal("result_file_id", fileId),
          Query.orderDesc("$createdAt"),
          Query.limit(1),
        ],
      );
      const jobDocument = jobsResult.documents[0];
      if (jobDocument) {
        resolvedJob = jobDocument as Record<string, unknown>;
        const rawPayload =
          typeof jobDocument.input_payload_json === "string"
            ? jobDocument.input_payload_json
            : "{}";
        jobPayload = JSON.parse(rawPayload) as Record<string, unknown>;
        const jobType =
          typeof jobPayload.jobType === "string" ? jobPayload.jobType : "";
        const cacheBucketId =
          jobType === "solved-paper"
            ? CACHED_SOLVED_PAPERS_BUCKET_ID
            : CACHED_UNIT_NOTES_BUCKET_ID;

        const markdownBuffer = await storage.getFileDownload(
          cacheBucketId,
          fileId,
        );
        markdown = Buffer.from(markdownBuffer).toString("utf-8");
      }
    } catch (lookupErr) {
      console.warn(
        "[api/files/papers] Job/cache lookup failed; falling back to papers bucket.",
        {
          fileId,
          error:
            lookupErr instanceof Error
              ? lookupErr.message
              : String(lookupErr),
        },
      );
    }

    // ── Step 2a: Dynamic PDF rendering (markdown found) ──────────────────
    if (markdown !== null && markdown.trim()) {
      const gotenbergUrl = (process.env.GOTENBERG_URL || "").trim();
      if (!gotenbergUrl) {
        console.error(
          "[api/files/papers] GOTENBERG_URL is not configured; cannot render PDF on-demand.",
        );
        return new NextResponse(
          "PDF rendering service is not configured",
          { status: 503 },
        );
      }

      const gotenbergAuthToken = (process.env.GOTENBERG_AUTH_TOKEN || "").trim();
      if (!gotenbergAuthToken) {
        console.error(
          "[api/files/papers] GOTENBERG_AUTH_TOKEN is not configured; cannot render PDF on-demand.",
        );
        return new NextResponse(
          "PDF rendering service is not configured",
          { status: 503 },
        );
      }

      // Fully await the Gotenberg render before sending a response so that
      // Vercel does not terminate the function mid-stream (no fire-and-forget).
      const pdfBuffer = await renderMarkdownToPdfBuffer({
        markdown,
        gotenbergUrl,
        gotenbergAuthToken,
        paperCode:
          typeof jobPayload.paperCode === "string"
            ? jobPayload.paperCode
            : undefined,
        paperName:
          typeof jobPayload.paperName === "string"
            ? jobPayload.paperName
            : undefined,
        unitNumber:
          typeof jobPayload.unitNumber === "number"
            ? jobPayload.unitNumber
            : undefined,
        unitName:
          typeof jobPayload.unitName === "string"
            ? jobPayload.unitName
            : undefined,
        syllabusContent:
          typeof jobPayload.syllabusContent === "string"
            ? jobPayload.syllabusContent
            : undefined,
        modelName:
          typeof jobPayload.modelName === "string"
            ? jobPayload.modelName
            : undefined,
        generatedAtIso:
          typeof resolvedJob?.completed_at === "string"
            ? resolvedJob.completed_at
            : typeof resolvedJob?.$createdAt === "string"
              ? resolvedJob.$createdAt
              : undefined,
        year:
          typeof jobPayload.year === "number" ? jobPayload.year : undefined,
        userEmail:
          typeof jobPayload.userEmail === "string"
            ? jobPayload.userEmail
            : undefined,
      });

      const fileName = sanitizeDownloadFilename(
        buildPdfFileNameFromPayload(jobPayload),
      );
      const encodedFileName = encodeURIComponent(fileName);

      return new NextResponse(Uint8Array.from(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Cache-Control": "private, max-age=3600",
          "Content-Disposition": shouldDownload
            ? `attachment; filename="${fileName}"; filename*=UTF-8''${encodedFileName}`
            : "inline",
        },
      });
    }

    return new NextResponse("Paper not found", { status: 404 });
  } catch (err: unknown) {
    if (err instanceof AppwriteException) {
      // 404 = file not found; 400 = invalid/missing fileId — both mean nothing to serve
      if (err.code === 404 || err.code === 400) {
        return new NextResponse("Paper not found", { status: 404 });
      }
    }
    if (isMissingOrInvalidAppwriteFileError(err)) {
      return new NextResponse("Paper not found", { status: 404 });
    }
    console.error("[api/files/papers] Error fetching/rendering paper:", err);
    return new NextResponse("Failed to fetch paper", { status: 500 });
  }
}
