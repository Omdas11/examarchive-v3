"use client";

import type { ReactNode } from "react";
import type { UserRole, CustomRole, UserTier } from "@/types";

// ── SVG icon helpers ────────────────────────────────────────────────────────

/** Thin wrapper so we don't repeat svg boilerplate on every badge. */
function Icon({ children, size = 12 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {children}
    </svg>
  );
}

const BadgeIcons: Record<string, ReactNode> = {
  first_upload: (
    <Icon>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </Icon>
  ),
  "10_uploads": (
    <Icon>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </Icon>
  ),
  explorer: (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </Icon>
  ),
  contributor_badge: (
    <Icon>
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </Icon>
  ),
  veteran: (
    <Icon>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </Icon>
  ),
  senior: (
    <Icon>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </Icon>
  ),
  "7_day_streak": (
    <Icon>
      <path d="M12 2c0 0-5 3-5 8a5 5 0 0 0 10 0c0-2.5-1.5-4-1.5-4s-.5 1.5-1.5 1.5c-1 0-1.5-1.5-2-3z" />
    </Icon>
  ),
  "30_day_streak": (
    <Icon>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </Icon>
  ),
  silver_tier: (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4l3 3" />
    </Icon>
  ),
  gold_tier: (
    <Icon>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
    </Icon>
  ),
  role_founder: (
    <Icon>
      <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
    </Icon>
  ),
  role_admin: (
    <Icon>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </Icon>
  ),
  role_moderator: (
    <Icon>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </Icon>
  ),
  role_secondary: (
    <Icon>
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </Icon>
  ),
  role_tertiary: (
    <Icon>
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </Icon>
  ),
};

/** Tier level map for comparison. */
const TIER_LEVELS: Record<UserTier, number> = {
  bronze: 0,
  silver: 1,
  gold: 2,
  platinum: 3,
  diamond: 4,
};

/** Returns true if `tier` meets or exceeds `minTier`. */
function hasTierOrAbove(tier: UserTier | undefined, minTier: UserTier): boolean {
  if (!tier) return false;
  return (TIER_LEVELS[tier] ?? 0) >= TIER_LEVELS[minTier];
}

export interface BadgeData {
  slug: string;
  label: string;
  description: string;
  type: "activity" | "role";
  earned: boolean;
  accentColor?: string;
}

/** Build the list of badges for a given user profile. */
export function buildBadges({
  role,
  secondary_role,
  tertiary_role,
  tier,
  xp,
  streak_days,
  upload_count,
}: {
  role: UserRole;
  secondary_role?: CustomRole;
  tertiary_role?: CustomRole;
  tier?: UserTier;
  xp: number;
  streak_days: number;
  upload_count?: number;
}): BadgeData[] {
  const badges: BadgeData[] = [
    // ── Activity-earned badges ────────────────────────────────
    {
      slug: "first_upload",
      label: "First Upload",
      description: "Submitted your first exam paper.",
      type: "activity",
      earned: xp >= 50 || (upload_count ?? 0) >= 1,
    },
    {
      slug: "10_uploads",
      label: "10 Uploads",
      description: "Had 10 papers approved.",
      type: "activity",
      earned: (upload_count ?? 0) >= 10,
    },
    {
      slug: "explorer",
      label: "Explorer",
      description: "Reached 100 XP.",
      type: "activity",
      earned: xp >= 100,
    },
    {
      slug: "contributor_badge",
      label: "Contributor",
      description: "Reached 300 XP.",
      type: "activity",
      earned: xp >= 300,
      accentColor: "#1565c0",
    },
    {
      slug: "veteran",
      label: "Veteran",
      description: "Reached 800 XP.",
      type: "activity",
      earned: xp >= 800,
      accentColor: "#6a1b9a",
    },
    {
      slug: "senior",
      label: "Senior",
      description: "Reached 1500 XP.",
      type: "activity",
      earned: xp >= 1500,
      accentColor: "#e65100",
    },
    {
      slug: "7_day_streak",
      label: "7-Day Streak",
      description: "Logged in 7 days in a row.",
      type: "activity",
      earned: streak_days >= 7,
    },
    {
      slug: "30_day_streak",
      label: "30-Day Streak",
      description: "Logged in 30 days in a row.",
      type: "activity",
      earned: streak_days >= 30,
      accentColor: "#b45309",
    },
    {
      slug: "silver_tier",
      label: "Silver Tier",
      description: "Reached Silver activity tier.",
      type: "activity",
      earned: hasTierOrAbove(tier, "silver"),
      accentColor: "#64748b",
    },
    {
      slug: "gold_tier",
      label: "Gold Tier",
      description: "Reached Gold activity tier.",
      type: "activity",
      earned: hasTierOrAbove(tier, "gold"),
      accentColor: "#92400e",
    },

    // ── Role-cosmetic badges ──────────────────────────────────
    {
      slug: "role_founder",
      label: "Founder",
      description: "Founder of ExamArchive.",
      type: "role",
      earned: role === "founder",
      accentColor: "#7c3aed",
    },
    {
      slug: "role_admin",
      label: "Admin",
      description: "Platform administrator.",
      type: "role",
      earned: role === "admin",
      accentColor: "#b91c1c",
    },
    {
      slug: "role_moderator",
      label: "Moderator",
      description: "Content moderator.",
      type: "role",
      earned: role === "moderator",
      accentColor: "#c2410c",
    },
    ...(secondary_role
      ? [
          {
            slug: `role_secondary_${secondary_role}`,
            label: secondary_role.charAt(0).toUpperCase() + secondary_role.slice(1),
            description: `Community role: ${secondary_role}.`,
            type: "role" as const,
            earned: true,
            accentColor: "#047857",
          },
        ]
      : []),
    ...(tertiary_role
      ? [
          {
            slug: `role_tertiary_${tertiary_role}`,
            label: tertiary_role.charAt(0).toUpperCase() + tertiary_role.slice(1),
            description: `Community role: ${tertiary_role}.`,
            type: "role" as const,
            earned: true,
            accentColor: "#4338ca",
          },
        ]
      : []),
  ];

  return badges;
}

/** Resolve the SVG icon for a badge slug.  Falls back to a generic award icon. */
function getBadgeIcon(slug: string): ReactNode {
  // secondary/tertiary role slugs share a common icon
  const key = slug.startsWith("role_secondary")
    ? "role_secondary"
    : slug.startsWith("role_tertiary")
    ? "role_tertiary"
    : slug;
  return BadgeIcons[key] ?? BadgeIcons["contributor_badge"];
}

interface BadgeDisplayProps {
  badges: BadgeData[];
  /** When true, shows all badges (earned and unearned). Default: show only earned. */
  showAll?: boolean;
}

/** Displays a grid of achievement and role-cosmetic badges. */
export default function BadgeDisplay({ badges, showAll = false }: BadgeDisplayProps) {
  const displayed = showAll ? badges : badges.filter((b) => b.earned);

  if (displayed.length === 0) {
    return (
      <p className="text-sm text-center py-4" style={{ color: "var(--color-text-muted)" }}>
        No badges yet. Keep contributing!
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {displayed.map((badge) => {
        const accent = badge.accentColor ?? "var(--color-primary)";
        return (
          <div
            key={badge.slug}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
            style={{
              background: "var(--color-border)",
              color: badge.earned ? accent : "var(--color-text-muted)",
              border: `1px solid transparent`,
              opacity: badge.earned ? 1 : 0.45,
            }}
            title={badge.description}
          >
            {getBadgeIcon(badge.slug)}
            <span>{badge.label}</span>
          </div>
        );
      })}
    </div>
  );
}
