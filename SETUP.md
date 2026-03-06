# ExamArchive v3 – Setup Guide

ExamArchive v3 is built on **[Appwrite](https://appwrite.io)** for authentication, database, and file storage, with **Next.js 15 (App Router)** on the frontend.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Appwrite Project Setup](#appwrite-project-setup)
  - [1. Create the Project](#1-create-the-project)
  - [2. Enable Authentication](#2-enable-authentication)
  - [3. Create the Database and Collections](#3-create-the-database-and-collections)
  - [4. Create the Storage Bucket](#4-create-the-storage-bucket)
  - [5. Create an API Key](#5-create-an-api-key)
- [Local Development](#local-development)
- [Vercel Deployment](#vercel-deployment)
- [Custom Domain – examarchive.dev](#custom-domain--examarchivedev)
- [Dev Debug Panel](#dev-debug-panel)
- [Production Build Check](#production-build-check)

---

## Prerequisites

| Tool    | Version |
|---------|---------|
| Node.js | ≥ 18    |
| npm     | ≥ 9     |

You also need a free [Appwrite Cloud](https://cloud.appwrite.io) account (or a self-hosted Appwrite instance ≥ 1.5).

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in every value before running the app.

```bash
cp .env.example .env.local
```

| Variable | Scope | Description |
|---|---|---|
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | Public (browser + server) | Appwrite API URL, e.g. `https://cloud.appwrite.io/v1` |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | Public (browser + server) | Your Appwrite project ID (found in **Settings → Overview**) |
| `APPWRITE_API_KEY` | **Server only** | Appwrite server-side API key. **Never use a `NEXT_PUBLIC_` prefix here.** |
| `APPWRITE_BUCKET_ID` | **Server only** | ID of the Appwrite storage bucket for exam PDFs (default: `papers`) |
| `APPWRITE_AVATARS_BUCKET_ID` | **Server only** | ID of the Appwrite storage bucket for user avatars (default: `avatars`) |
| `NEXT_PUBLIC_SITE_URL` | Public | Your deployed site origin, e.g. `https://examarchive.dev`. Used for magic-link email redirects. In production Vercel sets `VERCEL_PROJECT_PRODUCTION_URL` automatically – you can also pin it here. |
| `NEXT_PUBLIC_ENABLE_DEBUG_PANEL` | Public (dev only) | Set to `"true"` to show the floating debug panel in development. Never set this in production. |

> **Security note:** Variables without the `NEXT_PUBLIC_` prefix are **never** inlined into the client bundle by Next.js. `APPWRITE_API_KEY` is used only in Server Actions and Route Handlers.

---

## Appwrite Project Setup

### 1. Create the Project

1. Log in to [cloud.appwrite.io](https://cloud.appwrite.io) (or your self-hosted instance).
2. Click **Create Project**, choose a name (e.g. `ExamArchive`), and select your preferred region.
3. Copy the **Project ID** from **Settings → Overview** into `NEXT_PUBLIC_APPWRITE_PROJECT_ID`.
4. The API endpoint defaults to `https://cloud.appwrite.io/v1` – copy it into `NEXT_PUBLIC_APPWRITE_ENDPOINT`.

### 2. Enable Authentication

1. In the Appwrite Console go to **Auth → Settings**.
2. Under **Auth Methods**, enable **Email/Password**.
3. Also enable **Magic URL** (used for passwordless sign-in via email link).
4. Under **Security → Allowed Origins**, add your development origin (`http://localhost:3000`) and your production domain (`https://examarchive.dev`).

> **Magic-link redirect URL:** The app sends `NEXT_PUBLIC_SITE_URL/auth/callback` as the redirect URL. Make sure this matches a URL in Appwrite's allowed origins.

#### Promoting a user to admin

After a user first logs in, update their role document in the `users` collection via the Appwrite Console (or API):

```
Database: examarchive
Collection: users
Document: <user document ID>
Field "role": "admin"
```

### 3. Create the Database and Collections

In **Databases**, create a new database with the ID **`examarchive`**.

> The database ID must be exactly `examarchive` – it is hard-coded in `src/lib/appwrite.ts`.

Then create the following **collections** inside that database. Enable **Document Security** on every collection so that the API key can bypass it server-side.

---

#### Collection: `users`

Stores user profile data alongside Appwrite Auth accounts.

| Attribute | Type | Required | Default | Notes |
|-----------|------|----------|---------|-------|
| `email` | String (255) | yes | – | User's email address |
| `role` | String (50) | yes | `student` | Primary role: `student` \| `moderator` \| `admin` |
| `primary_role` | String (50) | no | `student` | Explicit primary role column |
| `secondary_role` | String (50) | no | – | Custom community role: `contributor` \| `reviewer` \| `curator` \| `mentor` |
| `tertiary_role` | String (50) | no | – | Additional optional designation (same values as secondary_role) |
| `tier` | String (50) | no | `bronze` | Activity tier: `bronze` \| `silver` \| `gold` \| `platinum` \| `diamond` |

**Permissions:**
- Role `any` → **Read** (so profiles can be looked up)
- Role `users` → **Create**, **Update**
- API Key (server) → **Create**, **Read**, **Update**, **Delete**

---

#### Collection: `papers`

Stores metadata for each uploaded exam paper.

| Attribute | Type | Required | Default | Notes |
|-----------|------|----------|---------|-------|
| `title` | String (255) | yes | – | Descriptive paper title |
| `course_code` | String (50) | yes | – | e.g. `CS101` |
| `course_name` | String (255) | yes | – | e.g. `Introduction to Computing` |
| `year` | Integer | yes | – | Exam year |
| `semester` | String (50) | yes | – | e.g. `Spring`, `Fall` |
| `exam_type` | String (50) | yes | – | e.g. `Midterm`, `Final` |
| `department` | String (100) | yes | – | e.g. `Computer Science` |
| `file_url` | String (512) | yes | – | Appwrite file view URL |
| `uploaded_by` | String (36) | no | – | Appwrite user `$id` |
| `approved` | Boolean | yes | `false` | Whether the paper is visible to students |

**Permissions:**
- Role `any` → **Read** (papers are publicly readable; filter by `approved = true` in queries)
- Role `users` → **Create**
- API Key (server) → **Create**, **Read**, **Update**, **Delete**

---

#### Collection: `syllabus`

Stores syllabus PDFs linked to courses.

| Attribute | Type | Required | Default |
|-----------|------|----------|---------|
| `course_code` | String (50) | yes | – |
| `course_name` | String (255) | yes | – |
| `department` | String (100) | yes | – |
| `file_url` | String (512) | yes | – |

**Permissions:**
- Role `any` → **Read**
- API Key (server) → **Create**, **Read**, **Update**, **Delete**

---

#### Collection: `uploads`

Tracks raw file-upload events (optional – used for audit/activity tracking).

| Attribute | Type | Required |
|-----------|------|----------|
| `user_id` | String (36) | yes |
| `file_id` | String (36) | yes |
| `file_name` | String (255) | yes |
| `status` | String (50) | yes |

**Permissions:**
- Role `users` → **Create**, **Read**
- API Key (server) → **Create**, **Read**, **Update**, **Delete**

---

#### Collection: `activity_logs`

Append-only log of user actions.

| Attribute | Type | Required |
|-----------|------|----------|
| `user_id` | String (36) | yes |
| `action` | String (100) | yes |
| `target_id` | String (36) | no |
| `meta` | String (1024) | no |

**Permissions:**
- API Key (server) → **Create**, **Read**

---

#### Collection: `achievements`

Tracks badges/achievements earned by users.

| Attribute | Type | Required | Default |
|-----------|------|----------|---------|
| `user_id` | String (36) | yes | – |
| `slug` | String (100) | yes | – |
| `label` | String (255) | yes | – |
| `description` | String (512) | no | `""` |
| `earned_at` | DateTime | yes | (now) |

**Permissions:**
- Role `users` → **Read** (own documents via Document Security)
- API Key (server) → **Create**, **Read**, **Update**, **Delete**

---

### 4. Create the Storage Buckets

#### Bucket: `papers` (exam PDFs)

1. Go to **Storage → Buckets** and click **Create Bucket**.
2. Set the **Bucket ID** to `papers` (or any ID – copy it into `APPWRITE_BUCKET_ID`).
3. Set **Maximum File Size** to at least `10 MB`.
4. Set **Allowed File Extensions** to `pdf`.
5. **Permissions:**
   - Role `any` → **Read** (so students can view/download PDFs by URL)
   - Role `users` → **Create**
   - API Key (server) → **Create**, **Read**, **Update**, **Delete**

#### Bucket: `avatars` (user profile images)

1. Create another bucket with **Bucket ID** `avatars` (copy it into `APPWRITE_AVATARS_BUCKET_ID`).
2. Set **Maximum File Size** to `2 MB`.
3. Set **Allowed File Extensions** to `jpg,jpeg,png,webp,gif`.
4. **Permissions:**
   - Role `any` → **Read** (avatar previews are public)
   - API Key (server) → **Create**, **Read**, **Update**, **Delete**

### 5. Create an API Key

1. Go to **Overview → API Keys** and click **Create API Key**.
2. Give it a name (e.g. `ExamArchive Server Key`).
3. Grant the following scopes:
   - `databases.read`, `databases.write`
   - `documents.read`, `documents.write`
   - `files.read`, `files.write`
   - `users.read`, `users.write`
   - `sessions.write` *(needed for magic-link callback)*
4. Copy the key into `APPWRITE_API_KEY` in your `.env.local`.

---

## Local Development

```bash
# 1. Clone and install
git clone https://github.com/Omdas11/examarchive-v3.git
cd examarchive-v3
npm install

# 2. Copy and fill environment variables
cp .env.example .env.local
# Edit .env.local with your Appwrite credentials

# 3. (Optional) Enable the debug panel
# In .env.local uncomment: NEXT_PUBLIC_ENABLE_DEBUG_PANEL=true

# 4. Start the dev server
npm run dev
# → http://localhost:3000
```

---

## Vercel Deployment

1. Push the repository to GitHub (already done).
2. Import the repo in the [Vercel Dashboard](https://vercel.com/new).
3. In **Project Settings → Environment Variables**, add **all** of the following for the **Production** environment:

   | Variable | Where to find it |
   |---|---|
   | `NEXT_PUBLIC_APPWRITE_ENDPOINT` | `https://cloud.appwrite.io/v1` (or your self-hosted URL) |
   | `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | Appwrite Console → Settings → Overview → Project ID |
   | `APPWRITE_API_KEY` | Appwrite Console → Overview → API Keys |
   | `APPWRITE_BUCKET_ID` | Appwrite Console → Storage → your bucket → Bucket ID |
   | `APPWRITE_AVATARS_BUCKET_ID` | Appwrite Console → Storage → avatars bucket → Bucket ID |
   | `NEXT_PUBLIC_SITE_URL` | Your production domain, e.g. `https://examarchive.dev` |

   > **Do not** add `NEXT_PUBLIC_ENABLE_DEBUG_PANEL` in Production.

4. Deploy. Vercel will automatically run `next build`.
5. After the first deploy, verify that the **magic-link redirect URL** (`https://examarchive.dev/auth/callback`) is listed in Appwrite's **Auth → Settings → Allowed Origins** (or **Platforms**).

---

## Custom Domain – examarchive.dev

### In Vercel

1. Go to **Project Settings → Domains**.
2. Add `examarchive.dev` and `www.examarchive.dev`.
3. Vercel will provide DNS records (CNAME or A records).

### In your DNS provider

| Type | Name | Value |
|---|---|---|
| `A` | `@` | `76.76.21.21` (Vercel's anycast IP) |
| `CNAME` | `www` | `cname.vercel-dns.com` |

> DNS propagation can take up to 48 hours. Vercel provisions an SSL certificate automatically via Let's Encrypt once the domain resolves.

---

## Dev Debug Panel

The app ships with a floating **Debug Panel** for local development and staging. It shows:

- **Session state** – whether an `ea_session` cookie is present
- **Environment variables** – current `NEXT_PUBLIC_*` values
- **Cookies** – non-httpOnly cookies (inspect and clear them)
- **Network** – online/offline status and connection type
- **Viewport** – current browser window dimensions
- **Logs** – auth events and callback params logged in real-time

### Enabling the panel

Set `NEXT_PUBLIC_ENABLE_DEBUG_PANEL=true` in your `.env.local`. The panel is hidden whenever:

- `NODE_ENV === "production"`, **or**
- `NEXT_PUBLIC_ENABLE_DEBUG_PANEL` is not set to `"true"`

> **Never enable the debug panel in production or any publicly accessible environment.** It exposes environment variable names and session cookie state.

### Usage

1. A small **🛠 Debug** button appears in the bottom-right corner of the page.
2. Tap/click it to open the bottom-sheet panel.
3. Use the action buttons to:
   - **Refresh session** – re-checks the `ea_session` cookie
   - **Show cookies** – lists all non-httpOnly cookies
   - **Clear cookies** – removes all non-httpOnly cookies (useful for sign-out debugging)
   - **Copy logs** – copies the full log to your clipboard (handy on mobile)
   - **Clear logs** – clears the in-memory log

---

## Production Build Check

```bash
npm run build   # must exit 0 with no TypeScript or lint errors
npm run lint    # must exit 0
```

Confirm that `APPWRITE_API_KEY` and other server-only secrets do **not** appear in the client bundle:

```bash
grep -r "APPWRITE_API_KEY" .next/static/ 2>/dev/null && echo "LEAK DETECTED" || echo "No secrets leaked"
```
