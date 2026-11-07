/**
 * Two-factor authentication (TOTP) helpers.
 *
 * Appwrite native MFA, server-side only. All calls run with the *user's own*
 * session (createSessionClient), never the admin API key — MFA challenges
 * and authenticators are bound to the session that created them.
 *
 * Verified against node-appwrite v29 (installed) and the Appwrite MFA docs
 * (https://appwrite.io/docs/products/auth/mfa):
 * - Login: create session -> account.get() throws `user_more_factors_required`
 *   when MFA is enforced -> createMFAChallenge(factor) -> the user enters the
 *   code -> updateMFAChallenge(challengeId, otp) completes the session.
 * - Enrollment: createMFAAuthenticator('totp') gives { secret, uri } ->
 *   verify with updateMFAAuthenticator('totp', otp) -> generate recovery
 *   codes with createMFARecoveryCodes() -> enable with updateMFA(true).
 *   Recovery codes are shown BEFORE enabling MFA, exactly as the docs advise.
 * - Recovery: createMFAChallenge('recoverycode') + updateMFAChallenge with
 *   a recovery code.
 * - MFA is strictly opt-in. Users who never enroll see zero change: the
 *   login check is a single account.get() after session creation, and a
 *   successful get() proceeds exactly as before.
 */
import {
  Account,
  Avatars,
  AuthenticationFactor,
  AuthenticatorType,
} from "node-appwrite";
import { createAdminClient, createSessionClient } from "./appwrite";

/** Cookie holding a half-finished MFA login (challenge id + session secret). */
export const MFA_PENDING_COOKIE = "ea_mfa_pending";

/** How long a pending MFA login stays valid (Appwrite challenges expire). */
export const MFA_PENDING_MAX_AGE_SECONDS = 600; // 10 minutes

/** A TOTP code is exactly 6 digits. */
export const OTP_LENGTH = 6;

export type MfaFactor = "totp" | "recoverycode";

/** State carried in the pending-MFA cookie between the two login steps. */
export interface MfaPendingState {
  challengeId: string;
  sessionSecret: string;
  userId: string;
  factor: MfaFactor;
  /** Where to send the user after the challenge completes (safe path). */
  next: string;
  /** ISO timestamp when the challenge expires. */
  expiresAt: string;
}

/**
 * Minimal structural shape of the Appwrite Account service used by the MFA
 * flows. The real `Account` class satisfies it; tests pass a fake.
 * Uses the current (non-deprecated) `MFA` method names from node-appwrite v29.
 */
export interface MfaAccountClient {
  get(): Promise<{ $id: string; mfa: boolean }>;
  listMFAFactors(): Promise<{
    totp: boolean;
    phone: boolean;
    email: boolean;
    recoveryCode: boolean;
    custom: boolean;
  }>;
  updateMFA(params: { mfa: boolean }): Promise<unknown>;
  createMFAAuthenticator(params: {
    type: AuthenticatorType;
  }): Promise<{ secret: string; uri: string }>;
  updateMFAAuthenticator(params: {
    type: AuthenticatorType;
    otp: string;
  }): Promise<unknown>;
  deleteMFAAuthenticator(params: { type: AuthenticatorType }): Promise<unknown>;
  createMFAChallenge(params: {
    factor: AuthenticationFactor;
  }): Promise<{ $id: string; userId: string; expire: string }>;
  updateMFAChallenge(params: {
    challengeId: string;
    otp: string;
  }): Promise<{ $id: string; factors: string[]; secret: string }>;
  createMFARecoveryCodes(): Promise<{ recoveryCodes: string[] }>;
}

/** Build an MFA-capable Account client for a user session secret. */
export function mfaAccountForSession(sessionSecret: string): Account {
  return new Account(createSessionClient(sessionSecret));
}

// ── Pure helpers ────────────────────────────────────────────────────────────

/** True when `code` is a well-formed 6-digit TOTP code. */
export function isValidOtp(code: string): boolean {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code.trim());
}

/**
 * Pick which MFA factor a user-entered code belongs to.
 * A 6-digit code comes from the authenticator app; anything else the user
 * types is treated as a recovery code.
 */
export function resolveMfaFactor(code: string): MfaFactor {
  return isValidOtp(code) ? "totp" : "recoverycode";
}

/** True when an Appwrite error means "this session still needs an MFA step". */
export function isMfaRequiredError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { type?: unknown; message?: unknown };
  if (e.type === "user_more_factors_required") return true;
  return (
    typeof e.message === "string" &&
    e.message.includes("user_more_factors_required")
  );
}

/** True when an Appwrite error is a 404 / not-found (e.g. no authenticator). */
export function isNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; message?: unknown };
  if (e.code === 404) return true;
  return (
    typeof e.message === "string" &&
    e.message.toLowerCase().includes("not found")
  );
}

/**
 * Only allow redirect targets that stay on this site: relative paths, or
 * absolute URLs on examarchive.dev. Anything else falls back to "/".
 * Mirrors the allow-list in src/app/auth/callback/route.ts.
 */
export function resolveSafeNextPath(next: string | null | undefined): string {
  if (!next) return "/";
  if (next.startsWith("/")) return next;
  try {
    const url = new URL(next);
    if (
      url.hostname === "examarchive.dev" ||
      url.hostname.endsWith(".examarchive.dev")
    ) {
      return next;
    }
  } catch {
    // Not a URL — fall through to "/".
  }
  return "/";
}

/** Serialize pending MFA login state for the httpOnly cookie. */
export function encodeMfaPending(state: MfaPendingState): string {
  return JSON.stringify(state);
}

/** Parse pending MFA login state from the cookie. Returns null when invalid. */
export function decodeMfaPending(raw: string | null | undefined): MfaPendingState | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const p = parsed as Record<string, unknown>;
    if (
      typeof p.challengeId !== "string" ||
      !p.challengeId ||
      typeof p.sessionSecret !== "string" ||
      !p.sessionSecret ||
      typeof p.userId !== "string" ||
      !p.userId ||
      (p.factor !== "totp" && p.factor !== "recoverycode") ||
      typeof p.next !== "string" ||
      typeof p.expiresAt !== "string" ||
      Number.isNaN(Date.parse(p.expiresAt))
    ) {
      return null;
    }
    return {
      challengeId: p.challengeId,
      sessionSecret: p.sessionSecret,
      userId: p.userId,
      factor: p.factor,
      next: p.next,
      expiresAt: p.expiresAt,
    };
  } catch {
    return null;
  }
}

/** Cookie options shared by every place that writes the pending-MFA cookie. */
export function mfaPendingCookieOptions(): {
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  maxAge: number;
} {
  return {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MFA_PENDING_MAX_AGE_SECONDS,
  };
}

/**
 * Turn an Appwrite error into a short, user-facing message. Raw Appwrite
 * messages can leak internals, so unknown errors get a generic message
 * (the raw error is logged server-side by the caller).
 */
export function toFriendlyMfaError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err ?? "");
  const lower = message.toLowerCase();
  if (
    lower.includes("invalid otp") ||
    lower.includes("invalid `otp`") ||
    lower.includes("invalid code") ||
    lower.includes("invalid `code`")
  ) {
    return "That code did not work. Check your authenticator app and try again.";
  }
  if (lower.includes("expired")) {
    return "That code has expired. Sign in again to get a new one.";
  }
  if (lower.includes("rate limit")) {
    return "Too many attempts. Wait a bit and try again.";
  }
  if (lower.includes("not found")) {
    return "That code was not recognised. Try again or use a recovery code.";
  }
  return "Something went wrong. Please try again.";
}

// ── Session checks ──────────────────────────────────────────────────────────

export type SessionMfaCheck =
  | { needsMfa: false; userId: string }
  | { needsMfa: true };

/**
 * After a session is created (password, magic link, or OAuth), check whether
 * the account requires an MFA step. Appwrite answers that with the
 * `user_more_factors_required` error from account.get().
 * Any other error is rethrown — the login must fail closed, never silently
 * skip the MFA check.
 */
export async function checkSessionNeedsMfa(
  account: MfaAccountClient,
): Promise<SessionMfaCheck> {
  try {
    const user = await account.get();
    return { needsMfa: false, userId: user.$id };
  } catch (err) {
    if (isMfaRequiredError(err)) return { needsMfa: true };
    throw err;
  }
}

/**
 * Start the second login step for a half-finished session: pick the best
 * available factor (authenticator app first, recovery code second, then
 * email/phone if those are the only ones) and create the challenge.
 */
export async function startLoginChallenge(account: MfaAccountClient): Promise<{
  challengeId: string;
  factor: MfaFactor;
  userId: string;
  expire: string;
}> {
  const factors = await account.listMFAFactors();
  const factor: AuthenticationFactor = factors.totp
    ? AuthenticationFactor.Totp
    : factors.recoveryCode
      ? AuthenticationFactor.Recoverycode
      : factors.email
        ? AuthenticationFactor.Email
        : AuthenticationFactor.Phone;
  const challenge = await account.createMFAChallenge({ factor });
  const mapped: MfaFactor =
    factor === AuthenticationFactor.Totp ? "totp" : "recoverycode";
  return {
    challengeId: challenge.$id,
    factor: mapped,
    userId: challenge.userId,
    expire: challenge.expire,
  };
}

/**
 * Complete the second login step. Returns the finished session; its
 * `factors` now include the second factor (e.g. ["password", "totp"]).
 * The returned `secret` is the session secret to persist (falls back to
 * the original secret when Appwrite does not rotate it).
 */
export async function completeLoginChallenge(
  account: MfaAccountClient,
  challengeId: string,
  otp: string,
): Promise<{ $id: string; factors: string[]; secret: string }> {
  const trimmed = otp.trim();
  if (!trimmed) throw new Error("Enter the code from your authenticator app.");
  return account.updateMFAChallenge({ challengeId, otp: trimmed });
}

/**
 * Given a freshly created session secret, decide whether the account needs
 * an MFA step and, if so, start the challenge. Returns the pending state
 * to store in the cookie, or null when the session is already complete.
 * Shared by the password login and the magic-link / OAuth callback.
 */
export async function beginMfaLoginIfNeeded(
  sessionSecret: string,
  userId: string,
  next: string,
): Promise<MfaPendingState | null> {
  const account = mfaAccountForSession(sessionSecret);
  const check = await checkSessionNeedsMfa(account);
  if (!check.needsMfa) return null;
  const challenge = await startLoginChallenge(account);
  return {
    challengeId: challenge.challengeId,
    sessionSecret,
    userId: userId || challenge.userId,
    factor: challenge.factor,
    next: resolveSafeNextPath(next),
    expiresAt: challenge.expire,
  };
}

// ── Enrollment / account management ─────────────────────────────────────────

/** MFA status for the signed-in account. */
export async function getMfaStatus(account: MfaAccountClient): Promise<{
  enabled: boolean;
  totpEnabled: boolean;
}> {
  const [user, factors] = await Promise.all([
    account.get(),
    account.listMFAFactors(),
  ]);
  return { enabled: user.mfa === true, totpEnabled: factors.totp === true };
}

export interface TotpEnrollmentStart {
  secret: string;
  uri: string;
  /** PNG data URL of the QR code, or null when QR rendering failed. */
  qrDataUrl: string | null;
}

/** Render an otpauth URI as a PNG data URL using Appwrite Avatars. */
export async function renderQrDataUrl(uri: string): Promise<string | null> {
  try {
    const avatars = new Avatars(createAdminClient());
    const buffer = await avatars.getQR(uri, 400);
    return `data:image/png;base64,${Buffer.from(buffer).toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Step 1 of enrollment: create the TOTP authenticator. Returns the secret
 * and otpauth URI (plus a QR code image when rendering works). The
 * authenticator is NOT enforced yet — that happens in enableMfa(), only
 * after the user verifies a code and saves their recovery codes.
 */
export async function startTotpEnrollment(
  account: MfaAccountClient,
  renderQr: (uri: string) => Promise<string | null> = renderQrDataUrl,
): Promise<TotpEnrollmentStart> {
  const authenticator = await account.createMFAAuthenticator({
    type: AuthenticatorType.Totp,
  });
  const qrDataUrl = await renderQr(authenticator.uri);
  return {
    secret: authenticator.secret,
    uri: authenticator.uri,
    qrDataUrl,
  };
}

/**
 * Step 2 of enrollment: verify the authenticator with a 6-digit code from
 * the app. Does NOT enable MFA yet — recovery codes come first.
 */
export async function verifyTotpEnrollment(
  account: MfaAccountClient,
  otp: string,
): Promise<{ ok: true }> {
  if (!isValidOtp(otp)) {
    throw new Error("Enter the 6-digit code from your authenticator app.");
  }
  await account.updateMFAAuthenticator({
    type: AuthenticatorType.Totp,
    otp: otp.trim(),
  });
  return { ok: true };
}

/**
 * Step 3 of enrollment: generate the recovery codes. Shown to the user
 * ONCE — Appwrite only returns them at generation time.
 */
export async function generateMfaRecoveryCodes(
  account: MfaAccountClient,
): Promise<string[]> {
  const res = await account.createMFARecoveryCodes();
  if (!Array.isArray(res.recoveryCodes) || res.recoveryCodes.length === 0) {
    throw new Error("Could not generate recovery codes. Please try again.");
  }
  return res.recoveryCodes;
}

/** Step 4 of enrollment: enforce MFA on the account. */
export async function enableMfa(account: MfaAccountClient): Promise<{ ok: true }> {
  await account.updateMFA({ mfa: true });
  return { ok: true };
}

/**
 * Turn MFA off. Requires proof of possession: a current TOTP code or a
 * recovery code. The code proves the factor first (challenge), then the
 * authenticator is removed and MFA enforcement is switched off. If the
 * authenticator is already gone, disabling still proceeds.
 */
export async function disableMfa(
  account: MfaAccountClient,
  code: string,
): Promise<{ ok: true }> {
  const trimmed = code.trim();
  if (!trimmed) {
    throw new Error("Enter the code from your authenticator app or a recovery code.");
  }
  const factor =
    resolveMfaFactor(trimmed) === "totp"
      ? AuthenticationFactor.Totp
      : AuthenticationFactor.Recoverycode;
  const challenge = await account.createMFAChallenge({ factor });
  await account.updateMFAChallenge({ challengeId: challenge.$id, otp: trimmed });
  try {
    await account.deleteMFAAuthenticator({ type: AuthenticatorType.Totp });
  } catch (err) {
    // Already gone (e.g. removed elsewhere) — disabling must still proceed.
    if (!isNotFoundError(err)) throw err;
  }
  await account.updateMFA({ mfa: false });
  return { ok: true };
}
