import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for use in **Client Components** (browser only).
 * Reads the public env vars exposed by Next.js at build time.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
