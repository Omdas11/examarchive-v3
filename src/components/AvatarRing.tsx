/**
 * AvatarRing – avatar with a coloured ring that visually indicates the user's
 * role or daily streak level.
 *
 * Ring priority (role ring takes precedence over streak):
 *   founder          → static violet ring (#7c3aed)
 *   admin            → static red ring
 *   maintainer       → static purple ring
 *   moderator        → static orange ring
 *   verified_contributor → static indigo ring
 *   contributor      → static blue ring
 *   explorer         → static sky-blue ring
 *   student/visitor  → no role ring (falls back to streak ring)
 *
 * Streak rings (when no role ring):
 *   0 days   → no ring
 *   1–6 days → solid blue ring
 *   7–29 days → solid green ring
 *   30+ days  → Google-style animated 4-color rotating ring (red/blue/yellow/green)
 */

"use client";

import { useState } from "react";
import type { UserRole, CustomRole } from "@/types";
import { ROLE_RING_COLORS } from "@/lib/roles";

interface AvatarRingProps {
  /** Email or display name used to generate the fallback initial. */
  displayName: string;
  /** URL of the user's avatar image. When empty the initials fallback is shown. */
  avatarUrl?: string;
  /** Current streak in days. Drives the ring style when no role ring. */
  streakDays?: number;
  /** User's primary role. When provided, drives the ring color. */
  role?: UserRole | CustomRole | null;
  /** Diameter of the avatar in px (default 32). */
  size?: number;
  /** Extra class names for the wrapper element. */
  className?: string;
}

/** Return a ring colour based on streak level (for non-animated rings). */
function solidRingColor(streak: number): string {
  if (streak >= 7) return "#22c55e";  // green-500
  if (streak >= 1) return "#3b82f6";  // blue-500
  return "transparent";
}

/** Return a static ring colour for a user role. Returns null for visitor/student/no role. */
function roleRingColor(role: string | null | undefined): string | null {
  if (!role) return null;
  // Look up in ROLE_RING_COLORS for UserRole values
  if (role in ROLE_RING_COLORS) {
    return ROLE_RING_COLORS[role as UserRole];
  }
  // Community custom roles use a uniform blue tint
  const communityRoles = new Set(["reviewer", "curator", "mentor", "archivist", "ambassador", "pioneer", "researcher"]);
  if (communityRoles.has(role)) return "#3b82f6"; // blue-500
  return null;
}

/** Return the initials to display when no avatar image is provided. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (name[0] ?? "?").toUpperCase();
}

export default function AvatarRing({
  displayName,
  avatarUrl,
  streakDays = 0,
  role,
  size = 32,
  className = "",
}: AvatarRingProps) {
  const [imgError, setImgError] = useState(false);

  const solidRole = roleRingColor(role as string | null);

  // Decide which ring to show
  const useRoleRing = solidRole !== null;
  const useStreakAnimated = !useRoleRing && streakDays >= 30;
  const useStreakSolid = !useRoleRing && !useStreakAnimated && streakDays > 0;
  const hasRing = useRoleRing || useStreakAnimated || useStreakSolid;

  const ringWidth = size >= 48 ? 3 : 2;
  const ringGap = 1;
  const totalSize = size + (hasRing ? (ringWidth + ringGap) * 2 : 0);

  const showImage = !!avatarUrl && !imgError;

  const ringTitle = solidRole
    ? `${role} role`
    : streakDays > 0
    ? `${streakDays}-day streak`
    : undefined;

  return (
    <span
      className={`relative inline-flex items-center justify-center shrink-0 rounded-full ${className}`}
      style={{ width: totalSize, height: totalSize }}
      title={ringTitle}
    >
      {/* Role-based static ring */}
      {useRoleRing && (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          style={{
            boxShadow: `0 0 0 ${ringWidth}px ${solidRole}`,
          }}
        />
      )}

      {/* Animated 4-color Google-style ring (30+ day streak) */}
      {useStreakAnimated && (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full avatar-ring-google"
          style={{
            padding: ringWidth + ringGap,
            background:
              "conic-gradient(#4285F4 0deg, #EA4335 90deg, #FBBC05 180deg, #34A853 270deg, #4285F4 360deg)",
          }}
        >
          <span
            className="block rounded-full w-full h-full"
            style={{ background: "var(--color-surface)" }}
          />
        </span>
      )}

      {/* Solid ring (1–29 day streak) */}
      {useStreakSolid && (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          style={{
            boxShadow: `0 0 0 ${ringWidth}px ${solidRingColor(streakDays)}`,
          }}
        />
      )}

      {/* Avatar circle – rendered with relative+z-index so it sits above the
          absolutely-positioned ring layers (CSS paints positioned elements
          after non-positioned siblings within the same stacking context). */}
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={displayName}
          width={size}
          height={size}
          className="relative z-10 rounded-full object-cover"
          style={{ width: size, height: size }}
          onError={() => setImgError(true)}
        />
      ) : (
        <span
          className="relative z-10 flex items-center justify-center rounded-full font-bold text-white select-none"
          style={{
            width: size,
            height: size,
            background: "var(--color-primary)",
            fontSize: size * 0.4,
          }}
          aria-label={displayName}
        >
          {initials(displayName)}
        </span>
      )}
    </span>
  );
}
