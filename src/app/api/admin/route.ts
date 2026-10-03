import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import { isModerator, normalizeRole } from "@/lib/roles";
import {
  adminDatabases,
  adminStorage,
  DATABASE_ID,
  COLLECTION,
  BUCKET_ID,
  ID,
  getAppwriteFileUrl,
} from "@/lib/appwrite";
import { logActivity } from "@/lib/activity-log";

/** XO awarded when a paper is approved. */
const XP_PER_APPROVED_UPLOAD = 50;
/** Bonus XO for the very first approved upload. */
const XP_FIRST_UPLOAD_BONUS = 20;
/** Bonus XO at 7-day streak. */
const XP_STREAK_7_DAY_BONUS = 100;
/** Bonus XO at 30-day streak. */
const XP_STREAK_30_DAY_BONUS = 500;

/** Role/XO thresholds (docs/ROLE_XO_RULEBOOK.md). */
const VIEWER_TO_CONTRIBUTOR_UPLOAD_THRESHOLD = 2;
const VIEWER_TO_CONTRIBUTOR_XO_THRESHOLD = 30;
const VIEWER_TO_CONTRIBUTOR_ACCOUNT_AGE_DAYS = 3;
const CONTRIBUTOR_TO_CURATOR_UPLOAD_THRESHOLD = 10;
const CONTRIBUTOR_TO_CURATOR_XO_THRESHOLD = 150;
const TIER_SILVER_UPLOAD_THRESHOLD = 20;

/**
 * After a paper is approved, increment the uploader's `upload_count`,
  * grant XO (+50 per upload, +20 first-upload bonus), update streak,
 * and auto-promote based on thresholds.
 */
async function incrementUploadCount(
  db: ReturnType<typeof adminDatabases>,
  uploaderId: string,
) {
  try {
    // Fetch the uploader's profile directly by document ID (more efficient than querying)
    let profile: Record<string, unknown>;
    try {
      profile = await db.getDocument(DATABASE_ID, COLLECTION.users, uploaderId) as Record<string, unknown>;
    } catch {
      return; // user profile may not exist
    }

    const currentCount = ((profile.upload_count as number) ?? 0) + 1;
    const update: Record<string, unknown> = { upload_count: currentCount };

    // ── XP grant ──────────────────────────────────────────────────────────
    let xpGain = XP_PER_APPROVED_UPLOAD;
    if (currentCount === 1) xpGain += XP_FIRST_UPLOAD_BONUS; // first upload bonus
    const nextXp = ((profile.xp as number) ?? 0) + xpGain;
    update.xp = nextXp;

    // ── Streak update ─────────────────────────────────────────────────────
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const lastActivity = (profile.last_activity as string) ?? "";
    const lastDate = lastActivity ? lastActivity.slice(0, 10) : "";

    const prevStreak = (profile.streak_days as number) ?? 0;
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

    update.streak_days = streak;
    update.last_activity = now.toISOString();

    const currentRole = normalizeRole((profile.role as string) ?? "viewer");
    const createdAt = typeof profile.$createdAt === "string" ? profile.$createdAt : "";
    const accountAgeDays = createdAt
      ? Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
      : 0;
    if (
      currentRole === "viewer" &&
      currentCount >= VIEWER_TO_CONTRIBUTOR_UPLOAD_THRESHOLD &&
      nextXp >= VIEWER_TO_CONTRIBUTOR_XO_THRESHOLD &&
      accountAgeDays >= VIEWER_TO_CONTRIBUTOR_ACCOUNT_AGE_DAYS
    ) {
      update.role = "contributor";
    }
    if (
      currentRole === "contributor" &&
      currentCount >= CONTRIBUTOR_TO_CURATOR_UPLOAD_THRESHOLD &&
      nextXp >= CONTRIBUTOR_TO_CURATOR_XO_THRESHOLD &&
      !Boolean(profile.abuse_flag)
    ) {
      update.role = "curator";
    }

    // Auto-promote: set tier to silver once moderator-eligible threshold is reached
    if (
      currentCount >= TIER_SILVER_UPLOAD_THRESHOLD &&
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
  // Stash a parsed multipart body so the replace_file branch can reuse it
  // (a request body can only be read once).
  let multipart: FormData | null = null;
  // Stash a parsed JSON body so later cases (e.g. update-paper) can reuse it.
  let parsedJson: Record<string, unknown> | null = null;

  // Support JSON body (used by the client-side AdminActions component)
  if (!action || !id) {
    try {
      const contentType = request.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const json = await request.json();
        parsedJson = json as Record<string, unknown>;
        action = action ?? json.action;
        id = id ?? json.id;
      } else if (contentType.includes("multipart/form-data")) {
        multipart = await request.formData();
        action = action ?? (multipart.get("action") as string | null);
        id = id ?? (multipart.get("id") as string | null);
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

  // ── replace_file: swap a paper's PDF (e.g. watermark-cleaned version) ──
  // Moderator-only. Accepts multipart form: id (paper doc ID) + file (PDF).
  // Uploads the new file via the admin key, points the paper doc at it,
  // then deletes the old storage file. Returns { success, fileId }.
  if (action === "replace_file") {
    try {
      let upload: File | null = null;
      // Reuse the already-parsed multipart body when available.
      const fd = multipart ?? (await request.formData().catch(() => null));
      if (fd) {
        const f = fd.get("file");
        if (f instanceof File) upload = f;
        if (!id) {
          const fid = fd.get("id");
          if (typeof fid === "string") id = fid;
        }
      }
      if (!id) {
        return NextResponse.json({ error: "Missing paper id." }, { status: 400 });
      }
      if (!upload || upload.size === 0) {
        return NextResponse.json({ error: "Missing PDF file." }, { status: 400 });
      }
      if (upload.type !== "application/pdf" && !upload.name.toLowerCase().endsWith(".pdf")) {
        return NextResponse.json({ error: "File must be a PDF." }, { status: 400 });
      }
      const storage = adminStorage();
      const created = await storage.createFile(BUCKET_ID, ID.unique(), upload);
      const newFileId = created.$id;
      let oldFileId: string | null = null;
      let paperTitle = id;
      try {
        const paper = await db.getDocument(DATABASE_ID, COLLECTION.papers, id);
        oldFileId = (paper.file_id as string) ?? null;
        paperTitle = ((paper.paper_name as string) ?? (paper.course_code as string) ?? id);
      } catch {
        // paper lookup failed — remove the just-uploaded file to avoid orphans
        try { await storage.deleteFile(BUCKET_ID, newFileId); } catch { /* ignore */ }
        return NextResponse.json({ error: "Paper not found." }, { status: 404 });
      }
      await db.updateDocument(DATABASE_ID, COLLECTION.papers, id, {
        file_id: newFileId,
        file_url: getAppwriteFileUrl(newFileId),
      });
      if (oldFileId && oldFileId !== newFileId) {
        try {
          await storage.deleteFile(BUCKET_ID, oldFileId);
        } catch {
          // old file deletion is best-effort; doc already points at the new file
        }
      }
      void logActivity({
        action: "replace_file",
        target_user_id: null,
        target_paper_id: id,
        admin_id: user.id,
        admin_email: user.email,
        details: `Replaced file for paper "${paperTitle}" (${oldFileId} → ${newFileId})`,
      });
      return NextResponse.json({ success: true, fileId: newFileId, oldFileId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  switch (action) {
    case "update-paper": {
      // Moderator-only metadata correction (e.g. fix a wrong department on an
      // already-imported record without deleting/re-uploading). Allowlisted
      // fields only; id is the paper document ID.
      try {
        const fields: Record<string, unknown> = parsedJson ?? {};
        const allowed = ["department", "paper_name", "semester", "programme"] as const;
        const update: Record<string, string> = {};
        for (const key of allowed) {
          const v = fields[key];
          if (typeof v === "string" && v.trim()) update[key] = v.trim().slice(0, 200);
        }
        if (Object.keys(update).length === 0) {
          return NextResponse.json(
            { error: "Nothing to update: provide department, paper_name, semester or programme." },
            { status: 400 }
          );
        }
        const doc = await db.updateDocument(DATABASE_ID, COLLECTION.papers, id, update);
        void logActivity({
          action: "update-paper",
          target_user_id: null,
          target_paper_id: id,
          admin_id: user.id,
          admin_email: user.email,
          details: `Updated ${Object.keys(update).join(", ")} on paper "${doc.paper_name ?? id}"`,
        });
        return NextResponse.json({ success: true, id: doc.$id, update });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }
    case "approve": {
      try {
        // Fetch paper to get the uploader
        const paper = await db.getDocument(DATABASE_ID, COLLECTION.papers, id);

        // Approve the paper — mark as approved and update status.
        // Storage permissions remain read("users") so files stay restricted
        // to authenticated users and are served through the /api/files/papers proxy.
        await db.updateDocument(DATABASE_ID, COLLECTION.papers, id, {
          approved: true,
          status: "approved",
        });

        // Increment the uploader's upload_count and auto-promote
        const uploaderId = paper.uploaded_by as string | undefined;
        if (uploaderId) {
          await incrementUploadCount(db, uploaderId);
        }

        // Log the approval
        void logActivity({
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
        // Fetch paper title and file_id before deleting the DB record
        let paperTitle = id;
        let storedFileId: string | undefined;
        try {
          const paper = await db.getDocument(DATABASE_ID, COLLECTION.papers, id);
          paperTitle = (paper.title as string) ?? id;
          const fileUrlParts = (paper.file_url as string | undefined)?.split("/api/files/papers/");
          storedFileId = (paper.file_id as string | undefined) ??
            (fileUrlParts && fileUrlParts.length === 2 ? fileUrlParts[1] : undefined);
        } catch {
          // paper may already be gone
        }

        await db.deleteDocument(DATABASE_ID, COLLECTION.papers, id);

        // Also delete the storage file to prevent orphaned files in the papers bucket.
        if (storedFileId) {
          try {
            await adminStorage().deleteFile(BUCKET_ID, storedFileId);
          } catch (storageErr) {
            console.warn(
              "[api/admin] Could not delete storage file %s:",
              storedFileId,
              storageErr,
            );
          }
        }

        // Log the rejection
        void logActivity({
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

        void logActivity({
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
        void logActivity({
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
        void logActivity({
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
        const syllabus = await db.getDocument(DATABASE_ID, COLLECTION.syllabus, id);
        const uploaderId = syllabus.uploader_id as string | undefined;
        const wasApproved = syllabus.approval_status === "approved";

        if (!wasApproved) {
          // Approve the syllabus — no storage permission change needed because syllabus
          // files remain restricted to authenticated users (read("users") permission)
          // and are served via the /api/files/syllabus proxy route.
          await db.updateDocument(DATABASE_ID, COLLECTION.syllabus, id, {
            approval_status: "approved",
          });

          // Grant XP and auto-promote the uploader, same as paper approvals
          if (uploaderId) {
            await incrementUploadCount(db, uploaderId);
          }
        }

        void logActivity({
          action: "approve",
          target_user_id: uploaderId ?? null,
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
        const syllabus = await db.getDocument(DATABASE_ID, COLLECTION.syllabus, id);
        const uploaderId = syllabus.uploader_id as string | undefined;

        await db.updateDocument(DATABASE_ID, COLLECTION.syllabus, id, {
          approval_status: "rejected",
        });
        void logActivity({
          action: "reject",
          target_user_id: uploaderId ?? null,
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
