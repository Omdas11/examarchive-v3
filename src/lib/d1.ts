/**
 * D1 data-access layer (Cloudflare migration, Phase 6).
 *
 * All public read paths go through here. Pages never write SQL directly.
 * Rules enforced in this module:
 * - Parameterized queries ONLY (`.prepare(...).bind(...)`). User input is
 *   never concatenated into SQL.
 * - Explicit column lists, never `SELECT *` — the papers/syllabus tables
 *   sit next to 1 MB text columns in the schema (syllabus_content,
 *   question_content), and D1 bills rows read.
 * - No writes on read paths. View/download counters are read-only here;
 *   the per-view increment behaviour is deliberately NOT ported (MD
 *   Section 2: never write to D1 on every page view).
 * - No silent fallback to Appwrite. If the D1 binding is missing, this
 *   throws loudly so a misconfigured deploy fails visibly instead of
 *   serving stale/wrong data.
 *
 * The D1 binding comes from the Cloudflare Workers env via
 * `getCloudflareContext({ async: true })`. Async mode works in the Worker,
 * in `next dev` (next.config.mjs calls `initOpenNextCloudflareForDev()`),
 * and during static generation (via wrangler's platform proxy).
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { unstable_cache } from "next/cache";
import { toPaper, type Paper } from "@/types";

/** The D1 database binding (wrangler.jsonc: `DB` -> examarchive-db). Exported
 * for the auth layer (src/lib/auth-cf.ts), which needs the same binding. */
export async function getD1(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.DB) {
    throw new Error(
      "[d1] D1 binding `DB` is not available. Run under `wrangler dev` / " +
        "`opennextjs-cloudflare preview`, or `next dev` with the Cloudflare " +
        "adapter initialised (see next.config.mjs). There is no Appwrite " +
        "fallback on the migrate/cloudflare branch.",
    );
  }
  return env.DB;
}

/** Columns selected for paper list/detail queries. No `SELECT *`. */
const PAPER_COLUMNS = [
  "id",
  "course_code",
  "paper_name",
  "year",
  "semester",
  "department",
  "programme",
  "exam_type",
  "institute",
  "institution",
  "stream",
  "paper_type",
  "marks",
  "duration",
  "file_id",
  "file_url",
  "file_key",
  "uploaded_by",
  "uploaded_by_username",
  "approved",
  "status",
  "view_count",
  "download_count",
  "source_name",
  "source_url",
  "legacy_appwrite_id",
  "created_at",
  "updated_at",
] as const;

type PaperRow = Record<string, unknown>;

/**
 * Map a D1 papers row to the app's `Paper` type. Reuses the existing
 * `toPaper` mapper: D1 stores `created_at` as epoch ms (converted to ISO)
 * and `approved` as 0/1 (converted to boolean) — the mapper's other
 * fallbacks (institute/institution, paper_name title) apply unchanged.
 */
function toPaperFromRow(row: PaperRow): Paper {
  return toPaper({
    ...row,
    $id: row.id,
    $createdAt:
      typeof row.created_at === "number"
        ? new Date(row.created_at).toISOString()
        : row.created_at,
    approved: row.approved === 1 || row.approved === true,
  });
}

/** Escape LIKE wildcards in user input so `%`/`_` match literally. */
function escapeLike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Normalize a search term the way the browse page does: lowercase and strip
 * every non-alphanumeric, so "COMDSC" also matches "COM-DSC-401T".
 * The SQL side uses REPLACE() on course_code so both sides compare compact.
 */
function normalizeSearchTerm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Clamp a caller-supplied limit into a safe range for D1. */
function clampLimit(limit: number, max = 100): number {
  if (!Number.isFinite(limit) || limit < 1) return 20;
  return Math.min(Math.floor(limit), max);
}

// ── Paper lists ──────────────────────────────────────────────────────────

export interface PaperFilters {
  department?: string;
  year?: number;
  semester?: string;
  programme?: string;
  /** Free-text match against code, name, and department. */
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Paginated list of approved papers, newest first, with optional filters.
 * Returns the page plus the total matching count (single COUNT query).
 */
export async function getPapers(
  filters: PaperFilters = {},
): Promise<{ papers: Paper[]; total: number }> {
  const db = await getD1();
  const limit = clampLimit(filters.limit ?? 20);
  const offset = Math.max(0, Math.floor(filters.offset ?? 0));

  const where: string[] = ["approved = 1"];
  const params: unknown[] = [];
  if (filters.department) {
    where.push("department = ?");
    params.push(filters.department);
  }
  if (filters.year !== undefined) {
    where.push("year = ?");
    params.push(filters.year);
  }
  if (filters.semester) {
    where.push("semester = ?");
    params.push(filters.semester);
  }
  if (filters.programme) {
    where.push("programme = ?");
    params.push(filters.programme);
  }
  if (filters.search) {
    where.push(
      "(course_code LIKE ? ESCAPE '\\' OR paper_name LIKE ? ESCAPE '\\' OR department LIKE ? ESCAPE '\\')",
    );
    const like = `%${escapeLike(filters.search)}%`;
    params.push(like, like, like);
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;
  const columns = PAPER_COLUMNS.join(", ");

  // The COUNT(*) scans every matching paper row (636 unfiltered) on every
  // list-page load — the biggest remaining per-request D1 read burner
  // (found 2026-11-18: ~178 rows read per request site-wide, mostly this
  // count running on /browse, /papers/[dept], /fyug-*, /assam-* and
  // /cbcs-*). Cached in KV for 1h per filter combination; the 20-row
  // list itself is cheap and stays fresh.
  const countKey = `papers-count-v1:${whereSql}:${JSON.stringify(params)}`;
  let total: number | null = null;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const kv = (env as { CACHE?: KVNamespace }).CACHE;
    if (kv) {
      const cached = await kv.get(countKey);
      if (cached !== null) total = parseInt(cached, 10);
    }
    if (total === null) {
      const countRes = await db
        .prepare(`SELECT COUNT(*) AS total FROM papers ${whereSql}`)
        .bind(...params)
        .first<{ total: number }>();
      total = countRes?.total ?? 0;
      if (kv) {
        await kv.put(countKey, String(total), { expirationTtl: 3600 });
      }
    }
  } catch {
    total = null;
  }

  const [listRes, countRes] = await Promise.all([
    db
      .prepare(
        `SELECT ${columns} FROM papers ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
      .bind(...params, limit, offset)
      .all<PaperRow>(),
    total !== null
      ? Promise.resolve({ total })
      : db
          .prepare(`SELECT COUNT(*) AS total FROM papers ${whereSql}`)
          .bind(...params)
          .first<{ total: number }>(),
  ]);

  return {
    papers: (listRes.results ?? []).map(toPaperFromRow),
    total: countRes?.total ?? 0,
  };
}

/**
 * All approved papers, newest first — the shared list behind /browse,
 * /papers/[dept], /fyug-question-papers, /assam-university-question-papers
 * and /cbcs-question-papers.
 *
 * Cached in KV (shared across Worker isolates) for 24h. The old
 * unstable_cache was per-isolate, so every new isolate re-read all 636
 * papers — same D1 read burn as the homepage stats. New papers appear in
 * the lists within a day.
 */
export async function getAllApprovedPapersD1(): Promise<Paper[]> {
  const KV_KEY = "all-approved-papers-v1";
  const KV_TTL_SECONDS = 86400;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const kv = (env as { CACHE?: KVNamespace }).CACHE;
    if (kv) {
      const cached = await kv.get(KV_KEY, "json");
      if (cached) return cached as Paper[];
    }
    const db = await getD1();
    const columns = PAPER_COLUMNS.join(", ");
    const res = await db
      .prepare(
        `SELECT ${columns} FROM papers WHERE approved = 1 ORDER BY created_at DESC LIMIT 1000`,
      )
      .all<PaperRow>();
    const papers = (res.results ?? []).map(toPaperFromRow);
    if (kv) {
      await kv.put(KV_KEY, JSON.stringify(papers), {
        expirationTtl: KV_TTL_SECONDS,
      });
    }
    return papers;
  } catch {
    const db = await getD1();
    const columns = PAPER_COLUMNS.join(", ");
    const res = await db
      .prepare(
        `SELECT ${columns} FROM papers WHERE approved = 1 ORDER BY created_at DESC LIMIT 1000`,
      )
      .all<PaperRow>();
    return (res.results ?? []).map(toPaperFromRow);
  }
}

// ── Single paper ─────────────────────────────────────────────────────────

/**
 * One paper by its D1 id OR its legacy Appwrite id, so old /paper/<id>
 * links (which carry Appwrite `$id`s) keep working after migration.
 * Cached 24h, same as the old paper-by-id cache.
 */
export const getPaperD1 = unstable_cache(
  async (id: string): Promise<Paper | null> => {
    const db = await getD1();
    const columns = PAPER_COLUMNS.join(", ");
    const row = await db
      .prepare(
        `SELECT ${columns} FROM papers WHERE id = ? OR legacy_appwrite_id = ? LIMIT 1`,
      )
      .bind(id, id)
      .first<PaperRow>();
    return row ? toPaperFromRow(row) : null;
  },
  ["paper-by-id-d1"],
  { revalidate: 86400 },
);

/** Papers sharing a course code (multi-year view), cached 24h per code. */
export const getRelatedPapersD1 = unstable_cache(
  async (courseCode: string, excludeId: string): Promise<Paper[]> => {
    const db = await getD1();
    const columns = PAPER_COLUMNS.join(", ");
    const res = await db
      .prepare(
        `SELECT ${columns} FROM papers WHERE approved = 1 AND course_code = ? AND id != ? ORDER BY created_at DESC LIMIT 20`,
      )
      .bind(courseCode, excludeId)
      .all<PaperRow>();
    return (res.results ?? []).map(toPaperFromRow);
  },
  ["related-papers-d1"],
  { revalidate: 86400 },
);

/** Live view/download totals for one paper, read fresh (not from cache). */
export async function getPaperCountsD1(
  paperId: string,
): Promise<{ view_count: number; download_count: number }> {
  try {
    const db = await getD1();
    const row = await db
      .prepare(
        "SELECT view_count, download_count FROM papers WHERE id = ? OR legacy_appwrite_id = ? LIMIT 1",
      )
      .bind(paperId, paperId)
      .first<{ view_count: number; download_count: number }>();
    return {
      view_count: row?.view_count ?? 0,
      download_count: row?.download_count ?? 0,
    };
  } catch {
    return { view_count: 0, download_count: 0 };
  }
}

/** Live view/download totals for one syllabus paper. D1 port of
 * getSyllabusStat (counts.ts, Appwrite). */
export async function getSyllabusStatD1(
  paperCode: string,
): Promise<{ view_count: number; download_count: number }> {
  try {
    const db = await getD1();
    const row = await db
      .prepare(
        "SELECT view_count, download_count FROM syllabus_stats WHERE paper_code = ? LIMIT 1",
      )
      .bind(paperCode)
      .first<{ view_count: number; download_count: number }>();
    return {
      view_count: Number(row?.view_count ?? 0),
      download_count: Number(row?.download_count ?? 0),
    };
  } catch {
    return { view_count: 0, download_count: 0 };
  }
}

/** Stats for many syllabus papers at once, keyed by normalized code. D1 port
 * of getSyllabusStats (counts.ts, Appwrite). */
export async function getSyllabusStatsD1(
  paperCodes: string[],
): Promise<Map<string, { view_count: number; download_count: number }>> {
  const out = new Map<string, { view_count: number; download_count: number }>();
  const codes = [...new Set(paperCodes.filter(Boolean))];
  if (codes.length === 0) return out;
  try {
    const db = await getD1();
    const placeholders = codes.map(() => "?").join(",");
    const { results } = await db
      .prepare(
        `SELECT paper_code, view_count, download_count FROM syllabus_stats WHERE paper_code IN (${placeholders}) LIMIT 100`,
      )
      .bind(...codes)
      .all<{ paper_code: string; view_count: number; download_count: number }>();
    for (const row of results ?? []) {
      const code = String(row.paper_code ?? "");
      if (!code) continue;
      out.set(code, {
        view_count: Number(row.view_count ?? 0),
        download_count: Number(row.download_count ?? 0),
      });
    }
  } catch {
    // Stats are optional decoration; an empty map renders no counts.
  }
  return out;
}

// ── Per-user activity (profile: Recently viewed / Downloads) ─────────────

export interface UserActivityEntry {
  action: "view" | "download";
  scope: "paper" | "syllabus";
  title: string;
  href: string;
  paper_ref: string;
  createdAt: string;
}

/**
 * The user's recent views/downloads from user_activity, newest first,
 * deduped by scope+paper_ref. D1 port of getRecentUserActivity (counts.ts,
 * Appwrite) — the profile page's history sections.
 */
export async function getRecentUserActivityD1(
  userId: string,
  action: "view" | "download",
  limit = 10,
): Promise<UserActivityEntry[]> {
  try {
    const db = await getD1();
    const { results } = await db
      .prepare(
        "SELECT action, scope, title, href, paper_ref, created_at FROM user_activity WHERE user_id = ? AND action = ? ORDER BY created_at DESC LIMIT ?",
      )
      .bind(userId, action, limit * 2)
      .all<{
        action: string;
        scope: string;
        title: string;
        href: string;
        paper_ref: string;
        created_at: number;
      }>();
    const seen = new Set<string>();
    const out: UserActivityEntry[] = [];
    for (const row of results ?? []) {
      const key = `${row.scope}:${row.paper_ref}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        action: row.action as "view" | "download",
        scope: row.scope as "paper" | "syllabus",
        title: row.title ?? "",
        href: row.href ?? "",
        paper_ref: row.paper_ref ?? "",
        createdAt: new Date(row.created_at).toISOString(),
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

// ── File serving (R2) ────────────────────────────────────────────────────

/** The R2 bucket binding (wrangler.jsonc: `PAPERS` -> examarchive-papers). */
export async function getPapersBucket(): Promise<R2Bucket> {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.PAPERS) {
    throw new Error(
      "[d1] R2 binding `PAPERS` is not available. Run under " +
        "`wrangler dev` / `opennextjs-cloudflare preview`, or `next dev` " +
        "with the Cloudflare adapter initialised (see next.config.mjs).",
    );
  }
  return env.PAPERS;
}

/** Minimal paper reference for the file-serving route: D1 row + R2 key. */
export interface PaperFileRef {
  fileId: string;
  /** R2 object key (`papers/<filename>`), or null until the file is uploaded. */
  fileKey: string | null;
  paperName: string;
  courseCode: string;
}

/**
 * One paper by its Appwrite file id — the id the download URLs carry.
 * Read fresh on every call (NO unstable_cache): the file_id -> file_key
 * mapping is being populated right now, so a cached miss would go stale.
 */
export async function getPaperByFileId(
  fileId: string,
): Promise<PaperFileRef | null> {
  const db = await getD1();
  const row = await db
    .prepare(
      "SELECT file_id, file_key, paper_name, course_code FROM papers WHERE file_id = ? LIMIT 1",
    )
    .bind(fileId)
    .first<{
      file_id: string;
      file_key: string | null;
      paper_name: string | null;
      course_code: string | null;
    }>();
  if (!row) return null;
  return {
    fileId: row.file_id,
    fileKey: row.file_key,
    paperName: row.paper_name ?? "",
    courseCode: row.course_code ?? "",
  };
}

// ── Search ───────────────────────────────────────────────────────────────

/**
 * Indexed LIKE search over approved papers (course code, paper name,
 * department). D1 has no full-text index on papers; LIKE with a bound
 * pattern keeps this to a small scan, capped by `limit`.
 */
export async function searchPapers(
  q: string,
  limit = 10,
): Promise<Paper[]> {
  const query = q.trim();
  if (!query) return [];
  const db = await getD1();
  const columns = PAPER_COLUMNS.join(", ");
  const like = `%${escapeLike(query)}%`;
  // Course codes are stored hyphenated ("COM-DSC-401T"); compare the compact
  // form so "COMDSC" matches too. Names/departments keep the plain LIKE.
  const codeLike = `%${escapeLike(normalizeSearchTerm(query))}%`;
  const res = await db
    .prepare(
      `SELECT ${columns} FROM papers WHERE approved = 1 AND ` +
        `(REPLACE(REPLACE(REPLACE(course_code, '-', ''), ' ', ''), '.', '') LIKE ? ESCAPE '\\' OR paper_name LIKE ? ESCAPE '\\' OR department LIKE ? ESCAPE '\\') ` +
        `ORDER BY created_at DESC LIMIT ?`,
    )
    .bind(codeLike, like, like, clampLimit(limit, 20))
    .all<PaperRow>();
  return (res.results ?? []).map(toPaperFromRow);
}

export interface SyllabusSuggestion {
  id: string;
  subject: string;
  course_code: string | null;
  semester: string | null;
  university: string | null;
}

/**
 * Search the `syllabus` table (user-uploaded syllabi). The collection is
 * empty in the current Appwrite project, so this normally returns nothing —
 * kept for parity with the old /api/search behaviour.
 */
export async function searchSyllabus(
  q: string,
  limit = 5,
): Promise<SyllabusSuggestion[]> {
  const query = q.trim();
  if (!query) return [];
  const db = await getD1();
  const like = `%${escapeLike(query)}%`;
  const codeLike = `%${escapeLike(normalizeSearchTerm(query))}%`;
  const res = await db
    .prepare(
      `SELECT id, subject, course_code, semester, university FROM syllabus ` +
        `WHERE approval_status = 'approved' AND ` +
        `(subject LIKE ? ESCAPE '\\' OR REPLACE(REPLACE(REPLACE(course_code, '-', ''), ' ', ''), '.', '') LIKE ? ESCAPE '\\') ` +
        `ORDER BY created_at DESC LIMIT ?`,
    )
    .bind(like, codeLike, clampLimit(limit, 20))
    .all<SyllabusSuggestion>();
  return res.results ?? [];
}

// ── Homepage stats ───────────────────────────────────────────────────────

/** Shape of a single approved feedback entry (homepage "Student Voices"). */
export interface FeedbackEntry {
  id: string;
  name: string;
  university: string;
  text: string;
}

export interface HomepageStats {
  papersTotal: number;
  syllabusTotal: number;
  usersTotal: number;
  recentPapers: Paper[];
  feedbackEntries: FeedbackEntry[];
}

/**
 * Homepage numbers: approved paper count, distinct syllabus paper count,
 * user count, 8 newest papers, 3 approved feedback entries.
 *
 * Cached in KV (shared across Worker isolates) for 1h. The old
 * unstable_cache was per-isolate, so every new isolate re-ran the
 * COUNT(DISTINCT paper_code) scan over all 2,585 syllabus_table rows —
 * that scan alone was burning ~2M rows read/day on the D1 free tier
 * (5M/day limit). KV caching makes the scan run once per hour total.
 */
export async function getHomepageStatsD1(): Promise<HomepageStats> {
  const KV_KEY = "homepage-stats-v1";
  const KV_TTL_SECONDS = 3600;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const kv = (env as { CACHE?: KVNamespace }).CACHE;
    if (kv) {
      const cached = await kv.get(KV_KEY, "json");
      if (cached) return cached as HomepageStats;
    }
    const stats = await fetchHomepageStatsD1();
    if (kv) {
      await kv.put(KV_KEY, JSON.stringify(stats), {
        expirationTtl: KV_TTL_SECONDS,
      });
    }
    return stats;
  } catch {
    return fetchHomepageStatsD1();
  }
}

async function fetchHomepageStatsD1(): Promise<HomepageStats> {
  const db = await getD1();
  const columns = PAPER_COLUMNS.join(", ");
  const [papersCount, usersCount, syllabusCount, recentRes, feedbackRes] =
    await Promise.all([
      db
        .prepare("SELECT COUNT(*) AS total FROM papers WHERE approved = 1")
        .first<{ total: number }>(),
      db.prepare("SELECT COUNT(*) AS total FROM users").first<{ total: number }>(),
      db
        .prepare(
          "SELECT COUNT(DISTINCT paper_code) AS total FROM syllabus_table",
        )
        .first<{ total: number }>(),
      db
        .prepare(
          `SELECT ${columns} FROM papers WHERE approved = 1 ORDER BY created_at DESC LIMIT 8`,
        )
        .all<PaperRow>(),
      db
        .prepare(
          "SELECT id, name, university, text FROM feedback WHERE approved = 1 ORDER BY created_at DESC LIMIT 3",
        )
        .all<FeedbackEntry>(),
    ]);

  return {
    papersTotal: papersCount?.total ?? 0,
    syllabusTotal: syllabusCount?.total ?? 0,
    usersTotal: usersCount?.total ?? 0,
    recentPapers: (recentRes.results ?? []).map(toPaperFromRow),
    feedbackEntries: (feedbackRes.results ?? []).map((f) => ({
      id: f.id,
      name: f.name ?? "Anonymous",
      university: f.university ?? "",
      text: f.text ?? "",
    })),
  };
}
