import { NextRequest, NextResponse } from "next/server";
import {
  createTurnstileDownloadToken,
  isValidFileId,
  verifyTurnstileTokenDetailed,
} from "@/lib/turnstile";

/**
 * POST /api/turnstile-download
 * Verifies a Cloudflare Turnstile token and returns a short-lived
 * download URL for the requested file.
 * Body: { fileId: string, turnstileToken: string }
 */
export async function POST(request: NextRequest) {
  let body: { fileId?: string; turnstileToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const fileId = String(body.fileId || "").trim();
  const turnstileToken = String(body.turnstileToken || "").trim();
  if (!isValidFileId(fileId) || !turnstileToken) {
    return NextResponse.json(
      { error: "Missing fileId or turnstileToken." },
      { status: 400 },
    );
  }

  const result = await verifyTurnstileTokenDetailed(turnstileToken);
  if (!result.ok) {
    return NextResponse.json(
      { error: `Verification failed (${result.reason}).` },
      { status: 403 },
    );
  }

  const token = createTurnstileDownloadToken(fileId);
  if (!token) {
    return NextResponse.json(
      { error: "Could not issue download token." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    url: `/api/files/papers/${fileId}?ctoken=${encodeURIComponent(token)}`,
  });
}
