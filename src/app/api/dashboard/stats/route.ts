import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth-cf";
import { getD1 } from "@/lib/d1";

/**
 * GET /api/dashboard/stats
 * Returns stats for the currently authenticated user, sourced from D1:
 * - upload_count  : from users.upload_count (backend-maintained counter)
 * - pending_count : live count of papers with approved=false uploaded by the user
 * - xp            : from users.xp
 * - streak_days   : from users.streak_days
 * - tier          : from users.tier
 * - recent_papers : last 5 approved papers this user uploaded
 *
 * NOTE: papers.uploaded_by is empty on all 636 migrated rows, so the
 * paper queries return 0/empty until new uploads record an uploader.
 * upload_count from the users row is the source of truth.
 */
export async function GET() {
  try {
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getD1();

    const [approved, pending, userRow] = await Promise.all([
      db
        .prepare(
          "SELECT id, paper_name, course_code, year, semester, department, created_at FROM papers WHERE uploaded_by = ? AND approved = 1 ORDER BY created_at DESC LIMIT 5",
        )
        .bind(user.id)
        .all<{
          id: string;
          paper_name: string | null;
          course_code: string | null;
          year: number | null;
          semester: string | null;
          department: string | null;
          created_at: string | null;
        }>(),
      db
        .prepare("SELECT COUNT(*) AS n FROM papers WHERE uploaded_by = ? AND approved = 0")
        .bind(user.id)
        .first<{ n: number }>(),
      db
        .prepare("SELECT upload_count, xp, streak_days, tier FROM users WHERE id = ?")
        .bind(user.id)
        .first<{ upload_count: number; xp: number; streak_days: number; tier: string | null }>(),
    ]);

    const recentPapers = (approved.results ?? []).map((row) => ({
      id: row.id,
      title: row.paper_name || row.course_code || "Untitled Paper",
      course_code: row.course_code || "",
      year: Number(row.year ?? 0) || 0,
      semester: row.semester || "",
      department: row.department || "",
      created_at: row.created_at,
    }));

    return NextResponse.json({
      upload_count: userRow?.upload_count ?? 0,
      pending_count: pending?.n ?? 0,
      xp: userRow?.xp ?? 0,
      streak_days: userRow?.streak_days ?? 0,
      tier: userRow?.tier ?? "bronze",
      recent_papers: recentPapers,
    });
  } catch (err) {
    // Log only the error type/message, not the full stack, to avoid leaking sensitive paths
    const message = err instanceof Error ? err.message : String(err);
    console.error("[dashboard/stats] Error:", message);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
