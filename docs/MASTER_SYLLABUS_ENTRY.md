# MASTER_SYLLABUS_ENTRY.md

Canonical schema for syllabus ingestion into ExamArchive.

## Purpose

This document defines the canonical **syllabus authoring schema** supported by
`src/lib/admin-md-ingestion.ts` and `/api/admin/ingest-md`.

For the master drafting guide (both syllabus and question formats, naming, and upload order), see:
`docs/MASTER_INGESTION_GUIDE.md`.

## Rules

- Keep fields consistent and machine-readable.
- Use one YAML block per syllabus paper entry.
- Current ingestion scope is fixed to `university: Assam University` and `course: FYUG` only.
- `paper_code` must pass validation from `PAPER_CODE_VALIDATION_RULES.md`.
- File should be named `{paper_code}-syllabus.md` (e.g., `PHYDSC101T-syllabus.md`).
  Since a paper code represents a canonical curriculum slot (not a year-specific record),
  one syllabus file per code is the intended convention.
- Do **not** include a `## Questions` section in this file. Syllabus and question ingestion
  are intentionally split and must be uploaded as separate markdown files.
- Follow the encoding and naming conventions from `docs/ASSAM_UNIVERSITY_PAPER_CODING.md`.

---

## Field Mapping: v2 → Current Ingestion Schema

The current parser (`src/lib/admin-md-ingestion.ts`) reads these frontmatter keys:

| v2 Field (this doc) | Current Ingestion Key (`IngestionFrontmatter`) | Notes                              |
|---------------------|------------------------------------------------|------------------------------------|
| `university`        | `university`                                   | Same                               |
| `course`            | `course`                                       | Same                               |
| `stream`            | `stream`                                       | Same                               |
| `paper_code`        | `paper_code`                                   | Same                               |
| `paper_title`       | `paper_name`                                   | Renamed in v2                      |
| `subject_code`      | `subject`                                      | Renamed in v2                      |
| `paper_type`        | `type`                                         | Renamed in v2                      |
| `entry_id`          | —                                              | v2 metadata only; not ingested     |
| `college`           | —                                              | v2 metadata only; not ingested     |
| `group`             | —                                              | v2 metadata only; not ingested     |
| `session`           | —                                              | v2 metadata only; not ingested     |
| `year`              | —                                              | v2 metadata only; not ingested     |
| `semester_code`     | —                                              | v2 metadata only; not ingested     |
| `semester_no`       | —                                              | v2 metadata only; not ingested     |
| `credits`           | —                                              | v2 metadata only; not ingested     |
| `marks_total`       | —                                              | v2 metadata only; not ingested     |

---

## Required Fields

| Field               | Type   | Maps to current key | Description                                              |
|---------------------|--------|---------------------|----------------------------------------------------------|
| `entry_type`        | string | —                   | Always `syllabus`; v2 metadata only                      |
| `entry_id`          | string | —                   | Unique ID: `{college_short}-{program}-{paper_code}`      |
| `college`           | string | —                   | Full college name; v2 metadata only                      |
| `university`        | string | `university`        | Must be `Assam University`                               |
| `course`            | string | `course`            | Must be `FYUG`                                           |
| `stream`            | string | `stream`            | `Science`, `Arts`, `Commerce`                            |
| `group`             | string | —                   | Major subject group (e.g., `Physics Major`); v2 only     |
| `session`           | string | —                   | Academic session (e.g., `2025-2026`); v2 only            |
| `year`              | number | —                   | Year of entry creation; v2 metadata only                 |
| `paper_code`        | string | `paper_code`        | Canonical code (e.g., `PHYDSC101T`) — must be validated  |
| `paper_title`       | string | `paper_name`        | Official paper title                                     |
| `subject_code`      | string | `subject`           | Derived first 3 chars of paper_code (e.g., `PHY`)        |
| `paper_type`        | string | `type`              | One of: `DSC`, `DSM`, `SEC`, `IDC`, `AEC`, `VAC`        |
| `semester_code`     | string | —                   | 3-digit code (e.g., `101`, `151`, …, `451`); v2 only     |
| `semester_no`       | number | —                   | Derived semester number (1–8); v2 only                   |
| `credits`           | number | —                   | Credit value of the paper; v2 metadata only              |
| `marks_total`       | number | —                   | Total marks; v2 metadata only                            |
| `syllabus_pdf_url`  | string | —                   | Optional override; auto-generated if omitted             |
| `source_reference`  | string | —                   | Source doc or file this entry was derived from           |
| `status`            | string | —                   | `active`, `archived`, or `draft`                         |

---

## Optional Fields

| Field             | Type         | Description                                        |
|-------------------|--------------|----------------------------------------------------|
| `aliases`         | list[string] | Common alternate names for the paper               |
| `keywords`        | list[string] | Search/filter tags                                 |
| `unit_breakdown`  | list[object] | List of units with `unit` number and `title`       |
| `notes`           | string       | Reviewer notes or ingestion remarks                |
| `version`         | number       | Schema version (increment on structural changes)   |
| `last_updated`    | string       | ISO date of last update (`YYYY-MM-DD`)             |

---

## Example Entry

```yaml
---
entry_type: syllabus
entry_id: "HGC-FYUG-PHYDSC101T"
college: "Haflong Government College"
university: "Assam University"
course: "FYUG"
stream: "Science"
group: "Physics Major"
session: "2025-2026"
year: 2026

paper_code: "PHYDSC101T"
paper_title: "Mechanics and Properties of Matter"
subject_code: "PHY"
paper_type: "DSC"
semester_code: "101"
semester_no: 1

credits: 4
marks_total: 100

# Optional: if omitted, ingestion auto-fills:
# /api/syllabus/table?paperCode=PHYDSC101T&mode=pdf&university=...&course=...&stream=...&type=...
syllabus_pdf_url: "/api/syllabus/table?paperCode=PHYDSC101T&mode=pdf&university=Assam%20University&course=FYUG&stream=Science&type=DSC"
source_reference: "HAFLONG-GOVERNMENT-COLLEGE-SYLLABUS.md"
status: "active"

aliases:
  - "Mechanics"
  - "Physics DSC 1"

keywords:
  - "physics"
  - "dsc"
  - "semester-1"

unit_breakdown:
  - unit: 1
    title: "Vectors and Kinematics"
  - unit: 2
    title: "Newtonian Mechanics"
  - unit: 3
    title: "Properties of Matter"

notes: "Validated against Assam University coding guidelines"
version: 1
last_updated: "2026-04-08"
```

---

## Ingestion Flow

1. Contributor creates the `.md` file as `{paper_code}-syllabus.md`.
2. YAML frontmatter is parsed and `paper_code` is validated first.
3. If invalid, reject with error from `PAPER_CODE_VALIDATION_RULES.md`.
4. Derive and cross-check: `subject_code`, `paper_type`, `semester_code`, `semester_no`.
5. Store normalized canonical object in database.
6. Index for browse filters and search.
7. Auto-link any existing question entries that match `paper_code` + `group`.

---

## Validation Checklist

- [ ] Paper code format valid (regex + type + semester checks pass)
- [ ] Semester mapping valid and `semester_no` derived correctly
- [ ] `course` is `FYUG` only
- [ ] `stream` is `Science`, `Arts`, or `Commerce`
- [ ] Program/group present
- [ ] Source reference present
- [ ] `syllabus_pdf_url` provided only when overriding the auto-generated value
- [ ] `status` is one of: `active`, `archived`, `draft`

---

## Syllabus Table (markdown body, after frontmatter)

After the YAML block, include the unit-level syllabus table as shown below:

```markdown
## Syllabus

| unit_number | syllabus_content | lectures | tags |
|---|---|---|---|
| 1 | Vectors, displacement, velocity, acceleration basics | 12 | kinematics,vector,motion |
| 2 | Relative motion and projectile motion derivations  | 10 | relative-motion,projectile |
```
