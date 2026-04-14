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
  xo: number;
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

function xoRank(xo: number): string {
  if (xo >= 5000) return "Legend";
  if (xo >= 3000) return "Elite";
  if (xo >= 1500) return "Senior";
  if (xo >= 800) return "Veteran";
  if (xo >= 300) return "Contributor";
  if (xo >= 100) return "Explorer";
  return "Visitor";
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
  const xoScore = profile?.xo ?? profile?.xp ?? 0;
  const rank = xoRank(xoScore);
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
            <div className="flex justify-between gap-2">
              <dt className="text-on-surface-variant">Member since</dt>
              <dd className="font-medium">{joinedDate}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-on-surface-variant">Email</dt>
              <dd className="font-medium truncate max-w-[165px]" title={profile?.email ?? ""}>
                {profile?.email ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-on-surface-variant">User ID</dt>
              <dd className="font-mono text-[10px] truncate max-w-[165px]" title={profile?.id ?? ""}>
                {profile?.id ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-on-surface-variant">Role</dt>
              <dd className="font-medium">{displayRole}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-on-surface-variant">Rank</dt>
              <dd className="font-medium">{rank}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-on-surface-variant">Tier</dt>
              <dd className="font-medium capitalize">{profile?.tier ?? "bronze"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-on-surface-variant">XO</dt>
              <dd className="font-medium">{xoScore}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-on-surface-variant">Uploads</dt>
              <dd className="font-medium">{profile?.total_uploads ?? 0}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-on-surface-variant">Approved</dt>
              <dd className="font-medium">{profile?.approved_upload_count ?? profile?.approved_count ?? 0}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-on-surface-variant">Approval</dt>
              <dd className="font-medium">{profile?.approval_pct ?? 0}%</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-on-surface-variant">Streak</dt>
              <dd className="font-medium">{streakDays}d</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-on-surface-variant">Electrons</dt>
              <dd className="font-medium">{profile?.ai_credits ?? 0}</dd>
            </div>
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
