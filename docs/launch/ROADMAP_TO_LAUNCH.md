# ExamArchive v3 - 30 Day Master Plan (Target: Apr 30)

## Team Recommendation (3-4 Members)
To hit the aggressive late-April/early-May deadline, a team of **3 to 4 people** is ideal so tasks can be run in parallel:
1. **Data/Backend Engineer:** Handles the new Markdown parsing logic (Syllabus vs Questions split) and the complex Paper Code regex system.
2. **Frontend Developer:** Focuses entirely on the UI/UX redesigns (Profile Page, Browse Page with integrated PDF viewing).
3. **Full-Stack/Gamification Dev:** Implements the XP/Role auto-assignment system and the virtual currency economy.
4. **AI/SEO Specialist (Optional/Shared):** Refines AI prompts to match college requirements and handles the final SEO optimization.

## The 30-Day Timeline

### Phase 1: Core Data Infrastructure & Parsing (Days 1 - 7)
*   **Split Markdown Structure:** Deprecate `DEMO_DATA_ENTRY.md`. Implement `MASTER_SYLLABUS.md` and `MASTER_QUESTION.md`.
*   **Paper Code Logic Engine:** Build a strict parser for codes like `PHYDSC101T`.
    *   *Subject (3 letters):* e.g., `PHY` (Physics)
    *   *Type (3 letters):* `DSC`, `DSM`, `SEC`, `IDC`, `AEC`, `VAC`
    *   *Semester (3 digits):* `101` (1st), `151` (2nd), `201` (3rd) ... `451` (8th).
*   **Data Ingestion Pipeline:** Ensure the system dynamically sorts and groups questions under the correct syllabus by matching paper code, year, and group automatically.

### Phase 2: UI/UX Redesign & Integration (Days 8 - 15)
*   **Profile Page Redesign:** Modernize the user dashboard to prepare for XP, roles, and virtual currency displays.
*   **Browse Page Overhaul:** Redesign the browse experience.
*   **Inline PDF Viewer:** Link pages so users can view PDF paper notes directly inside the Browse page without external redirects.

### Phase 3: Gamification & Economy (Days 16 - 22)
*   **XP & Role System:** Develop the background cron/logic that auto-assigns roles based on user activity (e.g., uploads, correct answers, time spent).
*   **Virtual Currency (Monetization Prep):** Implement an in-app currency system (no payment gateway needed yet). Award coins for contributions and require coins for premium notes/downloads.

### Phase 4: AI Prompt Polish & SEO (Days 23 - 30)
*   **AI Prompt Stabilization:** Fix and fine-tune AI prompts tailored specifically to your college's strict syllabus needs.
*   **SEO Optimization:** Add dynamic meta tags, structured JSON-LD data for courses/syllabus, and generate sitemaps to ensure Google indexes the new structure.
*   **Final QA & Launch:** Bug hunting and final deployment by April 30.

---

## Proposed New Master Entry Structures

### 1. MASTER_SYLLABUS_ENTRY.md
```markdown
---
paper_code: PHYDSC101T
subject: PHY
type: DSC
semester: 101
paper_name: Mechanics
university: Assam University
course: FYUG
stream: Science
---

## Syllabus

| unit_number | syllabus_content | lectures | tags |
|---|---|---|---|
| 1 | Scalars, vectors, displacement, velocity, acceleration | 12 | kinematics,vector |
| 2 | Relative motion and projectile motion derivations | 10 | projectile |
```

### 2. MASTER_QUESTION_ENTRY.md
```markdown
---
paper_code: PHYDSC101T
year: 2023
group: A
exam_type: Final
---

## Questions

| question_no | subpart | question_content | marks | tags |
|---|---|---|---|---|
| 1 | a | Define scalar and vector with examples. | 2 | vector,kinematics |
| 1 | b | Derive equations of uniformly accelerated motion. | 5 | kinematics |
```
