import { type NextRequest, NextResponse } from "next/server";
import {
  adminStorage,
  AVATARS_BUCKET_ID,
} from "@/lib/appwrite";
import { ImageGravity, ImageFormat } from "node-appwrite";
import { AppwriteException } from "node-appwrite";

export const dynamic = "force-dynamic";

/**
 * GET /api/files/avatars/[fileId]
 *
 * Proxy route that fetches an avatar image from Appwrite Storage using
 * server-side admin credentials. This is required because the avatars
 * bucket is restricted to authenticated users only, so direct browser
 * requests to the Appwrite URL would fail with 401/403.
 *
 * This endpoint intentionally does not require the caller to be
 * authenticated: avatars are user profile pictures displayed publicly
 * in navigation bars and profile pages visible to all visitors.
 * The admin SDK is used solely to bypass the Appwrite bucket-level
 * restriction; the images themselves are not sensitive.
 *
 * Query params:
 *   w – image width in px (default 200, clamped to 16–800)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;

  if (!fileId) {
    return new NextResponse("Missing file ID", { status: 400 });
  }

  const w = Math.min(
    Math.max(parseInt(request.nextUrl.searchParams.get("w") ?? "200", 10) || 200, 16),
    800,
  );

  try {
    const storage = adminStorage();
    const fileBuffer = await storage.getFilePreview(
      AVATARS_BUCKET_ID,
      fileId,
      w,
      w,
      ImageGravity.Center,
      90,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      ImageFormat.Webp,
    );

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err: unknown) {
    if (err instanceof AppwriteException) {
      // 404 = file not found; 400 = invalid/missing fileId — both mean nothing to show
      if (err.code === 404 || err.code === 400) {
        return new NextResponse("Avatar not found", { status: 404 });
      }
    }
    console.error("[api/files/avatars] Error fetching avatar:", err);
    return new NextResponse("Failed to fetch avatar", { status: 500 });
  }
}
