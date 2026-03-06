/**
 * AvatarRing – avatar with a coloured ring that visually indicates the user's
 * role or daily streak level.
 *
 * Ring priority (role ring takes precedence over streak):
 *   founder   → purple/gold gradient ring
 *   admin     → solid red ring
 *   moderator → solid orange ring
 *   contributor/reviewer/curator/mentor → solid blue ring
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

/** Return a ring colour based on user role. Returns null for student/no role. */
function roleRingColor(role: string | null | undefined): string | null {
  if (!role) return null;
  switch (role) {
    case "founder":    return null; // Uses gradient (handled separately)
    case "admin":      return "#d32f2f";
    case "moderator":  return "#e65100";
    case "contributor":
    case "reviewer":
    case "curator":
    case "mentor":
    case "archivist":
    case "ambassador":
    case "pioneer":
    case "researcher": return "#1565c0";
    default:           return null;
  }
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

  const isFounderRole = role === "founder";
  const solidRole = roleRingColor(role as string | null);

  // Decide which ring to show
  const useFounderRing = isFounderRole;
  const useRoleRing = !isFounderRole && solidRole !== null;
  const useStreakAnimated = !useFounderRing && !useRoleRing && streakDays >= 30;
  const useStreakSolid = !useFounderRing && !useRoleRing && !useStreakAnimated && streakDays > 0;
  const hasRing = useFounderRing || useRoleRing || useStreakAnimated || useStreakSolid;

  const ringWidth = size >= 48 ? 3 : 2;
  const ringGap = 2;
  const totalSize = size + (hasRing ? (ringWidth + ringGap) * 2 : 0);

  const showImage = !!avatarUrl && !imgError;

  const ringTitle = isFounderRole
    ? "Founder"
    : solidRole
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
      {/* Founder gradient ring */}
      {useFounderRing && (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full avatar-ring-google"
          style={{
            padding: ringWidth + ringGap,
            background:
              "conic-gradient(#7c3aed 0deg, #ffd700 90deg, #7c3aed 180deg, #ffd700 270deg, #7c3aed 360deg)",
          }}
        >
          <span
            className="block rounded-full w-full h-full"
            style={{ background: "var(--color-surface)" }}
          />
        </span>
      )}

      {/* Role-based solid ring */}
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

      {/* Avatar circle */}
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={displayName}
          width={size}
          height={size}
          className="rounded-full object-cover"
          style={{ width: size, height: size }}
          onError={() => setImgError(true)}
        />
      ) : (
        <span
          className="flex items-center justify-center rounded-full font-bold text-white select-none"
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
