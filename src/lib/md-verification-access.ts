/**
 * MD verification — D1 access helpers.
 *
 * Gate rule (decided by the user): the page and the APIs are open to
 * moderators, the founder, and users listed in `md_verifiers`. The
 * friend is an assigned verifier, NOT a moderator — no role change.
 */
import { getD1 } from "./d1";
import { isFounder, isModerator } from "./roles";
import type { UserProfile } from "@/types";
import type {
  MdVerificationItem,
  MdVerificationStatus,
  MdVerificationType,
} from "./md-verification";

export type { MdVerificationItem };

export type MdVerificationRow = Record<string, unknown>;

export const MD_ITEM_COLUMNS = [
  "id",
  "paper_code",
  "type",
  "batch_id",
  "status",
  "md_text",
  "pdf_key",
  "submitted_by",
  "submitted_via",
  "assigned_to",
  "edited_by",
  "edited_at",
  "verified_by",
  "verified_at",
  "note",
  "created_at",
  "updated_at",
] as const;

/** List view columns: everything except the md text itself, plus its length. */
export const MD_ITEM_LIST_COLUMNS = [
  "id",
  "paper_code",
  "type",
  "batch_id",
  "status",
  "LENGTH(md_text) AS md_chars",
  "pdf_key",
  "submitted_by",
  "submitted_via",
  "assigned_to",
  "edited_by",
  "edited_at",
  "verified_by",
  "verified_at",
  "note",
  "created_at",
  "updated_at",
] as const;

export function rowToMdItem(row: MdVerificationRow): MdVerificationItem {
  return {
    id: String(row.id ?? ""),
    paper_code: String(row.paper_code ?? ""),
    type: (row.type as MdVerificationType) ?? "question",
    batch_id: String(row.batch_id ?? "manual"),
    status: (row.status as MdVerificationStatus) ?? "pending",
    md_text: String(row.md_text ?? ""),
    pdf_key: (row.pdf_key as string | null) ?? null,
    submitted_by: (row.submitted_by as string | null) ?? null,
    submitted_via: (row.submitted_via as "manual" | "upload") ?? "manual",
    assigned_to: (row.assigned_to as string | null) ?? null,
    edited_by: (row.edited_by as string | null) ?? null,
    edited_at: (row.edited_at as number | null) ?? null,
    verified_by: (row.verified_by as string | null) ?? null,
    verified_at: (row.verified_at as number | null) ?? null,
    note: (row.note as string | null) ?? null,
    created_at: Number(row.created_at ?? 0),
    updated_at: Number(row.updated_at ?? 0),
    md_chars:
      row.md_chars === undefined || row.md_chars === null
        ? undefined
        : Number(row.md_chars),
  };
}

/** True when the user id has a row in md_verifiers. */
export async function isAssignedMdVerifier(userId: string): Promise<boolean> {
  try {
    const db = await getD1();
    const row = await db
      .prepare("SELECT user_id FROM md_verifiers WHERE user_id = ? LIMIT 1")
      .bind(userId)
      .first<{ user_id: string }>();
    return row !== null && row !== undefined;
  } catch {
    return false;
  }
}

/** Page/API gate: moderator, founder, or an assigned verifier. */
export async function canAccessMdVerification(
  user: UserProfile | null,
): Promise<boolean> {
  if (!user) return false;
  if (isModerator(user.role) || isFounder(user.role)) return true;
  return isAssignedMdVerifier(user.id);
}

/** True when the user may edit/review this item: assigned to them, or a
 * moderator/founder (who may act on any item). */
export function canActOnMdItem(
  user: UserProfile,
  item: MdVerificationItem,
): boolean {
  if (isModerator(user.role) || isFounder(user.role)) return true;
  return item.assigned_to !== null && item.assigned_to === user.id;
}

/** Append a history row. The previous md text is kept so an edit can be
 * audited without losing the original. Failures are swallowed: history
 * must never break the save itself. */
export async function addMdHistory(args: {
  itemId: string;
  actorId: string | null;
  actorLabel: string | null;
  action: "created" | "edited" | "submitted" | "approved" | "needs_fix" | "assigned";
  note?: string | null;
  previousMdText?: string | null;
}): Promise<void> {
  try {
    const db = await getD1();
    await db
      .prepare(
        "INSERT INTO md_verification_history (id, item_id, actor_id, actor_label, action, note, previous_md_text, created_at) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        crypto.randomUUID(),
        args.itemId,
        args.actorId,
        args.actorLabel,
        args.action,
        args.note ?? null,
        args.previousMdText ?? null,
        Date.now(),
      )
      .run();
  } catch {
    // History is audit-only; never fail the request for it.
  }
}
