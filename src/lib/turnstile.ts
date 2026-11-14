import { createHmac, timingSafeEqual } from "node:crypto";

const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_TOKEN_TTL_SECONDS = 10 * 60; // 10 minutes
const FILE_ID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;

function getTurnstileSecret(): string | null {
  const raw = process.env.TURNSTILE_SECRET_KEY;
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return value.length > 0 ? value : null;
}

export function isValidFileId(fileId: string): boolean {
  return FILE_ID_PATTERN.test(fileId);
}

/**
 * Verifies a Cloudflare Turnstile client token with the Turnstile
 * siteverify API. Returns true only when Cloudflare confirms the token
 * is valid.
 */
export async function verifyTurnstileToken(token: string): Promise<boolean> {
  const result = await verifyTurnstileTokenDetailed(token);
  return result.ok;
}

/**
 * Same as verifyTurnstileToken, but also returns the failure reason so the
 * caller can surface it (diagnostic). reason is "ok" on success, otherwise
 * one of: secret-not-set, bad-token, siteverify-http-<status>,
 * the Turnstile error-codes (e.g. invalid-input-secret), or fetch-failed:<msg>.
 */
export async function verifyTurnstileTokenDetailed(
  token: string,
): Promise<{ ok: boolean; reason: string }> {
  const secret = getTurnstileSecret();
  const clean = String(token || "").trim();
  if (!secret) {
    console.error("[turnstile] verify failed: TURNSTILE_SECRET_KEY is not set");
    return { ok: false, reason: "secret-not-set" };
  }
  // Only reject an empty token. Do NOT cap the length: Turnstile response
  // tokens vary; siteverify is the authority on whether a token is valid.
  if (!clean) return { ok: false, reason: "bad-token" };
  try {
    const res = await fetch(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: clean }).toString(),
    });
    if (!res.ok) {
      console.error("[turnstile] siteverify HTTP error:", res.status);
      return { ok: false, reason: `siteverify-http-${res.status}` };
    }
    const data = (await res.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    if (data.success === true) return { ok: true, reason: "ok" };
    const codes = (data["error-codes"] || []).join(",") || "unknown";
    console.error("[turnstile] siteverify rejected token:", codes);
    return { ok: false, reason: codes };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[turnstile] siteverify fetch failed:", msg);
    return { ok: false, reason: `fetch-failed:${msg}` };
  }
}

function signTurnstileToken(fileId: string, expires: number): string {
  const secret = getTurnstileSecret() as string;
  return createHmac("sha256", secret).update(`${fileId}:${expires}`).digest("hex");
}

/**
 * Creates a short-lived download token proving the visitor passed Turnstile.
 * Format: "<expires>.<hex-signature>". Bound to the fileId via HMAC.
 */
export function createTurnstileDownloadToken(fileId: string): string | null {
  if (!getTurnstileSecret() || !isValidFileId(fileId)) return null;
  const expires = Math.floor(Date.now() / 1000) + TURNSTILE_TOKEN_TTL_SECONDS;
  return `${expires}.${signTurnstileToken(fileId, expires)}`;
}

/**
 * Verifies a Turnstile download token from the `ctoken` query param.
 */
export function verifyTurnstileDownloadToken(args: {
  fileId: string;
  token: string;
}): boolean {
  const { fileId } = args;
  const token = String(args.token || "").trim();
  if (!getTurnstileSecret() || !isValidFileId(fileId) || !token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expires = Number(token.slice(0, dot));
  const sig = token.slice(dot + 1);
  if (!Number.isFinite(expires) || !/^[a-f0-9]{64}$/i.test(sig)) return false;
  if (expires < Math.floor(Date.now() / 1000)) return false;
  const expected = signTurnstileToken(fileId, expires);
  const a = Buffer.from(sig.toLowerCase(), "utf8");
  const b = Buffer.from(expected.toLowerCase(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
