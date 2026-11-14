import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getServerUser } from "@/lib/auth";
import {
  DISCORD_OAUTH_STATE_COOKIE,
  discordAuthorizeUrl,
} from "@/lib/discord-oauth";

/**
 * Start Discord account linking. Logged-in users only.
 * Generates a random state token, stores it in an httpOnly cookie, and
 * redirects to Discord's authorization page.
 */
export async function GET() {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/login?next=/profile", "https://examarchive.dev"),
    );
  }

  const state = randomBytes(24).toString("hex");
  const res = NextResponse.redirect(discordAuthorizeUrl(state));
  res.cookies.set(DISCORD_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/auth/discord/callback",
    maxAge: 600, // 10 minutes
  });
  return res;
}
