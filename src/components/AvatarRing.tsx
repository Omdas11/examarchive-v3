/**
 * AvatarRing – Google-style avatar with a coloured ring that visually
 * indicates the user's daily streak level.
 *
 * Ring colours:
 *   0 days   → no ring (transparent)
 *   1–6 days → blue
 *   7–29 days → green
 *   30+ days  → gold / amber
 */

"use client";

import { useState } from "react";

interface AvatarRingProps {
  /** Email or display name used to generate the fallback initial. */
  displayName: string;
  /** URL of the user's avatar image. When empty the initials fallback is shown. */
  avatarUrl?: string;
  /** Current streak in days. Drives the ring colour. */
  streakDays?: number;
  /** Diameter of the avatar in px (default 32). */
  size?: number;
  /** Extra class names for the wrapper element. */
  className?: string;
}

/** Return a ring colour based on streak level. */
function ringColor(streak: number): string {
  if (streak >= 30) return "#f59e0b"; // amber-400  (gold)
  if (streak >= 7) return "#22c55e";  // green-500
  if (streak >= 1) return "#3b82f6";  // blue-500
  return "transparent";              // no ring
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
  size = 32,
  className = "",
}: AvatarRingProps) {
  const [imgError, setImgError] = useState(false);
  const color = ringColor(streakDays);
  const hasRing = streakDays > 0;
  // Ring border is ~2px for small avatars, 3px for larger ones
  const ringWidth = size >= 48 ? 3 : 2;
  const ringGap = 2;

  const showImage = !!avatarUrl && !imgError;

  return (
    <span
      className={`relative inline-flex items-center justify-center shrink-0 rounded-full ${hasRing ? "avatar-ring-active" : ""} ${className}`}
      style={{
        width: size + (hasRing ? (ringWidth + ringGap) * 2 : 0),
        height: size + (hasRing ? (ringWidth + ringGap) * 2 : 0),
      }}
      title={
        streakDays > 0 ? `${streakDays}-day streak` : undefined
      }
    >
      {/* Ring */}
      {hasRing && (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          style={{
            boxShadow: `0 0 0 ${ringWidth}px ${color}`,
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
