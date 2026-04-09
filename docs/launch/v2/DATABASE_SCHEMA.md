# Database Schema — ExamArchive v3

**Database ID:** `examarchive`

All collections live inside this single Appwrite database.

---

## Collection: `papers`

Stores exam question paper metadata. Files are held in the `papers` Appwrite Storage bucket (restricted to authenticated users via `read("users")` permission).

| Field                 | Type    | Required | Notes                                                                                                         |
|-----------------------|---------|----------|---------------------------------------------------------------------------------------------------------------|
| `course_code`         | String  | **Yes**  | Paper code (e.g. `PHYDSC101T`); primary lookup key                                                            |
| `paper_name`          | String  | No       | Human-readable paper title; auto-resolved from syllabus registry                                             |
| `year`                | Integer | **Yes**  | Exam year (e.g. 2024)                                                                                         |
| `semester`            | String  | No       | Ordinal string (e.g. `"1st"`); auto-resolved from registry                                                    |
| `department`          | String  | No       | Disciplinary subject (e.g. `"Physics"`)                                                                       |
| `programme`           | String  | No       | Academic framework (e.g. `"FYUGP"`, `"CBCS"`)                                                                 |
| `exam_type`           | String  | No       | `"Theory"` or `"Practical"`; derived from paper code suffix T/P                                               |
| `institute`           | String  | No       | Primary institution field; used by the UI for university counts                                               |
| `institution`         | String  | No       | Legacy alias for `institute` (older documents). Also accepts `university` as fallback in code.                |
| `stream`              | String  | No       | Academic stream / branch                                                                                      |
| `paper_type`          | String  | No       | Category: `DSC` / `DSM` / `SEC` / `IDC` / `GE` (FYUGP) or `CC` / `DSC` / `DSE` / `GEC` / `SEC` (CBCS)          |
| `marks`               | Integer | No       | Total marks                                                                                                   |
| `duration`            | Integer | No       | Exam duration in minutes                                                                                      |
| `file_id`             | String  | No       | Appwrite Storage file ID; used to locate the PDF                                                              |
| `file_url`            | String  | **Yes**  | Next.js proxy URL (`/api/files/papers/{fileId}`)                                                              |
| `uploaded_by`         | String  | No       | Appwrite user ID of the uploader                                                                              |
| `uploaded_by_username`| String  | No       | Denormalised username for display                                                                             |
| `approved`            | Boolean | **Yes**  | `false` until admin approves; drives all browse queries                                                       |
| `status`              | String  | No       | `"pending"` on upload, `"approved"` after admin approval                                                      |
| `view_count`          | Integer | No       | Incremented when a paper is viewed (used for popular list)                                                    |
| `download_count`      | Integer | No       | Incremented when a paper is downloaded                                                                        |

**Upload sets:** `approved = false`, `status = "pending"`.  
**Approval sets:** `approved = true`, `status = "approved"`.

---

## Collection: `syllabus`

Stores syllabus document metadata. Files are held in the `syllabus-files` bucket (restricted to authenticated users).

| Field                  | Type    | Required | Notes                                               |
|------------------------|---------|----------|-----------------------------------------------------|
| `university`           | String  | No       | University name                                     |
| `subject`              | String  | No       | Full paper name, resolved from syllabus registry    |
| `department`           | String  | No       | Disciplinary subject (e.g. `"Physics"`)             |
| `semester`             | String  | No       | Ordinal string; empty string `""` for departmental syllabi |
| `programme`            | String  | No       | `"FYUGP"` or `"CBCS"`; auto-resolved from registry |
| `year`                 | Integer | No       | Year the syllabus is applicable                     |
| `uploader_id`          | String  | No       | Appwrite user ID of the uploader                    |
| `approval_status`      | String  | No       | `"pending"` \| `"approved"` \| `"rejected"`         |
| `file_url`             | String  | No       | Next.js proxy URL (`/api/files/syllabus/{fileId}`)  |
| `uploaded_by_username` | String  | No       | Denormalised username for display                   |
| `course_code`          | String  | No       | Legacy alias when a syllabus maps to a course       |
| `course_name`          | String  | No       | Legacy alias for subject                            |
| `is_hidden`            | Boolean | No       | Admin soft-hide flag (default: `false`)             |

---

## Collection: `users`

Stores user profile data alongside Appwrite Auth accounts.

| Field                    | Type     | Required | Notes                                                                                                 |
|--------------------------|----------|----------|-------------------------------------------------------------------------------------------------------|
| `email`                  | String   | **Yes**  | User email address                                                                                    |
| `role`                   | String   | **Yes**  | Primary role: `visitor` / `explorer` / `contributor` / `verified_contributor` / `moderator` / `maintainer` / `admin` / `founder` |
| `primary_role`           | String   | No       | Legacy alias for `role` (kept for backwards compatibility)                                            |
| `secondary_role`         | String   | No       | Cosmetic community role (display-only)                                                                |
| `tertiary_role`          | String   | No       | Additional cosmetic community role                                                                    |
| `tier`                   | String   | No       | Activity tier: `bronze` / `silver` / `gold` / `platinum` / `diamond`                                  |
| `display_name`           | String   | No       | User's display name                                                                                   |
| `username`               | String   | No       | Unique @username                                                                                      |
| `xp`                     | Integer  | No       | Experience points                                                                                     |
| `streak_days`            | Integer  | No       | Current daily streak; legacy name `streak` is accepted                                                |
| `avatar_url`             | String   | No       | URL of user's avatar image                                                                            |
| `avatar_file_id`         | String   | No       | Appwrite file ID in the avatars bucket                                                                |
| `last_activity`          | Datetime | No       | ISO 8601 timestamp of last activity                                                                   |
| `upload_count`           | Integer  | No       | Total approved uploads; drives auto-promotion                                                         |
| `username_last_changed`  | String   | No       | ISO 8601 timestamp of last username change; enforces 7-day cooldown                                   |
| `referral_code`          | String   | No       | Unique 6-character alphanumeric code (uppercase) used for invite/referral links (requires unique index) |
| `ai_credits`             | Integer  | No       | Spendable credits for AI features                                                                       |
| `referred_by`            | String   | No       | Direct referrer user ID                                                                                 |
| `referral_path`          | Array (string) | No | Ordered ancestor user IDs (max depth 5) for multi-level referral rewards                               |

---

## Collection: `uploads`

Audit trail of all file uploads, independent of approval status.

| Field       | Type   | Required | Notes                                       |
|-------------|--------|----------|---------------------------------------------|
| `user_id`   | String | **Yes**  | Appwrite user ID of the uploader            |
| `file_id`   | String | **Yes**  | Appwrite file ID in the papers bucket       |
| `file_name` | String | **Yes**  | Original filename                           |
| `status`    | String | **Yes**  | `"pending"` \| `"approved"` \| `"rejected"` |

---

## Collection: `activity_logs`

Admin action audit log for moderation events.

| Field             | Type   | Required | Notes                                                          |
|-------------------|--------|----------|----------------------------------------------------------------|
| `action`          | String | **Yes**  | `"approve"` \| `"reject"` \| `"role_change"` \| `"tier_change"` |
| `target_user_id`  | String | No       | Affected user ID (for user actions)                            |
| `target_paper_id` | String | No       | Affected paper ID (for paper actions)                          |
| `admin_id`        | String | No       | Appwrite user ID of the admin who acted                        |
| `admin_email`     | String | No       | Admin email for audit trail                                    |
| `details`         | String | No       | Human-readable description of the action                       |
| `user_id`         | String | **Yes**  | Required by DB schema; set to `admin_id` value                 |
| `meta`            | String | **Yes**  | Required by DB schema; set to `""` (empty string)              |

---

## Collection: `achievements`

Per-user earned achievements / badges.

| Field         | Type     | Required | Notes                                        |
|---------------|----------|----------|----------------------------------------------|
| `user_id`     | String   | **Yes**  | Appwrite user ID                             |
| `slug`        | String   | **Yes**  | Machine identifier (e.g. `"first_upload"`)   |
| `label`       | String   | **Yes**  | Display label (e.g. `"First Upload"`)        |
| `description` | String   | No       | Human-readable description                   |
| `earned_at`   | Datetime | **Yes**  | ISO 8601 timestamp when the badge was earned |

---

## Collection: `site_metrics`

Site-wide analytics singleton. Contains a single document with ID `"singleton"`.

| Field              | Type    | Required | Notes                                         |
|--------------------|---------|----------|-----------------------------------------------|
| `visitor_count`    | Integer | **Yes**  | Total cumulative unique visitor count (shown in footer) |
| `launch_progress`  | Integer | No       | Dev launch progress percentage (0–100)        |

Create this collection in the Appwrite console, then create one document with ID `singleton`.

**Resetting the visitor counter (soft launch):**

- Perform a **server-to-server** `DELETE /api/visitor` with header `x-admin-key: <APPWRITE_API_KEY>` from a trusted backend environment (CI job, backend admin script, or a founder-only authenticated `/api/devtool` flow). Never paste `APPWRITE_API_KEY` into browser DevTools or any client-side code.  
- The route already exists, requires the admin API key, and is intended for backend/admin use only; no browser or public client should call it directly.

---

## Collection: `feedback`

User-submitted testimonials displayed on the homepage.

| Field        | Type    | Required | Notes                                          |
|--------------|---------|----------|------------------------------------------------|
| `name`       | String  | **Yes**  | Display name of the reviewer                   |
| `university` | String  | No       | University or institution of the reviewer      |
| `text`       | String  | **Yes**  | Testimonial body text                          |
| `approved`   | Boolean | **Yes**  | `false` until an admin approves for display    |

---

## Collection: `ai_usage`

Tracks per-request AI generation events for rate limiting and metrics. Each document
represents one generation invocation.

| Field       | Type     | Required | Notes                                                        |
|-------------|----------|----------|--------------------------------------------------------------|
| `user_id`   | String   | **Yes**  | Appwrite user ID of the requester                            |
| `date`      | String   | **Yes**  | Calendar date of the generation event (`YYYY-MM-DD` format)  |
| `$createdAt`| Datetime | **Yes**  | Auto-managed by Appwrite; used for RPM calculations          |

**Permissions:** only the server-side admin client writes to this collection.  
**Daily limit (configurable):** defaults to 5/day per `(user_id, date)` via server config; admin and founder accounts are exempt.  
**RPM tracking:** the API queries `$createdAt` within the last minute to derive RPM.  
**Index recommendation:** create indexes on `(user_id, date)` and on `$createdAt` for efficient quota and RPM queries.

### Planned AI credits + referrals notes

- `ai_usage` tracks invocation count/rate limiting. A future monetized credit flow should additionally decrement `users.ai_credits` per generation.
- Referral rewards can propagate up to 5 levels by resolving `users.referral_path` and applying credit+XP rewards from nearest ancestor to level 5.

### AI fallback + error behavior (no schema changes)

- AI chat and generation endpoints use a server-side OpenRouter free-tier fallback pool (priority order) to improve reliability under load while keeping costs at $0.
- If one model fails due to overload, timeout, or provider errors, the next model is tried automatically.
- User-facing API responses expose only safe messages such as:
  - `"AI is under high traffic. Please try again in a moment."`
  - `"Daily limit reached. Please try again tomorrow."`
  - `"Service temporarily unavailable. Please try again shortly."`
- Existing `ai_usage` quota enforcement: 5/day per user, unlimited for `admin` and `founder` roles.

---

## Collection: `ai_embeddings`

Stores AI retrieval chunks generated from uploaded paper/syllabus PDFs.
Embeddings are generated server-side and stored directly in Appwrite (no external DB).

| Field             | Type      | Required | Notes |
|-------------------|-----------|----------|-------|
| `file_id`         | String    | **Yes**  | Appwrite storage file ID |
| `source_type`     | String    | **Yes**  | `"paper"` or `"syllabus"` |
| `source_label`    | String    | **Yes**  | Human-readable source label |
| `course_code`     | String    | No       | Paper code when available |
| `department`      | String    | No       | Subject/department hint |
| `year`            | Integer   | No       | Document year if known |
| `uploaded_by`     | String    | No       | Uploader user ID |
| `embedding_model` | String    | **Yes**  | Embedding model identifier |
| `chunk_index`     | Integer   | **Yes**  | Position of chunk in source document |
| `text_chunk`      | String    | **Yes**  | Extracted PDF text chunk |
| `embedding`       | Float[]   | **Yes**  | Numeric embedding vector |

**Recommended indexes:** `file_id`, `department`, `(source_type, file_id, chunk_index)`.
Similarity is computed server-side with cosine scoring.

---

## Collection: `pdf_usage`

Tracks PDF generation usage events for `/api/ai/pdf` throttling.

| Field       | Type   | Required | Notes |
|-------------|--------|----------|-------|
| `user_id`   | String | **Yes**  | Appwrite user ID of the requester |
| `date`      | String | **Yes**  | Calendar date (`YYYY-MM-DD`) |

**Permissions:** server-side admin client writes/reads for quota checks.

---

## Collection: `ai_ingestions`

Stores markdown ingestion records for AI content options.

| Field                 | Type          | Required | Notes |
|-----------------------|---------------|----------|-------|
| `entry_type`          | String(32)    | No       | Current ingestion values: `syllabus` \| `question` (split mode; not DB-enforced enum) |
| `paper_code`          | String(256)   | No       | Ingestion paper code |
| `source_label`        | String(256)   | No       | Source file label |
| `file_id`             | String(64)    | No       | Appwrite Storage file ID |
| `file_url`            | String(2048)  | No       | Source file URL |
| `status`              | String(32)    | No       | Ingestion status |
| `model`               | String(64)    | No       | Ingestion parser/model label |
| `characters_ingested` | Integer       | No       | Parsed character count |
| `digest`              | String(8192)  | No       | JSON digest |
| `paper_name`          | String(255)   | No       | Human-readable paper name |
| `ingested_at`         | Datetime      | No       | Explicit ingestion timestamp |
| `row_count`           | Integer       | No       | Syllabus+question rows written |
| `error_summary`       | String(2000)  | No       | Compressed parse/db errors |
| `subject`             | String(128)   | No       | Department/subject |
| `dept_code`           | String(16)    | No       | Department code |

**Collection settings:** `documentSecurity = false`, permissions include `read("any")`.

---

## Collection: `ai_syllabus_maps`

AI-generated syllabus-to-archive mapping records.

| Field                 | Type         | Required | Notes |
|-----------------------|--------------|----------|-------|
| `university`          | String(256)  | No       | University name |
| `college`             | String(256)  | No       | College/institution |
| `program`             | String(128)  | No       | Program/course |
| `semester`            | String(32)   | No       | Semester label/code |
| `checksum`            | String(128)  | No       | Mapping checksum |
| `modules_json`        | String(10000)| No       | JSON payload of module mappings |
| `model`               | String(64)   | No       | AI model identifier |
| `source_syllabus_id`  | String(64)   | No       | Source syllabus document ID |

---

## Collection: `ai_flashcards`

AI-generated flashcards payloads.

| Field             | Type         | Required | Notes |
|-------------------|--------------|----------|-------|
| `userId`          | String(64)   | No       | User ID |
| `source_paper_id` | String(64)   | No       | Source paper ID |
| `payload`         | String(10000)| No       | Serialized flashcards payload |
| `model`           | String(64)   | No       | AI model identifier |
| `tags`            | Array(String(128)) | No | Optional tags |

---

## Collection: `ai_admin_reports`

AI-generated admin summary reports.

| Field       | Type         | Required | Notes |
|-------------|--------------|----------|-------|
| `run_at`    | Datetime     | No       | Report run timestamp |
| `summary`   | String(10000)| No       | Summary text |
| `risks_json`| String(10000)| No       | Structured risks payload |
| `model`     | String(64)   | No       | AI model identifier |

---

## Collection: `Syllabus_Table`

Canonical parsed syllabus units used by ingestion and AI notes generation.

| Field                  | Type                  | Required | Notes |
|------------------------|-----------------------|----------|-------|
| `entry_type`           | String(32)            | No       | `syllabus` for split mode |
| `entry_id`             | String(128)           | No       | External/source entry ID |
| `college`              | String(256)           | No       | College |
| `university`           | String(256)           | **Yes**  | University |
| `course`               | String(64)            | **Yes**  | Course |
| `stream`               | String(64)            | **Yes**  | Stream |
| `group`                | String(256)           | No       | Group/category |
| `session`              | String(64)            | No       | Academic session |
| `year`                 | Integer               | No       | Academic year |
| `type`                 | String(32)            | **Yes**  | Paper type |
| `paper_code`           | String(128)           | **Yes**  | Paper code |
| `paper_name`           | String(255)           | No       | Paper name |
| `subject`              | String(256)           | No       | Subject |
| `semester_code`        | String(16)            | No       | Semester code |
| `semester_no`          | Integer               | No       | Semester number |
| `semester`             | Integer               | No       | Canonical semester (1–8) |
| `credits`              | Integer               | No       | Credits |
| `marks_total`          | Integer               | No       | Total marks |
| `syllabus_pdf_url`     | String(2048)          | No       | Syllabus PDF URL |
| `source_reference`     | String(512)           | No       | Source reference |
| `status`               | String(64)            | No       | Ingestion status |
| `aliases`              | Array(String(256))    | No       | Alias list |
| `keywords`             | Array(String(128))    | No       | Keywords |
| `notes`                | String(8192)          | No       | Notes |
| `version`              | Integer               | No       | Entry version |
| `last_updated`         | String(32)            | No       | Last updated marker |
| `unit_number`          | Integer               | **Yes**  | Unit number |
| `syllabus_content`     | String(1000000)       | **Yes**  | Unit syllabus text |
| `lectures`             | Integer               | No       | Lecture count |
| `tags`                 | Array(String(128))    | No       | Unit tags |

---

## Collection: `Questions_Table`

Canonical parsed question rows used by solved-paper generation.

| Field                    | Type                | Required | Notes |
|--------------------------|---------------------|----------|-------|
| `entry_type`             | String(32)          | No       | `question` for split mode |
| `question_id`            | String(128)         | No       | External/source question ID |
| `college`                | String(256)         | No       | College |
| `university`             | String(256)         | **Yes**  | University |
| `course`                 | String(64)          | **Yes**  | Course |
| `stream`                 | String(64)          | **Yes**  | Stream |
| `group`                  | String(256)         | No       | Group/category |
| `type`                   | String(32)          | **Yes**  | Paper type |
| `paper_code`             | String(128)         | **Yes**  | Paper code |
| `paper_name`             | String(256)         | No       | Paper name |
| `subject`                | String(256)         | No       | Subject |
| `exam_year`              | Integer             | No       | Exam year |
| `exam_session`           | String(64)          | No       | Exam session |
| `exam_month`             | String(32)          | No       | Exam month |
| `attempt_type`           | String(32)          | No       | Attempt type |
| `semester_code`          | String(16)          | No       | Semester code |
| `semester_no`            | Integer             | No       | Semester number |
| `question_pdf_url`       | String(2048)        | No       | Question paper PDF URL |
| `source_reference`       | String(512)         | No       | Source reference |
| `status`                 | String(64)          | No       | Ingestion status |
| `question_no`            | String(32)          | No       | Question number |
| `question_subpart`       | String(32)          | No       | Question subpart |
| `year`                   | Integer             | No       | Legacy year field |
| `question_content`       | String(1000000)     | **Yes**  | Question text |
| `marks`                  | Integer             | No       | Marks |
| `tags`                   | Array(String(128))  | No       | Tags |
| `linked_syllabus_entry_id` | String(128)      | No       | Link to syllabus entry |
| `link_status`            | String(32)          | No       | Linking status |
| `ocr_text_path`          | String(512)         | No       | OCR text reference |
| `ai_summary_status`      | String(32)          | No       | AI summary status |
| `difficulty_estimate`    | String(32)          | No       | Difficulty estimate |

---

## Collection: `Generated_Notes_Cache`

Cache for generated unit/part markdown and rendered PDF artifacts.

| Field                 | Type             | Required | Notes |
|-----------------------|------------------|----------|-------|
| `university`          | String(256)      | No       | University |
| `course`              | String(64)       | No       | Course |
| `stream`              | String(64)       | No       | Stream |
| `selection_type`      | String(32)       | No       | Selection key |
| `paper_code`          | String(128)      | **Yes**  | Paper code |
| `type`                | String(50)       | **Yes**  | Notes type |
| `year`                | String(10)       | No       | Legacy year key |
| `semester`            | String(10)       | No       | Semester key |
| `unit_number`         | Integer          | **Yes**  | Unit number |
| `part_number`         | Integer          | No       | Part number |
| `markdown_file_id`    | String(100)      | **Yes**  | Markdown storage file ID |
| `generated_markdown`  | String(1000000)  | No       | Generated markdown content |
| `syllabus_content`    | String(1000000)  | No       | Source syllabus chunk |
| `pdf_file_id`         | String(100)      | No       | Rendered PDF storage file ID |
| `created_at`          | Datetime         | **Yes**  | Creation timestamp |
| `status`              | String(50)       | **Yes**  | Cache row status |
| `last_processed_index`| Integer          | No       | Partial-generation progress marker |

---

## Collection: `User_Quotas`

Per-user daily quota counters for notes and solved-paper generation.

| Field                 | Type       | Required | Notes |
|-----------------------|------------|----------|-------|
| `user_id`             | String(64) | **Yes**  | User ID |
| `notes_generated_today` | Integer  | **Yes**  | Daily notes generation count |
| `papers_solved_today` | Integer    | **Yes**  | Daily solved-paper generation count |
| `last_generation_date`| String(10) | **Yes**  | Date key (`YYYY-MM-DD`) |

---

## Referral tracking (implemented)

- Signup accepts optional `referral_code` on the login/signup form.
- On successful signup, backend resolves referrer from `users.referral_code` and stores pending referral metadata server-side.
- On first authenticated profile load, backend creates/updates the user profile with:
  - `users.referral_code` (generated unique 6-character uppercase code if missing)
  - `users.referred_by` (direct referrer user ID, if provided)
  - `users.referral_path` (up to 5 levels of ancestors)
- Profile page exposes a shareable link format:
  - `/login?mode=signup&ref=<REFERRAL_CODE>`

### Admin setup checklist for referrals

Ensure the `users` collection includes these attributes:

1. `referral_code` — string (size 6)
2. `referred_by` — string (size compatible with Appwrite user IDs)
3. `referral_path` — string array
4. `ai_credits` — integer (default `0`)

Recommended index:

- unique index on `referral_code`

---

## Storage Buckets

| Bucket ID        | Purpose                         | Max File Size | Access           |
|------------------|---------------------------------|---------------|------------------|
| `papers`         | Exam question paper PDFs        | 20 MB         | `read("users")` — authenticated only |
| `syllabus-files` | Syllabus PDFs                   | 20 MB         | `read("users")` — authenticated only |
| `avatars`        | User avatar images              | 5 MB          | `read("users")`  |
| `examarchive-syllabus-md-ingestion` | Uploaded syllabus markdown ingestion files | 2 MB | server-side admin only |
| `examarchive_question_ingest_assets` | Question ingestion assets (markdown + rendered PDFs) | 5 MB | server-side admin only |

All files are served via Next.js proxy routes that verify the user's session:
- Papers: `/api/files/papers/[fileId]`
- Syllabi: `/api/files/syllabus/[fileId]`
- Avatars: `/api/files/avatars/[fileId]`
- Ingestion-rendered question PDFs: `/api/files/ingestion-question/[fileId]`

---

## Soft launch reset checklist

Use this checklist to wipe counters and storage before relaunch:

1) **Storage buckets:** Empty `papers`, `syllabus-files`, and (optionally) `avatars` buckets from the Appwrite console or CLI.  
2) **Collections to clear:** Truncate `papers`, `syllabus`, `uploads`, `ai_usage`, `pdf_usage`, and `ai_embeddings` if you want a clean slate.  
3) **Visitor counter:** Call `DELETE /api/visitor` with header `x-admin-key: APPWRITE_API_KEY` to reset `site_metrics.visitor_count` to `0` (e.g. via DevTools).  
4) **User counters:** Set `upload_count`, `view_count`, and `download_count` to `0` for any seed documents you keep; adjust `launch_progress` as needed.  
5) **Verify schema:** Ensure `institute`/`institution` is present on papers so university totals render correctly, and that `users` collection totals match the Auth user count after cleanup.

---

<!-- SCHEMA_SYNC_STATUS_START -->
## Schema Sync Status (Auto-generated)

_This v2 schema section is updated by `scripts/v2/sync-appwrite-schema.js` when run with `--update-schema-md`._

| Collection | Status | Created in run | String type sync | Notes |
|---|---|---:|---|---|
| `papers` | ⚠️ Connected with differences | 0 | ⚠️ 5/15 perfect, 10 different | collection existed; 0/21 missing attrs created; 10 attr definition mismatch(es); string diffs: course_code: size 32 → 64 \| paper_name: size 255 → 256 (+8 more) |
| `syllabus` | ⚠️ Connected with differences | 0 | ⚠️ 2/11 perfect, 9 different | collection existed; 0/13 missing attrs created; 9 attr definition mismatch(es); string diffs: university: size 100 → 256 \| subject: size 100 → 256 (+7 more) |
| `users` | ⚠️ Connected with differences | 0 | ⚠️ 3/14 perfect, 11 different | collection existed; 0/19 missing attrs created; 11 attr definition mismatch(es); string diffs: email: type text → string, size undefined → 320 \| role: type text → string, size undefined → 64 (+9 more) |
| `uploads` | ⚠️ Connected with differences | 0 | ⚠️ 0/4 perfect, 4 different | collection existed; 0/4 missing attrs created; 4 attr definition mismatch(es); string diffs: user_id: size 36 → 64 \| file_id: size 36 → 64 (+2 more) |
| `activity_logs` | ⚠️ Connected with differences | 0 | ⚠️ 3/8 perfect, 5 different | collection existed; 0/8 missing attrs created; 5 attr definition mismatch(es); string diffs: admin_id: size 32 → 64 \| admin_email: size 32 → 320 (+3 more) |
| `achievements` | ⚠️ Connected with differences | 0 | ⚠️ 0/4 perfect, 4 different | collection existed; 0/5 missing attrs created; 4 attr definition mismatch(es); string diffs: user_id: size 36 → 64 \| slug: size 100 → 128 (+2 more) |
| `site_metrics` | ⚠️ Connected with differences | 0 | n/a | collection existed; 0/2 missing attrs created; 1 attr definition mismatch(es); string type/size aligned |
| `feedback` | ✅ Perfectly connected | 0 | ✅ 3/3 perfect | collection existed; 0/4 missing attrs created; no mismatches detected; string type/size aligned |
| `ai_usage` | ✅ Perfectly connected | 0 | ✅ 2/2 perfect | collection existed; 0/2 missing attrs created; no mismatches detected; string type/size aligned |
| `ai_embeddings` | ⚠️ Connected with differences | 0 | ⚠️ 1/8 perfect, 7 different | collection existed; 0/11 missing attrs created; 8 attr definition mismatch(es); string diffs: source_type: size 128 → 32 \| source_label: size 1024 → 512 (+5 more) |
| `pdf_usage` | ✅ Perfectly connected | 0 | ✅ 2/2 perfect | collection existed; 0/2 missing attrs created; no mismatches detected; string type/size aligned |
| `Syllabus_Table` | ⚠️ Connected with differences | 0 | ⚠️ 16/17 perfect, 1 different | collection existed; 0/30 missing attrs created; 1 attr definition mismatch(es); string diffs: syllabus_content: size 65535 → 1000000 |
| `Questions_Table` | ⚠️ Connected with differences | 0 | ⚠️ 19/20 perfect, 1 different | collection existed; 0/31 missing attrs created; 1 attr definition mismatch(es); string diffs: question_content: size 65535 → 1000000 |
| `Generated_Notes_Cache` | ⚠️ Connected with differences | 0 | ⚠️ 9/13 perfect, 4 different | collection existed; 0/17 missing attrs created; 4 attr definition mismatch(es); string diffs: markdown_file_id: required false → true \| generated_markdown: required true → false, size 65535 → 1000000 (+2 more) |
| `User_Quotas` | ✅ Perfectly connected | 0 | ✅ 2/2 perfect | collection existed; 0/4 missing attrs created; no mismatches detected; string type/size aligned |

<!-- SCHEMA_SYNC_STATUS_END -->

### Schema limit note (Appwrite)

- Appwrite collections can hit practical attribute-count limits (often around 15–30 attributes depending on schema complexity/index pressure).
- For very large free-text fields, prefer defining very-large string attribute sizes for long payloads.
- If sync logs `attribute_limit_exceeded`, remove stale attributes first, then re-run sync.

---
### Sync Remarks (Auto-Generated)
**Last Synced:** 2026-04-09T07:58:11.169Z
**Overall Status:** Partial
**Connected:**
- feedback updated successfully.
- ai_usage updated successfully.
- pdf_usage updated successfully.
- User_Quotas updated successfully.
**Not Connected / Errors:**
- papers has 10 mismatch(es).
- syllabus has 9 mismatch(es).
- users has 11 mismatch(es).
- uploads has 4 mismatch(es).
- activity_logs has 5 mismatch(es).
- achievements has 4 mismatch(es).
- site_metrics has 1 mismatch(es).
- ai_embeddings has 8 mismatch(es).
- Syllabus_Table has 1 mismatch(es).
- Questions_Table has 1 mismatch(es).
- Generated_Notes_Cache has 4 mismatch(es).
