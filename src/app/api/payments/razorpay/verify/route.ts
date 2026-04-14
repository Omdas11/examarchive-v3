import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { AppwriteException } from "node-appwrite";
import { getServerUser } from "@/lib/auth";
import { adminDatabases, COLLECTION, DATABASE_ID, ID } from "@/lib/appwrite";
import { getCreditPackByCode, getRazorpayClient } from "@/lib/payments";
import { withElectronBalanceLock } from "@/lib/electron-lock";

type VerifyBody = {
  packCode?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
};
const MAX_PAYMENT_ID_LENGTH = 36;

/**
 * Current sanitizer for new purchase IDs:
 * allows letters, digits, underscores, periods and dashes.
 */
function sanitizePaymentIdCurrent(paymentId: string): string {
  return paymentId
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, MAX_PAYMENT_ID_LENGTH);
}

/**
 * Legacy sanitizer kept for backward-lookup compatibility with IDs
 * generated before period support was enabled.
 */
function sanitizePaymentIdLegacyNoDot(paymentId: string): string {
  return paymentId
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, MAX_PAYMENT_ID_LENGTH);
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

async function getPurchaseByIdOrNull(
  db: ReturnType<typeof adminDatabases>,
  purchaseId: string,
): Promise<Record<string, unknown> | null> {
  try {
    return await db.getDocument(DATABASE_ID, COLLECTION.purchases, purchaseId);
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 404) return null;
    throw error;
  }
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

  const requestedPackCode = typeof body.packCode === "string" ? body.packCode : "";
  const orderId = typeof body.razorpay_order_id === "string" ? body.razorpay_order_id : "";
  const paymentId = typeof body.razorpay_payment_id === "string" ? body.razorpay_payment_id : "";
  const signature = typeof body.razorpay_signature === "string" ? body.razorpay_signature : "";
  const secret = process.env.RAZORPAY_KEY_SECRET ?? "";

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

  let pack: ReturnType<typeof getCreditPackByCode> | null = null;
  try {
    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.fetch(orderId);
    const orderPackCode = typeof order.notes?.pack_code === "string" ? order.notes.pack_code : "";
    const orderUserId = typeof order.notes?.user_id === "string" ? order.notes.user_id : "";

    if (!orderPackCode) {
      return NextResponse.json({ error: "Order is missing pack metadata." }, { status: 400 });
    }
    if (!orderUserId) {
      return NextResponse.json({ error: "Order is missing user metadata." }, { status: 400 });
    }
    if (orderUserId !== user.id) {
      return NextResponse.json({ error: "Order user does not match authenticated user." }, { status: 403 });
    }

    const orderPack = getCreditPackByCode(orderPackCode);
    if (!orderPack) {
      return NextResponse.json({ error: "Invalid order pack metadata." }, { status: 400 });
    }

    if (order.amount !== orderPack.amountInPaise || order.currency !== "INR") {
      return NextResponse.json({ error: "Order amount validation failed." }, { status: 400 });
    }

    pack = orderPack;
  } catch (error) {
    const err = error as { statusCode?: unknown; message?: unknown } | undefined;
    const statusCode = typeof err?.statusCode === "number" ? err.statusCode : undefined;
    let message = err && typeof err.message === "string" ? err.message : "Unable to validate Razorpay order metadata.";
    if (statusCode === 404) message = "Razorpay order not found.";
    if (statusCode === 401 || statusCode === 403) message = "Razorpay authentication failed while validating order.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const db = adminDatabases();
    const sanitizedPaymentId = sanitizePaymentIdCurrent(paymentId);
    const legacySanitizedPaymentId = sanitizePaymentIdLegacyNoDot(paymentId);
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
    }

    let resolvedPurchaseDocumentId = purchaseDocumentId;
    let existingPurchase = await getPurchaseByIdOrNull(db, resolvedPurchaseDocumentId);

    const canUseLegacyPurchaseId =
      Boolean(legacySanitizedPaymentId) && legacySanitizedPaymentId !== purchaseDocumentId;
    if (!existingPurchase && canUseLegacyPurchaseId) {
      const legacyPurchase = await getPurchaseByIdOrNull(db, legacySanitizedPaymentId);
      if (legacyPurchase) {
        resolvedPurchaseDocumentId = legacySanitizedPaymentId;
        existingPurchase = legacyPurchase;
      }
    }

    if (existingPurchase?.credits_applied === true) {
      const userDoc = await db.getDocument(DATABASE_ID, COLLECTION.users, user.id);
      return NextResponse.json({
        ok: true,
        message: "Payment already verified.",
        ai_credits: Number(userDoc.ai_credits ?? 0),
      });
    }

    return await withElectronBalanceLock(user.id, async () => {
      const purchase = await db.getDocument(DATABASE_ID, COLLECTION.purchases, resolvedPurchaseDocumentId);
      const userDoc = await db.getDocument(DATABASE_ID, COLLECTION.users, user.id);
      const currentCredits = Number(userDoc.ai_credits ?? 0);
      if (!Number.isFinite(currentCredits)) {
        throw new Error("INVALID_USER_CREDITS_BALANCE");
      }
      const purchaseStatus = typeof purchase.status === "string" ? purchase.status : "";
      const purchaseCreditsApplied = purchase.credits_applied === true;

      if (purchaseCreditsApplied) {
        return NextResponse.json({
          ok: true,
          message: "Payment already verified.",
          ai_credits: currentCredits,
        });
      }

      if (purchaseStatus === "credit_applying") {
        return NextResponse.json(
          { error: "Payment credit reconciliation is in progress. Please retry shortly." },
          { status: 409 },
        );
      }
      const packCredits = Number(pack.credits);
      if (!Number.isFinite(packCredits)) {
        throw new Error("INVALID_PACK_CREDITS_VALUE");
      }
      const nextCredits = currentCredits + packCredits;
      if (!Number.isFinite(nextCredits)) {
        throw new Error("INVALID_CREDITS_BALANCE_COMPUTATION");
      }
      const updatedCredits = Math.max(0, nextCredits);

      // Mark transition into credit application while keeping credits_applied=false
      // until the user balance update succeeds.
      await db.updateDocument(DATABASE_ID, COLLECTION.purchases, resolvedPurchaseDocumentId, {
        status: "credit_applying",
        credits_applied: false,
      });

      try {
        await db.updateDocument(DATABASE_ID, COLLECTION.users, user.id, {
          ai_credits: updatedCredits,
        });
      } catch (creditApplyError) {
        try {
          await db.updateDocument(DATABASE_ID, COLLECTION.purchases, resolvedPurchaseDocumentId, {
            status: "captured_pending_credit",
            credits_applied: false,
          });
        } catch (rollbackError) {
          console.error("[payments.razorpay.verify] CRITICAL rollback failure after credit apply error.", {
            userId: user.id,
            orderId,
            paymentId,
            purchaseDocumentId: resolvedPurchaseDocumentId,
            requestedPackCode,
            appliedPackCode: pack.code,
            creditApplyError,
            rollbackError,
          });
        }
        throw creditApplyError;
      }

      await db.updateDocument(DATABASE_ID, COLLECTION.purchases, resolvedPurchaseDocumentId, {
        status: "captured",
        credits_applied: true,
      });

      return NextResponse.json({
        ok: true,
        message: `Added ${packCredits}e to your balance.`,
        ai_credits: updatedCredits,
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to verify payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
