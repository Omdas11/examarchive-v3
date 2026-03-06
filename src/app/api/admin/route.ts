import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import { isModerator } from "@/lib/roles";
import {
  adminDatabases,
  DATABASE_ID,
  COLLECTION,
  ID,
  Query,
} from "@/lib/appwrite";

/** Upload-count thresholds for auto-promotion. */
const CONTRIBUTOR_THRESHOLD = 3;
const MODERATOR_ELIGIBLE_THRESHOLD = 20;

/**
 * Log an admin/moderation action to the activity_logs collection.
 * Failures are silently ignored (collection may not exist yet).
 */
async function logActivity(
  db: ReturnType<typeof adminDatabases>,
  entry: {
    action: string;
    target_user_id: string | null;
    target_paper_id: string | null;
    admin_id: string;
    admin_email: string;
    details: string;
  },
) {
  try {
    await db.createDocument(
      DATABASE_ID,
      COLLECTION.activity_logs,
      ID.unique(),
      entry,
    );
  } catch {
    // activity_logs collection may not exist yet
  }
}

/**
 * After a paper is approved, increment the uploader's `upload_count` and
 * auto-promote based on thresholds.
 */
async function incrementUploadCount(
  db: ReturnType<typeof adminDatabases>,
  uploaderId: string,
) {
  try {
    // Fetch the uploader's profile
    const { documents } = await db.listDocuments(
      DATABASE_ID,
      COLLECTION.users,
      [Query.equal("$id", uploaderId), Query.limit(1)],
    );

    if (documents.length === 0) return;

    const profile = documents[0];
    const currentCount = ((profile.upload_count as number) ?? 0) + 1;
    const update: Record<string, unknown> = { upload_count: currentCount };

    // Auto-promote: assign "contributor" as secondary_role after threshold
    if (
      currentCount >= CONTRIBUTOR_THRESHOLD &&
      !profile.secondary_role
    ) {
      update.secondary_role = "contributor";
    }

    // Auto-promote: set tier to silver once moderator-eligible threshold is reached
    if (
      currentCount >= MODERATOR_ELIGIBLE_THRESHOLD &&
      ((profile.tier as string) ?? "bronze") === "bronze"
    ) {
      update.tier = "silver";
    }

    await db.updateDocument(DATABASE_ID, COLLECTION.users, uploaderId, update);
  } catch {
    // user profile may not exist – ignore
  }
}

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
        // Fetch paper to get the uploader
        const paper = await db.getDocument(DATABASE_ID, COLLECTION.papers, id);

        await db.updateDocument(DATABASE_ID, COLLECTION.papers, id, {
          approved: true,
        });

        // Increment the uploader's upload_count and auto-promote
        const uploaderId = paper.uploaded_by as string | undefined;
        if (uploaderId) {
          await incrementUploadCount(db, uploaderId);
        }

        // Log the approval
        await logActivity(db, {
          action: "approve",
          target_user_id: uploaderId ?? null,
          target_paper_id: id,
          admin_id: user.id,
          admin_email: user.email,
          details: `Approved paper "${paper.title ?? id}"`,
        });

        return NextResponse.json({ success: true });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }
    case "delete": {
      try {
        // Fetch paper title for the log before deleting
        let paperTitle = id;
        try {
          const paper = await db.getDocument(DATABASE_ID, COLLECTION.papers, id);
          paperTitle = (paper.title as string) ?? id;
        } catch {
          // paper may already be gone
        }

        await db.deleteDocument(DATABASE_ID, COLLECTION.papers, id);

        // Log the rejection
        await logActivity(db, {
          action: "reject",
          target_user_id: null,
          target_paper_id: id,
          admin_id: user.id,
          admin_email: user.email,
          details: `Rejected paper "${paperTitle}"`,
        });

        return NextResponse.json({ success: true });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }
    case "soft-delete": {
      // Soft-delete: set approved=false so the paper disappears from browse
      // but is preserved in the database for audit purposes.
      try {
        let paperTitle = id;
        try {
          const paper = await db.getDocument(DATABASE_ID, COLLECTION.papers, id);
          paperTitle = (paper.title as string) ?? id;
        } catch {
          // continue
        }

        await db.updateDocument(DATABASE_ID, COLLECTION.papers, id, {
          approved: false,
        });

        await logActivity(db, {
          action: "reject",
          target_user_id: null,
          target_paper_id: id,
          admin_id: user.id,
          admin_email: user.email,
          details: `Soft-deleted (hidden from browse) paper "${paperTitle}"`,
        });

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
