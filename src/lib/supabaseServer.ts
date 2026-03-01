import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for use in **Server Components**, **Route Handlers** and
 * **Server Actions**.  Reads / writes cookies via the Next.js `cookies()` API.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    },
  );
}
