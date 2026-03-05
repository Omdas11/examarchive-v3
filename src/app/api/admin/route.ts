import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import { isModerator } from "@/lib/roles";
import {
  adminDatabases,
  DATABASE_ID,
  COLLECTION,
} from "@/lib/appwrite";

/**
 * POST /api/admin
 * Admin/moderator-only route handler for managing papers.
 * Accepts `action` and `id` via JSON body, query params, or form body.
 * Role is verified server-side — cannot be bypassed from the client.
 */
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user || !isModerator(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  let action = searchParams.get("action");
  let id = searchParams.get("id");

  // Support JSON body (used by the client-side AdminActions component)
  if (!action || !id) {
    try {
      const contentType = request.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const json = await request.json();
        action = action ?? json.action;
        id = id ?? json.id;
      } else {
        const formData = await request.formData();
        action = action ?? (formData.get("action") as string | null);
        id = id ?? (formData.get("id") as string | null);
      }
    } catch {
      // body parsing may fail – ignore
    }
  }

  if (!action || !id) {
    return NextResponse.json({ error: "Missing action or id." }, { status: 400 });
  }

  const db = adminDatabases();

  switch (action) {
    case "approve": {
      try {
        await db.updateDocument(DATABASE_ID, COLLECTION.papers, id, {
          approved: true,
        });
        return NextResponse.json({ success: true });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }
    case "delete": {
      try {
        await db.deleteDocument(DATABASE_ID, COLLECTION.papers, id);
        return NextResponse.json({ success: true });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }
    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
