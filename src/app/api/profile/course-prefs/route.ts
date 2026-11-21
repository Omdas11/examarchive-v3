import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth-cf";
import { getD1 } from "@/lib/d1";

/**
 * Course preferences (DSC / DSM1 / DSM2 / SEC / IDC / AEC / VAC).
 *
 * These used to live only in the browser's localStorage (key ea_course_prefs),
 * so the site could never tell which users had picked their courses. The
 * client now mirrors them here: POST on every save, and a one-time sync of
 * any older local prefs on the user's next visit. The admin users page reads
 * the user_course_prefs table directly.
 *
 * All methods require a logged-in user and only ever touch the caller's own
 * row (user_id = session user id). Guests get 401.
 */

const FIELDS = ["dsc", "dsm1", "dsm2", "sec", "idc", "aec", "vac"] as const;
type Field = (typeof FIELDS)[number];

interface PrefsRow {
  user_id: string;
  dsc: string;
  dsm1: string;
  dsm2: string;
  sec: string;
  idc: string;
  aec: string;
  vac: string;
  created_at: number;
  updated_at: number | null;
}

function toPrefs(row: PrefsRow) {
  return {
    dsc: row.dsc ?? "",
    dsm1: row.dsm1 ?? "",
    dsm2: row.dsm2 ?? "",
    sec: row.sec ?? "",
    idc: row.idc ?? "",
    aec: row.aec ?? "",
    vac: row.vac ?? "",
    updated_at: row.updated_at ?? row.created_at,
  };
}

function parsePrefs(body: Record<string, unknown>): Record<Field, string> | null {
  const out = {} as Record<Field, string>;
  for (const field of FIELDS) {
    const value = body[field];
    if (value === undefined || value === null) {
      out[field] = "";
      continue;
    }
    if (typeof value !== "string" || value.length > 60) return null;
    out[field] = value.trim();
  }
  return out;
}

/** GET /api/profile/course-prefs — the caller's saved prefs, or null. */
export async function GET() {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const db = await getD1();
    const row = await db
      .prepare("SELECT * FROM user_course_prefs WHERE user_id = ? LIMIT 1")
      .bind(user.id)
      .first<PrefsRow>();
    return NextResponse.json({ prefs: row ? toPrefs(row) : null });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[api/profile/course-prefs] GET failed:", errorMessage);
    return NextResponse.json({ error: "Failed to load course preferences" }, { status: 500 });
  }
}

/** POST /api/profile/course-prefs — upsert the caller's prefs. */
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const prefs = parsePrefs(body);
  if (!prefs) {
    return NextResponse.json(
      { error: "Each course field must be a string of 60 characters or fewer" },
      { status: 400 },
    );
  }
  try {
    const db = await getD1();
    const now = Date.now();
    await db
      .prepare(
        `INSERT INTO user_course_prefs
           (user_id, dsc, dsm1, dsm2, sec, idc, aec, vac, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           dsc = excluded.dsc, dsm1 = excluded.dsm1, dsm2 = excluded.dsm2,
           sec = excluded.sec, idc = excluded.idc, aec = excluded.aec,
           vac = excluded.vac, updated_at = excluded.updated_at`,
      )
      .bind(
        user.id,
        prefs.dsc,
        prefs.dsm1,
        prefs.dsm2,
        prefs.sec,
        prefs.idc,
        prefs.aec,
        prefs.vac,
        now,
        now,
      )
      .run();
    const row = await db
      .prepare("SELECT * FROM user_course_prefs WHERE user_id = ? LIMIT 1")
      .bind(user.id)
      .first<PrefsRow>();
    return NextResponse.json({ prefs: row ? toPrefs(row) : null });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[api/profile/course-prefs] POST failed:", errorMessage);
    return NextResponse.json({ error: "Failed to save course preferences" }, { status: 500 });
  }
}

/** DELETE /api/profile/course-prefs — remove the caller's prefs row. */
export async function DELETE() {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const db = await getD1();
    await db
      .prepare("DELETE FROM user_course_prefs WHERE user_id = ?")
      .bind(user.id)
      .run();
    return NextResponse.json({ prefs: null });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[api/profile/course-prefs] DELETE failed:", errorMessage);
    return NextResponse.json({ error: "Failed to clear course preferences" }, { status: 500 });
  }
}
