import { NextRequest, NextResponse } from "next/server";
import {
  createCaptchaDownloadToken,
  isValidFileId,
  verifyHCaptchaToken,
} from "@/lib/captcha-download";

/**
 * POST /api/captcha-download
 * Verifies an hCaptcha token for an anonymous visitor and returns a
 * short-lived download URL for the requested file.
 * Body: { fileId: string, captchaToken: string }
 */
export async function POST(request: NextRequest) {
  let body: { fileId?: string; captchaToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const fileId = String(body.fileId || "").trim();
  const captchaToken = String(body.captchaToken || "").trim();
  if (!isValidFileId(fileId) || !captchaToken) {
    return NextResponse.json({ error: "Missing fileId or captchaToken." }, { status: 400 });
  }

  const human = await verifyHCaptchaToken(captchaToken);
  if (!human) {
    return NextResponse.json({ error: "CAPTCHA verification failed." }, { status: 403 });
  }

  const token = createCaptchaDownloadToken(fileId);
  if (!token) {
    return NextResponse.json({ error: "Could not issue download token." }, { status: 500 });
  }

  return NextResponse.json({
    url: `/api/files/papers/${fileId}?ctoken=${encodeURIComponent(token)}`,
  });
}
