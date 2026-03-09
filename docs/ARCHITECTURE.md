# System Architecture — ExamArchive v3

## Overview

ExamArchive v3 is a Next.js 15 application deployed on Vercel, using Appwrite Cloud as the sole backend service (auth, database, and storage).

```
┌─────────────────────────────────────────────────────┐
│                  Browser / PWA                       │
│                                                      │
│  Next.js 15 App Router (React Server + Client)       │
│  ┌────────────┐  ┌──────────────────────────────┐    │
│  │ Server RSC │  │ Client Components             │    │
│  │ (page.tsx) │  │ (UploadForm, BrowseClient...) │    │
│  └────────────┘  └──────────────────────────────┘    │
└───────────────────────┬─────────────────────────────┘
                        │ HTTPS
            ┌───────────┴────────────┐
            │   Vercel Edge Network  │
            └───────────┬────────────┘
                        │
        ┌───────────────┼──────────────────┐
        │               │                  │
   ┌────┴─────┐  ┌──────┴──────┐  ┌───────┴────────┐
   │ Next.js  │  │  Appwrite   │  │  Appwrite      │
   │ API      │  │  Auth       │  │  Storage       │
   │ Routes   │  │  (sessions) │  │  (3 buckets)   │
   └────┬─────┘  └─────────────┘  └───────┬────────┘
        │                                  │
        └──────────────────────────────────┘
                        │
               ┌────────┴─────────┐
               │  Appwrite        │
               │  Database        │
               │  (6 collections) │
               └──────────────────┘
```

---

## Application Layers

### 1. Frontend (Next.js 15, App Router)

- **Server Components** (`page.tsx` files) — fetch data server-side using the admin Appwrite client, pass to client components as props.
- **Client Components** — handle interactive state: upload forms, filters, admin actions.
- **API Routes** (`src/app/api/`) — server-side handlers for mutations (uploads, profile updates, admin actions).

### 2. Authentication (Appwrite Auth)

- Email/password and Google OAuth via Appwrite's built-in auth.
- Sessions stored as secure cookies (HTTP-only, via Appwrite's session cookie).
- Server-side auth helpers in `src/lib/auth.ts`:
  - `getServerUser()` — returns the authenticated user profile or `null`.
  - `getSessionSecret()` — retrieves the raw session cookie for session-scoped operations.

### 3. Database (Appwrite Database: `examarchive`)

Six active collections:

| Collection       | Purpose                              |
|------------------|--------------------------------------|
| `users`          | User profiles and role/XP data       |
| `papers`         | Exam question paper metadata         |
| `syllabus`       | Syllabus document metadata           |
| `uploads`        | Raw upload audit trail               |
| `activity_logs`  | Admin moderation action log          |
| `achievements`   | Per-user earned badges               |

See [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) for full field-level documentation.

### 4. Storage (Appwrite Storage)

| Bucket ID        | Contents                | Access           |
|------------------|-------------------------|------------------|
| `papers`         | Exam paper PDFs         | JWT (per upload) |
| `syllabus-files` | Syllabus PDFs           | JWT (per upload) |
| `avatars`        | User avatar images      | Public read      |

File uploads go **directly from the browser to Appwrite Storage** using a short-lived JWT. The Next.js server only stores JSON metadata. See [UPLOAD_FLOW.md](UPLOAD_FLOW.md).

### 5. Syllabus Registry (`src/data/syllabus-registry.ts`)

A static, in-process registry of known university course papers. Used to auto-resolve paper metadata (name, semester, department, programme, category) from a paper code, eliminating manual data entry errors.

- Helpers: `findByPaperCode(code, university?)`, `getAllUniversities()`, `getByUniversity()`, `groupBySemester()`
- Currently contains: Assam University Physics — FYUGP (41 papers) and CBCS (26 papers)

### 6. Role & Permission System

Role hierarchy (least → most privileged):
```
visitor → explorer → contributor → verified_contributor
       → moderator → maintainer → admin → founder
```

- Role stored in `users.role` (the single source of truth).
- `users.primary_role` is a deprecated legacy alias that should be removed.
- Helper functions in `src/lib/roles.ts`: `isAdmin()`, `isModerator()`, `isFounder()`, etc.
- Route protection enforced by `src/middleware.ts`.

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Direct browser-to-Appwrite uploads | Bypasses Vercel's 4.5 MB body limit; SDK handles chunking and progress |
| Metadata auto-resolution via registry | Prevents data entry errors; ensures DB fields always match schema |
| Paper code suffix (T/P) determines exam type | Consistent, code-based derivation; no manual dropdown needed |
| Admin approval before publish | Quality control; prevents spam/irrelevant content |
| Single `role` field for access control | Avoids split-brain between `role` and `primary_role`; clear hierarchy |
