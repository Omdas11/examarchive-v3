import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}. ` +
        "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return value;
}

/**
 * Supabase client for use in **Server Components**, **Route Handlers** and
 * **Server Actions**.  Reads / writes cookies via the Next.js `cookies()` API.
 *
 * Environment variables are validated lazily (at request time) so that the
 * module can be imported during the Next.js build without throwing.
 */
export async function createClient() {
  // `cookies()` is a Next.js dynamic API – calling it first ensures any page
  // that creates a Supabase client is automatically treated as dynamically
  // rendered (not prerendered at build time).  Env vars are then validated at
  // request time when they are guaranteed to be present in production.
  const cookieStore = await cookies();
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // `setAll` is called from Server Components where cookies cannot
          // be set.  This is safe to ignore when the middleware is refreshing
          // the session.
        }
      },
    },
  });
}
