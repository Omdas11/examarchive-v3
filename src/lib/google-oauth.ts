/**
 * Google OAuth (OIDC) helpers for the Cloudflare build (Phase 5).
 * Hand-rolled with fetch + Web Crypto — no new dependency.
 *
 * Flow (see docs/cloudflare-migration/phase5-google-auth.md):
 *   GET /api/auth/google
 *     → random `state` + PKCE verifier, stored in a short-lived httpOnly
 *       cookie → redirect to accounts.google.com
 *   GET /api/auth/callback/google?code=&state=
 *     → validate state, exchange code for tokens, read the user profile
 *       from Google's userinfo endpoint with the fresh access token
 *       (no ID-token signature verification needed: the token was just
 *       minted by Google in the code exchange).
 *
 * Secrets come from Worker env (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
 * via `wrangler secret put`; `.dev.vars` locally). They are read from
 * `process.env` at request time — the same pattern the Turnstile code
 * already uses on Workers. Never commit them.
 *
 * The redirect URI is derived from the request's own origin, so it is
 * exactly `https://examarchive.dev/api/auth/callback/google` on the live
 * site and `http://localhost:3000/api/auth/callback/google` in local dev
 * — both registered on the OAuth client. The workers.dev preview is NOT
 * registered: Google rejects the callback there with redirect_uri_mismatch
 * unless the owner adds that URI to the client too.
 */
import type { GoogleIdentity } from "./auth-cf";

/** Short-lived state cookie (10 min) holding state + PKCE verifier. */
export const OAUTH_STATE_COOKIE = "ea_oauth_state";
export const OAUTH_STATE_TTL_SECONDS = 600;

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL =
  "https://openidconnect.googleapis.com/v1/userinfo";

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
}

/**
 * Read the Google OAuth client credentials. Returns null when either is
 * missing — callers redirect to /login?error=oauth_config in that case.
 */
export function getGoogleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/**
 * The callback URL Google must redirect to, derived from the request's
 * own origin. Must match an Authorized redirect URI on the OAuth client
 * exactly, or Google rejects the flow.
 */
export function getGoogleRedirectUri(request: Request): string {
  const origin = new URL(request.url).origin;
  return `${origin}/api/auth/callback/google`;
}

/** Whether this request is over HTTPS (decides the Secure cookie flag). */
export function isHttpsRequest(request: Request): boolean {
  return new URL(request.url).protocol === "https:";
}

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Random base64url string (default 32 bytes of entropy). */
export function randomString(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return base64url(arr);
}

/** PKCE S256 code challenge for a verifier. */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64url(new Uint8Array(digest));
}

/** Build the Google authorization URL. */
export function buildGoogleAuthUrl(args: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", args.clientId);
  url.searchParams.set("redirect_uri", args.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", args.state);
  url.searchParams.set("code_challenge", args.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export interface GoogleTokens {
  access_token: string;
  id_token?: string;
  expires_in?: number;
  token_type?: string;
}

/** Exchange an authorization code for tokens (with the PKCE verifier). */
export async function exchangeGoogleCode(args: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    code: args.code,
    client_id: args.clientId,
    client_secret: args.clientSecret,
    redirect_uri: args.redirectUri,
    grant_type: "authorization_code",
    code_verifier: args.codeVerifier,
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed (${res.status})`);
  }
  const tokens = (await res.json()) as GoogleTokens;
  if (!tokens.access_token) {
    throw new Error("Google token exchange returned no access token");
  }
  return tokens;
}

interface GoogleUserinfoResponse {
  sub?: unknown;
  email?: unknown;
  verified_email?: unknown;
  name?: unknown;
  picture?: unknown;
}

/** Verified Google profile: identity + whether Google verified the email. */
export interface GoogleUserinfo extends GoogleIdentity {
  verifiedEmail: boolean;
}

/**
 * Read the verified profile from Google's userinfo endpoint using the
 * freshly minted access token. Throws when the token is invalid or the
 * response is missing the fields sign-in needs.
 */
export async function fetchGoogleUserinfo(
  accessToken: string,
): Promise<GoogleUserinfo> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error(`Google userinfo failed (${res.status})`);
  }
  const data = (await res.json()) as GoogleUserinfoResponse;
  const sub = typeof data.sub === "string" ? data.sub : "";
  const email = typeof data.email === "string" ? data.email : "";
  if (!sub || !email) {
    throw new Error("Google userinfo missing sub/email");
  }
  return {
    sub,
    email,
    name: typeof data.name === "string" ? data.name : "",
    picture: typeof data.picture === "string" ? data.picture : "",
    verifiedEmail: data.verified_email === true,
  };
}

/** State payload stored in the short-lived cookie. */
export interface OAuthStatePayload {
  state: string;
  verifier: string;
  /** Same-site path to send the user to after sign-in (default "/"). */
  redirect: string;
}

export function encodeOAuthState(payload: OAuthStatePayload): string {
  const json = JSON.stringify(payload);
  return base64url(new TextEncoder().encode(json));
}

export function decodeOAuthState(
  value: string,
): OAuthStatePayload | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded);
    const parsed = JSON.parse(json) as OAuthStatePayload;
    if (
      typeof parsed.state !== "string" ||
      typeof parsed.verifier !== "string" ||
      typeof parsed.redirect !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Validate a post-login redirect target: same-site path only
 * (starts with "/" but not "//"). Anything else falls back to "/".
 */
export function safeRedirect(target: string | null): string {
  if (!target) return "/";
  if (!target.startsWith("/") || target.startsWith("//")) return "/";
  return target;
}
