import Razorpay from "razorpay";

export const FIRST_TIMER_DISCOUNT_PCT = 20;

export const CREDIT_PACKS = [
  { code: "pack_10", label: "₹10 Credit", credits: 10, amountInPaise: 800, firstTimerDiscountPct: FIRST_TIMER_DISCOUNT_PCT },
  { code: "pack_50", label: "₹50 Credit", credits: 50, amountInPaise: 3500, firstTimerDiscountPct: FIRST_TIMER_DISCOUNT_PCT },
  { code: "pack_100", label: "₹100 Credit", credits: 100, amountInPaise: 6500, firstTimerDiscountPct: FIRST_TIMER_DISCOUNT_PCT },
  { code: "pack_500", label: "₹500 Credit", credits: 500, amountInPaise: 30000, firstTimerDiscountPct: FIRST_TIMER_DISCOUNT_PCT },
] as const;

export type CreditPackCode = (typeof CREDIT_PACKS)[number]["code"];

/**
 * Return the discounted price for a first-time buyer.
 * Discount is applied as a whole-rupee floor to avoid sub-paisa amounts.
 */
export function getFirstTimerAmountInPaise(pack: { amountInPaise: number; firstTimerDiscountPct: number }): number {
  const discountPaise = Math.floor(pack.amountInPaise * pack.firstTimerDiscountPct / 100);
  return pack.amountInPaise - discountPaise;
}

/** Weekly reset free-claim amount (credits). */
export const FREE_WEEKLY_CLAIM_CREDITS = 1;

// ── Pass & Subscription types ────────────────────────────────────────────────

export type PassId = "weekly_pass" | "monthly_pass" | "supporter";

export interface Pass {
  id: PassId;
  label: string;
  description: string;
  /** One-time purchase price in paise. */
  oneTimePaise: number;
  /** Subscription price in paise (per billing period). */
  subscribedPaise: number;
  /** Billing period label for the subscription. */
  billingPeriod: "week" | "month";
  /** Credits given per day during the pass duration. */
  dailyCredits: number;
  /** Duration of the pass in days. */
  durationDays: number;
  /** Extra perks included (e.g. badge IDs). */
  perks?: string[];
}

export const PASSES: readonly Pass[] = [
  {
    id: "weekly_pass",
    label: "Weekly Pass",
    description: "Claim 1 credit every day for 7 days.",
    oneTimePaise: 1900,
    subscribedPaise: 1500,
    billingPeriod: "week",
    dailyCredits: 1,
    durationDays: 7,
  },
  {
    id: "monthly_pass",
    label: "Monthly Pass",
    description: "Claim 2 credits every day for 30 days.",
    oneTimePaise: 7900,
    subscribedPaise: 6900,
    billingPeriod: "month",
    dailyCredits: 2,
    durationDays: 30,
  },
  {
    id: "supporter",
    label: "Be a Supporter",
    description: "Support ExamArchive. Claim 10 credits every month + exclusive Supporter Badge.",
    oneTimePaise: 4900,
    subscribedPaise: 4900,
    billingPeriod: "month",
    dailyCredits: 0,
    durationDays: 30,
    perks: ["supporter_badge", "monthly_10_claim"],
  },
] as const;

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
