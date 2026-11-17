import { type NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth";
import {
  adminStorage,
  SYLLABUS_BUCKET_ID,
} from "@/lib/appwrite";
import { AppwriteException } from "node-appwrite";
import { isAllowedChatbot, isBot } from "@/lib/bot-check";

export const dynamic = "force-dynamic";

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

/**
 * GET /api/files/syllabus/[fileId]
 *
 * Proxy route that fetches a syllabus PDF from Appwrite Storage using
 * server-side admin credentials. This is required because the syllabus-files
 * bucket is restricted to authenticated users only, so direct browser
 * requests to the Appwrite URL would fail with 401/403.
 *
 * Requires the user to be authenticated (session cookie).
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
    // Redirect unauthenticated visitors to the login page instead of
    // returning a raw 401 so the browser navigates to sign-in when the
    // PDF is opened in a new tab.
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const storage = adminStorage();
    const fileBuffer = await storage.getFileView(SYLLABUS_BUCKET_ID, fileId);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": "inline",
      },
    });
  } catch (err: unknown) {
    if (err instanceof AppwriteException) {
      // 404 = file not found; 400 = invalid/missing fileId — both mean nothing to serve
      if (err.code === 404 || err.code === 400) {
        return new NextResponse("Syllabus not found", { status: 404 });
      }
    }
    console.error("[api/files/syllabus] Error fetching syllabus:", err);
    return new NextResponse("Failed to fetch syllabus", { status: 500 });
  }
}
