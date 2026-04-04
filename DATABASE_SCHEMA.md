# DATABASE_SCHEMA

## Table: `Syllabus_Table`

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | String | **Yes** | Document ID |
| `university` | String | **Yes** | University name |
| `course` | String | **Yes** | Course name (FYUG/CBCS) |
| `type` | String | **Yes** | Paper type (DSC/DSM/SEC/AEC/VAC/IDC) |
| `paper_code` | String | **Yes** | Paper code |
| `unit_number` | Integer | **Yes** | Unit number |
| `syllabus_content` | String | **Yes** | Unit syllabus content |
| `lectures` | Integer | No | Number of lectures |
| `tags` | String | No | Topic tags |

## Table: `Questions_Table`

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | String | **Yes** | Document ID |
| `university` | String | **Yes** | University name |
| `course` | String | **Yes** | Course name (FYUG/CBCS) |
| `type` | String | **Yes** | Paper type |
| `paper_code` | String | **Yes** | Paper code |
| `paper_name` | String | No | Paper name |
| `question_no` | String | No | Question number |
| `question_subpart` | String | No | Subpart label |
| `year` | Integer | No | Exam year |
| `question_content` | String | **Yes** | Question content |
| `marks` | Integer | No | Marks |
| `tags` | String | No | Topic tags |

## Table: `Generated_Notes_Cache`

| Attribute Name | Type | Size | Required | Description |
|---|---|---|---|---|
| `id` | String | - | Yes | Document ID |
| `paper_code` | String | 128 | Yes | The target course paper code (e.g., PHYDSC101T) |
| `type` | String | 50 | Yes | Identifies cache type: 'solved_paper' or 'unit_notes' |
| `year` | String | 10 | No | The year of the question paper (if type is solved_paper) |
| `unit_number` | Integer | - | Yes | The syllabus unit number (if type is unit_notes) |
| `part_number` | Integer | - | No | Tracks batching parts to bypass serverless timeouts |
| `markdown_file_id` | String | 100 | Yes | Appwrite Storage file ID for stitched AI-generated markdown |
| `syllabus_content` | String | 1000000 | No | Cached syllabus content for notes print context |
| `created_at` | Datetime | - | Yes | Cache creation timestamp |
| `status` | String | 50 | Yes | 'generating' or 'completed' |
| `last_processed_index` | Integer | - | No | Last processed question index for resume-safe continuation |

## Table: `User_Quotas`

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | String | **Yes** | Document ID |
| `user_id` | String | **Yes** | User ID |
| `notes_generated_today` | Integer | **Yes** | Daily unit notes count |
| `papers_solved_today` | Integer | **Yes** | Daily solved papers count |
| `last_generation_date` | String | **Yes** | UTC date key (`YYYY-MM-DD`) |

## Collection: `ai_ingestions`

| Field | Type | Required | Notes |
|---|---|---|---|
| `paper_code` | String (255) | **Yes** | Strict ingestion paper code |
| `file_id` | String (255) | **Yes** | Appwrite Storage file ID for ingested markdown |

## Storage Bucket: `examarchive-md-ingestion`

| Field | Value |
|---|---|
| Access | `read("any")` |
| Purpose | Markdown ingestion cache |
| Max file size | 2 MB |
| Allowed file extensions | `md` |

---

<!-- SCHEMA_SYNC_STATUS_START -->
## Schema Sync Status (Auto-generated)

_This section is updated by `scripts/sync-appwrite-schema.js` when run with `--update-schema-md`._

| Collection | Status | Created in run | Notes |
|---|---|---:|---|
| `papers` | ⚠️ Connected with differences | 0 | collection existed; 0/21 missing attrs created; 10 attr definition mismatch(es) |
| `syllabus` | ⚠️ Connected with differences | 0 | collection existed; 0/13 missing attrs created; 9 attr definition mismatch(es) |
| `users` | ⚠️ Connected with differences | 0 | collection existed; 0/19 missing attrs created; 11 attr definition mismatch(es) |
| `uploads` | ⚠️ Connected with differences | 0 | collection existed; 0/4 missing attrs created; 4 attr definition mismatch(es) |
| `activity_logs` | ⚠️ Connected with differences | 0 | collection existed; 0/8 missing attrs created; 5 attr definition mismatch(es) |
| `achievements` | ⚠️ Connected with differences | 0 | collection existed; 0/5 missing attrs created; 4 attr definition mismatch(es) |
| `site_metrics` | ⚠️ Connected with differences | 0 | collection existed; 0/2 missing attrs created; 1 attr definition mismatch(es) |
| `feedback` | ✅ Perfectly connected | 0 | collection existed; 0/4 missing attrs created; no mismatches detected |
| `ai_usage` | ✅ Perfectly connected | 0 | collection existed; 0/2 missing attrs created; no mismatches detected |
| `ai_embeddings` | ⚠️ Connected with differences | 0 | collection existed; 0/11 missing attrs created; 8 attr definition mismatch(es) |
| `pdf_usage` | ✅ Perfectly connected | 0 | collection existed; 0/2 missing attrs created; no mismatches detected |
| `Syllabus_Table` | ⚠️ Connected with differences | 0 | collection existed; 0/9 missing attrs created; 1 attr definition mismatch(es) |
| `Questions_Table` | ⚠️ Connected with differences | 0 | collection existed; 0/12 missing attrs created; 1 attr definition mismatch(es) |
| `Generated_Notes_Cache` | ⚠️ Connected with differences | 0 | collection existed; 0/10 missing attrs created; 3 attr definition mismatch(es) |
| `User_Quotas` | ✅ Perfectly connected | 0 | collection existed; 0/5 missing attrs created; no mismatches detected |

<!-- SCHEMA_SYNC_STATUS_END -->

---
### Sync Remarks (Auto-Generated)
**Last Synced:** 2026-04-03T11:37:43.271Z
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
- Generated_Notes_Cache has 3 mismatch(es).
