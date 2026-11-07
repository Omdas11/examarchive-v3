"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Account, AuthenticationFactor } from "node-appwrite";
import { createSessionClient } from "@/lib/appwrite";
import { SESSION_COOKIE } from "@/lib/auth";
import {
  MFA_PENDING_COOKIE,
  completeLoginChallenge,
  decodeMfaPending,
  disableMfa,
  enableMfa,
  encodeMfaPending,
  generateMfaRecoveryCodes,
  getMfaStatus,
  mfaAccountForSession,
  mfaPendingCookieOptions,
  resolveSafeNextPath,
  startTotpEnrollment,
  toFriendlyMfaError,
  verifyTotpEnrollment,
  type MfaPendingState,
} from "@/lib/mfa";

export type MfaActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

/** Session cookie options — identical to the password login in actions.ts. */
function sessionCookieOptions(): {
  path: string;
  domain: string | undefined;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  maxAge: number;
} {
  return {
    path: "/",
    domain: process.env.NODE_ENV === "production" ? ".examarchive.dev" : undefined,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year – Appwrite manages actual expiry
  };
}

async function sessionAccount(): Promise<Account | null> {
  const cookieStore = await cookies();
  const secret = cookieStore.get(SESSION_COOKIE)?.value;
  if (!secret) return null;
  return mfaAccountForSession(secret);
}

/** Read the pending MFA login state. Null when absent, expired, or corrupt. */
async function readPendingMfa(): Promise<MfaPendingState | null> {
  const cookieStore = await cookies();
  const pending = decodeMfaPending(cookieStore.get(MFA_PENDING_COOKIE)?.value);
  if (!pending) return null;
  if (Date.parse(pending.expiresAt) <= Date.now()) return null;
  return pending;
}

async function clearPendingMfaCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(MFA_PENDING_COOKIE, "", { ...mfaPendingCookieOptions(), maxAge: 0 });
}

// ── Enrollment / account management (Settings) ─────────────────────────────

export async function getMfaStatusAction(): Promise<
  MfaActionResult<{ enabled: boolean; totpEnabled: boolean }>
> {
  try {
    const account = await sessionAccount();
    if (!account) return { ok: false, error: "not_signed_in" };
    const status = await getMfaStatus(account);
    return { ok: true, ...status };
  } catch (err) {
    console.error("[mfa] getMfaStatus failed:", err);
    return { ok: false, error: "Could not load two-factor status. Please try again." };
  }
}

export async function startMfaEnrollmentAction(): Promise<
  MfaActionResult<{ secret: string; uri: string; qrDataUrl: string | null }>
> {
  try {
    const account = await sessionAccount();
    if (!account) return { ok: false, error: "not_signed_in" };
    const status = await getMfaStatus(account);
    if (status.enabled) {
      return { ok: false, error: "Two-factor authentication is already on." };
    }
    const enrollment = await startTotpEnrollment(account);
    return { ok: true, ...enrollment };
  } catch (err) {
    console.error("[mfa] startMfaEnrollment failed:", err);
    return { ok: false, error: toFriendlyMfaError(err) };
  }
}

export async function verifyMfaEnrollmentAction(
  formData: FormData,
): Promise<MfaActionResult> {
  try {
    const account = await sessionAccount();
    if (!account) return { ok: false, error: "not_signed_in" };
    const otp = (formData.get("otp") as string | null) ?? "";
    await verifyTotpEnrollment(account, otp);
    return { ok: true };
  } catch (err) {
    console.error("[mfa] verifyMfaEnrollment failed:", err);
    return { ok: false, error: toFriendlyMfaError(err) };
  }
}

export async function generateMfaRecoveryCodesAction(): Promise<
  MfaActionResult<{ codes: string[] }>
> {
  try {
    const account = await sessionAccount();
    if (!account) return { ok: false, error: "not_signed_in" };
    const codes = await generateMfaRecoveryCodes(account);
    return { ok: true, codes };
  } catch (err) {
    console.error("[mfa] generateMfaRecoveryCodes failed:", err);
    return { ok: false, error: toFriendlyMfaError(err) };
  }
}

export async function enableMfaAction(): Promise<MfaActionResult> {
  try {
    const account = await sessionAccount();
    if (!account) return { ok: false, error: "not_signed_in" };
    await enableMfa(account);
    return { ok: true };
  } catch (err) {
    console.error("[mfa] enableMfa failed:", err);
    return { ok: false, error: toFriendlyMfaError(err) };
  }
}

export async function disableMfaAction(
  formData: FormData,
): Promise<MfaActionResult> {
  try {
    const account = await sessionAccount();
    if (!account) return { ok: false, error: "not_signed_in" };
    const code = (formData.get("code") as string | null) ?? "";
    await disableMfa(account, code);
    return { ok: true };
  } catch (err) {
    console.error("[mfa] disableMfa failed:", err);
    return { ok: false, error: toFriendlyMfaError(err) };
  }
}

// ── Login challenge ─────────────────────────────────────────────────────────

/**
 * Complete the second login step. On success the session cookie is issued
 * and the user is sent to their original destination. On failure the user
 * is sent back to the MFA step with an error.
 *
 * NOTE: redirect() is called outside the try/catch (see actions.ts) —
 * Next.js implements redirect() by throwing, and catching it would turn
 * the redirect into a login error.
 */
export async function verifyMfaLoginAction(formData: FormData): Promise<void> {
  const pending = await readPendingMfa();
  if (!pending) {
    redirect("/login?error=mfa_session_expired");
  }

  const code = (formData.get("code") as string | null) ?? "";
  let failure: string | null = null;
  let sessionSecret: string | null = null;

  try {
    const account = mfaAccountForSession(pending.sessionSecret);
    const session = await completeLoginChallenge(
      account,
      pending.challengeId,
      code,
    );
    sessionSecret = session.secret || pending.sessionSecret;
  } catch (err) {
    console.error("[mfa] verifyMfaLogin failed:", err);
    failure = toFriendlyMfaError(err);
  }

  if (!sessionSecret) {
    redirect(`/login/mfa?error=${encodeURIComponent(failure ?? "Something went wrong. Please try again.")}`);
  }

  const cookieStore = await cookies();
  await clearPendingMfaCookie();
  cookieStore.set(SESSION_COOKIE, sessionSecret, sessionCookieOptions());
  redirect(resolveSafeNextPath(pending.next));
}

/**
 * Switch the login challenge to the other factor (authenticator app <->
 * recovery code). Creates a fresh challenge and stores it in the pending
 * cookie, then sends the user back to the MFA step.
 */
export async function switchMfaLoginFactorAction(
  formData: FormData,
): Promise<void> {
  const pending = await readPendingMfa();
  if (!pending) {
    redirect("/login?error=mfa_session_expired");
  }

  const wanted = (formData.get("factor") as string | null) ?? "";
  const factor =
    wanted === "recoverycode"
      ? AuthenticationFactor.Recoverycode
      : AuthenticationFactor.Totp;

  let failure: string | null = null;
  let nextPending: MfaPendingState | null = null;

  try {
    const account = mfaAccountForSession(pending.sessionSecret);
    const challenge = await account.createMFAChallenge({ factor });
    nextPending = {
      ...pending,
      challengeId: challenge.$id,
      factor: factor === AuthenticationFactor.Totp ? "totp" : "recoverycode",
      expiresAt: challenge.expire,
    };
  } catch (err) {
    console.error("[mfa] switchMfaLoginFactor failed:", err);
    failure = toFriendlyMfaError(err);
  }

  if (!nextPending) {
    redirect(`/login/mfa?error=${encodeURIComponent(failure ?? "Something went wrong. Please try again.")}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(
    MFA_PENDING_COOKIE,
    encodeMfaPending(nextPending),
    mfaPendingCookieOptions(),
  );
  redirect("/login/mfa");
}

/**
 * Abandon the MFA step: delete the half-finished session (best effort) and
 * send the user back to the sign-in page.
 */
export async function cancelMfaLoginAction(): Promise<void> {
  const pending = await readPendingMfa();
  if (pending) {
    try {
      const account = new Account(createSessionClient(pending.sessionSecret));
      await account.deleteSession("current");
    } catch {
      // The partial session may already be gone — continue to sign-in.
    }
  }
  await clearPendingMfaCookie();
  redirect("/login");
}
