# ExamArchive Ecosystem - Master Status

*Project started on: March 1, 2026 (Approx. 8.5 months old, as of Nov 12, 2026)*
*Note: `examarchive-v3` is the 3rd successful iteration of the platform. Its predecessors include `examarchive-ai` (started Nov 2025) and `examarchive-v2` (started Dec 2025).*

> **Current status 2026-11-12: the site is temporarily closed until Dec 5, 2026** (free Appwrite reads 92% used; middleware redirects all pages to `/closed`, API returns 503). Only the `papers` bucket survives. The store is Coming Soon and uploads are team-only.

This document tracks the high-level progress, completed features, known bugs, and next steps for the `examarchive-v3` and `examarchive-syllabus` repositories.

## 🏗️ Architecture
- **Main Site (`examarchive-v3`)**: Built on Next.js 15, acts as the primary hub for PYQs (Previous Year Question Papers) and the central authentication authority. Hosted at `examarchive.dev`.
- **Side Site (`examarchive-syllabus`)**: Secondary Next.js app to host and review Markdown-based syllabus documents. Hosted at `syllabus.examarchive.dev`.
- **Backend**: Appwrite (Database, Storage, Auth) with cross-subdomain `httpOnly` session cookies (`ea_session`).

## ✅ Completed Features
- **Cross-Domain Authentication**: The `ea_session` cookie is successfully shared across `.examarchive.dev` domains. The Side site correctly redirects unauthenticated users to the Main site's login page with a `?redirect=` parameter and seamlessly returns them back after login.
- **Syllabus Vault UI**: A dedicated interface for reviewing, parsing, and reading Syllabus MDX files with full GFM (GitHub Flavored Markdown) support and dynamic nested tables.
- **Dark Mode Synchronization**: Fixed `next-themes` and CSS selector mismatches in the side-site to ensure Dark Mode accurately shifts color variables.
- **Syllabus Approvals** (examarchive-syllabus repo): Replaced external CAPTCHA services with a custom, lightweight Math-based CAPTCHA for syllabus approvals. User IDs are extracted from server-side cookies to attribute approvals correctly.
- **Syllabus Tracking & Search**: A comprehensive search system and department filter (including Physics) was added. Users now have a dedicated `/profile` page on the side site to track the status (Pending, Approved, Rejected) of syllabi they have reviewed/submitted.
- **Admin Dashboard (Main Site)**: Built — moderators/admins review pending papers, pending PDF syllabi, and pending Vault (Syllabus_Table) items from `src/app/admin/page.tsx`.

## 🐛 Known Bugs / Pending Fixes
- **Site temporarily closed until Dec 5, 2026** — free Appwrite DB reads 92% used (462K/500K, cycle Nov 5–Dec 5); middleware redirects all pages to `/closed`, API returns 503.
- **Dept syllabus PDF "View PDF" buttons broken** — the `syllabus-files` bucket was deleted 2026-11-05; folder-move fix pending.
- **Code still points at deleted buckets** — `src/lib/appwrite.ts` still references `paper-markdown` / `syllabus-files`; the folder-move fix is pending.

## 🚀 Next Steps / Ideas for Improvement
1. **AI Integration**: Enhance the AI Content section to dynamically summarize the parsed Syllabus MDX files.
2. **Credit Economy**: Earning is verify-to-earn (+10 XP for verifying AI content; promotion from verifications), not upload rewards — uploads are team-only. Any economy work should follow the live `docs/ROLES.md` model.
3. **Enhanced Search**: Integrate a full-text search provider (like Algolia or Meilisearch) if the Appwrite database queries become too slow for large volumes of papers.
