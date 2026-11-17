# Phase 4 — Data and File Migration (Cloudflare migration)

- **Date:** 2026-11-18
- **Branch:** `migrate/cloudflare`
- **Source:** ONLY the local backup `~/workspace/examarchive-backup/2026-11-17/`
  (project `6af69cb60001f52c7704`). No Appwrite reads were made — the old
  project is at 95%+ reads. The backup JSON files were not modified.
- **Target D1:** `examarchive-db` (`69025c94-38e5-4e0c-9205-76382d924485`) —
  **remote, live data imported and verified**. No `wrangler login` was needed:
  the import went through the Cloudflare API via the MCP `execute` tool
  (the stored API token is attached by the MCP helper; it never appears in
  the scripts). Migrations were applied to the remote D1 first, then the
  data, in the same run.

## What was done

1. **Migrations applied to remote D1** — all 5 Phase 3 files
   (`0001_init.sql` … `0005_ai.sql`, 110 statements) via the D1 REST API
   batch endpoint. Verified: 32 tables in the remote DB (31 + Cloudflare's
   internal `_cf_KV`).
2. **Data imported** — `scripts/import-d1.mjs` transforms the backup JSON
   into `INSERT`s and loads them in chunks (≤ 80 KB / ≤ 50 statements per
   D1 API call). 3,253 rows imported. Same script also runs against a local
   SQLite file (`--target local`) for testing; the local run was verified
   first, then the identical script ran against remote D1.
3. **R2 upload prepared, not run** — `scripts/upload-r2.mjs` uploads all 667
   backup PDFs to `examarchive-papers` under `papers/<original-filename>`.
   It is **blocked on `wrangler login`** (owner browser step; `wrangler` is
   not even installed in this environment). See "Blocked" below.
   A manifest with keys, sizes and SHA-256 hashes is committed at
   `docs/cloudflare-migration/phase4-r2-manifest.json`.

## Row counts — D1 (remote) vs backup

| Table | D1 | Backup | |
|---|---:|---:|---|
| users | 3 | 3 | OK |
| papers | 636 | 636 | OK |
| syllabus_table | 2,585 | 2,585 | OK |
| syllabus_stats | 25 | 25 | OK |
| user_activity | 3 | 3 | OK |
| site_metrics | 1 | 1 | OK |
| all other 24 tables | 0 | 0 | OK |
| **Total imported** | **3,253** | **3,253** | **OK** |

## Spot-check — 10 random records, field by field

Remote D1, checked by the import script (every column vs the backup doc):

- papers `6af6c3d272a67afb0b62`, `6af6c3504302f9dde7d2`,
  `6af6c3a9ecf4b0705008`, `6af6c2eca8204be08a3d`, `6af6c2910b9643495771` — OK
- syllabus_table `6af6c116127b2e8942fc`, `6af6c18bb4284f60d164`,
  `6af7f1eeeca133be7f01`, `6af7f13928d6decb358a` — OK
- users `6af6d8696f50d78ada80` (omdasg11@gmail.com, founder) — OK

**10/10 OK.** (The local test run also passed 10/10 with a different random
sample before the remote run.)

## Users

Imported without passwords — none exist in the backup, and the D1 schema has
no password column. All 3 users have `google_sub = NULL`:

- omdasg11@gmail.com (founder), nihalaskar2727@gmail.com (student),
  ylaskar26@gmail.com (student)

They must re-authenticate via Google in Phase 5; first Google login matches
by verified email and attaches `google_sub`. Sessions were not migrated
(none exist in the backup).

## Retention decisions

- **visit_logs — NOT imported (1,147 rows).** Per-request analytics with raw
  IPs and user agents. The migration doc (Section 2) says never write to D1
  on every page view; importing the history would preserve a pattern the new
  stack must not continue. The table exists in D1 (empty) if the owner
  later decides otherwise. `site_metrics.visitor_count` (350) WAS imported
  as the aggregate counter.
- **syllabus — NOT imported (0 rows).** Superseded by `syllabus_table`.
  Table exists in D1, empty.
- **night_access_codes / night_access_blocks — NOT imported (0 rows).**
  Deprecated: the nightly closure they served was removed permanently
  2026-11-14. Tables exist in D1, empty, for fidelity only. Phase 6 should
  confirm deletion with the owner.
- All other 20 empty collections: 0 rows, nothing to import.

## Files — R2 key scheme and the mapping problem

**Scheme chosen: `papers/<original-backup-filename>`** (e.g.
`papers/1710134877_CHMHCC-502T-294_Physical-Chemistry-V_OddSem-2020-held2021.pdf`).
All 667 backup filenames are unique and URL-safe (no spaces, only
`[A-Za-z0-9_.-]`), including the 5 same-name collisions, which the backup
already disambiguated with the file ID appended.

**The file_id → filename mapping is broken for 617 of 636 papers.** The
backup saved files under their original upload names, not their Appwrite
file IDs. Only 19 filenames contain their paper's file_id (the 5 collision
files + 14 more whose original names already carried an ID suffix). For
those 19, `papers.file_key` is set in D1 (verified: 19 set, 617 NULL).
The other 617 papers keep `file_id` (legacy Appwrite reference) and
`file_key = NULL` until the mapping is recovered.

**What was ruled out before deciding this:**

- Content matching: only 8 of a 40-file sample have an extractable text
  layer (`pdftotext`); ~80% are image-only scans. Not viable.
- Reconstructing the mapping from download order: backup file mtimes do
  preserve download order and Appwrite file IDs embed creation timestamps,
  but the 19 provable anchors show the alignment is NOT exact (rank
  offsets vary 20–30, one anchor contradicts strict ordering — the 5
  collision files were downloaded last, and notes files interleave).
  Using it would silently attach wrong PDFs to papers. Not used.
- Reading Appwrite Storage to list file IDs: forbidden for this phase
  (old project at 95%+ reads; task says backup only).

**How the mapping can be recovered later:** one `listFiles` call against
the Appwrite `papers` bucket returns every file's `$id` + `name` (a metadata
list, not a per-file read). That gives the exact mapping; then update
`papers.file_key` (and optionally rename R2 keys to `papers/{fileId}.pdf`).
That needs the owner to approve the Appwrite read and costs a small number
of reads — do it only if the old project still has headroom, or after the
reads reset.

**R2 bucket state (checked live):** `examarchive-papers` exists and holds
exactly **1 pre-existing object**, `AU-FYUG-PHYDSC101T-2024.pdf` (425,560
bytes, 2026-01-18) — a leftover from the bucket's earlier use, not one of
the 667 backup files. After the upload it should hold 668 objects. The
upload script's `--verify` accounts for it.

**Local PDF verification (done):** all 667 backup files start with the
`%PDF-` header (0 bad). 5 random PDFs opened with `pdfinfo` and are valid:
`learnfo_botdsc201t_2025.pdf` (3 pp), `COMDSC351T_Unit_3_Notes.pdf`
(16 pp), `learnfo_iffdsm101t_2025.pdf` (3 pp),
`commerce_assam-university-bcom-fundamentals-of-investment-6sem-2023.pdf`
(5 pp), `learnfo_btcdsc251_2025.pdf` (4 pp) — none encrypted.

**Note:** 31 of the 667 files are orphan notes PDFs (e.g.
`PHYDSC353T_Unit_5_Notes.pdf`) with no paper row — the `papers` bucket
also served as the notes bucket. They are uploaded under the same scheme
(no paper references them); Phase 6 decides whether they stay.

## Blocked — needs the owner

1. **R2 upload: `wrangler login` + `wrangler` installed.** R2 has no
   direct upload endpoint in the Cloudflare API — uploads go through the
   S3-compatible API or wrangler, both needing login/a token. Run after
   login: `node scripts/upload-r2.mjs` (then `--verify` — expect 667
   uploaded + 1 pre-existing = 668 objects). Until then, `papers.file_key`
   only covers 19 papers, so paper PDF serving from R2 is not live yet.
2. **Paper → file remap for 617 papers** (see above): needs one Appwrite
   `listFiles` metadata read, owner-approved, or acceptance that
   `file_key` stays NULL and Phase 6 serves PDFs another way.

## Files added in this phase

- `scripts/import-d1.mjs` — backup JSON → D1 (local SQLite or remote via
  MCP), with migrations, chunked batches, count verification and 10-record
  spot-check. Re-runnable for local; remote re-runs will fail on the
  `legacy_appwrite_id` UNIQUE constraint (by design — no silent overwrite).
- `scripts/upload-r2.mjs` — backup PDFs → R2 (`--dry-run`, `--limit N`,
  `--skip-existing`, `--verify`). Blocked on wrangler login.
- `docs/cloudflare-migration/phase4-r2-manifest.json` — 667 keys, sizes,
  SHA-256 hashes (generated by the upload script's `--dry-run`).
- `docs/cloudflare-migration/phase4-data-migration.md` — this report.

## Not touched

No DNS change, no Appwrite data deleted or modified, no live-site change,
no push to `main`. Pre-existing uncommitted changes in the repo
(`src/app/page.tsx`, `src/components/layout/appSidebarItems.ts`,
`src/app/submit-paper/`) were not touched, stashed, or committed.
