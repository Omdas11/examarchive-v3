/**
 * Centralized SVG icon library — ExamArchive v3
 *
 * All icons use a 24×24 viewBox (for crisp scaling) and render at 16 px by
 * default (configurable via the `size` prop). They are stroke-based with
 * `stroke="currentColor"` so they inherit the surrounding text colour.
 * This is an exact port of v2's `js/svg-icons.js`.
 *
 * Usage:
 *   import { IconCrown, IconShield, Icon } from "@/components/Icons";
 *   <IconCrown size={20} />
 *   <Icon name="fire" size={16} style={{ color: "red" }} />
 */

import React from "react";

// ── Shared prop type ────────────────────────────────────────────────────────
export type IconProps = Omit<React.SVGProps<SVGSVGElement>, "width" | "height"> & {
  /** Icon width/height in px. Default: 16 */
  size?: number;
};

// ── Internal helper – shared base SVG attributes ───────────────────────────
const BASE_ATTRS = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": "true" as const,
} satisfies React.SVGProps<SVGSVGElement>;

// ── Permission-role icons ───────────────────────────────────────────────────

export function IconCrown({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <path d="M2 20h20" />
      <path d="M4 20V9l4 3 4-7 4 7 4-3v11" />
    </svg>
  );
}

export function IconShield({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export function IconLightning({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

/** Badge with inner checkmark — used for Moderator and approval badges */
export function IconBadge({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <path d="M12 2L3 7v5c0 5 3.6 9.3 9 10.5 5.4-1.2 9-5.5 9-10.5V7l-9-5z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function IconClipboard({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  );
}

export function IconSparkles({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <path d="M12 3v2m0 14v2M5.6 5.6l1.4 1.4m10 10l1.4 1.4M3 12h2m14 0h2M5.6 18.4l1.4-1.4m10-10l1.4-1.4" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

export function IconUser({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function IconEye({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// ── Academic functional-role icons ─────────────────────────────────────────

export function IconFlask({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <path d="M9 3h6M10 3v6l-5 8.5a2 2 0 001.7 3h10.6a2 2 0 001.7-3L14 9V3" />
    </svg>
  );
}

export function IconChart({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

export function IconRuler({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <path d="M21.3 15.3a2.4 2.4 0 010 3.4l-2.6 2.6a2.4 2.4 0 01-3.4 0L2.7 8.7a2.4 2.4 0 010-3.4l2.6-2.6a2.4 2.4 0 013.4 0zM14 7l3 3M10 11l3 3M6 15l3 3" />
    </svg>
  );
}

export function IconEdit({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

// ── Technical functional-role icons ────────────────────────────────────────

export function IconPalette({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" />
      <path d="M12 2a10 10 0 000 20 2 2 0 002-2v-.5a2 2 0 012-2h1.5A2.5 2.5 0 0020 15a10 10 0 00-8-13z" />
    </svg>
  );
}

export function IconGear({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

export function IconLock({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

export function IconDatabase({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

// ── Community functional-role icons ────────────────────────────────────────

export function IconGraduation({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <path d="M22 10l-10-6L2 10l10 6 10-6z" />
      <path d="M6 12v5c0 2 2.7 3 6 3s6-1 6-3v-5" />
      <line x1="22" y1="10" x2="22" y2="16" />
    </svg>
  );
}

export function IconMegaphone({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

export function IconHandshake({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <path d="m11 17 2 2a1 1 0 1 0 3-3" />
      <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
      <path d="m21 3 1 11h-1" />
      <path d="M4.7 4.7l.28.47a2 2 0 0 0 .25 1.42L3 9" />
      <path d="M3.3 3.3 2 4l1 10" />
    </svg>
  );
}

export function IconBooks({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  );
}

// ── Achievement / status icons ──────────────────────────────────────────────

export function IconTrophy({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <path d="M6 9H3V4h3M18 9h3V4h-3" />
      <path d="M6 4h12v6a6 6 0 01-12 0V4z" />
      <path d="M12 16v3" />
      <path d="M8 22h8" />
    </svg>
  );
}

export function IconStar({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export function IconMicroscope({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <path d="M6 18h8" />
      <path d="M3 22h18" />
      <path d="M14 22a7 7 0 100-14h-1" />
      <path d="M9 14h2" />
      <path d="M9 12a2 2 0 01-2-2V6h6v4a2 2 0 01-2 2z" />
      <path d="M12 6V3a1 1 0 00-1-1H9a1 1 0 00-1 1v3" />
    </svg>
  );
}

export function IconTag({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

export function IconMedal({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <path d="M7.21 15L2.66 7.14A2 2 0 014.33 4h15.34a2 2 0 011.67 3.14L16.79 15" />
      <circle cx="12" cy="16" r="5" />
      <path d="M12 13v6" />
      <path d="M9 16h6" />
    </svg>
  );
}

export function IconGlobe({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  );
}

export function IconUpload({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

export function IconFire({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <path d="M12 22c4-2.5 7-6 7-10.5 0-3-1.5-5.5-4-7.5-.8 2-2 3-4 3-1.5 0-2.5-1-3-2.5C6 7 4 10 4 13c0 4.5 3 7.5 8 9z" />
    </svg>
  );
}

export function IconCamera({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

export function IconTrash({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  );
}

export function IconHourglass({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <path d="M5 3h14M5 21h14M7 3v4a4 4 0 004 4 4 4 0 004-4V3M7 21v-4a4 4 0 014-4 4 4 0 014 4v4" />
    </svg>
  );
}

export function IconCheck({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function IconXMark({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function IconSearch({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function IconWarning({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function IconFile({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

export function IconHeart({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

export function IconRefresh({ size = 16, ...p }: IconProps) {
  return (
    <svg {...BASE_ATTRS} width={size} height={size} viewBox="0 0 24 24" {...p}>
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
    </svg>
  );
}

// ── Icon registry (for dynamic <Icon name="…" /> usage) ────────────────────

/** All named icons. Matches v2's SvgIcons registry keys. */
export const ICONS = {
  crown:       IconCrown,
  shield:      IconShield,
  lightning:   IconLightning,
  badge:       IconBadge,
  clipboard:   IconClipboard,
  sparkles:    IconSparkles,
  user:        IconUser,
  eye:         IconEye,
  flask:       IconFlask,
  chart:       IconChart,
  ruler:       IconRuler,
  edit:        IconEdit,
  palette:     IconPalette,
  gear:        IconGear,
  lock:        IconLock,
  database:    IconDatabase,
  graduation:  IconGraduation,
  megaphone:   IconMegaphone,
  handshake:   IconHandshake,
  books:       IconBooks,
  trophy:      IconTrophy,
  star:        IconStar,
  microscope:  IconMicroscope,
  tag:         IconTag,
  medal:       IconMedal,
  globe:       IconGlobe,
  upload:      IconUpload,
  fire:        IconFire,
  camera:      IconCamera,
  trash:       IconTrash,
  hourglass:   IconHourglass,
  check:       IconCheck,
  x_mark:      IconXMark,
  search:      IconSearch,
  warning:     IconWarning,
  file:        IconFile,
  heart:       IconHeart,
  refresh:     IconRefresh,
} as const;

export type IconName = keyof typeof ICONS;

// ── Convenience component ──────────────────────────────────────────────────

/**
 * Render any named icon by string key.
 *
 * @example
 *   <Icon name="crown" size={20} style={{ color: "gold" }} />
 */
export function Icon({
  name,
  size = 16,
  ...rest
}: { name: IconName } & IconProps) {
  const Comp = ICONS[name] ?? IconTag;
  return <Comp size={size} {...rest} />;
}
