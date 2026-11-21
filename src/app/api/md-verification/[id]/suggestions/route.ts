import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth-cf";
import { getD1 } from "@/lib/d1";
import {
  canAccessMdVerification,
  getItemSuggestions,
  rowToSuggestion,
  type MdSuggestionRow,
} from "@/lib/md-verification-access";

export const dynamic = "force-dynamic";

/**
 * GET /api/md-verification/[id]/suggestions — list suggestions.
 * POST — create one. Anyone with page access may suggest; only the
 * assignee applies or dismisses (see [suggestionId]/route.ts).
 * Body: { question_ref, proposed_text, note? }
 * question_ref is a question key ("q3") or "" for the whole paper.
 * A missing suggestions table (migration 0013 not applied) returns
 * 503 with a plain message instead of a crash.
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
  return NextResponse.json({ suggestions: await getItemSuggestions(id) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getServerUser();
  if (!user || !(await canAccessMdVerification(user))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  let body: { question_ref?: unknown; proposed_text?: unknown; note?: unknown };
  try {
    body = (await request.json()) as {
      question_ref?: unknown;
      proposed_text?: unknown;
      note?: unknown;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const questionRef =
    typeof body.question_ref === "string" ? body.question_ref.trim() : "";
  if (questionRef.length > 40) {
    return NextResponse.json(
      { error: "question_ref is too long" },
      { status: 400 },
    );
  }
  if (
    typeof body.proposed_text !== "string" ||
    body.proposed_text.trim().length === 0 ||
    body.proposed_text.length > 4000
  ) {
    return NextResponse.json(
      { error: "proposed_text is required (max 4000 characters)" },
      { status: 400 },
    );
  }
  const note =
    typeof body.note === "string" && body.note.trim().length > 0
      ? body.note.trim().slice(0, 500)
      : null;
  try {
    const db = await getD1();
    const item = await db
      .prepare("SELECT id FROM md_verification_items WHERE id = ? LIMIT 1")
      .bind(id)
      .first<{ id: string }>();
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    const now = Date.now();
    const suggestionId = crypto.randomUUID();
    await db
      .prepare(
        "INSERT INTO md_verification_suggestions (id, item_id, author_id, author_label, question_ref, proposed_text, note, status, created_at, updated_at) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)",
      )
      .bind(
        suggestionId,
        id,
        user.id,
        user.name || user.email || user.id,
        questionRef,
        body.proposed_text.trim(),
        note,
        now,
        now,
      )
      .run();
    const row = await db
      .prepare(
        "SELECT id, item_id, author_id, author_label, question_ref, proposed_text, note, status, created_at, updated_at FROM md_verification_suggestions WHERE id = ? LIMIT 1",
      )
      .bind(suggestionId)
      .first<MdSuggestionRow>();
    return NextResponse.json(
      { suggestion: row ? rowToSuggestion(row) : null },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Suggestions are not ready yet — the database upgrade is still pending. Tell the founder.",
      },
      { status: 503 },
    );
  }
}
