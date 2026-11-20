import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * GET /api/ai/status
 *
 * Reports whether AI generation is configured on this deployment, i.e. whether
 * any provider key is present in the Worker env. Used by the client to show
 * a graceful "AI notes unavailable — not configured" state instead of
 * surfacing a raw 503 error after a failed generation attempt.
 *
 * Reads via getCloudflareContext: `process.env` does NOT see Worker
 * secrets under OpenNext, so the old process.env check always said false
 * on the live site.
 *
 * This endpoint reveals nothing secret — only a boolean.
 */
export async function GET() {
  let configured = false;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const e = env as unknown as Record<string, string | undefined>;
    configured = Boolean(
      (e.GEMINI_API_KEY ?? "").trim() ||
        (e.GOOGLE_API_KEY ?? "").trim() ||
        (e.GROQ_API_KEY ?? "").trim() ||
        (e.GROQ_KEYS ?? "").trim() ||
        (e.OPENROUTER_API_KEY ?? "").trim() ||
        (e.OPENROUTER_KEYS ?? "").trim() ||
        (e.GITHUB_TOKEN ?? "").trim() ||
        (e.GITHUB_KEYS ?? "").trim(),
    );
  } catch {
    configured = false;
  }
  return NextResponse.json({ configured });
}
