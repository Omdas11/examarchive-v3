import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, Account } from "@/lib/appwrite";
import { SESSION_COOKIE } from "@/lib/auth";

/**
 * GET /auth/callback
 * Handles the redirect from Appwrite magic link emails and OAuth callbacks.
 * Exchanges the `userId` + `secret` query params for a session, then sends the
 * user to the `next` URL (or `/` by default).
 *
 * IMPORTANT: In Next.js Route Handlers, cookies MUST be set on the
 * NextResponse object itself — `cookies()` from `next/headers` does NOT
 * persist when a redirect response is returned.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const userId = searchParams.get("userId");
  const secret = searchParams.get("secret");
  const next = searchParams.get("next") ?? "/";

  if (!userId || !secret) {
    console.error("[auth/callback] Missing userId or secret params");
    return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
  }

  try {
    const client = createAdminClient();
    const account = new Account(client);
    const session = await account.createSession(userId, secret);

    // Ensure `next` is a relative path to prevent open-redirect attacks.
    const safePath = next.startsWith("/") ? next : "/";

    // Persist the session secret as an httpOnly cookie.
    // Use cookies() from next/headers to ensure it persists in the App Router.
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, session.secret, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });

    // Break the redirect chain with an HTML response.
    // Some browsers (like Safari and newer Chrome) drop Set-Cookie headers on 30x redirects
    // if the redirect chain started cross-site (e.g. from Google OAuth -> Appwrite -> here).
    // Returning a 200 OK with a client-side redirect guarantees the cookie is saved.
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Signing in...</title>
          <meta http-equiv="refresh" content="0;url=${safePath}">
          <script>
            window.location.replace("${safePath}");
          </script>
        </head>
        <body style="font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
          <p>Completing your sign in...</p>
        </body>
      </html>
    `;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html",
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : String(err);
    console.error("[auth/callback] createSession failed:", message);

    const errorCode = message.toLowerCase().includes("expired")
      ? "auth_callback_expired"
      : "auth_callback_error";

    return NextResponse.redirect(`${origin}/login?error=${errorCode}`);
  }
}
