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
 * Body: { fileId: string, turnstileToken: string, download?: boolean }
 * When `download` is true the URL carries download=1, so the file route
 * answers with Content-Disposition: attachment. Without it the URL has
 * no download flag, so the file route serves the PDF inline for viewing.
 */
export async function POST(request: NextRequest) {
  let body: { fileId?: string; turnstileToken?: string; download?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const fileId = String(body.fileId || "").trim();
  const turnstileToken = String(body.turnstileToken || "").trim();
  const download = body.download === true;
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
    url: `/api/files/papers/${fileId}?ctoken=${encodeURIComponent(token)}${download ? "&download=1" : ""}`,
  });
}
