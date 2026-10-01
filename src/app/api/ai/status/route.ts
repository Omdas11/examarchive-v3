import { NextResponse } from "next/server";

/**
 * GET /api/ai/status
 *
 * Reports whether AI generation is configured on this deployment, i.e. whether
 * a Gemini/Google API key is present in the server environment. Used by the
 * client to show a graceful "AI notes unavailable — not configured" state
 * instead of surfacing a raw 503 error after a failed generation attempt.
 *
 * This endpoint reveals nothing secret — only a boolean.
 */
export async function GET() {
  const configured = Boolean(
    (process.env.GEMINI_API_KEY ?? "").trim() ||
      (process.env.GOOGLE_API_KEY ?? "").trim(),
  );
  return NextResponse.json({ configured });
}
