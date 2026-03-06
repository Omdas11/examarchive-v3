"use client";

import type { UserRole, CustomRole, UserTier } from "@/types";

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
  icon: string;
  type: "activity" | "role";
  earned: boolean;
  color?: string;
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
      icon: "📄",
      type: "activity",
      earned: xp >= 50 || (upload_count ?? 0) >= 1,
    },
    {
      slug: "10_uploads",
      label: "10 Uploads",
      description: "Had 10 papers approved.",
      icon: "📚",
      type: "activity",
      earned: (upload_count ?? 0) >= 10,
    },
    {
      slug: "explorer",
      label: "Explorer",
      description: "Reached 100 XP.",
      icon: "🔭",
      type: "activity",
      earned: xp >= 100,
    },
    {
      slug: "contributor_badge",
      label: "Contributor",
      description: "Reached 300 XP.",
      icon: "🏅",
      type: "activity",
      earned: xp >= 300,
      color: "#1565c0",
    },
    {
      slug: "veteran",
      label: "Veteran",
      description: "Reached 800 XP.",
      icon: "🥈",
      type: "activity",
      earned: xp >= 800,
      color: "#6a1b9a",
    },
    {
      slug: "senior",
      label: "Senior",
      description: "Reached 1500 XP.",
      icon: "🥇",
      type: "activity",
      earned: xp >= 1500,
      color: "#e65100",
    },
    {
      slug: "7_day_streak",
      label: "7-Day Streak",
      description: "Logged in 7 days in a row.",
      icon: "🔥",
      type: "activity",
      earned: streak_days >= 7,
    },
    {
      slug: "30_day_streak",
      label: "30-Day Streak",
      description: "Logged in 30 days in a row.",
      icon: "⭐",
      type: "activity",
      earned: streak_days >= 30,
      color: "#f59e0b",
    },
    {
      slug: "silver_tier",
      label: "Silver Tier",
      description: "Reached Silver activity tier.",
      icon: "🥈",
      type: "activity",
      earned: hasTierOrAbove(tier, "silver"),
      color: "#c0c0c0",
    },
    {
      slug: "gold_tier",
      label: "Gold Tier",
      description: "Reached Gold activity tier.",
      icon: "🥇",
      type: "activity",
      earned: hasTierOrAbove(tier, "gold"),
      color: "#ffd700",
    },

    // ── Role-cosmetic badges ──────────────────────────────────
    {
      slug: "role_founder",
      label: "Founder",
      description: "Founder of ExamArchive.",
      icon: "👑",
      type: "role",
      earned: role === "founder",
      color: "#7c3aed",
    },
    {
      slug: "role_admin",
      label: "Admin",
      description: "Platform administrator.",
      icon: "🛡️",
      type: "role",
      earned: role === "admin",
      color: "#d32f2f",
    },
    {
      slug: "role_moderator",
      label: "Moderator",
      description: "Content moderator.",
      icon: "⚖️",
      type: "role",
      earned: role === "moderator",
      color: "#e65100",
    },
    ...(secondary_role
      ? [
          {
            slug: `role_secondary_${secondary_role}`,
            label: secondary_role.charAt(0).toUpperCase() + secondary_role.slice(1),
            description: `Community role: ${secondary_role}.`,
            icon: "🎖️",
            type: "role" as const,
            earned: true,
            color: "#00695c",
          },
        ]
      : []),
    ...(tertiary_role
      ? [
          {
            slug: `role_tertiary_${tertiary_role}`,
            label: tertiary_role.charAt(0).toUpperCase() + tertiary_role.slice(1),
            description: `Community role: ${tertiary_role}.`,
            icon: "🎗️",
            type: "role" as const,
            earned: true,
            color: "#4527a0",
          },
        ]
      : []),
  ];

  return badges;
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
    <div className="flex flex-wrap gap-2">
      {displayed.map((badge) => (
        <div
          key={badge.slug}
          className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
          style={{
            background: badge.earned
              ? badge.color
                ? `${badge.color}22`
                : "var(--color-accent-soft)"
              : "var(--color-border)",
            color: badge.earned
              ? badge.color ?? "var(--color-primary)"
              : "var(--color-text-muted)",
            border: `1px solid ${badge.earned ? badge.color ?? "var(--color-primary)" : "transparent"}`,
            opacity: badge.earned ? 1 : 0.5,
          }}
          title={badge.description}
        >
          <span>{badge.icon}</span>
          <span>{badge.label}</span>
          {badge.type === "role" && (
            <span className="text-[9px] opacity-60 ml-0.5">(role)</span>
          )}
        </div>
      ))}
    </div>
  );
}
