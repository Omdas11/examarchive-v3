import Razorpay from "razorpay";

export const CREDIT_PACKS = [
  { code: "pack_100", label: "100e", credits: 100, amountInPaise: 10000 },
  { code: "pack_250", label: "250e", credits: 250, amountInPaise: 20000 },
  { code: "pack_500", label: "500e", credits: 500, amountInPaise: 35000 },
] as const;

export type CreditPackCode = (typeof CREDIT_PACKS)[number]["code"];

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
