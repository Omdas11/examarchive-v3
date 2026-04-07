# ExamArchive v3

ExamArchive is a student-first platform to discover, contribute, and study from university exam papers and syllabi.  
This repository contains the Next.js 15 + Appwrite implementation.

## Quick Start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill required values (see [docs/ENVIRONMENT.md](./ENVIRONMENT.md)).

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

The growth and monetization prep checklist is documented in focused docs:

- [../MONETIZATION_ROADMAP.md](../MONETIZATION_ROADMAP.md) — staged implementation roadmap for credits economy, manual UPI verification, tiered content, and operations.
- [docs/GOOGLE_ANALYTICS_SETUP.md](./GOOGLE_ANALYTICS_SETUP.md) — GA4 setup + event instrumentation guide for conversion tracking.
- [docs/SIMPLE_ANALYTICS_SETUP.md](./SIMPLE_ANALYTICS_SETUP.md) — Simple Analytics setup for lightweight pageview tracking.

## Documentation Index

| Document | Description |
|----------|-------------|
| [../MONETIZATION_ROADMAP.md](../MONETIZATION_ROADMAP.md) | Roadmap for monetization, wallet, entitlements, and moderation operations |
| [docs/GOOGLE_ANALYTICS_SETUP.md](./GOOGLE_ANALYTICS_SETUP.md) | GA4 implementation and event taxonomy guide |
| [docs/SIMPLE_ANALYTICS_SETUP.md](./SIMPLE_ANALYTICS_SETUP.md) | Simple Analytics configuration steps and verification checklist |
| [DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md) | Primary schema document used by sync workflows and root tooling |
| [docs/DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | Secondary schema snapshot for docs-focused references |
| [docs/UPLOAD_FLOW.md](./UPLOAD_FLOW.md) | End-to-end upload and moderation architecture |
| [docs/AI_SETUP.md](./AI_SETUP.md) | OpenRouter-based AI setup, limits, and endpoint behavior |
| [docs/ENVIRONMENT.md](./ENVIRONMENT.md) | Complete environment variable reference |
| [docs/AI_EXTENSIONS_SETUP.md](./AI_EXTENSIONS_SETUP.md) | AI extensions and RAG setup |
