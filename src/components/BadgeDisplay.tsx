"use client";

import type { UserRole, CustomRole, UserTier } from "@/types";
import { Icon, type IconName } from "@/components/Icons";

/** Tier level map for comparison. */
const TIER_LEVELS: Record<UserTier, number> = {
  bronze:   0,
  silver:   1,
  gold:     2,
  platinum: 3,
  diamond:  4,
};

function hasTierOrAbove(tier: UserTier | undefined, minTier: UserTier): boolean {
  if (!tier) return false;
  return (TIER_LEVELS[tier] ?? 0) >= TIER_LEVELS[minTier];
}

// ── Badge data type ──────────────────────────────────────────────────────────

export interface BadgeData {
  /** Unique slug — matches v2 achievement badge_type values */
  slug: string;
  label: string;
  description: string;
  type: "activity" | "role";
  earned: boolean;
  /** Icon name from the Icons registry (SVG — no emoji) */
  icon: IconName;
  accentColor?: string;
  bgColor?: string;
}

// ── buildBadges ──────────────────────────────────────────────────────────────

/**
 * Build the ordered list of badges for a user profile.
 *
 * Badge types and slugs mirror v2 exactly (see docs/XP_ACHIEVEMENTS.md):
 *   Activity: first_upload · 10_uploads · 100_uploads · first_review ·
 *             first_publish · early_user · 7_day_streak · 30_day_streak ·
 *             approval_90 · top_contributor
 *   Role:     role_founder · role_admin · role_moderator · secondary · tertiary
 */
export function buildBadges({
  role,
  secondary_role,
  tertiary_role,
  tier,
  xp,
  streak_days,
  upload_count = 0,
  total_uploads = 0,
  approval_pct,
}: {
  role: UserRole;
  secondary_role?: CustomRole;
  tertiary_role?: CustomRole;
  tier?: UserTier;
  xp: number;
  streak_days: number;
  /** Approved upload count (upload_count field in DB) */
  upload_count?: number;
  /** Total uploads including pending; defaults to upload_count when not provided */
  total_uploads?: number;
  /** Pre-computed approval percentage (0-100); derived from upload_count/total when omitted */
  approval_pct?: number;
}): BadgeData[] {
  const effectiveTotal = total_uploads > 0 ? total_uploads : upload_count;
  const effectiveApprovalPct =
    approval_pct !== undefined
      ? approval_pct
      : effectiveTotal > 0
        ? Math.round((upload_count / effectiveTotal) * 100)
        : 0;

  const badges: BadgeData[] = [
    // ── Activity-earned badges (v2 ACHIEVEMENTS.md order) ──

    {
      slug: "first_upload",
      label: "First Upload",
      description: "Submitted your first exam paper.",
      type: "activity",
      earned: upload_count >= 1,
      icon: "upload",
      accentColor: "#2e7d32",
      bgColor: "rgba(76,175,80,0.12)",
    },
    {
      slug: "10_uploads",
      label: "10 Uploads",
      description: "Had 10 papers approved.",
      type: "activity",
      earned: upload_count >= 10,
      icon: "trophy",
      accentColor: "#f57f17",
      bgColor: "rgba(255,193,7,0.12)",
    },
    {
      slug: "100_uploads",
      label: "100 Uploads",
      description: "Had 100 papers approved.",
      type: "activity",
      earned: upload_count >= 100,
      icon: "sparkles",
      accentColor: "#0277bd",
      bgColor: "rgba(2,119,189,0.12)",
    },
    {
      slug: "first_review",
      label: "First Review",
      description: "Reviewed a submission for the first time.",
      type: "activity",
      // Proxy: any admin/moderator who has approved at least one paper
      earned: (role === "admin" || role === "moderator" || role === "founder") && upload_count > 0,
      icon: "edit",
      accentColor: "#5c6bc0",
      bgColor: "rgba(92,107,192,0.12)",
    },
    {
      slug: "first_publish",
      label: "First Publish",
      description: "Had your first paper published.",
      type: "activity",
      earned: upload_count >= 1,
      icon: "globe",
      accentColor: "#00838f",
      bgColor: "rgba(0,131,143,0.12)",
    },
    {
      slug: "early_user",
      label: "Early Adopter",
      description: "Among the first 10 registered users.",
      type: "activity",
      // Cannot be determined client-side; set explicitly when known
      earned: false,
      icon: "star",
      accentColor: "#f9a825",
      bgColor: "rgba(249,168,37,0.12)",
    },
    {
      slug: "7_day_streak",
      label: "7-Day Streak",
      description: "Logged in 7 days in a row.",
      type: "activity",
      earned: streak_days >= 7,
      icon: "fire",
      accentColor: "#c62828",
      bgColor: "rgba(244,67,54,0.12)",
    },
    {
      slug: "30_day_streak",
      label: "30-Day Streak",
      description: "Logged in 30 days in a row.",
      type: "activity",
      earned: streak_days >= 30,
      icon: "lightning",
      accentColor: "#6a1b9a",
      bgColor: "rgba(106,27,154,0.12)",
    },
    {
      slug: "approval_90",
      label: "90% Approval",
      description: "Maintained 90%+ approval rate with at least 10 uploads.",
      type: "activity",
      earned: effectiveApprovalPct >= 90 && upload_count >= 10,
      icon: "badge",
      accentColor: "#2e7d32",
      bgColor: "rgba(46,125,50,0.12)",
    },
    {
      slug: "top_contributor",
      label: "Top Contributor",
      description: "Achieved Veteran rank (800+ XP).",
      type: "activity",
      // Proxy for "monthly top uploader" — uses Veteran XP threshold
      earned: xp >= 800,
      icon: "medal",
      accentColor: "#e65100",
      bgColor: "rgba(230,81,0,0.12)",
    },

    // ── Tier milestones (v3 extension) ──
    {
      slug: "silver_tier",
      label: "Silver",
      description: "Reached Silver activity tier (20+ approved uploads).",
      type: "activity",
      earned: hasTierOrAbove(tier, "silver"),
      icon: "sparkles",
      accentColor: "#334155",
      bgColor: "rgba(100,116,139,0.12)",
    },
    {
      slug: "gold_tier",
      label: "Gold",
      description: "Reached Gold activity tier (admin-assigned).",
      type: "activity",
      earned: hasTierOrAbove(tier, "gold"),
      icon: "trophy",
      accentColor: "#92400e",
      bgColor: "rgba(245,158,11,0.12)",
    },

    // ── Role-cosmetic badges ──
    {
      slug: "role_founder",
      label: "Founder",
      description: "Founder of ExamArchive.",
      type: "role",
      earned: role === "founder",
      icon: "crown",
      accentColor: "#7c3aed",
      bgColor: "rgba(124,58,237,0.12)",
    },
    {
      slug: "role_admin",
      label: "Admin",
      description: "Platform administrator.",
      type: "role",
      earned: role === "admin",
      icon: "shield",
      accentColor: "#b91c1c",
      bgColor: "rgba(185,28,28,0.12)",
    },
    {
      slug: "role_moderator",
      label: "Moderator",
      description: "Content moderator.",
      type: "role",
      earned: role === "moderator",
      icon: "badge",
      accentColor: "#c2410c",
      bgColor: "rgba(194,65,12,0.12)",
    },

    // Custom secondary/tertiary badges
    ...(secondary_role
      ? [{
          slug: `role_secondary_${secondary_role}`,
          label: secondary_role.charAt(0).toUpperCase() + secondary_role.slice(1),
          description: `Community role: ${secondary_role}.`,
          type: "role" as const,
          earned: true,
          icon: "tag" as IconName,
          accentColor: "#047857",
          bgColor: "rgba(4,120,87,0.12)",
        }]
      : []),
    ...(tertiary_role
      ? [{
          slug: `role_tertiary_${tertiary_role}`,
          label: tertiary_role.charAt(0).toUpperCase() + tertiary_role.slice(1),
          description: `Community role: ${tertiary_role}.`,
          type: "role" as const,
          earned: true,
          icon: "tag" as IconName,
          accentColor: "#4338ca",
          bgColor: "rgba(67,56,202,0.12)",
        }]
      : []),
  ];

  return badges;
}

// ── BadgeDisplay component ───────────────────────────────────────────────────

interface BadgeDisplayProps {
  badges: BadgeData[];
  /** When true, also shows unearned badges at reduced opacity. Default: false */
  showAll?: boolean;
}

/**
 * Renders compact v2-style achievement and role-cosmetic badge pills.
 *
 * Each badge uses an SVG icon (no emoji) matching the v2 design.
 */
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
              border: `1px solid ${badge.earned ? accent + "30" : "transparent"}`,
              opacity: badge.earned ? 1 : 0.4,
            }}
            title={badge.description}
          >
            <Icon
              name={badge.icon}
              size={11}
              aria-hidden="true"
            />
            {badge.label}
          </span>
        );
      })}
    </div>
  );
}
