"use client";

import type { UserRole, CustomRole, UserTier } from "@/types";

/** Color map for user roles – kept subtle with soft backgrounds. */
const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  founder: { bg: "#ede9fe", text: "#5b21b6" },
  admin: { bg: "#fee2e2", text: "#991b1b" },
  moderator: { bg: "#ffedd5", text: "#9a3412" },
  contributor: { bg: "#dbeafe", text: "#1e40af" },
  reviewer: { bg: "#f3e8ff", text: "#6b21a8" },
  curator: { bg: "#d1fae5", text: "#065f46" },
  mentor: { bg: "#ede9fe", text: "#4c1d95" },
  archivist: { bg: "#e0f2fe", text: "#075985" },
  ambassador: { bg: "#dcfce7", text: "#14532d" },
  pioneer: { bg: "#fef3c7", text: "#92400e" },
  researcher: { bg: "#f1f5f9", text: "#334155" },
  student: { bg: "#f1f5f9", text: "#475569" },
};

/** Tier color map – soft pastel backgrounds, legible text. */
const TIER_COLORS: Record<UserTier, { bg: string; text: string }> = {
  bronze: { bg: "#fef3c7", text: "#92400e" },
  silver: { bg: "#f1f5f9", text: "#334155" },
  gold: { bg: "#fef9c3", text: "#854d0e" },
  platinum: { bg: "#f0fdf4", text: "#14532d" },
  diamond: { bg: "#e0f2fe", text: "#0c4a6e" },
};

export function RoleBadge({ role }: { role: UserRole | CustomRole }) {
  if (!role) return null;
  const colors = ROLE_COLORS[role] ?? ROLE_COLORS.student;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight capitalize"
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
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight capitalize"
      style={{ background: colors.bg, color: colors.text }}
    >
      {tier}
    </span>
  );
}

