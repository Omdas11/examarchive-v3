# ExamArchive v3 — Architecture Overview

This document describes the technical architecture of ExamArchive v3, including the data model, upload pipeline, admin moderation system, and key design decisions.

---

## Tech Stack

| Layer       | Technology                                    |
| ----------- | --------------------------------------------- |
| Framework   | Next.js 15 (App Router, TypeScript)           |
| Styling     | TailwindCSS + CSS custom properties (theming) |
| Backend     | Appwrite (Database, Auth, Storage)            |
| Deploy      | Vercel (recommended)                          |

---

## High-Level Architecture

```
Browser
  │
  ├─ Next.js Server Components (SSR)
  │    └─ Fetch from Appwrite via adminDatabases() (server-side API key)
  │
  ├─ Next.js Client Components
  │    └─ Interactive UI (filters, modals, tabs, toasts)
  │
  └─ API Routes (/api/*)
       └─ Server-side handlers — verify session, call Appwrite, return JSON
```

All Appwrite calls that require admin-level access (read all documents, write to any collection) go through the **server-side admin client** (`adminDatabases()`, `adminStorage()`), which uses `APPWRITE_API_KEY`. The browser never sees the API key.

For file uploads, the browser calls `GET /api/upload/token` to receive a short-lived JWT and then uploads the file **directly** to Appwrite Storage. This avoids buffering large files through the Next.js server.

---

## Database Schema

### Database: `examarchive`

#### Collection: `papers`

Stores exam question paper metadata. The actual PDF lives in the `papers` Appwrite Storage bucket.

```
papers {
  title                 string   required
  course_code           string   required
  course_name           string   required
  year                  integer  required
  semester              string   required
  exam_type             string   required
  department            string   required
  file_url              string   required  — public URL to PDF
  uploaded_by           string   required  — Appwrite User ID
  uploaded_by_username  string             — denormalised for display
  approved              boolean            — false until moderated
  stream                string
  institution           string
  programme             string
  marks                 integer
  duration              integer            — minutes
  view_count            integer            — default 0
  download_count        integer            — default 0
}
```

#### Collection: `syllabus`

Stores syllabus document metadata. The actual PDF lives in the `syllabus-files` Appwrite Storage bucket.

```
syllabus {
  university            string   required
  subject               string   required
  department            string   required
  semester              string   required
  programme             string
  year                  integer
  uploader_id           string   required  — Appwrite User ID
  uploaded_by_username  string             — denormalised for display
  approval_status       string   required  — "pending" | "approved" | "rejected"
  file_url              string   required  — public URL to PDF
}
```

#### Collection: `users`

Extended user profile stored alongside Appwrite Auth.

```
users {
  display_name          string   — full name
  username              string   — unique @handle
  email                 string
  avatar_url            string
  avatar_file_id        string   — file ID in avatars bucket
  role                  string   — "student" | "moderator" | "admin" | "founder"
  primary_role          string   — mirrors role
  secondary_role        string   — optional community role
  tier                  string   — "bronze" | "silver" | "gold" | "platinum" | "diamond"
  xp                    integer  — default 0
  streak_days           integer  — default 0
  last_activity         string   — ISO timestamp
  upload_count          integer  — auto-incremented on paper approval
  username_last_changed string   — ISO timestamp (7-day cooldown)
}
```

#### Collection: `activity_logs`

Records all moderation actions for audit purposes.

```
activity_logs {
  action           string   — "approve" | "reject" | "role_change" | "tier_change"
  target_user_id   string   — nullable
  target_paper_id  string   — nullable (also used for syllabus document IDs)
  admin_id         string   — Appwrite User ID of the moderator
  admin_email      string
  details          string   — human-readable description
}
```

---

## Storage Buckets

| Bucket ID        | Contents         | Access |
| ---------------- | ---------------- | ------ |
| `papers`         | Exam paper PDFs  | Public |
| `avatars`        | User avatars     | Public |
| `syllabus-files` | Syllabus PDFs    | Public |

---

## Upload Pipelines

### Paper Upload

```
1. User fills UploadForm (title, course, year, semester, exam type, department, PDF)
2. Browser calls GET /api/upload/token  →  receives short-lived JWT
3. Browser uploads PDF directly to Appwrite Storage (papers bucket) using JWT
4. Browser calls POST /api/upload with JSON metadata + fileId
5. Server verifies file exists, creates document in `papers` with approved=false
6. Admin reviews paper on /admin (Pending tab) and clicks Approve or Reject
7. Approve: sets approved=true, increments uploader's upload_count, logs action
8. Reject: deletes document, logs action
```

### Syllabus Upload

```
1. User fills SyllabusUploadForm (university, subject, department, semester, programme, year, PDF)
2. Browser calls GET /api/upload/token  →  receives short-lived JWT
3. Browser uploads PDF directly to Appwrite Storage (syllabus-files bucket) using JWT
4. Browser calls POST /api/upload/syllabus with JSON metadata + fileId
5. Server verifies file exists, creates document in `syllabus` with approval_status="pending"
6. Admin reviews syllabus on /admin (Syllabus tab) and clicks Approve, Reject, or PDF
7. Approve: sets approval_status="approved", logs action
   → Syllabus now appears on public /syllabus page
8. Reject: sets approval_status="rejected", logs action
```

---

## Admin Moderation System

The admin dashboard (`/admin`) is accessible to users with role `moderator`, `admin`, or `founder`. It consists of four tabs:

### Pending Papers Tab

- Fetches documents from `papers` where `approved = false` (server-side, in `admin/page.tsx`).
- Rendered by `AdminActions.tsx` (client component).
- Actions: **Approve** (`approved=true` + XP/gamification) or **Reject** (hard delete).

### Syllabus Tab

- Fetches documents from `syllabus` where `approval_status = "pending"` (server-side, in `admin/page.tsx`).
- Rendered by `SyllabusModeration.tsx` (client component).
- Table columns: University, Programme, Dept/Stream, Subject, Year, Semester, Uploaded by, Date, Actions.
- Actions: **Approve** (`approval_status="approved"`), **Reject** (`approval_status="rejected"`), **PDF** (preview link).
- Both actions call `POST /api/admin` with the appropriate `action` key.

### Users Tab

- Admin-only. Lists all users from the `users` collection.
- Rendered by `UserManagement.tsx`.
- Supports inline role and tier changes.

### Activity Log Tab

- Lists all entries from `activity_logs` ordered newest-first.
- Rendered by `ActivityLog.tsx`.

---

## Role System

```
founder  ──► admin  ──► moderator  ──► student
  (4)           (3)          (2)           (1)
```

Role checks are **always** performed server-side using helpers from `src/lib/roles.ts`:

- `isModerator(role)` — true for moderator, admin, founder
- `isAdmin(role)` — true for admin, founder
- `isFounder(role)` — true for founder only

The middleware at `src/middleware.ts` redirects unauthenticated requests to `/login`.

---

## Gamification

When a paper is approved:

1. The uploader's `upload_count` is incremented.
2. At `upload_count >= 3` (and no existing `secondary_role`): `secondary_role` is set to `"contributor"`.
3. At `upload_count >= 20` (and `tier === "bronze"`): `tier` is promoted to `"silver"`.

XP is tracked separately and can be granted through activities (viewing, uploading) or manually via the DevTool.

---

## DevTool (Founder Only)

Accessible at `/devtool`. Operations:

| Action                | Description                                                    |
| --------------------- | -------------------------------------------------------------- |
| System Health Check   | Tests Appwrite DB and Storage connectivity                     |
| Role Override         | Force-set a user's primary role by Appwrite User ID            |
| XP Manipulation       | Add or set XP for a specific user                              |
| Reset All Users XP    | Sets XP and streak_days to 0 for every user                    |
| Clear Pending Uploads | Bulk-deletes all unapproved papers (`approved=false`)          |
| Clear Pending Syllabi | Bulk-deletes all pending syllabi (`approval_status="pending"`) |
| Clear Activity Logs   | Truncates the `activity_logs` collection                       |
| Reset All Papers      | **DANGER**: Permanently deletes every paper                    |

---

## UI Component Notes

### PaperCard

Located at `src/components/PaperCard.tsx`. Each card renders as a flex container:

- **Left**: a `w-1` vertical bar whose colour is determined by `subjectColor(department)`.
- **Right** (`p-4`): title, course code, department/exam-type/semester/year badges, meta line (institution · programme · department · semester · year), footer row (uploader, view count, download count, "Open PDF" →).

The vertical accent bar replaces the earlier thin horizontal bar that was at the top of the card. This keeps the layout visually balanced while providing a clear subject-colour signal on both mobile and desktop.

### ToastContext

Located at `src/components/ToastContext.tsx`. White cards with a coloured left status bar (green=success, red=error, yellow=warning, blue=info). Positioned top-right, auto-dismissed after 4 seconds. Use `useToast()` from client components.

### SyllabusModeration

Located at `src/components/SyllabusModeration.tsx`. Adapts to screen size:

- **≥ sm**: Full data table with all columns.
- **< sm**: Stacked card list for each pending syllabus entry.
