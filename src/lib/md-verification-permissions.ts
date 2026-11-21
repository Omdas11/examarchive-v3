/**
 * MD verification — who may act on an item (pure, no D1 / auth).
 *
 * Rule (decided by the user, 2026-11-21): ONLY the verifier an item is
 * assigned to may use the four actions — Save draft, Submit, Approve,
 * Needs fix. Moderators and the founder can view the item, suggest an
 * edit, and assign / reassign it, but they can no longer act on an
 * item that is not assigned to them. An unassigned item (assigned_to
 * null) can be acted on by nobody until the founder assigns it.
 *
 * Kept in this pure module so the jest tests can import it without a
 * Worker / D1 context. md-verification-access.ts re-exports it.
 */

export interface MdActUser {
  id: string;
}

export interface MdActItem {
  assigned_to: string | null;
}

/** True when this user is the item's assigned verifier. */
export function canActOnMdItem(
  user: MdActUser,
  item: MdActItem,
): boolean {
  return item.assigned_to !== null && item.assigned_to === user.id;
}
