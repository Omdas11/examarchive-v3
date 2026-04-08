import type { CustomRole, UserRole, UserTier } from "@/types";

/**
 * Role hierarchy – higher number = more privilege.
 *
 * Canonical progression (v2):
 * guest → viewer → contributor → curator → moderator → admin
 *
 * Legacy v1 roles are accepted and normalized.
 */
const ROLE_LEVELS: Record<UserRole, number> = {
  guest: 0,
  viewer: 1,
  contributor: 2,
  curator: 3,
  visitor: 0,
  student: 0,            // legacy alias for visitor/guest
  explorer: 1,           // legacy alias for viewer
  verified_contributor: 3, // legacy alias for curator
  moderator: 4,
  maintainer: 5,         // legacy alias for admin
  admin: 6,
  founder: 6,            // legacy super-admin alias
};

/**
 * XO thresholds for role eligibility.
 */
export const ROLE_XO_THRESHOLDS: Record<UserRole, number> = {
  guest: 0,
  viewer: 0,
  visitor: 0,
  student: 0,
  explorer: 0,
  contributor: 30,
  curator: 150,
  verified_contributor: 150,
  moderator: 0,
  maintainer: 0,
  admin: 0,
  founder: 0,
};

/** @deprecated use ROLE_XO_THRESHOLDS */
export const ROLE_XP_THRESHOLDS = ROLE_XO_THRESHOLDS;

/**
 * Static ring colour for each role (shown in AvatarRing component).
 * Returns null for guest/viewer and visitor aliases (no ring).
 */
export const ROLE_RING_COLORS: Record<UserRole, string | null> = {
  guest: null,
  viewer: null,
  curator: "#6366f1",             // indigo-500
  visitor: null,
  student: null,
  explorer: null,
  contributor: "#3b82f6",        // blue-500
  verified_contributor: "#6366f1", // legacy alias for curator
  moderator: "#f97316",          // orange-500
  maintainer: "#ef4444",         // legacy alias for admin
  admin: "#ef4444",              // red-500
  founder: "#ef4444",            // legacy alias for admin
};

const LEGACY_ROLE_MAP: Partial<Record<UserRole, UserRole>> = {
  visitor: "viewer",
  student: "viewer",
  explorer: "viewer",
  verified_contributor: "curator",
  maintainer: "admin",
};

export function normalizeRole(role: string | null | undefined): UserRole {
  if (!role) return "guest";
  if (!(role in ROLE_LEVELS)) return "guest";
  const typedRole = role as UserRole;
  return LEGACY_ROLE_MAP[typedRole] ?? typedRole;
}

export function roleLabel(role: string | null | undefined): string {
  const normalized = normalizeRole(role);
  if (normalized === "guest") return "Guest";
  if (normalized === "viewer") return "Viewer";
  if (normalized === "contributor") return "Contributor";
  if (normalized === "curator") return "Curator";
  if (normalized === "moderator") return "Moderator";
  return "Admin";
}

/** Tier hierarchy – higher number = higher standing. */
const TIER_LEVELS: Record<UserTier, number> = {
  bronze: 0,
  silver: 1,
  gold: 2,
  platinum: 3,
  diamond: 4,
};

/** Valid custom (secondary / tertiary) role values. */
const VALID_CUSTOM_ROLES = new Set<string>([
  "reviewer",
  "curator",
  "mentor",
  "archivist",
  "ambassador",
  "pioneer",
  "researcher",
]);

/** Returns `true` when `userRole` meets or exceeds the `requiredRole`. */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_LEVELS[normalizeRole(userRole)] >= ROLE_LEVELS[normalizeRole(requiredRole)];
}

/** Convenience check for admin-level access (admin and above). */
export function isAdmin(role: UserRole): boolean {
  return hasRole(role, "admin");
}

/** Convenience check for moderator-or-above access. */
export function isModerator(role: UserRole): boolean {
  return hasRole(role, "moderator");
}

/** Convenience check for founder-only access. */
export function isFounder(role: UserRole): boolean {
  return role === "founder";
}

/** Returns `true` when `userTier` meets or exceeds the `requiredTier`. */
export function hasTier(userTier: UserTier, requiredTier: UserTier): boolean {
  return TIER_LEVELS[userTier] >= TIER_LEVELS[requiredTier];
}

/**
 * Validate that a value is a well-formed `CustomRole`.
 * Returns `true` for `null` (no custom role assigned).
 */
export function isValidCustomRole(value: unknown): value is CustomRole {
  return value === null || (typeof value === "string" && VALID_CUSTOM_ROLES.has(value));
}

/**
 * Validate that a value is a well-formed `UserTier`.
 */
export function isValidTier(value: unknown): value is UserTier {
  return typeof value === "string" && value in TIER_LEVELS;
}

/**
 * Validate that a value is a well-formed `UserRole`.
 */
export function isValidUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && value in ROLE_LEVELS;
}
