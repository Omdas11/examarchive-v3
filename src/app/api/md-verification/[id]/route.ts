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
import { MD_MAX_BYTES } from "@/lib/md-verification";

export const dynamic = "force-dynamic";

/**
 * GET /api/md-verification/[id] — one item with its full md text.
 * PUT /api/md-verification/[id] — save an edited md draft.
 *
 * Save rules: the edited md is stored in D1 with edited_by / edited_at;
 * the previous md text goes to md_verification_history, so the original
 * is never lost. The PDF is never touched here. A pending item moves to
 * in_review on first save; any other status is kept. Only the assigned
 * verifier (or a moderator / founder) may save.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser();
  if (!user || !(await canAccessMdVerification(user))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
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
    return NextResponse.json({ item: rowToMdItem(row) });
  } catch {
    return NextResponse.json(
      { error: "Could not load the item" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser();
  if (!user || !(await canAccessMdVerification(user))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  let body: { md_text?: unknown; note?: unknown };
  try {
    body = (await request.json()) as { md_text?: unknown; note?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body.md_text !== "string" || body.md_text.length === 0) {
    return NextResponse.json(
      { error: "md_text is required" },
      { status: 400 },
    );
  }
  if (body.md_text.length > MD_MAX_BYTES) {
    return NextResponse.json(
      { error: "md text exceeds the 2 MB limit" },
      { status: 400 },
    );
  }
  const note =
    typeof body.note === "string" && body.note.trim().length > 0
      ? body.note.trim().slice(0, 500)
      : null;

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
    const nextStatus = item.status === "pending" ? "in_review" : item.status;
    await db
      .prepare(
        "UPDATE md_verification_items SET md_text = ?, status = ?, note = COALESCE(?, note), edited_by = ?, edited_at = ?, updated_at = ? WHERE id = ?",
      )
      .bind(body.md_text, nextStatus, note, user.id, now, now, id)
      .run();
    await addMdHistory({
      itemId: id,
      actorId: user.id,
      actorLabel: user.name || user.email || user.id,
      action: "edited",
      note,
      previousMdText: item.md_text,
    });
    return NextResponse.json({ item: { ...item, md_text: body.md_text, status: nextStatus, note: note ?? item.note, edited_by: user.id, edited_at: now, updated_at: now } });
  } catch {
    return NextResponse.json(
      { error: "Could not save the item" },
      { status: 500 },
    );
  }
}
