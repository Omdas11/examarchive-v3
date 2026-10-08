export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/auth";
import { isFounder } from "@/lib/roles";
import {
  adminDatabases,
  DATABASE_ID,
  COLLECTION,
  Query,
} from "@/lib/appwrite";
import { logActivity } from "@/lib/activity-log";

/**
 * POST /api/admin/reset-gamification
 * Full clean slate: reset XP, tier, and streak for ALL users (including the
 * caller), and delete ALL achievement/badge documents.
 * Founder-only. AI credits are NOT touched.
 */
export async function POST() {
  const user = await getServerUser();
  if (!user || !isFounder(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = adminDatabases();
  let usersReset = 0;
  let achievementsDeleted = 0;

  try {
    // Reset all user documents (paginated)
    let offset = 0;
    const PAGE = 100;
    for (;;) {
      const { documents, total } = await db.listDocuments(
        DATABASE_ID,
        COLLECTION.users,
        [Query.limit(PAGE), Query.offset(offset)],
      );
      for (const doc of documents) {
        await db.updateDocument(DATABASE_ID, COLLECTION.users, doc.$id, {
          xp: 0,
          tier: "bronze",
          streak_days: 0,
        });
        usersReset++;
      }
      offset += documents.length;
      if (offset >= total || documents.length === 0) break;
    }

    // Delete all achievement documents.
    // Re-list from offset 0 each round since deletions shift offsets.
    for (;;) {
      const { documents } = await db.listDocuments(
        DATABASE_ID,
        COLLECTION.achievements,
        [Query.limit(PAGE), Query.offset(0)],
      );
      if (documents.length === 0) break;
      for (const doc of documents) {
        await db.deleteDocument(DATABASE_ID, COLLECTION.achievements, doc.$id);
        achievementsDeleted++;
      }
    }

    await logActivity({
      admin_id: user.id,
      admin_email: user.email,
      action: "reset_gamification",
      target_user_id: null,
      target_paper_id: null,
      details: `Reset XP/tier/streak for ${usersReset} users, deleted ${achievementsDeleted} achievements (full clean slate)`,
    });

    return NextResponse.json({ usersReset, achievementsDeleted });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message, usersReset, achievementsDeleted },
      { status: 500 },
    );
  }
}
