# LAUNCH_CHECKLIST.md

Phase-wise go-live checklist for ExamArchive v3 launch.

**Legend — Status:** `todo` | `in-progress` | `done`
**Legend — Gate result:** `pass` | `fail` | `pending`

---

## Parallel Execution Split (Apr 8 → Apr 30)

| Part | Window | Owner lane | Checklist coverage | Target output |
|---|---|---|---|---|
| Part 1 — Data Foundation | Apr 8–Apr 13 | Data + QA | 1–8 | Data Gate ready for pass |
| Part 2 — UX Delivery | Apr 10–Apr 20 | Frontend + QA | 9–12, 16 | UX Gate ready for pass |
| Part 3 — AI Reliability | Apr 12–Apr 22 | AI + QA | 13–15, 22 | Ops/AI reliability baseline complete |
| Part 4 — Growth & Monetization | Apr 18–Apr 27 | Backend + Monetization | 17–21 | Monetization Gate ready for pass |
| Part 5 — SEO + Launch Readiness | Apr 24–Apr 30 | SEO + Release manager + All | 23–26 | Required gates passed + pilot kickoff prep done |

---

## Phase 1 Checklist — Foundation & Data Reliability (Due: Apr 15)

| # | Item                                              | Owner    | Deadline | Status      | Blocker                        | Acceptance Criteria                                              |
|---|---------------------------------------------------|----------|----------|-------------|--------------------------------|------------------------------------------------------------------|
| 1 | Paper code parser implemented and unit-tested     | Person B | Apr 10   | todo        | —                              | pass: all valid codes parse correctly; all invalid codes rejected |
| 2 | `PAPER_CODE_VALIDATION_RULES.md` finalized        | Person B | Apr 9    | todo        | —                              | pass: doc reviewed and committed                                 |
| 3 | `MASTER_SYLLABUS_ENTRY.md` format finalized       | Person B | Apr 9    | todo        | —                              | pass: team confirms YAML structure; ingestion succeeds           |
| 4 | `MASTER_QUESTION_ENTRY.md` format finalized       | Person B | Apr 9    | todo        | —                              | pass: team confirms YAML structure                               |
| 5 | Ingestion validation active (type + semester)     | Person B | Apr 12   | todo        | Parser must be done first      | pass: invalid entries rejected with error code                   |
| 6 | Syllabus tracker shows valid/invalid/unmapped     | Person D | Apr 13   | todo        | Ingestion pipeline must be up  | pass: tracker page displays all four states correctly            |
| 7 | Auto-linking: question ↔ syllabus by paper code   | Person B | Apr 13   | todo        | Item 6 tracker states must be green | pass: 95%+ of sample questions link to correct syllabus      |
| 8 | QA pass on 20+ historical paper codes             | Person D | Apr 13   | todo        | —                              | pass: zero false-accepts; all rejects have reason                |

---

## Phase 2 Checklist — Product Experience & AI Quality (Due: Apr 22)

| # | Item                                              | Owner       | Deadline | Status      | Blocker                        | Acceptance Criteria                                              |
|---|---------------------------------------------------|-------------|----------|-------------|--------------------------------|------------------------------------------------------------------|
| 9  | Browse page redesigned with unified cards        | Person C    | Apr 18   | todo        | Phase 1 data stable            | pass: syllabus + papers + notes visible; filters work            |
| 10 | Browse filters work (subject, semester, year)    | Person C    | Apr 18   | todo        | Browse redesign done           | pass: all filter combos return correct results                   |
| 11 | Browse deep-links to PDF viewer pages            | Person C    | Apr 19   | todo        | —                              | pass: every card links to correct resource page                  |
| 12 | Profile page redesigned (activity, role, XO)     | Person C    | Apr 20   | todo        | Role/XO logic done             | pass: all profile fields render; mobile layout passes review     |
| 13 | AI prompt templates committed (`AI_PROMPT_STANDARDS.md`) | Person E | Apr 20 | todo   | —                              | pass: all three template types produce valid schema output       |
| 14 | AI output schema validation active               | Person E    | Apr 21   | todo        | Prompt templates done          | pass: output schema rejection rate < 5% on test set             |
| 15 | Low-confidence fallback flow working             | Person E    | Apr 22   | todo        | Schema validation active       | pass: low-confidence outputs trigger review queue, not delivery  |
| 16 | Browse + profile mobile QA pass                  | Person D    | Apr 20   | todo        | UI features done               | pass: no layout breaks on 375px viewport                        |

---

## Phase 3 Checklist — Growth Readiness (Due: Apr 30)

| #  | Item                                              | Owner    | Deadline | Status      | Blocker                          | Acceptance Criteria                                               |
|----|---------------------------------------------------|----------|----------|-------------|----------------------------------|-------------------------------------------------------------------|
| 17 | Role/XO rule engine live (see `ROLE_XO_RULEBOOK.md`) | Person B | Apr 25 | todo      | Browse data + profile done       | pass: roles auto-assign on threshold events                      |
| 18 | Anti-abuse rules enforced (spam, duplicates)      | Person B | Apr 26   | todo        | Role engine active               | pass: test uploads of duplicates rejected or flagged             |
| 19 | Virtual currency earn flow working                | Person F | Apr 27   | todo        | —                                | pass: contributions credit correct coin amounts                  |
| 20 | Virtual currency spend flow working               | Person F | Apr 27   | todo        | Earn flow done                   | pass: coin deduction and refund tested end-to-end                |
| 21 | AI pricing tiers configured (Basic/Std/Premium)   | Person F | Apr 27   | todo        | Spend flow done                  | pass: correct coin amounts charged per tier                      |
| 22 | AI model fallback chain tested                    | Person E | Apr 22   | todo        | —                                | pass: fallback engages under simulated quota exhaustion          |
| 23 | SEO: meta + OG + Twitter card tags live           | Person E | Apr 29   | todo        | —                                | pass: tags present on all major pages; OG image renders          |
| 24 | SEO: sitemap.xml and robots.txt deployed          | Person E | Apr 30   | todo        | —                                | pass: sitemap indexed by Google Search Console                   |
| 25 | SEO: structured data (EducationalOrganization)    | Person E | Apr 30   | todo        | —                                | pass: no errors in Google Rich Results Test                      |
| 26 | Soft launch with 20–50 students (kickoff + prep)  | All      | Apr 30   | todo        | All above must be in-progress    | pass: pilot cohort ready, launch checklist approved, onboarding runbook shared |

---

## Launch Gates

### Data Gate

| Check                                    | Result  |
|------------------------------------------|---------|
| Paper code parser passing all edge cases | pending |
| 95%+ ingestion success rate              | pending |
| Zero unmapped question entries from QA set | pending |

**Gate status:** `pending` — must be `pass` before Phase 2 starts.

---

### UX Gate

| Check                                    | Result  |
|------------------------------------------|---------|
| Browse page displays real data           | pending |
| Mobile layout passes 375px QA           | pending |
| Profile page renders all fields          | pending |
| No broken links in browse cards          | pending |

**Gate status:** `pending` — must be `pass` before Phase 3 starts.

---

### Monetization Gate

| Check                                           | Result  |
|-------------------------------------------------|---------|
| Coin earn events fire correctly                 | pending |
| Coin deduction on AI job confirmed              | pending |
| Coin refund on failure confirmed                | pending |
| Admin coin credit/debit panel functional        | pending |

**Gate status:** `pending` — must be `pass` before soft launch.

---

### SEO Gate

| Check                                           | Result  |
|-------------------------------------------------|---------|
| All pages have title + meta description         | pending |
| sitemap.xml submitted to Google Search Console  | pending |
| No structured data errors                       | pending |
| Core Web Vitals: LCP < 2.5s on key pages        | pending |

**Gate status:** `pending` — must be `pass` before public promotion.

---

### Ops Gate

| Check                                           | Result  |
|-------------------------------------------------|---------|
| AI model fallback tested under quota pressure   | pending |
| Queue depth monitoring active                   | pending |
| Admin dashboard showing cost and usage          | pending |
| Error rate < 2% on AI jobs                      | pending |

**Gate status:** `pending` — must be `pass` before public launch.

---

## Go/No-Go Decision Table

To be reviewed by **Person A** on **April 30, 2026** before public announcement.

| Gate              | Pass Required | Status  | Decision Impact                                    |
|-------------------|---------------|---------|----------------------------------------------------|
| Data Gate         | Yes           | pending | No-Go if fail — data integrity is non-negotiable   |
| UX Gate           | Yes           | pending | No-Go if fail — broken UX will hurt retention      |
| Monetization Gate | Yes           | pending | No-Go if fail — revenue loop must work at launch   |
| SEO Gate          | No            | pending | Soft-launch allowed; SEO can improve post-launch   |
| Ops Gate          | Yes           | pending | No-Go if fail — AI downtime during launch is critical |

**Final decision:**
- All required gates `pass` by Apr 30 → **GO — proceed with pilot/public launch sequence**
- Any required gate `fail` on Apr 30 → **NO-GO — delay to June 1 fallback**
- Record decision + reasoning in this doc before announcement
