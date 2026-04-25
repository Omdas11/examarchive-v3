import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { AppwriteException } from "node-appwrite";
import { getServerUser } from "@/lib/auth";
import { adminDatabases, COLLECTION, DATABASE_ID, ID } from "@/lib/appwrite";
import { getCreditPackByCode, getRazorpayClient, getFirstTimerAmountInPaise } from "@/lib/payments";
import { withElectronBalanceLock } from "@/lib/electron-lock";

type VerifyBody = {
  packCode?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
};
type CreditPack = NonNullable<ReturnType<typeof getCreditPackByCode>>;
const MAX_PAYMENT_ID_LENGTH = 36;
const CREDIT_APPLYING_STALE_MS = 5 * 60 * 1000;

/**
 * Current sanitizer for new purchase IDs:
 * allows letters, digits, underscores, periods and dashes.
 */
function sanitizePaymentIdCurrent(paymentId: string): string {
  return paymentId
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, MAX_PAYMENT_ID_LENGTH);
}

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ error: "PAYLOAD_SERIALIZATION_FAILED" });
  }
}

function purchaseMatchesVerifiedPayment(
  purchase: Record<string, unknown>,
  expected: {
    userId: string;
    orderId: string;
    paymentId: string;
    productCode: string;
    amount: number;
    currency: string;
  },
): boolean {
  return (
    purchase.user_id === expected.userId &&
    purchase.order_id === expected.orderId &&
    purchase.payment_id === expected.paymentId &&
    purchase.product_code === expected.productCode &&
    Number(purchase.amount) === expected.amount &&
    purchase.currency === expected.currency
  );
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

function purchaseConflictResponse(message = "Purchase record conflict detected. Please contact support for reconciliation.") {
  return NextResponse.json({ error: message }, { status: 409 });
}

function alreadyVerifiedResponse(aiCredits: number) {
  return NextResponse.json({
    ok: true,
    message: "Payment already verified.",
    ai_credits: aiCredits,
  });
}

async function applyCreditsUnderLock(params: {
  db: ReturnType<typeof adminDatabases>;
  userId: string;
  orderId: string;
  paymentId: string;
  requestedPackCode: string;
  purchaseDocumentId: string;
  pack: CreditPack;
  /** Actual amount charged (may differ from pack.amountInPaise for discounted orders). */
  effectiveAmount: number;
}): Promise<NextResponse> {
  const {
    db,
    userId,
    orderId,
    paymentId,
    requestedPackCode,
    purchaseDocumentId,
    pack,
    effectiveAmount,
  } = params;

  const purchase = await db.getDocument(DATABASE_ID, COLLECTION.purchases, purchaseDocumentId);
  if (
    !purchaseMatchesVerifiedPayment(purchase as Record<string, unknown>, {
      userId,
      orderId,
      paymentId,
      productCode: pack.code,
      amount: effectiveAmount,
      currency: "INR",
    })
  ) {
    return purchaseConflictResponse();
  }

  const userDoc = await db.getDocument(DATABASE_ID, COLLECTION.users, userId);
  const currentCredits = Number(userDoc.ai_credits ?? 0);
  if (!Number.isFinite(currentCredits)) {
    throw new Error("INVALID_USER_CREDITS_BALANCE");
  }
  const packCredits = Number(pack.credits);
  if (!Number.isFinite(packCredits)) {
    throw new Error("INVALID_PACK_CREDITS_VALUE");
  }
  const preCreditBalanceRaw = purchase.pre_credit_balance;
  const preCreditBalance =
    typeof preCreditBalanceRaw === "number" && Number.isFinite(preCreditBalanceRaw)
      ? preCreditBalanceRaw
      : null;
  const purchaseStatus = typeof purchase.status === "string" ? purchase.status : "";
  const purchaseCreditsApplied = purchase.credits_applied === true;

  if (purchaseCreditsApplied) {
    return alreadyVerifiedResponse(currentCredits);
  }

  if (purchaseStatus === "credit_applying") {
    const applyingAtRaw =
      typeof purchase.credit_applying_at === "string" ? purchase.credit_applying_at : "";
    const applyingAtMs = applyingAtRaw ? Date.parse(applyingAtRaw) : NaN;
    const lockAgeMs = Number.isFinite(applyingAtMs) ? Date.now() - applyingAtMs : NaN;
    if (!Number.isFinite(lockAgeMs) || lockAgeMs < CREDIT_APPLYING_STALE_MS) {
      return NextResponse.json(
        { error: "Payment credit reconciliation is in progress. Please retry shortly." },
        { status: 409 },
      );
    }

    if (preCreditBalance !== null && currentCredits === preCreditBalance + packCredits) {
      await db.updateDocument(DATABASE_ID, COLLECTION.purchases, purchaseDocumentId, {
        status: "captured",
        credits_applied: true,
      });
      return alreadyVerifiedResponse(currentCredits);
    }
    if (preCreditBalance !== null && currentCredits === preCreditBalance) {
      await db.updateDocument(DATABASE_ID, COLLECTION.purchases, purchaseDocumentId, {
        status: "captured_pending_credit",
        credits_applied: false,
      });
    } else {
      if (preCreditBalance === null) {
        return NextResponse.json(
          { error: "Payment reconciliation is missing state metadata. Please contact support." },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: "Payment reconciliation requires manual verification. Please contact support." },
        { status: 409 },
      );
    }
  }

  const nextCredits = currentCredits + packCredits;
  if (!Number.isFinite(nextCredits)) {
    throw new Error("INVALID_CREDITS_BALANCE_COMPUTATION");
  }
  const updatedCredits = Math.max(0, nextCredits);
  const creditApplyingAtIso = new Date().toISOString();

  await db.updateDocument(DATABASE_ID, COLLECTION.purchases, purchaseDocumentId, {
    status: "credit_applying",
    credits_applied: false,
    credit_applying_at: creditApplyingAtIso,
    pre_credit_balance: currentCredits,
  });

  try {
    await db.updateDocument(DATABASE_ID, COLLECTION.users, userId, {
      ai_credits: updatedCredits,
    });
  } catch (creditApplyError) {
    try {
      await db.updateDocument(DATABASE_ID, COLLECTION.purchases, purchaseDocumentId, {
        status: "captured_pending_credit",
        credits_applied: false,
      });
    } catch (rollbackError) {
      console.error("[payments.razorpay.verify] CRITICAL rollback failure after credit apply error.", {
        userId,
        orderId,
        paymentId,
        purchaseDocumentId,
        requestedPackCode,
        appliedPackCode: pack.code,
        creditApplyError,
        rollbackError,
      });
    }
    throw creditApplyError;
  }

  await db.updateDocument(DATABASE_ID, COLLECTION.purchases, purchaseDocumentId, {
    status: "captured",
    credits_applied: true,
  });

  return NextResponse.json({
    ok: true,
    message: `Added ${packCredits} electrons to your balance.`,
    ai_credits: updatedCredits,
  });
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
  let effectiveAmount = 0;
  let razorpayOrderPayload: Record<string, unknown> | null = null;
  try {
    const razorpay = getRazorpayClient();
    const order = await razorpay.orders.fetch(orderId);
    razorpayOrderPayload = order as unknown as Record<string, unknown>;
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

    // Accept either the full price or the first-timer discounted price.
    // The order amount was set server-side in create-order, so we trust order.amount.
    const fullPrice = orderPack.amountInPaise;
    const firstTimerPrice = getFirstTimerAmountInPaise(orderPack);
    const isFirstTimerDiscount =
      order.notes?.is_first_timer_discount === "true" &&
      order.amount === firstTimerPrice;
    const expectedAmount = isFirstTimerDiscount ? firstTimerPrice : fullPrice;

    if (order.amount !== expectedAmount || order.currency !== "INR") {
      return NextResponse.json({ error: "Order amount validation failed." }, { status: 400 });
    }

    pack = orderPack;
    effectiveAmount = expectedAmount;
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
    if (!pack) {
      return NextResponse.json({ error: "Invalid order pack metadata." }, { status: 400 });
    }
    const sanitizedPaymentId = sanitizePaymentIdCurrent(paymentId);
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
        amount: effectiveAmount,
        currency: "INR",
        credits_granted: pack.credits,
        credits_applied: false,
        verified_at: nowIso,
        raw_payload: safeJsonStringify({
          request_body: body,
          razorpay_order_payload: razorpayOrderPayload,
          verified_signature: signature,
        }),
      });
    } catch (error) {
      if (!(error instanceof AppwriteException && error.code === 409)) {
        throw error;
      }
    }

    const resolvedPurchaseDocumentId = purchaseDocumentId;
    const existingPurchase = await getPurchaseByIdOrNull(db, resolvedPurchaseDocumentId);
    if (
      existingPurchase &&
      !purchaseMatchesVerifiedPayment(existingPurchase, {
        userId: user.id,
        orderId,
        paymentId,
        productCode: pack.code,
        amount: effectiveAmount,
          currency: "INR",
        })
    ) {
      return purchaseConflictResponse();
    }

    if (existingPurchase?.credits_applied === true) {
      const userDoc = await db.getDocument(DATABASE_ID, COLLECTION.users, user.id);
      return alreadyVerifiedResponse(Number(userDoc.ai_credits ?? 0));
    }

    return await withElectronBalanceLock(user.id, async () => {
      return applyCreditsUnderLock({
        db,
        userId: user.id,
        orderId,
        paymentId,
        requestedPackCode,
        purchaseDocumentId: resolvedPurchaseDocumentId,
        pack,
        effectiveAmount,
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to verify payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
