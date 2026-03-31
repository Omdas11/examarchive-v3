# ExamArchive Startup To-Do (AI + Author Tasks)

This checklist is based on the current codebase and is organized by ownership:

- **AI** = engineering/product work that can be implemented in this repo.
- **Author** = founder/content/community/business tasks outside pure code.

## 0) Initial Tasks to Start Immediately (Week 1)

- [ ] **AI** Add GA4 custom event tracking hooks for upload, download, signup, referral usage, and AI generation completion.
- [ ] **AI** Improve sitemap generation to include dynamic paper and syllabus URLs.
- [ ] **AI** Add a lightweight first-login onboarding modal (Browse → Upload → AI Study flow).
- [ ] **Author** Claim and verify Google Search Console for the production domain.
- [ ] **Author** Define top 3 target student segments (e.g., FYUGP 1st year, CBCS science, commerce) and success metrics.
- [ ] **Author** Recruit 20 pilot students and 3 campus ambassadors for feedback loops.

## 1) SEO & Discoverability

### Technical SEO
- [ ] **AI (P0)** Generate dynamic sitemap entries from approved papers/syllabi instead of only static routes.
- [ ] **AI (P1)** Add page-level FAQ schema for high-intent pages (Browse, Upload, AI study assistant).
- [ ] **AI (P1)** Add breadcrumb structured data for Browse → Paper hierarchy.
- [ ] **AI (P2)** Add `hreflang` support if multilingual content is introduced.

### Content SEO
- [ ] **Author (P0)** Build a keyword map: university + department + semester + "question paper" intent clusters.
- [ ] **Author (P0)** Publish course/program landing pages with semester-wise internal links.
- [ ] **Author (P1)** Create "How to prepare using past papers" guides linking back to relevant papers.
- [ ] **Author (P1)** Run monthly SEO content updates based on Search Console queries.

## 2) Analytics & Measurement (Google Analytics + Product KPIs)

- [ ] **AI (P0)** Implement GA4 event taxonomy from [GOOGLE_ANALYTICS_SETUP.md](./GOOGLE_ANALYTICS_SETUP.md).
- [ ] **AI (P0)** Track conversion funnel: `signup_completed` → `paper_downloaded` → `paper_uploaded` → `ai_generation_completed`.
- [ ] **AI (P1)** Add referral attribution event trail (share link opened, code used, activated).
- [ ] **AI (P1)** Add dashboards for weekly active students, upload approval rate, and AI usage per active user.
- [ ] **Author (P0)** Define North Star metric (e.g., weekly retained students who open at least one paper + one AI action).
- [ ] **Author (P1)** Review KPI dashboard weekly and prioritize one growth experiment per sprint.

## 3) Student Viewpoint Improvements

- [ ] **AI (P0)** Add onboarding + empty-state guidance for new users.
- [ ] **AI (P0)** Improve search relevance (paper code exact match boost + typo tolerance + filters persistence).
- [ ] **AI (P1)** Add "Recently viewed", "Saved papers", and personalized "Recommended next papers".
- [ ] **AI (P1)** Improve mobile PDF reading ergonomics (zoom defaults, quick actions, reading progress).
- [ ] **AI (P2)** Add in-app note-taking/highlights linked to paper pages.
- [ ] **Author (P0)** Conduct monthly student usability tests (at least 10 students) and rank pain points by severity.
- [ ] **Author (P1)** Maintain semester launch checklist (which papers are missing, upload outreach per department).

## 4) PDF + Notes Distribution Strategy

- [ ] **AI (P0)** Keep moderation gate for quality + trust; surface moderation SLA to uploaders.
- [ ] **AI (P1)** Introduce "verified quality" badges for well-formatted/complete papers.
- [ ] **AI (P1)** Prepare infrastructure for chunked PDF extraction to improve AI context quality.
- [ ] **AI (P2)** Add collections/sets (e.g., "Last 5 years set") for one-click study packs.
- [ ] **Author (P0)** Define content quality rubric (scan quality, completeness, metadata correctness).
- [ ] **Author (P0)** Build contributor playbook for scanning/naming/uploading files consistently.
- [ ] **Author (P1)** Launch "department curators" program to maintain coverage.

## 5) Gamification Expansion

- [ ] **AI (P0)** Make XP reward rules explicit in UI (what action gives how much XP/credits).
- [ ] **AI (P1)** Add tier progression milestones and unlock previews.
- [ ] **AI (P1)** Add weekly leaderboard for uploads, approvals, and helpful contributions.
- [ ] **AI (P2)** Add streak rescue mechanics (1 missed day protection token).
- [ ] **Author (P0)** Define anti-abuse policy for fake referrals/spam uploads.
- [ ] **Author (P1)** Run monthly campus challenge campaigns with clear rewards.

## 6) In-App Purchases (Future Monetization)

- [ ] **AI (P0 design)** Create a credits wallet spec (earn vs buy, expiry, refunds, audit trail).
- [ ] **AI (P1)** Add payment provider integration plan (Razorpay/Stripe depending on region).
- [ ] **AI (P1)** Implement purchase events + entitlement checks for premium AI actions.
- [ ] **AI (P2)** Add freemium plans: free, plus, pro (rate limits + feature gates).
- [ ] **Author (P0)** Validate willingness-to-pay with surveys/interviews before shipping billing.
- [ ] **Author (P1)** Define pricing experiments and scholarship/free-access policy.

## 7) AI Feature Roadmap (Best-in-class model monetization path)

- [ ] **AI (P0)** Add explicit source/citation cards for generated notes.
- [ ] **AI (P1)** Add generation quality feedback loop (thumbs up/down + issue reason).
- [ ] **AI (P1)** Add model routing policy by task type (cheap fast model vs high-quality model tiers).
- [ ] **AI (P2)** Add "exam practice mode": predicted questions + rubric-based answer review.
- [ ] **AI (P2)** Add "revision planner" that generates day-wise plans from exam date.
- [ ] **Author (P0)** Define responsible AI policy and disclosure text for students.
- [ ] **Author (P1)** Curate premium bundles (e.g., "exam sprint pack" with guided AI workflows).

## 8) Operating Rhythm for a Successful Startup

- [ ] **AI** Ship in weekly increments with measurable event impact.
- [ ] **Author** Run a weekly growth review: acquisition, activation, retention, referral, revenue.
- [ ] **AI + Author** Keep a public changelog and student feedback board.
- [ ] **AI + Author** Set quarterly goals for content coverage, retention, and paid conversion readiness.
