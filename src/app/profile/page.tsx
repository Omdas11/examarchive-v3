import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth-cf";
import { getD1, getRecentUserActivityD1, type UserActivityEntry } from "@/lib/d1";
import ProfileEditor from "./ProfileEditor";
import { TierBadge } from "@/components/RoleBadge";
import { Icon, type IconName } from "@/components/Icons";
import Breadcrumb from "@/components/Breadcrumb";
import ConfettiTrigger from "@/components/ConfettiTrigger";
import XPBar from "@/components/XPBar";
import ProfileCoursePrefs from "@/components/ProfileCoursePrefs";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import ProfileRightSidebar from "./ProfileRightSidebar";
import { normalizeRole, roleLabel, tierLabel, xpTier, XP_TIERS } from "@/lib/roles";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your ExamArchive account profile.",
  robots: { index: false, follow: false },
};

// ── XP progress within the single tier ladder (see roles.ts XP_TIERS) ─
function xpProgress(xp: number): { progress: number; nextXp: number | null; nextLabel: string | null } {
  const idx = XP_TIERS.reduce((acc, t, i) => (xp >= t.xp ? i : acc), 0);
  const next = XP_TIERS[idx + 1] ?? null;
  const prev = XP_TIERS[idx].xp;
  const progress = next ? Math.min(((xp - prev) / (next.xp - prev)) * 100, 100) : 100;
  return { progress, nextXp: next?.xp ?? null, nextLabel: next ? tierLabel(next.tier) : null };
}

// ── Streak week visualisation ────────────────────────────────────────────────
const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Returns boolean[7] (Mon–Sun) indicating which days of the current calendar
 * week belong to the user's active streak.
 *
 * If last_activity is today or yesterday the streak is live; we mark the last
 * `streakDays` days (up to 7) ending at `lastActivity`.
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
  const daysFromMon = dow === 0 ? 6 : dow - 1;
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

/** Next streak milestone — mirrors v2 renderStreak milestones [7,14,30,60,100] */
function nextStreakGoal(streak: number): number {
  const milestones = [7, 14, 30, 60, 100];
  return milestones.find((m) => m > streak) ?? 100;
}

// ── Role badge SVG icon name (matches v2 roles.js getBadgeIcon) ─────────────
function roleBadgeIconName(role: string): IconName {
  const normalized = normalizeRole(role);
  if (normalized === "founder") return "shield";
  if (normalized === "moderator") return "badge";
  if (normalized === "subject_admin") return "medal";
  if (normalized === "specialist") return "medal";
  return "user";
}

// ── Achievement types matching v2 ACHIEVEMENTS.md ───────────────────────────
type EarnedAchievement = { icon: IconName; label: string };

export default async function ProfilePage({
  searchParams,
}: {
  searchParams?: Promise<{ discord?: string }>;
}) {
  const user = await getServerUser();
  if (!user) redirect("/login?redirect=/profile");
  const userName = user.name || "User";
  const discordStatus = (await searchParams)?.discord ?? null;

  const db = await getD1();

  // `upload_count` in the users table tracks approved uploads (incremented on
  // approval in moderation/gamification logic). Total submissions (all statuses)
  // are queried from the uploads table.
  let usernameLastChanged: string | null = null;
  let approvedCount = 0;
  let discordId: string | null = null;
  let discordUsername: string | null = null;
  let discordAvatar: string | null = null;
  let discordInServer = false;
  try {
    const profileRow = await db
      .prepare(
        "SELECT username_last_changed, upload_count, discord_id, discord_username, discord_avatar, discord_in_server FROM users WHERE id = ? LIMIT 1",
      )
      .bind(user.id)
      .first<{
        username_last_changed: string | null;
        upload_count: number;
        discord_id: string | null;
        discord_username: string | null;
        discord_avatar: string | null;
        discord_in_server: number;
      }>();
    if (profileRow) {
      usernameLastChanged = profileRow.username_last_changed ?? null;
      approvedCount = profileRow.upload_count ?? 0;
      discordId = profileRow.discord_id ?? null;
      discordUsername = profileRow.discord_username ?? null;
      discordAvatar = profileRow.discord_avatar ?? null;
      discordInServer = (profileRow.discord_in_server ?? 0) === 1;
    }
  } catch {
    // ignore – not found or env missing
  }

  // Own activity counts (views + downloads) for the "At a glance" stats.
  let viewedCount = 0;
  let downloadedCount = 0;
  try {
    const rows = await db
      .prepare(
        "SELECT action, COUNT(*) AS n FROM user_activity WHERE user_id = ? AND action IN ('view', 'download') GROUP BY action",
      )
      .bind(user.id)
      .all<{ action: string; n: number }>();
    for (const row of rows.results ?? []) {
      if (row.action === "view") viewedCount = Number(row.n ?? 0);
      if (row.action === "download") downloadedCount = Number(row.n ?? 0);
    }
  } catch {
    // ignore
  }

  // Course selection mirrored to D1 (see /api/profile/course-prefs) for the
  // "Show profile details" panel. Local-only prefs sync on the next visit.
  let courseSummary: string | null = null;
  try {
    const prefs = await db
      .prepare(
        "SELECT dsc, dsm1, dsm2, sec, idc, aec, vac FROM user_course_prefs WHERE user_id = ? LIMIT 1",
      )
      .bind(user.id)
      .first<{
        dsc: string;
        dsm1: string;
        dsm2: string;
        sec: string;
        idc: string;
        aec: string;
        vac: string;
      }>();
    if (prefs) {
      const parts = [
        prefs.dsc ? `DSC ${prefs.dsc}` : "",
        [prefs.dsm1, prefs.dsm2].filter(Boolean).join(", ")
          ? `DSM ${[prefs.dsm1, prefs.dsm2].filter(Boolean).join(", ")}`
          : "",
        prefs.sec ? `SEC ${prefs.sec}` : "",
        prefs.idc ? `IDC ${prefs.idc}` : "",
        prefs.aec ? `AEC ${prefs.aec}` : "",
        prefs.vac ? `VAC ${prefs.vac}` : "",
      ].filter(Boolean);
      courseSummary = parts.length > 0 ? parts.join(" · ") : null;
    }
  } catch {
    // ignore
  }

  // Recently viewed papers/syllabi + downloads (own history only).
  const [recentlyViewed, recentDownloads] = await Promise.all([
    getRecentUserActivityD1(user.id, "view", 10),
    getRecentUserActivityD1(user.id, "download", 10),
  ]);

  // Date format: "Jan 2026" matches v2 screenshot "Member since Feb 2026".
  // Using en-US with { month: 'short', year: 'numeric' } gives the same output
  // regardless of browser locale (e.g. "Feb 2026"), which is what v2 renders.
  const joinedDate = new Date(user.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
  });

  const xpScore = user.xp;
  const tier = xpTier(xpScore);
  const { progress: xpPercent, nextXp: nextXpLevel, nextLabel } = xpProgress(xpScore);

  const streakDays = user.streak_days;
  const weekActive = getWeekActiveDays(streakDays, user.last_activity ?? "");
  const streakGoal = nextStreakGoal(streakDays);

  // ── Earned achievements ────────────────────────────────────────────────
  // Upload-based badges were dropped: uploads are team-only now, so regular
  // users could never earn them. Streak and XP badges remain.
  const earnedAchievements: EarnedAchievement[] = [
    streakDays >= 7     ? { icon: "fire",      label: "7-Day Streak" }    : null,
    streakDays >= 30    ? { icon: "lightning", label: "30-Day Streak" }   : null,
    // Top Contributor proxy: Platinum tier (800+ XP)
    user.xp >= 800      ? { icon: "medal",     label: "Top Contributor" } : null,
  ].filter(Boolean) as EarnedAchievement[];

  const roleDisplayLabel = roleLabel(user.role);
  const xpLabel = tierLabel(tier);

  return (
    <MainLayout
      title="Profile"
      breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Profile" }]}
      showSearch={false}
      sidebarItems={APP_SIDEBAR_ITEMS}
      userRole={user.role}
      isLoggedIn={true}
      userName={userName}
      userInitials={userName.substring(0, 2).toUpperCase()}
    >
    <section className="mx-auto px-4 py-8 space-y-4" style={{ maxWidth: "var(--max-w)" }}>

      {/* Confetti on first approval */}
      <ConfettiTrigger approvedCount={approvedCount} />

      {/* Breadcrumb */}
      <Breadcrumb items={[
        { label: "Home", href: "/" },
        { label: "Profile" },
      ]} />
      <ProfileRightSidebar
        email={user.email}
        roleLabel={roleDisplayLabel}
        tierLabel={tier}
        xpScore={xpScore}
        aiCredits={user.ai_credits ?? 0}
        courseSummary={courseSummary}
        streakDays={streakDays}
        joinedDate={joinedDate}
      />

      {/* ── Main profile card ── */}
      <div className="card p-6">
        <div className="flex flex-col items-center">

          {/* Avatar + name + username (client component for interactive editing) */}
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

          {/* Role badge – outlined pill with SVG icon (v2 style) */}
          <div className="mt-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium${tier === "diamond" ? " rank-glow-diamond" : ""}`}
              style={{ border: "1px solid var(--color-border)" }}
            >
              <Icon name={roleBadgeIconName(user.role)} size={14} aria-hidden="true" />
              {roleDisplayLabel}
            </span>
          </div>

          {/* ── Achievements (v2 ACHIEVEMENTS.md badge types) ── */}
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
                    border: "1px solid rgba(211,39,62,0.2)",
                  }}
                >
                  <Icon name={a.icon} size={11} aria-hidden="true" />
                  {a.label}
                </span>
              ))}
            </div>
          )}

          {/* ── XP progress bar (animated, no overflow pips) ── */}
            <XPBar
              percent={xpPercent}
              leftLabel={`${xpScore} XP · ${xpLabel}`}
              rightLabel={nextXpLevel && nextLabel ? `Next: ${nextLabel} (${nextXpLevel} XP)` : undefined}
            />

          {/* ── Daily Streak ── */}
          {/* Header uses fire icon matching v2 renderStreak (SvgIcons.inline('fire')) */}
          <div className="w-full mt-6">
            <div className="flex items-center gap-2 mb-3">
              <Icon
                name="fire"
                size={18}
                style={{ color: "var(--color-primary)" }}
                aria-hidden="true"
              />
              <span className="font-bold text-base">Daily Streak</span>
            </div>

            {/* 7 circular day indicators (Mon–Sun) */}
            {/* Active days: red bg + check SVG. Inactive: gray bg + day number (1–7) */}
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
                      <Icon name="check" size={16} strokeWidth={3} aria-hidden="true" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>{day}</span>
                </div>
              ))}
            </div>

            {/* Streak stats row: Current / Best / Next goal */}
            {/* "Best" shows streak_days; a separate best_streak field is not yet  */}
            {/* stored in the users collection — tracked as a future enhancement.  */}
            <div
              className="flex justify-around mt-4 pt-3"
              style={{ borderTop: "1px solid var(--color-border)" }}
            >
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

           {/* ── At a glance (replaces the old Uploads / Approved / Approval % grid:
               uploads are team-only now, so those numbers were 0 for everyone) ── */}
          <div className="w-full mt-5 grid grid-cols-3 gap-y-0">
            <div
              className="text-center py-4"
              style={{ borderRight: "1px solid var(--color-border)" }}
            >
              <p className="text-3xl font-bold" style={{ color: "var(--color-primary)" }}>{user.ai_credits ?? 0}</p>
              <p className="text-[11px] tracking-wider mt-1 uppercase" style={{ color: "var(--color-text-muted)" }}>AI Credits</p>
            </div>
            <div
              className="text-center py-4"
              style={{ borderRight: "1px solid var(--color-border)" }}
            >
              <p className="text-3xl font-bold" style={{ color: "var(--color-primary)" }}>{streakDays}</p>
              <p className="text-[11px] tracking-wider mt-1 uppercase" style={{ color: "var(--color-text-muted)" }}>Day Streak</p>
            </div>
            <div className="text-center py-4">
              <p className="text-3xl font-bold" style={{ color: "var(--color-primary)" }}>{viewedCount}</p>
              <p className="text-[11px] tracking-wider mt-1 uppercase" style={{ color: "var(--color-text-muted)" }}>Papers Viewed</p>
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
              <dd className="font-medium">{roleDisplayLabel}</dd>
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

      {/* ── Connected Accounts ── */}
      <div className="card p-6">
        <h2 className="text-base font-semibold mb-3">Connected Accounts</h2>
        {discordStatus === "linked" && (
          <p className="text-sm mb-3" style={{ color: "var(--color-primary)" }}>
            Discord connected — and you are in the ExamArchive server.
          </p>
        )}
        {discordStatus === "linked_not_in_server" && (
          <p className="text-sm mb-3" style={{ color: "var(--color-primary)" }}>
            Discord connected. You are not in the ExamArchive server yet — join it from the Discord app to get server updates.
          </p>
        )}
        {discordStatus === "already_linked" && (
          <p className="text-sm mb-3 text-red-600">
            That Discord account is already linked to a different ExamArchive account.
          </p>
        )}
        {discordStatus === "unlinked" && (
          <p className="text-sm mb-3" style={{ color: "var(--color-primary)" }}>
            Discord disconnected.
          </p>
        )}
        {discordStatus === "error" && (
          <p className="text-sm mb-3 text-red-600">
            Discord linking failed. Please try again.
          </p>
        )}
        {discordId ? (
          <div className="flex items-center gap-3">
            {discordAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={discordAvatar} alt="" width={40} height={40} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white" style={{ background: "#5865F2" }}>
                {(discordUsername ?? "D").substring(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{discordUsername ?? "Discord user"}</p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {discordInServer ? "Member of the ExamArchive server" : "Discord connected"}
              </p>
            </div>
            <form action="/api/auth/discord/unlink" method="post">
              <button type="submit" className="btn text-sm px-3 py-1.5">Unlink</button>
            </form>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shrink-0" style={{ background: "#5865F2" }}>
              D
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Discord</p>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Link your Discord to show it on your profile and confirm your server membership.
              </p>
            </div>
            <a href="/api/auth/discord/link" className="btn text-sm px-3 py-1.5 shrink-0">Connect</a>
          </div>
        )}
      </div>

      {/* ── Recently viewed ── */}
      <div className="card p-6">
        <h2 className="text-base font-semibold mb-3">Recently viewed</h2>
        {recentlyViewed.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Nothing yet — papers and syllabi you open will show up here.
          </p>
        ) : (
          <ul className="space-y-2">
            {recentlyViewed.map((entry: UserActivityEntry) => (
              <li key={`${entry.scope}:${entry.paper_ref}`}>
                <Link href={entry.href} className="flex items-center justify-between gap-3 text-sm hover:underline">
                  <span className="min-w-0 truncate font-medium">{entry.title}</span>
                  <span className="shrink-0 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {entry.scope === "syllabus" ? "Syllabus" : "Paper"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Downloads ── */}
      <div className="card p-6">
        <h2 className="text-base font-semibold mb-3">Downloads</h2>
        {recentDownloads.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Nothing yet — PDFs you download will show up here.
          </p>
        ) : (
          <ul className="space-y-2">
            {recentDownloads.map((entry: UserActivityEntry) => (
              <li key={`${entry.scope}:${entry.paper_ref}`}>
                <Link href={entry.href} className="flex items-center justify-between gap-3 text-sm hover:underline">
                  <span className="min-w-0 truncate font-medium">{entry.title}</span>
                  <span className="shrink-0 text-xs" style={{ color: "var(--color-text-muted)" }}>
                    {entry.scope === "syllabus" ? "Syllabus" : "Paper"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Course Selection ── */}
      <ProfileCoursePrefs />

      {/* Sign out */}
      <form action="/api/auth/signout" method="post">
        <button type="submit" className="btn text-sm px-4 py-2">Sign out</button>
      </form>
    </section>
    </MainLayout>
  );
}
