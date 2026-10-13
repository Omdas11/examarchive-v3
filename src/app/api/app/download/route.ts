import { NextResponse, type NextRequest } from "next/server";
import { Client, Account } from "node-appwrite";
import {
  adminStorage,
  BUCKET_ID,
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT_ID,
} from "@/lib/appwrite";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * GET /api/app/download?fileId=<id>&jwt=<appwrite-jwt>
 *
 * Native-app PDF download proxy. The Flutter app authenticates with the
 * Appwrite SDK directly and passes a short-lived JWT (account.createJWT()).
 * This route verifies the JWT and streams the paper PDF from storage.
 *
 * Mirrors the logged-in web behaviour (direct file access, no captcha).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fileId = (searchParams.get("fileId") || "").trim();
  const jwt = (searchParams.get("jwt") || "").trim();

  if (!fileId) {
    return new NextResponse("Missing fileId", { status: 400 });
  }
  if (!jwt) {
    return new NextResponse("Missing jwt", { status: 401 });
  }

  // Verify the Appwrite JWT.
  try {
    const client = new Client()
      .setEndpoint(APPWRITE_ENDPOINT)
      .setProject(APPWRITE_PROJECT_ID)
      .setJWT(jwt);
    const account = new Account(client);
    await account.get();
  } catch {
    return new NextResponse("Invalid or expired token", { status: 401 });
  }

  try {
    const storage = adminStorage();
    const fileBuffer = await storage.getFileDownload(BUCKET_ID, fileId);
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return new NextResponse("File not found", { status: 404 });
  }
}
