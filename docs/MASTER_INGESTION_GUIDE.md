# MASTER_INGESTION_GUIDE.md

Unified ingestion guide for **split** markdown ingestion in ExamArchive v3.

## Core rule

Syllabus and question ingestion are separated by design:

- one file = one `entry_type`
- do **not** put `## Syllabus` and `## Questions` in the same markdown file
- mixed files are rejected

## File naming conventions

### 1) Syllabus file

- Filename: `{paper_code}-syllabus.md`
- Example: `PHYDSC101T-syllabus.md`
- Must contain:
  - frontmatter with `entry_type: syllabus`
  - `## Syllabus` table

### 2) Question file

- Filename: `{paper_code}-questions-{exam_year}.md`
- Example: `PHYDSC101T-questions-2024.md`
- Must contain:
  - frontmatter with `entry_type: question`
  - `## Questions` table

## Linking behavior (Syllabus_Table ↔ Questions_Table)

Questions are linked to syllabus entries using `linked_syllabus_entry_id`:

1. If `linked_syllabus_entry_id` is provided in question frontmatter, it is used directly.
2. If not provided, ingestion auto-resolves a syllabus match using:
   - `university`
   - `course`
   - `stream`
   - `type`
   - `paper_code`
3. If linked, `link_status` defaults to `linked`; otherwise `unmapped`.

## Upload order (recommended)

1. Upload syllabus file first (`*-syllabus.md`).
2. Upload question file(s) next (`*-questions-<year>.md`).
3. Verify linkage from syllabus detail UI (linked questions section).

## Canonical templates

- Syllabus template/spec: `docs/MASTER_SYLLABUS_ENTRY.md`
- Question template/spec: `docs/MASTER_QUESTION_ENTRY.md`
