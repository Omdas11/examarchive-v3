"use client";

import Link from "next/link";
import { useMemo } from "react";
import AvatarRing from "@/components/AvatarRing";
import { normalizeRole, roleLabel } from "@/lib/roles";

export interface SidebarProfileResponse {
  id: string;
  email: string;
  name: string;
  username: string;
  avatar_url: string;
  role: string;
  tier: string;
  xp: number;
  streak_days: number;
  created_at: string;
  approved_upload_count: number;
  approved_count: number;
  total_uploads: number;
  approval_pct: number;
  ai_credits: number;
}

interface RightSidebarProps {
  userName?: string;
  userInitials?: string;
  isLoggedIn?: boolean;
  profileData?: SidebarProfileResponse | null;
}

function xpRank(xp: number): string {
  if (xp >= 5000) return "Legend";
  if (xp >= 3000) return "Elite";
  if (xp >= 1500) return "Senior";
  if (xp >= 800) return "Veteran";
  if (xp >= 300) return "Contributor";
  if (xp >= 100) return "Explorer";
  return "Visitor";
}

/** Reusable key-value row for the profile stats list. */
function StatRow({
  label,
  value,
  title,
  truncate,
  mono,
  capitalize,
}: {
  label: string;
  value: string | number;
  title?: string;
  truncate?: boolean;
  mono?: boolean;
  capitalize?: boolean;
}) {
  const ddClass = [
    "font-medium",
    truncate && "truncate max-w-[165px]",
    mono && "font-mono text-[10px]",
    capitalize && "capitalize",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex justify-between gap-2">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className={ddClass} title={title}>
        {value}
      </dd>
    </div>
  );
}

export default function RightSidebar({
  userName = "Guest",
  userInitials = "GU",
  isLoggedIn = false,
  profileData = null,
}: RightSidebarProps) {
  const profile = profileData;

  const joinedDate = useMemo(() => {
    if (!profile?.created_at) return "—";
    return new Date(profile.created_at).toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
    });
  }, [profile?.created_at]);

  const displayName = profile?.name || profile?.username || userName || "Guest";
  const username = profile?.username ? `@${profile.username}` : null;
  const displayRole = roleLabel(profile?.role);
  const normalizedRole = normalizeRole(profile?.role);
  const xpScore = profile?.xp ?? 0;
  const rank = xpRank(xpScore);
  const streakDays = profile?.streak_days ?? 0;

  return (
    <div className="space-y-4 min-h-full">
      <div className="card p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Profile</p>
        <div className="mt-3 flex items-center gap-3">
          {profile ? (
            <AvatarRing
              displayName={displayName}
              avatarUrl={profile.avatar_url || undefined}
              streakDays={streakDays}
              role={normalizedRole}
              size={40}
            />
          ) : (
            <div className="h-10 w-10 rounded-full gradient-primary text-on-primary font-bold flex items-center justify-center">
              {userInitials}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{displayName}</p>
            {username ? (
              <p className="text-xs text-on-surface-variant truncate">{username}</p>
            ) : (
              <p className="text-xs text-on-surface-variant">{isLoggedIn ? "Scholar" : "Guest"}</p>
            )}
          </div>
        </div>

        {isLoggedIn && (
          <dl className="mt-4 space-y-1.5 text-xs">
            <StatRow label="Member since" value={joinedDate} />
            <StatRow label="Email" value={profile?.email ?? "—"} title={profile?.email ?? ""} truncate />
            <StatRow label="User ID" value={profile?.id ?? "—"} title={profile?.id ?? ""} mono truncate />
            <StatRow label="Role" value={displayRole} />
            <StatRow label="Rank" value={rank} />
            <StatRow label="Tier" value={profile?.tier ?? "bronze"} capitalize />
            <StatRow label="XP" value={xpScore} />
            <StatRow label="Uploads" value={profile?.total_uploads ?? 0} />
            <StatRow label="Approved" value={profile?.approved_upload_count ?? profile?.approved_count ?? 0} />
            <StatRow label="Approval" value={`${profile?.approval_pct ?? 0}%`} />
            <StatRow label="Streak" value={`${streakDays}d`} />
            <StatRow label="Credits" value={profile?.ai_credits ?? 0} />
          </dl>
        )}

        <Link
          href="/profile"
          className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-surface-container px-3 py-2 text-sm text-on-surface transition-colors hover:bg-surface-container-high"
        >
          Open Profile
        </Link>
      </div>

      <div className="card p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Quick Access</p>
        <div className="mt-3 space-y-2 text-sm">
          <Link href="/upload" className="block rounded-lg px-3 py-2 hover:bg-surface-container-low transition-colors">
            Upload Question Paper
          </Link>
          <Link href="/browse" className="block rounded-lg px-3 py-2 hover:bg-surface-container-low transition-colors">
            Browse
          </Link>
          <Link href="/syllabus" className="block rounded-lg px-3 py-2 hover:bg-surface-container-low transition-colors">
            Syllabus
          </Link>
        </div>
      </div>
    </div>
  );
}
