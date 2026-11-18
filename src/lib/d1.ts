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

/** The D1 database binding (wrangler.jsonc: `DB` -> examarchive-db). */
async function getD1(): Promise<D1Database> {
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

  const [listRes, countRes] = await Promise.all([
    db
      .prepare(
        `SELECT ${columns} FROM papers ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
      .bind(...params, limit, offset)
      .all<PaperRow>(),
    db
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
 * and /cbcs-question-papers. Cached 24h (same staleness trade-off as the
 * old Appwrite cache: new papers appear in the lists within a day).
 */
export const getAllApprovedPapersD1 = unstable_cache(
  async (): Promise<Paper[]> => {
    const db = await getD1();
    const columns = PAPER_COLUMNS.join(", ");
    const res = await db
      .prepare(
        `SELECT ${columns} FROM papers WHERE approved = 1 ORDER BY created_at DESC LIMIT 1000`,
      )
      .all<PaperRow>();
    return (res.results ?? []).map(toPaperFromRow);
  },
  ["all-approved-papers-d1"],
  { revalidate: 86400 },
);

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
  const res = await db
    .prepare(
      `SELECT ${columns} FROM papers WHERE approved = 1 AND ` +
        `(course_code LIKE ? ESCAPE '\\' OR paper_name LIKE ? ESCAPE '\\' OR department LIKE ? ESCAPE '\\') ` +
        `ORDER BY created_at DESC LIMIT ?`,
    )
    .bind(like, like, like, clampLimit(limit, 20))
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
  const res = await db
    .prepare(
      `SELECT id, subject, course_code, semester, university FROM syllabus ` +
        `WHERE approval_status = 'approved' AND ` +
        `(subject LIKE ? ESCAPE '\\' OR course_code LIKE ? ESCAPE '\\') ` +
        `ORDER BY created_at DESC LIMIT ?`,
    )
    .bind(like, like, clampLimit(limit, 20))
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
 * user count, 8 newest papers, 3 approved feedback entries. Cached 1h
 * (same as the old homepage cache). The syllabus count is a single
 * COUNT(DISTINCT paper_code) aggregate over syllabus_table — one query,
 * no row pagination.
 */
export const getHomepageStatsD1 = unstable_cache(
  async (): Promise<HomepageStats> => {
    const db = await getD1();
    const columns = PAPER_COLUMNS.join(", ");
    const [papersCount, usersCount, syllabusCount, recentRes, feedbackRes] =
      await Promise.all([
        db
          .prepare("SELECT COUNT(*) AS total FROM papers WHERE approved = 1")
          .first<{ total: number }>(),
        db
          .prepare("SELECT COUNT(*) AS total FROM users")
          .first<{ total: number }>(),
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
  },
  ["homepage-stats-d1"],
  { revalidate: 3600 },
);
