export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { AppwriteException } from "node-appwrite";
import { getServerUser } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import {
  adminDatabases,
  DATABASE_ID,
  COLLECTION,
  Query,
} from "@/lib/appwrite";
import { isValidUserRole, isValidCustomRole, isValidTier } from "@/lib/roles";
import { logActivity } from "@/lib/activity-log";
import { withElectronBalanceLock } from "@/lib/electron-lock";

/**
 * GET /api/admin/users
 * List all user documents. Admin-only.
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
      COLLECTION.users,
      [Query.orderDesc("$createdAt"), Query.limit(100)],
    );

    return NextResponse.json({ users: documents });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/users
 * Update a user's role, primary_role, secondary_role, tertiary_role, tier,
 * and/or perform manual AI credit top-up/debit.
 * Admin-only. Prevents self-demotion.
 */
export async function PATCH(request: NextRequest) {
  const user = await getServerUser();
  if (!user || !isAdmin(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { userId } = body;
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  if (body.ai_credits !== undefined && body.ai_credits_delta !== undefined) {
    return NextResponse.json(
      { error: "Provide either ai_credits or ai_credits_delta, not both" },
      { status: 400 },
    );
  }

  // Prevent self-demotion: if target is the requester, don't allow role changes
  if (userId === user.id) {
    const newRole = body.role as string | undefined;
    const newPrimaryRole = body.primary_role as string | undefined;
    if (
      (newRole && newRole !== user.role) ||
      (newPrimaryRole && newPrimaryRole !== user.role)
    ) {
      return NextResponse.json(
        { error: "You cannot change your own role." },
        { status: 400 },
      );
    }
  }

  // Build the update payload — only include valid fields
  const update: Record<string, unknown> = {};
  const details: string[] = [];
  let requestedCreditsDelta: number | null = null;

  if (body.role !== undefined) {
    if (!isValidUserRole(body.role)) {
      return NextResponse.json({ error: "Invalid role value" }, { status: 400 });
    }
    update.role = body.role;
    details.push(`role → ${body.role}`);
  }

  if (body.primary_role !== undefined) {
    if (!isValidUserRole(body.primary_role)) {
      return NextResponse.json({ error: "Invalid primary_role value" }, { status: 400 });
    }
    update.primary_role = body.primary_role;
    details.push(`primary_role → ${body.primary_role}`);
  }

  if (body.secondary_role !== undefined) {
    if (!isValidCustomRole(body.secondary_role)) {
      return NextResponse.json({ error: "Invalid secondary_role value" }, { status: 400 });
    }
    update.secondary_role = body.secondary_role;
    details.push(`secondary_role → ${body.secondary_role ?? "none"}`);
  }

  if (body.tertiary_role !== undefined) {
    if (!isValidCustomRole(body.tertiary_role)) {
      return NextResponse.json({ error: "Invalid tertiary_role value" }, { status: 400 });
    }
    update.tertiary_role = body.tertiary_role;
    details.push(`tertiary_role → ${body.tertiary_role ?? "none"}`);
  }

  if (body.tier !== undefined) {
    if (!isValidTier(body.tier)) {
      return NextResponse.json({ error: "Invalid tier value" }, { status: 400 });
    }
    update.tier = body.tier;
    details.push(`tier → ${body.tier}`);
  }

  if (body.specialist_subject !== undefined) {
    if (body.specialist_subject !== null && typeof body.specialist_subject !== "string") {
      return NextResponse.json({ error: "Invalid specialist_subject value" }, { status: 400 });
    }
    update.specialist_subject = body.specialist_subject ? String(body.specialist_subject).trim() : null;
    details.push(`specialist_subject → ${update.specialist_subject ?? "none"}`);
  }

  if (body.subject_admin_subject !== undefined) {
    if (body.subject_admin_subject !== null && typeof body.subject_admin_subject !== "string") {
      return NextResponse.json({ error: "Invalid subject_admin_subject value" }, { status: 400 });
    }
    update.subject_admin_subject = body.subject_admin_subject ? String(body.subject_admin_subject).trim() : null;
    details.push(`subject_admin_subject → ${update.subject_admin_subject ?? "none"}`);
  }

  if (body.ai_credits !== undefined) {
    const credits = Number(body.ai_credits);
    if (!Number.isFinite(credits) || credits < 0 || !Number.isInteger(credits)) {
      return NextResponse.json(
        { error: "Invalid ai_credits value (must be a non-negative integer)" },
        { status: 400 },
      );
    }
    update.ai_credits = credits;
    details.push(`ai_credits set → ${credits}`);
  }

  if (body.ai_credits_delta !== undefined) {
    const delta = Number(body.ai_credits_delta);
    if (!Number.isFinite(delta) || !Number.isInteger(delta) || delta === 0) {
      return NextResponse.json(
        { error: "Invalid ai_credits_delta value (must be a non-zero integer)" },
        { status: 400 },
      );
    }
    requestedCreditsDelta = delta;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    const db = adminDatabases();
    if (requestedCreditsDelta !== null || update.ai_credits !== undefined) {
      const applyDetails = await withElectronBalanceLock(userId, async () => {
        const lockedUpdate = { ...update };
        if (requestedCreditsDelta !== null) {
          const existing = await db.getDocument(DATABASE_ID, COLLECTION.users, userId);
          const current = Number((existing.ai_credits as number | undefined) ?? 0);
          if (!Number.isFinite(current)) {
            throw new Error("INVALID_USER_CREDITS_BALANCE");
          }
          const rawNext = current + requestedCreditsDelta;
          if (!Number.isFinite(rawNext)) {
            throw new Error("INVALID_CREDITS_COMPUTATION");
          }
          const next = Math.max(0, rawNext);
          lockedUpdate.ai_credits = next;
          await db.updateDocument(DATABASE_ID, COLLECTION.users, userId, lockedUpdate);
          return `ai_credits ${requestedCreditsDelta > 0 ? "top-up" : "debit"} ${requestedCreditsDelta > 0 ? "+" : ""}${requestedCreditsDelta} (final ${next})`;
        }

        await db.updateDocument(DATABASE_ID, COLLECTION.users, userId, lockedUpdate);
        return null;
      });
      if (applyDetails) details.push(applyDetails);
    } else {
      await db.updateDocument(DATABASE_ID, COLLECTION.users, userId, update);
    }

    // Log the action
    const actionType = update.tier && !update.role ? "tier_change" : "role_change";
    void logActivity({
      action: actionType,
      target_user_id: userId,
      target_paper_id: null,
      admin_id: user.id,
      admin_email: user.email,
      details: `Updated user ${userId}: ${details.join(", ")}`,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof AppwriteException && err.code === 404) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (err instanceof AppwriteException && err.code === 400) {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
