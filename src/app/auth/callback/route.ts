import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabaseServer";

/**
 * GET /auth/callback
 * Handles the redirect from Supabase magic-link emails.
 * Exchanges the one-time `code` for a session, then sends the
 * user to the `next` URL (or `/` by default).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Ensure `next` is a relative path to prevent open-redirect attacks.
      const safePath = next.startsWith("/") ? next : "/";
      return NextResponse.redirect(`${origin}${safePath}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
