# 30_DAY_EXECUTION_PLAN.md

**Execution window:** April 8, 2026 → May 7, 2026
**Primary target:** Production-ready by May 1, 2026

---

## Week 1 (Apr 8–Apr 14) — Hard Foundation

**Focus:** Stabilize core data structures so no downstream work is blocked.

| Day        | Tasks                                                                 | Owner    |
|------------|-----------------------------------------------------------------------|----------|
| Apr 8–9    | Finalize paper code parser + validation rules; commit to docs         | Person B |
| Apr 8–9    | Scope lock meeting; define "done" for all modules                     | Person A |
| Apr 10–11  | Introduce `MASTER_SYLLABUS_ENTRY.md` and `MASTER_QUESTION_ENTRY.md`   | Person B |
| Apr 10–11  | Build ingestion validation checks (type, semester, format)            | Person B |
| Apr 12–13  | Add syllabus tracker visibility for valid/invalid/unmapped/duplicate  | Person D |
| Apr 14     | QA pass on sample ingestion data; fix failures                        | Person D |

**Deliverable:** Stable, validated ingestion pipeline; all contributors know exact format.

---

## Week 2 (Apr 15–Apr 21) — Data Linking + Browse Backbone

**Focus:** Connect data across syllabus, questions, and browse page.

| Day        | Tasks                                                                 | Owner    |
|------------|-----------------------------------------------------------------------|----------|
| Apr 15     | Auto-link question ↔ syllabus by paper code + year + group            | Person B |
| Apr 16–17  | Redesign browse page architecture and filter system                   | Person C |
| Apr 18–19  | Integrate PDF notes into browse cards (syllabus + papers + notes)     | Person C |
| Apr 20     | Add regression checks for mapping accuracy                            | Person D |
| Apr 21     | Browse QA pass on real data; fix layout and link issues               | Person C + D |

**Deliverable:** Unified browse experience driven by real ingested data.

---

## Week 3 (Apr 22–Apr 28) — Profile + Roles/XO + Prompt Reliability

**Focus:** Student-facing usability and reliable AI output quality.

| Day        | Tasks                                                                 | Owner    |
|------------|-----------------------------------------------------------------------|----------|
| Apr 22–23  | Profile page redesign (activity, contributions, role/XO, saved PDFs) | Person C |
| Apr 24–25  | Activity-based Role/XO rule engine (see `ROLE_XO_RULEBOOK.md`)        | Person B |
| Apr 26     | AI prompt templates per task type (see `AI_PROMPT_STANDARDS.md`)      | Person E |
| Apr 27     | Lock AI output schema; add moderation queue for low-confidence output | Person E |
| Apr 28     | Full AI output QA pass; fix schema violations                         | Person E + D |

**Deliverable:** Student-facing pages polished; AI outputs schema-validated.

---

## Week 4 (Apr 29–May 7) — Monetization + SEO + Launch Ops

**Focus:** Revenue foundation, search visibility, and production readiness.

| Day        | Tasks                                                                 | Owner    |
|------------|-----------------------------------------------------------------------|----------|
| Apr 29     | Virtual currency MVP (earn/spend coin loop, admin config panel)       | Person F |
| Apr 30     | Configure AI usage pricing tiers (Basic / Standard / Premium)         | Person F |
| May 1      | SEO baseline: meta, OG, sitemap.xml, robots.txt, structured data      | Person E |
| May 2      | Internal link audit + page speed pass                                 | Person E |
| May 3      | Soft launch with 20–50 students; collect breakpoints                  | All      |
| May 4–5    | Bug triage; critical fixes only                                       | All      |
| May 6      | Production freeze; final QA sign-off                                  | Person A + D |
| May 7      | Public launch announcement                                            | Person A |

**Deliverable:** Monetization-ready, SEO-complete, publicly launchable platform.

---

## Daily Cadence (AI-assisted team)

| Block         | Duration | Activity                              |
|---------------|----------|---------------------------------------|
| Morning sync  | 30 min   | Task assignment + blocker check       |
| Work block 1  | 2 hr     | Implementation with AI assistance     |
| Work block 2  | 2 hr     | Implementation or QA                  |
| End of day    | 30 min   | Issue tagging + doc updates           |

---

## Ownership Matrix

| Role                         | Person   | Primary Responsibilities                               |
|------------------------------|----------|--------------------------------------------------------|
| Product lead / release mgr   | Person A | Scope, milestones, go/no-go decisions                  |
| Ingestion + schema lead       | Person B | Parser, master entries, auto-linking, DB work          |
| Frontend UI builder           | Person C | Browse + Profile redesign, mobile layout               |
| QA + mapping validator        | Person D | Test coverage, data QA, tracker checks                 |
| AI + SEO                      | Person E | Prompt templates, output QA, meta/sitemap/schema       |
| Monetization + ops            | Person F | Coin economy, AI pricing, admin tooling, UPI ledger    |

---

## Must-Not-Slip Milestones

| Date   | Milestone                                              |
|--------|--------------------------------------------------------|
| Apr 15 | Parser + master ingestion format stable                |
| Apr 22 | Browse/profile + link flow stable                      |
| Apr 28 | Role/XO + AI prompt system stable                      |
| May 1  | Launch candidate + student pilot complete              |
| May 7  | Public launch                                          |

---

## Risk Register

| Risk                                  | Likelihood | Impact | Mitigation                                      |
|---------------------------------------|------------|--------|-------------------------------------------------|
| Paper code parser bugs in edge cases  | Medium     | High   | Run against all historical codes before Apr 15  |
| Browse redesign takes too long        | Medium     | High   | Use existing component library; no full rewrite |
| AI output quality inconsistent        | High       | Medium | Lock prompt + schema; use fallback on failures  |
| Gemini 500 RPD hit during soft launch | High       | High   | Implement queue + coin rate limiting before May 1|
| Team bandwidth (non-coders)           | Medium     | High   | Assign one clear AI tool per person; daily check|
