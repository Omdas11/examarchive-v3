import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { AppwriteException } from "node-appwrite";
import { getServerUser } from "@/lib/auth";
import { adminDatabases, COLLECTION, DATABASE_ID, ID } from "@/lib/appwrite";
import { PASSES, getRazorpayClient, type PassId } from "@/lib/payments";
import { withElectronBalanceLock } from "@/lib/electron-lock";

type VerifyPassBody = {
  passId?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
};

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function isValidPassId(id: string): id is PassId {
  return PASSES.some((p) => p.id === id);
}

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: VerifyPassBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const passId = typeof body.passId === "string" ? body.passId : "";
  const orderId = typeof body.razorpay_order_id === "string" ? body.razorpay_order_id : "";
  const paymentId = typeof body.razorpay_payment_id === "string" ? body.razorpay_payment_id : "";
  const signature = typeof body.razorpay_signature === "string" ? body.razorpay_signature : "";
  const secret = process.env.RAZORPAY_KEY_SECRET ?? "";

  if (!passId || !isValidPassId(passId)) {
    return NextResponse.json({ error: "Invalid pass." }, { status: 400 });
  }
  if (!orderId || !paymentId || !signature) {
    return NextResponse.json({ error: "Missing Razorpay verification fields." }, { status: 400 });
  }
  if (!secret) {
    return NextResponse.json({ error: "Razorpay secret is not configured." }, { status: 503 });
  }

  // Verify the Razorpay payment signature
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  if (!timingSafeEqual(expectedSignature, signature)) {
    return NextResponse.json({ error: "Payment signature verification failed." }, { status: 400 });
  }

  const pass = PASSES.find((p) => p.id === passId);
  if (!pass) {
    return NextResponse.json({ error: "Pass not found." }, { status: 400 });
  }

  // Verify order details with Razorpay to prevent tampering
  try {
    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.fetch(orderId);
    const orderPassId = typeof order.notes?.pass_id === "string" ? order.notes.pass_id : "";
    const orderUserId = typeof order.notes?.user_id === "string" ? order.notes.user_id : "";

    if (!orderPassId || !orderUserId) {
      return NextResponse.json({ error: "Order is missing pass metadata." }, { status: 400 });
    }
    if (orderUserId !== user.id) {
      return NextResponse.json({ error: "Order user does not match authenticated user." }, { status: 403 });
    }
    if (orderPassId !== passId) {
      return NextResponse.json({ error: "Order pass does not match requested pass." }, { status: 400 });
    }
    if (order.amount !== pass.oneTimePaise || order.currency !== "INR") {
      return NextResponse.json({ error: "Order amount validation failed." }, { status: 400 });
    }
  } catch (error) {
    const err = error as { statusCode?: unknown; message?: unknown } | undefined;
    let message = err && typeof err.message === "string" ? err.message : "Unable to validate Razorpay order.";
    if ((err as { statusCode?: number })?.statusCode === 404) message = "Razorpay order not found.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const db = adminDatabases();

    // Create a purchase record (idempotent — ignore 409 conflicts)
    const sanitizedPaymentId = paymentId.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 36);
    const purchaseId = sanitizedPaymentId.length > 0 ? sanitizedPaymentId : ID.unique();
    const nowIso = new Date().toISOString();

    try {
      await db.createDocument(DATABASE_ID, COLLECTION.purchases, purchaseId, {
        user_id: user.id,
        email: user.email,
        provider: "razorpay",
        order_id: orderId,
        payment_id: paymentId,
        status: "captured",
        product_code: `pass_${passId}_onetime`,
        amount: pass.oneTimePaise,
        currency: "INR",
        credits_granted: 0,
        credits_applied: true,
        verified_at: nowIso,
      });
    } catch (error) {
      if (!(error instanceof AppwriteException && error.code === 409)) {
        throw error;
      }
    }

    // Activate the pass under the electron balance lock
    return await withElectronBalanceLock(user.id, async () => {
      // Calculate pass expiry
      const activatedAt = new Date();
      const expiresAt = new Date(activatedAt);
      expiresAt.setDate(activatedAt.getDate() + pass.durationDays);

      // Create or update the user_passes document
      try {
        await db.createDocument(DATABASE_ID, COLLECTION.user_passes, ID.unique(), {
          user_id: user.id,
          pass_id: pass.id,
          mode: "onetime",
          status: "active",
          daily_electrons: pass.dailyElectrons,
          days_remaining: pass.durationDays,
          activated_at: activatedAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          razorpay_order_id: orderId,
        });
      } catch (error) {
        // If user_passes collection doesn't exist yet, log but don't fail the payment
        if (error instanceof AppwriteException && (error.code === 404 || error.code === 501)) {
          console.error("[verify-pass] user_passes collection not found. Run appwrite:sync to create it.", error);
        } else {
          throw error;
        }
      }

      return NextResponse.json({
        ok: true,
        message: `Pass activated! You can now claim ${pass.dailyElectrons}e/day for ${pass.durationDays} days.`,
        pass_id: pass.id,
        expires_at: expiresAt.toISOString(),
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to verify pass payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
