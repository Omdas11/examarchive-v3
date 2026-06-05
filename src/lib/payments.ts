import Razorpay from "razorpay";

export const FIRST_TIMER_DISCOUNT_PCT = 0; // Removing first timer discount for simplicity

export const CREDIT_PACKS = [
  { code: "pack_10", label: "10 Credits", credits: 10, amountInPaise: 800 },
  { code: "pack_25", label: "25 Credits", credits: 25, amountInPaise: 1800 },
  { code: "pack_50", label: "50 Credits", credits: 50, amountInPaise: 3000 },
  { code: "pack_100", label: "100 Credits", credits: 100, amountInPaise: 5000 },
  { code: "pack_250", label: "250 Credits", credits: 250, amountInPaise: 10000 },
] as const;

export type CreditPackCode = (typeof CREDIT_PACKS)[number]["code"];

/**
 * Return the discounted price for a first-time buyer.
 */
export function getFirstTimerAmountInPaise(pack: { amountInPaise: number }): number {
  return pack.amountInPaise;
}

/** Weekly reset free-claim amount (credits). */
export const FREE_WEEKLY_CLAIM_CREDITS = 0; // User wants website free but AI PDF cost credits.

// ── Pass & Subscription types (DEPRECATED) ───────────────────────────────────

export type PassId = "weekly_pass" | "monthly_pass" | "supporter";

export interface Pass {
  id: PassId;
  label: string;
  description: string;
  oneTimePaise: number;
  subscribedPaise: number;
  billingPeriod: "week" | "month";
  dailyCredits: number;
  durationDays: number;
  perks?: string[];
}

export const PASSES: readonly Pass[] = []; // Empty as requested to remove passes

export function getCreditPackByCode(code: string) {
  return CREDIT_PACKS.find((pack) => pack.code === code);
}

/**
 * Returns the Razorpay plan ID for a given pass ID, sourced from environment
 * variables. Returns null if the variable is not set.
 */
export function getRazorpayPlanId(passId: PassId): string | null {
  const map: Record<PassId, string | undefined> = {
    weekly_pass: process.env.RAZORPAY_PLAN_ID_WEEKLY_PASS,
    monthly_pass: process.env.RAZORPAY_PLAN_ID_MONTHLY_PASS,
    supporter: process.env.RAZORPAY_PLAN_ID_SUPPORTER,
  };
  return map[passId] ?? null;
}

export function getRazorpayClient(): Razorpay {
  const keyId = process.env.RAZORPAY_KEY_ID ?? "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
  if (!keyId || !keySecret) {
    throw new Error("Razorpay is not configured. Missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET.");
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}
