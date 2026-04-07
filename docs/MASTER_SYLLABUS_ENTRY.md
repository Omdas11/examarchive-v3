# MASTER_SYLLABUS_ENTRY.md

Canonical schema for syllabus ingestion into ExamArchive.

## Purpose

This document defines the standard YAML format for adding syllabus entries so that
downstream linking, filtering, browse integration, and AI workflows remain stable and
consistent across all contributors.

## Rules

- Keep fields consistent and machine-readable.
- Use one YAML block per syllabus paper entry.
- `paper_code` must pass validation from `PAPER_CODE_VALIDATION_RULES.md`.
- File must be named exactly as the paper code (e.g., `PHYDSC101T.md`).
- Follow the encoding and naming conventions from `docs/ASSAM_UNIVERSITY_PAPER_CODING.md`.
- YAML style must remain compatible with `DEMO_DATA_ENTRY.md` frontmatter structure.

---

## Required Fields

| Field               | Type   | Description                                              |
|---------------------|--------|----------------------------------------------------------|
| `entry_type`        | string | Always `syllabus`                                        |
| `entry_id`          | string | Unique identifier: `{college_short}-{program}-{paper_code}-{year}` |
| `college`           | string | Full college name                                        |
| `university`        | string | Affiliating university                                   |
| `course`            | string | `FYUG` or `CBCS` (program structure only)                |
| `stream`            | string | `Science`, `Arts`, `Commerce`                            |
| `group`             | string | Major subject group (e.g., `Physics Major`)              |
| `session`           | string | Academic session (e.g., `2025-2026`)                     |
| `year`              | number | Year of entry creation                                   |
| `paper_code`        | string | Canonical code (e.g., `PHYDSC101T`) — must be validated  |
| `paper_title`       | string | Official paper title                                     |
| `subject_code`      | string | Derived first 3 chars of paper_code (e.g., `PHY`)        |
| `paper_type`        | string | One of: `DSC`, `DSM`, `SEC`, `IDC`, `AEC`, `VAC`        |
| `semester_code`     | string | 3-digit code (e.g., `101`, `151`, `201`, …, `451`)       |
| `semester_no`       | number | Derived semester number (1–8)                            |
| `credits`           | number | Credit value of the paper                                |
| `marks_total`       | number | Total marks                                              |
| `syllabus_pdf_url`  | string | URL or relative path to the syllabus PDF                 |
| `source_reference`  | string | Source doc or file this entry was derived from           |
| `status`            | string | `active`, `archived`, or `draft`                         |

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
entry_id: "HGC-FYUG-PHYDSC101T-2026"
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

syllabus_pdf_url: "https://www.examarchive.dev/assets/syllabus/PHYDSC101T.pdf"
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

1. Contributor creates the `.md` file named after the paper code.
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
- [ ] `course` is `FYUG` or `CBCS` only
- [ ] `stream` is `Science`, `Arts`, or `Commerce`
- [ ] Program/group present
- [ ] Source reference present
- [ ] URL/path non-empty
- [ ] `status` is one of: `active`, `archived`, `draft`

---

## Syllabus Table (markdown body, after frontmatter)

After the YAML block, include the unit-level syllabus in a table matching `DEMO_DATA_ENTRY.md`:

```markdown
## Syllabus

| unit_number | syllabus_content | lectures | tags |
|---|---|---|---|
| 1 | Vectors, displacement, velocity, acceleration basics | 12 | kinematics,vector,motion |
| 2 | Relative motion and projectile motion derivations  | 10 | relative-motion,projectile |
```
