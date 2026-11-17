# Phase 3 — D1 schema (Cloudflare migration)

Numbered migrations for `wrangler d1 migrations apply` (database
`examarchive-db`, created in Phase 2). Apply in order; each file is
idempotent (`IF NOT EXISTS`) so a re-run is safe. No data is imported
here — that is Phase 4. No app code was changed in this phase.

Source: `docs/cloudflare-migration/phase1-inventory.md` (backup
2026-11-17, project `6af69cb60001f52c7704`: 30 collections, 4,400 docs,
285 attributes — verified against `schema.json` in the backup).

## Files

| File | Tables |
|---|---|
| `0001_init.sql` | users, sessions, papers |
| `0002_syllabus.sql` | syllabus_table, questions_table, syllabus, syllabus_stats, generated_notes_cache |
| `0003_activity.sql` | user_activity, activity_logs, uploads, achievements, user_badges, user_quotas, feedback, content_verifications, site_metrics, visit_logs |
| `0004_commerce.sql` | purchases, user_passes, night_access_codes, night_access_blocks |
| `0005_ai.sql` | ai_usage, pdf_usage, ai_generation_jobs, ai_embeddings, ai_ingestions, ai_syllabus_maps, ai_flashcards, ai_admin_reports, ai_cache_index |

**31 tables total: all 30 Appwrite collections + `sessions`** (new, from
the migration doc Section 5; sessions cannot be migrated — none exist in
the backup, every user signs in again after cutover).

## How the hard cases were handled

- **Arrays (7 attributes) — JSON TEXT, one rule everywhere.**
  `users.referral_path`, `syllabus_table.aliases/keywords/tags`,
  `questions_table.tags`, `ai_flashcards.tags`,
  `ai_embeddings.embedding`. Stored as JSON text (`'[]'` default), parsed
  in code. No child tables: the arrays are small, never filtered on in
  SQL, and a child table per array would triple the table count.
- **Embedding vector — JSON TEXT, no vector index.** `ai_embeddings.embedding`
  (double[]) is stored as JSON text. D1 has no vector search; do not build
  similarity search on this column. A real vector store is needed if
  embeddings are ever used for real.
- **1 MB text fields — in the table, never in list queries.**
  `syllabus_table.syllabus_content`, `questions_table.question_content`,
  `generated_notes_cache.generated_markdown` / `.syllabus_content`.
  List queries must select explicit columns only; fetch the big column
  only on the single-row detail query. (D1 bills rows read.)
- **$permissions — dropped; role + ownership checks in code.** Appwrite
  per-document permissions (e.g. `read("user:<id>")` on each users row)
  have no D1 equivalent. Access control moves into the app:
  `users.role` (values seen: `founder`, `student`) checked server-side
  on every request, plus ownership checks. Collection-level permissions
  were empty everywhere, so nothing else is lost.
- **Write-on-read counters — columns kept, behaviour must change.**
  `papers.view_count/download_count`, `syllabus_stats.view_count/
  download_count`, `site_metrics.visitor_count` are kept so Phase 4 can
  import current values, but the app must NOT increment them per view
  (D1 bills rows written; MD Section 2). Batch/aggregate counts instead.
  `visit_logs` (raw IPs + user agents, written per request) has a table
  for import fidelity, but Phase 4 must decide retention first — it may
  not need to move at all.
- **No foreign keys (except sessions).** Appwrite declares no
  relationships; links are plain string ids, often empty or orphaned
  (`papers.uploaded_by` is empty on all 636 rows), so FKs would break the
  import. Only `sessions.user_id -> users(id) ON DELETE CASCADE` is a FK.
- **Duplicate / overlapping fields — both kept, one canonical.**
  `papers.institute` + `institution` (canonical: `institution`);
  `syllabus_table.semester` + `semester_no` (canonical: `semester_no`).
  Phase 6 should use the canonical field.
- **JSON-in-a-string — TEXT, parse in code.** `ai_generation_jobs.
  input_payload_json`, `ai_syllabus_maps.modules_json`,
  `ai_admin_reports.risks_json`, `activity_logs.meta`.
- **Types normalised.** Datetimes → INTEGER epoch ms; booleans →
  INTEGER 0/1; ids → TEXT. Kept as TEXT where Appwrite itself was
  inconsistent: `users.username_last_changed`, `syllabus_table.
  last_updated`, `generated_notes_cache.year/semester`,
  `user_quotas/ai_usage/pdf_usage` date strings (`YYYY-MM-DD`).
- **`legacy_appwrite_id` on every migrated table** (TEXT UNIQUE) so
  Phase 4 can map rows back. Drop only after the migration is verified.
- **`syllabus` (0 rows) kept as a table** although largely superseded by
  `syllabus_table`; Phase 6 confirms whether the app still reads it.
- **Deprecated, kept for fidelity only:** `night_access_codes` /
  `night_access_blocks` — the nightly closure they served was removed
  2026-11-14. Do not build on them; Phase 6 confirms deletion.

## Corrections to Phase 1 found while writing this schema

- Attribute counts in the Phase 1 summary table were off by one for
  three collections; the detail lists (and `schema.json`) are right:
  `Questions_Table` 31 (not 32), `Generated_Notes_Cache` 17 (not 16),
  `user_passes` 11 (not 10). Total is still 285 attributes.
- `papers` has no `subject` column (subject lives in `Syllabus_Table`),
  so the hot-query composite index is `(department, year)`, not
  `(subject, year)`.

## Validation

Applied to a fresh local SQLite database with the `sqlite3` CLI
(D1 is SQLite, so the same files apply with `wrangler d1 migrations
apply`): all 5 files execute cleanly, **31 tables, 79 explicit indexes**
(counted from `sqlite_master`, excluding SQLite auto-indexes created by
UNIQUE column constraints). Smoke-tested
with an insert + JSON-array read on `papers` and `syllabus_table`.

## Apply (once Phase 2 has created the database)

```sh
wrangler d1 migrations apply examarchive-db --local   # local check
wrangler d1 migrations apply examarchive-db --remote  # real D1, Phase 4+
```
