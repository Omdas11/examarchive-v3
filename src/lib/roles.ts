import type { CustomRole, UserRole, UserTier } from "@/types";

/**
 * Role hierarchy – higher number = more privilege.
 *
 * Canonical progression:
 * student → contributor → specialist → subject_admin → moderator
 * founder remains the super-admin override.
 *
 * Legacy v1 roles are accepted and normalized.
 */
const ROLE_LEVELS: Record<UserRole, number> = {
  student: 0,
  contributor: 1,
  specialist: 2,
  subject_admin: 3,
  moderator: 4,
  founder: 5,
  // legacy aliases (kept for backward compatibility)
  guest: 0,
  viewer: 0,
  visitor: 0,
  explorer: 0,
  curator: 2,
  verified_contributor: 2,
  maintainer: 4,
  admin: 4,
};

/**
 * XO thresholds for role eligibility.
 */
export const ROLE_XO_THRESHOLDS: Record<UserRole, number> = {
  student: 0,
  contributor: 30,
  specialist: 150,
  subject_admin: 400,
  moderator: 0,
  founder: 0,
  // legacy aliases
  guest: 0,
  viewer: 0,
  visitor: 0,
  explorer: 0,
  curator: 150,
  verified_contributor: 150,
  maintainer: 0,
  admin: 0,
};

/** @deprecated use ROLE_XO_THRESHOLDS */
export const ROLE_XP_THRESHOLDS = ROLE_XO_THRESHOLDS;

/**
 * Static ring colour for each role (shown in AvatarRing component).
 * Returns null for guest/viewer and visitor aliases (no ring).
 */
export const ROLE_RING_COLORS: Record<UserRole, string | null> = {
  student: null,
  contributor: "#3b82f6",
  specialist: "#6366f1",
  subject_admin: "#0ea5e9",
  moderator: "#f97316",          // orange-500
  founder: "#ef4444",
  // legacy aliases
  guest: null,
  viewer: null,
  visitor: null,
  explorer: null,
  curator: "#6366f1",
  verified_contributor: "#6366f1",
  maintainer: "#f97316",
  admin: "#f97316",
};

const LEGACY_ROLE_MAP: Partial<Record<UserRole, UserRole>> = {
  guest: "student",
  viewer: "student",
  visitor: "student",
  explorer: "student",
  curator: "specialist",
  verified_contributor: "specialist",
  admin: "moderator",
  maintainer: "moderator",
};

export function normalizeRole(role: string | null | undefined): UserRole {
  if (!role) return "student";
  if (!(role in ROLE_LEVELS)) return "student";
  const typedRole = role as UserRole;
  return LEGACY_ROLE_MAP[typedRole] ?? typedRole;
}

export function roleLabel(role: string | null | undefined): string {
  const normalized = normalizeRole(role);
  if (normalized === "student") return "Student";
  if (normalized === "contributor") return "Contributor";
  if (normalized === "specialist") return "Specialist";
  if (normalized === "subject_admin") return "Subject Administrator";
  if (normalized === "moderator") return "Moderator";
  return "Founder";
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
  "supporter",
  "mentor",
  "archivist",
  "ambassador",
]);

/** Returns `true` when `userRole` meets or exceeds the `requiredRole`. */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_LEVELS[normalizeRole(userRole)] >= ROLE_LEVELS[normalizeRole(requiredRole)];
}

/** Convenience check for admin-level access (admin and above). */
export function isAdmin(role: UserRole): boolean {
  return hasRole(role, "moderator");
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
