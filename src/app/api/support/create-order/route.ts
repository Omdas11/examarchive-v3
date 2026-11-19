import { NextResponse, type NextRequest } from "next/server";
import { getD1 } from "@/lib/d1";
import { getServerUser } from "@/lib/auth-cf";
import { createRazorpayOrder, getRazorpayKeysAsync } from "@/lib/razorpay-cf";
import { MAX_SUPPORT_RUPEES, MIN_SUPPORT_RUPEES } from "@/lib/support";

/**
 * POST /api/support/create-order — start a support payment.
 * Body: { amountRupees: number, donorName?: string }
 * Guests may donate; logged-in users get their id recorded.
 * Minimum ₹20, maximum ₹10,000 — enforced here, not just in the UI.
 * Returns { keyId, orderId, amount, currency } for Razorpay Checkout.
 * Fails with 503 until RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are set as
 * Worker secrets in the Cloudflare dashboard.
 */
export async function POST(request: NextRequest) {
  const keys = await getRazorpayKeysAsync();
  if (!keys) {
    return NextResponse.json(
      { error: "Support payments are not set up yet. Please try again later." },
      { status: 503 },
    );
  }

  let body: { amountRupees?: unknown; donorName?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const amountRupees = Number(body.amountRupees);
  if (!Number.isInteger(amountRupees)) {
    return NextResponse.json({ error: "Enter a whole-rupee amount." }, { status: 400 });
  }
  if (amountRupees < MIN_SUPPORT_RUPEES) {
    return NextResponse.json(
      { error: `Minimum support is ₹${MIN_SUPPORT_RUPEES}.` },
      { status: 400 },
    );
  }
  if (amountRupees > MAX_SUPPORT_RUPEES) {
    return NextResponse.json(
      { error: `Maximum support is ₹${MAX_SUPPORT_RUPEES.toLocaleString("en-IN")} per payment.` },
      { status: 400 },
    );
  }
  const donorName =
    typeof body.donorName === "string" ? body.donorName.trim().slice(0, 80) : "";
  const amountPaise = amountRupees * 100;

  const user = await getServerUser().catch(() => null);
  const db = await getD1();
  const donationId = crypto.randomUUID();
  const now = Date.now();
  const receipt = `sup_${donationId.slice(0, 8)}`;

  let order: { id: string; amount: number; currency: string };
  try {
    order = await createRazorpayOrder(keys, {
      amountPaise,
      receipt,
      notes: { kind: "support-pool", donation_id: donationId },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create order" },
      { status: 502 },
    );
  }

  await db
    .prepare(
      "INSERT INTO donations (id, user_id, donor_name, amount_paise, currency, status, razorpay_order_id, created_at, updated_at) VALUES (?, ?, ?, ?, 'INR', 'created', ?, ?, ?)",
    )
    .bind(
      donationId,
      user?.id ?? null,
      donorName || user?.name || null,
      amountPaise,
      order.id,
      now,
      now,
    )
    .run();

  return NextResponse.json({
    keyId: keys.keyId,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
  });
}
