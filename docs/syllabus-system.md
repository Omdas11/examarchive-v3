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

### Data Structures

#### `SyllabusUnit`

Represents a single unit (chapter) within a paper's syllabus.

```typescript
interface SyllabusUnit {
  unit: number;      // 1-based unit number
  name: string;      // Unit title, e.g. "Vector Algebra and Matrices"
  lectures?: number; // Number of allocated lectures, if known
  topics: string[];  // List of topics / subtopics covered
}
```

#### `SyllabusRegistryEntry`

Each entry in the registry implements this interface:

```typescript
interface SyllabusRegistryEntry {
  paper_code: string;         // Unique identifier, e.g. "PHYDSC101T"
  paper_name: string;         // Full descriptive name of the paper
  semester: number;           // Semester number (1–8)
  subject: string;            // Disciplinary area, e.g. "Physics"
  credits: number;            // Credit weighting
  programme: string;          // Programme framework, e.g. "FYUGP", "CBCS"
  university: string;         // University or institution name
  category?: string;          // Paper type: "DSC" | "DSM" | "SEC" | "IDC" | "GE"
  contact_hours?: number;     // Total contact hours (lectures + tutorials)
  full_marks?: number;        // Maximum marks for the paper
  course_objective?: string;  // Free-text course objective
  learning_outcomes?: string; // Expected learning outcomes
  units?: SyllabusUnit[];     // Structured units with per-unit topics
  reference_books?: string[]; // Recommended / reference books
}
```

### Category Types

| Code | Full Name                     | Badge Colour |
|------|-------------------------------|--------------|
| DSC  | Discipline Specific Core      | Blue         |
| DSM  | Discipline Specific Minor     | Green        |
| SEC  | Skill Enhancement Course      | Yellow       |
| IDC  | Interdisciplinary Course      | Purple       |
| GE   | Generic Elective              | Red          |

### Current Registry Contents

The registry is pre-populated with **Assam University** Physics papers under the
FYUGP (Four Year Undergraduate Programme, NEP 2020) framework.

| Category | Papers | Semesters |
|----------|--------|-----------|
| DSC      | 25     | I – VIII  |
| DSM      | 10     | I – VIII  |
| SEC      | 3      | I – III   |
| IDC      | 3      | I – III   |

Paper `PHYDSC101T` (Mathematical Physics - I) is fully populated with all
5 units, per-unit lecture counts, and detailed topic lists matching the
official Assam University syllabus document.

### Adding Prebuilt Syllabus Metadata

To add new entries, append objects to `SYLLABUS_REGISTRY`:

```typescript
// Minimal entry (no unit details yet)
{
  paper_code: "PHYDSC201T",
  paper_name: "Waves and Optics",
  semester: 3,
  subject: "Physics",
  credits: 4,
  programme: "FYUGP",
  university: "Assam University",
  category: "DSC",
},

// Full entry with units and topics
{
  paper_code: "PHYDSC201T",
  paper_name: "Waves and Optics",
  semester: 3,
  subject: "Physics",
  credits: 4,
  programme: "FYUGP",
  university: "Assam University",
  category: "DSC",
  contact_hours: 60,
  full_marks: 100,
  units: [
    {
      unit: 1,
      name: "Simple Harmonic Motion",
      lectures: 10,
      topics: [
        "Simple harmonic oscillator: equation of motion.",
        "Energy of SHM. Superposition of SHOs.",
      ],
    },
    // … more units
  ],
  reference_books: [
    "Waves, Berkeley Physics Course Vol. 3, Frank S. Crawford.",
  ],
},
```

**Rules:**
- `paper_code` must be unique within a (university, programme) combination.
- `semester` must be an integer 1–8.
- `credits` must be a positive integer.
- `unit` numbers within a `units` array must be consecutive starting from 1.
- `university` values must be consistent across entries (exact string match used for lookups).

### Registry Helper Functions

```typescript
import {
  findByPaperCode,
  getByUniversity,
  groupBySemester,
} from "@/data/syllabus-registry";

// Lookup a single paper:
const entry = findByPaperCode("PHYDSC101T", "Assam University");

// All papers for a university, optionally filtered by programme + category:
const allDSC = getByUniversity("Assam University", "FYUGP", "DSC");

// Group for table display:
const bySem = groupBySemester(allDSC);
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

## 7. Departmental Syllabus

### What Is a Departmental Syllabus?

A **Departmental Syllabus** is a full programme syllabus document covering **all semesters** for
a specific subject and programme (e.g. *Physics FYUG Full Syllabus* for Assam University).
This is distinct from a **Semester Syllabus**, which covers only one semester.

Examples:
- *Physics FYUG Full Syllabus* — all 8 semesters of Physics under the FYUGP framework
- *Chemistry CBCS Complete Syllabus* — all 6 semesters of Chemistry under CBCS

### Upload Flow

```
/upload?type=dept_syllabus
  ↓
DeptSyllabusUploadForm
  Fields: university, programme, department/subject, syllabus year
  (No semester field — covers all semesters)
  ↓
POST /api/upload/syllabus
  semester: "" (empty string)
  ↓
syllabus collection document created
  approval_status: "pending"
  ↓
Admin approves → appears in "Departmental Syllabus" section on /syllabus
```

### Database Convention

Departmental syllabi are stored in the same `syllabus` collection as semester syllabi.
They are distinguished by an **empty `semester` field** (`semester = ""`):

| `semester` value | Type of Syllabus |
|------------------|------------------|
| `"1st"`, `"2nd"`, ... | Semester-specific syllabus |
| `""` (empty)     | Departmental (all semesters) |

No additional database column is required. This convention is enforced at the
upload level by `DeptSyllabusUploadForm.tsx`.

### Display on `/syllabus` Page

The `SyllabusClient.tsx` separates syllabi into two sections within the **Available Syllabus PDFs** tab:

1. **Departmental Syllabus** — documents where `!semester || semester === ""`
2. **Semester Syllabi** — documents where `semester` is a non-empty value

If no departmental syllabi exist, the section is hidden and only the semester list is shown.

---

## 8. Future Enhancements

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
