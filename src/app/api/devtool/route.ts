import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import { isFounder } from "@/lib/roles";
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

  let body: { action?: string };
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

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
