# MASTER_QUESTION_ENTRY.md

Canonical schema for question paper ingestion into ExamArchive.

## Purpose

This document defines the canonical **question paper authoring schema** supported by
`src/lib/admin-md-ingestion.ts` and `/api/admin/ingest-md`.

For the master drafting guide (both syllabus and question formats, naming, and upload order), see:
`docs/MASTER_INGESTION_GUIDE.md`.

## Rules

- YAML structure is a v2 schema; see mapping table for current ingestion equivalents.
- `paper_code` must match validation rules from `PAPER_CODE_VALIDATION_RULES.md`.
- `exam_year` and `group` must be explicit for accurate auto-linking.
- Each question PDF entry has a unique `question_id`.
- File should be named using the convention: `{paper_code}-questions-{exam_year}.md`
  (e.g., `PHYDSC101T-questions-2024.md`).
- Do **not** include a `## Syllabus` section in this file. Syllabus and question ingestion
  are intentionally split and must be uploaded as separate markdown files.

---

## Field Mapping: v2 → Current Ingestion Schema

The current parser (`src/lib/admin-md-ingestion.ts`) reads these frontmatter keys:

| v2 Field (this doc)   | Current Ingestion Key | Notes                                    |
|-----------------------|-----------------------|------------------------------------------|
| `paper_code`          | `paper_code`          | Same                                     |
| `paper_title`         | `paper_name`          | Renamed in v2                            |
| `paper_type`          | `type`                | Renamed in v2                            |
| `subject_code`        | `subject`             | Renamed in v2                            |
| `university`          | `university`          | Same                                     |
| `course`              | `course`              | Same                                     |
| `stream`              | `stream`              | Same                                     |
| `entry_type`          | `entry_type`          | Same                                       |
| `question_id`         | `question_id`         | Persisted in the `question_id` field         |
| `college`             | `college`             | Persisted when schema supports the field    |
| `group`               | `group`               | Persisted when schema supports the field    |
| `exam_year`           | `exam_year`           | Persisted when schema supports the field    |
| `exam_session`        | `exam_session`        | Persisted when schema supports the field    |
| `semester_code`       | `semester_code`       | Persisted when schema supports the field    |
| `semester_no`         | `semester_no`         | Persisted when schema supports the field    |

---

## Required Fields

| Field                | Type   | Maps to current key | Description                                                       |
|----------------------|--------|---------------------|-------------------------------------------------------------------|
| `entry_type`         | string | `entry_type`        | Always `question`                                                  |
| `question_id`        | string | `question_id`       | Unique ID: `QST-{college_short}-{paper_code}-{year}-{seq}`        |
| `college`            | string | `college`           | Full college name                                                  |
| `university`         | string | `university`        | Affiliating university                                            |
| `course`             | string | `course`            | `FYUG` or `CBCS`                                                  |
| `stream`             | string | `stream`            | `Science`, `Arts`, `Commerce`                                     |
| `group`              | string | `group`             | Major subject group (e.g., `Physics Major`)                       |
| `exam_year`          | number | `exam_year`         | Year of the examination                                            |
| `exam_session`       | string | `exam_session`      | `Odd Semester` or `Even Semester`                                 |
| `paper_code`         | string | `paper_code`        | Canonical code — must pass validator                              |
| `paper_title`        | string | `paper_name`        | Official paper title                                              |
| `subject_code`       | string | `subject`           | Derived first 3 chars of `paper_code`                             |
| `paper_type`         | string | `type`              | One of: `DSC`, `DSM`, `SEC`, `IDC`, `AEC`, `VAC`                 |
| `semester_code`      | string | `semester_code`     | 3-digit semester code                                              |
| `semester_no`        | number | `semester_no`       | Derived semester number (1–8)                                     |
| `question_pdf_url`   | string | `question_pdf_url`  | URL or path to question PDF                                       |
| `source_reference`   | string | `source_reference`  | Source doc or upload batch this was ingested from                 |
| `status`             | string | `status`            | `active`, `archived`, or `draft`                                  |

---

## Optional Fields

| Field                    | Type         | Description                                                    |
|--------------------------|--------------|----------------------------------------------------------------|
| `exam_month`             | string       | Month of examination (e.g., `November`)                        |
| `attempt_type`           | string       | `regular`, `backlog`, or `improvement`                         |
| `tags`                   | list[string] | Search/filter tags                                             |
| `linked_syllabus_entry_id` | string     | Matched `entry_id` from syllabus table                         |
| `link_status`            | string       | `linked` or `unmapped`                                         |
| `ocr_text_path`          | string       | Path to OCR text file if available                             |
| `ai_summary_status`      | string       | `pending`, `generated`, `failed`                               |
| `difficulty_estimate`    | string       | `easy`, `medium`, `hard` (AI-estimated or manual)              |

---

## Example Entry

```yaml
---
entry_type: question
question_id: "QST-HGC-PHYDSC101T-2024-01"
college: "Haflong Government College"
university: "Assam University"
course: "FYUG"
stream: "Science"
group: "Physics Major"

exam_year: 2024
exam_session: "Odd Semester"
exam_month: "November"
attempt_type: "regular"

paper_code: "PHYDSC101T"
paper_title: "Mechanics and Properties of Matter"
subject_code: "PHY"
paper_type: "DSC"
semester_code: "101"
semester_no: 1

question_pdf_url: "https://www.examarchive.dev/assets/questions/2024/PHYDSC101T-Nov-2024.pdf"
source_reference: "MASTER_QUESTION_ENTRY.md"
status: "active"

tags:
  - "physics"
  - "semester-1"
  - "odd-sem"

linked_syllabus_entry_id: "HGC-FYUG-PHYDSC101T-2026"
link_status: "linked"
ocr_text_path: "/data/ocr/PHYDSC101T-Nov-2024.txt"
ai_summary_status: "pending"
difficulty_estimate: "medium"
```

---

## Auto-Linking Logic

When a question paper is ingested, the system attempts to link it to the correct syllabus entry
using this priority order:

1. Exact `paper_code` match
2. Same `course` + `group`
3. Compatible year/session context
4. Latest `active` syllabus version

**If no match found:**
- Set `link_status: unmapped`
- Push entry to syllabus tracker review queue
- Flag for manual curator review

---

## Question Table (markdown body, after frontmatter)

After the YAML block, include individual questions in a table as shown below:

```markdown
## Questions

| question_no | question_subpart | year | question_content | marks | tags |
|---|---|---|---|---|---|
| 1 | a | 2024 | Define scalar and vector with examples. | 2 | vector,kinematics |
| 1 | b | 2024 | Derive equations of uniformly accelerated motion. | 5 | kinematics,motion |
| 2 | a | 2023 | Explain projectile motion and derive range equation. | 10 | projectile,relative-motion |
```

---

## Validation Checklist

- [ ] Paper code format valid (passes `PAPER_CODE_VALIDATION_RULES.md` checks)
- [ ] `exam_year` present and numeric
- [ ] `question_pdf_url` non-empty
- [ ] `course` is `FYUG` or `CBCS`
- [ ] `stream` is `Science`, `Arts`, or `Commerce`
- [ ] Program/group set
- [ ] Link status evaluated (`linked` or `unmapped`)
- [ ] `status` is one of: `active`, `archived`, `draft`
