import type { CustomRole, UserRole, UserTier } from "@/types";

/** Hierarchy used for comparison – higher number = more privilege. */
const ROLE_LEVELS: Record<UserRole, number> = {
  student: 0,
  moderator: 1,
  admin: 2,
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
const VALID_CUSTOM_ROLES = new Set<string>(["contributor", "reviewer", "curator", "mentor"]);

/** Returns `true` when `userRole` meets or exceeds the `requiredRole`. */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_LEVELS[userRole] >= ROLE_LEVELS[requiredRole];
}

/** Convenience check for admin-level access. */
export function isAdmin(role: UserRole): boolean {
  return hasRole(role, "admin");
}

/** Convenience check for moderator-or-above access. */
export function isModerator(role: UserRole): boolean {
  return hasRole(role, "moderator");
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
