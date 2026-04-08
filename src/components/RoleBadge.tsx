"use client";

import type { UserRole, CustomRole, UserTier } from "@/types";

/** Color map for user roles – kept subtle with soft backgrounds. */
const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin: { bg: "#fee2e2", text: "#991b1b" },
  founder: { bg: "#fee2e2", text: "#991b1b" },
  maintainer: { bg: "#fee2e2", text: "#991b1b" },
  moderator: { bg: "#ffedd5", text: "#9a3412" },
  curator: { bg: "#e0e7ff", text: "#3730a3" },
  verified_contributor: { bg: "#e0e7ff", text: "#3730a3" },
  contributor: { bg: "#dbeafe", text: "#1e40af" },
  viewer: { bg: "#f1f5f9", text: "#475569" },
  guest: { bg: "#f1f5f9", text: "#475569" },
  explorer: { bg: "#f1f5f9", text: "#475569" },
  visitor: { bg: "#f1f5f9", text: "#475569" },
  student: { bg: "#f1f5f9", text: "#475569" },   // legacy alias
  // Community / custom roles
  reviewer: { bg: "#f3e8ff", text: "#6b21a8" },
  mentor: { bg: "#ede9fe", text: "#4c1d95" },
  archivist: { bg: "#e0f2fe", text: "#075985" },
  ambassador: { bg: "#dcfce7", text: "#14532d" },
  pioneer: { bg: "#fef3c7", text: "#92400e" },
  researcher: { bg: "#f1f5f9", text: "#334155" },
};

/** Tier color map – soft pastel backgrounds, legible text. */
const TIER_COLORS: Record<UserTier, { bg: string; text: string }> = {
  bronze: { bg: "#fef3c7", text: "#92400e" },
  silver: { bg: "#f1f5f9", text: "#334155" },
  gold: { bg: "#fef9c3", text: "#854d0e" },
  platinum: { bg: "#f0fdf4", text: "#14532d" },
  diamond: { bg: "#e0f2fe", text: "#0c4a6e" },
};

/** Human-readable label for each role. */
export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  founder: "Admin",
  maintainer: "Admin",
  moderator: "Moderator",
  verified_contributor: "Curator",
  contributor: "Contributor",
  viewer: "Viewer",
  explorer: "Viewer",
  visitor: "Viewer",
  student: "Viewer",   // legacy alias
  guest: "Guest",
  reviewer: "Reviewer",
  curator: "Curator",
  mentor: "Mentor",
  archivist: "Archivist",
  ambassador: "Ambassador",
  pioneer: "Pioneer",
  researcher: "Researcher",
};

export function RoleBadge({ role }: { role: UserRole | CustomRole }) {
  if (!role) return null;
  const colors = ROLE_COLORS[role] ?? ROLE_COLORS.visitor;
  const label = ROLE_LABELS[role] ?? role;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold leading-tight"
      style={{ background: colors.bg, color: colors.text }}
    >
      {label}
    </span>
  );
}

export function TierBadge({ tier }: { tier: UserTier }) {
  const colors = TIER_COLORS[tier] ?? TIER_COLORS.bronze;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold leading-tight capitalize"
      style={{ background: colors.bg, color: colors.text }}
    >
      {tier}
    </span>
  );
}
