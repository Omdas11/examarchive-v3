# ExamArchive v3 — Three Phase Launch Plan

**Repository:** `Omdas11/examarchive-v3`
**Plan start date:** April 8, 2026 (IST)
**Primary launch window:** May 1, 2026
**Fallback launch window:** June 1, 2026

## Objective

Prepare ExamArchive for student-facing launch with stable syllabus/question ingestion, improved UX,
scalable AI flow, monetization foundation, and SEO readiness.

---

## Phase 1 — Foundation & Data Reliability (Apr 8 → Apr 15)

### Goal

Stabilize the core data pipeline so paper-code-driven ingestion and linking never fail.

### Scope

1. **Paper Code Validation Engine**
   - Parse format like `PHYDSC101T`
   - Validate:
     - Subject code (first 3 chars)
     - Type code (`DSC`, `DSM`, `SEC`, `IDC`, `AEC`, `VAC`)
     - Semester code (`101`, `151`, `201`, `251`, `301`, `351`, `401`, `451`)
   - Return structured parse and rejection reason if invalid

2. **Master Entry Docs**
   - Introduce:
     - `docs/MASTER_SYLLABUS_ENTRY.md`
     - `docs/MASTER_QUESTION_ENTRY.md`
   - Keep YAML style compatible with existing `DEMO_DATA_ENTRY.md`

3. **Auto-linking**
   - Questions auto-linked to syllabus by paper code + year + group/program

4. **Syllabus Tracker Improvements**
   - Show valid/invalid/unmapped/duplicate items

### Exit Criteria

- 95%+ ingestion success on sample historical data
- All invalid paper codes are caught with readable error reasons
- New entries consistently map to browse index

---

## Phase 2 — Product Experience & AI Quality (Apr 16 → Apr 22)

### Goal

Make core student-facing pages useful, clean, and connected.

### Scope

1. **Profile Page Redesign**
   - Activity summary
   - Contribution stats
   - Saved resources
   - Role/XO status card

2. **Browse Page Redesign**
   - Unified list for syllabus + papers + notes PDFs
   - Filters: subject, type, semester, year, group
   - Sorting + quick preview + links to related pages

3. **Prompt Standardization**
   - Prompt templates for:
     - syllabus extraction
     - question paper extraction
     - AI notes/PDF generation
   - Strict schema output
   - Low-confidence fallback flow

### Exit Criteria

- Browse page becomes primary student discovery entry
- AI outputs pass schema validation reliably
- Profile + Browse are mobile usable and production-acceptable

---

## Phase 3 — Growth Readiness (Apr 23 → May 1)

### Goal

Enable sustainability through roles, virtual currency, and SEO.

### Scope

1. **Role/XO Auto-assignment**
   - Rules based on activity and contribution quality
   - Transparent scoring and anti-spam logic

2. **Virtual Currency MVP**
   - Earn coins via useful actions
   - Spend coins on AI-generated output
   - Admin-configurable economy

3. **Monetization Readiness**
   - Define cost-per-PDF per AI model
   - Configure safe margin and pricing tiers

4. **SEO Sprint**
   - meta tags, OG tags, sitemap, robots
   - Structured data
   - Internal linking and page speed improvements

### Exit Criteria

- Student onboarding flow clear
- Economy logic functional and testable
- SEO baseline complete before public promotion

---

## Team Recommendation

- **Minimum:** 4 people (high risk)
- **Recommended:** 6 people
- **Comfortable:** 7–8 people

Suggested 6-role setup:

1. Product lead / release manager
2. Ingestion + schema lead
3. Frontend (Profile/Browse)
4. QA + validation
5. SEO + analytics
6. Monetization + operations

---

## Milestone Summary

| Date     | Milestone                                   |
|----------|---------------------------------------------|
| Apr 15   | Data pipeline stable                        |
| Apr 22   | UX + AI quality stable                      |
| May 1    | Launch candidate                            |
| Jun 1    | Full polish + scaling (fallback target)     |
