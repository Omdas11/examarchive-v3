import { createBrowserClient } from "@supabase/ssr";

// These are inlined at build time by Next.js (NEXT_PUBLIC_ prefix).
// We validate at module initialisation so the app fails loudly if they are absent.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing Supabase environment variables. " +
      "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

/**
 * Supabase client for use in **Client Components** (browser only).
 * Reads the public env vars exposed by Next.js at build time.
 */
export function createClient() {
  // Non-null assertions are safe: we throw above if either value is absent.
  return createBrowserClient(url!, anonKey!);
}
