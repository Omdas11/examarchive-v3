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
  bgColor?: string;
  icon?: string;
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
    // ── Activity-earned badges ──
    {
      slug: "first_upload",
      label: "First Upload",
      description: "Submitted your first exam paper.",
      type: "activity",
      earned: xp >= 50 || (upload_count ?? 0) >= 1,
      accentColor: "#2e7d32",
      bgColor: "rgba(76,175,80,0.12)",
      icon: "��",
    },
    {
      slug: "10_uploads",
      label: "10 Uploads",
      description: "Had 10 papers approved.",
      type: "activity",
      earned: (upload_count ?? 0) >= 10,
      accentColor: "#f57f17",
      bgColor: "rgba(255,193,7,0.12)",
      icon: "📚",
    },
    {
      slug: "explorer",
      label: "Explorer",
      description: "Reached 100 XP.",
      type: "activity",
      earned: xp >= 100,
      accentColor: "#1565c0",
      bgColor: "rgba(33,150,243,0.12)",
      icon: "🗺️",
    },
    {
      slug: "contributor_badge",
      label: "Contributor",
      description: "Reached 300 XP.",
      type: "activity",
      earned: xp >= 300,
      accentColor: "#1565c0",
      bgColor: "rgba(25,118,210,0.12)",
      icon: "🏅",
    },
    {
      slug: "veteran",
      label: "Veteran",
      description: "Reached 800 XP.",
      type: "activity",
      earned: xp >= 800,
      accentColor: "#6a1b9a",
      bgColor: "rgba(156,39,176,0.12)",
      icon: "⚔️",
    },
    {
      slug: "senior",
      label: "Senior",
      description: "Reached 1500 XP.",
      type: "activity",
      earned: xp >= 1500,
      accentColor: "#e65100",
      bgColor: "rgba(245,124,0,0.12)",
      icon: "🌟",
    },
    {
      slug: "7_day_streak",
      label: "7-Day Streak",
      description: "Logged in 7 days in a row.",
      type: "activity",
      earned: streak_days >= 7,
      accentColor: "#c62828",
      bgColor: "rgba(244,67,54,0.12)",
      icon: "🔥",
    },
    {
      slug: "30_day_streak",
      label: "30-Day Streak",
      description: "Logged in 30 days in a row.",
      type: "activity",
      earned: streak_days >= 30,
      accentColor: "#a07818",
      bgColor: "rgba(210,160,20,0.12)",
      icon: "⭐",
    },
    {
      slug: "silver_tier",
      label: "Silver",
      description: "Reached Silver activity tier.",
      type: "activity",
      earned: hasTierOrAbove(tier, "silver"),
      accentColor: "#334155",
      bgColor: "rgba(100,116,139,0.12)",
      icon: "🥈",
    },
    {
      slug: "gold_tier",
      label: "Gold",
      description: "Reached Gold activity tier.",
      type: "activity",
      earned: hasTierOrAbove(tier, "gold"),
      accentColor: "#92400e",
      bgColor: "rgba(245,158,11,0.12)",
      icon: "🥇",
    },

    // ── Role-cosmetic badges ──
    {
      slug: "role_founder",
      label: "Founder",
      description: "Founder of ExamArchive.",
      type: "role",
      earned: role === "founder",
      accentColor: "#7c3aed",
      bgColor: "rgba(124,58,237,0.12)",
      icon: "👑",
    },
    {
      slug: "role_admin",
      label: "Admin",
      description: "Platform administrator.",
      type: "role",
      earned: role === "admin",
      accentColor: "#b91c1c",
      bgColor: "rgba(185,28,28,0.12)",
      icon: "🛡️",
    },
    {
      slug: "role_moderator",
      label: "Moderator",
      description: "Content moderator.",
      type: "role",
      earned: role === "moderator",
      accentColor: "#c2410c",
      bgColor: "rgba(194,65,12,0.12)",
      icon: "⚖️",
    },
    ...(secondary_role
      ? [{
          slug: `role_secondary_${secondary_role}`,
          label: secondary_role.charAt(0).toUpperCase() + secondary_role.slice(1),
          description: `Community role: ${secondary_role}.`,
          type: "role" as const,
          earned: true,
          accentColor: "#047857",
          bgColor: "rgba(4,120,87,0.12)",
          icon: "🎖️",
        }]
      : []),
    ...(tertiary_role
      ? [{
          slug: `role_tertiary_${tertiary_role}`,
          label: tertiary_role.charAt(0).toUpperCase() + tertiary_role.slice(1),
          description: `Community role: ${tertiary_role}.`,
          type: "role" as const,
          earned: true,
          accentColor: "#4338ca",
          bgColor: "rgba(67,56,202,0.12)",
          icon: "✨",
        }]
      : []),
  ];

  return badges;
}

interface BadgeDisplayProps {
  badges: BadgeData[];
  showAll?: boolean;
}

/** Displays a compact row of v2-style achievement and role-cosmetic badges. */
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
        const bg = badge.bgColor ?? "var(--color-border)";
        return (
          <span
            key={badge.slug}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{
              background: badge.earned ? bg : "var(--color-border)",
              color: badge.earned ? accent : "var(--color-text-muted)",
              border: badge.earned ? `1px solid ${accent}30` : "1px solid transparent",
              opacity: badge.earned ? 1 : 0.4,
            }}
            title={badge.description}
          >
            {badge.icon && (
              <span aria-hidden="true" style={{ fontSize: "0.7rem", lineHeight: 1 }}>
                {badge.icon}
              </span>
            )}
            {badge.label}
          </span>
        );
      })}
    </div>
  );
}
