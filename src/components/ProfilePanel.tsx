"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import type { UserProfile } from "@/types";
import AvatarRing from "./AvatarRing";
import { RoleBadge, TierBadge } from "./RoleBadge";

interface ProfilePanelProps {
  user: UserProfile;
  open: boolean;
  onClose: () => void;
}

/** Derive the XP tier label from xp value. */
function xpTitle(xp: number): string {
  if (xp >= 5000) return "Legend";
  if (xp >= 3000) return "Elite";
  if (xp >= 1500) return "Senior";
  if (xp >= 800) return "Veteran";
  if (xp >= 300) return "Contributor";
  if (xp >= 100) return "Explorer";
  return "Visitor";
}

/** Simple XP progress bar – fills between current tier and next tier. */
function XpBar({ xp }: { xp: number }) {
  const tiers = [0, 100, 300, 800, 1500, 3000, 5000];
  const currentIndex = tiers.findLastIndex((t) => xp >= t);
  const next = tiers[currentIndex + 1];
  const prev = tiers[currentIndex];
  const progress = next ? Math.min(((xp - prev) / (next - prev)) * 100, 100) : 100;

  return (
    <div className="mt-1">
      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: "var(--color-border)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progress}%`,
            background: "var(--color-primary)",
          }}
        />
      </div>
      {next && (
        <p className="mt-0.5 text-[10px]" style={{ color: "var(--color-text-muted)" }}>
          {xp} / {next} XP → {xpTitle(next)}
        </p>
      )}
    </div>
  );
}

/** Render a single streak flame icon with count. */
function StreakBadge({ days }: { days: number }) {
  const color =
    days >= 30 ? "#f59e0b" : days >= 7 ? "#22c55e" : days >= 1 ? "#3b82f6" : "var(--color-text-muted)";

  return (
    <div className="flex items-center gap-1.5">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={days > 0 ? color : "none"}
        stroke={color}
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
        <path
          fill={days > 0 ? color : "none"}
          d="M13.5 6.5c0 2-1.5 3.5-1.5 5-.5-1.5-2-3-2-5a3.5 3.5 0 0 1 3.5-3.5A3.5 3.5 0 0 1 17 6.5c0 2-1.5 3.5-1.5 5-.5-1.5-2-3-2-5z"
        />
      </svg>
      <span className="text-sm font-semibold" style={{ color }}>
        {days} day{days !== 1 ? "s" : ""} streak
      </span>
    </div>
  );
}

export default function ProfilePanel({ user, open, onClose }: ProfilePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const displayName = user.name || user.username || user.email;
  const roleForBadge = user.role as "student" | "moderator" | "admin";
  // tier defaults to bronze if not available on UserProfile
  const tier = "bronze" as const;

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-[80] bg-black/40 transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — slides in from right */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Profile panel"
        className={`fixed inset-y-0 right-0 z-[90] flex w-72 max-w-[85vw] flex-col shadow-2xl transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{
          background: "var(--color-surface)",
          borderLeft: "1px solid var(--color-border)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <span className="text-sm font-semibold">Profile</span>
          <button
            onClick={onClose}
            aria-label="Close profile panel"
            className="p-1.5 rounded-md opacity-60 hover:opacity-100 transition-opacity"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Avatar + name */}
          <div className="flex flex-col items-center gap-3 text-center">
            <AvatarRing
              displayName={displayName}
              avatarUrl={user.avatar_url || undefined}
              streakDays={user.streak_days}
              size={64}
            />
            {user.name && (
              <p className="text-base font-bold leading-tight">{user.name}</p>
            )}
            {user.username && (
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                @{user.username}
              </p>
            )}
            {!user.name && !user.username && (
              <p className="text-sm font-medium truncate">{user.email}</p>
            )}
          </div>

          {/* Role + tier badges */}
          <div className="flex flex-wrap justify-center gap-2">
            <RoleBadge role={roleForBadge} />
            <TierBadge tier={tier} />
          </div>

          <hr style={{ borderColor: "var(--color-border)" }} />

          {/* XP */}
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">XP</span>
              <span style={{ color: "var(--color-text-muted)" }}>
                {user.xp} — {xpTitle(user.xp)}
              </span>
            </div>
            <XpBar xp={user.xp} />
          </div>

          {/* Streak */}
          <StreakBadge days={user.streak_days} />

          <hr style={{ borderColor: "var(--color-border)" }} />

          {/* Quick links */}
          <nav className="flex flex-col gap-0.5" aria-label="Profile navigation">
            <Link
              href="/profile"
              onClick={onClose}
              className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:opacity-70"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Edit Profile
            </Link>
            <Link
              href="/settings"
              onClick={onClose}
              className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:opacity-70"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Settings
            </Link>
            {(user.role === "admin" || user.role === "moderator") && (
              <Link
                href="/admin"
                onClick={onClose}
                className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:opacity-70"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Admin Dashboard
              </Link>
            )}
          </nav>
        </div>

        {/* Footer – sign out */}
        <div
          className="px-5 py-4"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <form action={signOut}>
            <button
              type="submit"
              className="w-full btn text-sm"
              onClick={onClose}
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
