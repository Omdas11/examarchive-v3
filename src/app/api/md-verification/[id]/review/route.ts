import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth-cf";
import { getD1 } from "@/lib/d1";
import {
  MD_ITEM_COLUMNS,
  addMdHistory,
  canAccessMdVerification,
  canActOnMdItem,
  rowToMdItem,
  type MdVerificationRow,
} from "@/lib/md-verification-access";

export const dynamic = "force-dynamic";

/**
 * POST /api/md-verification/[id]/review
 * Body: { action: "approve" | "needs_fix", note?: string }
 *
 * Approve marks verified_by / verified_at — that md becomes the source
 * of truth for AI Notes. Needs fix sends it back with a note. Only the
 * assigned verifier (or a moderator / founder) may review.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser();
  if (!user || !(await canAccessMdVerification(user))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  let body: { action?: unknown; note?: unknown };
  try {
    body = (await request.json()) as { action?: unknown; note?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (body.action !== "approve" && body.action !== "needs_fix") {
    return NextResponse.json(
      { error: "Invalid action: expected approve or needs_fix" },
      { status: 400 },
    );
  }
  const note =
    typeof body.note === "string" && body.note.trim().length > 0
      ? body.note.trim().slice(0, 500)
      : null;
  if (body.action === "needs_fix" && !note) {
    return NextResponse.json(
      { error: "A note is required when sending an item back for fixes" },
      { status: 400 },
    );
  }

  try {
    const db = await getD1();
    const row = await db
      .prepare(
        `SELECT ${MD_ITEM_COLUMNS.join(", ")} FROM md_verification_items WHERE id = ? LIMIT 1`,
      )
      .bind(id)
      .first<MdVerificationRow>();
    if (!row) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    const item = rowToMdItem(row);
    if (!canActOnMdItem(user, item)) {
      return NextResponse.json(
        { error: "This item is assigned to someone else" },
        { status: 403 },
      );
    }
    const now = Date.now();
    if (body.action === "approve") {
      await db
        .prepare(
          "UPDATE md_verification_items SET status = 'approved', verified_by = ?, verified_at = ?, note = COALESCE(?, note), updated_at = ? WHERE id = ?",
        )
        .bind(user.id, now, note, now, id)
        .run();
    } else {
      await db
        .prepare(
          "UPDATE md_verification_items SET status = 'needs_fix', note = ?, updated_at = ? WHERE id = ?",
        )
        .bind(note, now, id)
        .run();
    }
    await addMdHistory({
      itemId: id,
      actorId: user.id,
      actorLabel: user.name || user.email || user.id,
      action: body.action === "approve" ? "approved" : "needs_fix",
      note,
    });
    return NextResponse.json({
      item: {
        ...item,
        status: body.action === "approve" ? "approved" : "needs_fix",
        verified_by: body.action === "approve" ? user.id : item.verified_by,
        verified_at: body.action === "approve" ? now : item.verified_at,
        note: note ?? item.note,
        updated_at: now,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Could not record the review" },
      { status: 500 },
    );
  }
}
