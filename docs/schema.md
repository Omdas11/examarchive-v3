# ExamArchive v3 — Appwrite Database Schema

This document is a full audit of every collection in the `examarchive` Appwrite database.
It reflects the state observed in the console screenshots and maps each field to its usage
in the application code.

> **Legend**
> - ✅ **Active** — field is read or written by application code
> - ⚠️ **Legacy** — field exists in the DB but is only used for backward compatibility
> - ❌ **Unused** — field exists but is never read or written by current code; safe to remove after confirming no historical data dependency

---

## 1. `uploads` Collection

Tracks raw file uploads before they are fully processed. Used by the upload progress system.

| Column name       | Type              | Indexed | Default | Status | Notes                              |
|-------------------|-------------------|---------|---------|--------|------------------------------------|
| `$id`             | string            | ✅       | —       | ✅ Active | Appwrite auto-generated ID       |
| `user_id`         | string (Size: 36) | —       | —       | ✅ Active | Appwrite Auth user ID            |
| `file_id`         | string (Size: 36) | —       | —       | ✅ Active | Appwrite Storage file ID         |
| `file_name`       | string (Size: 255)| —       | —       | ✅ Active | Original filename                |
| `status`          | string (Size: 50) | —       | —       | ✅ Active | `"pending"` \| `"complete"` \| `"failed"` |
| `$createdAt`      | datetime          | —       | —       | ✅ Active | Appwrite auto-timestamp          |
| `$updatedAt`      | datetime          | —       | —       | ✅ Active | Appwrite auto-timestamp          |

---

## 2. `users` Collection

Application-level user profiles stored alongside Appwrite Auth accounts.

| Column name            | Type                              | Indexed | Default | Status   | Notes                                           |
|------------------------|-----------------------------------|---------|---------|----------|-------------------------------------------------|
| `$id`                  | string                            | ✅       | —       | ✅ Active | Matches Appwrite Auth user ID                   |
| `email`                | text                              | —       | —       | ✅ Active | User email address                              |
| `role`                 | text                              | —       | —       | ✅ Active | Primary role: `student\|moderator\|admin\|founder` |
| `primary_role`         | text                              | —       | —       | ✅ Active | Mirrors `role`; used in extended profile        |
| `secondary_role`       | text                              | —       | —       | ✅ Active | Custom role (see `CustomRole` type)             |
| `tertiary_role`        | text                              | —       | —       | ✅ Active | Third optional role designation                 |
| `tier`                 | text                              | —       | —       | ✅ Active | `bronze\|silver\|gold\|platinum\|diamond`       |
| `display_name`         | string (Size: 50)                 | —       | —       | ✅ Active | Public display name (mapped to `name` in code)  |
| `username`             | string (Size: 50)                 | —       | —       | ✅ Active | Unique username; cooldown of 7 days             |
| `xp`                   | integer (Min: 0, Max: 10000)      | —       | —       | ✅ Active | Cosmetic XP points                              |
| `streak`               | integer                           | —       | —       | ✅ Active | Current daily streak (mapped as `streak_days`)  |
| `avatar_url`           | string (Size: 512)                | —       | —       | ✅ Active | Public URL of avatar image                      |
| `avatar_file_id`       | string (Size: 36)                 | —       | —       | ✅ Active | Appwrite Storage file ID for the avatar         |
| `last_activity`        | datetime                          | —       | —       | ✅ Active | ISO-8601 timestamp of last upload/activity      |
| `upload_count`         | integer (Min: 0, Max: 10000)      | —       | —       | ✅ Active | Total approved uploads by this user             |
| `username_last_changed`| datetime                          | —       | —       | ✅ Active | Enforces 7-day cooldown on username changes     |
| `$createdAt`           | datetime                          | —       | —       | ✅ Active | Appwrite auto-timestamp                         |
| `$updatedAt`           | datetime                          | —       | —       | ✅ Active | Appwrite auto-timestamp                         |

> **Note:** Code maps `display_name` → `name`, `streak` → `streak_days` for the `UserProfile` interface.

---

## 3. `achievements` Collection

Stores individual achievement records earned by users.

| Column name      | Type               | Indexed | Default | Status   | Notes                                        |
|------------------|--------------------|---------|---------|----------|----------------------------------------------|
| `$id`            | string             | ✅       | —       | ✅ Active | Appwrite auto-generated ID                   |
| `user_id`        | string (Size: 36)  | —       | —       | ✅ Active | Foreign key to `users.$id`                   |
| `slug`           | string (Size: 100) | —       | —       | ✅ Active | Achievement identifier (e.g. `"first_upload"`) |
| `label`          | string (Size: 255) | —       | —       | ✅ Active | Human-readable achievement title             |
| `description`    | string (Size: 512) | —       | NULL    | ✅ Active | Achievement description                      |
| `earned_at`      | datetime           | —       | —       | ✅ Active | When the achievement was earned              |
| `$createdAt`     | datetime           | —       | —       | ✅ Active | Appwrite auto-timestamp                      |
| `$updatedAt`     | datetime           | —       | —       | ✅ Active | Appwrite auto-timestamp                      |

---

## 4. `syllabus` Collection

Stores community-uploaded syllabus PDFs pending admin approval.

| Column name            | Type                         | Indexed | Default | Status   | Notes                                                |
|------------------------|------------------------------|---------|---------|----------|------------------------------------------------------|
| `$id`                  | string                       | ✅       | —       | ✅ Active | Appwrite auto-generated ID                           |
| `university`           | string (Size: 100)           | —       | NULL    | ✅ Active | University or institution name                       |
| `subject`              | string (Size: 100)           | —       | NULL    | ✅ Active | Subject or course name                               |
| `department`           | string (Size: 100)           | —       | NULL    | ✅ Active | Department or academic stream                        |
| `semester`             | string (Size: 5)             | —       | NULL    | ✅ Active | Semester (e.g. `"1st"`); **empty string** = departmental (all semesters) |
| `programme`            | string (Size: 50)            | —       | NULL    | ✅ Active | Programme framework (e.g. `"FYUG"`, `"CBCS"`)        |
| `year`                 | integer (Min: 1900, Max: 2100)| —      | NULL    | ✅ Active | Academic year (e.g. 2024)                            |
| `uploader_id`          | string (Size: 36)            | —       | NULL    | ✅ Active | Appwrite Auth user ID of the uploader                |
| `approval_status`      | enum                         | —       | NULL    | ✅ Active | `"pending"` \| `"approved"` \| `"rejected"`          |
| `file_url`             | string (Size: 512)           | —       | NULL    | ✅ Active | Public URL of the syllabus PDF in Appwrite Storage   |
| `uploaded_by_username` | string (Size: 100)           | —       | NULL    | ⚠️ Legacy | Denormalised username; may be empty for new uploads  |
| `is_hidden`            | boolean                      | —       | false   | ✅ Active | Admin soft-hide flag                                 |
| `$createdAt`           | datetime                     | —       | —       | ✅ Active | Appwrite auto-timestamp                              |
| `$updatedAt`           | datetime                     | —       | —       | ✅ Active | Appwrite auto-timestamp                              |

### Departmental Syllabus Convention

A syllabus document with `semester = ""` (empty string) represents a **Departmental Syllabus** — a full programme syllabus covering all semesters (e.g. *Physics FYUG Full Syllabus*).

The `/syllabus` page (SyllabusClient.tsx) uses this convention to separate:
- **Departmental Syllabus** section: documents where `!semester || semester === ""`
- **Semester Syllabi** section: documents where `semester` is a non-empty value

No additional database column is needed.

---

## 5. `papers` Collection

Core collection for exam question papers.

> **Note:** For the canonical schema reference see `docs/backend-schema.md`.
> The table below reflects only the fields that actually exist in Appwrite.
> Fields previously documented here (`title`, `course_code`, `institution`,
> `programme`) are **not** in the backend schema and have been removed from the
> upload API payload to prevent "Unknown attribute" errors.

| Column name      | Type                          | Indexed | Default | Status   | Notes                                             |
|------------------|-------------------------------|---------|---------|----------|---------------------------------------------------|
| `$id`            | string                        | ✅       | —       | ✅ Active | Appwrite auto-generated ID                        |
| `course_name`    | text                          | —       | —       | ✅ Active | Full course / paper name                          |
| `year`           | integer                       | —       | —       | ✅ Active | Exam year                                         |
| `semester`       | text                          | —       | —       | ✅ Active | e.g. `"1st"`, `"2nd"` — optional                 |
| `exam_type`      | text                          | —       | —       | ✅ Active | `"Theory"` \| `"Practical"` — optional            |
| `department`     | text                          | —       | —       | ✅ Active | Department or academic stream                     |
| `file_url`       | text                          | —       | —       | ✅ Active | Public URL of the question paper PDF              |
| `uploaded_by`    | text                          | —       | —       | ✅ Active | Appwrite Auth user ID of the uploader             |
| `approved`       | boolean                       | —       | —       | ✅ Active | Admin approval flag                               |
| `paper_type`     | string (Size: 10)             | —       | NULL    | ✅ Active | `"DSC"` \| `"DSM"` \| `"SEC"` \| `"IDC"` \| `"GE"` \| `"CC"` \| `"DSE"` \| `"GEC"` — optional |
| `institute`      | text                          | —       | NULL    | ✅ Active | University or institution name — optional; replaces legacy `institution` field |
| `$createdAt`     | datetime                      | —       | —       | ✅ Active | Appwrite auto-timestamp                           |
| `$updatedAt`     | datetime                      | —       | —       | ✅ Active | Appwrite auto-timestamp                           |

### Removed / Unsupported Fields

The following fields **do not exist** in the Appwrite `papers` collection and
must **not** be included in `createDocument` or `updateDocument` calls:

| Field         | Previously Used As  | Current Resolution                                               |
|---------------|---------------------|------------------------------------------------------------------|
| `title`       | paper display name  | Use `course_name` instead; `toPaper()` falls back to `course_name` for `Paper.title` |
| `course_code` | paper code filter   | Not stored in new uploads; may be present in legacy documents    |
| `institution` | university name     | **Renamed to `institute`** in the schema                         |
| `programme`   | FYUGP / CBCS        | Not stored in papers; available in the syllabus registry         |

---

## 6. `activity_logs` Collection

Admin action audit log. Records all moderation and role-change actions.

| Column name       | Type                | Indexed | Default | Status   | Notes                                          |
|-------------------|---------------------|---------|---------|----------|------------------------------------------------|
| `$id`             | string              | ✅       | —       | ✅ Active | Appwrite auto-generated ID                     |
| `action`          | string (Size: 64)   | —       | —       | ✅ Active | `"approve"` \| `"reject"` \| `"role_change"` \| `"tier_change"` |
| `target_user_id`  | string (Size: 64)   | —       | NULL    | ✅ Active | Affected user ID (for role changes)            |
| `target_paper_id` | string (Size: 64)   | —       | NULL    | ✅ Active | Affected paper/syllabus ID (for approvals)     |
| `admin_id`        | string (Size: 32)   | —       | NULL    | ✅ Active | Admin/moderator who performed the action       |
| `admin_email`     | string (Size: 32)   | —       | NULL    | ✅ Active | Email of admin/moderator                       |
| `details`         | string (Size: 1024) | —       | NULL    | ✅ Active | Free-text description of the action            |
| `user_id`         | string (Size: 36)   | —       | —       | ✅ Active | Duplicates `admin_id`; kept for query indexing |
| `meta`            | string (Size: 1024) | —       | —       | ⚠️ Legacy | JSON metadata; rarely populated               |
| `$createdAt`      | datetime            | —       | —       | ✅ Active | Appwrite auto-timestamp                        |
| `$updatedAt`      | datetime            | —       | —       | ✅ Active | Appwrite auto-timestamp                        |

---

## Summary: Potentially Unused / Deprecated Fields

| Collection      | Field                  | Reason                                              |
|-----------------|------------------------|-----------------------------------------------------|
| `papers`        | `marks`                | Optional, rarely set by uploaders                   |
| `papers`        | `duration`             | Optional, rarely set by uploaders                   |
| `papers`        | `uploaded_by_username` | Denormalised; can become stale when username changes |
| `syllabus`      | `uploaded_by_username` | Denormalised; not reliably populated               |
| `activity_logs` | `meta`                 | JSON blob; rarely used; could be merged into `details` |

See `docs/backend-cleanup.md` for safe removal guidance.

---

## 7. `notifications` Collection (Planned — Phase 1)

Stores in-app notification records for users. **Not yet created in Appwrite Console.**
See `docs/messaging-setup.md` for full setup instructions.

| Column name    | Type                 | Indexed | Default | Status       | Notes                                                    |
|----------------|----------------------|---------|---------|--------------|----------------------------------------------------------|
| `$id`          | string               | ✅       | —       | 🔜 Planned   | Appwrite auto-generated ID                               |
| `user_id`      | string (Size: 36)    | ✅       | —       | 🔜 Planned   | Recipient user ID (links to `users.$id`)                 |
| `type`         | enum                 | —       | —       | 🔜 Planned   | `paper_approved` \| `paper_rejected` \| `role_changed` \| `badge_earned` \| `announcement` |
| `title`        | string (Size: 100)   | —       | —       | 🔜 Planned   | Short notification heading                               |
| `body`         | string (Size: 512)   | —       | —       | 🔜 Planned   | Notification body text                                   |
| `link`         | string (Size: 512)   | —       | NULL    | 🔜 Planned   | Optional deep-link URL (e.g. `/paper/:id`)               |
| `is_read`      | boolean              | ✅       | false   | 🔜 Planned   | `false` on creation; user marks as read                  |
| `meta`         | string (Size: 1024)  | —       | NULL    | 🔜 Planned   | Optional JSON payload (paper ID, role, etc.)             |
| `$createdAt`   | datetime             | —       | —       | 🔜 Planned   | Appwrite auto-timestamp                                  |
| `$updatedAt`   | datetime             | —       | —       | 🔜 Planned   | Appwrite auto-timestamp                                  |
