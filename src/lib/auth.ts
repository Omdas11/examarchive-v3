import { createClient } from "./supabaseServer";
import type { UserProfile, UserRole } from "@/types";

/**
 * Return the currently authenticated user's profile (including role) or `null`
 * if the request is unauthenticated.  Always performs the check server-side so
 * it cannot be bypassed on the client.
 */
export async function getServerUser(): Promise<UserProfile | null> {
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

  return {
    id: profile.id,
    email: profile.email ?? user.email ?? "",
    role: (profile.role as UserRole) ?? "student",
    created_at: profile.created_at,
  };
}
