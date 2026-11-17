import { type NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth";
import { adminStorage, NOTES_BUCKET_ID } from "@/lib/appwrite";
import { AppwriteException } from "node-appwrite";
import { applyDownloadWatermark } from "@/lib/pdf-watermark";
import { isAllowedChatbot, isBot } from "@/lib/bot-check";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Friendly page for the allowed chatbots (Google, Gemini, Claude, ChatGPT)
 * when they try to download a PDF. Bots are blocked from downloading; the
 * message tells the person to visit the link on examarchive.dev instead.
 * Same pre-check as /api/files/papers/[fileId].
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
  return safe.length > 0 ? safe : "examarchive-notes.pdf";
}

function isMissingOrInvalidAppwriteFileError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const withCode = error as { code?: unknown };
  const code = typeof withCode.code === "number" ? withCode.code
    : typeof withCode.code === "string" ? Number(withCode.code)
    : undefined;
  return code === 404 || code === 400;
}

/**
 * GET /api/files/notes/[fileId]
 *
 * Serves handmade PDF notes from the `notes` Appwrite bucket.
 * - Inline view (no ?download=1): streams PDF directly for in-browser preview.
 * - Download (?download=1): applies the EXAMARCHIVE mosaic watermark before serving.
 *
 * Requires an authenticated user session.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;

  if (!fileId) {
    return new NextResponse("Missing file ID", { status: 400 });
  }

  // Bots are blocked from downloading PDFs. Runs before any auth/Appwrite
  // work so bot hits cost no database reads. Same pre-check as
  // /api/files/papers/[fileId].
  const userAgent = request.headers.get("user-agent") || "";
  if (isBot(userAgent)) {
    if (isAllowedChatbot(userAgent)) {
      return botDownloadBlockedPage();
    }
    return new NextResponse("Forbidden: bots cannot download PDFs.", {
      status: 403,
    });
  }

  const user = await getServerUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const requestedDownload = request.nextUrl.searchParams.get("download") === "1";

  try {
    const storage = adminStorage();

    if (requestedDownload) {
      const fileMeta = await storage.getFile(NOTES_BUCKET_ID, fileId);
      const resolvedFileName = sanitizeDownloadFilename(fileMeta?.name || "examarchive-notes.pdf");
      const fallbackHeaderFileName = resolvedFileName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const encodedFileName = encodeURIComponent(resolvedFileName);

      const rawFileBuffer = await storage.getFileDownload(NOTES_BUCKET_ID, fileId);

      // Convert buffer to a clean ArrayBuffer regardless of the underlying type returned.
      const rawBytes = new Uint8Array(rawFileBuffer as ArrayBuffer);
      const rawAb = new ArrayBuffer(rawBytes.byteLength);
      new Uint8Array(rawAb).set(rawBytes);

      let body: ArrayBuffer = rawAb;
      try {
        body = await applyDownloadWatermark(rawAb);
      } catch (wmErr) {
        console.warn("[api/files/notes] Watermark failed; serving original:", wmErr);
      }

      return new NextResponse(body, {
        headers: {
          "Content-Type": "application/pdf",
          "Cache-Control": "private, max-age=3600",
          "Content-Disposition": `attachment; filename="${fallbackHeaderFileName}"; filename*=UTF-8''${encodedFileName}`,
        },
      });
    }

    const rawFileBuffer = await storage.getFileView(NOTES_BUCKET_ID, fileId);
    return new NextResponse(rawFileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": "inline",
      },
    });
  } catch (err: unknown) {
    if (err instanceof AppwriteException) {
      if (err.code === 404 || err.code === 400) {
        return new NextResponse("Note not found", { status: 404 });
      }
    }
    if (isMissingOrInvalidAppwriteFileError(err)) {
      return new NextResponse("Note not found", { status: 404 });
    }
    console.error("[api/files/notes] Error fetching note:", err);
    return new NextResponse("Failed to fetch note", { status: 500 });
  }
}
