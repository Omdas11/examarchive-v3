# ExamArchive

Free past-exam-papers and syllabi archive for Haflong Government College (Assam University) FYUGP students.

- **Live site:** https://examarchive.dev (also https://www.examarchive.dev)
- **Syllabus site:** https://syllabus.examarchive.dev
- **Android app:** separate repo — [Omdas11/examarchive-android](https://github.com/Omdas11/examarchive-android) (Flutter)

## What it has

- **654 approved exam papers** (13 HGC departments, Assam University FYUGP) with search, browse by department/semester/year, and PDF view/download. Downloads are gated by Cloudflare Turnstile; guests can download, no login needed. At the 2026-11-20 count there were 653 papers: 479 FYUGP, 134 CBCS, 40 with no code; one more (UNIVAC-101T 2026) was added 2026-11-21.
- **Syllabus directory:** 517 syllabus papers, 2,585 syllabus rows in the database — temporarily disabled (see status below).
- **Notes:** 20 study-note PDFs (7th semester, 534 pages) at [/notes](https://examarchive.dev/notes), no login needed.
- **Accounts & gamification:** one XP ladder (Bronze 0 / Silver 100 / Gold 300 / Platinum 800 / Diamond 1500+); XP is earned by verifying AI content, plus +10 XP on the first signed-in visit of each UTC day (with a day streak). Virtual currency is called **tokens**; AI credits pay for AI Notes. Course picks (DSC/DSM/SEC/IDC/AEC/VAC) are saved to the database and shown to admins.
- **AI Notes:** generates a study-notes PDF for a topic — 1 free PDF/day per registered account, then 10 credits per set. Currently in maintenance for everyone except the founder (see status below).
- **Colleges:** [/colleges](https://examarchive.dev/colleges) lists all 75 Assam University-affiliated colleges (HGC shows "Papers available", the rest "Covering soon").
- **Support:** [/maintenance-cost](https://examarchive.dev/maintenance-cost) shows the site's running costs (everything Rs 0 except the domain) and takes support via Razorpay (minimum Rs 20).
- **Admin:** dashboard, user management, MD verification queue (syllabus markdown review), and an exam-timetable tracker (`/admin/exam-timetable`) for the Nov–Dec 2026 exams. Moderator/founder only.

## Current status (2026-11-21)

- **Open 24/7.** The nightly closure was removed permanently on 2026-11-14.
- **Live on Cloudflare since 2026-11-18** (DNS cut over, SSL on examarchive.dev + www). Google sign-in only; the old Appwrite login is gone.
- **Syllabus temporarily disabled** — `/syllabus*` returns 503 and syllabus APIs return 503 JSON (flag `SYLLABUS_DISABLED` in `src/lib/site-flags.ts`; set it to `false` to re-enable). No syllabus data was deleted; the 2,585 rows are still in D1.
- **AI Notes in maintenance** — `/ai-content` shows a maintenance notice and generation returns 503 for everyone except the founder (flag `AI_NOTES_MAINTENANCE`). Flip the flag to reopen.
- **Store is Coming Soon.** Token balances are hidden while the store is closed; the token economy keeps running.
- **Uploads are team-only** (moderator+). Regular users see a team-handled notice.
- **Avatar uploads removed.** Google sign-ins use the Google profile photo; everyone else gets initials.
- **Ads are off** behind the `ADS_ENABLED=false` flag (owner: ads are annoying on an early site). The Privacy/Terms pages and footer still mention ads — out of date until the owner says otherwise.
- **AdSense not approved yet** (rejected 2026-10-31). Domain `examarchive.dev` renewal (₹2,254.75/yr) is due 2027-01-27 and unpaid.
- **Read budget:** D1 reads are budgeted — put a read estimate before any deploy and do no bulk, migration, export, or non-essential data work against production without the owner's explicit ask.

## Tech

Next.js 15 (App Router) + [@opennextjs/cloudflare](https://github.com/opennextjs/opennextjs-cloudflare), Tailwind CSS. Live backend is Cloudflare Workers:

- **D1** database `examarchive-db` (binding `DB`)
- **R2** bucket `examarchive-papers` (binding `PAPERS`)
- **KV** cache namespace `CACHE`
- Google sign-in via hand-rolled OIDC with D1 sessions; Cloudflare Turnstile gates downloads and login forms.

Work happens on branch `migrate/cloudflare`. Deploy with `npm run deploy` (builds with OpenNext and deploys to Workers). A legacy `vercel.json` and Appwrite-era files (`.env.example`, Appwrite sync scripts) remain in the repo — they are **not** how the live site is deployed; do not treat a Vercel push as a production deploy.

Appwrite was the old backend (Singapore project, database `examarchive`). Data was migrated to D1/R2 in November 2026; the Appwrite project is kept only as a backup source.

## Quick start

```bash
npm install
npm run dev     # http://localhost:3000 (Cloudflare adapter is initialised for dev)
npm run preview # Workers preview on :8787
npm run deploy  # build with OpenNext and deploy to Cloudflare Workers
```

Bindings come from `wrangler.jsonc` (`DB` → D1 `examarchive-db`, `CACHE` → KV, `PAPERS` → R2 `examarchive-papers`). Secrets are Worker secrets, never committed:

```bash
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
# ...and the other keys listed in docs/cloudflare-migration/phase5-google-auth.md
```

For local dev, put local-only secrets in `.dev.vars` (gitignored).

> Note: `.env.example` is from the Appwrite era and is stale — do not copy it for the Cloudflare build. AI features additionally need a Gemini key and the Gotenberg PDF URL — see [`docs/AI_NOTES_SETUP.md`](./docs/AI_NOTES_SETUP.md) and [`docs/HF_GOTENBERG_SETUP.md`](./docs/HF_GOTENBERG_SETUP.md).

## Docs

- Primary README: [`docs/README.md`](./docs/README.md)
- Database schema: [`docs/DATABASE_SCHEMA.md`](./docs/DATABASE_SCHEMA.md)
- Roles & XP ladder: [`docs/ROLES.md`](./docs/ROLES.md)
- Token economy: [`ECONOMY_AND_PASSES.md`](./ECONOMY_AND_PASSES.md)
- Syllabus registry (source of truth): [`docs/SYLLABUS_REGISTRY.md`](./docs/SYLLABUS_REGISTRY.md)
- Upload flow (team-only): [`docs/UPLOAD_FLOW.md`](./docs/UPLOAD_FLOW.md)
- Contributor + QA playbook: [`docs/CONTRIBUTOR_OPERATIONS_GUIDE.md`](./docs/CONTRIBUTOR_OPERATIONS_GUIDE.md)
- Ingestion format guardrails: [`docs/MASTER_INGESTION_GUIDE.md`](./docs/MASTER_INGESTION_GUIDE.md)
- AI notes setup: [`docs/AI_NOTES_SETUP.md`](./docs/AI_NOTES_SETUP.md)
- HF Gotenberg (PDF rendering) setup: [`docs/HF_GOTENBERG_SETUP.md`](./docs/HF_GOTENBERG_SETUP.md)
- Cloudflare migration (Phases 1–6): [`docs/cloudflare-migration/`](./docs/cloudflare-migration/)
- GA4 setup guide: [`docs/launch/GOOGLE_ANALYTICS_SETUP.md`](./docs/launch/GOOGLE_ANALYTICS_SETUP.md)
- Simple Analytics setup guide: [`docs/SIMPLE_ANALYTICS_SETUP.md`](./docs/SIMPLE_ANALYTICS_SETUP.md)
- Launch progress automation: [`docs/launch/PROGRESS_AUTOMATION.md`](./docs/launch/PROGRESS_AUTOMATION.md)
- Snyk GitHub Actions workflow: [`.github/workflows/snyk.yml`](./.github/workflows/snyk.yml) (requires `SNYK_TOKEN` repository secret)

The launch plans under [`docs/launch/`](./docs/launch/) are archived — the site launched April 30, 2026; do not follow them as current instructions. Change history lives in [`CHANGELOG.md`](./CHANGELOG.md).

Run scripts and workflows from the repository root as before. Agent working notes live in [`.agents/AGENTS.md`](./.agents/AGENTS.md).
