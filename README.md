# ExamArchive

Free past-exam-papers and syllabi archive for Haflong Government College (Assam University) FYUGP students.

- **Live site:** https://examarchive.dev (also https://www.examarchive.dev)
- **Syllabus site:** https://syllabus.examarchive.dev
- **Android app:** separate repo — [Omdas11/examarchive-android](https://github.com/Omdas11/examarchive-android) (Flutter, v0.6.1-beta, talks directly to Appwrite)

## What it has

- **615 exam papers** (13 HGC departments, Assam University FYUGP) with search, browse by department/semester, and PDF download (login required).
- **Syllabus directory:** 566 syllabus papers across 13 departments, grouped by semester 1–8.
- **Notes:** 20 study-note PDFs (7th semester, 534 pages) at [/notes](https://examarchive.dev/notes), no login needed.
- **Accounts & gamification:** one XP ladder (Bronze 0 / Silver 100 / Gold 300 / Platinum 800 / Diamond 1500+); XP is earned by verifying AI content. Virtual currency is called **tokens**.
- **AI features** (notes generation, solved papers, flashcards) are currently disabled — see status below.

## Current status (2026-11-12)

- **Temporarily closed until Dec 5, 2026.** The free Appwrite plan's database reads are 92% used (462K/500K, cycle Nov 5 – Dec 5). Middleware redirects all pages to `/closed` and API calls return 503 until the next billing cycle, when reads reset.
- **Store is Coming Soon.** Token balances are hidden while the store is closed; the token economy keeps running.
- **Uploads are team-only** (moderator+). Regular users see a team-handled notice.
- **Only the `papers` Appwrite bucket remains.** The `paper-markdown` and `syllabus-files` buckets were deleted on 2026-11-05 (Free-plan downgrade). Dept syllabus PDF "View PDF" buttons are broken until a bucket fix moves their contents into a folder inside `papers`.
- **Avatar uploads removed.** Google sign-ins use the Google profile photo; everyone else gets initials.
- **AdSense not approved yet.** Domain `examarchive.dev` renewal (₹2,254.75/yr) is due 2027-01-27 and unpaid.

## Tech

Next.js 15 (App Router) + Appwrite (Singapore region, project `69a3e59300172d6a19cf`, database `examarchive`), Tailwind CSS, deployed on Vercel (push to `main` auto-deploys). One Appwrite Function: `pdf-generator`.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in your Appwrite values
npm run dev                  # http://localhost:3000
```

Required env vars are listed in `.env.example` (Appwrite endpoint/project/API key, database and bucket IDs). AI features additionally need `GEMINI_API_KEY` — see [`docs/AI_NOTES_SETUP.md`](./docs/AI_NOTES_SETUP.md).

> Note: `.env.example` still lists the deleted `syllabus-files` and `paper-markdown` bucket IDs — only `papers` exists. Do not create the deleted buckets.

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
- GA4 setup guide: [`docs/launch/GOOGLE_ANALYTICS_SETUP.md`](./docs/launch/GOOGLE_ANALYTICS_SETUP.md)
- Simple Analytics setup guide: [`docs/SIMPLE_ANALYTICS_SETUP.md`](./docs/SIMPLE_ANALYTICS_SETUP.md)
- Launch progress automation: [`docs/launch/PROGRESS_AUTOMATION.md`](./docs/launch/PROGRESS_AUTOMATION.md)
- Snyk GitHub Actions workflow: [`.github/workflows/snyk.yml`](./.github/workflows/snyk.yml) (requires `SNYK_TOKEN` repository secret)

The launch plans under [`docs/launch/`](./docs/launch/) are archived — the site launched April 30, 2026; do not follow them as current instructions.

Run scripts and workflows from the repository root as before. Agent working notes live in [`.agents/AGENTS.md`](./.agents/AGENTS.md).
