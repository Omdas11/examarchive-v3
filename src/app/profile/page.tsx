import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerUser } from "@/lib/auth";
import { adminDatabases, DATABASE_ID, COLLECTION, Query } from "@/lib/appwrite";
import { signOut } from "@/app/auth/actions";
import ProfileEditor from "./ProfileEditor";
import { TierBadge } from "@/components/RoleBadge";
import { Icon, type IconName } from "@/components/Icons";
import ContributionHeatmap from "@/components/ContributionHeatmap";
import Breadcrumb from "@/components/Breadcrumb";
import ConfettiTrigger from "@/components/ConfettiTrigger";
import XPBar from "@/components/XPBar";
import ProfileCoursePrefs from "@/components/ProfileCoursePrefs";
import MainLayout from "@/components/layout/MainLayout";
import { APP_SIDEBAR_ITEMS } from "@/components/layout/appSidebarItems";
import ReferralShareCard from "./ReferralShareCard";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your ExamArchive account profile.",
  robots: { index: false, follow: false },
};

// ── XP tier system (mirrors v2 ROLES.md §7 and profile-panel.js XP_LEVELS) ─
const XP_TIERS = [
  { xp: 0,    level: 0,   label: "Visitor" },
  { xp: 100,  level: 5,   label: "Explorer" },
  { xp: 300,  level: 10,  label: "Contributor" },
  { xp: 800,  level: 25,  label: "Veteran" },
  { xp: 1500, level: 50,  label: "Senior" },
  { xp: 3000, level: 90,  label: "Elite" },
  { xp: 5000, level: 100, label: "Legend" },
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
  if (role === "founder")   return "crown";
  if (role === "admin")     return "shield";
  if (role === "moderator") return "badge";
  return "user";
}

// ── Achievement types matching v2 ACHIEVEMENTS.md ───────────────────────────
type EarnedAchievement = { icon: IconName; label: string };

const PROFILE_TABS = ["overview", "contributions", "rewards", "referrals", "settings"] as const;
type ProfileTab = (typeof PROFILE_TABS)[number];
const CONTRIBUTOR_PLUS_UPLOADS = 2;

function normalizeProfileTab(tab?: string): ProfileTab {
  if (!tab) return "overview";
  const normalized = tab.toLowerCase();
  return PROFILE_TABS.includes(normalized as ProfileTab)
    ? (normalized as ProfileTab)
    : "overview";
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const activeTab = normalizeProfileTab(params.tab);
  const user = await getServerUser();
  if (!user) redirect("/login?next=/profile");
  const userName = user.name || "User";

  const db = adminDatabases();

  // `upload_count` in the users collection tracks approved papers (incremented on
  // approval in the gamification logic). Total submissions (all statuses) are
  // queried separately from the papers collection.
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

  // Date format: "Jan 2026" matches v2 screenshot "Member since Feb 2026".
  // Using en-US with { month: 'short', year: 'numeric' } gives the same output
  // regardless of browser locale (e.g. "Feb 2026"), which is what v2 renders.
  const joinedDate = new Date(user.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
  });

  const tier = (user.tier ?? "bronze") as import("@/types").UserTier;
  const { progress: xpPercent, nextXp, nextLabel } = xpProgress(user.xp);
  const currentRank = xpRank(user.xp);

  const streakDays = user.streak_days;
  const weekActive = getWeekActiveDays(streakDays, user.last_activity ?? "");
  const streakGoal = nextStreakGoal(streakDays);

  // ── Earned achievements (v2 badge types from ACHIEVEMENTS.md) ────────────
  // Badges that can't be auto-computed (first_review, first_publish, early_user)
  // use best available proxies; see docs/XP_ACHIEVEMENTS.md for full details.
  const earnedAchievements: EarnedAchievement[] = [
    totalUploads >= 1   ? { icon: "upload",    label: "First Upload" }    : null,
    totalUploads >= 10  ? { icon: "trophy",    label: "10 Uploads" }      : null,
    totalUploads >= 100 ? { icon: "sparkles",  label: "100 Uploads" }     : null,
    streakDays >= 7     ? { icon: "fire",      label: "7-Day Streak" }    : null,
    streakDays >= 30    ? { icon: "lightning", label: "30-Day Streak" }   : null,
    (approvalPct >= 90 && totalUploads >= 10) ? { icon: "badge", label: "90% Approval" } : null,
    // Top Contributor proxy: Veteran XP level (800+) — mirrors v2 xp ≥ 800 threshold
    user.xp >= 800      ? { icon: "medal",     label: "Top Contributor" } : null,
  ].filter(Boolean) as EarnedAchievement[];

  const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.examarchive.dev";
  const referralCode = user.referral_code ?? "";
  const referralLink = `${siteUrl}/login?mode=signup&ref=${encodeURIComponent(referralCode)}`;

  // XP bar left label: show primary role name for system roles, XP rank for students
  // mirrors v2 profile-panel.js xpCurrentTierEl logic
  const xpLabel = (user.role === "student") ? currentRank : capitalise(user.role);
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

      <div className="card p-2 sm:p-3">
        <nav className="flex flex-wrap gap-2">
          {PROFILE_TABS.map((tab) => (
            <Link
              key={tab}
              href={`/profile?tab=${tab}`}
              className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
                activeTab === tab
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-on-surface-variant"
              }`}
            >
              {tab}
            </Link>
          ))}
        </nav>
      </div>

      {activeTab === "overview" && (
      <>
      {(() => {
        const nextUploadGoal = Math.max(0, CONTRIBUTOR_PLUS_UPLOADS - approvedCount);
        return (
        <>
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
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium${tier === "diamond" ? " rank-glow-diamond" : ""}${currentRank === "Legend" ? " rank-glow-legend" : ""}`}
              style={{ border: "1px solid var(--color-border)" }}
            >
              <Icon name={roleBadgeIconName(user.role)} size={14} aria-hidden="true" />
              {capitalise(user.role)}
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
            leftLabel={`${user.xp} XP · ${xpLabel}`}
            rightLabel={nextXp && nextLabel ? `Next: ${nextLabel} (${nextXp} XP)` : undefined}
          />

          {/* ── Contribution Heatmap ── */}
          <div className="w-full mt-6">
            <ContributionHeatmap
              totalUploads={totalUploads}
              approvedCount={approvedCount}
              streakDays={streakDays}
              lastActivity={user.last_activity ?? ""}
            />
          </div>

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

          {/* ── 4-stat grid (Uploads / Approved / Approval % / XP) ── */}
          {/* Matches v2 profile stats layout (get_user_upload_stats RPC equivalent) */}
          <div className="w-full mt-5 grid grid-cols-2 gap-y-0">
            <div
              className="text-center py-4"
              style={{ borderRight: "1px solid var(--color-border)" }}
            >
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
            <div
              className="text-center py-4"
              style={{ borderTop: "1px solid var(--color-border)" }}
            >
              <p className="text-3xl font-bold" style={{ color: "var(--color-primary)" }}>{user.xp}</p>
              <p className="text-[11px] tracking-wider mt-1 uppercase" style={{ color: "var(--color-text-muted)" }}>XP</p>
            </div>
          </div>
        </div>
      </div>
      <div className="card p-5">
        <h2 className="text-base font-semibold">Next Goal</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          {nextUploadGoal > 0
            ? `${nextUploadGoal} more verified upload${nextUploadGoal === 1 ? "" : "s"} to reach Contributor+ momentum.`
            : "You have crossed the next verified-upload milestone. Keep consistency for reviewer recognition."}
        </p>
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
        </>
        );
      })()}
      </>
      )}

      {activeTab === "contributions" && (
        <>
          <div className="card p-6">
            <h2 className="text-base font-semibold">Impact Cards</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-outline-variant/30 p-4">
                <p className="text-xs uppercase text-on-surface-variant">Total uploads</p>
                <p className="mt-1 text-2xl font-bold">{totalUploads}</p>
              </div>
              <div className="rounded-xl border border-outline-variant/30 p-4">
                <p className="text-xs uppercase text-on-surface-variant">Accepted uploads</p>
                <p className="mt-1 text-2xl font-bold">{approvedCount}</p>
              </div>
              <div className="rounded-xl border border-outline-variant/30 p-4">
                <p className="text-xs uppercase text-on-surface-variant">Approval trend</p>
                <p className="mt-1 text-2xl font-bold">{approvalPct}%</p>
              </div>
            </div>
          </div>
          <div className="card p-6">
            <h2 className="text-base font-semibold">Contribution Activity</h2>
            <div className="mt-4">
              <ContributionHeatmap
                totalUploads={totalUploads}
                approvedCount={approvedCount}
                streakDays={streakDays}
                lastActivity={user.last_activity ?? ""}
              />
            </div>
          </div>
        </>
      )}

      {activeTab === "rewards" && (
        <>
          <div className="card p-6">
            <h2 className="text-base font-semibold">Rewards & XP</h2>
            <XPBar
              percent={xpPercent}
              leftLabel={`${user.xp} XP · ${xpLabel}`}
              rightLabel={nextXp && nextLabel ? `Next: ${nextLabel} (${nextXp} XP)` : undefined}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {earnedAchievements.length === 0 ? (
                <p className="text-sm text-on-surface-variant">No achievements yet.</p>
              ) : (
                earnedAchievements.map((a) => (
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
                ))
              )}
            </div>
          </div>
          <div className="card p-6">
            <h2 className="text-base font-semibold">Role Perks</h2>
            <ul className="mt-3 space-y-2 text-sm text-on-surface-variant">
              <li>Current role: <span className="font-semibold text-on-surface capitalize">{user.role}</span></li>
              <li>XP rank: <span className="font-semibold text-on-surface">{currentRank}</span></li>
              <li>Perks unlock through approved contributions, streak consistency, and reviewer-quality submissions.</li>
            </ul>
          </div>
        </>
      )}

      {activeTab === "referrals" && (
        <>
          <ReferralShareCard referralCode={referralCode} referralLink={referralLink} />
          <div className="card p-6">
            <h2 className="text-base font-semibold">Referral Progress</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              Share your invite link to earn XP and credits when referrals contribute approved content.
            </p>
          </div>
        </>
      )}

      {activeTab === "settings" && (
        <>
          <ProfileCoursePrefs />
          <div className="card p-6">
            <h2 className="text-base font-semibold mb-3">Account Actions</h2>
            <form action={signOut}>
              <button type="submit" className="btn text-sm px-4 py-2">Sign out</button>
            </form>
          </div>
        </>
      )}

    </section>
    </MainLayout>
  );
}
