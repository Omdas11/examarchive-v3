import { getAllApprovedPapersD1 } from "@/lib/d1";
import type { Paper } from "@/types";

/**
 * All approved papers, fetched once and shared by /browse, /papers/[dept],
 * /fyug-question-papers, /assam-university-question-papers and
 * /cbcs-question-papers.
 *
 * Cloudflare migration (Phase 6): reads from D1 via `src/lib/d1.ts`
 * instead of Appwrite. Cached for 24h: new papers appear in the lists
 * within a day. The D1 query selects explicit columns only (no SELECT *)
 * and reads at most 1,000 rows per refresh.
 *
 * There is deliberately no Appwrite fallback here: on the
 * migrate/cloudflare branch a missing D1 binding fails loudly in
 * `getD1()` instead of silently serving data from the old backend.
 */
export const getAllApprovedPapers = getAllApprovedPapersD1;

export type { Paper };
