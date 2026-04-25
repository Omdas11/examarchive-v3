import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { AppwriteException } from "node-appwrite";
import { getServerUser } from "@/lib/auth";
import { adminDatabases, DATABASE_ID, COLLECTION, ID, Query } from "@/lib/appwrite";
import { getRazorpayClient, PASSES } from "@/lib/payments";

type VerifyPassBody = {
  passId?: unknown;
  mode?: unknown;
  razorpay_order_id?: unknown;
  razorpay_payment_id?: unknown;
  razorpay_signature?: unknown;
  razorpay_subscription_id?: unknown;
};

const SUPPORTER_BADGE_ID = "supporter_badge";

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

async function awardSupporterBadge(
  db: ReturnType<typeof adminDatabases>,
  userId: string,
): Promise<void> {
  try {
    // Create a user_badges document if it doesn't already exist
    const { documents } = await db.listDocuments(DATABASE_ID, COLLECTION.user_badges, [
      Query.equal("user_id", userId),
      Query.equal("badge_id", SUPPORTER_BADGE_ID),
      Query.limit(1),
    ]);
    if (documents.length === 0) {
      await db.createDocument(DATABASE_ID, COLLECTION.user_badges, ID.unique(), {
        user_id: userId,
        badge_id: SUPPORTER_BADGE_ID,
        awarded_at: new Date().toISOString(),
        source: "supporter_subscription",
      });
    }

    // Also update the badges array on the user profile
    const userDoc = await db.getDocument(DATABASE_ID, COLLECTION.users, userId);
    const existing: string[] = Array.isArray(userDoc.badges) ? (userDoc.badges as string[]) : [];
    if (!existing.includes(SUPPORTER_BADGE_ID)) {
      await db.updateDocument(DATABASE_ID, COLLECTION.users, userId, {
        badges: [...existing, SUPPORTER_BADGE_ID],
      });
    }
  } catch {
    // Badge award is non-critical; silently ignore failures
  }
}

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: VerifyPassBody;
  try {
    body = (await request.json()) as VerifyPassBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const passId = typeof body.passId === "string" ? body.passId : "";
  const mode = typeof body.mode === "string" ? body.mode : "";
  const paymentId = typeof body.razorpay_payment_id === "string" ? body.razorpay_payment_id : "";
  const signature = typeof body.razorpay_signature === "string" ? body.razorpay_signature : "";
  const secret = process.env.RAZORPAY_KEY_SECRET ?? "";

  if (!paymentId || !signature) {
    return NextResponse.json(
      { error: "Missing Razorpay payment verification fields." },
      { status: 400 },
    );
  }
  if (!secret) {
    return NextResponse.json(
      { error: "Razorpay secret is not configured." },
      { status: 503 },
    );
  }

  const pass = PASSES.find((p) => p.id === passId);
  if (!pass) {
    return NextResponse.json({ error: "Invalid pass." }, { status: 400 });
  }
  if (mode !== "onetime" && mode !== "subscribe") {
    return NextResponse.json({ error: "Invalid mode." }, { status: 400 });
  }

  let orderId = "";
  let subscriptionId = "";

  if (mode === "onetime") {
    orderId = typeof body.razorpay_order_id === "string" ? body.razorpay_order_id : "";
    if (!orderId) {
      return NextResponse.json({ error: "Missing razorpay_order_id for onetime mode." }, { status: 400 });
    }

    // Verify signature: HMAC(orderId|paymentId)
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
    if (!timingSafeEqual(expectedSig, signature)) {
      return NextResponse.json(
        { error: "Payment signature verification failed." },
        { status: 400 },
      );
    }

    // Validate order via Razorpay API (confirm user and pass metadata)
    try {
      const razorpay = getRazorpayClient();
      const order = await razorpay.orders.fetch(orderId);
      const orderUserId = typeof order.notes?.user_id === "string" ? order.notes.user_id : "";
      const orderPassId = typeof order.notes?.pass_id === "string" ? order.notes.pass_id : "";
      if (orderUserId !== user.id) {
        return NextResponse.json(
          { error: "Order user does not match authenticated user." },
          { status: 403 },
        );
      }
      if (orderPassId !== passId) {
        return NextResponse.json({ error: "Order pass does not match requested pass." }, { status: 400 });
      }
      if (order.amount !== pass.oneTimePaise || order.currency !== "INR") {
        return NextResponse.json({ error: "Order amount validation failed." }, { status: 400 });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to validate Razorpay order metadata.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  } else {
    // Subscribe mode
    subscriptionId =
      typeof body.razorpay_subscription_id === "string" ? body.razorpay_subscription_id : "";
    if (!subscriptionId) {
      return NextResponse.json(
        { error: "Missing razorpay_subscription_id for subscribe mode." },
        { status: 400 },
      );
    }

    // Verify signature: HMAC(paymentId|subscriptionId)
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(`${paymentId}|${subscriptionId}`)
      .digest("hex");
    if (!timingSafeEqual(expectedSig, signature)) {
      return NextResponse.json(
        { error: "Payment signature verification failed." },
        { status: 400 },
      );
    }

    // Validate subscription via Razorpay API
    try {
      const razorpay = getRazorpayClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const razorpayAny = razorpay as any;
      const subscription = await razorpayAny.subscriptions.fetch(subscriptionId);
      const subUserId =
        typeof subscription.notes?.user_id === "string" ? subscription.notes.user_id : "";
      const subPassId =
        typeof subscription.notes?.pass_id === "string" ? subscription.notes.pass_id : "";
      if (subUserId !== user.id) {
        return NextResponse.json(
          { error: "Subscription user does not match authenticated user." },
          { status: 403 },
        );
      }
      if (subPassId !== passId) {
        return NextResponse.json(
          { error: "Subscription pass does not match requested pass." },
          { status: 400 },
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to validate Razorpay subscription metadata.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  try {
    const db = adminDatabases();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + pass.durationDays * 24 * 60 * 60 * 1000);

    // Check if pass is already active for this user (avoid duplicate activation)
    // For subscribe mode, use subscriptionId as uniqueness key
    if (mode === "subscribe" && subscriptionId) {
      const { documents } = await db.listDocuments(DATABASE_ID, COLLECTION.user_passes, [
        Query.equal("razorpay_subscription_id", subscriptionId),
        Query.limit(1),
      ]);
      if (documents.length > 0) {
        return NextResponse.json({
          ok: true,
          message: "Pass already activated.",
        });
      }
    }

    const passDoc: Record<string, unknown> = {
      user_id: user.id,
      pass_id: pass.id,
      mode,
      status: "active",
      daily_electrons: pass.dailyElectrons,
      days_remaining: pass.durationDays,
      activated_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };
    if (orderId) passDoc.razorpay_order_id = orderId;
    if (subscriptionId) passDoc.razorpay_subscription_id = subscriptionId;

    try {
      await db.createDocument(DATABASE_ID, COLLECTION.user_passes, ID.unique(), passDoc);
    } catch (err) {
      if (!(err instanceof AppwriteException && err.code === 409)) {
        throw err;
      }
      // Already exists — treat as success
    }

    // Award supporter badge if applicable
    if (pass.id === "supporter") {
      await awardSupporterBadge(db, user.id);
    }

    return NextResponse.json({
      ok: true,
      message: `${pass.label} activated! You can now claim your daily electrons.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to activate pass";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
