# Phase 4 — Paper → File Mapping (file_id → R2 key)

- **Date:** 2026-11-18
- **Branch:** `migrate/cloudflare`
- **Result: 636/636 papers mapped, 0 unmapped, 0 mismatches.** Remote D1
  `papers.file_key` is set for all 636 papers (was 19/636).

## How it was recovered

The Appwrite Storage file-list API still works even though DatabaseReads is
at 100% (a Storage call, not a DB read). One `listFiles` against the
`papers` bucket returns every file's `$id` + `name` + `sizeOriginal`.

- **Pagination:** plain `limit` / `cursorAfter` query params are ignored by
  the API (always returns the default 25, no cursor movement). The working
  form is `queries[]=limit(100)` + `queries[]=cursorAfter("<last $id>")`,
  URL-encoded inside the path argument to `aw_edu.py`.
- **Fetched:** 667 files in 7 pages, all unique IDs. Saved verbatim at
  `docs/cloudflare-migration/appwrite-file-list.json`.

## Join rule (paper file_id → backup filename → R2 key)

For each paper: storage file `name` for its `file_id`, then resolve the
backup filename, preferring the fileId-suffixed (collision) form
`<stem>_<fileId>.pdf` when it exists, else the plain `name`. Either way the
backup file's size must equal the storage file's `sizeOriginal`.

- **636 mapped:** 617 plain name, 19 collision form.
- **0 unmapped:** every paper's `file_id` exists in the storage list.
- **0 mismatches:** every resolved backup file exists and its size matches.
- **Correction to the Phase 4 report:** the backup holds **40** fileId-suffixed
  files, not 5 — 19 belong to papers, 21 to orphan notes files. The Phase 4
  import had already set `file_key` for exactly those 19 papers, and the new
  mapping agrees with all 19 values.
- **Duplicate-name safety:** 24 storage names are shared by 2–11 files.
  Size disambiguation resolved all of them; the 7 cases where two files share
  both name *and* size were checked by SHA-256 — byte-identical files, so
  either mapping serves the same PDF.

## D1 update

`scripts/update-file-keys.mjs` — `UPDATE papers SET file_key = ... WHERE
file_id = ...` for all 636, in 13 batches of ≤ 50 via the D1 REST API
through the MCP `execute` tool (same transport as `import-d1.mjs`). Values
are SQL-escaped; file_ids validated as 20 hex chars, keys as
`papers/[A-Za-z0-9_.-]+`. Total rows written: 636.

## Verification (remote D1, after the update)

- `SELECT COUNT(*) / COUNT(file_key)`: **636 total, 636 with file_key,
  0 NULL.**
- Full comparison: all 636 `file_id → file_key` pairs in D1 fetched in
  pages and compared against the mapping — **exact match, 636 distinct
  keys.**
- Spot-check 10 random papers (seed 20261118): each `file_key` resolves to
  a backup file that exists with size == storage `sizeOriginal` — **10/10 OK.**
- The single-query full dump (636 rows) exceeds the MCP output limit and
  fails to parse — fetch in pages of ≤ 100 rows instead.

## Orphans

**31 of the 667 storage files are not referenced by any paper** — all notes
PDFs (`PHYDSC351T_Unit_1_Notes.pdf` x11, `PHYDSC352T_Unit_2_Notes.pdf` x6,
`PHYDSC353T_Unit_5_Notes.pdf` x5, `COMDSC351T_Unit_3_Notes.pdf` x2,
`PHYDSC352T_Unit_5_Notes.pdf` x2, plus 5 singles). They are still uploaded
to R2 under the same `papers/` scheme (see the R2 manifest); Phase 6 decides
whether they stay.

## Files

- `docs/cloudflare-migration/appwrite-file-list.json` — all 667 storage
  files (`$id`, `name`, `sizeOriginal`, `signature`, `$createdAt`).
- `docs/cloudflare-migration/phase4-file-mapping.json` — the 636 mappings
  (`paper_id`, `file_id`, `storage_name`, `backup_filename`, `file_key`,
  `size`, `resolved_via`) plus the 31 orphan file IDs.
- `scripts/update-file-keys.mjs` — the D1 update script (re-runnable;
  re-setting the same values is a no-op).

## Still blocked (unchanged)

R2 upload itself still needs `wrangler login` (owner browser step). The
`file_key` values above are exactly the keys `scripts/upload-r2.mjs` will
produce (`papers/<backup-filename>`), so once the upload runs, paper PDF
serving from R2 works with no further mapping work.
