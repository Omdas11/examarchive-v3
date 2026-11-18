import { type NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth-cf";
import { isValidSignedPdfDownloadToken } from "@/lib/pdf-download-link";
import { verifyTurnstileDownloadToken } from "@/lib/turnstile";
import { getPaperByFileId, getPapersBucket } from "@/lib/d1";
import { isAllowedChatbot, isBot } from "@/lib/bot-check";

export const dynamic = "force-dynamic";

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

/** File name for the download: the base name of the R2 object key. */
function fileNameFromKey(fileKey: string): string {
  const base = fileKey.split("/").pop() || "";
  return sanitizeDownloadFilename(base || "examarchive.pdf");
}

/**
 * GET /api/files/papers/[fileId]
 *
 * Serves a paper PDF from Cloudflare R2 (no Appwrite on this path).
 *
 * Flow: D1 `papers` lookup by `file_id` -> R2 object by `file_key`
 * (`papers/<filename>`) -> PDF bytes, inline for View, attachment for
 * `download=1`.
 *
 * Requires either:
 * - a valid Turnstile download token (`ctoken`, issued after passing the
 *   Cloudflare Turnstile check), or
 * - a valid HMAC-signed download token generated for email delivery links.
 *
 * NOTE: a bare logged-in session is NOT enough — the Turnstile gate
 * applies to logged-in users too, so a bot with an account cannot
 * bulk-download. The download buttons always supply a `ctoken`. Guests
 * with a valid `ctoken` get the PDF with no login required (auth is
 * deferred). `getServerUser` is only consulted on the failure path, to
 * decide between redirect-to-login (guest) and 403 (logged-in) — it is
 * never called on the serving path, so a guest download costs no
 * Appwrite calls at all.
 *
 * Deliberately NOT ported (Cloudflare phase): the download watermark
 * (lib/pdf-watermark reads a font file from disk with node:fs — not
 * available on Workers), download counters (read-only for now), and the
 * AI markdown / Gotenberg render path (those fileIds are not in the
 * papers table, so they 404 here).
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
  // before any auth/database work so bot hits cost no database reads.
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

  // A download needs a Turnstile token (`ctoken`, issued after passing
  // the Turnstile check) or a signed token (AI-generated PDF links). A
  // bare session is NOT enough — the Turnstile gate applies to logged-in
  // users too. The download buttons always supply a `ctoken`.
  const turnstileToken = request.nextUrl.searchParams.get("ctoken") || "";
  const hasValidTurnstileToken = verifyTurnstileDownloadToken({
    fileId,
    token: turnstileToken,
  });
  if (!hasValidSignedToken && !hasValidTurnstileToken) {
    const user = await getServerUser();
    if (!user) {
      // Redirect unauthenticated visitors to the login page instead of
      // returning a raw 401 so the browser navigates to sign-in when the
      // PDF is opened in a new tab.
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return new NextResponse(
      "Please complete the human check to download. Use the Download button on the paper page.",
      { status: 403 },
    );
  }

  const requestedDownload = request.nextUrl.searchParams.get("download") === "1";
  // A download is: an HMAC-signed link (always a download), or an explicit
  // download=1 request backed by a valid Turnstile token. Without
  // download=1 the file is served inline so the browser shows it in its
  // PDF viewer (the "View" action).
  const shouldDownload =
    hasValidSignedToken || (hasValidTurnstileToken && requestedDownload);

  try {
    // Direct (uncached) D1 lookup: the file_id -> file_key mapping is
    // being populated right now, so a cached read could serve a stale miss.
    const paper = await getPaperByFileId(fileId);
    if (!paper || !paper.fileKey) {
      return new NextResponse("Paper not found", { status: 404 });
    }

    const bucket = await getPapersBucket();
    const object = await bucket.get(paper.fileKey);
    if (!object) {
      return new NextResponse("Paper not found", { status: 404 });
    }

    const pdfBytes = await object.arrayBuffer();

    if (shouldDownload) {
      const fileName = fileNameFromKey(paper.fileKey);
      const encodedFileName = encodeURIComponent(fileName);
      return new NextResponse(pdfBytes, {
        headers: {
          "Content-Type": "application/pdf",
          "Cache-Control": "private, max-age=3600",
          "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodedFileName}`,
        },
      });
    }

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": "inline",
      },
    });
  } catch (err: unknown) {
    console.error("[api/files/papers] Error fetching paper from R2:", err);
    return new NextResponse("Failed to fetch paper", { status: 500 });
  }
}
