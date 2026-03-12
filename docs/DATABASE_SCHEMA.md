# Database Schema — ExamArchive v3

**Database ID:** `examarchive`

All collections live inside this single Appwrite database.

> **Note for administrators:** This document is the authoritative reference for the Appwrite database structure. Do not add, remove, or rename attributes in the Appwrite Console without updating this file. Field names in code must match exactly.

---

## Collection: `papers`

**Purpose:** Stores exam question paper metadata. The actual PDF files are held in the `papers` Appwrite Storage bucket (restricted to authenticated users via `read("users")` permission). Documents are created on upload with `approved = false` and updated on admin approval.

| Field         | Type    | Required | Purpose / Notes                                                        |
|---------------|---------|----------|------------------------------------------------------------------------|
| `course_code` | String  | **Yes**  | Paper code (e.g. `PHYDSC101T`). Primary lookup key. Code suffix T = Theory, P = Practical. |
| `paper_name`  | String  | No       | Human-readable paper title. Auto-resolved server-side from syllabus registry on upload. |
| `course_name` | String  | No       | Alias for `paper_name` stored in some documents for backward compatibility. |
| `year`        | Integer | **Yes**  | Exam year (e.g. `2024`). Supplied by uploader.                         |
| `semester`    | String  | No       | Ordinal string (e.g. `"1st"`). Auto-resolved from registry; empty if unknown. |
| `department`  | String  | No       | Disciplinary subject (e.g. `"Physics"`). Auto-resolved from registry.  |
| `programme`   | String  | No       | Academic framework (e.g. `"FYUGP"`, `"CBCS"`). Auto-resolved from registry. |
| `exam_type`   | String  | No       | `"Theory"` or `"Practical"`. Derived from the trailing letter of the paper code. |
| `file_id`     | String  | No       | Appwrite Storage file ID in the `papers` bucket. Used by the proxy route. |
| `file_url`    | String  | **Yes**  | Next.js proxy URL: `/api/files/papers/{fileId}`. Always set on upload. |
| `uploaded_by` | String  | No       | Appwrite Auth user ID of the uploader.                                 |
| `approved`    | Boolean | **Yes**  | `false` on upload; set to `true` by admin approval. Drives all public browse queries (`Query.equal("approved", true)`). |
| `status`      | String  | No       | `"pending"` on upload; `"approved"` or `"rejected"` after admin action. |
| `paper_type`  | String  | No       | Paper category/type. For FYUGP: `DSC`, `DSM`, `SEC`, `IDC`, `GE`. For CBCS: `CC`, `DSC`, `DSE`, `GEC`, `SEC`. |
| `view_count`  | Integer | No       | Incremented each time the paper detail page is viewed.                 |
| `download_count` | Integer | No    | Incremented each time the PDF is downloaded by a user.                 |
| `university`  | String  | No       | University name (e.g. `"Assam University"`). Auto-resolved from registry. |

**Lifecycle:** Upload → `approved = false`, `status = "pending"` → Admin approves → `approved = true`, `status = "approved"`.

---

## Collection: `syllabus`

**Purpose:** Stores syllabus document metadata. PDFs are held in the `syllabus-files` bucket. Departmental (all-semester) syllabi are stored with `semester = ""`.

| Field                  | Type    | Required | Purpose / Notes                                               |
|------------------------|---------|----------|---------------------------------------------------------------|
| `university`           | String  | No       | University name (e.g. `"Assam University"`).                  |
| `subject`              | String  | No       | Full paper/subject name. Resolved from syllabus registry.     |
| `course_name`          | String  | No       | Alias for `subject`. Some documents use this field instead.   |
| `course_code`          | String  | No       | Paper code, if applicable (e.g. `PHYDSC101T`).                |
| `department`           | String  | No       | Disciplinary subject (e.g. `"Physics"`).                      |
| `semester`             | String  | No       | Ordinal string (e.g. `"1"`). Empty string `""` denotes departmental syllabi that span all semesters. |
| `programme`            | String  | No       | Academic framework: `"FYUGP"`, `"CBCS"`, `"NEP"`, `"HONOURS"`. Auto-resolved from registry. |
| `year`                 | Integer | No       | Year the syllabus is applicable. `null` or `0` if not specified. |
| `uploader_id`          | String  | No       | Appwrite Auth user ID of the uploader.                        |
| `approval_status`      | String  | No       | `"pending"` \| `"approved"` \| `"rejected"`. Drives public display. |
| `file_url`             | String  | No       | Next.js proxy URL: `/api/files/syllabus/{fileId}`.            |
| `file_id`              | String  | No       | Appwrite Storage file ID in the `syllabus-files` bucket.      |
| `uploaded_by_username` | String  | No       | Denormalised username for display on admin screens.           |
| `is_hidden`            | Boolean | No       | Admin soft-hide flag. `true` removes from public Syllabus page without deletion. Default: `false`. |

---

## Collection: `users`

**Purpose:** Stores user profile data alongside Appwrite Auth accounts. One document per authenticated user (document ID = Appwrite Auth user ID).

| Field                    | Type     | Required | Purpose / Notes                                              |
|--------------------------|----------|----------|--------------------------------------------------------------|
| `email`                  | String   | **Yes**  | User email address. Mirrors Appwrite Auth.                   |
| `role`                   | String   | **Yes**  | Primary authorisation role. Values: `visitor`, `explorer`, `contributor`, `verified_contributor`, `moderator`, `maintainer`, `admin`, `founder`. Auto-promoted by upload count thresholds. |
| `secondary_role`         | String   | No       | Cosmetic community role (display-only, no permissions). Values: `reviewer`, `curator`, `mentor`, `archivist`, `ambassador`, `pioneer`, `researcher`. |
| `tertiary_role`          | String   | No       | Additional cosmetic community role. Same value set as `secondary_role`. |
| `tier`                   | String   | No       | Activity tier based on approved uploads. Values: `bronze`, `silver`, `gold`, `platinum`, `diamond`. |
| `display_name`           | String   | No       | User's chosen display name (editable from Profile page).     |
| `username`               | String   | No       | Unique `@username`. Subject to 7-day change cooldown enforced via `username_last_changed`. |
| `xp`                     | Integer  | No       | Experience points earned from approved uploads and activities. |
| `streak_days`            | Integer  | No       | Current consecutive daily activity streak count. Reset to `0` if no activity for > 1 day. |
| `avatar_url`             | String   | No       | Full URL of the user's avatar (proxy path or external URL).   |
| `avatar_file_id`         | String   | No       | Appwrite Storage file ID in the `avatars` bucket. Used by `/api/files/avatars/[fileId]`. |
| `last_activity`          | Datetime | No       | ISO 8601 timestamp of the user's most recent activity (upload, approval, etc.). Used for streak calculation. |
| `upload_count`           | Integer  | No       | Count of **approved** uploads. Incremented by admin approval. Drives auto-promotion to `contributor` (≥ 3) and `silver` tier (≥ 20). |
| `username_last_changed`  | String   | No       | ISO 8601 timestamp of the last username change. Enforces 7-day cooldown in `ProfileEditor`. |

> **Note:** The "My Course" preference (user's selected Programme and Semester) is stored client-side in `localStorage` under the key `ea_my_course`. It is not persisted in this collection.

---

## Collection: `uploads`

**Purpose:** Audit trail of all file upload events, independent of admin approval status. Written at upload time; not updated on approval.

| Field       | Type   | Required | Purpose / Notes                                       |
|-------------|--------|----------|-------------------------------------------------------|
| `user_id`   | String | **Yes**  | Appwrite Auth user ID of the uploader.                |
| `file_id`   | String | **Yes**  | Appwrite Storage file ID in the `papers` bucket.      |
| `file_name` | String | **Yes**  | Original filename as uploaded.                        |
| `status`    | String | **Yes**  | `"pending"` \| `"approved"` \| `"rejected"`. Set to `"pending"` at upload time. |

---

## Collection: `activity_logs`

**Purpose:** Admin action audit log for moderation events. Written whenever an admin performs an action on a paper, syllabus, or user.

| Field             | Type   | Required | Purpose / Notes                                                          |
|-------------------|--------|----------|--------------------------------------------------------------------------|
| `action`          | String | **Yes**  | Action type: `"approve"` \| `"reject"` \| `"role_change"` \| `"tier_change"`. |
| `target_user_id`  | String | No       | Affected user's Appwrite ID (set for user-related actions).              |
| `target_paper_id` | String | No       | Affected paper's document ID (set for paper-related actions).            |
| `admin_id`        | String | No       | Appwrite Auth user ID of the admin who performed the action.             |
| `admin_email`     | String | No       | Admin email address. Denormalised for audit trail readability.           |
| `details`         | String | No       | Human-readable description of what was changed (e.g. `"role: student → contributor"`). |
| `user_id`         | String | **Yes**  | **Required by DB constraint.** Always set to the same value as `admin_id`. |
| `meta`            | String | **Yes**  | **Required by DB constraint.** Always set to `""` (empty string).        |

---

## Collection: `achievements`

**Purpose:** Per-user earned achievement badges. Written when a badge criterion is first met.

| Field         | Type     | Required | Purpose / Notes                                           |
|---------------|----------|----------|-----------------------------------------------------------|
| `user_id`     | String   | **Yes**  | Appwrite Auth user ID.                                    |
| `slug`        | String   | **Yes**  | Machine-readable identifier. Examples: `"first_upload"`, `"7_day_streak"`, `"approval_90"`, `"top_contributor"`. |
| `label`       | String   | **Yes**  | Human-readable display label. Example: `"First Upload"`.  |
| `description` | String   | No       | Longer description of how the badge was earned.           |
| `earned_at`   | Datetime | **Yes**  | ISO 8601 timestamp when the badge was awarded.            |

---

## Collection: `site_metrics`

**Purpose:** Platform-level counters and configuration values. Read by the home page and DevTool.

| Field          | Type    | Required | Purpose / Notes                                             |
|----------------|---------|----------|-------------------------------------------------------------|
| `key`          | String  | **Yes**  | Metric key (e.g. `"visitor_count"`, `"launch_progress"`).  |
| `value`        | Integer | No       | Integer value for counter-type metrics.                     |
| `string_value` | String  | No       | String value for configuration-type metrics.                |
| `updated_at`   | Datetime | No      | ISO 8601 timestamp of the last update.                      |

---

## Storage Buckets

| Bucket ID        | Purpose                         | Max File Size | Access                                        |
|------------------|---------------------------------|---------------|-----------------------------------------------|
| `papers`         | Exam question paper PDFs        | 20 MB         | `read("users")` — authenticated users only    |
| `syllabus-files` | Syllabus PDFs                   | 20 MB         | `read("users")` — authenticated users only    |
| `avatars`        | User avatar images              | 5 MB          | `read("users")` — authenticated users only    |

All files are served via Next.js proxy routes that verify the user's session before streaming content:
- Papers: `GET /api/files/papers/[fileId]`
- Syllabi: `GET /api/files/syllabus/[fileId]`
- Avatars: `GET /api/files/avatars/[fileId]`

Unauthenticated requests to paper/syllabus proxy routes are redirected to `/login` (HTTP 302). The avatars route is publicly accessible.

---

## Key Relationships

```
users.id ──────────────────────── papers.uploaded_by
users.id ──────────────────────── syllabus.uploader_id
users.id ──────────────────────── uploads.user_id
users.id ──────────────────────── achievements.user_id
users.id (as admin) ──────────── activity_logs.admin_id / activity_logs.user_id
papers.$id ────────────────────── activity_logs.target_paper_id
users.id (target) ─────────────── activity_logs.target_user_id
papers.file_id ─────────────────── Storage bucket: papers
syllabus.file_id ───────────────── Storage bucket: syllabus-files
users.avatar_file_id ───────────── Storage bucket: avatars
```

