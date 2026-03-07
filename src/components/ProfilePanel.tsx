"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

/** XP tier thresholds. */
const XP_TIERS = [0, 100, 300, 800, 1500, 3000, 5000];

/** XP progress bar that fills between current tier and next tier. */
function XpBar({ xp }: { xp: number }) {
  const currentIndex = XP_TIERS.reduce((acc, t, i) => (xp >= t ? i : acc), 0);
  const next = XP_TIERS[currentIndex + 1];
  const prev = XP_TIERS[currentIndex];
  const progress = next ? Math.min(((xp - prev) / (next - prev)) * 100, 100) : 100;

  return (
    <div className="mt-1">
      <div
        className="h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: "var(--color-border)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progress}%`, background: "var(--color-primary)" }}
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

/**
 * 7-day circular activity tracker.
 * Shows a row of 7 circles (Sun → Sat, where today is always the last circle shown).
 */
function WeeklyActivityTracker({ streakDays }: { streakDays: number }) {
  const today = new Date();
  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

  // Build last-7-days array: most recent day last (index 6 = today)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const dayOfWeek = d.getDay(); // 0=Sun
    const isActive = streakDays > 0 && 6 - i < streakDays;
    return { label: dayLabels[dayOfWeek], isToday: i === 6, isActive };
  });

  return (
    <div>
      <p className="mb-2 text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
        7-Day Activity
      </p>
      <div className="flex items-center justify-between gap-1">
        {days.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold transition-all"
              style={{
                background: d.isActive
                  ? "var(--color-primary)"
                  : d.isToday
                  ? "var(--color-accent-soft)"
                  : "var(--color-border)",
                color: d.isActive
                  ? "#fff"
                  : d.isToday
                  ? "var(--color-primary)"
                  : "var(--color-text-muted)",
                outline: d.isToday ? "2px solid var(--color-primary)" : "none",
                outlineOffset: "2px",
              }}
              aria-label={d.isActive ? "Active" : "Inactive"}
            >
              {d.isActive ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
              ) : (
                d.label
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Streak flame badge */
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
        stroke={days > 0 ? "none" : color}
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path
          fill={days > 0 ? color : "none"}
          d="M12 2c0 0-5 4-5 10a5 5 0 0 0 10 0c0-3-2-5-2-5s-1 2-2 2c-1.5 0-2-2-2-4 0 0-2 3-2 5a3 3 0 0 0 6 0c0-1.5-1-3-1-3s1 1.5 1 3a2 2 0 0 1-4 0c0-1.5 1-3 1-3z"
        />
      </svg>
      <span className="text-sm font-semibold" style={{ color }}>
        {days} day{days !== 1 ? "s" : ""} streak
      </span>
    </div>
  );
}

/** Stats row */
function StatsPanel({ xp, streakDays }: { xp: number; streakDays: number }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div
        className="rounded-lg p-3 text-center"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <p className="text-lg font-bold" style={{ color: "var(--color-primary)" }}>
          {xp}
        </p>
        <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
          Total XP
        </p>
      </div>
      <div
        className="rounded-lg p-3 text-center"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <p className="text-lg font-bold" style={{ color: "var(--color-primary)" }}>
          {streakDays}
        </p>
        <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
          Day Streak
        </p>
      </div>
    </div>
  );
}

export default function ProfilePanel({ user, open, onClose }: ProfilePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Close when route changes
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const displayName = user.name || user.username || user.email;
  const roleForBadge = user.role as import("@/types").UserRole;
  const tier = (user.tier ?? "bronze") as import("@/types").UserTier;

  const navItems = [
    {
      href: "/profile",
      label: "Edit Profile",
      icon: (
        <path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" strokeLinecap="round" strokeLinejoin="round" />
      ),
    },
    {
      href: "/settings",
      label: "Settings",
      icon: (
        <>
          <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ),
    },
  ];

  if (user.role === "admin" || user.role === "moderator" || user.role === "founder") {
    navItems.push({
      href: "/admin",
      label: "Admin Dashboard",
      icon: (
        <path d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" strokeLinecap="round" strokeLinejoin="round" />
      ),
    });
    navItems.push({
      href: "/admin/users",
      label: "User Management",
      icon: (
        <path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" strokeLinecap="round" strokeLinejoin="round" />
      ),
    });
  }

  if (user.role === "founder") {
    navItems.push({
      href: "/devtool",
      label: "DevTool",
      icon: (
        <path d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z" strokeLinecap="round" strokeLinejoin="round" />
      ),
    });
  }

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
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {/* Avatar + name */}
          <div className="flex flex-col items-center gap-3 text-center">
            <AvatarRing
              displayName={displayName}
              avatarUrl={user.avatar_url || undefined}
              streakDays={user.streak_days}
              role={user.role}
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
            {user.secondary_role && <RoleBadge role={user.secondary_role} />}
            <TierBadge tier={tier} />
          </div>

          {/* Member since */}
          {user.created_at && (
            <p className="text-center text-[11px]" style={{ color: "var(--color-text-muted)" }}>
              Member since{" "}
              {new Date(user.created_at).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </p>
          )}

          <hr style={{ borderColor: "var(--color-border)" }} />

          {/* Stats panel */}
          <StatsPanel xp={user.xp} streakDays={user.streak_days} />

          {/* XP progress */}
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">XP</span>
              <span style={{ color: "var(--color-text-muted)" }}>
                {xpTitle(user.xp)}
              </span>
            </div>
            <XpBar xp={user.xp} />
          </div>

          {/* Streak badge */}
          <StreakBadge days={user.streak_days} />

          {/* 7-day activity tracker */}
          <WeeklyActivityTracker streakDays={user.streak_days} />

          <hr style={{ borderColor: "var(--color-border)" }} />

          {/* Quick links */}
          <nav className="flex flex-col gap-0.5" aria-label="Profile navigation">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors"
                  style={
                    active
                      ? { color: "var(--color-primary)", background: "var(--color-accent-soft)", fontWeight: 700 }
                      : undefined
                  }
                  aria-current={active ? "page" : undefined}
                >
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                    {item.icon}
                  </svg>
                  {item.label}
                </Link>
              );
            })}
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
