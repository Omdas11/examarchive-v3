# Phase 1 — Inventory: ExamArchive Appwrite → Cloudflare

- **Date:** 2026-11-18
- **Branch:** `migrate/cloudflare`
- **Source of truth:** local backup `~/workspace/examarchive-backup/2026-11-17/` (project `6af69cb60001f52c7704`, database `examarchive`, backed up 2026-11-17 18:32 IST). No reads were made against Appwrite for this report.
- **Repo:** `~/workspace/examarchive/examarchive-v3`

## Headline numbers

| Item | Count / size |
|---|---:|
| Collections | 30 |
| Total documents | 4,400 (verified: sum of `documents` arrays in the backup JSON files = 4,400; matches manifest `total_documents`) |
| Collections with documents | 7 (23 collections are empty) |
| Storage buckets in backup | 1 (`papers`) |
| Files in `papers` bucket | 667, all PDFs |
| Total file size | 827,574,528 bytes = **789.2 MiB (0.77 GiB)** |
| Total JSON export size | 5,825,869 bytes = **5.6 MiB** |
| Total backup size | 797 MiB (du: 797M) |
| Appwrite-related env vars | 13 distinct |
| Files in `src/` importing `appwrite` / `node-appwrite` | 17 (15 source files + 2 test files) |
| Appwrite Functions in repo | 1 (`pdf-generator`) |

## Storage fit check — PASSES

- **R2 free tier = 10 GB.** Papers bucket = 0.77 GiB (789.2 MiB). Uses ~8% of the free tier. Largest single file 12.9 MiB; average 1,211.7 KiB; smallest 41.5 KiB; 6 files over 5 MiB, 1 over 10 MiB. All 667 files are PDFs (no other file types).
- **D1 free tier = 5 GB.** All 4,400 documents as JSON = 5.6 MiB. Even with indexes and the `syllabus_content` text (up to 1,000,000 chars per row), the database is orders of magnitude under 5 GB. Fits easily.
- **Caveat:** the backup only covers the `papers` bucket. The code also references other buckets (`syllabus-files`, `paper-markdown`, `cached-unit-notes`, `cached-solved-papers`) — see "Buckets" below. Their files were NOT in this backup, so their sizes are unknown and not included above.

## Buckets

Only one bucket was in the backup:

| Bucket | Files | Total size | Notes |
|---|---|---|---|
| `papers` | 667 | 827,574,528 bytes (789.2 MiB) | All PDFs. File names are the original upload names. |

**Same-name files:** 5 files in the `papers` bucket share a file name with another file. In the backup they are saved with their Appwrite file ID appended (e.g. `name_<fileId>.pdf`), so nothing overwrote anything. The 5 base names (per BACKUP-README.md):
- `1687772351_History-General_Early-Assam-upto-1228AD_2019.pdf`
- `1719391781_hs-2nd-year-2024-bengali-mil.pdf`
- `1718983590_1st-sem-2023.pdf`
- `1718980378_4th-sem-2023.pdf`
- `1718981750_4th-sem-2024.pdf`

Note: a filename-pattern scan also shows many other files with an Appwrite file ID suffix — those are files whose original uploaded name already contained the ID; only the 5 above are the documented same-name collisions.

**Other buckets referenced in code but NOT in this backup** (defaults in `src/lib/appwrite.ts` and `appwrite-functions/pdf-generator/index.js`):
- `syllabus-files` (`APPWRITE_SYLLABUS_BUCKET_ID`)
- `paper-markdown` (`APPWRITE_PAPER_MARKDOWN_BUCKET_ID`) — also used as the markdown cache, cached unit-notes, and cached solved-papers bucket via aliases
- `cached-unit-notes`, `cached-solved-papers` (env defaults inside pdf-generator; in the app they alias to `paper-markdown`)
- `NOTES_BUCKET_ID` in code = the `papers` bucket (`BUCKET_ID`)

Phase 4 must list these buckets live (or from a fuller backup) and measure them before assuming the R2 total. The `papers` bucket alone is only 0.77 GiB, so there is large headroom either way.

## Auth usage

The backup contains the `users` **collection** (profile rows), not the Appwrite Auth user list, so provider data comes from the code, not from a user export:

- **Profile rows in `users` collection: 3**
  - `omdasg11@gmail.com` — role `founder`, tier `bronze`, xp 0, ai_credits 100, Discord linked (`OM DAS`, in server). Created 2026-11-13.
  - `nihalaskar2727@gmail.com` — role `student`, tier `bronze`, xp 0, ai_credits 100, no Discord. Created 2026-11-14.
  - `ylaskar26@gmail.com` — role `student`, tier `bronze`, xp 0, ai_credits 100, no Discord. Created 2026-11-14.
- **Providers (from `src/app/auth/actions.ts`):** email/password (`account.createEmailPasswordSession`) AND Google OAuth (`OAuthProvider`, `signInWithGoogle`). No other OAuth provider appears in code.
- **MFA:** `src/app/auth/mfa-actions.ts` + `src/lib/mfa.ts` use Appwrite MFA (`Account`, `AuthenticationFactor`) via session client. MFA state lives in Appwrite Auth, not in any collection — it cannot be migrated from this backup and will need re-enrolment or a fresh design on Cloudflare.
- **Roles:** the `users` collection has `role` (required string; values seen: `founder`, `student`), plus `primary_role` / `secondary_role` / `tertiary_role` (all empty for all 3 users), and `tier` (all `bronze`). Role checks in code (`src/lib/roles.ts`, `isAdmin`) read the `users` collection row, not Appwrite labels/teams. No Appwrite Teams are used anywhere in the code I grepped.
- **Discord linking:** `discord_id` / `discord_username` / `discord_avatar` / `discord_in_server` stored on the user row (OAuth2 `identify` + `guilds`, separate from Appwrite auth).
- **Sessions:** Appwrite session cookies (`SESSION_COOKIE` in `src/lib/auth`). No session data in the backup — sessions cannot be migrated; all users will need to sign in again after cutover.
- **Passwords:** password hashes are not in the backup and are not portable. Per the migration doc, email/password users should sign in with Google after migration, matched by verified email.

## Appwrite Functions

**Exactly 1 function in the repo** (`appwrite-functions/pdf-generator/`):

| Function | Trigger | What it does |
|---|---|---|
| `pdf-generator` (`appwrite-functions/pdf-generator/index.js`, ~2,190 lines) | HTTP execution — called from `src/app/api/ai/generate-pdf/route.ts` via `functions.createExecution()` using `APPWRITE_PDF_GENERATOR_FUNCTION_ID`. No schedule, no event trigger in code. | AI notes/solved-paper generation: takes a job from `ai_generation_jobs`, calls Gemini (`GEMINI_MODEL_ID`, default `gemini-3.5-flash-lite`) with department prompt files (`prompts/*.md` for 13 subjects + `_core.md`), renders markdown to PDF HTML (KaTeX, marked, sanitize-html), writes output files to Storage buckets. Reads/writes `ai_generation_jobs`, `Syllabus_Table`, `Questions_Table`, `Generated_Notes_Cache`, and the `papers` / `paper-markdown` buckets. Env it needs: `GEMINI_API_KEY`, `DATABASE_ID`, `AI_JOBS_COLLECTION_ID`, `APPWRITE_BUCKET_ID`, `CACHED_UNIT_NOTES_BUCKET_ID`, `CACHED_SOLVED_PAPERS_BUCKET_ID`, plus Tavily/Gemini timeout settings. |

- **Important:** this function was **never copied to the new Appwrite project** (`6af69cb60001f52c7704`) — it exists only as source in this repo. There is no deployed copy to inspect; the repo source is the only record.
- No other functions exist: no `functions/` directory at repo root, no other entries under `appwrite-functions/`. `src/app/api/devtool/appwrite/route.ts` lists functions via `adminFunctions()` (devtool only).
- **Stale config flag:** `appwrite.config.json` at repo root still points at the OLD locked project `69a3e59300172d6a19cf`, not the new project. Do not trust it.
- There is also a local `src/lib/pdf-generator.ts` used by `src/app/api/syllabus/table/route.ts` — a separate in-app PDF path, not the Appwrite Function.

## Code imports of `appwrite` / `node-appwrite` (in `src/`)

17 import statements across 17 files (15 source files + 2 test files):

| File | Package | What it uses |
|---|---|---|
| `src/lib/appwrite.ts` | `node-appwrite` | Central server SDK setup. Imports `Client, Account, Databases, Storage, Users, Functions, ID, Query, Permission, Role` + `InputFile` from `node-appwrite/file`. Exports `createAdminClient()`, `createSessionClient()`, `adminDatabases()`, `adminStorage()`, `adminUsers()`, `adminAccount()`, `adminFunctions()`, `DATABASE_ID` (`examarchive`), `COLLECTION` (25 collections mapped), bucket IDs. Every other file goes through this file. |
| `src/lib/appwrite-client.ts` | `appwrite` | Browser/client SDK. Imports `Client, Storage, ID, Permission, Role`. Used for client-side uploads; reads `NEXT_PUBLIC_APPWRITE_*` vars and bucket IDs. |
| `src/lib/mfa.ts` | `node-appwrite` | Via `createAdminClient` / `createSessionClient` from `./appwrite` (no direct SDK import except through it — listed by grep because it imports from `./appwrite`; the direct `node-appwrite` import is in `mfa-actions.ts`). |
| `src/lib/credit-lock.ts` | `node-appwrite` | `AppwriteException` (error-type check) + `adminDatabases`, `COLLECTION`, `DATABASE_ID`. |
| `src/app/auth/actions.ts` | `node-appwrite` | `OAuthProvider` (Google sign-in), `createSessionClient`, email/password sessions. |
| `src/app/auth/mfa-actions.ts` | `node-appwrite` | `Account`, `AuthenticationFactor` (MFA). |
| `src/app/api/admin/users/route.ts` | `node-appwrite` | `AppwriteException` only (error handling). |
| `src/app/api/files/papers/[fileId]/route.ts` | `node-appwrite` | `AppwriteException`; serves paper PDFs from Storage (Turnstile + signed-download-token checks). |
| `src/app/api/files/notes/[fileId]/route.ts` | `node-appwrite` | `AppwriteException`; serves notes PDFs. |
| `src/app/api/files/syllabus/[fileId]/route.ts` | `node-appwrite` | `AppwriteException`; serves syllabus files. |
| `src/app/api/files/ingestion-question/[fileId]/route.ts` | `node-appwrite` | `AppwriteException`; serves ingestion assets via `adminStorage`. |
| `src/app/api/search/route.ts` | `node-appwrite` | `type Models` (type-only import). |
| `src/app/api/upload/notes/route.ts` | `node-appwrite` | `AppwriteException`. |
| `src/app/api/visitor/route.ts` | `node-appwrite` | `AppwriteException`; writes `visit_logs` + `site_metrics` (`singleton` doc). |
| `src/app/api/payments/razorpay/verify/route.ts` | `node-appwrite` | `AppwriteException`; writes via `adminDatabases` (`purchases`, `user_passes`). |
| `src/app/api/files/papers/[fileId]/route.test.ts` | `node-appwrite` | `AppwriteException` (test file). |
| `src/app/paper/[id]/metadata.test.ts` | `node-appwrite` | `type Models` (test file, type-only). |

Also in `scripts/` (not `src/`, noted for completeness, not counted above): `scripts/ensure-md-ingestion-bucket.test.js`, `scripts/hard-reset-ingestion.ts`, `scripts/soft-reset-data.ts`, `scripts/v2/sync-appwrite.ts` import appwrite SDKs. These are one-off/admin scripts, not the running site.

**Key point for Phase 6:** nearly all server code goes through `src/lib/appwrite.ts`. Replacing that one module's `adminDatabases` / `adminStorage` / `adminUsers` / `adminAccount` / `adminFunctions` with D1/R2 equivalents covers most call sites; the per-route `AppwriteException` imports are just error-type checks and drop away.

## Environment variables (Appwrite-related)

13 distinct Appwrite env vars appear in `src/` (`.env.example` lists 201 lines / 35 vars total, including non-Appwrite ones like Razorpay, Gemini, Turnstile, Discord — only the Appwrite ones are detailed here):

| Env var | Used in |
|---|---|
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | `src/lib/appwrite.ts`, `src/lib/appwrite-client.ts`, `src/app/auth/actions.ts`, `src/app/api/ai/generate-pdf/route.ts`, `src/app/api/health/route.ts`, `src/components/DebugPanel.tsx`, `src/lib/appwrite.test.ts` |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | Same 7 files as above |
| `APPWRITE_ENDPOINT` | `src/lib/appwrite.ts`, `src/lib/appwrite-client.ts`, `src/app/auth/actions.ts`, `src/app/api/ai/generate-pdf/route.ts`, `src/app/api/health/route.ts`, `src/app/api/upload/token/route.ts`, `src/components/DebugPanel.tsx`, `src/lib/appwrite.test.ts` |
| `APPWRITE_PROJECT_ID` | Same 8 files as `APPWRITE_ENDPOINT` |
| `APPWRITE_API_KEY` | `src/lib/appwrite.ts` (admin client), `src/app/api/ai/generate-pdf/route.ts`, `src/app/api/visitor/route.ts`, `src/lib/appwrite.test.ts` |
| `APPWRITE_BUCKET_ID` | `src/lib/appwrite.ts`, `src/lib/appwrite-client.ts` (default `papers`) |
| `APPWRITE_SYLLABUS_BUCKET_ID` | `src/lib/appwrite.ts`, `src/lib/appwrite-client.ts` (default `syllabus-files`) |
| `APPWRITE_PAPER_MARKDOWN_BUCKET_ID` | `src/lib/appwrite.ts` only (default `paper-markdown`) |
| `APPWRITE_PDF_GENERATOR_FUNCTION_ID` | `src/app/api/ai/generate-pdf/route.ts` only |
| `NEXT_PUBLIC_APPWRITE_BUCKET_ID` | `src/lib/appwrite-client.ts` only |
| `NEXT_PUBLIC_APPWRITE_NOTES_BUCKET_ID` | `src/lib/appwrite-client.ts` only |
| `NEXT_PUBLIC_APPWRITE_SYLLABUS_BUCKET_ID` | `src/lib/appwrite-client.ts` only |
| `APPWRITE_DOC_ID_HASH_LENGTH` | `src/app/api/ai/generate-pdf/route.ts` only |

Notes:
- `DATABASE_ID` is **hardcoded** as `"examarchive"` in `src/lib/appwrite.ts`, not an env var (the pdf-generator function reads it from env with the same default).
- `APPWRITE_ENDPOINT` / `APPWRITE_PROJECT_ID` (server) duplicate the `NEXT_PUBLIC_` versions; both spellings are read in `appwrite.ts`.
- No secret values are printed in this report.

## Collections — detail

Counts are from `manifest.json` and verified against the `documents` array length in each backup JSON file (they agree, except `visit_logs`: manifest total 1,146, file contains 1,147 — one visit was logged during the backup, per BACKUP-README.md). Attribute lists are from `schema.json`. All 30 collections have `documentSecurity: false` and an empty collection-level permissions list — i.e. no collection-level permissions are set in the schema export; access control lives in code (server API key) and per-document `$permissions` (see "will not map cleanly" below).

Summary table (detail follows):

| Collection | Docs | Attrs | Indexes |
|---|---:|---:|---:|
| Syllabus_Table | 2,585 | 30 | 0 |
| visit_logs | 1,147 | 8 | 0 |
| papers | 636 | 23 | 0 |
| syllabus_stats | 25 | 3 | 1 |
| user_activity | 3 | 6 | 1 |
| users | 3 | 23 | 0 |
| site_metrics | 1 | 2 | 0 |
| Generated_Notes_Cache | 0 | 16 | 0 |
| Questions_Table | 0 | 32 | 0 |
| User_Quotas | 0 | 4 | 0 |
| achievements | 0 | 5 | 0 |
| activity_logs | 0 | 8 | 0 |
| ai_admin_reports | 0 | 4 | 0 |
| ai_cache_index | 0 | 5 | 0 |
| ai_embeddings | 0 | 11 | 0 |
| ai_flashcards | 0 | 5 | 0 |
| ai_generation_jobs | 0 | 12 | 0 |
| ai_ingestions | 0 | 15 | 0 |
| ai_syllabus_maps | 0 | 8 | 0 |
| ai_usage | 0 | 2 | 0 |
| content_verifications | 0 | 8 | 0 |
| feedback | 0 | 4 | 0 |
| night_access_blocks | 0 | 5 | 0 |
| night_access_codes | 0 | 7 | 0 |
| pdf_usage | 0 | 2 | 0 |
| purchases | 0 | 7 | 0 |
| syllabus | 0 | 13 | 0 |
| uploads | 0 | 4 | 0 |
| user_badges | 0 | 3 | 0 |
| user_passes | 0 | 10 | 0 |
| **Total** | **4,400** | **285** | **2** |

### papers — 636 docs — 23 attributes, 0 indexes
Permissions: collection-level none (empty list); documentSecurity: False.
- `course_code`: string, required size=512
- `paper_name`: string, optional size=512
- `year`: integer, required
- `semester`: string, optional size=512
- `department`: string, optional size=512
- `programme`: string, optional size=512
- `exam_type`: string, optional size=512
- `institute`: string, optional size=512
- `institution`: string, optional size=512
- `stream`: string, optional size=512
- `paper_type`: string, optional size=512
- `marks`: integer, optional
- `duration`: integer, optional
- `file_id`: string, optional size=512
- `file_url`: string, required size=512
- `uploaded_by`: string, optional size=512
- `uploaded_by_username`: string, optional size=512
- `approved`: boolean, required
- `status`: string, optional size=512
- `view_count`: integer, optional
- `download_count`: integer, optional
- `source_name`: string, optional size=50
- `source_url`: string, optional size=512
- Indexes: none

### syllabus — 0 docs — 13 attributes, 0 indexes
Permissions: collection-level none (empty list); documentSecurity: False.
- `university`: string, optional size=512
- `subject`: string, optional size=512
- `department`: string, optional size=512
- `semester`: string, optional size=512
- `programme`: string, optional size=512
- `year`: integer, optional
- `uploader_id`: string, optional size=512
- `approval_status`: string, optional size=512
- `file_url`: string, optional size=512
- `uploaded_by_username`: string, optional size=512
- `course_code`: string, optional size=512
- `course_name`: string, optional size=512
- `is_hidden`: boolean, optional
- Indexes: none

### users — 3 docs — 22 attributes, 0 indexes
Permissions: collection-level none (empty list); documentSecurity: False.
- `email`: string, required size=512
- `role`: string, required size=512
- `primary_role`: string, optional size=512
- `secondary_role`: string, optional size=512
- `tertiary_role`: string, optional size=512
- `tier`: string, optional size=512
- `display_name`: string, optional size=512
- `username`: string, optional size=512
- `xp`: integer, optional
- `streak_days`: integer, optional
- `avatar_url`: string, optional size=512
- `last_activity`: datetime, optional
- `upload_count`: integer, optional
- `username_last_changed`: string, optional size=512
- `referral_code`: string, optional size=6
- `ai_credits`: integer, optional
- `referred_by`: string, optional size=512
- `referral_path`: string[], optional size=512
- `discord_id`: string, optional size=255
- `discord_username`: string, optional size=255
- `discord_avatar`: string, optional size=255
- `discord_in_server`: boolean, optional default=False
- Indexes: none

### uploads — 0 docs — 4 attributes, 0 indexes
Permissions: collection-level none (empty list); documentSecurity: False.
- `user_id`: string, required size=512
- `file_id`: string, required size=512
- `file_name`: string, required size=512
- `status`: string, required size=512
- Indexes: none

### activity_logs — 0 docs — 8 attributes, 0 indexes
Permissions: collection-level none (empty list); documentSecurity: False.
- `action`: string, required size=512
- `target_user_id`: string, optional size=512
- `target_paper_id`: string, optional size=512
- `admin_id`: string, optional size=512
- `admin_email`: string, optional size=512
- `details`: string, optional size=512
- `user_id`: string, required size=512
- `meta`: string, required size=512
- Indexes: none

### achievements — 0 docs — 5 attributes, 0 indexes
Permissions: collection-level none (empty list); documentSecurity: False.
- `user_id`: string, required size=512
- `slug`: string, required size=512
- `label`: string, required size=512
- `description`: string, optional size=512
- `earned_at`: datetime, required
- Indexes: none

### site_metrics — 1 docs — 2 attributes, 0 indexes
Permissions: collection-level none (empty list); documentSecurity: False.
- `visitor_count`: integer, required
- `launch_progress`: integer, optional
- Indexes: none

### feedback — 0 docs — 4 attributes, 0 indexes
Permissions: collection-level none (empty list); documentSecurity: False.
- `name`: string, required size=512
- `university`: string, optional size=512
- `text`: string, required size=512
- `approved`: boolean, required
- Indexes: none

### ai_usage — 0 docs — 2 attributes, 0 indexes
Permissions: collection-level none (empty list); documentSecurity: False.
- `user_id`: string, required size=512
- `date`: string, required size=512
- Indexes: none

### ai_generation_jobs — 0 docs — 12 attributes, 0 indexes
Permissions: collection-level none (empty list); documentSecurity: False.
- `user_id`: string, required size=512
- `paper_code`: string, required size=512
- `unit_number`: integer, required
- `status`: string, required size=512
- `progress_percent`: integer, optional
- `input_payload_json`: string, required size=512
- `result_file_id`: string, optional size=512
- `error_message`: string, optional size=512
- `started_at`: datetime, optional
- `completed_at`: datetime, optional
- `idempotency_key`: string, required size=512
- `created_at`: datetime, required
- Indexes: none

### ai_embeddings — 0 docs — 11 attributes, 0 indexes
Permissions: collection-level none (empty list); documentSecurity: False.
- `file_id`: string, required size=512
- `source_type`: string, required size=512
- `source_label`: string, required size=512
- `course_code`: string, optional size=512
- `department`: string, optional size=512
- `year`: integer, optional
- `uploaded_by`: string, optional size=512
- `embedding_model`: string, required size=512
- `chunk_index`: integer, required
- `text_chunk`: string, required size=512
- `embedding`: double[], required
- Indexes: none

### pdf_usage — 0 docs — 2 attributes, 0 indexes
Permissions: collection-level none (empty list); documentSecurity: False.
- `user_id`: string, required size=512
- `date`: string, required size=512
- Indexes: none

### ai_ingestions — 0 docs — 15 attributes, 0 indexes
Permissions: collection-level none (empty list); documentSecurity: False.
- `entry_type`: string, optional size=32
- `paper_code`: string, optional size=256
- `source_label`: string, optional size=256
- `file_id`: string, optional size=64
- `file_url`: string, optional size=2048
- `status`: string, optional size=32
- `model`: string, optional size=64
- `characters_ingested`: integer, optional
- `digest`: string, optional size=8192
- `paper_name`: string, optional size=255
- `ingested_at`: datetime, optional
- `row_count`: integer, optional
- `error_summary`: string, optional size=2000
- `subject`: string, optional size=128
- `dept_code`: string, optional size=16
- Indexes: none

### ai_syllabus_maps — 0 docs — 8 attributes, 0 indexes
Permissions: collection-level none (empty list); documentSecurity: False.
- `university`: string, optional size=256
- `college`: string, optional size=256
- `program`: string, optional size=128
- `semester`: string, optional size=32
- `checksum`: string, optional size=128
- `modules_json`: string, optional size=10000
- `model`: string, optional size=64
- `source_syllabus_id`: string, optional size=64
- Indexes: none

### ai_flashcards — 0 docs — 5 attributes, 0 indexes
Permissions: collection-level none (empty list); documentSecurity: False.
- `userId`: string, optional size=64
- `source_paper_id`: string, optional size=64
- `payload`: string, optional size=10000
- `model`: string, optional size=64
- `tags`: string[], optional size=128
- Indexes: none

### ai_admin_reports — 0 docs — 4 attributes, 0 indexes
Permissions: collection-level none (empty list); documentSecurity: False.
- `run_at`: datetime, optional
- `summary`: string, optional size=10000
- `model`: string, optional size=64
- `risks_json`: string, optional size=5000
- Indexes: none

### Syllabus_Table — 2585 docs — 30 attributes, 0 indexes
Permissions: collection-level none (empty list); documentSecurity: False.
- `entry_type`: string, optional size=32
- `entry_id`: string, optional size=128
- `college`: string, optional size=256
- `university`: string, required size=256
- `course`: string, required size=64
- `stream`: string, required size=64
- `group`: string, optional size=256
- `session`: string, optional size=64
- `year`: integer, optional
- `type`: string, required size=32
- `paper_code`: string, required size=128
- `paper_name`: string, optional size=255
- `subject`: string, optional size=256
- `semester_code`: string, optional size=16
- `semester_no`: integer, optional
- `semester`: integer, optional
- `credits`: integer, optional
- `marks_total`: integer, optional
- `syllabus_pdf_url`: string, optional size=2048
- `source_reference`: string, optional size=512
- `status`: string, optional size=64
- `aliases`: string[], optional size=256
- `keywords`: string[], optional size=128
- `notes`: string, optional size=8192
- `version`: integer, optional
- `last_updated`: string, optional size=32
- `unit_number`: integer, required
- `syllabus_content`: string, required size=1000000
- `lectures`: integer, optional
- `tags`: string[], optional size=128
- Indexes: none

### Questions_Table — 0 docs — 31 attributes, 0 indexes
Permissions: collection-level none (empty list); documentSecurity: False.
- `entry_type`: string, optional size=32
- `question_id`: string, optional size=128
- `college`: string, optional size=256
- `university`: string, required size=256
- `course`: string, required size=64
- `stream`: string, required size=64
- `group`: string, optional size=256
- `type`: string, required size=32
- `paper_code`: string, required size=128
- `paper_name`: string, optional size=256
- `subject`: string, optional size=256
- `exam_year`: integer, optional
- `exam_session`: string, optional size=64
- `exam_month`: string, optional size=32
- `attempt_type`: string, optional size=32
- `semester_code`: string, optional size=16
- `semester_no`: integer, optional
- `question_pdf_url`: string, optional size=2048
- `source_reference`: string, optional size=512
- `status`: string, optional size=64
- `question_no`: string, optional size=32
- `question_subpart`: string, optional size=32
- `year`: integer, optional
- `question_content`: string, required size=1000000
- `marks`: integer, optional
- `tags`: string[], optional size=128
- `linked_syllabus_entry_id`: string, optional size=128
- `link_status`: string, optional size=32
- `ocr_text_path`: string, optional size=512
- `ai_summary_status`: string, optional size=32
- `difficulty_estimate`: string, optional size=32
- Indexes: none

### Generated_Notes_Cache — 0 docs — 17 attributes, 0 indexes
Permissions: collection-level none (empty list); documentSecurity: False.
- `university`: string, optional size=256
- `course`: string, optional size=64
- `stream`: string, optional size=64
- `selection_type`: string, optional size=32
- `paper_code`: string, required size=128
- `type`: string, required size=50
- `year`: string, optional size=10
- `semester`: string, optional size=10
- `unit_number`: integer, required
- `part_number`: integer, optional
- `markdown_file_id`: string, required size=100
- `generated_markdown`: string, optional size=1000000
- `syllabus_content`: string, optional size=1000000
- `pdf_file_id`: string, optional size=100
- `created_at`: datetime, required
- `status`: string, required size=50
- `last_processed_index`: integer, optional
- Indexes: none

### User_Quotas — 0 docs — 4 attributes, 0 indexes
Permissions: collection-level none (empty list); documentSecurity: False.
- `user_id`: string, required size=64
- `notes_generated_today`: integer, required
- `papers_solved_today`: integer, required
- `last_generation_date`: string, required size=10
- Indexes: none

### night_access_codes — 0 docs — 7 attributes, 0 indexes
Permissions: collection-level none (empty list); documentSecurity: False.
- `code`: string, required size=256
- `note`: string, optional size=512
- `expiresAt`: datetime, optional
- `maxUses`: integer, optional
- `usedCount`: integer, optional
- `createdBy`: string, optional size=256
- `createdAt`: datetime, optional
- Indexes: none

### night_access_blocks — 0 docs — 5 attributes, 0 indexes
Permissions: collection-level none (empty list); documentSecurity: False.
- `ip`: string, required size=256
- `failedAttempts`: integer, optional
- `blocked`: boolean, optional
- `blockedAt`: datetime, optional
- `lastAttemptAt`: datetime, optional
- Indexes: none

### visit_logs — 1146 docs (exported 1147) — 8 attributes, 0 indexes
Permissions: collection-level none (empty list); documentSecurity: False.
- `ip`: string, optional size=256
- `path`: string, optional size=512
- `user_agent`: string, optional size=1024
- `referrer`: string, optional size=1024
- `country`: string, optional size=128
- `city`: string, optional size=256
- `user_id`: string, optional size=256
- `user_role`: string, optional size=128
- Indexes: none

### content_verifications — 0 docs — 8 attributes, 0 indexes
Permissions: collection-level none (empty list); documentSecurity: False.
- `user_id`: string, required size=256
- `content_type`: string, optional size=128
- `content_id`: string, optional size=256
- `verdict`: string, optional size=128
- `correction`: string, optional size=8192
- `xp_awarded`: integer, optional
- `credits_awarded`: integer, optional
- `status`: string, optional size=128
- Indexes: none

### user_passes — 0 docs — 11 attributes, 0 indexes
Permissions: collection-level none (empty list); documentSecurity: False.
- `user_id`: string, required size=256
- `pass_id`: string, optional size=256
- `mode`: string, optional size=128
- `status`: string, optional size=128
- `daily_credits`: integer, optional
- `days_remaining`: integer, optional
- `last_daily_claim_at`: datetime, optional
- `activated_at`: datetime, optional
- `expires_at`: datetime, optional
- `razorpay_subscription_id`: string, optional size=256
- `razorpay_order_id`: string, optional size=256
- Indexes: none

### purchases — 0 docs — 7 attributes, 0 indexes
Permissions: collection-level none (empty list); documentSecurity: False.
- `user_id`: string, optional size=256
- `amount`: integer, optional
- `currency`: string, optional size=32
- `status`: string, optional size=128
- `razorpay_order_id`: string, optional size=256
- `razorpay_payment_id`: string, optional size=256
- `created_at`: datetime, optional
- Indexes: none

### ai_cache_index — 0 docs — 5 attributes, 0 indexes
Permissions: collection-level none (empty list); documentSecurity: False.
- `cache_key`: string, required size=512
- `paper_code`: string, optional size=256
- `type`: string, optional size=128
- `file_id`: string, optional size=256
- `created_at`: datetime, optional
- Indexes: none

### user_badges — 0 docs — 3 attributes, 0 indexes
Permissions: collection-level none (empty list); documentSecurity: False.
- `user_id`: string, required size=256
- `badge_slug`: string, optional size=256
- `earned_at`: datetime, optional
- Indexes: none

### syllabus_stats — 25 docs — 3 attributes, 1 indexes
Permissions: collection-level none (empty list); documentSecurity: False.
- `paper_code`: string, required size=32
- `view_count`: integer, optional default=0
- `download_count`: integer, optional default=0
- Index `idx_paper_code`: type key, attributes: paper_code

### user_activity — 3 docs — 6 attributes, 1 indexes
Permissions: collection-level none (empty list); documentSecurity: False.
- `user_id`: string, required size=64
- `action`: string, required size=16
- `scope`: string, required size=16
- `title`: string, required size=255
- `href`: string, required size=255
- `paper_ref`: string, required size=64
- Index `idx_user_action`: type key, attributes: user_id, action

## Will NOT map cleanly to D1 / SQLite — flags for Phase 3

1. **No relationships in the schema.** Zero `relationship` attributes exist in any collection. All links are plain string IDs (`user_id`, `paper_ref`, `file_id`, `source_syllabus_id`, `linked_syllabus_entry_id`, `referred_by`). Good news: nothing to untangle — but Phase 3 must decide the foreign keys itself; there is no declared referential integrity to copy, and orphaned references are possible (e.g. `papers.uploaded_by` is often an empty string).
2. **Array attributes (7).** SQLite has no array type; store as JSON text or a child table:
   - `users.referral_path` (string[])
   - `ai_embeddings.embedding` (double[]) — a vector; if embeddings are ever used, this needs a real vector store or a blob, not a plain D1 column
   - `ai_flashcards.tags`, `Syllabus_Table.aliases`, `Syllabus_Table.keywords`, `Syllabus_Table.tags`, `Questions_Table.tags` (string[])
3. **Very large text fields.** `Syllabus_Table.syllabus_content` and `Questions_Table.question_content` are strings up to 1,000,000 chars; `Generated_Notes_Cache.generated_markdown` / `syllabus_content` also up to 1,000,000; `ai_syllabus_maps.modules_json` up to 10,000; `ai_flashcards.payload` up to 10,000; `ai_ingestions.digest` up to 8,192; `content_verifications.correction` up to 8,192. SQLite TEXT handles these, but D1 rows read are billed — fetching a 1 MB `syllabus_content` on every list query would be expensive. Phase 3 should keep big text out of list queries (select only needed columns).
4. **Per-document permissions.** Collection-level permissions are empty everywhere, but individual documents carry `$permissions` — e.g. each `users` row has `read("user:<id>")` + `update("user:<id>")` for its own owner. D1 has no per-row permissions; access control must move into app code (check `users.role` / ownership server-side on every request).
5. **Appwrite system fields on every document.** `$id`, `$createdAt`, `$updatedAt`, `$sequence`, `$collectionId`, `$databaseId`, `$permissions` exist on all rows. `$sequence` is an Appwrite-internal ordering number with no D1 equivalent — keep `$id` as `legacy_appwrite_id` (migration doc Phase 3) and use `created_at`/`updated_at` as plain integer timestamps.
6. **Auth is not in the backup.** No password hashes, no OAuth identities, no sessions, no MFA enrolments. All 3 users must re-authenticate after cutover; email/password users need the Google-match-by-email path (migration doc Phase 4/5). MFA enrolments will be lost unless re-done.
7. **Counters written on every view/download.** `papers.view_count` / `download_count`, `syllabus_stats.view_count` / `download_count`, `site_metrics.visitor_count`, and the `visit_logs` collection (1,147 rows and growing) are write-on-read patterns. The migration doc already says: never write to D1 on every page view. These need a redesign (batched/aggregated counters or KV), not a straight copy. `visit_logs` also stores raw IPs and user agents — decide retention before migrating; it may not need to move at all.
8. **Only 2 indexes in the whole schema** (`syllabus_stats.idx_paper_code`, `user_activity.idx_user_action`). The other 28 collections have none — including `papers` (636 docs, queried by department/year/course_code) and `Syllabus_Table` (2,585 docs, queried by paper_code/semester). Phase 3 must add indexes for every hot `WHERE`/`ORDER BY`, or D1 will bill full-table scans.
9. **Duplicate / overlapping fields.** `papers` has both `institute` and `institution` (both usually "Assam University"); `Syllabus_Table` has both `semester_no` (integer) and `semester` (integer) plus `semester_code` (string); `users` has `role` plus `primary_role`/`secondary_role`/`tertiary_role` (all empty). Phase 3 should pick one canonical field for each.
10. **Inconsistent types for the same idea.** `Syllabus_Table.semester` is integer but `syllabus.semester` and `papers.semester` are strings; `Generated_Notes_Cache.year`/`semester` are strings while `Syllabus_Table.year` is integer. `users.username_last_changed` is a string, not a datetime. Normalise in Phase 3.
11. **JSON-in-a-string fields.** `ai_generation_jobs.input_payload_json`, `ai_syllabus_maps.modules_json`, `ai_admin_reports.risks_json`, `activity_logs.meta` (required string) store JSON as text. Keep as TEXT in D1, parse in code.
12. **The `syllabus` collection is empty (0 docs) and largely superseded** by `Syllabus_Table` (2,585 docs). Likewise 23 of 30 collections are empty — Phase 3 can create tables for the empty ones only if the code actually uses them; several (e.g. `ai_*`, `night_access_*`) belong to disabled/removed features (night closure was removed 2026-11-14; the AI routes were partly deleted). Confirm with the owner which empty collections are still needed before building tables for all 30.
13. **Buckets beyond `papers` were not backed up.** `syllabus-files`, `paper-markdown`, `cached-unit-notes`, `cached-solved-papers` file counts/sizes are unknown. Phase 4 must inventory them before sizing R2.
14. **`pdf-generator` is not a straight port.** It is a ~2,190-line Node function using Gemini + KaTeX + Puppeteer-style HTML→PDF rendering. On Workers it becomes a Worker route or cron; check whether its dependencies (KaTeX, marked, sanitize-html) run under Workers, and note the Gemini API key becomes a Worker secret. Its job queue (`ai_generation_jobs`) is currently an empty collection, so there is no queued work to migrate — only the code.
15. **Attribute type counts (all 285 attributes):** string 216, integer 45, datetime 18, boolean 5, double 1. No enum, url, email, IP, or relationship types are used — every typed value is one of the five basic types, which maps cleanly to SQLite (TEXT / INTEGER / REAL).

## Sources

- Backup: `~/workspace/examarchive-backup/2026-11-17/` — `schema.json` (30 collections, 285 attributes), `manifest.json` (counts), `BACKUP-README.md`, per-collection `<id>.json` files, `files/papers/` (667 PDFs).
- Repo: `~/workspace/examarchive/examarchive-v3` — `src/lib/appwrite.ts`, `src/lib/appwrite-client.ts`, `src/app/auth/actions.ts`, `src/app/auth/mfa-actions.ts`, `appwrite-functions/pdf-generator/`, `appwrite.config.json`, `.env.example`.
- No Appwrite API calls were made for this report. No DNS, live site, or Appwrite data was touched. No secrets are included in this report.
