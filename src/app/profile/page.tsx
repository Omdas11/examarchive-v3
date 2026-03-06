import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { adminDatabases, DATABASE_ID, COLLECTION } from "@/lib/appwrite";
import { signOut } from "@/app/auth/actions";
import ProfileEditor from "./ProfileEditor";
import { RoleBadge, TierBadge } from "@/components/RoleBadge";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your ExamArchive account profile.",
  robots: { index: false, follow: false },
};

function xpTitle(xp: number): string {
  if (xp >= 5000) return "Legend";
  if (xp >= 3000) return "Elite";
  if (xp >= 1500) return "Senior";
  if (xp >= 800) return "Veteran";
  if (xp >= 300) return "Contributor";
  if (xp >= 100) return "Explorer";
  return "Visitor";
}

const XP_TIERS = [0, 100, 300, 800, 1500, 3000, 5000];

function xpProgress(xp: number): { progress: number; next: number | null } {
  const currentIndex = XP_TIERS.reduce((acc, t, i) => (xp >= t ? i : acc), 0);
  const next = XP_TIERS[currentIndex + 1] ?? null;
  const prev = XP_TIERS[currentIndex];
  const progress = next ? Math.min(((xp - prev) / (next - prev)) * 100, 100) : 100;
  return { progress, next };
}

export default async function ProfilePage() {
  const user = await getServerUser();
  if (!user) redirect("/login?next=/profile");

  // Fetch username_last_changed for cooldown display
  let usernameLastChanged: string | null = null;
  try {
    const db = adminDatabases();
    const profile = await db.getDocument(DATABASE_ID, COLLECTION.users, user.id);
    usernameLastChanged = (profile.username_last_changed as string) ?? null;
  } catch {
    // ignore
  }

  const joinedDate = new Date(user.created_at).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const tier = (user.tier ?? "bronze") as import("@/types").UserTier;
  const { progress: xpPercent, next: xpNext } = xpProgress(user.xp);

  return (
    <section className="mx-auto px-4 py-10 space-y-5" style={{ maxWidth: "var(--max-w)" }}>

      {/* ── Profile hero card ── */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="flex-1 min-w-0">
            {/* Inline profile editor with pencil-avatar */}
            <ProfileEditor
              initialName={user.name}
              initialUsername={user.username}
              initialAvatarUrl={user.avatar_url}
              initialUsernameLastChanged={usernameLastChanged}
            />

            <div className="mt-3 flex flex-wrap gap-1.5 items-center">
              <RoleBadge role={user.role} />
              {user.secondary_role && <RoleBadge role={user.secondary_role} />}
              <TierBadge tier={tier} />
            </div>

            <p className="text-[11px] mt-1.5" style={{ color: "var(--color-text-muted)" }}>
              {user.email} · Member since {joinedDate}
            </p>
          </div>
        </div>

        <hr className="mt-5" style={{ borderColor: "var(--color-border)" }} />

        {/* Stats row */}
        <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg p-3" style={{ background: "var(--color-accent-soft)" }}>
            <dt className="text-[11px] mb-1" style={{ color: "var(--color-text-muted)" }}>XP</dt>
            <dd className="text-xl font-bold" style={{ color: "var(--color-primary)" }}>
              {user.xp.toLocaleString()}
            </dd>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>{xpTitle(user.xp)}</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: "var(--color-accent-soft)" }}>
            <dt className="text-[11px] mb-1" style={{ color: "var(--color-text-muted)" }}>Streak</dt>
            <dd className="text-xl font-bold">{user.streak_days}</dd>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>days</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: "var(--color-accent-soft)" }}>
            <dt className="text-[11px] mb-1" style={{ color: "var(--color-text-muted)" }}>Role</dt>
            <dd className="text-base font-semibold capitalize">{user.role}</dd>
          </div>
        </dl>
      </div>

      {/* ── XP Progress card ── */}
      <div className="card p-6">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-semibold">{user.xp} XP</span>
          <span style={{ color: "var(--color-text-muted)" }}>{xpTitle(user.xp)}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--color-border)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${xpPercent}%`, background: "var(--color-primary)" }}
          />
        </div>
        {xpNext && (
          <p className="mt-1.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
            {user.xp} / {xpNext} XP → {xpTitle(xpNext)}
          </p>
        )}

        {/* Streak + XP activity badges */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {user.streak_days >= 30 && (
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: "rgba(245,124,0,0.1)", color: "#e65100", border: "1px solid rgba(245,124,0,0.25)" }}>
              🔥 {user.streak_days}-day streak
            </span>
          )}
          {user.streak_days >= 7 && user.streak_days < 30 && (
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: "rgba(16,163,74,0.1)", color: "#065f46", border: "1px solid rgba(16,163,74,0.25)" }}>
              🔥 {user.streak_days}-day streak
            </span>
          )}
          {user.xp >= 100 && (
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: "rgba(211,47,47,0.08)", color: "var(--color-primary)", border: "1px solid rgba(211,47,47,0.2)" }}>
              ⚡ {user.xp} XP
            </span>
          )}
        </div>
      </div>

      {/* ── Achievements ── */}
      <div className="card p-6">
        <h2 className="text-base font-semibold mb-3">Achievements</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { slug: "first_upload", label: "First Upload", desc: "Submit your first paper", earned: user.xp >= 50, color: "#2e7d32", bg: "rgba(76,175,80,0.1)", border: "rgba(76,175,80,0.25)", icon: "📄" },
            { slug: "7_day_streak", label: "7-Day Streak", desc: "7 consecutive logins", earned: user.streak_days >= 7, color: "#c62828", bg: "rgba(244,67,54,0.1)", border: "rgba(244,67,54,0.25)", icon: "🔥" },
            { slug: "30_day_streak", label: "30-Day Streak", desc: "30 consecutive logins", earned: user.streak_days >= 30, color: "#a07818", bg: "rgba(210,160,20,0.1)", border: "rgba(210,160,20,0.3)", icon: "⭐" },
            { slug: "contributor", label: "Contributor", desc: "300+ XP earned", earned: user.xp >= 300, color: "#1565c0", bg: "rgba(25,118,210,0.1)", border: "rgba(25,118,210,0.25)", icon: "🏅" },
            { slug: "senior", label: "Senior", desc: "1500+ XP earned", earned: user.xp >= 1500, color: "#e65100", bg: "rgba(245,124,0,0.1)", border: "rgba(245,124,0,0.25)", icon: "��" },
            ...(user.role === "admin" || user.role === "moderator" || user.role === "founder"
              ? [{ slug: "staff", label: user.role.charAt(0).toUpperCase() + user.role.slice(1), desc: "Role badge", earned: true, color: user.role === "founder" ? "#7c3aed" : "var(--color-primary)", bg: user.role === "founder" ? "rgba(124,58,237,0.1)" : "rgba(211,47,47,0.08)", border: user.role === "founder" ? "rgba(124,58,237,0.25)" : "rgba(211,47,47,0.2)", icon: user.role === "founder" ? "👑" : "🛡️" }]
              : []),
          ].map((ach) => (
            <div
              key={ach.slug}
              className="flex flex-col items-center rounded-lg p-3 text-center"
              style={{
                background: ach.earned ? ach.bg : "var(--color-border)",
                border: `1px solid ${ach.earned ? ach.border : "transparent"}`,
                opacity: ach.earned ? 1 : 0.45,
              }}
            >
              <span className="text-2xl mb-1.5" aria-hidden="true">{ach.icon}</span>
              <p className="text-xs font-semibold" style={{ color: ach.earned ? ach.color : undefined }}>{ach.label}</p>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>{ach.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Account info (read-only) ── */}
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
