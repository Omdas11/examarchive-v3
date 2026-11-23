import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getD1 } from "@/lib/d1";

export interface TimetablePaperRow {
  id: string;
  course_code: string;
  paper_name: string;
  year: number;
}

/**
 * All approved papers (id, code, name, year) for the exam timetable,
 * KV-cached for 6 hours. The timetable is a public page, so without the
 * cache every visitor would repeat the full-table D1 read (~665 rows) —
 * the same read burn the syllabus cache was added to stop. Papers change
 * only when the team uploads, so 6 hours is fresh enough; a new paper
 * appears on the timetable within hours, not days.
 *
 * Cached in KV (shared across Worker isolates). Same pattern as
 * getAllSyllabusRows in syllabus-cache.ts.
 */
export async function getApprovedPapersForTimetable(): Promise<
  TimetablePaperRow[]
> {
  const KV_KEY = "timetable-papers-v1";
  const KV_TTL_SECONDS = 21600; // 6 hours
  try {
    const { env } = await getCloudflareContext({ async: true });
    const kv = (env as { CACHE?: KVNamespace }).CACHE;
    if (kv) {
      const cached = await kv.get(KV_KEY, "json");
      if (cached) return cached as TimetablePaperRow[];
    }
    const rows = await fetchApprovedPapers();
    if (kv) {
      await kv.put(KV_KEY, JSON.stringify(rows), {
        expirationTtl: KV_TTL_SECONDS,
      });
    }
    return rows;
  } catch {
    return fetchApprovedPapers();
  }
}

async function fetchApprovedPapers(): Promise<TimetablePaperRow[]> {
  const db = await getD1();
  const { results } = await db
    .prepare(
      "SELECT id, course_code, paper_name, year FROM papers WHERE approved = 1 LIMIT 2000",
    )
    .all<Record<string, unknown>>();
  return (results ?? []).map((row) => ({
    id: String(row.id ?? ""),
    course_code: String(row.course_code ?? ""),
    paper_name: String(row.paper_name ?? ""),
    year: Number(row.year ?? 0),
  }));
}
