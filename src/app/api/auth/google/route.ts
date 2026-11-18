import { NextResponse } from "next/server";
import { checkAuthRateLimit, clientIp } from "@/lib/auth-cf";
import {
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_TTL_SECONDS,
  buildGoogleAuthUrl,
  encodeOAuthState,
  getGoogleOAuthConfig,
  getGoogleRedirectUri,
  isHttpsRequest,
  pkceChallenge,
  randomString,
  safeRedirect,
} from "@/lib/google-oauth";

/**
 * GET /api/auth/google?redirect=/profile
 * Starts Google sign-in: random `state` + PKCE verifier stored in a
 * short-lived httpOnly cookie, then redirect to Google.
 *
 * Without GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (Worker secrets, set by
 * the owner) the login page's Google button leads here and back to
 * /login?error=oauth_config — the owner step is documented in
 * docs/cloudflare-migration/phase5-google-auth.md.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirect = safeRedirect(url.searchParams.get("redirect"));

  if (!(await checkAuthRateLimit(clientIp(request), "google-start"))) {
    return NextResponse.redirect(
      new URL("/login?error=rate_limit", url.origin),
    );
  }

  const config = getGoogleOAuthConfig();
  if (!config) {
    return NextResponse.redirect(
      new URL("/login?error=oauth_config", url.origin),
    );
  }

  const state = randomString();
  const verifier = randomString(64);
  const challenge = await pkceChallenge(verifier);
  const redirectUri = getGoogleRedirectUri(request);

  const authUrl = buildGoogleAuthUrl({
    clientId: config.clientId,
    redirectUri,
    state,
    codeChallenge: challenge,
  });

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(
    OAUTH_STATE_COOKIE,
    encodeOAuthState({ state, verifier, redirect }),
    {
      httpOnly: true,
      secure: isHttpsRequest(request),
      sameSite: "lax",
      path: "/api/auth",
      maxAge: OAUTH_STATE_TTL_SECONDS,
    },
  );
  return response;
}
