/**
 * Verify-to-earn: pure reward rules for verifying AI content.
 *
 * One verification row exists per (user, content). Changing a verdict
 * updates the row but never pays twice. Daily caps bound farming.
 * Correction bonuses are moderator-gated and bypass the daily caps.
 */

export const VERIFY_CONTENT_TYPES = ["note", "solved-paper", "syllabus", "paper-md"] as const;
export type VerifyContentType = (typeof VERIFY_CONTENT_TYPES)[number];

export const VERIFY_VERDICTS = ["correct", "flagged"] as const;
export type VerifyVerdict = (typeof VERIFY_VERDICTS)[number];

/** Verification row status: flagged rows wait for moderator review. */
export const VERIFY_STATUSES = ["pending", "accepted", "rejected"] as const;
export type VerifyStatus = (typeof VERIFY_STATUSES)[number];

/** Rewards for marking content correct. */
export const VERIFY_CORRECT_XP = 10;
export const VERIFY_CORRECT_CREDITS = 1;
/** Immediate reward for reporting an error (bonus follows on acceptance). */
export const VERIFY_FLAG_XP = 10;
/** Bonus when a moderator accepts a correction. */
export const CORRECTION_BONUS_XP = 25;
export const CORRECTION_BONUS_CREDITS = 5;
/** Daily caps on verification rewards (bonus bypasses caps). */
export const VERIFY_DAILY_XP_CAP = 100;
export const VERIFY_DAILY_CREDIT_CAP = 10;

export function isValidVerifyContentType(value: unknown): value is VerifyContentType {
  return typeof value === "string" && (VERIFY_CONTENT_TYPES as readonly string[]).includes(value);
}

export function isValidVerifyVerdict(value: unknown): value is VerifyVerdict {
  return typeof value === "string" && (VERIFY_VERDICTS as readonly string[]).includes(value);
}

/**
 * JSON-safe view of a verification document. The node-appwrite SDK returns
 * integer fields as BigInt at runtime, which crashes JSON responses, so
 * numeric fields are coerced with Number() here.
 */
export function verificationToJson(doc: Record<string, unknown>): Record<string, unknown> {
  return {
    id: (doc.$id as string) ?? (doc.id as string) ?? "",
    user_id: (doc.user_id as string) ?? "",
    content_type: (doc.content_type as string) ?? "",
    content_id: (doc.content_id as string) ?? "",
    verdict: (doc.verdict as string) ?? "",
    correction: (doc.correction as string) ?? "",
    xp_awarded: Number(doc.xp_awarded ?? 0),
    credits_awarded: Number(doc.credits_awarded ?? 0),
    status: (doc.status as string) ?? "",
    created_at: (doc.$createdAt as string) ?? "",
  };
}

function clampAward(want: number, already: number, cap: number): number {
  return Math.max(0, Math.min(want, cap - already));
}

/**
 * Compute the immediate XP/credit award for a new verification,
 * given what the user already earned from verification today.
 * Flagged rows earn XP only; the credit bonus comes on acceptance.
 */
export function verifyAwards(args: {
  verdict: VerifyVerdict;
  xpToday: number;
  creditsToday: number;
}): { xp: number; credits: number } {
  const xp = clampAward(VERIFY_FLAG_XP, args.xpToday, VERIFY_DAILY_XP_CAP);
  if (args.verdict === "flagged") {
    return { xp, credits: 0 };
  }
  return {
    xp,
    credits: clampAward(VERIFY_CORRECT_CREDITS, args.creditsToday, VERIFY_DAILY_CREDIT_CAP),
  };
}
