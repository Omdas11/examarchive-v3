# ExamArchive v3

A community-driven university question paper and syllabus archive built with **Next.js 15 (App Router)**, **TypeScript**, **TailwindCSS**, and **Appwrite**.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Appwrite Setup](#appwrite-setup)
  - [Database Collections](#database-collections)
  - [Storage Buckets](#storage-buckets)
  - [Authentication](#authentication)
- [Project Structure](#project-structure)
- [Available Scripts](#available-scripts)
- [Pages & Routes](#pages--routes)
- [Role-Based Access](#role-based-access)
- [Syllabus Upload & Moderation](#syllabus-upload--moderation)
- [Admin Dashboard](#admin-dashboard)
- [Browse Page Card Design](#browse-page-card-design)
- [Dark Mode](#dark-mode)
- [Deployment](#deployment)

---

## Prerequisites

| Tool    | Version |
| ------- | ------- |
| Node.js | ≥ 18    |
| npm     | ≥ 9     |

You also need a free [Appwrite](https://appwrite.io) project (cloud or self-hosted) for the database, authentication, and file storage.

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/Omdas11/examarchive-v3.git
cd examarchive-v3

# 2. Install dependencies
npm install

# 3. Create your local environment file
cp .env.example .env.local
# Then open .env.local and fill in your Appwrite credentials (see below)

# 4. Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```env
# Required — Appwrite project URL and project ID (exposed to the browser)
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=<your-project-id>

# Required — Appwrite API key for server-side admin operations (keep secret)
APPWRITE_API_KEY=<your-api-key>

# Storage bucket IDs (defaults shown; change only if you named them differently)
APPWRITE_BUCKET_ID=papers
APPWRITE_AVATARS_BUCKET_ID=avatars
APPWRITE_SYLLABUS_BUCKET_ID=syllabus-files
```

> **Important:** `NEXT_PUBLIC_` variables are exposed to the browser. `APPWRITE_API_KEY` is server-only and must **never** be committed or exposed to clients.

---

## Appwrite Setup

### Database Collections

Create a database named **`examarchive`** and the following collections inside it:

#### `papers`

| Attribute              | Type    | Required | Notes                              |
| ---------------------- | ------- | -------- | ---------------------------------- |
| `title`                | String  | ✓        |                                    |
| `course_code`          | String  | ✓        |                                    |
| `course_name`          | String  | ✓        |                                    |
| `year`                 | Integer | ✓        |                                    |
| `semester`             | String  | ✓        |                                    |
| `exam_type`            | String  | ✓        |                                    |
| `department`           | String  | ✓        |                                    |
| `file_url`             | String  | ✓        | Public URL of the uploaded PDF     |
| `uploaded_by`          | String  | ✓        | Appwrite User ID                   |
| `uploaded_by_username` | String  |          | Denormalised username for display  |
| `approved`             | Boolean |          | Default: `false`; set to `true` by moderators |
| `stream`               | String  |          |                                    |
| `institution`          | String  |          |                                    |
| `programme`            | String  |          |                                    |
| `marks`                | Integer |          |                                    |
| `duration`             | Integer |          | Minutes                            |
| `view_count`           | Integer |          | Default: `0`                       |
| `download_count`       | Integer |          | Default: `0`                       |

#### `syllabus`

| Attribute              | Type    | Required | Notes                                              |
| ---------------------- | ------- | -------- | -------------------------------------------------- |
| `university`           | String  | ✓        |                                                    |
| `subject`              | String  | ✓        |                                                    |
| `department`           | String  | ✓        |                                                    |
| `semester`             | String  | ✓        |                                                    |
| `programme`            | String  |          |                                                    |
| `year`                 | Integer |          |                                                    |
| `uploader_id`          | String  | ✓        | Appwrite User ID                                   |
| `uploaded_by_username` | String  |          | Denormalised username                              |
| `approval_status`      | String  | ✓        | One of `"pending"`, `"approved"`, `"rejected"`     |
| `file_url`             | String  | ✓        | Public URL of the syllabus PDF                     |

#### `users`

| Attribute           | Type    | Notes                                   |
| ------------------- | ------- | --------------------------------------- |
| `display_name`      | String  | Full name                               |
| `username`          | String  | Unique @handle                          |
| `email`             | String  |                                         |
| `avatar_url`        | String  |                                         |
| `avatar_file_id`    | String  | File ID in the `avatars` bucket         |
| `role`              | String  | `student` / `moderator` / `admin` / `founder` |
| `primary_role`      | String  | Same as `role`                          |
| `secondary_role`    | String  | Optional community role                 |
| `tier`              | String  | `bronze` / `silver` / `gold` / `platinum` / `diamond` |
| `xp`                | Integer | Default: `0`                            |
| `streak_days`       | Integer | Default: `0`                            |
| `last_activity`     | String  | ISO timestamp                           |
| `upload_count`      | Integer | Default: `0`; auto-incremented on paper approval |
| `username_last_changed` | String | ISO timestamp; enforces 7-day cooldown |

#### `activity_logs`

| Attribute        | Type   | Notes                              |
| ---------------- | ------ | ---------------------------------- |
| `action`         | String | `approve` / `reject` / `role_change` / `tier_change` |
| `target_user_id` | String | Nullable                           |
| `target_paper_id`| String | Nullable (also used for syllabus IDs) |
| `admin_id`       | String | Appwrite User ID of the moderator  |
| `admin_email`    | String |                                    |
| `details`        | String | Human-readable description         |

### Storage Buckets

Create three buckets in Appwrite Storage:

| Bucket ID       | Name            | Access  | Purpose                |
| --------------- | --------------- | ------- | ---------------------- |
| `papers`        | Papers          | Public  | Exam paper PDFs        |
| `avatars`       | Avatars         | Public  | User avatar images     |
| `syllabus-files`| Syllabus Files  | Public  | Syllabus PDFs          |

Set each bucket to allow public read access (or configure permissions as needed).

### Authentication

1. In the Appwrite Console go to **Auth → Settings**.
2. Enable **Email/Password** authentication.
3. To promote a user to admin/moderator, update their `role` field in the `users` collection using the Appwrite Console or the `/devtool` page (founder-only).

---

## Project Structure

```
examarchive-v3/
├── .env.example                  # Template for environment variables
├── .eslintrc.json                # ESLint configuration
├── next.config.mjs               # Next.js configuration (50MB body limit)
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── docs/
│   ├── roles.md                  # Role & permission reference
│   ├── badges.md                 # Badge system reference
│   └── XP_ACHIEVEMENTS.md        # XP & achievement system
│
└── src/
    ├── middleware.ts              # Protects /admin, /devtool, /upload routes
    │
    ├── app/                      # Next.js App Router pages
    │   ├── layout.tsx            # Root layout (Navbar + Footer + ToastProvider)
    │   ├── page.tsx              # Home — hero, search, notices
    │   ├── globals.css           # Global styles + CSS custom properties
    │   ├── browse/               # Browse & filter approved papers
    │   ├── paper/[id]/           # Paper detail page
    │   ├── syllabus/             # Approved syllabi (grouped by university)
    │   ├── upload/               # Paper & syllabus upload form
    │   ├── admin/                # Admin dashboard (moderator+)
    │   ├── admin/users/          # Full user management page
    │   ├── profile/              # User profile editor
    │   ├── settings/             # Account settings
    │   ├── devtool/              # Founder-only maintenance tools
    │   └── api/
    │       ├── admin/route.ts    # Paper & syllabus moderation actions
    │       ├── admin/users/      # User role management
    │       ├── upload/route.ts   # Paper metadata save
    │       ├── upload/token/     # JWT for direct browser→Appwrite upload
    │       ├── upload/syllabus/  # Syllabus metadata save
    │       ├── papers/           # List approved papers
    │       ├── profile/          # Update user profile
    │       ├── profile/avatar/   # Upload/delete avatar
    │       ├── devtool/          # Founder maintenance actions
    │       └── health/           # Appwrite connectivity check
    │
    ├── components/
    │   ├── AdminDashboard.tsx    # Tabs: Pending | Syllabus | Users | Activity Log
    │   ├── AdminActions.tsx      # Paper moderation list (approve/reject)
    │   ├── SyllabusModeration.tsx# Syllabus moderation table (approve/reject/preview)
    │   ├── ActivityLog.tsx       # Admin action history
    │   ├── UserManagement.tsx    # User role & tier editor
    │   ├── PaperCard.tsx         # Paper card with vertical left accent bar
    │   ├── SyllabusUploadForm.tsx# Syllabus upload multi-step form
    │   ├── UploadForm.tsx        # Paper upload multi-step form
    │   ├── Navbar.tsx            # Sticky header with mobile drawer
    │   ├── Footer.tsx            # 3-column footer
    │   ├── ProfilePanel.tsx      # User profile display
    │   ├── AvatarRing.tsx        # Avatar with role/streak ring
    │   ├── BadgeDisplay.tsx      # XP/achievement badges
    │   ├── ToastContext.tsx       # Toast notification system
    │   └── Icons.tsx             # SVG icon library
    │
    ├── lib/
    │   ├── appwrite.ts           # Server-side Appwrite client + collection IDs
    │   ├── appwrite-client.ts    # Browser-side Appwrite client (for JWT upload)
    │   ├── auth.ts               # getServerUser() — server-side session check
    │   ├── roles.ts              # Role helpers (isModerator, isAdmin, isFounder)
    │   └── utils.ts              # toRoman() and other shared utilities
    │
    └── types/
        └── index.ts              # TypeScript interfaces (Paper, Syllabus, UserProfile, …)
```

---

## Available Scripts

| Command         | Description                                  |
| --------------- | -------------------------------------------- |
| `npm run dev`   | Start development server on `localhost:3000` |
| `npm run build` | Create optimized production build            |
| `npm run start` | Start production server                      |
| `npm run lint`  | Run ESLint                                   |

---

## Pages & Routes

### Public Pages

| Route         | Description                                       |
| ------------- | ------------------------------------------------- |
| `/`           | Home — hero, search bar, notices                  |
| `/browse`     | Browse & filter approved papers by stream/year    |
| `/paper/[id]` | Paper detail with metadata & PDF viewer           |
| `/syllabus`   | Approved syllabi grouped by University → Programme → Subject → Semester |
| `/about`      | About ExamArchive                                 |
| `/support`    | Help & support                                    |
| `/terms`      | Terms of use                                      |

### Protected Pages (login required)

| Route          | Minimum Role | Description                                         |
| -------------- | ------------ | --------------------------------------------------- |
| `/upload`      | student      | Upload a paper or syllabus                          |
| `/profile`     | student      | Edit display name, username, avatar                 |
| `/settings`    | student      | Account settings                                    |
| `/admin`       | moderator    | Admin dashboard (paper & syllabus moderation)       |
| `/admin/users` | moderator    | Full user management page                           |
| `/devtool`     | founder      | Maintenance tools (reset data, override roles, etc.) |

### API Routes

| Method | Route                     | Auth       | Description                               |
| ------ | ------------------------- | ---------- | ----------------------------------------- |
| GET    | `/api/papers`             | Public     | List approved papers (filterable)         |
| POST   | `/api/upload`             | Required   | Save paper metadata after file upload     |
| GET    | `/api/upload/token`       | Required   | Issue JWT for direct browser→Appwrite upload |
| POST   | `/api/upload/syllabus`    | Required   | Save syllabus metadata after file upload  |
| POST   | `/api/admin`              | Moderator  | Approve / reject papers and syllabi       |
| GET    | `/api/admin/users`        | Admin      | List all users                            |
| PATCH  | `/api/admin/users`        | Admin      | Update a user's role or tier              |
| PATCH  | `/api/profile`            | Required   | Update display name, username, bio        |
| POST   | `/api/profile/avatar`     | Required   | Upload new avatar                         |
| DELETE | `/api/profile/avatar`     | Required   | Remove avatar                             |
| POST   | `/api/devtool`            | Founder    | Maintenance actions                       |
| GET    | `/api/health`             | Public     | Appwrite DB + Storage connectivity check  |

---

## Role-Based Access

The app uses a four-tier role system validated **server-side** on every request:

| Role        | Permissions                                                        |
| ----------- | ------------------------------------------------------------------ |
| `student`   | Browse, view, download papers and syllabi; upload new content      |
| `moderator` | All student permissions + approve/reject papers and syllabi        |
| `admin`     | All moderator permissions + manage user roles and tiers            |
| `founder`   | All admin permissions + access DevTool (reset data, XP override)   |

Roles are stored in the `users` collection and checked server-side via `src/lib/auth.ts` + `src/lib/roles.ts`. The middleware at `src/middleware.ts` enforces access for `/admin`, `/devtool`, `/upload`, and all `/api/admin` and `/api/devtool` routes.

---

## Syllabus Upload & Moderation

### Upload Flow

1. A logged-in user navigates to `/upload?type=syllabus` and fills in the syllabus form (university, subject, department, semester, programme, year) and selects a PDF.
2. The browser fetches a short-lived JWT from `GET /api/upload/token`.
3. The browser uploads the PDF **directly** to the `syllabus-files` Appwrite Storage bucket using the JWT (no server memory used for the file).
4. The browser posts the JSON metadata to `POST /api/upload/syllabus`, which verifies the file exists and creates a document in the `syllabus` collection with `approval_status: "pending"`.

### Admin Moderation

1. Admins and moderators visit `/admin` and click the **Syllabus** tab.
2. The **Syllabus Moderation** table lists all pending uploads with columns: University, Programme, Dept/Stream, Subject, Year, Semester, Uploaded by, Date, and Actions.
3. Clicking **Approve** calls `POST /api/admin` with `{ action: "approve-syllabus", id }`, which sets `approval_status: "approved"` and logs the action.
4. Clicking **Reject** calls `POST /api/admin` with `{ action: "reject-syllabus", id }`, which sets `approval_status: "rejected"` and logs the action.
5. The **PDF** button opens the file in a new tab for preview before deciding.

### Public Syllabus Page

Approved syllabi appear at `/syllabus`, grouped hierarchically:

```
University
└── Programme
    └── Subject
        └── Semester cards (with year, department, Download PDF)
```

### DevTool Cleanup

Founders can navigate to `/devtool` and use **Clear Pending Syllabi** to bulk-delete all documents in the `syllabus` collection that still have `approval_status: "pending"`. Approved syllabi are unaffected.

---

## Admin Dashboard

The admin dashboard at `/admin` has four tabs:

| Tab            | Access      | Description                                         |
| -------------- | ----------- | --------------------------------------------------- |
| Pending        | Moderator + | List of unapproved exam papers with approve/reject  |
| Syllabus       | Moderator + | List of pending syllabus uploads with approve/reject/preview |
| Users          | Moderator + | User table with inline role & tier editor           |
| Activity Log   | Moderator + | Full history of all moderation actions              |

The stats bar at the top shows live counts for **Pending Papers**, **Approved**, **Pending Syllabi**, and **Users**.

---

## Browse Page Card Design

Each paper card on the `/browse` page uses a **vertical left accent bar** whose colour is mapped to the paper's subject/department:

| Department keyword  | Colour           |
| ------------------- | ---------------- |
| physics             | Blue `#2563eb`   |
| math / maths        | Purple `#7c3aed` |
| chemistry           | Teal `#059669`   |
| biology             | Green `#16a34a`  |
| comp / cs / it      | Cyan `#0891b2`   |
| history / arts      | Amber `#b45309`  |
| english / lit       | Pink `#db2777`   |
| economics / commerce| Orange `#d97706` |
| geography           | Emerald `#0d9488`|
| electrical / elec   | Yellow `#f59e0b` |
| mechanical          | Indigo `#6366f1` |
| civil               | Slate `#64748b`  |
| (other)             | CSS muted text   |

The card layout is a horizontal flex container: a `w-1` coloured bar on the left, followed by the main content area (`p-4`) with title, course code, badges, meta line, and footer row. This replaces the previous thin horizontal bar at the top of the card.

---

## Dark Mode

The app supports light and dark themes via a `data-theme` attribute on the `<html>` element. The preference is:

1. Loaded from `localStorage` before first paint (no flash of wrong theme).
2. Falls back to the system preference (`prefers-color-scheme: dark`).
3. Toggled via the sun/moon icon in the navbar.

CSS custom properties in `src/app/globals.css` switch automatically based on `[data-theme="dark"]`.

---

## Deployment

### Vercel (Recommended)

1. Push your repository to GitHub.
2. Go to [vercel.com](https://vercel.com) and import the project.
3. Add the environment variables in Vercel's dashboard (Settings → Environment Variables):
   - `NEXT_PUBLIC_APPWRITE_ENDPOINT`
   - `NEXT_PUBLIC_APPWRITE_PROJECT_ID`
   - `APPWRITE_API_KEY`
   - `APPWRITE_BUCKET_ID` (optional, default `papers`)
   - `APPWRITE_AVATARS_BUCKET_ID` (optional, default `avatars`)
   - `APPWRITE_SYLLABUS_BUCKET_ID` (optional, default `syllabus-files`)
4. Deploy. Vercel will automatically detect Next.js and build the project.

### Self-Hosted

```bash
# Build the production bundle
npm run build

# Start the production server (default port 3000)
npm run start
```

Set environment variables via `.env.local` or your hosting provider's dashboard.

### Docker

```dockerfile
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

> **Note:** For the Docker standalone build, add `output: "standalone"` to `next.config.mjs`.

---

## License

This project is for educational purposes. See [Terms of Use](/terms) for details.
