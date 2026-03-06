"use client";

import type { UserRole, CustomRole, UserTier } from "@/types";

/** Color map for user roles. */
const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin: { bg: "#d32f2f", text: "#ffffff" },
  moderator: { bg: "#e65100", text: "#ffffff" },
  contributor: { bg: "#1565c0", text: "#ffffff" },
  reviewer: { bg: "#6a1b9a", text: "#ffffff" },
  curator: { bg: "#00695c", text: "#ffffff" },
  mentor: { bg: "#4527a0", text: "#ffffff" },
  student: { bg: "#9e9e9e", text: "#ffffff" },
};

/** Tier color map. */
const TIER_COLORS: Record<UserTier, { bg: string; text: string }> = {
  bronze: { bg: "#cd7f32", text: "#ffffff" },
  silver: { bg: "#c0c0c0", text: "#1a1a1a" },
  gold: { bg: "#ffd700", text: "#1a1a1a" },
  platinum: { bg: "#e5e4e2", text: "#1a1a1a" },
  diamond: { bg: "#b9f2ff", text: "#1a1a1a" },
};

export function RoleBadge({ role }: { role: UserRole | CustomRole }) {
  if (!role) return null;
  const colors = ROLE_COLORS[role] ?? ROLE_COLORS.student;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight"
      style={{ background: colors.bg, color: colors.text }}
    >
      {role}
    </span>
  );
}

export function TierBadge({ tier }: { tier: UserTier }) {
  const colors = TIER_COLORS[tier] ?? TIER_COLORS.bronze;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight"
      style={{ background: colors.bg, color: colors.text }}
    >
      {tier}
    </span>
  );
}
