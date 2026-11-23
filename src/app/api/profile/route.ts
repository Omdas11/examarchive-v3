import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth-cf";
import { getD1 } from "@/lib/d1";
import { isAssignedMdVerifier } from "@/lib/md-verification-access";

const USERNAME_COOLDOWN_DAYS = 7;

/** XP for the first authenticated visit of the UTC day (see GET below). */
const DAILY_LOGIN_XP = 10;

/**
 * PATCH /api/profile
 * Update the authenticated user's display profile (display_name, username).
 * Username changes are rate-limited to once every 7 days.
 */
export async function PATCH(request: NextRequest) {
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

  const allowedFields = ["name", "username"] as const;
  type AllowedField = (typeof allowedFields)[number];

  const update: Partial<Record<AllowedField, string>> = {};

  for (const field of allowedFields) {
    if (field in body) {
      const value = body[field];
      if (typeof value !== "string") {
        return NextResponse.json(
          { error: `Field '${field}' must be a string` },
          { status: 400 },
        );
      }
      update[field] = value.trim();
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 },
    );
  }

  const db = await getD1();

  // Validate username
  if (update.username !== undefined && update.username !== "") {
    if (!/^[a-zA-Z0-9_]{1,30}$/.test(update.username)) {
      return NextResponse.json(
        { error: "Username must be 1–30 alphanumeric characters (underscores allowed)" },
        { status: 400 },
      );
    }

    // Enforce 7-day cooldown on username changes
    try {
      const profile = await db
        .prepare(
          "SELECT username, username_last_changed FROM users WHERE id = ? LIMIT 1",
        )
        .bind(user.id)
        .first<{ username: string | null; username_last_changed: string | null }>();
      const lastChanged = profile?.username_last_changed ?? null;
      if (lastChanged) {
        const daysSince = (Date.now() - new Date(lastChanged).getTime()) / (1000 * 60 * 60 * 24);
        const currentUsername = profile?.username ?? "";
        if (daysSince < USERNAME_COOLDOWN_DAYS && currentUsername !== update.username) {
          const daysLeft = Math.max(1, Math.ceil(USERNAME_COOLDOWN_DAYS - daysSince));
          return NextResponse.json(
            { error: `Username can only be changed once every ${USERNAME_COOLDOWN_DAYS} days. Try again in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}.` },
            { status: 429 },
          );
        }
      }
    } catch {
      // If lookup fails, allow the change (graceful degradation)
    }

    // Validate username uniqueness
    try {
      const row = await db
        .prepare("SELECT id FROM users WHERE username = ? LIMIT 2")
        .bind(update.username)
        .all<{ id: string }>();
      const takenByOther = (row.results ?? []).some((r) => r.id !== user.id);
      if (takenByOther) {
        return NextResponse.json(
          { error: "Username is already taken" },
          { status: 409 },
        );
      }
    } catch (err) {
      console.warn("[api/profile] Username uniqueness check failed:", err);
    }
  }

  // Validate name length
  if (update.name !== undefined && update.name.length > 60) {
    return NextResponse.json(
      { error: "Name must be 60 characters or fewer" },
      { status: 400 },
    );
  }

  try {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (update.name !== undefined) {
      sets.push("display_name = ?");
      params.push(update.name);
    }
    if (update.username !== undefined) {
      sets.push("username = ?");
      params.push(update.username);
      sets.push("username_last_changed = ?");
      params.push(new Date().toISOString());
    }
    await db
      .prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...params, user.id)
      .run();

    const updated = await db
      .prepare(
        "SELECT id, display_name, username, username_last_changed FROM users WHERE id = ? LIMIT 1",
      )
      .bind(user.id)
      .first<{
        id: string;
        display_name: string | null;
        username: string | null;
        username_last_changed: string | null;
      }>();

    return NextResponse.json({
      id: updated?.id ?? user.id,
      name: updated?.display_name ?? "",
      username: updated?.username ?? "",
      username_last_changed: updated?.username_last_changed ?? null,
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[api/profile] Failed to update profile:", errorMessage, err);
    return NextResponse.json(
      { error: "Failed to update profile", details: errorMessage },
      { status: 500 },
    );
  }
}

/**
 * GET /api/profile
 * Return the current user's display profile.
 */
export async function GET() {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch username_last_changed from the DB
  let username_last_changed: string | null = null;
  let approved_upload_count = 0;
  let total_uploads = 0;
  let dbXp = user.xp;
  let dbStreakDays = user.streak_days ?? 0;
  let dailyReward: { xp: number; streak: number } | null = null;
  try {
    const db = await getD1();
    const profile = await db
      .prepare(
        "SELECT username_last_changed, upload_count, xp, streak_days, last_daily_xp_at FROM users WHERE id = ? LIMIT 1",
      )
      .bind(user.id)
      .first<{
        username_last_changed: string | null;
        upload_count: number;
        xp: number;
        streak_days: number | null;
        last_daily_xp_at: number | null;
      }>();
    username_last_changed = profile?.username_last_changed ?? null;
    approved_upload_count = profile?.upload_count ?? 0;
    dbXp = profile?.xp ?? user.xp;
    dbStreakDays = profile?.streak_days ?? user.streak_days ?? 0;

    // ── Daily login XP (+10 XP, first authenticated visit of the UTC day) ──
    // The conditional UPDATE makes the award atomic: concurrent calls on the
    // same morning award only once. Streak: last award yesterday -> +1,
    // earlier (or never) -> 1. Also refreshes last_activity so the profile
    // streak-week display stays live. Failures are swallowed: daily XP is a
    // bonus and must never break the profile response.
    const now = Date.now();
    const today = new Date(now);
    const startOfTodayUtc = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    );
    const startOfYesterdayUtc = startOfTodayUtc - 86_400_000;
    const lastDailyXpAt = profile?.last_daily_xp_at ?? null;
    if (lastDailyXpAt === null || lastDailyXpAt < startOfTodayUtc) {
      const newStreak =
        lastDailyXpAt !== null && lastDailyXpAt >= startOfYesterdayUtc
          ? dbStreakDays + 1
          : 1;
      try {
        const result = await db
          .prepare(
            `UPDATE users SET xp = xp + ?, streak_days = ?, last_activity = ?, last_daily_xp_at = ?
             WHERE id = ? AND (last_daily_xp_at IS NULL OR last_daily_xp_at < ?)`,
          )
          .bind(DAILY_LOGIN_XP, newStreak, now, now, user.id, startOfTodayUtc)
          .run();
        if (result.meta.changes === 1) {
          dailyReward = { xp: DAILY_LOGIN_XP, streak: newStreak };
          dbXp += DAILY_LOGIN_XP;
          dbStreakDays = newStreak;
        }
      } catch {
        // ignore — daily XP must never break the profile response
      }
    }

    // Count only moderated uploads (papers + syllabus) to match upload_count logic.
    const papersRow = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM papers WHERE uploaded_by = ? AND approved = 1",
      )
      .bind(user.id)
      .first<{ n: number }>();
    const syllabusRow = await db
      .prepare(
        "SELECT COUNT(*) AS n FROM syllabus WHERE uploader_id = ? AND approval_status = 'approved'",
      )
      .bind(user.id)
      .first<{ n: number }>();
    total_uploads = Number(papersRow?.n ?? 0) + Number(syllabusRow?.n ?? 0);
  } catch {
    // ignore
  }
  // WhatsApp channel popup: has this user clicked Join already? Separate
  // lookup so a missing column (migration not applied) never breaks the
  // profile response — it just means the popup shows.
  let whatsapp_channel_joined = false;
  try {
    const db = await getD1();
    const flagRow = await db
      .prepare(
        "SELECT whatsapp_channel_joined FROM users WHERE id = ? LIMIT 1",
      )
      .bind(user.id)
      .first<{ whatsapp_channel_joined: number | null }>();
    whatsapp_channel_joined = (flagRow?.whatsapp_channel_joined ?? 0) === 1;
  } catch {
    // ignore — popup shows
  }

  const approval_pct = total_uploads > 0 ? Math.round((approved_upload_count / total_uploads) * 100) : 0;

  // Verifications submitted (verify-to-earn ledger).
  let verified_count = 0;
  try {
    const db = await getD1();
    const verifiedRow = await db
      .prepare("SELECT COUNT(*) AS n FROM content_verifications WHERE user_id = ?")
      .bind(user.id)
      .first<{ n: number }>();
    verified_count = Number(verifiedRow?.n ?? 0);
  } catch {
    // ignore
  }

  // Assigned md verifier? One indexed lookup; drives the MD Verification
  // sidebar entry for student verifiers. Failures hide the entry, never
  // break the profile response.
  let is_md_verifier = false;
  try {
    is_md_verifier = await isAssignedMdVerifier(user.id);
  } catch {
    // ignore
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    avatar_url: user.avatar_url,
    role: user.role,
    secondary_role: user.secondary_role ?? null,
    tertiary_role: user.tertiary_role ?? null,
    tier: user.tier ?? "bronze",
    xp: dbXp,
    streak_days: dbStreakDays,
    last_activity: user.last_activity,
    created_at: user.created_at,
    daily_reward: dailyReward,
    whatsapp_channel_joined,
    approved_upload_count,
    approved_count: approved_upload_count,
    total_uploads,
    approval_pct,
    verified_count,
    is_md_verifier,
    ai_credits: user.ai_credits ?? 0,
    specialist_subject: user.specialist_subject ?? null,
    subject_admin_subject: user.subject_admin_subject ?? null,
    username_last_changed,
  });
}
