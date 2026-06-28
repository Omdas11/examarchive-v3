# ExamArchive AI Context (AGENTS.md)

This file provides critical context, architecture, and recent updates for the ExamArchive project so that any AI agent can efficiently resume work.

## Repository Architecture
- **examarchive-v3**: The main repository (Next.js 15, Appwrite backend). Handles core features, user accounts, and authentication. Hosted at `examarchive.dev`.
- **examarchive-syllabus**: A secondary repository (Next.js) for hosting Syllabus MDX files. Hosted at `syllabus.examarchive.dev`.

## What This Website Serves
ExamArchive is a collaborative, open-source educational platform primarily targeted at university students (e.g. Assam University). Its core purpose is to digitize, archive, and provide easy access to academic resources.

**Core Features & Domain Knowledge:**
- **Previous Year Question Papers (PYQs)**: Students can browse, upload, and download past examination papers. The platform uses an economy system (credits) to incentivize uploads.
- **Syllabus Vault**: A dedicated repository for university course syllabi. Syllabi are typically stored as structured markdown/MDX files for easy reading, parsing, and eventual AI processing.
- **AI Content**: Features geared toward generating study materials, summarizing syllabi, or assisting students using AI.
- **Economy System**: Users have roles (student, moderator, admin, founder), earn XP/credits for contributions, and have tiers (e.g., bronze).

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
- `examarchive-v3`: Requires standard Appwrite variables + Cloudflare Turnstile variables.
- `examarchive-syllabus`: Also heavily relies on `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` for the Approve button. If the button crashes with a `TurnstileError`, check Vercel environment variables.

## Styling
- We use Tailwind CSS.
- For dark mode to work seamlessly with `next-themes`, we must have `darkMode: "class"` in `tailwind.config.ts`.

## Agent Instructions
- **Do not** attempt to fix auth by changing the Appwrite Web SDK in client components. The current flow relies on the Next.js `ea_session` cookie.
- Before modifying authentication actions, verify both `signInWithPassword`, `signInWithOtp`, and `signInWithGoogle` to ensure redirect parameter handling is maintained.
