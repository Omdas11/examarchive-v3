# SYLLABUS SCHEMA — IMPLEMENTATION CHANGELOG

> All improvements listed below have been **implemented** in the Appwrite automation scripts.
> Run `Appwrite Schema Sync` and `Appwrite AI Sync` (both support manual dispatch from
> GitHub Actions → mobile) to apply them to the live Appwrite backend.

---

## Applied Changes

### 1. `paper_name` added to `Syllabus_Table` ✅

**Script:** `scripts/sync-appwrite-schema.js` → `TARGET_SCHEMA`  
**Ingestion:** `src/app/api/admin/ingest-md/route.ts` — `upsertSyllabusRows` now writes `paper_name` from YAML frontmatter  
**Why:** The Syllabus Tracker page can now display paper names directly from `Syllabus_Table` without cross-joining `Questions_Table`.

### 2. `semester` (Integer 1–8) added to `Syllabus_Table` ✅

**Script:** `scripts/sync-appwrite-schema.js` → `TARGET_SCHEMA`  
**Ingestion:** `src/app/api/admin/ingest-md/route.ts` — `deriveSemesterFromCode()` extracts the semester from the paper code pattern `[DEPT][TYPE][semN]...` and stores it  
**Why:** Enables direct range queries (`semester = 3`) without string parsing.

### 3. New fields added to `ai_ingestions` ✅

**Script:** `scripts/sync-appwrite-ai.js` → `AI_COLLECTIONS`  
**Hard-reset sync:** `scripts/hard-reset-ingestion.ts` → `INGESTION_ATTRIBUTES`  
**Ingestion:** `src/app/api/admin/ingest-md/route.ts` → `createIngestionLog` writes all new fields

| New Field | Type | Purpose |
|---|---|---|
| `paper_name` | String(255) | Human-readable name — avoids cross-join for mobile dashboard |
| `ingested_at` | Datetime | Explicit ISO-8601 timestamp (distinct from `$createdAt`) |
| `row_count` | Integer | Total syllabus + question rows written in the run |
| `error_summary` | String(2000) | Comma-joined parse errors for quick mobile triage |
| `subject` | String(128) | Subject / department name (e.g., `Physics`) |
| `dept_code` | String(16) | 3-letter dept code (e.g., `PHY`) for departmental filters |

### 4. `DATABASE_SCHEMA.md` updated ✅

`DATABASE_SCHEMA.md` now reflects all new fields in both `Syllabus_Table` and `ai_ingestions` so the auto-generated schema sync status block stays accurate.

### 5. Workflows updated for mobile-friendly dispatch ✅

Both `appwrite-schema-sync.yml` and `appwrite-ai-sync.yml` now include a `workflow_dispatch` input (`force_sync: true/false`) that can be triggered from the **GitHub Actions UI on mobile**.  
Auto-triggers remain on pushes to `main` that touch relevant script files.  
`appwrite-ai-sync.yml` now also watches `scripts/hard-reset-ingestion.ts` for changes.

---

## How to Apply (from mobile)

1. Open the repository on GitHub.
2. Navigate to **Actions → Appwrite Schema Sync** → **Run workflow** → select `force_sync=false` → **Run**.
3. Once complete, run **Actions → Appwrite AI Sync** → **Run workflow** → **Run**.

Both workflows complete in ~2 minutes and print per-attribute status to the log.

---

## Remaining Improvements (not yet automated)

The items below require data migration or manual Appwrite configuration and are left as follow-up work:

| # | Item | Effort |
|---|------|--------|
| 6 | Unique index on `ai_ingestions.paper_code` | Medium — needs document `$id = paper_code` migration |
| 7 | Pre-populate `ai_ingestions` as a to-do registry from `curriculum.json` | Medium — one-time seed script |
| 8 | Compound index `[university, course, stream, type, paper_code]` on `Syllabus_Table` | Low — Appwrite Console or script |
| 9 | Regex validator on `paper_code` attribute | Low — Appwrite Console |
