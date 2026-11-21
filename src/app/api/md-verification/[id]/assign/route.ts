import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth-cf";
import { getD1 } from "@/lib/d1";
import { isFounder } from "@/lib/roles";
import {
  MD_ITEM_COLUMNS,
  addMdHistory,
  canAccessMdVerification,
  rowToMdItem,
  type MdVerificationRow,
} from "@/lib/md-verification-access";

export const dynamic = "force-dynamic";

/**
 * POST /api/md-verification/[id]/assign — founder only.
 * Body: { user_id: string | null }. Sets (or clears) the item's
 * assigned verifier. Only the assignee may use the four actions, so
 * this is how an unassigned item becomes actionable. A moderator is
 * not enough here — assigning is a founder job.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser();
  if (!user || !(await canAccessMdVerification(user)) || !isFounder(user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  let body: { user_id?: unknown };
  try {
    body = (await request.json()) as { user_id?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const targetId =
    typeof body.user_id === "string" && body.user_id.trim().length > 0
      ? body.user_id.trim()
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
    let targetLabel: string | null = null;
    if (targetId) {
      const target = await db
        .prepare("SELECT id, name, email FROM users WHERE id = ? LIMIT 1")
        .bind(targetId)
        .first<{ id: string; name: string | null; email: string | null }>();
      if (!target) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 400 },
        );
      }
      targetLabel = target.name || target.email || target.id;
    }
    const now = Date.now();
    await db
      .prepare(
        "UPDATE md_verification_items SET assigned_to = ?, updated_at = ? WHERE id = ?",
      )
      .bind(targetId, now, id)
      .run();
    await addMdHistory({
      itemId: id,
      actorId: user.id,
      actorLabel: user.name || user.email || user.id,
      action: "assigned",
      note: targetId
        ? `Assigned to ${targetLabel ?? targetId}`
        : "Unassigned",
    });
    return NextResponse.json({
      item: { ...rowToMdItem(row), assigned_to: targetId, updated_at: now },
      assigned_to_label: targetLabel,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not assign the item" },
      { status: 500 },
    );
  }
}
