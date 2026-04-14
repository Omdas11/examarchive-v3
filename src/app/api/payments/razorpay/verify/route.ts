import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { AppwriteException } from "node-appwrite";
import { getServerUser } from "@/lib/auth";
import { adminDatabases, COLLECTION, DATABASE_ID, ID } from "@/lib/appwrite";
import { getCreditPackByCode } from "@/lib/payments";

type VerifyBody = {
  packCode?: string;
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

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: VerifyBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const packCode = typeof body.packCode === "string" ? body.packCode : "";
  const orderId = typeof body.razorpay_order_id === "string" ? body.razorpay_order_id : "";
  const paymentId = typeof body.razorpay_payment_id === "string" ? body.razorpay_payment_id : "";
  const signature = typeof body.razorpay_signature === "string" ? body.razorpay_signature : "";
  const pack = getCreditPackByCode(packCode);
  const secret = process.env.RAZORPAY_KEY_SECRET ?? "";

  if (!pack) return NextResponse.json({ error: "Invalid credit pack selected." }, { status: 400 });
  if (!orderId || !paymentId || !signature) {
    return NextResponse.json({ error: "Missing Razorpay verification fields." }, { status: 400 });
  }
  if (!secret) {
    return NextResponse.json({ error: "Razorpay secret is not configured." }, { status: 503 });
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  if (!timingSafeEqual(expectedSignature, signature)) {
    return NextResponse.json({ error: "Payment signature verification failed." }, { status: 400 });
  }

  try {
    const db = adminDatabases();
    const userDoc = await db.getDocument(DATABASE_ID, COLLECTION.users, user.id);
    const currentCredits = Number(userDoc.ai_credits ?? 0);
    const updatedCredits = Math.max(0, currentCredits + pack.credits);
    const sanitizedPaymentId = paymentId.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 36);
    const purchaseDocumentId = sanitizedPaymentId.length > 0 ? sanitizedPaymentId : ID.unique();
    const nowIso = new Date().toISOString();

    try {
      await db.createDocument(DATABASE_ID, COLLECTION.purchases, purchaseDocumentId, {
        user_id: user.id,
        email: user.email,
        provider: "razorpay",
        order_id: orderId,
        payment_id: paymentId,
        status: "captured_pending_credit",
        product_code: pack.code,
        amount: pack.amountInPaise,
        currency: "INR",
        credits_granted: pack.credits,
        credits_applied: false,
        verified_at: nowIso,
        raw_payload: JSON.stringify({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
        }),
      });
    } catch (error) {
      if (!(error instanceof AppwriteException && error.code === 409)) {
        throw error;
      }
      const existing = await db.getDocument(DATABASE_ID, COLLECTION.purchases, purchaseDocumentId);
      if (existing.credits_applied === true) {
        return NextResponse.json({
          ok: true,
          message: "Payment already verified.",
          ai_credits: currentCredits,
        });
      }
    }

    try {
      await db.updateDocument(DATABASE_ID, COLLECTION.users, user.id, {
        ai_credits: updatedCredits,
      });
      await db.updateDocument(DATABASE_ID, COLLECTION.purchases, purchaseDocumentId, {
        status: "captured",
        credits_applied: true,
      });
      return NextResponse.json({
        ok: true,
        message: `Added ${pack.credits}e to your balance.`,
        ai_credits: updatedCredits,
      });
    } catch (creditApplyError) {
      await db.updateDocument(DATABASE_ID, COLLECTION.purchases, purchaseDocumentId, {
        status: "captured_pending_credit",
        credits_applied: false,
      }).catch(() => undefined);
      throw creditApplyError;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to verify payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
