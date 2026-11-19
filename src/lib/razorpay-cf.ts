/**
 * Razorpay helpers for Cloudflare Workers — raw fetch, no Node SDK.
 *
 * The `razorpay` npm SDK pulls in axios + node:crypto and is not safe on
 * Workers; the API itself is plain HTTPS + Basic auth, and signature
 * verification is one HMAC-SHA256 via Web Crypto. Keys come from Worker
 * secrets RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET (set in the Cloudflare
 * dashboard — never in code or in .env files).
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getRazorpayKeysAsync(): Promise<{
  keyId: string;
  keySecret: string;
} | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const e = env as unknown as Record<string, string | undefined>;
    const keyId = e.RAZORPAY_KEY_ID;
    const keySecret = e.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return null;
    return { keyId, keySecret };
  } catch {
    return null;
  }
}

function basicAuth(keyId: string, keySecret: string): string {
  return `Basic ${btoa(`${keyId}:${keySecret}`)}`;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  receipt?: string;
}

/** Create a Razorpay order (amount in paise). Throws on API error. */
export async function createRazorpayOrder(
  keys: { keyId: string; keySecret: string },
  args: { amountPaise: number; receipt: string; notes?: Record<string, string> },
): Promise<RazorpayOrder> {
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: basicAuth(keys.keyId, keys.keySecret),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: args.amountPaise,
      currency: "INR",
      receipt: args.receipt,
      notes: args.notes ?? {},
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Razorpay order failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return (await res.json()) as RazorpayOrder;
}

/** Fetch an order back from Razorpay to confirm amount + paid status. */
export async function getRazorpayOrder(
  keys: { keyId: string; keySecret: string },
  orderId: string,
): Promise<RazorpayOrder> {
  const res = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: basicAuth(keys.keyId, keys.keySecret) },
  });
  if (!res.ok) throw new Error(`Razorpay order fetch failed (${res.status})`);
  return (await res.json()) as RazorpayOrder;
}

/** Fetch a payment to confirm it is captured. */
export async function getRazorpayPayment(
  keys: { keyId: string; keySecret: string },
  paymentId: string,
): Promise<{ id: string; status: string; amount: number; order_id: string }> {
  const res = await fetch(
    `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,
    { headers: { Authorization: basicAuth(keys.keyId, keys.keySecret) } },
  );
  if (!res.ok) throw new Error(`Razorpay payment fetch failed (${res.status})`);
  return (await res.json()) as { id: string; status: string; amount: number; order_id: string };
}

/** Verify Razorpay's payment signature: HMAC-SHA256(order_id|payment_id). */
export async function verifyRazorpaySignature(
  keySecret: string,
  orderId: string,
  paymentId: string,
  signature: string,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(keySecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${orderId}|${paymentId}`),
  );
  const hex = [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (hex.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}
