import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth-cf";
import { getD1 } from "@/lib/d1";
import {
  MD_ITEM_COLUMNS,
  addMdHistory,
  canAccessMdVerification,
  canActOnMdItem,
  rowToMdItem,
  rowToSuggestion,
  type MdSuggestionRow,
  type MdVerificationRow,
} from "@/lib/md-verification-access";
import {
  applyQuestionText,
  parseMd,
  reassembleMd,
} from "@/lib/md-verification-parse";

export const dynamic = "force-dynamic";

/**
 * POST /api/md-verification/[id]/suggestions/[suggestionId]
 * Body: { action: "apply" | "dismiss" }. Assignee only.
 *
 * Apply replaces that question's text in the md (server-side, using
 * the same parser the page uses) and marks the suggestion applied. If
 * the parser cannot locate the question, it returns 400 and the
 * suggestion stays pending. Dismiss only flips the status. A whole-
 * paper suggestion (question_ref "") cannot be applied automatically
 * — it needs a human edit, so apply returns 400 telling the assignee
 * to edit the text by hand.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; suggestionId: string }> },
) {
  const user = await getServerUser();
  if (!user || !(await canAccessMdVerification(user))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, suggestionId } = await params;
  let body: { action?: unknown };
  try {
    body = (await request.json()) as { action?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (body.action !== "apply" && body.action !== "dismiss") {
    return NextResponse.json(
      { error: "Invalid action: expected apply or dismiss" },
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
        { error: "Only the assigned verifier can do that." },
        { status: 403 },
      );
    }
    const suggestionRow = await db
      .prepare(
        "SELECT id, item_id, author_id, author_label, question_ref, proposed_text, note, status, created_at, updated_at FROM md_verification_suggestions WHERE id = ? LIMIT 1",
      )
      .bind(suggestionId)
      .first<MdSuggestionRow>();
    if (!suggestionRow || String(suggestionRow.item_id) !== id) {
      return NextResponse.json(
        { error: "Suggestion not found" },
        { status: 404 },
      );
    }
    const suggestion = rowToSuggestion(suggestionRow);
    if (suggestion.status !== "pending") {
      return NextResponse.json(
        { error: `This suggestion is already ${suggestion.status}.` },
        { status: 409 },
      );
    }
    const now = Date.now();
    if (body.action === "dismiss") {
      await db
        .prepare(
          "UPDATE md_verification_suggestions SET status = 'dismissed', updated_at = ? WHERE id = ?",
        )
        .bind(now, suggestionId)
        .run();
      return NextResponse.json({
        suggestion: { ...suggestion, status: "dismissed" as const, updated_at: now },
      });
    }
    // Apply.
    if (!suggestion.question_ref) {
      return NextResponse.json(
        {
          error:
            "This suggestion is about the whole paper, so it cannot be applied automatically. Edit the text by hand, then dismiss it.",
        },
        { status: 400 },
      );
    }
    const parsed = parseMd(item.md_text);
    const ok = applyQuestionText(
      parsed,
      suggestion.question_ref,
      suggestion.proposed_text,
    );
    if (!ok) {
      return NextResponse.json(
        {
          error:
            "Could not find that question in the md — the text may have changed. The suggestion stays pending.",
        },
        { status: 400 },
      );
    }
    const nextMd = reassembleMd(parsed);
    await db
      .prepare(
        "UPDATE md_verification_items SET md_text = ?, edited_by = ?, edited_at = ?, updated_at = ? WHERE id = ?",
      )
      .bind(nextMd, user.id, now, now, id)
      .run();
    await db
      .prepare(
        "UPDATE md_verification_suggestions SET status = 'applied', updated_at = ? WHERE id = ?",
      )
      .bind(now, suggestionId)
      .run();
    await addMdHistory({
      itemId: id,
      actorId: user.id,
      actorLabel: user.name || user.email || user.id,
      action: "edited",
      note: `Suggestion applied (${suggestion.question_ref})`,
      previousMdText: item.md_text,
    });
    return NextResponse.json({
      suggestion: { ...suggestion, status: "applied" as const, updated_at: now },
      item: { ...item, md_text: nextMd, edited_by: user.id, edited_at: now, updated_at: now },
    });
  } catch {
    return NextResponse.json(
      { error: "Could not update the suggestion" },
      { status: 500 },
    );
  }
}
