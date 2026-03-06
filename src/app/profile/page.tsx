import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { signOut } from "@/app/auth/actions";
import ProfileEditor from "./ProfileEditor";
import AvatarRing from "@/components/AvatarRing";
import { RoleBadge, TierBadge } from "@/components/RoleBadge";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your ExamArchive account profile.",
  robots: { index: false, follow: false },
};

/** XP title thresholds. */
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

function xpProgress(xp: number): { progress: number; next: number | null; prev: number } {
  const currentIndex = XP_TIERS.reduce((acc, t, i) => (xp >= t ? i : acc), 0);
  const next = XP_TIERS[currentIndex + 1] ?? null;
  const prev = XP_TIERS[currentIndex];
  const progress = next ? Math.min(((xp - prev) / (next - prev)) * 100, 100) : 100;
  return { progress, next, prev };
}

export default async function ProfilePage() {
  const user = await getServerUser();

  if (!user) {
    redirect("/login?next=/profile");
  }

  const joinedDate = new Date(user.created_at).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const displayName = user.name || user.username || user.email;
  const tier = (user.tier ?? "bronze") as import("@/types").UserTier;
  const { progress: xpPercent, next: xpNext } = xpProgress(user.xp);

  return (
    <section
      className="mx-auto px-4 py-10 space-y-6"
      style={{ maxWidth: "var(--max-w)" }}
    >
      {/* ── Profile hero card ── */}
      <div className="card p-6">
        {/* Avatar + identity */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="shrink-0">
            <AvatarRing
              displayName={displayName}
              avatarUrl={user.avatar_url || undefined}
              streakDays={user.streak_days}
              role={user.role}
              size={80}
            />
          </div>
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <h1 className="text-2xl font-bold">
              {user.name || <span style={{ color: "var(--color-text-muted)" }}>No display name</span>}
            </h1>
            {user.username && (
              <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                @{user.username}
              </p>
            )}
            <p className="text-sm mt-0.5 truncate" style={{ color: "var(--color-text-muted)" }}>
              {user.email}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              Member since {joinedDate}
            </p>

            {/* Role + tier badges */}
            <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
              <RoleBadge role={user.role} />
              {user.secondary_role && <RoleBadge role={user.secondary_role} />}
              <TierBadge tier={tier} />
            </div>
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
            <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              {xpTitle(user.xp)}
            </p>
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
        <h2 className="text-base font-semibold mb-3">XP Progress</h2>
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="font-medium">{user.xp} XP</span>
          <span style={{ color: "var(--color-text-muted)" }}>{xpTitle(user.xp)}</span>
        </div>
        <div
          className="h-2.5 w-full overflow-hidden rounded-full"
          style={{ background: "var(--color-border)" }}
        >
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

        {/* Activity badges */}
        <div className="mt-4 flex flex-wrap gap-2">
          {user.streak_days >= 30 && (
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: "#fef3c7", color: "#92400e" }}>
              🔥 30-day streak
            </span>
          )}
          {user.streak_days >= 7 && user.streak_days < 30 && (
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: "#dcfce7", color: "#166534" }}>
              🔥 {user.streak_days}-day streak
            </span>
          )}
          {user.streak_days > 0 && user.streak_days < 7 && (
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: "#dbeafe", color: "#1e40af" }}>
              🔥 {user.streak_days}-day streak
            </span>
          )}
          {user.xp >= 100 && (
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ background: "var(--color-accent-soft)", color: "var(--color-primary)" }}>
              ⚡ {user.xp} XP
            </span>
          )}
        </div>
      </div>

      {/* ── Achievements card ── */}
      <div className="card p-6">
        <h2 className="text-base font-semibold mb-3">Achievements</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* Activity-earned badges */}
          <div
            className="flex flex-col items-center rounded-lg p-3 text-center"
            style={{
              background: user.xp >= 50 ? "var(--color-accent-soft)" : "var(--color-border)",
              opacity: user.xp >= 50 ? 1 : 0.45,
            }}
          >
            <span className="text-2xl mb-1">📄</span>
            <p className="text-xs font-semibold">First Upload</p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>Submit your first paper</p>
          </div>
          <div
            className="flex flex-col items-center rounded-lg p-3 text-center"
            style={{
              background: user.streak_days >= 7 ? "#dcfce7" : "var(--color-border)",
              opacity: user.streak_days >= 7 ? 1 : 0.45,
            }}
          >
            <span className="text-2xl mb-1">🔥</span>
            <p className="text-xs font-semibold">7-Day Streak</p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>7 consecutive logins</p>
          </div>
          <div
            className="flex flex-col items-center rounded-lg p-3 text-center"
            style={{
              background: user.streak_days >= 30 ? "#fef3c7" : "var(--color-border)",
              opacity: user.streak_days >= 30 ? 1 : 0.45,
            }}
          >
            <span className="text-2xl mb-1">⭐</span>
            <p className="text-xs font-semibold">30-Day Streak</p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>30 consecutive logins</p>
          </div>
          <div
            className="flex flex-col items-center rounded-lg p-3 text-center"
            style={{
              background: user.xp >= 300 ? "var(--color-accent-soft)" : "var(--color-border)",
              opacity: user.xp >= 300 ? 1 : 0.45,
            }}
          >
            <span className="text-2xl mb-1">🏅</span>
            <p className="text-xs font-semibold">Contributor</p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>300+ XP earned</p>
          </div>
          <div
            className="flex flex-col items-center rounded-lg p-3 text-center"
            style={{
              background: user.xp >= 1500 ? "#fef3c7" : "var(--color-border)",
              opacity: user.xp >= 1500 ? 1 : 0.45,
            }}
          >
            <span className="text-2xl mb-1">🥇</span>
            <p className="text-xs font-semibold">Senior</p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>1500+ XP earned</p>
          </div>
          {/* Role-cosmetic badge */}
          {(user.role === "admin" || user.role === "moderator" || user.role === "founder") && (
            <div
              className="flex flex-col items-center rounded-lg p-3 text-center"
              style={{ background: user.role === "founder" ? "#ede9fe" : "var(--color-accent-soft)" }}
            >
              <span className="text-2xl mb-1">{user.role === "founder" ? "👑" : "🛡️"}</span>
              <p className="text-xs font-semibold capitalize">{user.role}</p>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>Role badge</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Profile editor ── */}
      <ProfileEditor
        initialName={user.name}
        initialUsername={user.username}
        initialAvatarUrl={user.avatar_url}
      />

      {/* ── Account info (read-only) ── */}
      <div className="card p-6 space-y-3">
        <h2 className="text-base font-semibold">Account Info</h2>
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
            <dd
              className="font-mono text-xs truncate max-w-[200px]"
              title={user.id}
            >
              {user.id}
            </dd>
          </div>
        </dl>
      </div>

      {/* Sign out */}
      <div>
        <form action={signOut}>
          <button type="submit" className="btn text-sm px-4 py-2">
            Sign out
          </button>
        </form>
      </div>
    </section>
  );
}
