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

/** Supporter plan id, read from the Worker env at runtime (never process.env — Worker secrets are not in process.env). Returns null when unset. */
export async function getRazorpayPlanIdAsync(): Promise<string | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const planId = (env as unknown as Record<string, string | undefined>)
      .RAZORPAY_PLAN_ID_SUPPORTER;
    return planId || null;
  } catch {
    return null;
  }
}

export interface RazorpaySubscription {
  id: string;
  plan_id: string;
  status: string;
  total_count: number;
  paid_count: number;
  quantity: number;
  customer_notify: boolean;
}

/**
 * Create a Razorpay subscription for the Supporter plan.
 * total_count: 12 — one year of monthly cycles; after the 12th charge the
 * subscription ends by itself instead of billing forever. NOTE: the site
 * has no Razorpay webhook yet, so later monthly charges do NOT extend the
 * site pass automatically — the pass granted at verify time lasts 30 days,
 * and renewal handling needs a webhook endpoint (follow-up work).
 */
export async function createRazorpaySubscription(
  keys: { keyId: string; keySecret: string },
  planId: string,
): Promise<RazorpaySubscription> {
  const res = await fetch("https://api.razorpay.com/v1/subscriptions", {
    method: "POST",
    headers: {
      Authorization: basicAuth(keys.keyId, keys.keySecret),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plan_id: planId,
      total_count: 12,
      quantity: 1,
      customer_notify: 1,
      notes: { kind: "supporter", pass_id: "supporter" },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Razorpay subscription failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return (await res.json()) as RazorpaySubscription;
}

/** Fetch a subscription back from Razorpay to confirm its status + plan. */
export async function getRazorpaySubscription(
  keys: { keyId: string; keySecret: string },
  subscriptionId: string,
): Promise<RazorpaySubscription> {
  const res = await fetch(
    `https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
    { headers: { Authorization: basicAuth(keys.keyId, keys.keySecret) } },
  );
  if (!res.ok) throw new Error(`Razorpay subscription fetch failed (${res.status})`);
  return (await res.json()) as RazorpaySubscription;
}

/** Timing-safe comparison of a computed HMAC hex string against a signature. */
async function verifyHmacHex(
  keySecret: string,
  payload: string,
  signature: string,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(keySecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const hex = [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (hex.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

/** Verify Razorpay's payment signature: HMAC-SHA256(order_id|payment_id). */
export async function verifyRazorpaySignature(
  keySecret: string,
  orderId: string,
  paymentId: string,
  signature: string,
): Promise<boolean> {
  return verifyHmacHex(keySecret, `${orderId}|${paymentId}`, signature);
}

/**
 * Verify a Razorpay subscription payment signature:
 * HMAC-SHA256(subscription_id|payment_id). Note the argument order —
 * subscription first, unlike the order-payment signature above.
 */
export async function verifyRazorpaySubscriptionSignature(
  keySecret: string,
  subscriptionId: string,
  paymentId: string,
  signature: string,
): Promise<boolean> {
  return verifyHmacHex(keySecret, `${subscriptionId}|${paymentId}`, signature);
}
