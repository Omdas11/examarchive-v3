# ExamArchive AI Context (AGENTS.md)

This file provides critical context, architecture, and recent updates for the ExamArchive project so that any AI agent can efficiently resume work.

## Current state (2026-11-12) — read this first

- **Site temporarily closed until Dec 5, 2026** — free Appwrite DB reads 92% used (462K/500K, cycle Nov 5–Dec 5). Middleware redirects all pages to `/closed`; API calls return 503. Do not treat setup/verify docs as currently runnable.
- **Only the `papers` bucket survives** (667 files). The `paper-markdown` and `syllabus-files` buckets were deleted 2026-11-05. Code in `src/lib/appwrite.ts` still points at the deleted buckets — the folder-move fix is pending. Dept syllabus PDF "View PDF" buttons are broken until then.
- **Store is Coming Soon** (`STORE_COMING_SOON = true`); credit balances hidden. Token economy keeps running (verify-to-earn XP).
- **Uploads are team-only** (moderator+); regular users see a team-handled notice.
- **Avatar uploads removed** — Google sign-ins use the Google profile photo, initials otherwise.
- **Notes section live** — `/notes`, 20 PDFs, 534 pages, served statically (no Appwrite reads).
- **Gamification is one XP ladder only** — Bronze 0 / Silver 100 / Gold 300 / Platinum 800 / Diamond 1500+. The old rank system is deleted; earning is verify-to-earn.
- **Appwrite is on the Free plan** (downgraded by the user 2026-11-05). 615 papers, 29 users, storage 1.11/2 GB.

## Repository Architecture
- **examarchive-v3**: The main repository (Next.js 15, Appwrite backend). Handles core features, user accounts, and authentication. Hosted at `examarchive.dev`.
- **examarchive-syllabus**: A secondary repository (Next.js) for hosting Syllabus MDX files. Hosted at `syllabus.examarchive.dev`.

## What This Website Serves
ExamArchive is a collaborative, open-source educational platform primarily targeted at university students (e.g. Assam University). Its core purpose is to digitize, archive, and provide easy access to academic resources.

**Core Features & Domain Knowledge:**
- **Previous Year Question Papers (PYQs)**: Students can browse and download past examination papers. Uploads are team-handled (moderator+ only); the token economy rewards verifying AI content, not uploads.
- **Syllabus Vault**: A dedicated repository for university course syllabi. The live syllabus surface is 13 department PDFs + `Syllabus_Table` rows (2,789) under `/syllabus`; structured markdown/MDX survives only as the admin review format.
- **AI Content**: Features geared toward generating study materials, summarizing syllabi, or assisting students using AI.
- **Economy System**: Users have roles (student, contributor, specialist, subject_admin, moderator, founder), earn XP/tokens for verifying AI content, and progress on one XP ladder (Bronze 0 / Silver 100 / Gold 300 / Platinum 800 / Diamond 1500+).

## Authentication Flow (Cross-Subdomain)
We have a complex authentication architecture to allow seamless cross-subdomain logins without using the native Appwrite browser SDK cookies:

1. **The Session Cookie (`ea_session`)**: 
   - When a user logs in via `examarchive-v3` (using password, magic link, or Google OAuth), the server creates a server-side Appwrite session.
   - The Next.js server then issues an `httpOnly` custom cookie named `ea_session`.
   - **CRITICAL:** This cookie is set with `domain: ".examarchive.dev"` in production so that it is automatically shared with all subdomains (like `syllabus.examarchive.dev`).

2. **Redirecting Back from Subdomains**:
   - If a user clicks an action on a subdomain (e.g., "Approve & Send to Admin" on `syllabus.examarchive.dev`) but isn't logged in, they are redirected to `examarchive.dev/login?redirect=...`.
   - All forms in `examarchive-v3/src/app/login/LoginForm.tsx` have a hidden `<input name="redirectUrl" />`.
   - Google OAuth and Magic Links pass this redirect URL into their Appwrite flows and append it as `?next=` to the `auth/callback` route.
   - The `auth/callback` route in `examarchive-v3` allows safe client-side redirects back to `*.examarchive.dev` domains.

3. **Verifying Auth on Subdomains**:
   - Because `ea_session` is `httpOnly`, client-side components on subdomains (like `ApproveButton.tsx` in `examarchive-syllabus`) **CANNOT** use `account.get()` from the Appwrite Client SDK. (Appwrite SDK expects `a_session_...` which isn't present).
   - Instead, authentication must be checked **Server-Side** (e.g., in `page.tsx` using `cookies().has('ea_session')`), and the boolean result is passed as a prop down to client components.

## Required Environment Variables
- `examarchive-v3`: Requires standard Appwrite variables.
- `examarchive-syllabus`: The Approve button uses a custom math CAPTCHA (see `src/app/actions.ts` in that repo). Note: `@marsidev/react-turnstile` is listed in its `package.json` but is never imported anywhere in `src/` — do not debug Turnstile env vars for the Approve button.

## Styling
- We use Tailwind CSS.
- Dark mode is driven by `next-themes`; note `tailwind.config.ts` contains no `darkMode` key — verify against the actual theme setup before assuming class-based dark mode config.

## Agent Instructions
- **Do not** attempt to fix auth by changing the Appwrite Web SDK in client components. The current flow relies on the Next.js `ea_session` cookie.
- Before modifying authentication actions, verify both `signInWithPassword`, `signInWithOtp`, and `signInWithGoogle` to ensure redirect parameter handling is maintained.

## Appwrite & DNS Troubleshooting
- **Regional Endpoints**: Appwrite Cloud enforces regional routing. If the Vercel `APPWRITE_ENDPOINT` points to `cloud.appwrite.io/v1` but the project is in Singapore, it will throw `Project is not accessible in this region. Please make sure you are using the correct endpoint`. In this case, ensure Vercel uses `sgp.cloud.appwrite.io/v1` or the correctly mapped custom domain.
- **Custom Domain Mismatches**: If you attempt to use a custom domain (e.g. `auth.examarchive.dev`) that is attached to an *older* Appwrite project while passing the *new* project ID, Appwrite will throw `Invalid redirect` on OAuth and magic links, or return region errors. Always ensure the custom domain is registered directly on the active Appwrite Project under Settings > Custom Domains.
- **Cloudflare Proxying**: When registering a custom domain in Appwrite, the Cloudflare DNS record **must** be set to "DNS only" (Grey Cloud) temporarily (or permanently for Appwrite API domains). If it is "Proxied" (Orange Cloud), Cloudflare injects its own CAA records and SSL certificates, causing Appwrite's SSL generation and CAA DNS verification to fail.
