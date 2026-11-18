import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getD1 } from "@/lib/d1";
import {
  toSyllabusTableRow,
  type SyllabusTableRow,
} from "@/lib/syllabus-table";

// Re-exported so the syllabus kill-switch is discoverable from the
// syllabus module too. Defined in site-flags.ts (Edge-safe) because
// src/middleware.ts also imports it. Temporary — set to false to
// re-enable the syllabus once all 517 papers are verified.
export { SYLLABUS_DISABLED } from "./site-flags";

/**
 * Every published syllabus-table row (2,585 rows), fetched once and shared
 * by /syllabus, /syllabus/[department] and /syllabus/paper/[dept]/[code].
 *
 * The old code fetched the whole table (or a whole department's rows) on
 * every page visit — 2,585 reads for the index page alone. Syllabus content
 * changes only when the team publishes new rows, so a 7-day cache is safe.
 *
 * Cached in KV (shared across Worker isolates) for 7 days. The old
 * unstable_cache was per-isolate, so every new isolate re-read all 2,585
 * rows — the same D1 read burn as the homepage stats. Total payload is
 * ~1.5 MB, well under KV's 25 MB value limit.
 */
export async function getAllSyllabusRows(): Promise<SyllabusTableRow[]> {
  const KV_KEY = "syllabus-table-all-v1";
  const KV_TTL_SECONDS = 604800;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const kv = (env as { CACHE?: KVNamespace }).CACHE;
    if (kv) {
      const cached = await kv.get(KV_KEY, "json");
      if (cached) return cached as SyllabusTableRow[];
    }
    const rows = await fetchAllSyllabusRows();
    if (kv) {
      await kv.put(KV_KEY, JSON.stringify(rows), {
        expirationTtl: KV_TTL_SECONDS,
      });
    }
    return rows;
  } catch {
    return fetchAllSyllabusRows();
  }
}

async function fetchAllSyllabusRows(): Promise<SyllabusTableRow[]> {
  const db = await getD1();
  const { results } = await db
    .prepare("SELECT * FROM syllabus_table WHERE status = 'published'")
    .all<Record<string, unknown>>();
  return (results ?? []).map((row) => toSyllabusTableRow(row));
}
