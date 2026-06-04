import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, Account } from "@/lib/appwrite";
import { SESSION_COOKIE } from "@/lib/auth";

/**
 * GET /auth/callback
 * Handles the redirect from Appwrite magic-link emails and OAuth callbacks.
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

      // Ensure `next` is a relative path to prevent open-redirect attacks.
      const safePath = next.startsWith("/") ? next : "/";
      const response = NextResponse.redirect(`${origin}${safePath}`);

      // Persist the session secret as an httpOnly cookie.
      // Must use NextResponse.cookies in Route Handlers, not cookies() from next/headers.
      response.cookies.set(SESSION_COOKIE, session.secret, {
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
      });

      return response;
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
