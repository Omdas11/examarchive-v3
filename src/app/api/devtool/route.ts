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

/**
 * POST /api/devtool
 * Founder-only system management operations.
 */
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user || !isFounder(user.role)) {
    return NextResponse.json({ error: "Forbidden: Founder access only." }, { status: 403 });
  }

  let body: { action?: string; userId?: string; role?: string; amount?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action } = body;
  if (!action) {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

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
        for (const col of collections) {
          if (skipped.has(col.$id)) continue;
          // Always start from the beginning to avoid offset shifting during deletes
          // and loop until no documents remain.
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { documents } = await db.listDocuments(DATABASE_ID, col.$id, [
              Query.limit(100),
            ]);
            if (documents.length === 0) break;
            for (const doc of documents) {
              await db.deleteDocument(DATABASE_ID, col.$id, doc.$id);
              totalDeleted++;
            }
          }
        }

        return NextResponse.json({
          success: true,
          message: `Purged ${totalDeleted} document${totalDeleted !== 1 ? "s" : ""} across ${collections.length - skipped.size} collection${collections.length - skipped.size !== 1 ? "s" : ""}. Users collection was skipped.`,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    case "clear_pending_uploads": {
      try {
        let deleted = 0;
        let hasMore = true;
        while (hasMore) {
          const { documents } = await db.listDocuments(
            DATABASE_ID,
            COLLECTION.papers,
            [Query.equal("approved", false), Query.limit(100)],
          );
          if (documents.length === 0) {
            hasMore = false;
          } else {
            for (const doc of documents) {
              await db.deleteDocument(DATABASE_ID, COLLECTION.papers, doc.$id);
              deleted++;
            }
          }
        }
        return NextResponse.json({
          success: true,
          message: `Deleted ${deleted} pending upload${deleted !== 1 ? "s" : ""}.`,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    case "clear_pending_syllabus": {
      try {
        let deleted = 0;
        let hasMore = true;
        while (hasMore) {
          const { documents } = await db.listDocuments(
            DATABASE_ID,
            COLLECTION.syllabus,
            [Query.equal("approval_status", "pending"), Query.limit(100)],
          );
          if (documents.length === 0) {
            hasMore = false;
          } else {
            for (const doc of documents) {
              await db.deleteDocument(DATABASE_ID, COLLECTION.syllabus, doc.$id);
              deleted++;
            }
          }
        }
        return NextResponse.json({
          success: true,
          message: `Deleted ${deleted} pending syllabus submission${deleted !== 1 ? "s" : ""}.`,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    case "clear_activity_logs": {
      try {
        let deleted = 0;
        let hasMore = true;
        while (hasMore) {
          const { documents } = await db.listDocuments(
            DATABASE_ID,
            COLLECTION.activity_logs,
            [Query.limit(100)],
          );
          if (documents.length === 0) {
            hasMore = false;
          } else {
            for (const doc of documents) {
              await db.deleteDocument(DATABASE_ID, COLLECTION.activity_logs, doc.$id);
              deleted++;
            }
          }
        }
        return NextResponse.json({
          success: true,
          message: `Cleared ${deleted} activity log entr${deleted !== 1 ? "ies" : "y"}.`,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    case "reset_all_papers": {
      try {
        let deleted = 0;
        let hasMore = true;
        while (hasMore) {
          const { documents } = await db.listDocuments(
            DATABASE_ID,
            COLLECTION.papers,
            [Query.limit(100)],
          );
          if (documents.length === 0) {
            hasMore = false;
          } else {
            for (const doc of documents) {
              await db.deleteDocument(DATABASE_ID, COLLECTION.papers, doc.$id);
              deleted++;
            }
          }
        }
        return NextResponse.json({
          success: true,
          message: `Permanently deleted ${deleted} paper${deleted !== 1 ? "s" : ""}.`,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: msg }, { status: 500 });
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
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

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
        const newXp = action === "xp_add" ? Math.max(0, currentXp + amount) : Math.max(0, amount);
        await db.updateDocument(DATABASE_ID, COLLECTION.users, userId, { xp: newXp });
        return NextResponse.json({
          success: true,
          message: `XP ${action === "xp_add" ? "adjusted" : "set"} to ${newXp} for user ${userId}.`,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    case "reset_users_xp": {
      try {
        let updated = 0;
        let hasMore = true;
        while (hasMore) {
          const { documents } = await db.listDocuments(
            DATABASE_ID,
            COLLECTION.users,
            [Query.limit(100)],
          );
          if (documents.length === 0) {
            hasMore = false;
          } else {
            for (const doc of documents) {
              await db.updateDocument(DATABASE_ID, COLLECTION.users, doc.$id, {
                xp: 0,
                streak_days: 0,
              });
              updated++;
            }
          }
        }
        return NextResponse.json({
          success: true,
          message: `Reset XP and streak for ${updated} user${updated !== 1 ? "s" : ""}.`,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
