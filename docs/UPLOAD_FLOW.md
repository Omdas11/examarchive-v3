# Upload Flow — ExamArchive v3

ExamArchive uses a **deterministic two-step upload** pattern: the browser uploads the file directly to Appwrite Storage (bypassing Next.js), then the Next.js server saves metadata to the database. If the database insertion fails, the uploaded file is automatically deleted to prevent orphaned storage entries.

---

## Phase 1 — File Upload (Browser → Appwrite Storage)

```text
Browser
  │
  ├─ GET /api/upload/token
  │    └─ Server issues short-lived JWT for the authenticated user
  │
  └─ Appwrite Web SDK (appwrite-client.ts)
       └─ storage.createFile(bucketId, fileId, file, permissions)
            Permissions set on upload:
              read("users")          — all authenticated users can read
              write("user:{userId}") — only the uploader can update
              delete("user:{userId}") — only the uploader can delete
            └─ File lands in Appwrite Storage bucket
```

**Why direct upload?**
- Avoids Vercel's 4.5 MB server body-size limit.
- Appwrite SDK handles CORS, chunked uploads (> 5 MB), and progress events automatically.
- The Next.js server never sees the binary payload.

**Token endpoint:** `GET /api/upload/token`
- Requires an authenticated session cookie.
- Returns `{ jwt: string, userId: string }`.

---

## Phase 2 — Metadata Save (Browser → Next.js → Appwrite Database)

```text
Browser
  └─ POST /api/upload  (JSON body)
       ├─ { fileId, paper_code, university, year, file_name? }
       │
       └─ Next.js API Route (route.ts)
            ├─ Authenticate user (session cookie — 401 if not logged in)
            ├─ Resolve metadata from syllabus-registry.ts:
            │    paper_code → { paper_name, department, semester,
            │                   programme, exam_type (T/P suffix) }
            ├─ Step 1: Create document in `papers` collection
            │    { course_code, paper_name, year, semester, department,
            │      programme, exam_type, file_id, file_url,
            │      uploaded_by, approved: false, status: "pending" }
            │    ⚠ On failure → delete storage file (rollback) + return 500
            └─ Step 2: Best-effort write to `uploads` collection
                 { user_id, file_id, file_name, status: "pending" }
```

### Metadata Auto-Resolution

Users only enter three fields. All other metadata is resolved server-side:

| User Input   | Auto-Resolved Fields                                           |
|--------------|----------------------------------------------------------------|
| `paper_code` | `paper_name`, `department`, `semester`, `programme`, `exam_type` (code suffix T/P) |
| `university` | stored as-is                                                   |
| `year`       | `year`                                                         |

**Exam type derivation rule:**
- Paper code ending in `T` → `exam_type = "Theory"`
- Paper code ending in `P` → `exam_type = "Practical"`
- Any other suffix → `exam_type` is omitted

**Fallback (paper code not in registry):**
- `paper_name` = paper_code
- `department` = paper_code
- `semester`, `programme` are omitted

---

## Syllabus Upload Flow

Same two-step pattern, but uses the `syllabus-files` bucket and `POST /api/upload/syllabus`.

| User Input   | Auto-Resolved Fields                           |
|--------------|------------------------------------------------|
| `paper_code` | `subject`, `department`, `semester`, `programme` |
| `university` | `university`                                   |
| `year`       | `year`                                         |

The document is written to the `syllabus` collection with `approval_status: "pending"`.

---

## Departmental Syllabus Upload

Uses `DeptSyllabusUploadForm.tsx` and `POST /api/upload/syllabus`. The user manually enters programme and department. The `semester` field is stored as an empty string `""` to indicate the document covers all semesters.

---

## File Access

All PDFs are stored with `read("users")` permission and are only accessible to authenticated users. They are served through Next.js proxy routes that verify the session:

| Route                            | Bucket         | Auth required |
|----------------------------------|----------------|---------------|
| `/api/files/papers/[fileId]`     | `papers`       | ✅ Yes        |
| `/api/files/syllabus/[fileId]`   | `syllabus-files` | ✅ Yes      |
| `/api/files/avatars/[fileId]`    | `avatars`      | No            |

Guests visiting `/paper/*` pages are automatically redirected to `/login` by the middleware.

---

## Admin Moderation

After submission:
1. Admin sees the paper in the moderation queue (`/admin`, queried by `approved: false`).
2. On **approval**:
   - `papers.approved` → `true`
   - `papers.status` → `"approved"`
   - user's `upload_count` increments
   - XP is awarded
   - AI credits can be granted by activity policy
3. On **rejection**: paper document is deleted; storage file is also deleted to prevent orphaned files.
4. All admin actions are logged to the `activity_logs` collection.

### Referral + credit policy (planned)

- Referral onboarding can assign `users.referred_by` and a bounded `users.referral_path` (up to 5 hierarchy levels).
- When referred users complete qualifying activity, credit and XP rewards can be distributed from level 1 through level 5 ancestors.
- Future monetization provision: purchased credits should increase `users.ai_credits` without changing XP-based role permissions.

---

## Database Writes Summary

| Upload Type       | `uploads` collection | `papers` collection     | `syllabus` collection |
|-------------------|----------------------|-------------------------|-----------------------|
| Question Paper    | ✓ (status: pending)  | ✓ (approved: false, status: pending) | —          |
| Syllabus          | —                    | —                       | ✓ (approval_status: pending) |
| Dept. Syllabus    | —                    | —                       | ✓ (semester: "")      |
