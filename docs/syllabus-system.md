# ExamArchive v3 — Syllabus System Documentation

This document describes the syllabus system architecture, how the central
syllabus registry works, how uploads link to papers, and how the Browse, Paper,
and Syllabus pages interconnect.

---

## 1. Overview

The ExamArchive v3 syllabus system has two complementary layers:

1. **Uploaded Syllabus PDFs** — Community-contributed syllabus PDF files
   stored in Appwrite Storage and moderated by admins before appearing
   publicly on the `/syllabus` page.

2. **Syllabus Registry** — A structured, developer-maintained registry of
   known course papers with rich metadata (paper code, name, semester,
   subject, credits, programme, university). This registry is a static
   TypeScript file (`src/data/syllabus-registry.ts`) and does **not** require
   a database.

---

## 2. Syllabus Registry

### Location

```
src/data/syllabus-registry.ts
```

### Data Structure

Each entry in the registry implements the `SyllabusRegistryEntry` interface:

```typescript
interface SyllabusRegistryEntry {
  paper_code: string;   // Unique identifier, e.g. "CC-1.1CH" or "FYUG-CS101"
  paper_name: string;   // Full descriptive name of the paper
  semester: number;     // Semester number (1–8)
  subject: string;      // Disciplinary area, e.g. "Chemistry", "Mathematics"
  credits: number;      // Credit weighting
  programme: string;    // Academic programme, e.g. "CBCS", "FYUG", "Annual"
  university: string;   // University or institution name
}
```

### Adding Prebuilt Syllabus Metadata

To add new entries, append objects to the `SYLLABUS_REGISTRY` array in
`src/data/syllabus-registry.ts`. Group entries by university for readability.

Example:

```typescript
{
  paper_code: "CC-7.1MA",
  paper_name: "Complex Analysis",
  semester: 5,
  subject: "Mathematics",
  credits: 6,
  programme: "CBCS",
  university: "University of Delhi",
},
```

**Rules:**
- `paper_code` must be unique within a (university, programme) combination.
- `semester` must be an integer 1–8.
- `credits` must be a positive integer.
- `university` values must be consistent across entries for the same institution
  (exact string match is used for lookups).

### Registry Helper Functions

```typescript
import {
  findByPaperCode,
  getByUniversity,
  groupBySemester,
} from "@/data/syllabus-registry";

// Lookup a single paper:
const entry = findByPaperCode("CC-1.1CH", "University of Delhi");

// All papers for a university / programme:
const allDU = getByUniversity("University of Delhi");
const cbcsOnly = getByUniversity("University of Delhi", "CBCS");

// Group for table display:
const byGroup = groupBySemester(cbcsOnly);
```

---

## 3. Uploaded Syllabus PDFs

### Database Collection: `syllabus`

Stored in the `examarchive` Appwrite database. Fields:

| Field                | Type    | Notes                                       |
|----------------------|---------|---------------------------------------------|
| `university`         | string  | Required                                    |
| `subject`            | string  | Required                                    |
| `department`         | string  | Required                                    |
| `semester`           | string  | Required                                    |
| `programme`          | string  | Optional                                    |
| `year`               | integer | Optional                                    |
| `uploader_id`        | string  | Appwrite User ID                            |
| `uploaded_by_username` | string | Denormalised for display                  |
| `approval_status`    | string  | `"pending"` \| `"approved"` \| `"rejected"` |
| `file_url`           | string  | Public URL in `syllabus-files` bucket       |
| `course_code`        | string  | Optional — links entry to registry          |

### Linking Uploads to Registry Papers

When a user uploads a syllabus PDF they can optionally supply a **paper code**.
If the `course_code` field on the stored document matches a `paper_code` in the
`SYLLABUS_REGISTRY`, the entry is linked:

- The **Syllabus Detail page** (`/syllabus/paper/[paper_code]`) queries the
  `syllabus` collection for `course_code == paper_code` and lists all
  uploaded PDFs alongside the structured metadata.
- This link is established purely by the value of `course_code` — no foreign
  key constraint is needed.

### Upload Flow

```
1. User opens /upload?type=syllabus
2. User fills SyllabusUploadForm:
      university, subject, department, semester, programme, year, PDF file
   (Optionally: enter paper_code to link to registry)
3. Browser calls GET /api/upload/token → receives JWT
4. Browser uploads PDF directly to Appwrite Storage (syllabus-files bucket)
5. Browser calls POST /api/upload/syllabus with JSON metadata + fileId
6. Server creates document in `syllabus` with approval_status="pending"
7. Admin reviews on /admin → Approve or Reject
8. Approved: approval_status="approved" → appears on /syllabus
```

---

## 4. Syllabus Pages

### `/syllabus` — Syllabus Hub

The syllabus hub is split into two tabs:

**Tab 1: Available Syllabus PDFs**
- Fetches all documents with `approval_status = "approved"` from the `syllabus`
  collection (server-side in `page.tsx`).
- Renders a card grid showing: university, programme, subject/paper name, paper
  code, semester, department, year, and a Download PDF link.
- Implemented in `SyllabusClient.tsx`.

**Tab 2: Paper Syllabus Library**
- Reads directly from `SYLLABUS_REGISTRY` (no DB call needed).
- Provides programme and subject filter toggles.
- Displays a table grouped by semester with columns:
  Paper Code, Paper Name, Subject, Credits, Programme.
- Each paper code and name links to the Syllabus Detail page.
- Implemented in `SyllabusClient.tsx` → `PaperLibrary` component.

### `/syllabus/paper/[paper_code]` — Syllabus Detail Page

Renders structured syllabus information directly on the website for a single
paper from the registry. Does **not** require a PDF to exist.

Sections:
1. **Paper Details** — All registry fields in a metadata table.
2. **Uploaded Syllabus PDFs** — Any PDFs uploaded by the community matching
   this paper code (from the `syllabus` DB collection).
3. **Related Papers** — Other registry entries for the same subject/programme.
4. **Upload CTA** — Prompts users to upload a syllabus PDF for this paper.

---

## 5. Interconnections: Browse, Paper, and Syllabus Pages

```
/browse ──────────────────────────────────────────┐
  Lists Papers (course_code, course_name, etc.)    │
  PaperCard links to /paper/[id]                   │
                                                   │
/paper/[id] ──────────────────────────────────────┤
  Shows detailed paper metadata                    │
  (Future) Could link to /syllabus/paper/[code]    │
  using the paper's course_code field              │
                                                   │
/syllabus ─────────────────────────────────────────┤
  Tab 1: Uploaded PDFs (from DB)                   │
  Tab 2: Registry table → /syllabus/paper/[code]   │
                                                   │
/syllabus/paper/[paper_code] ─────────────────────┘
  Registry metadata + uploaded PDFs for that code
  Related papers within the same subject
```

**Linking Papers to Syllabus (future enhancement):**
To add a "View Syllabus" button on the Browse and Paper pages, query the
`SYLLABUS_REGISTRY` for `paper_code === paper.course_code` and, if found,
render a link to `/syllabus/paper/[paper.course_code]`.

---

## 6. Admin Moderation

Syllabus PDFs are moderated via the **Admin Dashboard** → **Syllabus** tab.

| Action  | Effect                                              |
|---------|-----------------------------------------------------|
| Approve | Sets `approval_status = "approved"`. PDF appears on `/syllabus`. |
| Reject  | Sets `approval_status = "rejected"`. Removed from queue.  |
| PDF     | Opens the uploaded PDF for preview.                 |

Both actions call `POST /api/admin` with `action: "approve-syllabus"` or
`action: "reject-syllabus"`.

---

## 7. Future Enhancements

- [ ] Auto-fill metadata on upload: when a user enters a paper code, the form
  could call a lookup API (`GET /api/syllabus/registry?code=XX`) and pre-fill
  the remaining fields from the registry.
- [ ] Add `paper_code` field to the `SyllabusUploadForm` so uploads are linked
  to registry entries at upload time.
- [ ] Add a "View Syllabus" button on `PaperCard` when the paper's `course_code`
  exists in `SYLLABUS_REGISTRY`.
- [ ] Persist the registry in a `syllabus_registry` database collection to allow
  admin-managed additions without code deployments.
- [ ] Add `description`, `topics`, and `recommended_books` fields to
  `SyllabusRegistryEntry` for richer detail pages.
