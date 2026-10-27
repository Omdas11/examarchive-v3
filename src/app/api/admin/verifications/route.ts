import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import {
  adminDatabases,
  DATABASE_ID,
  COLLECTION,
  Query,
} from "@/lib/appwrite";
import { withCreditBalanceLock } from "@/lib/credit-lock";
import {
  CORRECTION_BONUS_CREDITS,
  CORRECTION_BONUS_XP,
  verificationToJson,
} from "@/lib/verify";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/verifications
 * Pending flagged corrections (moderator review queue), enriched with
 * the reporter's name/email. Admin-only.
 */
export async function GET() {
  const user = await getServerUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = adminDatabases();
    const { documents } = await db.listDocuments(
      DATABASE_ID,
      COLLECTION.content_verifications,
      [
        Query.equal("verdict", "flagged"),
        Query.equal("status", "pending"),
        Query.orderDesc("$createdAt"),
        Query.limit(100),
      ],
    );

    const enriched = await Promise.all(
      documents.map(async (d) => {
        const doc = d as unknown as Record<string, unknown>;
        let userName: string | null = null;
        let userEmail: string | null = null;
        try {
          const u = (await db.getDocument(
            DATABASE_ID,
            COLLECTION.users,
            doc.user_id as string,
          )) as Record<string, unknown>;
          userName = ((u.display_name as string) || (u.username as string) || null) as
            | string
            | null;
          userEmail = (u.email as string) ?? null;
        } catch {
          // reporter profile may not exist
        }
        return { ...verificationToJson(doc), user_name: userName, user_email: userEmail };
      }),
    );

    return NextResponse.json({ verifications: enriched });
  } catch {
    return NextResponse.json({ error: "Failed to load verifications" }, { status: 500 });
  }
}

/**
 * POST /api/admin/verifications
 * Accept or reject a pending correction. Accepting grants the reporter
 * the correction bonus (+25 XP, +5 credits, bypassing daily caps since
 * it is moderator-gated). Admin-only.
 */
export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  const action = body.action;
  if (!id || (action !== "accept" && action !== "reject")) {
    return NextResponse.json({ error: "Invalid id or action" }, { status: 400 });
  }

  try {
    const db = adminDatabases();
    const row = (await db.getDocument(
      DATABASE_ID,
      COLLECTION.content_verifications,
      id,
    )) as Record<string, unknown>;
    if ((row.status as string) !== "pending") {
      return NextResponse.json({ error: "Verification already reviewed" }, { status: 400 });
    }

    if (action === "reject") {
      await db.updateDocument(DATABASE_ID, COLLECTION.content_verifications, id, {
        status: "rejected",
      });
      return NextResponse.json({
        verification: { ...verificationToJson(row), status: "rejected" },
      });
    }

    const reporterId = row.user_id as string;
    await withCreditBalanceLock(reporterId, async () => {
      const u = (await db.getDocument(
        DATABASE_ID,
        COLLECTION.users,
        reporterId,
      )) as Record<string, unknown>;
      await db.updateDocument(DATABASE_ID, COLLECTION.users, reporterId, {
        xp: Number(u.xp ?? 0) + CORRECTION_BONUS_XP,
        ai_credits: Number(u.ai_credits ?? 0) + CORRECTION_BONUS_CREDITS,
      });
      await db.updateDocument(DATABASE_ID, COLLECTION.content_verifications, id, {
        status: "accepted",
        xp_awarded: Number(row.xp_awarded ?? 0) + CORRECTION_BONUS_XP,
        credits_awarded: Number(row.credits_awarded ?? 0) + CORRECTION_BONUS_CREDITS,
      });
    });

    return NextResponse.json({
      verification: {
        ...verificationToJson(row),
        status: "accepted",
        xp_awarded: Number(row.xp_awarded ?? 0) + CORRECTION_BONUS_XP,
        credits_awarded: Number(row.credits_awarded ?? 0) + CORRECTION_BONUS_CREDITS,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to review verification" }, { status: 500 });
  }
}
