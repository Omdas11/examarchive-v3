import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import {
  adminDatabases,
  DATABASE_ID,
  COLLECTION,
  ID,
  Query,
} from "@/lib/appwrite";
import { withCreditBalanceLock } from "@/lib/credit-lock";
import { xpTier } from "@/lib/roles";
import { evaluateVerificationPromotion } from "@/lib/verify-promotion";
import {
  isValidVerifyContentType,
  isValidVerifyVerdict,
  verifyAwards,
  verificationToJson,
  VERIFY_DAILY_CREDIT_CAP,
  VERIFY_DAILY_XP_CAP,
} from "@/lib/verify";

export const dynamic = "force-dynamic";

/**
 * GET /api/verify?content_type=&content_id=
 * The caller's verification row for one content item, plus item totals.
 * Logged-in users only; logged-out callers get 401 and the strip hides.
 */
export async function GET(req: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const contentType = searchParams.get("content_type");
  const contentId = searchParams.get("content_id");
  if (!isValidVerifyContentType(contentType) || !contentId || !contentId.trim()) {
    return NextResponse.json({ error: "Invalid content_type or content_id" }, { status: 400 });
  }

  try {
    const db = adminDatabases();
    const [mine, totals, corrects] = await Promise.all([
      db.listDocuments(DATABASE_ID, COLLECTION.content_verifications, [
        Query.equal("user_id", user.id),
        Query.equal("content_type", contentType),
        Query.equal("content_id", contentId),
        Query.limit(1),
      ]),
      db.listDocuments(DATABASE_ID, COLLECTION.content_verifications, [
        Query.equal("content_type", contentType),
        Query.equal("content_id", contentId),
        Query.limit(1),
      ]),
      db.listDocuments(DATABASE_ID, COLLECTION.content_verifications, [
        Query.equal("content_type", contentType),
        Query.equal("content_id", contentId),
        Query.equal("verdict", "correct"),
        Query.limit(1),
      ]),
    ]);

    const total = Number(totals.total ?? 0);
    const correct = Number(corrects.total ?? 0);
    const mineDoc = mine.documents[0] as Record<string, unknown> | undefined;
    return NextResponse.json({
      mine: mineDoc ? verificationToJson(mineDoc) : null,
      total,
      correct,
      flagged: total - correct,
    });
  } catch {
    return NextResponse.json({ error: "Failed to load verification" }, { status: 500 });
  }
}

/**
 * POST /api/verify
 * Submit a verification for one content item. One row per (user, content):
 * changing a verdict updates the row but never pays twice. Rewards are
 * capped per day; abuse-flagged accounts are blocked outright.
 */
export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const contentType = body.content_type;
  const contentId = typeof body.content_id === "string" ? body.content_id.trim() : "";
  const verdict = body.verdict;
  const correction =
    typeof body.correction === "string" ? body.correction.slice(0, 2000) : "";
  if (
    !isValidVerifyContentType(contentType) ||
    !contentId ||
    contentId.length > 256 ||
    !isValidVerifyVerdict(verdict)
  ) {
    return NextResponse.json({ error: "Invalid verification payload" }, { status: 400 });
  }

  try {
    const db = adminDatabases();

    // Profile doc for the abuse flag (not part of the session profile).
    let profile: Record<string, unknown> | null = null;
    try {
      profile = (await db.getDocument(
        DATABASE_ID,
        COLLECTION.users,
        user.id,
      )) as Record<string, unknown>;
    } catch {
      profile = null;
    }
    if (profile && Boolean(profile.abuse_flag)) {
      return NextResponse.json(
        { error: "Verification rewards are disabled for this account." },
        { status: 403 },
      );
    }

    // Already verified? Update the verdict/correction, never double-pay.
    const existing = await db.listDocuments(
      DATABASE_ID,
      COLLECTION.content_verifications,
      [
        Query.equal("user_id", user.id),
        Query.equal("content_type", contentType),
        Query.equal("content_id", contentId),
        Query.limit(1),
      ],
    );
    const existingDoc = existing.documents[0] as Record<string, unknown> | undefined;
    if (existingDoc) {
      if (
        existingDoc.verdict !== verdict ||
        (existingDoc.correction ?? "") !== correction
      ) {
        await db.updateDocument(
          DATABASE_ID,
          COLLECTION.content_verifications,
          existingDoc.$id as string,
          { verdict, correction },
        );
      }
      return NextResponse.json({
        already: true,
        verification: verificationToJson(existingDoc),
        xp_awarded: Number(existingDoc.xp_awarded ?? 0),
        credits_awarded: Number(existingDoc.credits_awarded ?? 0),
      });
    }

    // Daily sums from today's rows (UTC day). Over 100 rows today means
    // farming territory — treat the caps as reached.
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayRows = await db.listDocuments(
      DATABASE_ID,
      COLLECTION.content_verifications,
      [
        Query.equal("user_id", user.id),
        Query.limit(100),
        Query.orderDesc("$createdAt"),
      ],
    );
    let xpToday = 0;
    let creditsToday = 0;
    if (Number(todayRows.total ?? 0) > 100) {
      xpToday = VERIFY_DAILY_XP_CAP;
      creditsToday = VERIFY_DAILY_CREDIT_CAP;
    } else {
      for (const r of todayRows.documents) {
        const created = (r.$createdAt as string) ?? "";
        if (created >= todayStart.toISOString()) {
          xpToday += Number((r as Record<string, unknown>).xp_awarded ?? 0);
          creditsToday += Number((r as Record<string, unknown>).credits_awarded ?? 0);
        }
      }
    }

    const awards = verifyAwards({ verdict, xpToday, creditsToday });

    const result = await withCreditBalanceLock(user.id, async () => {
      const fresh = (await db.getDocument(
        DATABASE_ID,
        COLLECTION.users,
        user.id,
      )) as Record<string, unknown>;
      const newXp = Number(fresh.xp ?? 0) + awards.xp;
      const newCredits = Number(fresh.ai_credits ?? 0) + awards.credits;
      await db.updateDocument(DATABASE_ID, COLLECTION.users, user.id, {
        xp: newXp,
        ai_credits: newCredits,
      });
      const row = await db.createDocument(
        DATABASE_ID,
        COLLECTION.content_verifications,
        ID.unique(),
        {
          user_id: user.id,
          content_type: contentType,
          content_id: contentId,
          verdict,
          correction,
          xp_awarded: awards.xp,
          credits_awarded: awards.credits,
          status: verdict === "flagged" ? "pending" : "accepted",
        },
      );
      return { row: row as unknown as Record<string, unknown>, newXp, newCredits };
    });

    // Verification-based promotion runs best-effort after the award.
    await evaluateVerificationPromotion(user.id);

    return NextResponse.json({
      already: false,
      verification: verificationToJson(result.row),
      xp_awarded: awards.xp,
      credits_awarded: awards.credits,
      xp: result.newXp,
      credits: result.newCredits,
      tier: xpTier(result.newXp),
    });
  } catch {
    return NextResponse.json({ error: "Failed to save verification" }, { status: 500 });
  }
}
