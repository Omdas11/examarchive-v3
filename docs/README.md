# ExamArchive v3

ExamArchive is a student-first platform to discover, contribute, and study from university exam papers and syllabi.  
This repository contains the Next.js 15 + Appwrite implementation.

## Quick Start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill required values.

3. Start the app:

   ```bash
   npm run dev
   ```

## Core Product Features

- Upload papers and syllabi with registry-based metadata auto-fill.
- Moderate every upload through an admin approval queue.
- Browse by department, semester, year, exam type, and paper code.
- Access files through authenticated proxy routes (no public bucket exposure).
- Use AI study tools (chat + note generation + PDF export).
- Earn XP/badges with referral support and AI credit rewards.

## Startup Readiness (Execution Docs)

The growth and monetization prep checklist is now split into focused docs:

- [docs/launch/LAUNCH_CHECKLIST.md](./launch/LAUNCH_CHECKLIST.md) — launch-critical checklist and gate statuses.
- [docs/CONTRIBUTOR_OPERATIONS_GUIDE.md](./CONTRIBUTOR_OPERATIONS_GUIDE.md) — operational playbook for contributors, QA, and release flow.
- [docs/launch/GOOGLE_ANALYTICS_SETUP.md](./launch/GOOGLE_ANALYTICS_SETUP.md) — GA4 setup + event instrumentation guide for conversion tracking.
- [docs/SIMPLE_ANALYTICS_SETUP.md](./SIMPLE_ANALYTICS_SETUP.md) — Simple Analytics setup for lightweight pageview tracking.

## Documentation Index

| Document | Description |
|----------|-------------|
| [docs/launch/LAUNCH_CHECKLIST.md](./launch/LAUNCH_CHECKLIST.md) | Phase-wise execution checklist with launch gates |
| [docs/CONTRIBUTOR_OPERATIONS_GUIDE.md](./CONTRIBUTOR_OPERATIONS_GUIDE.md) | Contributor responsibilities, QA process, and release readiness SOP |
| [docs/launch/GOOGLE_ANALYTICS_SETUP.md](./launch/GOOGLE_ANALYTICS_SETUP.md) | GA4 implementation and event taxonomy guide |
| [docs/SIMPLE_ANALYTICS_SETUP.md](./SIMPLE_ANALYTICS_SETUP.md) | Simple Analytics configuration steps and verification checklist |
| [docs/HF_GOTENBERG_SETUP.md](./HF_GOTENBERG_SETUP.md) | Move PDF rendering to Hugging Face Gotenberg and configure Next.js envs |
| [docs/DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | Appwrite collection schemas |
| [docs/UPLOAD_FLOW.md](./UPLOAD_FLOW.md) | End-to-end upload and moderation architecture |
| [docs/payments/razorpay-integration.md](./payments/razorpay-integration.md) | Razorpay verification routes and Purchases schema architecture |

## Appwrite AI Sync Automation

- On merge to `main`, `.github/workflows/appwrite-ai-sync.yml` now runs both:
  - `npm run sync:appwrite-ai` (AI schema/function sync)
  - `bash scripts/deploy-function.sh` (deploy/update `pdf-generator` function)
- This keeps `scripts/deploy-function.sh` and `appwrite-functions/pdf-generator/**` changes automatically synced to Appwrite after merge.
- Ensure repo secrets include `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`, `GOTENBERG_URL`, `GOTENBERG_AUTH_TOKEN`, `GEMINI_API_KEY`, and optionally Wikimedia image envs (`WIKIMEDIA_IMAGE_INJECTION_ENABLED`, `WIKIMEDIA_MAX_IMAGES`, `WIKIMEDIA_API_URL`, `WIKIMEDIA_REQUEST_TIMEOUT_MS`) plus `TAVILY_API_KEY` for solved-paper web context.
