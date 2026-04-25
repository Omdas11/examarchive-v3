import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import { PASSES, getRazorpayClient, getRazorpayPlanId, type PassId } from "@/lib/payments";

type CreatePassOrderBody = {
  passId?: string;
  mode?: "onetime" | "subscribe";
};

function isValidPassId(id: string): id is PassId {
  return PASSES.some((p) => p.id === id);
}

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: CreatePassOrderBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const passId = typeof body.passId === "string" ? body.passId : "";
  const mode = body.mode === "onetime" || body.mode === "subscribe" ? body.mode : null;

  if (!passId || !isValidPassId(passId)) {
    return NextResponse.json({ error: "Invalid pass selected." }, { status: 400 });
  }
  if (!mode) {
    return NextResponse.json({ error: "Invalid mode. Must be 'onetime' or 'subscribe'." }, { status: 400 });
  }

  const pass = PASSES.find((p) => p.id === passId);
  if (!pass) {
    return NextResponse.json({ error: "Pass not found." }, { status: 400 });
  }

  // Supporter pass is subscription-only
  if (passId === "supporter" && mode === "onetime") {
    return NextResponse.json({ error: "Supporter pass is subscription-only." }, { status: 400 });
  }

  try {
    const razorpay = getRazorpayClient();

    if (mode === "subscribe") {
      const planId = getRazorpayPlanId(pass.id);
      if (!planId) {
        return NextResponse.json(
          {
            error: `Subscription plan is not configured for this pass. Please set RAZORPAY_PLAN_ID_${pass.id.toUpperCase()} in environment variables.`,
          },
          { status: 503 },
        );
      }

      // Total billing cycles: 52 for weekly (~1 year), 12 for monthly/supporter
      const totalCount = pass.billingPeriod === "week" ? 52 : 12;

      const subscription = await razorpay.subscriptions.create({
        plan_id: planId,
        total_count: totalCount,
        quantity: 1,
        customer_notify: 1,
        notes: {
          user_id: user.id,
          pass_id: pass.id,
          mode: "subscribe",
        },
      });

      return NextResponse.json({
        mode: "subscribe",
        subscriptionId: subscription.id,
        keyId: process.env.RAZORPAY_KEY_ID ?? "",
        pass: {
          id: pass.id,
          label: pass.label,
          subscribedPaise: pass.subscribedPaise,
          billingPeriod: pass.billingPeriod,
        },
      });
    }

    // One-time pass order
    const order = await razorpay.orders.create({
      amount: pass.oneTimePaise,
      currency: "INR",
      receipt: `ea_pass_${user.id.slice(0, 10)}_${Date.now()}`,
      notes: {
        user_id: user.id,
        pass_id: pass.id,
        mode: "onetime",
      },
    });

    return NextResponse.json({
      mode: "onetime",
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID ?? "",
      pass: {
        id: pass.id,
        label: pass.label,
        oneTimePaise: pass.oneTimePaise,
        dailyElectrons: pass.dailyElectrons,
        durationDays: pass.durationDays,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create pass order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
