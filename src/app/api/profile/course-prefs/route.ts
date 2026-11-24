import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth-cf";
import { getD1 } from "@/lib/d1";

/**
 * Course preferences (DSC / DSM1 / DSM2 / SEC / IDC / AEC / VAC) plus the
 * student's current semester.
 *
 * These used to live only in the browser's localStorage (key ea_course_prefs),
 * so the site could never tell which users had picked their courses. The
 * client now mirrors them here: POST on every save, and a one-time sync of
 * any older local prefs on the user's next visit. The admin users page reads
 * the user_course_prefs table directly.
 *
 * The semester lives on the users table (users.semester, 1-8, NULL = not
 * set) — it is a property of the student, not of the course selection — and
 * this route is the only writer: POST sets it when the client sends one,
 * DELETE clears it along with the prefs, GET returns it with the prefs.
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

function toPrefs(row: PrefsRow | null, semester: number | null) {
  return {
    semester: semester === null ? "" : String(semester),
    dsc: row?.dsc ?? "",
    dsm1: row?.dsm1 ?? "",
    dsm2: row?.dsm2 ?? "",
    sec: row?.sec ?? "",
    idc: row?.idc ?? "",
    aec: row?.aec ?? "",
    vac: row?.vac ?? "",
    updated_at: row?.updated_at ?? row?.created_at ?? null,
  };
}

/** Validate the semester field: "1".."8" (or 1..8) -> number, absent -> undefined, anything else -> null (invalid). */
function parseSemester(body: Record<string, unknown>): number | undefined | null {
  const value = body.semester;
  if (value === undefined || value === null || value === "") return undefined;
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  if (!Number.isInteger(n) || n < 1 || n > 8) return null;
  return n;
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
    const userRow = await db
      .prepare("SELECT semester FROM users WHERE id = ? LIMIT 1")
      .bind(user.id)
      .first<{ semester: number | null }>();
    const semester =
      userRow && typeof userRow.semester === "number" ? userRow.semester : null;
    if (!row && semester === null) {
      return NextResponse.json({ prefs: null });
    }
    return NextResponse.json({ prefs: toPrefs(row, semester) });
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
  const semester = parseSemester(body);
  if (semester === null) {
    return NextResponse.json(
      { error: "Semester must be 1-8" },
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
    // Semester lives on users, not on the prefs row. Only touch it when
    // the client actually sent one — an absent field leaves it unchanged.
    if (semester !== undefined) {
      await db
        .prepare("UPDATE users SET semester = ? WHERE id = ?")
        .bind(semester, user.id)
        .run();
    }
    const row = await db
      .prepare("SELECT * FROM user_course_prefs WHERE user_id = ? LIMIT 1")
      .bind(user.id)
      .first<PrefsRow>();
    const userRow = await db
      .prepare("SELECT semester FROM users WHERE id = ? LIMIT 1")
      .bind(user.id)
      .first<{ semester: number | null }>();
    const savedSemester =
      userRow && typeof userRow.semester === "number" ? userRow.semester : null;
    return NextResponse.json({ prefs: row ? toPrefs(row, savedSemester) : null });
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
    // Clearing the course selection clears the semester too, so the
    // setup modal asks for both again on the next visit.
    await db
      .prepare("UPDATE users SET semester = NULL WHERE id = ?")
      .bind(user.id)
      .run();
    return NextResponse.json({ prefs: null });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[api/profile/course-prefs] DELETE failed:", errorMessage);
    return NextResponse.json({ error: "Failed to clear course preferences" }, { status: 500 });
  }
}
