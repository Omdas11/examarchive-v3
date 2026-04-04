import { type NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth";
import {
  adminStorage,
  BUCKET_ID,
} from "@/lib/appwrite";
import { AppwriteException } from "node-appwrite";

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

  const user = await getServerUser();
  if (!user) {
    // Redirect unauthenticated visitors to the login page instead of
    // returning a raw 401 so the browser navigates to sign-in when the
    // PDF is opened in a new tab.
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const storage = adminStorage();
    const shouldDownload = request.nextUrl.searchParams.get("download") === "1";
    const fileMeta = shouldDownload ? await storage.getFile(BUCKET_ID, fileId) : null;
    const resolvedFileName = shouldDownload
      ? sanitizeDownloadFilename(fileMeta?.name || "examarchive.pdf")
      : null;
    const encodedFileName = resolvedFileName ? encodeURIComponent(resolvedFileName) : null;
    const fileBuffer = shouldDownload
      ? await storage.getFileDownload(BUCKET_ID, fileId)
      : await storage.getFileView(BUCKET_ID, fileId);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": shouldDownload
          ? `attachment; filename="${resolvedFileName}"; filename*=UTF-8''${encodedFileName}`
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
