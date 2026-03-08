# ExamArchive v3 — Upload Architecture & Flow

This document describes the end-to-end upload system for question papers, syllabi,
and departmental syllabi including the client-side direct upload pattern, API routes,
and admin moderation flow.

---

## 1. Overview

ExamArchive uses a **direct client-to-storage** upload pattern to avoid proxying
large files through the Next.js server:

```
Browser ──────────────────────────────────────────────────────────────────────────────────────────►
  │                                                                                                │
  │  1. GET /api/upload/token → JWT (scoped, short-lived)                                         │
  │  2. Upload file directly to Appwrite Storage (using JWT)   ──► Appwrite Storage              │
  │  3. POST /api/upload[/syllabus] with JSON metadata + fileId ──► Appwrite Database (pending)  │
  │                                                                                                │
  └── Admin reviews on /admin → Approve → Document marked approved → Appears publicly ◄──────────┘
```

This approach:
- Eliminates the 4 MB Next.js default body size limit (a custom 50 MB limit is set in `next.config.mjs`)
- Reduces server memory usage for large PDF uploads
- Keeps the API routes thin (metadata-only)

---

## 2. Upload Types

| Type                | URL Parameter       | Component                  | API Route              | Appwrite Collection |
|---------------------|---------------------|----------------------------|------------------------|---------------------|
| Question Paper      | `?type=paper`       | `UploadForm.tsx`           | `POST /api/upload`     | `papers`            |
| Semester Syllabus   | `?type=syllabus`    | `SyllabusUploadForm.tsx`   | `POST /api/upload/syllabus` | `syllabus`     |
| Departmental Syllabus | `?type=dept_syllabus` | `DeptSyllabusUploadForm.tsx` | `POST /api/upload/syllabus` | `syllabus`  |

All three types use the same file upload mechanism. Departmental syllabi share the
`/api/upload/syllabus` route and `syllabus` collection, distinguished by
`semester = ""` (empty string).

---

## 3. Step-by-Step Upload Flow

### Step 1 — Authentication Check

The `/upload` page is a server component that calls `getServerUser()`.
If no session is found, the user is redirected to `/login?next=/upload`.

### Step 2 — JWT Token (Server → Browser)

```
GET /api/upload/token
Authorization: session cookie
Response: { jwt: "<scoped JWT>" }
```

`src/app/api/upload/token/route.ts` creates a scoped JWT for the authenticated user.
This JWT is passed to the Appwrite Web SDK client-side to authorize direct storage uploads.

The JWT is **short-lived** and scoped only to file creation operations in the designated bucket.

### Step 3 — Direct File Upload (Browser → Appwrite Storage)

```typescript
// src/lib/appwrite-client.ts
uploadSyllabusFileDirectly(jwt, file, onProgress)
```

The browser uses the Appwrite Web SDK with the JWT to call the Appwrite Storage API directly.
A progress callback (`onProgress`) fires as bytes are transferred, driving the progress bar UI.

File limits enforced client-side:
- Maximum size: **20 MB** (`MAX_UPLOAD_BYTES` in `appwrite-client.ts`)
- Accepted types: `.pdf` (syllabi), `.pdf` / `.jpg` / `.jpeg` / `.png` (papers)

### Step 4 — Metadata Submission (Browser → Next.js API)

Once the file upload succeeds, the browser calls the metadata route with the `fileId`:

**Papers:**
```
POST /api/upload
Content-Type: application/json

{
  "fileId": "<Appwrite file ID>",
  "title": "...",
  "course_code": "PHYDSC101T",
  "course_name": "Mathematical Physics - I",
  "department": "Physics",
  "year": 2024,
  "semester": "1st",
  "exam_type": "Theory",
  "institution": "Assam University",
  "programme": "FYUGP",
  "paper_type": "DSC"
}
```

**Syllabi (semester or departmental):**
```
POST /api/upload/syllabus
Content-Type: application/json

{
  "fileId": "<Appwrite file ID>",
  "university": "Assam University",
  "subject": "Physics",
  "department": "Physics",
  "semester": "1st",     // Empty string "" for departmental syllabi
  "programme": "FYUG",
  "year": 2024
}
```

### Step 5 — Server Validation & Storage

The API route:
1. Verifies the user session
2. Validates all required fields
3. **Security check:** calls `storage.getFile(bucket, fileId)` to confirm the file
   was actually uploaded — prevents associating arbitrary file IDs with documents
4. Creates the database document with `approved: false` (papers) or
   `approval_status: "pending"` (syllabi)
5. Returns `{ success: true }` or an error JSON

### Step 6 — Admin Review

All uploads start in a pending state and are invisible to the public until approved:

| Type     | Initial State                | Admin Action           | Effect                            |
|----------|------------------------------|------------------------|-----------------------------------|
| Paper    | `approved: false`            | Approve                | `approved: true` → visible on `/browse` |
| Syllabus | `approval_status: "pending"` | Approve                | `approval_status: "approved"` → visible on `/syllabus` |
| Syllabus | `approval_status: "pending"` | Reject                 | `approval_status: "rejected"` → removed from queue |

Admins access the review queue at `/admin` (Syllabus tab or Papers tab).

---

## 4. Appwrite Storage Buckets

| Bucket Name          | Env Variable                        | Used For               |
|----------------------|-------------------------------------|------------------------|
| `papers-files`       | `APPWRITE_PAPERS_BUCKET_ID`         | Question paper PDFs    |
| `syllabus-files`     | `APPWRITE_SYLLABUS_BUCKET_ID`       | Syllabus PDFs (all types) |
| `avatars`            | `APPWRITE_AVATARS_BUCKET_ID`        | User avatar images     |

All buckets are hosted on Appwrite Cloud. File URLs follow the pattern:
```
{APPWRITE_ENDPOINT}/storage/buckets/{BUCKET_ID}/files/{FILE_ID}/view?project={PROJECT_ID}
```

---

## 5. File URL Construction

File URLs are constructed server-side in `src/lib/appwrite.ts`:

```typescript
// Papers
`${APPWRITE_ENDPOINT}/storage/buckets/${PAPERS_BUCKET_ID}/files/${fileId}/view?project=${PROJECT_ID}`

// Syllabi
`${APPWRITE_ENDPOINT}/storage/buckets/${SYLLABUS_BUCKET_ID}/files/${fileId}/view?project=${PROJECT_ID}`
```

These URLs are stored in the database as `file_url` and are used directly by the
frontend to render `<a href={file_url}>` links.

---

## 6. Error Handling

| Scenario                          | HTTP Status | Response                                |
|-----------------------------------|-------------|------------------------------------------|
| Not authenticated                 | 401         | `{ error: "Unauthorized" }`             |
| Missing required fields           | 400         | `{ error: "Required fields missing: …"}` |
| File not found in storage         | 404         | `{ error: "File not found in … storage"}` |
| File too large (client-side)      | —           | Toast error, upload not initiated        |
| Appwrite DB error                 | 500         | `{ error: "<error message>" }`          |
| Body too large (fallback)         | 413         | `{ error: "Request too large" }`        |

---

## 7. Progress Bar UI

The upload progress bar in `SyllabusUploadForm` and `DeptSyllabusUploadForm` is driven by
the `onProgress` callback from `uploadSyllabusFileDirectly()`:

```typescript
interface UploadProgress {
  progress: number; // 0–100
}
```

The bar colour transitions from the primary colour at 0% to green at 100%.
For paper uploads (`UploadForm.tsx`) the bar also shows upload speed and ETA.

---

## 8. Environment Variables Required

```bash
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=<project-id>
APPWRITE_API_KEY=<server-api-key>
APPWRITE_DATABASE_ID=<database-id>
APPWRITE_PAPERS_COLLECTION_ID=<papers-collection-id>
APPWRITE_SYLLABUS_COLLECTION_ID=<syllabus-collection-id>
APPWRITE_USERS_COLLECTION_ID=<users-collection-id>
APPWRITE_PAPERS_BUCKET_ID=<papers-bucket-id>
APPWRITE_SYLLABUS_BUCKET_ID=<syllabus-bucket-id>
APPWRITE_AVATARS_BUCKET_ID=<avatars-bucket-id>
```
