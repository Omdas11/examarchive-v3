import { NextResponse, type NextRequest } from "next/server";
import { getD1 } from "@/lib/d1";
import { getServerUser } from "@/lib/auth-cf";
import {
  createRazorpaySubscription,
  getRazorpayKeysAsync,
  getRazorpayPlanIdAsync,
} from "@/lib/razorpay-cf";

/**
 * POST /api/subscriptions/create — start a Supporter subscription (Rs 29/month).
 * Signed-in users only. Creates a Razorpay subscription for the plan in
 * RAZORPAY_PLAN_ID_SUPPORTER and records a pending user_passes row
 * (status 'created') so /api/subscriptions/verify can prove the
 * subscription belongs to this user. Returns { keyId, subscriptionId }
 * for Razorpay Checkout.
 * Fails with 503 until RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET /
 * RAZORPAY_PLAN_ID_SUPPORTER are set as Worker secrets, and with 409
 * when the user already holds an active Supporter pass (no double charge).
 */
export async function POST() {
  const user = await getServerUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Sign in to subscribe." }, { status: 401 });
  }

  const keys = await getRazorpayKeysAsync();
  const planId = await getRazorpayPlanIdAsync();
  if (!keys || !planId) {
    return NextResponse.json(
      { error: "Subscriptions are not set up yet. Please try again later." },
      { status: 503 },
    );
  }

  const db = await getD1();
  const existing = await db
    .prepare(
      "SELECT id FROM user_passes WHERE user_id = ? AND pass_id = 'supporter' AND status = 'active' AND expires_at > ? LIMIT 1",
    )
    .bind(user.id, Date.now())
    .first<{ id: string }>();
  if (existing) {
    return NextResponse.json(
      { error: "You are already a Supporter." },
      { status: 409 },
    );
  }

  let subscription: { id: string };
  try {
    subscription = await createRazorpaySubscription(keys, planId);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create subscription" },
      { status: 502 },
    );
  }

  const now = Date.now();
  await db
    .prepare(
      "INSERT INTO user_passes (id, user_id, pass_id, mode, status, daily_credits, days_remaining, activated_at, expires_at, razorpay_subscription_id, created_at, updated_at) VALUES (?, ?, 'supporter', 'subscription', 'created', 0, 30, NULL, NULL, ?, ?, ?)",
    )
    .bind(crypto.randomUUID(), user.id, subscription.id, now, now)
    .run();

  return NextResponse.json({
    keyId: keys.keyId,
    subscriptionId: subscription.id,
  });
}
