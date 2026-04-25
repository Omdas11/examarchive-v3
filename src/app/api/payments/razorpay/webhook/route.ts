import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { AppwriteException } from "node-appwrite";
import { adminDatabases, DATABASE_ID, COLLECTION, ID, Query } from "@/lib/appwrite";
import { PASSES } from "@/lib/payments";

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
        source: "supporter_subscription_webhook",
      });
    }
    const userDoc = await db.getDocument(DATABASE_ID, COLLECTION.users, userId);
    const existing: string[] = Array.isArray(userDoc.badges) ? (userDoc.badges as string[]) : [];
    if (!existing.includes(SUPPORTER_BADGE_ID)) {
      await db.updateDocument(DATABASE_ID, COLLECTION.users, userId, {
        badges: [...existing, SUPPORTER_BADGE_ID],
      });
    }
  } catch {
    // Non-critical
  }
}

async function handleSubscriptionActivated(
  payload: Record<string, unknown>,
): Promise<void> {
  const db = adminDatabases();
  const subscription =
    (payload.payload as Record<string, unknown>)?.subscription as Record<string, unknown> | undefined;
  const entity = (subscription?.entity ?? subscription) as Record<string, unknown> | undefined;
  if (!entity) return;

  const subscriptionId = typeof entity.id === "string" ? entity.id : "";
  const notes = (entity.notes ?? {}) as Record<string, unknown>;
  const userId = typeof notes.user_id === "string" ? notes.user_id : "";
  const passId = typeof notes.pass_id === "string" ? notes.pass_id : "";

  if (!subscriptionId || !userId || !passId) return;

  const pass = PASSES.find((p) => p.id === passId);
  if (!pass) return;

  // Avoid duplicates
  const { documents } = await db.listDocuments(DATABASE_ID, COLLECTION.user_passes, [
    Query.equal("razorpay_subscription_id", subscriptionId),
    Query.limit(1),
  ]);
  if (documents.length > 0) return;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + pass.durationDays * 24 * 60 * 60 * 1000);

  try {
    await db.createDocument(DATABASE_ID, COLLECTION.user_passes, ID.unique(), {
      user_id: userId,
      pass_id: pass.id,
      mode: "subscribe",
      status: "active",
      daily_electrons: pass.dailyElectrons,
      days_remaining: pass.durationDays,
      activated_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      razorpay_subscription_id: subscriptionId,
    });
  } catch (err) {
    if (!(err instanceof AppwriteException && err.code === 409)) {
      throw err;
    }
  }

  if (pass.id === "supporter") {
    await awardSupporterBadge(db, userId);
  }
}

async function handleSubscriptionCharged(
  payload: Record<string, unknown>,
): Promise<void> {
  // On each successful renewal, extend the pass and reset the monthly claim for supporter
  const db = adminDatabases();
  const subscription =
    (payload.payload as Record<string, unknown>)?.subscription as Record<string, unknown> | undefined;
  const entity = (subscription?.entity ?? subscription) as Record<string, unknown> | undefined;
  if (!entity) return;

  const subscriptionId = typeof entity.id === "string" ? entity.id : "";
  if (!subscriptionId) return;

  const { documents } = await db.listDocuments(DATABASE_ID, COLLECTION.user_passes, [
    Query.equal("razorpay_subscription_id", subscriptionId),
    Query.limit(1),
  ]);
  if (documents.length === 0) return;

  const passDoc = documents[0];
  const passId = typeof passDoc.pass_id === "string" ? passDoc.pass_id : "";
  const pass = PASSES.find((p) => p.id === passId);
  if (!pass) return;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + pass.durationDays * 24 * 60 * 60 * 1000);

  // Reset: extend expiry, reset days_remaining and allow fresh claims
  await db.updateDocument(DATABASE_ID, COLLECTION.user_passes, passDoc.$id as string, {
    status: "active",
    days_remaining: pass.durationDays,
    expires_at: expiresAt.toISOString(),
    last_daily_claim_at: null,
  });
}

async function handleSubscriptionEnded(
  payload: Record<string, unknown>,
  status: "cancelled" | "completed" | "expired",
): Promise<void> {
  const db = adminDatabases();
  const subscription =
    (payload.payload as Record<string, unknown>)?.subscription as Record<string, unknown> | undefined;
  const entity = (subscription?.entity ?? subscription) as Record<string, unknown> | undefined;
  if (!entity) return;

  const subscriptionId = typeof entity.id === "string" ? entity.id : "";
  if (!subscriptionId) return;

  const { documents } = await db.listDocuments(DATABASE_ID, COLLECTION.user_passes, [
    Query.equal("razorpay_subscription_id", subscriptionId),
    Query.limit(1),
  ]);
  if (documents.length === 0) return;

  const passDoc = documents[0];
  await db.updateDocument(DATABASE_ID, COLLECTION.user_passes, passDoc.$id as string, {
    status,
  });
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
  if (!webhookSecret) {
    // Secret not configured — log and return 200 so Razorpay doesn't retry
    console.error("[payments.webhook] RAZORPAY_WEBHOOK_SECRET is not configured.");
    return NextResponse.json({ ok: true });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  const expectedSig = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  if (!timingSafeEqual(expectedSig, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const event = typeof payload.event === "string" ? payload.event : "";

  try {
    switch (event) {
      case "subscription.activated":
        await handleSubscriptionActivated(payload);
        break;
      case "subscription.charged":
        await handleSubscriptionCharged(payload);
        break;
      case "subscription.cancelled":
        await handleSubscriptionEnded(payload, "cancelled");
        break;
      case "subscription.completed":
      case "subscription.expired":
        await handleSubscriptionEnded(payload, "expired");
        break;
      default:
        // Unknown event — acknowledge and ignore
        break;
    }
  } catch (error) {
    console.error("[payments.webhook] Error handling event", event, error);
    // Return 200 to avoid Razorpay retry storms; log for manual investigation
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
