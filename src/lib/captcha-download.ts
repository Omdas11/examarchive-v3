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
  const secret = getHCaptchaSecret();
  const clean = String(token || "").trim();
  if (!secret || !clean || clean.length > 2048) return false;
  try {
    const res = await fetch(HCAPTCHA_SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: clean }).toString(),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
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
