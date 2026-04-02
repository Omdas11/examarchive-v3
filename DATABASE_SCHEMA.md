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

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | String | **Yes** | Document ID |
| `paper_code` | String | **Yes** | Paper code |
| `unit_number` | Integer | **Yes** | Unit number |
| `generated_markdown` | String | **Yes** | Cached stitched markdown |
| `created_at` | Datetime | **Yes** | Cache creation timestamp |

## Table: `User_Quotas`

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | String | **Yes** | Document ID |
| `user_id` | String | **Yes** | User ID |
| `notes_generated_today` | Integer | **Yes** | Daily unit notes count |
| `papers_solved_today` | Integer | **Yes** | Daily solved papers count |
| `last_generation_date` | String | **Yes** | UTC date key (`YYYY-MM-DD`) |

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
| `Syllabus_Table` | ✅ Perfectly connected | 10 | collection created; 9/9 missing attrs created; no mismatches detected |
| `Questions_Table` | ✅ Perfectly connected | 12 | collection created; 11/11 missing attrs created; no mismatches detected |

<!-- SCHEMA_SYNC_STATUS_END -->

---
### Sync Remarks (Auto-Generated)
**Last Synced:** 2026-04-01T14:57:54.013Z
**Overall Status:** Partial
**Connected:**
- feedback updated successfully.
- ai_usage updated successfully.
- pdf_usage updated successfully.
- Syllabus_Table updated successfully.
- Questions_Table updated successfully.
**Not Connected / Errors:**
- papers has 10 mismatch(es).
- syllabus has 9 mismatch(es).
- users has 11 mismatch(es).
- uploads has 4 mismatch(es).
- activity_logs has 5 mismatch(es).
- achievements has 4 mismatch(es).
- site_metrics has 1 mismatch(es).
- ai_embeddings has 8 mismatch(es).
