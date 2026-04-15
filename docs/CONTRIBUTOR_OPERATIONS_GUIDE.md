# CONTRIBUTOR_OPERATIONS_GUIDE.md

Operational handbook for contributors who need to ship ExamArchive safely without changing core data contracts.

## Purpose

This guide defines:
- what to change,
- what **not** to change,
- why each lane exists,
- and how QA should be run before release.

## Non-Negotiable Boundaries

The following must remain stable unless an explicit migration plan is approved:

1. Database structure in `docs/DATABASE_SCHEMA.md`
2. Syllabus/question ingestion structure:
   - `docs/MASTER_INGESTION_GUIDE.md`
   - `docs/MASTER_SYLLABUS_ENTRY.md`
   - `docs/MASTER_QUESTION_ENTRY.md`
3. Paper code validation contract:
   - `docs/PAPER_CODE_VALIDATION_RULES.md`

## Team Lanes (Recommended for 4 contributors)

1. **Content Lane**
   - Collect source PDFs/metadata
   - Prepare markdown ingestion files
   - Validate naming and frontmatter before upload

2. **QA Lane**
   - Execute manual test runs
   - Verify ingest status and paper-linking integrity
   - Maintain bug evidence with repro steps + screenshots

3. **Product Ops Lane**
   - Maintain launch checklist statuses
   - Track blocker owners and due dates
   - Drive soft-launch readiness tasks

4. **Admin Ops Lane**
   - Moderate uploads
   - Manage role/tier changes
   - Perform manual AI credit top-ups for approved requests

## How to Contribute (Step-by-step)

1. Pick checklist item(s) from `docs/launch/LAUNCH_CHECKLIST.md`.
2. Confirm if the change is:
   - docs-only,
   - UI/content-only,
   - API/backend.
3. If touching ingestion or paper-code parsing paths, re-check guardrail docs.
4. Open/update task notes with:
   - current status,
   - acceptance criteria,
   - blocker notes.
5. Run required checks (see QA section below).

## Manual QA Playbook

### A) Ingestion QA

- Use canonical file naming:
  - `{paper_code}-syllabus.md`
  - `{paper_code}-questions-{exam_year}.md`
- Confirm one file contains one entry type.
- Confirm question↔syllabus linking status is not `unmapped` for valid rows.

### B) Browse/Profile QA

- Verify course preference filtering returns expected papers.
- Verify deep-links to PDF routes are valid.
- Verify mobile layout on 375px width.

### C) Admin Ops QA

- Approve/reject one paper and confirm activity log entry.
- Validate manual AI credit top-up endpoint:
  - admin-only access,
  - positive integer top-up,
  - audit details recorded.

## Release Gate Workflow

Before marking any checklist phase as complete:
1. Re-run tests and manual QA.
2. Attach test evidence (command output + screenshots where relevant).
3. Update checklist statuses.
4. If using automation, run the checklist updater script (see `docs/launch/PROGRESS_AUTOMATION.md`).

## Definition of Done (DoD)

Work is done only when:
- acceptance criteria for checklist item are satisfied,
- no ingestion contract is changed,
- no DB schema changes are introduced,
- and QA evidence is captured.
