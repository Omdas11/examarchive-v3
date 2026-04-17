import { type NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth";
import {
  adminStorage,
  BUCKET_ID,
} from "@/lib/appwrite";
import { AppwriteException } from "node-appwrite";
import { isValidSignedPdfDownloadToken } from "@/lib/pdf-download-link";

export const dynamic = "force-dynamic";

function sanitizeDownloadFilename(name: string): string {
  const trimmed = name.trim();
  const safe = trimmed.replace(/[\r\n"]/g, "").replace(/[\/\\:*?<>|]/g, "_");
  return safe.length > 0 ? safe : "examarchive.pdf";
}

/**
 * GET /api/files/papers/[fileId]
 *
 * Proxy route that fetches a paper PDF from Appwrite Storage using
 * server-side admin credentials. This is required because the papers
 * bucket is restricted to authenticated users only, so direct browser
 * requests to the Appwrite URL would fail with 401/403.
 *
 * Requires either:
 * - an authenticated user session, or
 * - a valid signed download token generated for email delivery links.
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

  try {
    const storage = adminStorage();
    const requestedDownload = request.nextUrl.searchParams.get("download") === "1";
    const shouldDownload = hasValidSignedToken || (!!user && requestedDownload);
    const fileMeta = shouldDownload ? await storage.getFile(BUCKET_ID, fileId) : null;
    const resolvedFileName = shouldDownload
      ? sanitizeDownloadFilename(fileMeta?.name || "examarchive.pdf")
      : null;
    const fallbackHeaderFileName = resolvedFileName ? resolvedFileName.replace(/\\/g, "\\\\").replace(/"/g, '\\"') : null;
    const encodedFileName = resolvedFileName ? encodeURIComponent(resolvedFileName) : null;
    const fileBuffer = shouldDownload
      ? await storage.getFileDownload(BUCKET_ID, fileId)
      : await storage.getFileView(BUCKET_ID, fileId);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": shouldDownload
          ? `attachment; filename="${fallbackHeaderFileName}"; filename*=UTF-8''${encodedFileName}`
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
    console.error("[api/files/papers] Error fetching paper:", err);
    return new NextResponse("Failed to fetch paper", { status: 500 });
  }
}
