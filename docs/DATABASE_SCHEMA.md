# Database Schema — ExamArchive v3

**Database ID:** `examarchive`

All collections live inside this single Appwrite database. The schema below reflects the live, active fields. Fields marked **REMOVE** are candidates for deletion from the Appwrite Console as they are unused in the codebase.

---

## Collection: `papers`

Stores exam question paper metadata. Files are held in the `papers` Appwrite Storage bucket.

| Field          | Type    | Required | Notes                                                        |
|----------------|---------|----------|--------------------------------------------------------------|
| `course_name`  | String  | Yes      | Full paper name, resolved from syllabus registry             |
| `year`         | Integer | Yes      | Exam year (e.g. 2024)                                        |
| `semester`     | String  | No       | Ordinal string (e.g. "1st", "2nd"); auto-resolved            |
| `exam_type`    | String  | No       | "Theory" or "Practical"; derived from paper code suffix T/P  |
| `department`   | String  | Yes      | Disciplinary subject (e.g. "Physics"); auto-resolved         |
| `file_url`     | String  | Yes      | Public Appwrite Storage view URL                             |
| `uploaded_by`  | String  | Yes      | Appwrite user ID of uploader                                 |
| `approved`     | Boolean | Yes      | `false` until admin approves                                 |
| `paper_type`   | String  | No       | Category: DSC / DSM / SEC / IDC / GE (FYUGP) or CC / DSC / DSE / GEC / SEC (CBCS) |
| `institute`    | String  | No       | University name (e.g. "Assam University")                    |

---

## Collection: `syllabus`

Stores syllabus document metadata. Files are held in the `syllabus-files` Appwrite Storage bucket.

| Field                  | Type    | Required | Notes                                               |
|------------------------|---------|----------|-----------------------------------------------------|
| `university`           | String  | Yes      | University name                                     |
| `subject`              | String  | Yes      | Full paper name, resolved from syllabus registry    |
| `department`           | String  | Yes      | Disciplinary subject (e.g. "Physics")               |
| `semester`             | String  | No       | Ordinal string; empty string for departmental docs  |
| `programme`            | String  | No       | "FYUGP" or "CBCS"; auto-resolved from registry      |
| `year`                 | Integer | No       | Year the syllabus is applicable                     |
| `uploader_id`          | String  | Yes      | Appwrite user ID of uploader                        |
| `approval_status`      | String  | Yes      | "pending" \| "approved" \| "rejected"               |
| `file_url`             | String  | Yes      | Public Appwrite Storage view URL                    |
| `uploaded_by_username` | String  | No       | Denormalised username for display                   |
| `is_hidden`            | Boolean | No       | Admin soft-hide flag (default: false)               |

---

## Collection: `users`

Stores user profile data alongside Appwrite Auth accounts.

| Field             | Type    | Required | Notes                                              |
|-------------------|---------|----------|----------------------------------------------------|
| `email`           | String  | Yes      | User email address                                 |
| `role`            | String  | Yes      | Primary role: visitor / explorer / contributor / verified_contributor / moderator / maintainer / admin / founder |
| `primary_role`    | String  | No       | **REMOVE** — legacy alias for `role`; use `role` only |
| `secondary_role`  | String  | No       | Cosmetic community role (display-only)             |
| `tertiary_role`   | String  | No       | Additional cosmetic community role                 |
| `tier`            | String  | No       | Activity tier: bronze / silver / gold / platinum / diamond |
| `display_name`    | String  | No       | User's display name                                |
| `username`        | String  | No       | Unique @username (rate-limited changes, 7-day cooldown) |
| `xp`              | Integer | No       | Experience points                                  |
| `streak`          | Integer | No       | Current daily streak count                         |
| `avatar_url`      | String  | No       | URL of user's avatar image                         |
| `avatar_file_id`  | String  | No       | Appwrite file ID in the avatars bucket             |
| `last_activity`   | String  | No       | ISO 8601 timestamp of last activity                |
| `upload_count`    | Integer | No       | Total approved uploads; drives auto-promotion       |

---

## Collection: `uploads`

Audit trail of all file uploads, independent of approval status.

| Field       | Type   | Required | Notes                                       |
|-------------|--------|----------|---------------------------------------------|
| `user_id`   | String | Yes      | Appwrite user ID of uploader                |
| `file_id`   | String | Yes      | Appwrite file ID in the papers bucket       |
| `file_name` | String | Yes      | Original filename                           |
| `status`    | String | Yes      | "pending" \| "approved" \| "rejected"       |

---

## Collection: `activity_logs`

Admin action audit log for moderation events.

| Field            | Type   | Required | Notes                                          |
|------------------|--------|----------|------------------------------------------------|
| `action`         | String | Yes      | "approve" \| "reject" \| "role_change" \| "tier_change" |
| `target_user_id` | String | No       | Affected user ID (for user actions)            |
| `target_paper_id`| String | No       | Affected paper ID (for paper actions)          |
| `admin_id`       | String | Yes      | ID of admin who performed the action           |
| `admin_email`    | String | Yes      | Email of admin for audit trail                 |
| `details`        | String | No       | Human-readable description of the action       |
| `user_id`        | String | No       | **REMOVE** — duplicate of `admin_id`; use `admin_id` |
| `meta`           | String | No       | **REMOVE** — unused JSON blob field            |

---

## Collection: `achievements`

Per-user earned achievements / badges.

| Field         | Type   | Required | Notes                                        |
|---------------|--------|----------|----------------------------------------------|
| `user_id`     | String | Yes      | Appwrite user ID                             |
| `slug`        | String | Yes      | Machine identifier (e.g. "first_upload")     |
| `label`       | String | Yes      | Display label (e.g. "First Upload")          |
| `description` | String | No       | Human-readable description of the achievement |
| `earned_at`   | String | Yes      | ISO 8601 timestamp when the badge was earned  |

---

## Storage Buckets

| Bucket ID       | Purpose                         | Max File Size |
|-----------------|---------------------------------|---------------|
| `papers`        | Exam question paper PDFs        | 20 MB         |
| `syllabus-files`| Syllabus PDFs                   | 20 MB         |
| `avatars`       | User avatar images              | 5 MB          |

---

## Fields Recommended for Removal

| Collection      | Field         | Reason                                              |
|-----------------|---------------|-----------------------------------------------------|
| `users`         | `primary_role`| Legacy alias for `role`; all code now uses `role`   |
| `activity_logs` | `user_id`     | Duplicate of `admin_id`; creates confusion          |
| `activity_logs` | `meta`        | Unused JSON blob; not read anywhere in the codebase  |
