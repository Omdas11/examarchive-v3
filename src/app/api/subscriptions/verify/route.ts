import { NextResponse, type NextRequest } from "next/server";
import { getD1 } from "@/lib/d1";
import { getServerUser } from "@/lib/auth-cf";
import {
  getRazorpayKeysAsync,
  getRazorpayPayment,
  getRazorpayPlanIdAsync,
  getRazorpaySubscription,
  verifyRazorpaySubscriptionSignature,
} from "@/lib/razorpay-cf";

/**
 * First monthly charge of the Supporter plan, in paise (Rs 29).
 * Must match the supporter pass's subscribedPaise in src/lib/payments.ts.
 */
const SUPPORTER_AMOUNT_PAISE = 2900;

/** Supporter pass length: 30 days from the verified first payment. */
const SUPPORTER_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * POST /api/subscriptions/verify — confirm a Supporter subscription after Checkout.
 * Body: { razorpay_payment_id, razorpay_subscription_id, razorpay_signature }
 * Checks, in order: the signature (HMAC-SHA256 of subscription_id|payment_id),
 * the pending user_passes row exists for this user and this subscription,
 * the subscription is active/authenticated on Razorpay for our plan, and the
 * payment is captured for this subscription at the Rs 29 amount. Only then
 * activates the pass (30 days), sets the user's supporter custom role, and
 * returns the expiry. A replayed or tampered callback fails closed and
 * changes nothing; verifying an already-active pass returns success.
 *
 * NOTE: later monthly charges (total_count 12 on the Razorpay subscription)
 * do not extend the site pass — the site has no Razorpay webhook yet, so a
 * renewal endpoint is still follow-up work.
 */
export async function POST(request: NextRequest) {
  const user = await getServerUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Sign in to subscribe." }, { status: 401 });
  }

  const keys = await getRazorpayKeysAsync();
  const planId = await getRazorpayPlanIdAsync();
  if (!keys || !planId) {
    return NextResponse.json(
      { error: "Subscriptions are not set up yet." },
      { status: 503 },
    );
  }

  let body: {
    razorpay_payment_id?: unknown;
    razorpay_subscription_id?: unknown;
    razorpay_signature?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const paymentId =
    typeof body.razorpay_payment_id === "string" ? body.razorpay_payment_id : "";
  const subscriptionId =
    typeof body.razorpay_subscription_id === "string"
      ? body.razorpay_subscription_id
      : "";
  const signature =
    typeof body.razorpay_signature === "string" ? body.razorpay_signature : "";
  if (!paymentId || !subscriptionId || !signature) {
    return NextResponse.json({ error: "Missing payment details." }, { status: 400 });
  }

  const valid = await verifyRazorpaySubscriptionSignature(
    keys.keySecret,
    subscriptionId,
    paymentId,
    signature,
  );
  if (!valid) {
    return NextResponse.json({ error: "Payment signature did not match." }, { status: 400 });
  }

  const db = await getD1();
  const row = await db
    .prepare(
      "SELECT id, user_id, status, expires_at FROM user_passes WHERE razorpay_subscription_id = ? AND pass_id = 'supporter' LIMIT 1",
    )
    .bind(subscriptionId)
    .first<{ id: string; user_id: string; status: string; expires_at: number | null }>();
  if (!row) {
    return NextResponse.json({ error: "Unknown subscription." }, { status: 404 });
  }
  if (row.user_id !== user.id) {
    return NextResponse.json(
      { error: "This subscription belongs to another account." },
      { status: 403 },
    );
  }
  if (row.status === "active" && row.expires_at && row.expires_at > Date.now()) {
    return NextResponse.json({
      message: "You are already a Supporter.",
      expiresAt: row.expires_at,
    });
  }
  if (row.status !== "created") {
    return NextResponse.json({ error: "This subscription is no longer payable." }, { status: 400 });
  }

  let subscription: { plan_id: string; status: string };
  try {
    subscription = await getRazorpaySubscription(keys, subscriptionId);
  } catch {
    return NextResponse.json(
      { error: "Could not confirm the subscription with Razorpay." },
      { status: 502 },
    );
  }
  if (subscription.plan_id !== planId) {
    return NextResponse.json(
      { error: "Subscription is for a different plan." },
      { status: 400 },
    );
  }
  if (subscription.status !== "active" && subscription.status !== "authenticated") {
    return NextResponse.json(
      { error: "Subscription is not active yet." },
      { status: 400 },
    );
  }

  let payment: { status: string; amount: number; subscription_id?: string };
  try {
    payment = await getRazorpayPayment(keys, paymentId);
  } catch {
    return NextResponse.json(
      { error: "Could not confirm the payment with Razorpay." },
      { status: 502 },
    );
  }
  if (
    payment.status !== "captured" ||
    payment.subscription_id !== subscriptionId ||
    payment.amount !== SUPPORTER_AMOUNT_PAISE
  ) {
    return NextResponse.json(
      { error: "Payment details do not match this subscription." },
      { status: 400 },
    );
  }

  const now = Date.now();
  const expiresAt = now + SUPPORTER_DURATION_MS;
  await db
    .prepare(
      "UPDATE user_passes SET status = 'active', activated_at = ?, expires_at = ?, updated_at = ? WHERE id = ? AND status = 'created'",
    )
    .bind(now, expiresAt, now, row.id)
    .run();

  // Grant the supporter custom role: secondary slot first, tertiary if the
  // secondary slot already holds another custom role (mentor etc.).
  const rolesRow = await db
    .prepare("SELECT secondary_role, tertiary_role FROM users WHERE id = ? LIMIT 1")
    .bind(user.id)
    .first<{ secondary_role: string | null; tertiary_role: string | null }>();
  if (rolesRow) {
    if (!rolesRow.secondary_role) {
      await db
        .prepare("UPDATE users SET secondary_role = 'supporter', updated_at = ? WHERE id = ?")
        .bind(now, user.id)
        .run();
    } else if (
      rolesRow.secondary_role !== "supporter" &&
      !rolesRow.tertiary_role
    ) {
      await db
        .prepare("UPDATE users SET tertiary_role = 'supporter', updated_at = ? WHERE id = ?")
        .bind(now, user.id)
        .run();
    }
  }

  return NextResponse.json({
    message: "Welcome aboard, Supporter!",
    expiresAt,
  });
}
