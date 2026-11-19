import { NextResponse, type NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getD1 } from "@/lib/d1";
import {
  getRazorpayKeysAsync,
  getRazorpayPayment,
  verifyRazorpaySignature,
} from "@/lib/razorpay-cf";
import { SUPPORT_STATS_KV_KEY } from "@/lib/support";

/**
 * POST /api/support/verify — confirm a support payment after Checkout.
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * Checks, in order: the signature (HMAC-SHA256), the donation row exists
 * and is still 'created', the payment is captured on Razorpay and its
 * amount + order match our row. Only then marks the donation 'paid' and
 * clears the cached stats so the progress bar moves immediately.
 * A replayed or tampered callback fails closed and changes nothing.
 */
export async function POST(request: NextRequest) {
  const keys = await getRazorpayKeysAsync();
  if (!keys) {
    return NextResponse.json({ error: "Support payments are not set up yet." }, { status: 503 });
  }

  let body: {
    razorpay_order_id?: unknown;
    razorpay_payment_id?: unknown;
    razorpay_signature?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const orderId = typeof body.razorpay_order_id === "string" ? body.razorpay_order_id : "";
  const paymentId =
    typeof body.razorpay_payment_id === "string" ? body.razorpay_payment_id : "";
  const signature =
    typeof body.razorpay_signature === "string" ? body.razorpay_signature : "";
  if (!orderId || !paymentId || !signature) {
    return NextResponse.json({ error: "Missing payment details." }, { status: 400 });
  }

  const valid = await verifyRazorpaySignature(keys.keySecret, orderId, paymentId, signature);
  if (!valid) {
    return NextResponse.json({ error: "Payment signature did not match." }, { status: 400 });
  }

  const db = await getD1();
  const row = await db
    .prepare(
      "SELECT id, amount_paise, status FROM donations WHERE razorpay_order_id = ? LIMIT 1",
    )
    .bind(orderId)
    .first<{ id: string; amount_paise: number; status: string }>();
  if (!row) {
    return NextResponse.json({ error: "Unknown order." }, { status: 404 });
  }
  if (row.status === "paid") {
    return NextResponse.json({ message: "Thank you! Your support was already recorded." });
  }
  if (row.status !== "created") {
    return NextResponse.json({ error: "This order is no longer payable." }, { status: 400 });
  }

  let payment: { status: string; amount: number; order_id: string };
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
    payment.order_id !== orderId ||
    payment.amount !== Number(row.amount_paise)
  ) {
    return NextResponse.json(
      { error: "Payment details do not match this order." },
      { status: 400 },
    );
  }

  const now = Date.now();
  await db
    .prepare(
      "UPDATE donations SET status = 'paid', razorpay_payment_id = ?, updated_at = ? WHERE id = ? AND status = 'created'",
    )
    .bind(paymentId, now, row.id)
    .run();

  try {
    const { env } = await getCloudflareContext({ async: true });
    const kv = (env as { CACHE?: KVNamespace }).CACHE;
    if (kv) await kv.delete(SUPPORT_STATS_KV_KEY);
  } catch {
    // stats cache expires in 5 min anyway
  }

  return NextResponse.json({ message: "Thank you for keeping ExamArchive alive!" });
}
