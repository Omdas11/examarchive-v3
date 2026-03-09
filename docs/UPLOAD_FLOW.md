# Upload Flow — ExamArchive v3

ExamArchive uses a **two-phase upload** pattern: the browser uploads the file directly to Appwrite Storage (bypassing Next.js), then the Next.js server saves JSON metadata to the database.

---

## Phase 1 — File Upload (Browser → Appwrite Storage)

```
Browser
  │
  ├─ GET /api/upload/token
  │    └─ Server issues short-lived JWT for the authenticated user
  │
  └─ Appwrite Web SDK (appwrite-client.ts)
       └─ storage.createFile(bucketId, fileId, file)
            └─ File lands in Appwrite Storage bucket
```

**Why direct upload?**
- Avoids Vercel's 4.5 MB server body-size limit.
- Appwrite SDK handles CORS, chunked uploads (> 5 MB), and progress events automatically.
- The Next.js server never sees the binary payload.

**Token endpoint:** `GET /api/upload/token`
- Requires an authenticated session cookie.
- Returns `{ jwt: string }` — a short-lived Appwrite session JWT valid for one upload.

---

## Phase 2 — Metadata Save (Browser → Next.js → Appwrite Database)

```
Browser
  └─ POST /api/upload  (JSON body)
       ├─ { fileId, paper_code, university, year, file_name? }
       │
       └─ Next.js API Route (route.ts)
            ├─ Authenticate user (session cookie)
            ├─ Verify file ownership via session Storage client
            ├─ Resolve metadata from syllabus-registry.ts:
            │    paper_code → { course_name, department, semester,
            │                   paper_type, exam_type (T/P suffix) }
            ├─ Write to `uploads` collection  { status: "pending" }
            └─ Write to `papers` collection   { approved: false }
```

### Metadata Auto-Resolution

Users only enter three fields. All other metadata is resolved server-side:

| User Input   | Auto-Resolved Fields                                           |
|--------------|----------------------------------------------------------------|
| `paper_code` | `course_name` (paper_name), `department` (subject), `semester`, `paper_type` (category), `exam_type` (code suffix T/P) |
| `university` | `institute`                                                    |
| `year`       | `year`                                                         |

**Exam type derivation rule:**
- Paper code ending in `T` → `exam_type = "Theory"`
- Paper code ending in `P` → `exam_type = "Practical"`
- Any other suffix → `exam_type` is omitted

**Fallback (paper code not in registry):**
- `course_name` = paper_code
- `department` = paper_code
- `semester`, `paper_type` are omitted

---

## Syllabus Upload Flow

Identical two-phase pattern, but uses the `syllabus-files` bucket and `POST /api/upload/syllabus`.

| User Input   | Auto-Resolved Fields                           |
|--------------|------------------------------------------------|
| `paper_code` | `subject` (paper_name), `department` (subject), `semester`, `programme` |
| `university` | `university`                                   |
| `year`       | `year`                                         |

The document is written to the `syllabus` collection with `approval_status: "pending"`.

---

## Departmental Syllabus Upload

Uses `DeptSyllabusUploadForm.tsx` and `POST /api/upload/syllabus`. The user manually enters programme and department. The `semester` field is stored as an empty string `""` to indicate the document covers all semesters.

---

## Database Writes Summary

| Upload Type       | `uploads` collection | `papers` collection | `syllabus` collection |
|-------------------|----------------------|---------------------|-----------------------|
| Question Paper    | ✓ (status: pending)  | ✓ (approved: false) | —                     |
| Syllabus          | —                    | —                   | ✓ (status: pending)   |
| Dept. Syllabus    | —                    | —                   | ✓ (semester: "")      |

---

## Admin Moderation

After submission:
1. Admin sees the upload in the moderation queue (`/admin`).
2. On approval: `papers.approved` → `true` (or `syllabus.approval_status` → `"approved"`), user's `upload_count` increments, XP is awarded.
3. On rejection: document is deleted or `approval_status` → `"rejected"`.
4. All admin actions are logged to the `activity_logs` collection.
