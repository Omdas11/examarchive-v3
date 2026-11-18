import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  CF_SESSION_COOKIE,
  checkAuthRateLimit,
  clientIp,
  createSession,
  sessionCookieOptions,
  upsertGoogleUser,
} from "@/lib/auth-cf";
import {
  OAUTH_STATE_COOKIE,
  decodeOAuthState,
  exchangeGoogleCode,
  fetchGoogleUserinfo,
  getGoogleOAuthConfig,
  getGoogleRedirectUri,
  isHttpsRequest,
  safeRedirect,
} from "@/lib/google-oauth";

/**
 * GET /api/auth/callback/google?code=&state=
 * Google redirects here after the user approves sign-in.
 * Validates `state` against the cookie set when the flow started,
 * exchanges the code for tokens, reads the verified Google profile,
 * upserts the user in D1, creates a session and redirects home.
 *
 * Failure modes (all redirect to /login with an error code, never a 500
 * page): missing/invalid state, Google errors, unverified email, or the
 * Google credentials not being configured yet (owner step).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const fail = (error: string) =>
    NextResponse.redirect(new URL(`/login?error=${error}`, url.origin));

  if (!(await checkAuthRateLimit(clientIp(request), "google-callback"))) {
    return fail("rate_limit");
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const googleError = url.searchParams.get("error");
  if (googleError || !code || !state) {
    return fail("oauth_failed");
  }

  // CSRF check: state must match the cookie set when the flow started.
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  const payload = stateCookie ? decodeOAuthState(stateCookie) : null;

  // Clear the state cookie on every outcome (single-use).
  const clearState = (response: NextResponse) => {
    response.cookies.set(OAUTH_STATE_COOKIE, "", {
      httpOnly: true,
      secure: isHttpsRequest(request),
      sameSite: "lax",
      path: "/api/auth",
      maxAge: 0,
    });
    return response;
  };

  if (!payload || payload.state !== state) {
    return clearState(fail("oauth_state"));
  }

  const config = getGoogleOAuthConfig();
  if (!config) {
    return clearState(fail("oauth_config"));
  }

  const redirectUri = getGoogleRedirectUri(request);

  let userinfo;
  try {
    const tokens = await exchangeGoogleCode({
      code,
      codeVerifier: payload.verifier,
      redirectUri,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    });
    userinfo = await fetchGoogleUserinfo(tokens.access_token);
  } catch (err) {
    console.error("[google-oauth] callback failed", err);
    return clearState(fail("oauth_failed"));
  }

  // Only verified Google emails may sign in.
  if (!userinfo.verifiedEmail) {
    return clearState(fail("oauth_unverified"));
  }

  let userId: string;
  try {
    userId = await upsertGoogleUser(userinfo);
  } catch (err) {
    console.error("[google-oauth] user upsert failed", err);
    return clearState(fail("oauth_failed"));
  }

  let token: string;
  try {
    token = await createSession(userId);
  } catch (err) {
    console.error("[google-oauth] session create failed", err);
    return clearState(fail("oauth_failed"));
  }

  const destination = safeRedirect(payload.redirect);
  const response = NextResponse.redirect(new URL(destination, url.origin));
  response.cookies.set(
    CF_SESSION_COOKIE,
    token,
    sessionCookieOptions(isHttpsRequest(request)),
  );
  return clearState(response);
}
