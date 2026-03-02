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

const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

/**
 * Supabase client for use in **Server Components**, **Route Handlers** and
 * **Server Actions**.  Reads / writes cookies via the Next.js `cookies()` API.
 */
export async function createClient() {
  const cookieStore = await cookies();

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
