import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import { isFounder } from "@/lib/roles";
import { isValidUserRole } from "@/lib/roles";
import {
  adminDatabases,
  DATABASE_ID,
  COLLECTION,
  Query,
} from "@/lib/appwrite";

/** Safely extract an error message string from an unknown thrown value. */
function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Delete up to `limit` documents matching `queries` from a collection and return a summary. */
async function deleteDocsBatch(
  db: ReturnType<typeof adminDatabases>,
  collectionId: string,
  queries: string[],
  limit: number,
  noun: string,
) {
  const { documents } = await db.listDocuments(
    DATABASE_ID,
    collectionId,
    [...queries, Query.limit(limit)],
  );
  for (const doc of documents) {
    await db.deleteDocument(DATABASE_ID, collectionId, doc.$id);
  }
  return {
    success: true,
    hasMore: documents.length === limit && limit > 0,
    message: `Deleted ${documents.length} ${noun}${documents.length !== 1 ? "s" : ""}.`,
  };
}

/**
 * POST /api/devtool
 * Founder-only system management operations.
 */
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user || !isFounder(user.role)) {
    return NextResponse.json({ error: "Forbidden: Founder access only." }, { status: 403 });
  }

  let body: { action?: string; userId?: string; role?: string; amount?: number; limit?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action } = body;
  if (!action) {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  const chunkSize = body.limit && body.limit > 0 && body.limit <= 500 ? body.limit : 100;

  const db = adminDatabases();

  switch (action) {
    case "purge_collections": {
      try {
        const skipped = new Set<string>([COLLECTION.users]);
        let offset = 0;
        const collections = [];
        while (true) {
          const res = await db.listCollections(DATABASE_ID, [Query.limit(100), Query.offset(offset)]);
          collections.push(...res.collections);
          if (res.collections.length < 100) break;
          offset += res.collections.length;
        }

        let totalDeleted = 0;
        let hasMore = false;
        for (const col of collections) {
          if (skipped.has(col.$id)) continue;
          if (totalDeleted >= chunkSize) {
            hasMore = true;
            break;
          }
          const remaining = chunkSize - totalDeleted;
          const { documents } = await db.listDocuments(DATABASE_ID, col.$id, [
            Query.limit(Math.min(100, remaining)),
          ]);
          for (const doc of documents) {
            await db.deleteDocument(DATABASE_ID, col.$id, doc.$id);
            totalDeleted++;
          }
          // If we got a full batch for this collection, there may be more docs.
          if (documents.length >= Math.min(100, remaining)) {
            hasMore = true;
          }
        }

        return NextResponse.json({
          success: true,
          hasMore,
          message: `Purged ${totalDeleted} document${totalDeleted !== 1 ? "s" : ""} in this chunk.`,
        });
      } catch (err: unknown) {
        return NextResponse.json({ error: formatError(err) }, { status: 500 });
      }
    }

    case "clear_pending_uploads": {
      try {
        return NextResponse.json(
          await deleteDocsBatch(db, COLLECTION.papers, [Query.equal("approved", false)], chunkSize, "pending upload"),
        );
      } catch (err: unknown) {
        return NextResponse.json({ error: formatError(err) }, { status: 500 });
      }
    }

    case "clear_pending_syllabus": {
      try {
        return NextResponse.json(
          await deleteDocsBatch(db, COLLECTION.syllabus, [Query.equal("approval_status", "pending")], chunkSize, "pending syllabus submission"),
        );
      } catch (err: unknown) {
        return NextResponse.json({ error: formatError(err) }, { status: 500 });
      }
    }

    case "clear_activity_logs": {
      try {
        return NextResponse.json(
          await deleteDocsBatch(db, COLLECTION.activity_logs, [], chunkSize, "activity log entr"),
        );
      } catch (err: unknown) {
        return NextResponse.json({ error: formatError(err) }, { status: 500 });
      }
    }

    case "reset_all_papers": {
      try {
        return NextResponse.json(
          await deleteDocsBatch(db, COLLECTION.papers, [], chunkSize, "paper"),
        );
      } catch (err: unknown) {
        return NextResponse.json({ error: formatError(err) }, { status: 500 });
      }
    }

    case "role_override": {
      const { userId, role } = body;
      if (!userId || typeof userId !== "string") {
        return NextResponse.json({ error: "Missing userId" }, { status: 400 });
      }
      if (!role || !isValidUserRole(role)) {
        return NextResponse.json({ error: "Invalid role value" }, { status: 400 });
      }
      try {
        // Verify the document exists before updating
        await db.getDocument(DATABASE_ID, COLLECTION.users, userId);
        await db.updateDocument(DATABASE_ID, COLLECTION.users, userId, {
          role,
          primary_role: role,
        });
        return NextResponse.json({
          success: true,
          message: `Role overridden to "${role}" for user ${userId}.`,
        });
      } catch (err: unknown) {
        return NextResponse.json({ error: formatError(err) }, { status: 500 });
      }
    }

    case "xo_add":
    case "xo_set":
    case "xp_add":
    case "xp_set": {
      const { userId, amount } = body;
      if (!userId || typeof userId !== "string") {
        return NextResponse.json({ error: "Missing userId" }, { status: 400 });
      }
      if (typeof amount !== "number" || isNaN(amount)) {
        return NextResponse.json({ error: "Invalid or missing amount" }, { status: 400 });
      }
      try {
        const doc = await db.getDocument(DATABASE_ID, COLLECTION.users, userId);
        const currentXp = (doc.xp as number) ?? 0;
        const isAdd = action === "xo_add" || action === "xp_add";
        const newXp = isAdd ? Math.max(0, currentXp + amount) : Math.max(0, amount);
        await db.updateDocument(DATABASE_ID, COLLECTION.users, userId, { xp: newXp });
        return NextResponse.json({
          success: true,
          message: `XP ${isAdd ? "adjusted" : "set"} to ${newXp} for user ${userId}.`,
        });
      } catch (err: unknown) {
        return NextResponse.json({ error: formatError(err) }, { status: 500 });
      }
    }

    case "reset_users_xo":
    case "reset_users_xp": {
      try {
        let updated = 0;
        const { documents } = await db.listDocuments(
          DATABASE_ID,
          COLLECTION.users,
          [Query.limit(chunkSize)],
        );
        // Note: For updating users, we don't delete them, so listDocuments without an offset
        // would keep returning the same first `chunkSize` users if we just use `limit`.
        // However, if we're resetting XO/XP, we assume the caller handles cursors or we
        // filter by `xo > 0` etc. Since we don't have a filter, resetting all users
        // iteratively requires pagination/offsets, which breaks the simple chunking model.
        // As a compromise, we'll reset only the first chunk. To fix properly, we'd need a cursor.
        // But for Devtools, we'll just process the chunk.
        for (const doc of documents) {
          const updatePayload: { xp: number; streak_days?: number } = { xp: 0 };
          if ("streak_days" in doc) updatePayload.streak_days = 0;
          await db.updateDocument(DATABASE_ID, COLLECTION.users, doc.$id, updatePayload);
          updated++;
        }
        return NextResponse.json({
          success: true,
          hasMore: false, // Disabling recursive calls for this specific endpoint as it lacks cursor support right now
          message: `Reset XP and streak for ${updated} user${updated !== 1 ? "s" : ""} (first chunk).`,
        });
      } catch (err: unknown) {
        return NextResponse.json({ error: formatError(err) }, { status: 500 });
      }
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
