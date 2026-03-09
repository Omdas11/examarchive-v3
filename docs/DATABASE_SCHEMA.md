# Database Schema — ExamArchive v3

**Database ID:** `examarchive`

All collections live inside this single Appwrite database. The schema below reflects the live, active fields cross-referenced with the codebase. Fields marked **ADD TO APPWRITE** are used in code but absent from the live Appwrite schema. Fields marked **REMOVE** are candidates for deletion.

---

## Collection: `papers`

Stores exam question paper metadata. Files are held in the `papers` Appwrite Storage bucket.

| Field         | Type    | Required (DB) | Status  | Notes                                                        |
|---------------|---------|---------------|---------|--------------------------------------------------------------|
| `course_name` | String  | No            | ✅ Used  | Full paper name, resolved from syllabus registry             |
| `year`        | Integer | **Yes**       | ✅ Used  | Exam year (e.g. 2024)                                        |
| `semester`    | String  | No            | ✅ Used  | Ordinal string (e.g. "1st"); auto-resolved from registry     |
| `exam_type`   | String  | No            | ✅ Used  | "Theory" or "Practical"; derived from paper code suffix T/P  |
| `department`  | String  | No            | ✅ Used  | Disciplinary subject (e.g. "Physics"); auto-resolved         |
| `file_url`    | String  | **Yes**       | ✅ Used  | Public Appwrite Storage view URL                             |
| `uploaded_by` | String  | No            | ✅ Used  | Appwrite user ID of uploader                                 |
| `approved`    | Boolean | **Yes**       | ✅ Used  | `false` until admin approves                                 |
| `paper_type`  | String  | No            | ✅ Used  | Category: DSC / DSM / SEC / IDC / GE (FYUGP) or CC / DSC / DSE / GEC / SEC (CBCS) |
| `institute`   | String  | No            | ✅ Used  | University name (e.g. "Assam University")                    |

All fields match the codebase. No additions or removals required.

---

## Collection: `syllabus`

Stores syllabus document metadata. Files are held in the `syllabus-files` Appwrite Storage bucket.

| Field                  | Type    | Required (DB) | Status  | Notes                                               |
|------------------------|---------|---------------|---------|-----------------------------------------------------|
| `university`           | String  | No            | ✅ Used  | University name                                     |
| `subject`              | String  | No            | ✅ Used  | Full paper name, resolved from syllabus registry    |
| `department`           | String  | No            | ✅ Used  | Disciplinary subject (e.g. "Physics")               |
| `semester`             | String  | No            | ✅ Used  | Ordinal string; empty string for departmental docs  |
| `programme`            | String  | No            | ✅ Used  | "FYUGP" or "CBCS"; auto-resolved from registry      |
| `year`                 | Integer | No            | ✅ Used  | Year the syllabus is applicable                     |
| `uploader_id`          | String  | No            | ✅ Used  | Appwrite user ID of uploader                        |
| `approval_status`      | String  | No            | ✅ Used  | "pending" \| "approved" \| "rejected"               |
| `file_url`             | String  | No            | ✅ Used  | Public Appwrite Storage view URL                    |
| `uploaded_by_username` | String  | No            | ✅ Used  | Denormalised username for display                   |
| `is_hidden`            | Boolean | No            | ✅ Used  | Admin soft-hide flag (default: false)               |

All fields match the codebase. No additions or removals required.

---

## Collection: `users`

Stores user profile data alongside Appwrite Auth accounts.

| Field                    | Type     | Required (DB) | Status              | Notes                                              |
|--------------------------|----------|---------------|---------------------|----------------------------------------------------|
| `email`                  | String   | **Yes**       | ✅ Used              | User email address                                 |
| `role`                   | String   | **Yes**       | ✅ Used              | Primary role: visitor / explorer / contributor / verified_contributor / moderator / maintainer / admin / founder |
| `primary_role`           | String   | No            | ⚠️ Deprecated        | Legacy alias for `role`; the admin user-management route still allows updating it independently. Pending cleanup — `role` is the authoritative field for all access-control decisions. |
| `secondary_role`         | String   | No            | ✅ Used              | Cosmetic community role (display-only)             |
| `tertiary_role`          | String   | No            | ✅ Used              | Additional cosmetic community role                 |
| `tier`                   | String   | No            | ✅ Used              | Activity tier: bronze / silver / gold / platinum / diamond |
| `display_name`           | String   | No            | ✅ Used              | User's display name                                |
| `username`               | String   | No            | ✅ Used              | Unique @username                                   |
| `xp`                     | Integer  | No            | ✅ Used              | Experience points                                  |
| `streak`                 | Integer  | No            | ✅ Used              | Current daily streak count                         |
| `avatar_url`             | String   | No            | ✅ Used              | URL of user's avatar image                         |
| `avatar_file_id`         | String   | No            | ✅ Used              | Appwrite file ID in the avatars bucket             |
| `last_activity`          | Datetime | No            | ✅ Used              | ISO 8601 timestamp of last activity                |
| `upload_count`           | Integer  | No            | ✅ Used              | Total approved uploads; drives auto-promotion      |
| `username_last_changed`  | String   | —             | ❌ **ADD TO APPWRITE** | ISO 8601 timestamp of last username change; enforces 7-day cooldown in `/api/profile`. **Add as String, optional, to the `users` collection in Appwrite Console.** |

---

## Collection: `uploads`

Audit trail of all file uploads, independent of approval status.

| Field       | Type   | Required (DB) | Status  | Notes                                       |
|-------------|--------|---------------|---------|---------------------------------------------|
| `user_id`   | String | **Yes**       | ✅ Used  | Appwrite user ID of uploader                |
| `file_id`   | String | **Yes**       | ✅ Used  | Appwrite file ID in the papers bucket       |
| `file_name` | String | **Yes**       | ✅ Used  | Original filename                           |
| `status`    | String | **Yes**       | ✅ Used  | "pending" \| "approved" \| "rejected"       |

All fields match the codebase. No changes required.

---

## Collection: `activity_logs`

Admin action audit log for moderation events.

| Field             | Type   | Required (DB) | Status         | Notes                                                                   |
|-------------------|--------|---------------|----------------|-------------------------------------------------------------------------|
| `action`          | String | **Yes**       | ✅ Used         | "approve" \| "reject" \| "role_change" \| "tier_change"                 |
| `target_user_id`  | String | No            | ✅ Used         | Affected user ID (for user actions); nullable                           |
| `target_paper_id` | String | No            | ✅ Used         | Affected paper ID (for paper actions); nullable                         |
| `admin_id`        | String | No            | ✅ Used         | Appwrite user ID of the admin who acted                                 |
| `admin_email`     | String | No            | ✅ Used         | Admin email for audit trail                                             |
| `details`         | String | No            | ✅ Used         | Human-readable description of the action                                |
| `user_id`         | String | **Yes**       | ⚠️ Fix applied  | Required by DB schema. Code now writes `admin_id` value here for compat. Recommend changing `required` to false in Appwrite Console, or removing this field. |
| `meta`            | String | **Yes**       | ⚠️ Fix applied  | Required by DB schema but unused. Code now writes `""` (empty string). Recommend changing `required` to false in Appwrite Console, or removing this field. |

> **Action required in Appwrite Console:** Change `user_id` and `meta` in `activity_logs` from `required: true` to optional, then they can safely be deprecated. Until then, the code provides placeholder values to satisfy the constraint.

---

## Collection: `achievements`

Per-user earned achievements / badges.

| Field         | Type     | Required (DB) | Status  | Notes                                        |
|---------------|----------|---------------|---------|----------------------------------------------|
| `user_id`     | String   | **Yes**       | ✅ Used  | Appwrite user ID                             |
| `slug`        | String   | **Yes**       | ✅ Used  | Machine identifier (e.g. "first_upload")     |
| `label`       | String   | **Yes**       | ✅ Used  | Display label (e.g. "First Upload")          |
| `description` | String   | No            | ✅ Used  | Human-readable description                   |
| `earned_at`   | Datetime | **Yes**       | ✅ Used  | ISO 8601 timestamp when the badge was earned |

All fields match the codebase. No changes required.

---

## Storage Buckets

| Bucket ID        | Purpose                         | Max File Size |
|------------------|---------------------------------|---------------|
| `papers`         | Exam question paper PDFs        | 20 MB         |
| `syllabus-files` | Syllabus PDFs                   | 20 MB         |
| `avatars`        | User avatar images              | 5 MB          |

---

## Summary: Actions Required in Appwrite Console

| Priority | Collection      | Field                  | Action                                                     |
|----------|-----------------|------------------------|------------------------------------------------------------|
| 🔴 High  | `users`         | `username_last_changed`| **Add** as String (optional). Used by username cooldown.               |
| 🟡 Med   | `activity_logs` | `user_id`              | Change from `required: true` → optional (code always writes it for now) |
| 🟡 Med   | `activity_logs` | `meta`                 | Change from `required: true` → optional (code always writes `""`)       |
| 🟢 Low   | `users`         | `primary_role`         | Deprecated alias for `role`; remove once admin UI stops writing it      |
