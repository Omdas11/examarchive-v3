import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import { getCreditPackByCode, getRazorpayClient } from "@/lib/payments";

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

  try {
    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.create({
      amount: pack.amountInPaise,
      currency: "INR",
      receipt: `ea_${user.id.slice(0, 12)}_${Date.now()}`,
      notes: {
        user_id: user.id,
        pack_code: pack.code,
        credits: String(pack.credits),
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
