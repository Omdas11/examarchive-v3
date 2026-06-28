# ExamArchive Ecosystem - Master Status

*Project started on: March 1, 2026 (Approx. 4 months old)*

This document tracks the high-level progress, completed features, known bugs, and next steps for the `examarchive-v3` and `examarchive-syllabus` repositories.

## 🏗️ Architecture
- **Main Site (`examarchive-v3`)**: Built on Next.js 15, acts as the primary hub for PYQs (Previous Year Question Papers) and the central authentication authority. Hosted at `examarchive.dev`.
- **Side Site (`examarchive-syllabus`)**: Secondary Next.js app to host and review Markdown-based syllabus documents. Hosted at `syllabus.examarchive.dev`.
- **Backend**: Appwrite (Database, Storage, Auth) with cross-subdomain `httpOnly` session cookies (`ea_session`).

## ✅ Completed Features
- **Cross-Domain Authentication**: The `ea_session` cookie is successfully shared across `.examarchive.dev` domains. The Side site correctly redirects unauthenticated users to the Main site's login page with a `?redirect=` parameter and seamlessly returns them back after login.
- **Syllabus Vault UI**: A dedicated interface for reviewing, parsing, and reading Syllabus MDX files with full GFM (GitHub Flavored Markdown) support and dynamic nested tables.
- **Dark Mode Synchronization**: Fixed `next-themes` and CSS selector mismatches in the side-site to ensure Dark Mode accurately shifts color variables.
- **Syllabus Approvals**: Replaced external CAPTCHA services with a custom, lightweight Math-based CAPTCHA for syllabus approvals. User IDs are extracted from server-side cookies to attribute approvals correctly.
- **Report System**: Users can now report errors on specific syllabus pages, which are logged directly to the Appwrite `Reports_Table`.
- **Syllabus Tracking & Search**: A comprehensive search system and department filter (including Physics) was added. Users now have a dedicated `/profile` page on the side site to track the status (Pending, Approved, Rejected) of syllabi they have reviewed/submitted.

## 🐛 Known Bugs / Pending Fixes
- None currently active! Vercel build pipelines are green and environment variables have been synchronized.

## 🚀 Next Steps / Ideas for Improvement
1. **Admin Dashboard (Main Site)**: Build an interface for moderators/admins to review the "pending" items in the `Syllabus_Table` and `Reports_Table`, allowing them to approve/reject submissions directly from the UI instead of the Appwrite Console.
2. **AI Integration**: Enhance the AI Content section to dynamically summarize the parsed Syllabus MDX files.
3. **Credit Economy**: Integrate the submission of syllabi into the existing user economy system, rewarding users with XP or Credits upon admin approval.
4. **Enhanced Search**: Integrate a full-text search provider (like Algolia or Meilisearch) if the Appwrite database queries become too slow for large volumes of papers.
