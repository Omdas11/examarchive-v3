/**
 * Merge GROUP BY verified-count rows onto the page's users.
 * Every listed user gets an entry (0 when they have no rows); rows for
 * user ids not on the page are ignored. Pure function, tested in
 * verified-counts.test.ts.
 */
export function mergeVerifiedCounts(
  userIds: string[],
  rows: { user_id: string; n: number }[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of userIds) counts.set(id, 0);
  for (const row of rows) {
    if (!row.user_id || !counts.has(row.user_id)) continue;
    counts.set(row.user_id, Number(row.n ?? 0));
  }
  return counts;
}
