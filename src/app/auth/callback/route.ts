import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, Account } from "@/lib/appwrite";
import { SESSION_COOKIE } from "@/lib/auth";

/**
 * GET /auth/callback
 * Handles the redirect from Appwrite magic-link emails.
 * Exchanges the `userId` + `secret` query params for a session, then sends the
 * user to the `next` URL (or `/` by default).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const userId = searchParams.get("userId");
  const secret = searchParams.get("secret");
  const next = searchParams.get("next") ?? "/";

  if (userId && secret) {
    try {
      const client = createAdminClient();
      const account = new Account(client);
      const session = await account.createSession(userId, secret);

      // Persist the session secret as an httpOnly cookie.
      const cookieStore = await cookies();
      cookieStore.set(SESSION_COOKIE, session.secret, {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
      });

      // Ensure `next` is a relative path to prevent open-redirect attacks.
      const safePath = next.startsWith("/") ? next : "/";
      return NextResponse.redirect(`${origin}${safePath}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message.toLowerCase() : "";
      const errorCode = message.includes("expired")
        ? "auth_callback_expired"
        : "auth_callback_error";

      return NextResponse.redirect(`${origin}/login?error=${errorCode}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
