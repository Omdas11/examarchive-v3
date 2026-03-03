import { createClient } from "./supabaseServer";
import { isValidCustomRole, isValidTier, isValidUserRole } from "./roles";
import type { Achievement, CustomRole, ExtendedUserProfile, UserProfile, UserRole, UserTier } from "@/types";

/**
 * Lightweight helper that returns the authenticated Supabase `User` object or
 * `null` when unauthenticated.  Prefer this when you only need to check
 * whether the request is authenticated without fetching the full profile.
 * Returns null gracefully when Supabase is not configured (e.g. during build).
 */
export async function getUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

/**
 * Return the currently authenticated user's profile (including role) or `null`
 * if the request is unauthenticated.  Always performs the check server-side so
 * it cannot be bypassed on the client.
 * Returns null gracefully when Supabase is not configured (e.g. during build).
 */
export async function getServerUser(): Promise<UserProfile | null> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profile) {
      // Auto-create profile row on first login (no DB trigger required).
      const { data: newProfile, error: insertError } = await supabase
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email ?? "",
          role: "student",
        })
        .select()
        .single();

      if (insertError || !newProfile) {
        console.error("[auth] Failed to create profile for user", user.id, insertError?.message);
        return null;
      }

      return {
        id: newProfile.id,
        email: newProfile.email ?? user.email ?? "",
        role: "student" as UserRole,
        created_at: newProfile.created_at,
      };
    }

    return {
      id: profile.id,
      email: profile.email ?? user.email ?? "",
      role: (profile.role as UserRole) ?? "student",
      created_at: profile.created_at,
    };
  } catch {
    return null;
  }
}

/**
 * Return the extended user profile including the v2-style role columns
 * (`primary_role`, `secondary_role`, `tertiary_role`), `tier`, and
 * `achievements`.  Falls back to safe defaults when columns are absent so the
 * function remains compatible with the current single-`role` schema.
 *
 * All validation is performed server-side; no client-supplied values are
 * trusted.
 * Returns null gracefully when Supabase is not configured (e.g. during build).
 */
export async function getExtendedServerUser(): Promise<ExtendedUserProfile | null> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profile) return null;

    // Validate primary_role – fall back to "student" for unknown values.
    const rawPrimary = profile.primary_role ?? profile.role;
    const primaryRole: UserRole = isValidUserRole(rawPrimary) ? rawPrimary : "student";

    // Validate secondary / tertiary custom roles.
    const rawSecondary = profile.secondary_role ?? null;
    const secondaryRole: CustomRole = isValidCustomRole(rawSecondary) ? rawSecondary : null;

    const rawTertiary = profile.tertiary_role ?? null;
    const tertiaryRole: CustomRole = isValidCustomRole(rawTertiary) ? rawTertiary : null;

    // Validate tier.
    const rawTier = profile.tier ?? "bronze";
    const tier: UserTier = isValidTier(rawTier) ? rawTier : "bronze";

    // Fetch achievements (table may not exist yet – silently return empty array).
    const { data: achievements } = await supabase
      .from("achievements")
      .select("*")
      .eq("user_id", user.id);

    return {
      id: profile.id,
      email: profile.email ?? user.email ?? "",
      primary_role: primaryRole,
      secondary_role: secondaryRole,
      tertiary_role: tertiaryRole,
      tier,
      achievements: (achievements as Achievement[]) ?? [],
      created_at: profile.created_at,
    };
  } catch {
    return null;
  }
}
