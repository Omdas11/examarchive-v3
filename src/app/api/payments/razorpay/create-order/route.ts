import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import { adminDatabases, DATABASE_ID, COLLECTION, Query } from "@/lib/appwrite";
import { getCreditPackByCode, getRazorpayClient, getFirstTimerAmountInPaise } from "@/lib/payments";

type CreateOrderBody = {
  packCode?: string;
};

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: CreateOrderBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const packCode = typeof body.packCode === "string" ? body.packCode : "";
  const pack = getCreditPackByCode(packCode);
  if (!pack) {
    return NextResponse.json({ error: "Invalid credit pack selected." }, { status: 400 });
  }

  // ── Determine first-time buyer status ────────────────────────────────────
  // Checked server-side so the discount cannot be spoofed by the client.
  let isFirstTimer = false;
  try {
    const db = adminDatabases();
    const { total } = await db.listDocuments(DATABASE_ID, COLLECTION.purchases, [
      Query.equal("user_id", user.id),
      Query.equal("credits_applied", true),
      Query.limit(1),
    ]);
    isFirstTimer = total === 0;
  } catch {
    // If the check fails, default to no discount (conservative)
    isFirstTimer = false;
  }

  const effectiveAmount = isFirstTimer
    ? getFirstTimerAmountInPaise(pack)
    : pack.amountInPaise;

  try {
    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({
      amount: effectiveAmount,
      currency: "INR",
      receipt: `ea_${user.id.slice(0, 12)}_${Date.now()}`,
      notes: {
        user_id: user.id,
        pack_code: pack.code,
        credits: String(pack.credits),
        ...(isFirstTimer && { is_first_timer_discount: "true" }),
      },
    });
    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID ?? "",
      pack: {
        code: pack.code,
        credits: pack.credits,
        label: pack.label,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
