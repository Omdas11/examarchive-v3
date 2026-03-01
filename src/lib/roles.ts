import type { UserRole } from "@/types";

/** Hierarchy used for comparison – higher number = more privilege. */
const ROLE_LEVELS: Record<UserRole, number> = {
  student: 0,
  moderator: 1,
  admin: 2,
};

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
