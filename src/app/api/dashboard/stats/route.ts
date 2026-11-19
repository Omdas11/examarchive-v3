import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth-cf";
import { getD1, getHomepageStatsD1, getRecentUserActivityD1 } from "@/lib/d1";
import { xpTier, tierLabel, XP_TIERS } from "@/lib/roles";

/**
 * GET /api/dashboard/stats
 * Everything the dashboard shows, sourced from D1 — no mock data:
 * - xp / tier: users.xp; tier is DERIVED via xpTier(), never the stored
 *   users.tier column (that column is stale/NULL for every user).
 * - ai_credits: users.ai_credits (100 on signup; 10 = 1 AI notes set).
 * - verifications_count: rows in content_verifications by this user.
 * - papers_total / syllabi_total / new_papers: KV-cached homepage stats
 *   (1h TTL, ~0 D1 reads on a hit).
 * - recent_activity: the user's own views + downloads from user_activity,
 *   merged newest-first (same source as /profile).
 *
 * Deliberately NOT here: streak_days (nothing updates it — showing it
 * would be a stale number) and the user's own uploads (uploaded_by is
 * empty on all migrated rows, and uploads are team-only now).
 */
export async function GET() {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getD1();
    const [userRow, verifications, views, downloads, home] = await Promise.all([
      db
        .prepare("SELECT xp, ai_credits FROM users WHERE id = ?")
        .bind(user.id)
        .first<{ xp: number; ai_credits: number }>(),
      db
        .prepare("SELECT COUNT(*) AS n FROM content_verifications WHERE user_id = ?")
        .bind(user.id)
        .first<{ n: number }>(),
      getRecentUserActivityD1(user.id, "view", 5),
      getRecentUserActivityD1(user.id, "download", 5),
      // Homepage stats are KV-cached; if the cache read fails the dashboard
      // still loads with zeros for the archive numbers.
      getHomepageStatsD1().catch(() => null),
    ]);

    const xp = userRow?.xp ?? 0;
    const tier = xpTier(xp);
    const idx = XP_TIERS.reduce((acc, t, i) => (xp >= t.xp ? i : acc), 0);
    const next = XP_TIERS[idx + 1] ?? null;

    const activity = [...views, ...downloads]
      .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))
      .slice(0, 5)
      .map((a) => ({
        action: a.action,
        title: a.title,
        href: a.href,
        paper_ref: a.paper_ref,
        created_at: a.created_at,
      }));

    return NextResponse.json({
      xp,
      tier,
      tier_label: tierLabel(tier),
      next_tier_xp: next?.xp ?? null,
      next_tier_label: next ? tierLabel(next.tier) : null,
      ai_credits: userRow?.ai_credits ?? 0,
      verifications_count: verifications?.n ?? 0,
      papers_total: home?.papersTotal ?? 0,
      syllabi_total: home?.syllabusTotal ?? 0,
      new_papers: (home?.recentPapers ?? []).map((p) => ({
        id: p.id,
        title: p.course_name || p.course_code || "Untitled Paper",
        course_code: p.course_code || "",
        year: p.year,
        semester: p.semester,
        department: p.department,
        views: p.view_count ?? 0,
      })),
      recent_activity: activity,
    });
  } catch (err) {
    // Log only the error type/message, not the full stack, to avoid leaking sensitive paths
    const message = err instanceof Error ? err.message : String(err);
    console.error("[dashboard/stats] Error:", message);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
