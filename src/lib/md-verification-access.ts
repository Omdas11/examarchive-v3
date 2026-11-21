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
import {
  canActOnMdItem as canActOnMdItemPure,
  type MdActItem,
  type MdActUser,
} from "./md-verification-permissions";
import type {
  MdVerificationItem,
  MdVerificationStatus,
  MdVerificationType,
} from "./md-verification";

export type { MdVerificationItem };

/** Soft-lock lifetime: 2 minutes without a heartbeat. */
export const MD_LOCK_TTL_MS = 2 * 60 * 1000;

/** One edit suggestion from a viewer who is not the assignee. */
export interface MdVerificationSuggestion {
  id: string;
  item_id: string;
  author_id: string | null;
  author_label: string | null;
  /** Question key ("q3") or "" for the whole paper. */
  question_ref: string;
  proposed_text: string;
  note: string | null;
  status: "pending" | "applied" | "dismissed";
  created_at: number;
  updated_at: number;
}

export interface MdVerificationLock {
  item_id: string;
  locked_by: string;
  locked_by_label: string | null;
  locked_at: number;
  /** True when the lock belongs to the requesting user. */
  mine: boolean;
}

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
  "xp_awarded",
  "xp_awarded_to",
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
  "xp_awarded",
  "xp_awarded_to",
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
    xp_awarded: Number(row.xp_awarded ?? 0),
    xp_awarded_to: (row.xp_awarded_to as string | null) ?? null,
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

/** True when the user may edit/review this item: ONLY the verifier it
 * is assigned to. Moderators and the founder can view, suggest, and
 * assign / reassign, but cannot act on an item assigned to someone
 * else (or to nobody). */
export function canActOnMdItem(
  user: UserProfile,
  item: MdVerificationItem,
): boolean {
  return canActOnMdItemPure(
    user as MdActUser,
    item as MdActItem,
  );
}

export type MdSuggestionRow = Record<string, unknown>;

export function rowToSuggestion(
  row: MdSuggestionRow,
): MdVerificationSuggestion {
  return {
    id: String(row.id ?? ""),
    item_id: String(row.item_id ?? ""),
    author_id: (row.author_id as string | null) ?? null,
    author_label: (row.author_label as string | null) ?? null,
    question_ref: String(row.question_ref ?? ""),
    proposed_text: String(row.proposed_text ?? ""),
    note: (row.note as string | null) ?? null,
    status:
      (row.status as MdVerificationSuggestion["status"]) ?? "pending",
    created_at: Number(row.created_at ?? 0),
    updated_at: Number(row.updated_at ?? 0),
  };
}

/**
 * Suggestions for one item, newest last. Returns [] when the table
 * does not exist yet (migration 0013 not applied) — the page then
 * shows suggestions as unavailable instead of crashing.
 */
export async function getItemSuggestions(
  itemId: string,
): Promise<MdVerificationSuggestion[]> {
  try {
    const db = await getD1();
    const { results } = await db
      .prepare(
        "SELECT id, item_id, author_id, author_label, question_ref, proposed_text, note, status, created_at, updated_at " +
          "FROM md_verification_suggestions WHERE item_id = ? ORDER BY created_at ASC LIMIT 50",
      )
      .bind(itemId)
      .all<MdSuggestionRow>();
    return (results ?? []).map(rowToSuggestion);
  } catch {
    return [];
  }
}

/** True when a lock timestamp is older than the heartbeat window. */
export function isLockExpired(lockedAt: number, now = Date.now()): boolean {
  return now - lockedAt > MD_LOCK_TTL_MS;
}

/**
 * Current soft lock for an item, or null. The `mine` flag is relative
 * to the given user id. Returns null when the table does not exist yet.
 */
export async function getItemLock(
  itemId: string,
  userId: string | null,
): Promise<MdVerificationLock | null> {
  try {
    const db = await getD1();
    const row = await db
      .prepare(
        "SELECT item_id, locked_by, locked_by_label, locked_at FROM md_verification_locks WHERE item_id = ? LIMIT 1",
      )
      .bind(itemId)
      .first<{
        item_id: string;
        locked_by: string;
        locked_by_label: string | null;
        locked_at: number;
      }>();
    if (!row) return null;
    if (isLockExpired(row.locked_at)) return null;
    return {
      item_id: row.item_id,
      locked_by: row.locked_by,
      locked_by_label: row.locked_by_label,
      locked_at: row.locked_at,
      mine: userId !== null && row.locked_by === userId,
    };
  } catch {
    return null;
  }
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
