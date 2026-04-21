import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import { isFounder } from "@/lib/roles";
import {
  adminDatabases,
  adminStorage,
  adminUsers,
  adminFunctions,
  DATABASE_ID,
  Query,
} from "@/lib/appwrite";

/**
 * POST /api/devtool/appwrite
 * Founder-only proxy to the node-appwrite Server SDK.
 * Supports: listCollections, listDocuments, updateDocument, deleteDocument,
 *           listBuckets, listFiles, deleteFile, listUsers, listFunctions, listExecutions.
 */
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user || !isFounder(user.role)) {
    return NextResponse.json({ error: "Forbidden: Founder access only." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action } = body;
  if (typeof action !== "string" || !action) {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  try {
    switch (action) {
      // ── Databases ────────────────────────────────────────────────────────
      case "listCollections": {
        const db = adminDatabases();
        const limit = typeof body.limit === "number" ? body.limit : 100;
        const offset = typeof body.offset === "number" ? body.offset : 0;
        const result = await db.listCollections(DATABASE_ID, [
          Query.limit(limit),
          Query.offset(offset),
        ]);
        return NextResponse.json({ collections: result.collections, total: result.total });
      }

      case "listDocuments": {
        const collectionId = body.collectionId;
        if (typeof collectionId !== "string" || !collectionId) {
          return NextResponse.json({ error: "Missing collectionId" }, { status: 400 });
        }
        const db = adminDatabases();
        const limit = typeof body.limit === "number" ? body.limit : 25;
        const offset = typeof body.offset === "number" ? body.offset : 0;
        const result = await db.listDocuments(DATABASE_ID, collectionId, [
          Query.limit(limit),
          Query.offset(offset),
        ]);
        return NextResponse.json({ documents: result.documents, total: result.total });
      }

      case "updateDocument": {
        const { collectionId, documentId, data } = body;
        if (typeof collectionId !== "string" || !collectionId) {
          return NextResponse.json({ error: "Missing collectionId" }, { status: 400 });
        }
        if (typeof documentId !== "string" || !documentId) {
          return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
        }
        if (!data || typeof data !== "object" || Array.isArray(data)) {
          return NextResponse.json({ error: "data must be a JSON object (not an array or null)" }, { status: 400 });
        }
        const db = adminDatabases();
        const updated = await db.updateDocument(DATABASE_ID, collectionId, documentId, data as Record<string, unknown>);
        return NextResponse.json({ document: updated });
      }

      case "deleteDocument": {
        const { collectionId, documentId } = body;
        if (typeof collectionId !== "string" || !collectionId) {
          return NextResponse.json({ error: "Missing collectionId" }, { status: 400 });
        }
        if (typeof documentId !== "string" || !documentId) {
          return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
        }
        const db = adminDatabases();
        await db.deleteDocument(DATABASE_ID, collectionId, documentId);
        return NextResponse.json({ success: true });
      }

      // ── Storage ──────────────────────────────────────────────────────────
      case "listBuckets": {
        const storage = adminStorage();
        const limit = typeof body.limit === "number" ? body.limit : 100;
        const offset = typeof body.offset === "number" ? body.offset : 0;
        const result = await storage.listBuckets([
          Query.limit(limit),
          Query.offset(offset),
        ]);
        return NextResponse.json({ buckets: result.buckets, total: result.total });
      }

      case "listFiles": {
        const bucketId = body.bucketId;
        if (typeof bucketId !== "string" || !bucketId) {
          return NextResponse.json({ error: "Missing bucketId" }, { status: 400 });
        }
        const storage = adminStorage();
        const limit = typeof body.limit === "number" ? body.limit : 25;
        const offset = typeof body.offset === "number" ? body.offset : 0;
        const result = await storage.listFiles(bucketId, [
          Query.limit(limit),
          Query.offset(offset),
        ]);
        return NextResponse.json({ files: result.files, total: result.total });
      }

      case "deleteFile": {
        const { bucketId, fileId } = body;
        if (typeof bucketId !== "string" || !bucketId) {
          return NextResponse.json({ error: "Missing bucketId" }, { status: 400 });
        }
        if (typeof fileId !== "string" || !fileId) {
          return NextResponse.json({ error: "Missing fileId" }, { status: 400 });
        }
        const storage = adminStorage();
        await storage.deleteFile(bucketId, fileId);
        return NextResponse.json({ success: true });
      }

      // ── Auth (Users) ─────────────────────────────────────────────────────
      case "listUsers": {
        const users = adminUsers();
        const limit = typeof body.limit === "number" ? body.limit : 25;
        const offset = typeof body.offset === "number" ? body.offset : 0;
        const result = await users.list([Query.limit(limit), Query.offset(offset)]);
        return NextResponse.json({ users: result.users, total: result.total });
      }

      // ── Functions ────────────────────────────────────────────────────────
      case "listFunctions": {
        const fns = adminFunctions();
        const limit = typeof body.limit === "number" ? body.limit : 100;
        const offset = typeof body.offset === "number" ? body.offset : 0;
        const result = await fns.list([Query.limit(limit), Query.offset(offset)]);
        return NextResponse.json({ functions: result.functions, total: result.total });
      }

      case "listExecutions": {
        const functionId = body.functionId;
        if (typeof functionId !== "string" || !functionId) {
          return NextResponse.json({ error: "Missing functionId" }, { status: 400 });
        }
        const fns = adminFunctions();
        const limit = typeof body.limit === "number" ? body.limit : 10;
        const offset = typeof body.offset === "number" ? body.offset : 0;
        const result = await fns.listExecutions(functionId, [
          Query.limit(limit),
          Query.offset(offset),
        ]);
        return NextResponse.json({ executions: result.executions, total: result.total });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[devtool/appwrite] action=${action} error:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
