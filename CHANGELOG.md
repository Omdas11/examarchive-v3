# Changelog

User-visible changes to ExamArchive, newest first. Curated from the git
history (1,709 commits from 2026-03-05) and the project's own records —
major features, migrations, and important fixes only, not every commit.
Dates are commit dates from git log unless noted otherwise.

## 2026-11-21

- Admin exam-timetable tracker (`/admin/exam-timetable`, moderator/founder
  only): the HGC Nov–Dec 2026 exam programme as a tracker — 267 exam slots,
  21 Nov–22 Dec 2026. Pick a date and the other date columns grey out or
  hide; the picked date expands to per-paper cards with the paper link
  (new tab), syllabus status + link, and related papers for 2023–2026
  (a missing 2026 paper shows "after exam"). At launch, 145 of 267 slots
  had a matching paper.
- Admin MD verification queue (`/admin/md-verification`): side-by-side PDF
  vs markdown review, Approve / Needs fix, AI upload via upload codes,
  +25 XP and +5 AI credits on approve (once per item).
- Daily login XP: +10 XP on the first signed-in visit of each UTC day,
  with a day streak and an animated gold reward toast (with a chime);
  profile redesigned around AI Credits / Day Streak / Papers Viewed.
- Course picks (DSC/DSM/SEC/IDC/AEC/VAC) now saved to D1
  (`user_course_prefs`) and shown in the admin users list, with a
  Department column for the DSC major; admin "Last seen" column added.
- Admin users table fits on a 1366px laptop (the 4 empty columns hide
  below 2xl); sidebar highlights exactly one item; collapsed-rail icons
  centred.
- Hero heading: gradient text ("Past Papers & Syllabi" emerald-to-teal,
  "HGC Students." blue-to-indigo); the shine-sweep rectangle removed.

## 2026-11-20

- Smart Placement enabled on the Worker (owner-approved) to cut the
  ~25% 504 rate on page loads.
- AI Notes: Cloudflare-native generator — 1 free PDF/day per registered
  account (UTC day), then 10 credits per set, 1 free rerun per paid
  generation; model chain Gemini 3.5 Flash-Lite → Gemma 4 → Groq →
  OpenRouter → GitHub Models, PDF rendered by a private Hugging Face
  Space. Verified working end to end, then put in maintenance for
  everyone except the founder the same day, pending syllabus grounding.
- Commerce 5th/6th-semester FYUGP gap filled: 10 clean papers added
  (Financial Management, Financial Institutions and Services, Indirect
  Tax Law, Business Mathematics, Economy of North-East India;
  Management Accounting, Consumer Behaviour, Indian Banking,
  Fundamentals of Investment, Corporate Tax Planning).

## 2026-11-19

- `/colleges`: all 75 Assam University-affiliated colleges, alphabetical,
  with location and official website (67 verified); Haflong Govt College
  shows "Papers available", the other 74 "Covering soon".
- `/maintenance-cost`: support page showing the site's running costs
  (everything Rs 0 except the domain) with Razorpay donations
  (minimum Rs 20; a live Rs 20 order verified the same day).
- Dashboard rebuilt on real D1 data (it had shown mock data). Browse:
  filter rows scroll horizontally, Clear filters button, search ignores
  hyphens/spaces/case, and a request-a-paper form (5 requests per email
  per 24 hours).
- Canonical tags fixed (all pages had pointed at the homepage);
  Google-InspectionTool exempted from the WAF so indexing can be
  requested. Search Console, 28 days to 17 Nov: 237 clicks, 3,860
  impressions.
- Inbound email moved to Cloudflare Email Routing for all 6 site
  addresses (contact@, privacy@, feedback@, support@, help@, bugs@).
- Dead admin/devtool API routes deleted (Appwrite code that could not
  run on Workers; the endpoints now 404).

## 2026-11-18

- **Cloudflare cutover live**: DNS cut over (examarchive.dev + www,
  SSL); Google sign-in only (D1 sessions, hand-rolled OIDC); 28 pages
  moved off the dead Appwrite login; papers and PDF downloads served
  from R2 + D1. Homepage, paper pages, Browse, and search verified
  returning 200; guest download/view verified on the owner's phone.
- Data migration: 636 papers mapped to R2 file keys; D1 import of 3,253
  rows verified (Phase 4); D1 schema of 31 tables and 79 indexes
  (Phase 3); homepage stats and paper lists KV-cached to stop the
  D1 read burn.
- All ad scripts disabled behind the `ADS_ENABLED=false` flag (owner:
  ads are annoying on an early site).

## 2026-11-17

- Cloudflare migration Phases 1–3: inventory, D1/R2/KV bindings,
  OpenNext adapter, preview working.
- Syllabus temporarily disabled (`SYLLABUS_DISABLED`, 503) until all
  517 papers are verified; the generate-notes route blocked.
- Sitemap restored to all 517 syllabus paper URLs (a bug had left 48);
  sitemap cached (it had burned ~3,200 Appwrite reads per hit).
- Monetag ads activated (verification meta tag + banner sections).
- Upload buttons removed from the UI — uploads are done from the team
  side.

## 2026-11-15

- View/download counts live on paper and syllabus cards, and Recently
  viewed / Downloads on profiles.
- LearnFo source attribution on all 451 LearnFo papers ("Source:
  LearnFo" links).

## 2026-11-14

- Cloudflare Turnstile replaces hCaptcha on downloads and all login
  forms.
- Discord OAuth2 account linking from `/profile` (identify + guilds
  scopes); the ExamArchive Discord bot verified, working on demand.
- Nightly closure removed permanently — the site stays open 24/7.
- Syllabus page redesign and site-wide fixes from the 2026-11-14
  audit; the old upload, AI stats, MD ingestion, and syllabus
  verification pages removed.

## 2026-11-13

- Founder promotion (omdasg11@gmail.com is founder); Google avatar in
  the header; `/stats` page (total pages, registered users, visitors,
  hourly page-view chart).
- Appwrite project migration: 667 of 667 files moved to the new
  Singapore project, 636 papers, old paper IDs 308-redirected. View
  and download counts, uploader names, and user profiles were lost
  in the move.

## 2026-11-12

- Support via an embedded Razorpay payment button (replaces a plain
  link and a public UPI ID).
- README and docs cleaned up to match the live site.

## 2026-11-09

- Notes section live: 20 study-note PDFs, 7th semester, 534 pages,
  at `/notes` (landing + per-paper pages).

## 2026-11-08

- Appwrite read limits: shared caches for papers and syllabus lists.

## 2026-11-06

- Syllabus department pages grouped by semester.

## 2026-11-05

- Syllabus by department: 13 sub-pages, paper URLs subdivided by
  department.
- Avatar uploads removed; store set to Coming Soon; uploads team-only.

## 2026-10-27

- Single XP ladder (rank removed; tier derived from XP alone: Bronze 0,
  Silver 100, Gold 300, Platinum 800, Diamond 1500+).
- Verify-to-earn: content-verification ledger, `/api/verify`, and an
  admin review queue.

## 2026-10-15

- MIT license added.

## 2026-10-13

- Public app endpoints for the native app: syllabus JSON and a
  JWT-gated syllabus PDF proxy.

## 2026-10-03

- FYUG / CBCS / Assam University SEO landing pages; all 13 department
  landing pages; URL-synced browse filters; moderator bulk-import for
  curated paper batches; CBCS/FYUG programme badges on paper pages.

## 2026-07-01

- Syllabus Verification sidebar; Syllabus Vault link in the main
  sidebar.

- No commits in August–September 2026.

## 2026-06-25

- Cross-subdomain auth (syllabus vault subdomain) with redirect
  handling for all login methods.

## 2026-06-23

- Syllabus admin verification flow.

## 2026-06-06

- Academic Vitality redesign.

## 2026-06-05

- Credit system simplified: referral system removed; passes and
  subscriptions reintroduced.

## 2026-05-04

- Soft-launch stability fixes across PDF generation, credits, uploads,
  and reset.

## 2026-04-30

- Soft launch of examarchive.dev. (Date as recorded in the README;
  there is no single launch commit in the git history.)

## 2026-04

- AI generation pipeline built: Gemini (later Groq) model calls with a
  free-tier fallback chain, Gotenberg PDF rendering via a Hugging Face
  Space, notes generation with a timeline UI, and a syllabus tracker
  rebuilt from the canonical Haflong baseline.
- Markdown ingestion split into syllabus/question flows; v2 role model
  and profile right sidebar; store and Razorpay APIs.

## 2026-03-29

- Syllabus registry sync pipeline (backend-driven registry); AI
  flashcards study dashboard with Gemini fallback.

## 2026-03-05

- Project start. First commits: admin user management, moderation
  queue, activity log, role badges, and gamification; auth UI; upload
  with progress UX; Google sign-in; browse and footer.
