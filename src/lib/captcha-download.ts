import { createHmac, timingSafeEqual } from "node:crypto";

const HCAPTCHA_SITEVERIFY_URL = "https://api.hcaptcha.com/siteverify";
const CAPTCHA_TOKEN_TTL_SECONDS = 10 * 60; // 10 minutes
const FILE_ID_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;

function getHCaptchaSecret(): string | null {
  const raw = process.env.HCAPTCHA_SECRET_KEY;
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return value.length > 0 ? value : null;
}

export function isValidFileId(fileId: string): boolean {
  return FILE_ID_PATTERN.test(fileId);
}

/**
 * Verifies an hCaptcha client token with the hCaptcha siteverify API.
 * Returns true only when hCaptcha confirms the token is valid.
 */
export async function verifyHCaptchaToken(token: string): Promise<boolean> {
  const result = await verifyHCaptchaTokenDetailed(token);
  return result.ok;
}

/**
 * Same as verifyHCaptchaToken, but also returns the failure reason so the
 * caller can surface it (diagnostic). reason is "ok" on success, otherwise
 * one of: secret-not-set, bad-token, siteverify-http-<status>,
 * the hCaptcha error-codes (e.g. invalid-input-secret), or fetch-failed:<msg>.
 */
export async function verifyHCaptchaTokenDetailed(
  token: string,
): Promise<{ ok: boolean; reason: string }> {
  const secret = getHCaptchaSecret();
  const clean = String(token || "").trim();
  if (!secret) {
    console.error("[hcaptcha] verify failed: HCAPTCHA_SECRET_KEY is not set");
    return { ok: false, reason: "secret-not-set" };
  }
  // Only reject an empty token. Do NOT cap the length: hCaptcha response
  // tokens vary and can exceed 2048 chars; siteverify is the authority on
  // whether a token is valid. (A 2048 cap here wrongly rejected real tokens.)
  if (!clean) return { ok: false, reason: "bad-token" };
  try {
    const res = await fetch(HCAPTCHA_SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: clean }).toString(),
    });
    if (!res.ok) {
      console.error("[hcaptcha] siteverify HTTP error:", res.status);
      return { ok: false, reason: `siteverify-http-${res.status}` };
    }
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (data.success === true) return { ok: true, reason: "ok" };
    const codes = (data["error-codes"] || []).join(",") || "unknown";
    console.error("[hcaptcha] siteverify rejected token:", codes);
    return { ok: false, reason: codes };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[hcaptcha] siteverify fetch failed:", msg);
    return { ok: false, reason: `fetch-failed:${msg}` };
  }
}

function signCaptchaToken(fileId: string, expires: number): string {
  const secret = getHCaptchaSecret() as string;
  return createHmac("sha256", secret).update(`${fileId}:${expires}`).digest("hex");
}

/**
 * Creates a short-lived download token proving the visitor passed CAPTCHA.
 * Format: "<expires>.<hex-signature>". Bound to the fileId via HMAC.
 */
export function createCaptchaDownloadToken(fileId: string): string | null {
  if (!getHCaptchaSecret() || !isValidFileId(fileId)) return null;
  const expires = Math.floor(Date.now() / 1000) + CAPTCHA_TOKEN_TTL_SECONDS;
  return `${expires}.${signCaptchaToken(fileId, expires)}`;
}

/**
 * Verifies a CAPTCHA download token from the `ctoken` query param.
 */
export function verifyCaptchaDownloadToken(args: { fileId: string; token: string }): boolean {
  const { fileId } = args;
  const token = String(args.token || "").trim();
  if (!getHCaptchaSecret() || !isValidFileId(fileId) || !token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expires = Number(token.slice(0, dot));
  const sig = token.slice(dot + 1);
  if (!Number.isFinite(expires) || !/^[a-f0-9]{64}$/i.test(sig)) return false;
  if (expires < Math.floor(Date.now() / 1000)) return false;
  const expected = signCaptchaToken(fileId, expires);
  const a = Buffer.from(sig.toLowerCase(), "utf8");
  const b = Buffer.from(expected.toLowerCase(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
