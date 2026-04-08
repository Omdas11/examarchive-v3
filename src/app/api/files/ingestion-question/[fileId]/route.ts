import { type NextRequest, NextResponse } from "next/server";
import { AppwriteException } from "node-appwrite";
import { getServerUser } from "@/lib/auth";
import { adminStorage, QUESTION_INGESTION_ASSETS_BUCKET_ID } from "@/lib/appwrite";

export const dynamic = "force-dynamic";

/**
 * GET /api/files/ingestion-question/[fileId]
 *
 * Serves question-paper PDFs rendered from ingestion markdown.
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
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const fileBuffer = await adminStorage().getFileView(QUESTION_INGESTION_ASSETS_BUCKET_ID, fileId);
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": "inline",
      },
    });
  } catch (err: unknown) {
    if (err instanceof AppwriteException && (err.code === 404 || err.code === 400)) {
      return new NextResponse("Question paper not found", { status: 404 });
    }
    console.error("[api/files/ingestion-question] Error fetching question paper:", err);
    return new NextResponse("Failed to fetch question paper", { status: 500 });
  }
}
