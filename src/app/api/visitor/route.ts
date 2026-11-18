import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/d1";

const METRICS_DOC_ID = "singleton";
const VISITOR_COOKIE = "ea_vid";
// Cookie lifespan: 30 days
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
/** Fallback launch_progress value when the site_metrics row has not been created yet. */
const DEFAULT_LAUNCH_PROGRESS = 40;

/** Read current visitor count (and other metrics) from the D1 site_metrics row. */
export async function GET() {
  try {
    const db = await getD1();
    const row = await db
      .prepare("SELECT visitor_count, launch_progress FROM site_metrics WHERE id = ?")
      .bind(METRICS_DOC_ID)
      .first<{ visitor_count: number; launch_progress: number | null }>();
    return NextResponse.json({
      visitor_count: row?.visitor_count ?? 0,
      launch_progress: row?.launch_progress ?? DEFAULT_LAUNCH_PROGRESS,
    });
  } catch {
    return NextResponse.json({ visitor_count: 0, launch_progress: DEFAULT_LAUNCH_PROGRESS });
  }
}

/**
 * POST — Increment visitor_count by 1 (once per browser via cookie).
 * Returns the updated count.
 */
export async function POST(req: NextRequest) {
  // If the visitor cookie is already set, they've been counted — return current value.
  const alreadyCounted = req.cookies.get(VISITOR_COOKIE);
  if (alreadyCounted) {
    // Still return current count for display
    return GET();
  }

  let newCount = 1;
  try {
    const db = await getD1();
    const now = Date.now();
    // Upsert the singleton row and bump the counter atomically.
    const result = await db
      .prepare(
        "INSERT INTO site_metrics (id, visitor_count, launch_progress, created_at, updated_at) VALUES (?, 1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET visitor_count = visitor_count + 1, updated_at = ? RETURNING visitor_count",
      )
      .bind(METRICS_DOC_ID, DEFAULT_LAUNCH_PROGRESS, now, now, now)
      .first<{ visitor_count: number }>();
    newCount = result?.visitor_count ?? 1;
  } catch {
    // If the table doesn't exist or any other error, skip silently
    newCount = 0;
  }

  const response = NextResponse.json({ visitor_count: newCount, launch_progress: DEFAULT_LAUNCH_PROGRESS });
  // Set the deduplication cookie
  response.cookies.set(VISITOR_COOKIE, "1", {
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return response;
}

/**
 * DELETE — Reset visitor_count to 0. Gone: it used APPWRITE_API_KEY as its
 * admin key, which no longer exists on Workers. The DevTool that called it
 * is also dead (see api/devtool). Re-add with a Cloudflare-side auth check
 * if a reset is ever needed again.
 */
export async function DELETE() {
  return NextResponse.json({ error: "Gone" }, { status: 410 });
}
