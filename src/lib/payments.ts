import Razorpay from "razorpay";

export const FIRST_TIMER_DISCOUNT_PCT = 20;

export const CREDIT_PACKS = [
  { code: "pack_20", label: "20e", credits: 20, amountInPaise: 1900, firstTimerDiscountPct: FIRST_TIMER_DISCOUNT_PCT },
  { code: "pack_50", label: "50e", credits: 50, amountInPaise: 3900, firstTimerDiscountPct: FIRST_TIMER_DISCOUNT_PCT },
  { code: "pack_100", label: "100e", credits: 100, amountInPaise: 5900, firstTimerDiscountPct: FIRST_TIMER_DISCOUNT_PCT },
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

/** Weekly reset free-claim amount (electrons). */
export const FREE_WEEKLY_CLAIM_ELECTRONS = 10;

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
  /** Electrons credited per day during the pass duration. */
  dailyElectrons: number;
  /** Duration of the pass in days. */
  durationDays: number;
  /** Extra perks included (e.g. badge IDs). */
  perks?: string[];
}

export const PASSES: readonly Pass[] = [
  {
    id: "weekly_pass",
    label: "Weekly Pass",
    description: "Claim 10e every day for 7 days.",
    oneTimePaise: 4900,
    subscribedPaise: 3900,
    billingPeriod: "week",
    dailyElectrons: 10,
    durationDays: 7,
  },
  {
    id: "monthly_pass",
    label: "Monthly Pass",
    description: "Claim 20e every day for 30 days.",
    oneTimePaise: 19900,
    subscribedPaise: 17900,
    billingPeriod: "month",
    dailyElectrons: 20,
    durationDays: 30,
  },
  {
    id: "supporter",
    label: "Be a Supporter",
    description: "Support ExamArchive. Claim 100e every month + exclusive Supporter Badge.",
    oneTimePaise: 4900,
    subscribedPaise: 4900,
    billingPeriod: "month",
    dailyElectrons: 0,
    durationDays: 30,
    perks: ["supporter_badge", "monthly_100e_claim"],
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
