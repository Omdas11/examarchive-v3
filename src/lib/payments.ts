import Razorpay from "razorpay";

export const CREDIT_PACKS = [
  { code: "pack_20", label: "20e", credits: 20, amountInPaise: 1900 },
  { code: "pack_50", label: "50e", credits: 50, amountInPaise: 3900 },
  { code: "pack_100", label: "100e", credits: 100, amountInPaise: 5900 },
] as const;

export type CreditPackCode = (typeof CREDIT_PACKS)[number]["code"];

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
    description: "Support ExamArchive and get 100e + exclusive Supporter Badge.",
    oneTimePaise: 4900,
    subscribedPaise: 4900,
    billingPeriod: "month",
    dailyElectrons: 0,
    durationDays: 30,
    perks: ["supporter_badge", "100e_bonus"],
  },
] as const;

export function getCreditPackByCode(code: string) {
  return CREDIT_PACKS.find((pack) => pack.code === code);
}

export function getRazorpayClient(): Razorpay {
  const keyId = process.env.RAZORPAY_KEY_ID ?? "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
  if (!keyId || !keySecret) {
    throw new Error("Razorpay is not configured. Missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET.");
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}
