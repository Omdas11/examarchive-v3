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

export const dynamic = "force-dynamic";
// Allow up to 120 s for Gotenberg to render the PDF before Vercel kills the
// function.  This must be set explicitly because the default (10 s on Hobby,
// 30 s on Pro) is too short for a full PDF render pass.
export const maxDuration = 120;

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

/**
 * GET /api/files/papers/[fileId]
 *
 * Dynamic Markdown-to-PDF delivery route.
 *
 * When the `fileId` belongs to an AI generation job (stored as a markdown
 * cache file in `cached-unit-notes` or `cached-solved-papers`), this route
 * fetches the `.md` file, converts it to PDF on-the-fly via Gotenberg, and
 * streams the result back to the user as `application/pdf`.
 *
 * Legacy paper files that live directly in the `papers` bucket are served as
 * before (pass-through proxy).
 *
 * Requires either:
 * - an authenticated user session, or
 * - a valid HMAC-signed download token generated for email delivery links.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;

  if (!fileId) {
    return new NextResponse("Missing file ID", { status: 400 });
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
  if (!hasValidSignedToken) {
    user = await getServerUser();
  }
  if (!hasValidSignedToken && !user) {
    // Redirect unauthenticated visitors to the login page instead of
    // returning a raw 401 so the browser navigates to sign-in when the
    // PDF is opened in a new tab.
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const requestedDownload = request.nextUrl.searchParams.get("download") === "1";
  const shouldDownload = hasValidSignedToken || (!!user && requestedDownload);

  try {
    const storage = adminStorage();
    const db = adminDatabases();

    // ── Step 1: Try the dynamic markdown-to-PDF path ─────────────────────
    // Look up the ai_generation_jobs collection to resolve which cache bucket
    // the markdown file lives in and to retrieve job metadata for the PDF cover.
    let jobPayload: Record<string, unknown> = {};
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
      const job = jobsResult.documents[0];
      if (job) {
        const rawPayload =
          typeof job.input_payload_json === "string"
            ? job.input_payload_json
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

      // Fully await the Gotenberg render before sending a response so that
      // Vercel does not terminate the function mid-stream (no fire-and-forget).
      const pdfBuffer = await renderMarkdownToPdfBuffer({
        markdown,
        gotenbergUrl,
        gotenbergAuthToken: process.env.GOTENBERG_AUTH_TOKEN || "",
        paperCode:
          typeof jobPayload.paperCode === "string"
            ? jobPayload.paperCode
            : undefined,
        unitNumber:
          typeof jobPayload.unitNumber === "number"
            ? jobPayload.unitNumber
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
      const backingBuffer = pdfBuffer.buffer;
      if (backingBuffer instanceof ArrayBuffer) {
        return new NextResponse(
          new Uint8Array(
            backingBuffer,
            pdfBuffer.byteOffset,
            pdfBuffer.byteLength,
          ),
          {
            headers: {
              "Content-Type": "application/pdf",
              "Cache-Control": "private, max-age=3600",
              "Content-Disposition": shouldDownload
                ? `attachment; filename="${fileName}"; filename*=UTF-8''${encodedFileName}`
                : "inline",
            },
          },
        );
      }

      console.warn(
        "[papers-download] Unexpected non-ArrayBuffer PDF backing buffer; creating copied Uint8Array fallback.",
      );
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

    // ── Step 2b: Legacy pass-through (old papers bucket uploads) ─────────
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
    const fileBuffer = shouldDownload
      ? await storage.getFileDownload(BUCKET_ID, fileId)
      : await storage.getFileView(BUCKET_ID, fileId);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": shouldDownload
          ? `attachment; filename="${fallbackHeaderFileName}"; filename*=UTF-8''${encodedLegacyFileName}`
          : "inline",
      },
    });
  } catch (err: unknown) {
    if (err instanceof AppwriteException) {
      // 404 = file not found; 400 = invalid/missing fileId — both mean nothing to serve
      if (err.code === 404 || err.code === 400) {
        return new NextResponse("Paper not found", { status: 404 });
      }
    }
    console.error("[api/files/papers] Error fetching/rendering paper:", err);
    return new NextResponse("Failed to fetch paper", { status: 500 });
  }
}
