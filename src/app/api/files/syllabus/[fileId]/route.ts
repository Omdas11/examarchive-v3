import { type NextRequest, NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth";
import {
  adminStorage,
  SYLLABUS_BUCKET_ID,
} from "@/lib/appwrite";
import { AppwriteException } from "node-appwrite";

export const dynamic = "force-dynamic";

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
  _request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;

  if (!fileId) {
    return new NextResponse("Missing file ID", { status: 400 });
  }

  const user = await getServerUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
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
