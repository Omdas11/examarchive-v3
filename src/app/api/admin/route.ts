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

/** XP awarded when a paper is approved. */
const XP_PER_APPROVED_UPLOAD = 50;
/** Bonus XP for the very first approved upload. */
const XP_FIRST_UPLOAD_BONUS = 20;
/** Bonus XP at 7-day streak. */
const XP_STREAK_7_DAY_BONUS = 100;
/** Bonus XP at 30-day streak. */
const XP_STREAK_30_DAY_BONUS = 500;

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
 * After a paper is approved, increment the uploader's `upload_count`,
 * grant XP (+50 per upload, +20 first-upload bonus), update streak,
 * and auto-promote based on thresholds.
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

    // ── XP grant ──────────────────────────────────────────────────────────
    let xpGain = XP_PER_APPROVED_UPLOAD;
    if (currentCount === 1) xpGain += XP_FIRST_UPLOAD_BONUS; // first upload bonus
    update.xp = ((profile.xp as number) ?? 0) + xpGain;

    // ── Streak update ─────────────────────────────────────────────────────
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const lastActivity = (profile.last_activity as string) ?? "";
    const lastDate = lastActivity ? lastActivity.slice(0, 10) : "";

    const prevStreak = (profile.streak as number) ?? 0;
    let streak = prevStreak;
    if (lastDate === todayStr) {
      // already active today — no streak change
    } else if (lastDate) {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      streak = lastDate === yesterdayStr ? prevStreak + 1 : 1;
    } else {
      streak = 1;
    }

    // Streak milestone XP bonuses — award when crossing the threshold
    if (prevStreak < 7 && streak >= 7) {
      update.xp = (update.xp as number) + XP_STREAK_7_DAY_BONUS;
    } else if (prevStreak < 30 && streak >= 30) {
      update.xp = (update.xp as number) + XP_STREAK_30_DAY_BONUS;
    }

    update.streak = streak;
    update.last_activity = now.toISOString();

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
    case "hide-syllabus": {
      // Soft-hide: set is_hidden=true so the syllabus disappears from public pages
      // but is preserved in the database for audit purposes.
      try {
        await db.updateDocument(DATABASE_ID, COLLECTION.syllabus, id, {
          is_hidden: true,
        });
        await logActivity(db, {
          action: "reject",
          target_user_id: null,
          target_paper_id: id,
          admin_id: user.id,
          admin_email: user.email,
          details: `Soft-hidden syllabus ${id}`,
        });
        return NextResponse.json({ success: true });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }
    case "delete-syllabus": {
      try {
        await db.deleteDocument(DATABASE_ID, COLLECTION.syllabus, id);
        await logActivity(db, {
          action: "reject",
          target_user_id: null,
          target_paper_id: id,
          admin_id: user.id,
          admin_email: user.email,
          details: `Deleted syllabus ${id}`,
        });
        return NextResponse.json({ success: true });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }
    case "approve-syllabus": {
      try {
        await db.updateDocument(DATABASE_ID, COLLECTION.syllabus, id, {
          approval_status: "approved",
        });
        await logActivity(db, {
          action: "approve",
          target_user_id: null,
          target_paper_id: id,
          admin_id: user.id,
          admin_email: user.email,
          details: `Approved syllabus ${id}`,
        });
        return NextResponse.json({ success: true });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }
    case "reject-syllabus": {
      try {
        await db.updateDocument(DATABASE_ID, COLLECTION.syllabus, id, {
          approval_status: "rejected",
        });
        await logActivity(db, {
          action: "reject",
          target_user_id: null,
          target_paper_id: id,
          admin_id: user.id,
          admin_email: user.email,
          details: `Rejected syllabus ${id}`,
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
