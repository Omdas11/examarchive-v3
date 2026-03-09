# ExamArchive v3 — Backend Schema Reference

This document is the authoritative reference for every collection in the
`examarchive` Appwrite database.  It reflects the **actual fields** present in
the Appwrite Console and maps each field to its usage in the application code.

> **Intended audience:** Contributors who need to understand the data model,
> add new features, or clean up unused fields.

> **Legend**
> | Symbol | Meaning |
> |--------|---------|
> | ✅ Active | Field is actively read or written by current application code |
> | ⚠️ Legacy | Field exists in the DB but is only used for backward-compatibility or rarely populated |
> | ❌ Unused | Field exists in the DB but is never read or written by current code; **safe to remove** after confirming no historical data dependency |
> | 🚫 Removed | Field was previously in the code but has been removed to align with the actual schema |

---

## 1. `papers` Collection

Stores exam question papers.  All papers start with `approved: false` and are
only visible to the public after an admin sets `approved: true`.

### Schema

| Field            | Appwrite Type           | Required | Status    | Notes                                                                   |
|------------------|-------------------------|----------|-----------|-------------------------------------------------------------------------|
| `$id`            | string (auto)           | ✅        | ✅ Active  | Appwrite-generated document ID                                          |
| `course_name`    | string                  | ✅        | ✅ Active  | Full paper / course name (e.g. "Mathematical Physics - I")              |
| `year`           | integer (1900–2100)     | ✅        | ✅ Active  | Exam year (e.g. 2024)                                                   |
| `semester`       | string                  | —        | ✅ Active  | e.g. "1st", "2nd" — optional                                            |
| `exam_type`      | string                  | —        | ✅ Active  | "Theory" or "Practical" — optional                                      |
| `department`     | string                  | ✅        | ✅ Active  | Department or academic stream (e.g. "Physics")                          |
| `file_url`       | string                  | ✅        | ✅ Active  | Public view URL of the question-paper PDF in Appwrite Storage           |
| `uploaded_by`    | string (user ID)        | ✅        | ✅ Active  | Appwrite Auth user ID of the uploader                                   |
| `approved`       | boolean                 | ✅        | ✅ Active  | `false` = pending review; `true` = visible on `/browse`                 |
| `paper_type`     | string                  | —        | ✅ Active  | FYUGP: "DSC"\|"DSM"\|"SEC"\|"IDC"\|"GE"; CBCS: "CC"\|"DSC"\|"DSE"\|"GEC"\|"SEC" |
| `institute`      | string                  | —        | ✅ Active  | University or institution name (e.g. "Assam University") — optional     |
| `$createdAt`     | datetime (auto)         | —        | ✅ Active  | Appwrite auto-timestamp                                                  |
| `$updatedAt`     | datetime (auto)         | —        | ✅ Active  | Appwrite auto-timestamp                                                  |

### Previously Sent — Now Removed

The following fields were being sent by the upload API but **are not present in
the actual Appwrite schema**.  They have been removed from `POST /api/upload`
to prevent "Unknown attribute" errors:

| Field         | Was Sent As       | Resolution                                           |
|---------------|-------------------|------------------------------------------------------|
| `title`       | paper name        | Removed; `course_name` serves the same purpose. `toPaper()` falls back to `course_name` when `title` is absent. |
| `course_code` | e.g. "PHYDSC101T" | Removed from write payload; existing documents still display it via `toPaper()` backward-compat fallback. |
| `institution` | university name   | **Renamed to `institute`** to match the actual schema field name. |
| `programme`   | "FYUGP"\|"CBCS"   | Removed; not present in the papers collection schema. |

### Backward Compatibility

`toPaper()` in `src/types/index.ts` maps:
- `doc.title ?? doc.course_name` → `Paper.title` (so existing documents with a `title` field still display correctly)
- `doc.institute ?? doc.institution` → `Paper.institution` (so documents created before the rename still display correctly)

---

## 2. `uploads` Collection

Tracks every raw file upload independently of the admin approval state.
An entry is created here as soon as the metadata POST succeeds, regardless of
whether the paper is ever approved.

### Schema

| Field       | Appwrite Type      | Required | Status   | Notes                                                     |
|-------------|-------------------|----------|----------|-----------------------------------------------------------|
| `$id`       | string (auto)      | ✅        | ✅ Active | Appwrite-generated document ID                            |
| `user_id`   | string (size: 36)  | ✅        | ✅ Active | Appwrite Auth user ID of the uploader                     |
| `file_id`   | string (size: 36)  | ✅        | ✅ Active | Appwrite Storage file ID                                  |
| `file_name` | string (size: 255) | ✅        | ✅ Active | Original filename (e.g. "physics_sem1_2024.pdf")          |
| `status`    | string (size: 50)  | ✅        | ✅ Active | `"pending"` on upload; `"complete"` / `"failed"` possible |
| `$createdAt`| datetime (auto)    | —        | ✅ Active | Appwrite auto-timestamp                                   |
| `$updatedAt`| datetime (auto)    | —        | ✅ Active | Appwrite auto-timestamp                                   |

### Flow

1. **Upload** → `POST /api/upload` creates an `uploads` document with `status: "pending"`.
2. **Approval** → Admin approves the corresponding `papers` document (`approved: true`).
   The `uploads` record remains as an audit trail.

---

## 3. `users` Collection

Application-level user profiles stored alongside Appwrite Auth accounts.
Each document `$id` matches the Appwrite Auth user ID.

### Schema

| Field                  | Appwrite Type                  | Required | Status     | Notes                                                       |
|------------------------|-------------------------------|----------|------------|-------------------------------------------------------------|
| `$id`                  | string (auto)                  | ✅        | ✅ Active   | Matches Appwrite Auth user ID                               |
| `email`                | string                         | ✅        | ✅ Active   | User email address                                          |
| `role`                 | string                         | ✅        | ✅ Active   | Primary role: `visitor\|student\|explorer\|contributor\|verified_contributor\|moderator\|maintainer\|admin\|founder` |
| `primary_role`         | string                         | —        | ⚠️ Legacy  | Mirrors `role`; kept for backward-compat in admin views     |
| `secondary_role`       | string                         | —        | ✅ Active   | Cosmetic community role (see `CustomRole` type)             |
| `tertiary_role`        | string                         | —        | ✅ Active   | Third optional community designation                        |
| `tier`                 | string                         | —        | ✅ Active   | Activity tier: `bronze\|silver\|gold\|platinum\|diamond`    |
| `display_name`         | string (size: 50)              | —        | ✅ Active   | Public display name (code maps → `UserProfile.name`)        |
| `username`             | string (size: 50)              | —        | ✅ Active   | Unique @username; 7-day change cooldown enforced server-side |
| `xp`                   | integer (0–10000)              | —        | ✅ Active   | Cosmetic XP points                                          |
| `streak`               | integer                        | —        | ✅ Active   | Current daily upload streak (code maps → `streak_days`)     |
| `avatar_url`           | string (size: 512)             | —        | ✅ Active   | Public URL of avatar image                                  |
| `avatar_file_id`       | string (size: 36)              | —        | ✅ Active   | Appwrite Storage file ID for avatar                         |
| `last_activity`        | datetime                       | —        | ✅ Active   | ISO-8601 timestamp of last upload or activity               |
| `upload_count`         | integer (0–10000)              | —        | ✅ Active   | Total approved uploads; drives auto-promotion               |
| `username_last_changed`| datetime                       | —        | ✅ Active   | Enforces 7-day cooldown on username changes                 |
| `$createdAt`           | datetime (auto)                | —        | ✅ Active   | Appwrite auto-timestamp                                     |
| `$updatedAt`           | datetime (auto)                | —        | ✅ Active   | Appwrite auto-timestamp                                     |

> **Code mappings:** `display_name` → `name` in `UserProfile`; `streak` → `streak_days`.

### Recommended Cleanup

| Field          | Recommendation                                              |
|----------------|-------------------------------------------------------------|
| `primary_role` | ⚠️ Safe to remove once all consumers use `role` directly.  |

---

## 4. `syllabus` Collection

Stores community-uploaded syllabus PDFs pending admin approval.

### Schema

| Field                  | Appwrite Type               | Required | Status     | Notes                                                              |
|------------------------|-----------------------------|----------|------------|--------------------------------------------------------------------|
| `$id`                  | string (auto)               | ✅        | ✅ Active   | Appwrite-generated document ID                                     |
| `university`           | string (size: 100)          | ✅        | ✅ Active   | University or institution name                                     |
| `subject`              | string (size: 100)          | ✅        | ✅ Active   | Subject or course name                                             |
| `department`           | string (size: 100)          | ✅        | ✅ Active   | Department or academic stream                                      |
| `semester`             | string (size: 5)            | —        | ✅ Active   | Semester (e.g. `"1st"`); **empty string `""`** = departmental (all semesters) |
| `programme`            | string (size: 50)           | —        | ✅ Active   | Programme framework (e.g. `"FYUG"`, `"CBCS"`)                     |
| `year`                 | integer (1900–2100)         | ✅        | ✅ Active   | Academic year                                                      |
| `uploader_id`          | string (size: 36)           | ✅        | ✅ Active   | Appwrite Auth user ID of the uploader                              |
| `approval_status`      | enum                        | ✅        | ✅ Active   | `"pending"` \| `"approved"` \| `"rejected"`                       |
| `file_url`             | string (size: 512)          | ✅        | ✅ Active   | Public view URL of the syllabus PDF in Appwrite Storage            |
| `uploaded_by_username` | string (size: 100)          | —        | ⚠️ Legacy  | Denormalised username; may be empty for new uploads                |
| `is_hidden`            | boolean                     | —        | ✅ Active   | Admin soft-hide flag; hides document from public pages             |
| `$createdAt`           | datetime (auto)             | —        | ✅ Active   | Appwrite auto-timestamp                                            |
| `$updatedAt`           | datetime (auto)             | —        | ✅ Active   | Appwrite auto-timestamp                                            |

### Departmental Syllabus Convention

A syllabus document with `semester = ""` (empty string) represents a
**Departmental Syllabus** — a full programme syllabus covering all semesters.
`SyllabusClient.tsx` separates these into a dedicated section using:
```ts
const isDeptSyllabus = (s: Syllabus) => !s.semester || s.semester === "";
```

### Recommended Cleanup

| Field                  | Recommendation                                                          |
|------------------------|-------------------------------------------------------------------------|
| `uploaded_by_username` | ⚠️ Safe to remove if denormalisation is no longer required; look up username dynamically from `users` collection instead. |

---

## 5. `achievements` Collection

Individual achievement records earned by users.

### Schema

| Field         | Appwrite Type       | Required | Status   | Notes                                         |
|---------------|---------------------|----------|----------|-----------------------------------------------|
| `$id`         | string (auto)       | ✅        | ✅ Active | Appwrite-generated document ID                |
| `user_id`     | string (size: 36)   | ✅        | ✅ Active | Foreign key → `users.$id`                     |
| `slug`        | string (size: 100)  | ✅        | ✅ Active | Achievement identifier (e.g. `"first_upload"`) |
| `label`       | string (size: 255)  | ✅        | ✅ Active | Human-readable achievement title              |
| `description` | string (size: 512)  | —        | ✅ Active | Achievement description                       |
| `earned_at`   | datetime            | ✅        | ✅ Active | When the achievement was earned               |
| `$createdAt`  | datetime (auto)     | —        | ✅ Active | Appwrite auto-timestamp                       |
| `$updatedAt`  | datetime (auto)     | —        | ✅ Active | Appwrite auto-timestamp                       |

---

## 6. `activity_logs` Collection

Admin action audit log.  Records all moderation and role-change actions.

### Schema

| Field             | Appwrite Type        | Required | Status     | Notes                                                     |
|-------------------|----------------------|----------|------------|-----------------------------------------------------------|
| `$id`             | string (auto)        | ✅        | ✅ Active   | Appwrite-generated document ID                            |
| `action`          | string (size: 64)    | ✅        | ✅ Active   | `"approve"` \| `"reject"` \| `"role_change"` \| `"tier_change"` |
| `target_user_id`  | string (size: 64)    | —        | ✅ Active   | Affected user (for role/tier changes)                     |
| `target_paper_id` | string (size: 64)    | —        | ✅ Active   | Affected paper or syllabus ID (for approvals/rejections)  |
| `admin_id`        | string (size: 32)    | —        | ✅ Active   | Appwrite Auth user ID of the acting admin/moderator       |
| `admin_email`     | string (size: 32)    | —        | ✅ Active   | Email address of the acting admin/moderator               |
| `details`         | string (size: 1024)  | —        | ✅ Active   | Free-text description of the action                       |
| `user_id`         | string (size: 36)    | —        | ⚠️ Legacy  | Duplicates `admin_id`; kept for legacy query indexing     |
| `meta`            | string (size: 1024)  | —        | ⚠️ Legacy  | JSON metadata blob; rarely populated                      |
| `$createdAt`      | datetime (auto)      | —        | ✅ Active   | Appwrite auto-timestamp                                   |
| `$updatedAt`      | datetime (auto)      | —        | ✅ Active   | Appwrite auto-timestamp                                   |

### Recommended Cleanup

| Field    | Recommendation                                                            |
|----------|---------------------------------------------------------------------------|
| `user_id`| ⚠️ Redundant with `admin_id`; safe to remove once query indexes are updated. |
| `meta`   | ⚠️ Merge relevant data into `details` (JSON string) then remove the column.  |

---

## Summary: Active vs Unused Fields

### Fields Flagged as Legacy / Unused

| Collection      | Field                  | Status     | Recommended Action                                                       |
|-----------------|------------------------|------------|--------------------------------------------------------------------------|
| `papers`        | `institute` rename     | ✅ Fixed   | `institution` has been renamed to `institute` in the upload payload; `toPaper()` handles both for backward-compat. |
| `users`         | `primary_role`         | ⚠️ Legacy  | Remove after migrating all consumers to use `role`.                      |
| `syllabus`      | `uploaded_by_username` | ⚠️ Legacy  | Remove if denormalisation is no longer needed.                           |
| `activity_logs` | `user_id`              | ⚠️ Legacy  | Remove after updating query indexes to use `admin_id`.                   |
| `activity_logs` | `meta`                 | ⚠️ Legacy  | Merge into `details`, then remove.                                       |

### Fields Safe to Drop Immediately

None of the above fields are written to by current code (they are only read for
backward-compatibility).  Dropping them requires:
1. Confirming no historical documents rely on them for display.
2. Removing the column in the Appwrite Console.
3. Removing fallback reads from `toPaper()` / `toAdminUser()` / `toActivityLog()`.

See `docs/backend-cleanup.md` for step-by-step removal guidance.

---

## Upload Flow Summary

```
Browser
  │
  ├─ 1. GET /api/upload/token
  │       └── Returns short-lived JWT for direct storage upload
  │
  ├─ 2. Upload file → Appwrite Storage (papers bucket)
  │       └── Returns fileId
  │
  ├─ 3. POST /api/upload  (JSON metadata)
  │       ├── Creates `uploads` document  { user_id, file_id, file_name, status: "pending" }
  │       └── Creates `papers` document   { course_name, year, department, file_url,
  │                                          uploaded_by, approved: false, semester?,
  │                                          exam_type?, institute?, paper_type? }
  │
  └─ 4. Admin review at /admin
          └── Approve → papers.approved = true → paper appears on /browse
```

---

## Environment Variables

```bash
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=<project-id>
APPWRITE_API_KEY=<server-api-key>

# Collection / bucket IDs (defaults used if env vars absent)
APPWRITE_BUCKET_ID=papers
APPWRITE_SYLLABUS_BUCKET_ID=syllabus-files
APPWRITE_AVATARS_BUCKET_ID=avatars
```
