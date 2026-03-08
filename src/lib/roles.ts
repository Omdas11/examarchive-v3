import type { CustomRole, UserRole, UserTier } from "@/types";

/**
 * Role hierarchy – higher number = more privilege.
 *
 * Progression: visitor → explorer → contributor → verified_contributor
 *              → moderator → maintainer → admin → founder
 *
 * "student" is a legacy alias kept at level 0 for backward compatibility.
 */
const ROLE_LEVELS: Record<UserRole, number> = {
  visitor: 0,
  student: 0,            // legacy alias for visitor
  explorer: 1,
  contributor: 2,
  verified_contributor: 3,
  moderator: 4,
  maintainer: 5,
  admin: 6,
  founder: 7,
};

/**
 * Minimum XP required to be eligible for each role (informational only –
 * promotions are always confirmed manually by an admin or founder).
 * "student" / "visitor" require 0 XP (default starting role).
 */
export const ROLE_XP_THRESHOLDS: Record<UserRole, number> = {
  visitor: 0,
  student: 0,
  explorer: 50,
  contributor: 150,
  verified_contributor: 300,
  moderator: 0,           // moderation roles are assigned, not earned by XP
  maintainer: 0,
  admin: 0,
  founder: 0,
};

/**
 * Static ring colour for each role (shown in AvatarRing component).
 * Returns null for visitor / student (no ring).
 */
export const ROLE_RING_COLORS: Record<UserRole, string | null> = {
  visitor: null,
  student: null,
  explorer: "#0ea5e9",           // sky-500
  contributor: "#3b82f6",        // blue-500
  verified_contributor: "#6366f1", // indigo-500
  moderator: "#f97316",          // orange-500
  maintainer: "#a855f7",         // purple-500
  admin: "#ef4444",              // red-500
  founder: "#7c3aed",            // violet-700 (static purple)
};

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
  return ROLE_LEVELS[userRole] >= ROLE_LEVELS[requiredRole];
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
