import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getD1 } from "@/lib/d1";

export interface NoticeRow {
  id: string;
  title: string;
  source: string;
  source_url: string;
  notice_date: string | null;
  category: string | null;
  created_at: number;
}

/**
 * Official notices (Assam University + Haflong Govt College) for the
 * /notices page, KV-cached for 1 hour. The page is public, so without the
 * cache every visitor would repeat the D1 read — the same read burn the
 * timetable cache was added to stop. Notices change only when the watch
 * finds a new one, and the watch deletes this KV key after inserting, so
 * a new notice appears on the page within minutes, not hours.
 *
 * Cached in KV (shared across Worker isolates). Same pattern as
 * getApprovedPapersForTimetable in timetable-papers.ts.
 */
export async function getNotices(): Promise<NoticeRow[]> {
  const KV_KEY = "notices-v1";
  const KV_TTL_SECONDS = 3600; // 1 hour
  try {
    const { env } = await getCloudflareContext({ async: true });
    const kv = (env as { CACHE?: KVNamespace }).CACHE;
    if (kv) {
      const cached = await kv.get(KV_KEY, "json");
      if (cached) return cached as NoticeRow[];
    }
    const rows = await fetchNotices();
    if (kv) {
      await kv.put(KV_KEY, JSON.stringify(rows), {
        expirationTtl: KV_TTL_SECONDS,
      });
    }
    return rows;
  } catch {
    return fetchNotices();
  }
}

async function fetchNotices(): Promise<NoticeRow[]> {
  const db = await getD1();
  const { results } = await db
    .prepare(
      "SELECT id, title, source, source_url, notice_date, category, created_at FROM notices ORDER BY notice_date DESC, created_at DESC LIMIT 200",
    )
    .all<Record<string, unknown>>();
  return (results ?? []).map((row) => ({
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    source: String(row.source ?? ""),
    source_url: String(row.source_url ?? ""),
    notice_date:
      row.notice_date == null ? null : String(row.notice_date),
    category: row.category == null ? null : String(row.category),
    created_at: Number(row.created_at ?? 0),
  }));
}
