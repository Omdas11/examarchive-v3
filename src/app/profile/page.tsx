import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { adminDatabases, DATABASE_ID, COLLECTION, Query } from "@/lib/appwrite";
import { signOut } from "@/app/auth/actions";
import ProfileEditor from "./ProfileEditor";
import { TierBadge } from "@/components/RoleBadge";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your ExamArchive account profile.",
  robots: { index: false, follow: false },
};

// ── XP rank helpers ────────────────────────────────────────────────────────
const XP_TIERS = [
  { xp: 0,    label: "Visitor" },
  { xp: 100,  label: "Explorer" },
  { xp: 300,  label: "Contributor" },
  { xp: 800,  label: "Veteran" },
  { xp: 1500, label: "Senior" },
  { xp: 3000, label: "Elite" },
  { xp: 5000, label: "Legend" },
];

function xpRank(xp: number): string {
  let rank = XP_TIERS[0].label;
  for (const tier of XP_TIERS) {
    if (xp >= tier.xp) rank = tier.label;
  }
  return rank;
}

function xpProgress(xp: number): { progress: number; nextXp: number | null; nextLabel: string | null } {
  const idx = XP_TIERS.reduce((acc, t, i) => (xp >= t.xp ? i : acc), 0);
  const next = XP_TIERS[idx + 1] ?? null;
  const prev = XP_TIERS[idx].xp;
  const progress = next ? Math.min(((xp - prev) / (next.xp - prev)) * 100, 100) : 100;
  return { progress, nextXp: next?.xp ?? null, nextLabel: next?.label ?? null };
}

// ── Streak week helpers ────────────────────────────────────────────────────
const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Returns a boolean[7] (Mon–Sun) indicating which days of the current
 * calendar week are part of the user's active streak.
 *
 * Approximation: if last_activity is today or yesterday (streak is live),
 * mark the last `streakDays` days (up to 7) ending at `lastActivity`.
 */
function getWeekActiveDays(streakDays: number, lastActivity: string): boolean[] {
  const active = new Array(7).fill(false) as boolean[];
  if (streakDays === 0 || !lastActivity) return active;

  const now = new Date();
  now.setHours(12, 0, 0, 0);

  const lastDate = new Date(lastActivity);
  lastDate.setHours(12, 0, 0, 0);

  const daysSince = Math.round((now.getTime() - lastDate.getTime()) / 86_400_000);
  if (daysSince > 1) return active; // streak broken

  // Start of current week (Monday = index 0)
  const weekStart = new Date(now);
  const dow = now.getDay(); // 0 = Sun
  const daysFromMon = (dow === 0) ? 6 : dow - 1;
  weekStart.setDate(weekStart.getDate() - daysFromMon);
  weekStart.setHours(12, 0, 0, 0);

  for (let i = 0; i < Math.min(streakDays, 7); i++) {
    const d = new Date(lastDate);
    d.setDate(d.getDate() - i);
    d.setHours(12, 0, 0, 0);
    const idx = Math.round((d.getTime() - weekStart.getTime()) / 86_400_000);
    if (idx >= 0 && idx <= 6) active[idx] = true;
  }
  return active;
}

function nextStreakGoal(streak: number): number {
  // Milestones match v2: [7, 14, 30, 60, 100]
  const milestones = [7, 14, 30, 60, 100];
  return milestones.find((m) => m > streak) ?? 100;
}

// ── Role badge helper ──────────────────────────────────────────────────────
function roleBadgeIcon(role: string): string {
  if (role === "founder") return "👑";
  if (role === "admin" || role === "moderator") return "🛡️";
  return "⭐";
}

export default async function ProfilePage() {
  const user = await getServerUser();
  if (!user) redirect("/login?next=/profile");

  const db = adminDatabases();

  // `upload_count` in the users collection tracks approved papers (incremented on approval).
  // Total submissions (pending + approved + rejected) are queried from the papers collection.
  let usernameLastChanged: string | null = null;
  let approvedCount = 0;
  try {
    const profileDoc = await db.getDocument(DATABASE_ID, COLLECTION.users, user.id);
    usernameLastChanged = (profileDoc.username_last_changed as string) ?? null;
    approvedCount = (profileDoc.upload_count as number) ?? 0;
  } catch {
    // ignore – not found or env missing
  }

  // Total papers submitted by this user (all statuses)
  let totalUploads = 0;
  try {
    const { total } = await db.listDocuments(DATABASE_ID, COLLECTION.papers, [
      Query.equal("uploaded_by", user.id),
      Query.limit(1),
    ]);
    totalUploads = total;
  } catch {
    // ignore
  }

  const approvalPct = totalUploads > 0 ? Math.round((approvedCount / totalUploads) * 100) : 0;

  // Date formatting
  const joinedDate = new Date(user.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
  });

  const tier = (user.tier ?? "bronze") as import("@/types").UserTier;
  const { progress: xpPercent, nextXp, nextLabel } = xpProgress(user.xp);
  const currentRank = xpRank(user.xp);

  // Streak visualisation
  const streakDays = user.streak_days;
  const weekActive = getWeekActiveDays(streakDays, user.last_activity ?? "");
  const streakGoal = nextStreakGoal(streakDays);

  // Earned achievements matching v2 badge types (activity-based only, no role badges)
  // Thresholds mirror v2 ACHIEVEMENTS.md: first_upload, 10_uploads, 7_day_streak,
  // 30_day_streak, approval_90 (90%+ with ≥10 uploads), top_contributor (xp ≥ 800 proxy)
  type EarnedAchievement = { icon: string; label: string };
  const earnedAchievements: EarnedAchievement[] = [
    totalUploads >= 1   ? { icon: "📤", label: "First Upload" }    : null,
    totalUploads >= 10  ? { icon: "🏆", label: "10 Uploads" }      : null,
    totalUploads >= 100 ? { icon: "💎", label: "100 Uploads" }     : null,
    streakDays >= 7     ? { icon: "🔥", label: "7-Day Streak" }    : null,
    streakDays >= 30    ? { icon: "⚡", label: "30-Day Streak" }   : null,
    (approvalPct >= 90 && totalUploads >= 10) ? { icon: "✅", label: "90% Approval" } : null,
    // Top Contributor: use xp ≥ 800 (Veteran level) as proxy — v2 uses monthly top-uploader
    user.xp >= 800      ? { icon: "🥇", label: "Top Contributor" } : null,
  ].filter(Boolean) as EarnedAchievement[];

  const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  return (
    <section className="mx-auto px-4 py-8 space-y-4" style={{ maxWidth: "var(--max-w)" }}>

      {/* ── Main profile card ── */}
      <div className="card p-6">
        <div className="flex flex-col items-center">

          {/* Avatar + name + username (client component for editing) */}
          <ProfileEditor
            initialName={user.name}
            initialUsername={user.username}
            initialAvatarUrl={user.avatar_url}
            initialUsernameLastChanged={usernameLastChanged}
            role={user.role}
          />

          {/* Member since */}
          <p className="text-sm mt-3" style={{ color: "var(--color-text-muted)" }}>
            Member since {joinedDate}
          </p>

          {/* Role badge – outlined pill with icon */}
          <div className="mt-3">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium"
              style={{ border: "1px solid var(--color-border)" }}
            >
              {roleBadgeIcon(user.role)} {capitalise(user.role)}
            </span>
          </div>

          {/* Achievements */}
          {earnedAchievements.length === 0 ? (
            <p className="mt-4 text-sm" style={{ color: "var(--color-text-muted)" }}>
              No achievements yet
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {earnedAchievements.map((a) => (
                <span
                  key={a.label}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{
                    background: "var(--color-accent-soft)",
                    color: "var(--color-primary)",
                    border: "1px solid rgba(211,47,47,0.2)",
                  }}
                >
                  {a.icon} {a.label}
                </span>
              ))}
            </div>
          )}

          {/* ── XP progress bar ── */}
          <div className="w-full mt-5">
            <div
              className="h-2 w-full overflow-hidden rounded-full"
              style={{ background: "var(--color-border)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${xpPercent}%`, background: "var(--color-primary)" }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
              <span>{user.xp} XP · {capitalise(user.role)}</span>
              {nextXp && nextLabel && (
                <span>Next: {nextLabel} ({nextXp} XP)</span>
              )}
            </div>
          </div>

          {/* ── Daily Streak ── */}
          <div className="w-full mt-6">
            <div className="flex items-center gap-2 mb-3">
              {/* Heart-outline icon matching v2 */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-primary)" }} aria-hidden="true">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <span className="font-bold text-base">Daily Streak</span>
            </div>

            {/* 7 day circles */}
            <div className="flex justify-between">
              {WEEK_DAYS.map((day, i) => (
                <div key={day} className="flex flex-col items-center gap-1">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold"
                    style={
                      weekActive[i]
                        ? { background: "var(--color-primary)", color: "#fff" }
                        : { background: "var(--color-border)", color: "var(--color-text-muted)" }
                    }
                  >
                    {weekActive[i] ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>{day}</span>
                </div>
              ))}
            </div>

            {/* Streak stats */}
            <div className="flex justify-around mt-4 pt-3" style={{ borderTop: "1px solid var(--color-border)" }}>
              <div className="text-center">
                <p className="text-2xl font-bold">{streakDays}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>Current</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{streakDays}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>Best</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{streakGoal}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>Next goal</p>
              </div>
            </div>
          </div>

          {/* ── 4-stat grid ── */}
          <div className="w-full mt-5 grid grid-cols-2 gap-y-0">
            <div className="text-center py-4" style={{ borderRight: "1px solid var(--color-border)" }}>
              <p className="text-3xl font-bold" style={{ color: "var(--color-primary)" }}>{totalUploads}</p>
              <p className="text-[11px] tracking-wider mt-1 uppercase" style={{ color: "var(--color-text-muted)" }}>Uploads</p>
            </div>
            <div className="text-center py-4">
              <p className="text-3xl font-bold" style={{ color: "var(--color-primary)" }}>{approvedCount}</p>
              <p className="text-[11px] tracking-wider mt-1 uppercase" style={{ color: "var(--color-text-muted)" }}>Approved</p>
            </div>
            <div
              className="text-center py-4"
              style={{
                borderRight: "1px solid var(--color-border)",
                borderTop: "1px solid var(--color-border)",
              }}
            >
              <p className="text-3xl font-bold" style={{ color: "var(--color-primary)" }}>{approvalPct}%</p>
              <p className="text-[11px] tracking-wider mt-1 uppercase" style={{ color: "var(--color-text-muted)" }}>Approval</p>
            </div>
            <div className="text-center py-4" style={{ borderTop: "1px solid var(--color-border)" }}>
              <p className="text-3xl font-bold" style={{ color: "var(--color-primary)" }}>{user.xp}</p>
              <p className="text-[11px] tracking-wider mt-1 uppercase" style={{ color: "var(--color-text-muted)" }}>XP</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Account Info (read-only) ── */}
      <div className="card p-6">
        <h2 className="text-base font-semibold mb-3">Account Info</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt style={{ color: "var(--color-text-muted)" }}>Email</dt>
            <dd className="font-medium">{user.email}</dd>
          </div>
          <hr style={{ borderColor: "var(--color-border)" }} />
          <div className="flex justify-between">
            <dt style={{ color: "var(--color-text-muted)" }}>Role</dt>
            <dd className="capitalize font-medium">{user.role}</dd>
          </div>
          <hr style={{ borderColor: "var(--color-border)" }} />
          <div className="flex justify-between items-center">
            <dt style={{ color: "var(--color-text-muted)" }}>Rank</dt>
            <dd className="font-medium">{currentRank}</dd>
          </div>
          <hr style={{ borderColor: "var(--color-border)" }} />
          <div className="flex justify-between items-center">
            <dt style={{ color: "var(--color-text-muted)" }}>Tier</dt>
            <dd><TierBadge tier={tier} /></dd>
          </div>
          <hr style={{ borderColor: "var(--color-border)" }} />
          <div className="flex justify-between">
            <dt style={{ color: "var(--color-text-muted)" }}>User ID</dt>
            <dd className="font-mono text-xs truncate max-w-[200px]" title={user.id}>{user.id}</dd>
          </div>
        </dl>
      </div>

      {/* Sign out */}
      <form action={signOut}>
        <button type="submit" className="btn text-sm px-4 py-2">Sign out</button>
      </form>
    </section>
  );
}
