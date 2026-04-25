import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import { getRazorpayClient, PASSES, type PassId } from "@/lib/payments";

type CreatePassOrderBody = {
  passId?: unknown;
  mode?: unknown;
};

/** Razorpay plan ID env var name for each pass type. */
const PLAN_ID_ENV_KEY: Record<PassId, string> = {
  weekly_pass: "RAZORPAY_PLAN_ID_WEEKLY_PASS",
  monthly_pass: "RAZORPAY_PLAN_ID_MONTHLY_PASS",
  supporter: "RAZORPAY_PLAN_ID_SUPPORTER",
};

function getPlanId(passId: PassId): string {
  const envKey = PLAN_ID_ENV_KEY[passId];
  return process.env[envKey] ?? "";
}

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: CreatePassOrderBody;
  try {
    body = (await request.json()) as CreatePassOrderBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const passId = typeof body.passId === "string" ? body.passId : "";
  const mode = typeof body.mode === "string" ? body.mode : "";

  const pass = PASSES.find((p) => p.id === passId);
  if (!pass) {
    return NextResponse.json({ error: "Invalid pass selected." }, { status: 400 });
  }

  if (mode !== "onetime" && mode !== "subscribe") {
    return NextResponse.json(
      { error: "Invalid mode. Must be 'onetime' or 'subscribe'." },
      { status: 400 },
    );
  }

  if (pass.id === "supporter" && mode === "onetime") {
    return NextResponse.json(
      { error: "Supporter tier is subscription-only." },
      { status: 400 },
    );
  }

  try {
    const razorpay = getRazorpayClient();

    if (mode === "subscribe") {
      const planId = getPlanId(pass.id as PassId);
      if (!planId) {
        return NextResponse.json(
          {
            error: `Subscription plan for ${pass.label} is not configured yet. Please contact support.`,
          },
          { status: 503 },
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const razorpayAny = razorpay as any;
      const subscription = await razorpayAny.subscriptions.create({
        plan_id: planId,
        total_count: 12,
        notes: {
          user_id: user.id,
          pass_id: pass.id,
          mode: "subscribe",
        },
      });

      return NextResponse.json({
        subscriptionId: subscription.id,
        keyId: process.env.RAZORPAY_KEY_ID ?? "",
        pass: { id: pass.id, label: pass.label },
      });
    }

    // Onetime mode — create a standard Razorpay order
    const order = await razorpay.orders.create({
      amount: pass.oneTimePaise,
      currency: "INR",
      receipt: `ea_pass_${user.id.slice(0, 12)}_${Date.now()}`,
      notes: {
        user_id: user.id,
        pass_id: pass.id,
        mode: "onetime",
        daily_electrons: String(pass.dailyElectrons),
        duration_days: String(pass.durationDays),
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID ?? "",
      pass: { id: pass.id, label: pass.label, oneTimePaise: pass.oneTimePaise },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create pass order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
