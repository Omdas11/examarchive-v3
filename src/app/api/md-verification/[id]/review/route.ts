import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth-cf";
import { getD1 } from "@/lib/d1";
import { parseQuestions } from "@/lib/md-question-index";
import {
  MD_COMPLETION_CREDITS,
  MD_COMPLETION_XP,
  resolveMdCompleter,
  shouldAwardMdXp,
} from "@/lib/md-verification";
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
 * assigned verifier may review. An already-approved item gets 409
 * instead of re-running the approve (the XP award stays guarded too).
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
        {
          error:
            "Only the assigned verifier can review this item. You can suggest an edit instead.",
        },
        { status: 403 },
      );
    }
    if (item.status === "approved") {
      return NextResponse.json(
        { error: "This item is already approved.", item },
        { status: 409 },
      );
    }
    const now = Date.now();
    if (body.action === "approve") {
      // Completion XP: +25 XP and +5 AI credits, once per item, to the
      // person who finished the md (edited_by, else submitted_by, else
      // assigned_to, else the approver). Only on the transition into
      // approved and only if not already awarded. No XP for needs_fix.
      // If the completer has no users row, skip the award but approve.
      let awardTo: string | null = null;
      if (shouldAwardMdXp(item)) {
        const completer = resolveMdCompleter(item, user.id);
        if (completer) {
          const userRow = await db
            .prepare("SELECT id FROM users WHERE id = ? LIMIT 1")
            .bind(completer)
            .first<{ id: string }>();
          if (userRow) awardTo = completer;
        }
      }
      const awardedXp = awardTo ? MD_COMPLETION_XP : item.xp_awarded;
      const updateItem = db
        .prepare(
          "UPDATE md_verification_items SET status = 'approved', verified_by = ?, verified_at = ?, note = COALESCE(?, note), xp_awarded = ?, xp_awarded_to = ?, updated_at = ? WHERE id = ?",
        )
        .bind(
          user.id,
          now,
          note,
          awardedXp,
          awardTo ?? item.xp_awarded_to,
          now,
          id,
        );
      const statements = [updateItem];
      if (awardTo) {
        statements.push(
          db
            .prepare(
              "UPDATE users SET xp = xp + ?, ai_credits = ai_credits + ? WHERE id = ?",
            )
            .bind(MD_COMPLETION_XP, MD_COMPLETION_CREDITS, awardTo),
        );
      }
      // Question index: on Approve only, the approved md's questions
      // land in paper_questions (one row per sub-question, keywords
      // merged in from the index table). Approving an md with no
      // questions writes no rows. The old rows for this item are
      // replaced, so re-approving after an edit never duplicates.
      const questionRows = parseQuestions(item.md_text ?? "", item.paper_code);
      statements.push(
        db
          .prepare("DELETE FROM paper_questions WHERE item_id = ?")
          .bind(id),
      );
      const createdAt = new Date(now).toISOString();
      for (const qRow of questionRows) {
        statements.push(
          db
            .prepare(
              "INSERT INTO paper_questions (question_id, item_id, paper_code, label, question_text, marks, unit, group_rule, keywords, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(
              qRow.id,
              id,
              item.paper_code,
              qRow.label,
              qRow.question,
              qRow.marks,
              qRow.unit,
              qRow.group,
              qRow.keywords,
              createdAt,
            ),
        );
      }
      // One D1 batch: item status + XP update + question rows land together.
      await db.batch(statements);
      await addMdHistory({
        itemId: id,
        actorId: user.id,
        actorLabel: user.name || user.email || user.id,
        action: "approved",
        note,
      });
      return NextResponse.json({
        item: {
          ...item,
          status: "approved" as const,
          verified_by: user.id,
          verified_at: now,
          note: note ?? item.note,
          xp_awarded: awardedXp,
          xp_awarded_to: awardTo ?? item.xp_awarded_to,
          updated_at: now,
        },
        xp_awarded: awardedXp,
        xp_awarded_to: awardTo ?? item.xp_awarded_to,
        credits_awarded: awardTo ? MD_COMPLETION_CREDITS : 0,
      });
    } else {
      await db
        .prepare(
          "UPDATE md_verification_items SET status = 'needs_fix', note = ?, updated_at = ? WHERE id = ?",
        )
        .bind(note, now, id)
        .run();
    }
    // Approve returns early above, so this path is needs_fix only.
    await addMdHistory({
      itemId: id,
      actorId: user.id,
      actorLabel: user.name || user.email || user.id,
      action: "needs_fix",
      note,
    });
    return NextResponse.json({
      item: {
        ...item,
        status: "needs_fix" as const,
        verified_by: item.verified_by,
        verified_at: item.verified_at,
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
