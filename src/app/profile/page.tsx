import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import { signOut } from "@/app/auth/actions";
import ProfileEditor from "./ProfileEditor";
import AvatarRing from "@/components/AvatarRing";
import { RoleBadge } from "@/components/RoleBadge";

export const metadata: Metadata = {
  title: "Profile",
  description: "Your ExamArchive account profile.",
  robots: { index: false, follow: false },
};

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

  return (
    <section
      className="mx-auto px-4 py-10"
      style={{ maxWidth: "var(--max-w)" }}
    >
      <h1 className="text-2xl font-bold">Your Profile</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
        Account details, display name, and avatar.
      </p>

      {/* Profile summary card */}
      <div className="card mt-6 p-6 space-y-4">
        <div className="flex items-center gap-4">
          <AvatarRing
            displayName={displayName}
            avatarUrl={user.avatar_url || undefined}
            streakDays={user.streak_days}
            size={56}
          />
          <div>
            {user.name && (
              <p className="font-semibold text-base">{user.name}</p>
            )}
            {user.username && (
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                @{user.username}
              </p>
            )}
            <p
              className="text-sm truncate"
              style={{ color: user.name ? "var(--color-text-muted)" : undefined }}
            >
              {user.email}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
              Member since {joinedDate}
            </p>
          </div>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap gap-2 items-center">
          <RoleBadge role={user.role} />
          {user.streak_days > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{
                background:
                  user.streak_days >= 30
                    ? "#fef3c7"
                    : user.streak_days >= 7
                      ? "#dcfce7"
                      : "#dbeafe",
                color:
                  user.streak_days >= 30
                    ? "#92400e"
                    : user.streak_days >= 7
                      ? "#166534"
                      : "#1e40af",
              }}
            >
              🔥 {user.streak_days}-day streak
            </span>
          )}
          {user.xp > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{
                background: "var(--color-accent-soft)",
                color: "var(--color-primary)",
              }}
            >
              ⚡ {user.xp} XP
            </span>
          )}
        </div>

        <hr style={{ borderColor: "var(--color-border)" }} />

        {/* Quick stats */}
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm text-center">
          <div>
            <dt className="text-xs" style={{ color: "var(--color-text-muted)" }}>XP</dt>
            <dd
              className="font-bold text-lg"
              style={{ color: "var(--color-primary)" }}
            >
              {user.xp}
            </dd>
          </div>
          <div>
            <dt className="text-xs" style={{ color: "var(--color-text-muted)" }}>Streak</dt>
            <dd className="font-bold text-lg">{user.streak_days}d</dd>
          </div>
          <div className="hidden sm:block">
            <dt className="text-xs" style={{ color: "var(--color-text-muted)" }}>Role</dt>
            <dd className="font-semibold capitalize">{user.role}</dd>
          </div>
        </dl>
      </div>

      {/* Profile editor */}
      <ProfileEditor
        userId={user.id}
        initialName={user.name}
        initialUsername={user.username}
        initialAvatarUrl={user.avatar_url}
      />

      {/* Account info (read-only) */}
      <div className="card mt-6 p-6 space-y-3">
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
      <div className="mt-6">
        <form action={signOut}>
          <button type="submit" className="btn text-sm px-4 py-2">
            Sign out
          </button>
        </form>
      </div>
    </section>
  );
}
