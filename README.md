# ExamArchive v3

A community-driven university question paper archive built with **Next.js 14 (App Router)**, **TypeScript**, **TailwindCSS**, and **Supabase**.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Supabase Setup](#supabase-setup)
  - [Database Tables](#database-tables)
  - [Storage Bucket](#storage-bucket)
  - [Row Level Security (RLS)](#row-level-security-rls)
  - [Authentication](#authentication)
- [Project Structure](#project-structure)
- [Available Scripts](#available-scripts)
- [Pages & Routes](#pages--routes)
- [Role-Based Access](#role-based-access)
- [Dark Mode](#dark-mode)
- [Deployment](#deployment)

---

## Prerequisites

| Tool    | Version |
| ------- | ------- |
| Node.js | ≥ 18    |
| npm     | ≥ 9     |

You also need a free [Supabase](https://supabase.com) project for the database, authentication, and file storage.

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
# Then open .env.local and fill in your Supabase credentials (see below)

# 4. Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```env
# Required — Supabase project URL and anonymous (public) key
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>

# Optional — only needed for server-side admin operations
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

**Where to find these values:**

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and select your project.
2. Navigate to **Settings → API**.
3. Copy the **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`.
4. Copy **anon (public)** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Copy **service_role (secret)** key → `SUPABASE_SERVICE_ROLE_KEY`.

> **Important:** `NEXT_PUBLIC_` variables are exposed to the browser. The `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be exposed to clients.

---

## Supabase Setup

### Database Tables

Run the following SQL in your Supabase **SQL Editor** (Dashboard → SQL Editor → New Query) to create the required tables:

```sql
-- ============================================
-- 1. Papers table
-- ============================================
create table if not exists public.papers (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  course_code text not null,
  course_name text not null,
  year        integer not null,
  semester    text not null,
  exam_type   text not null,
  department  text not null,
  file_url    text not null,
  uploaded_by uuid references auth.users(id),
  approved    boolean default false,
  created_at  timestamptz default now()
);

-- ============================================
-- 2. Syllabi table
-- ============================================
create table if not exists public.syllabi (
  id          uuid primary key default gen_random_uuid(),
  course_code text not null,
  course_name text not null,
  department  text not null,
  file_url    text not null,
  created_at  timestamptz default now()
);

-- ============================================
-- 3. Profiles table (extends Supabase Auth)
-- ============================================
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  role       text default 'student' check (role in ('student', 'moderator', 'admin')),
  created_at timestamptz default now()
);

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'student');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### Storage Bucket

1. In the Supabase Dashboard go to **Storage**.
2. Click **New Bucket** and create a bucket named **`uploads`**.
3. Set the bucket to **Public** so paper PDFs can be accessed by URL.
4. Optionally restrict allowed MIME types to `application/pdf, image/png, image/jpeg`.

### Row Level Security (RLS)

Enable RLS on all tables and add policies. Run this in the SQL Editor:

```sql
-- Enable RLS
alter table public.papers  enable row level security;
alter table public.syllabi  enable row level security;
alter table public.profiles enable row level security;

-- Papers: anyone can read approved papers
create policy "Public can read approved papers"
  on public.papers for select
  using (approved = true);

-- Papers: authenticated users can insert (upload)
create policy "Authenticated users can upload papers"
  on public.papers for insert
  to authenticated
  with check (auth.uid() = uploaded_by);

-- Papers: admins can update (approve) and delete
create policy "Admins can update papers"
  on public.papers for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can delete papers"
  on public.papers for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Syllabi: anyone can read
create policy "Public can read syllabi"
  on public.syllabi for select
  using (true);

-- Profiles: users can read their own profile
create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

-- Profiles: admins can read all profiles
create policy "Admins can read all profiles"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
```

For the **Storage bucket policies**, go to **Storage → uploads → Policies** and add:

| Operation      | Policy                                              |
| -------------- | --------------------------------------------------- |
| SELECT (read)  | Allow public access (`true`)                        |
| INSERT (upload)| Allow authenticated users (`auth.role() = 'authenticated'`) |

### Authentication

1. In the Supabase Dashboard go to **Authentication → Providers**.
2. Enable **Email** sign-up (enabled by default).
3. Optionally enable **Google**, **GitHub**, or other OAuth providers.
4. To promote a user to admin, run in the SQL Editor:

```sql
update public.profiles
set role = 'admin'
where email = 'your-email@example.com';
```

---

## Project Structure

```
examarchive-v3/
├── .env.example              # Template for environment variables
├── .eslintrc.json            # ESLint configuration
├── next.config.mjs           # Next.js configuration
├── package.json              # Dependencies and scripts
├── postcss.config.mjs        # PostCSS (TailwindCSS)
├── tailwind.config.ts        # TailwindCSS configuration
├── tsconfig.json             # TypeScript configuration
│
└── src/
    ├── middleware.ts          # Auth middleware for protected routes
    │
    ├── app/                  # Next.js App Router pages
    │   ├── layout.tsx        # Root layout (Navbar + Footer + dark mode)
    │   ├── page.tsx          # Home — hero, search, notices, calendar
    │   ├── globals.css       # Global styles + CSS custom properties
    │   ├── browse/page.tsx   # Browse papers with filters & search
    │   ├── paper/[id]/page.tsx  # Paper detail (dynamic metadata)
    │   ├── syllabus/page.tsx # Syllabus listing
    │   ├── upload/page.tsx   # Upload form
    │   ├── admin/page.tsx    # Admin dashboard (admin-only)
    │   ├── about/page.tsx    # About page
    │   ├── support/page.tsx  # Help & support
    │   ├── terms/page.tsx    # Terms of use
    │   └── api/
    │       ├── papers/route.ts  # GET  /api/papers
    │       ├── upload/route.ts  # POST /api/upload
    │       └── admin/route.ts   # POST /api/admin
    │
    ├── components/
    │   ├── Navbar.tsx        # Sticky header, nav links, mobile drawer, theme toggle
    │   ├── Footer.tsx        # 3-column footer with links
    │   ├── PaperCard.tsx     # Paper card used on browse page
    │   └── UploadForm.tsx    # Multi-step upload form with drag & drop
    │
    ├── lib/
    │   ├── supabaseClient.ts # Browser-side Supabase client
    │   ├── supabaseServer.ts # Server-side Supabase client (cookies)
    │   ├── auth.ts           # getServerUser() — server-side auth check
    │   └── roles.ts          # Role hierarchy helpers (student/moderator/admin)
    │
    └── types/
        └── index.ts          # TypeScript interfaces (Paper, Syllabus, UserProfile, etc.)
```

---

## Available Scripts

| Command         | Description                                |
| --------------- | ------------------------------------------ |
| `npm run dev`   | Start development server on `localhost:3000` |
| `npm run build` | Create optimized production build          |
| `npm run start` | Start production server                    |
| `npm run lint`  | Run ESLint                                 |

---

## Pages & Routes

### Public Pages

| Route            | Description                          |
| ---------------- | ------------------------------------ |
| `/`              | Home — hero, search bar, notices     |
| `/browse`        | Browse & filter papers               |
| `/paper/[id]`    | Paper detail with metadata & PDF     |
| `/syllabus`      | Syllabus listing                     |
| `/about`         | About ExamArchive                    |
| `/support`       | Help & support                       |
| `/terms`         | Terms of use                         |

### Protected Pages (login required)

| Route            | Description                          |
| ---------------- | ------------------------------------ |
| `/upload`        | Upload a question paper              |
| `/admin`         | Admin dashboard (admin role only)    |

### API Routes

| Method | Route         | Auth     | Description                     |
| ------ | ------------- | -------- | ------------------------------- |
| GET    | `/api/papers` | Public   | List approved papers (filterable) |
| POST   | `/api/upload` | Required | Upload a new paper              |
| POST   | `/api/admin`  | Admin    | Approve or delete a paper       |

---

## Role-Based Access

The app uses a three-tier role system validated **server-side** (never client-only):

| Role        | Permissions                                    |
| ----------- | ---------------------------------------------- |
| `student`   | Browse, view, and download papers              |
| `moderator` | All student permissions                        |
| `admin`     | All permissions + approve/reject/delete papers |

Roles are stored in the `profiles` table and checked via `src/lib/auth.ts` and `src/lib/roles.ts`. The middleware in `src/middleware.ts` protects `/admin`, `/api/upload`, and `/api/admin` routes by redirecting unauthenticated users to the home page.

---

## Dark Mode

The app supports light and dark themes via a `data-theme` attribute on the `<html>` element. The theme preference is:

1. Loaded from `localStorage` before first paint (no flash of wrong theme).
2. Falls back to the system preference (`prefers-color-scheme: dark`).
3. Toggled via the sun/moon icon in the navbar.

CSS custom properties in `src/app/globals.css` switch automatically based on `[data-theme="dark"]`.

---

## Deployment

### Vercel (Recommended)

1. Push your repository to GitHub.
2. Go to [vercel.com](https://vercel.com) and import the project.
3. Add the environment variables in the Vercel dashboard (Settings → Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy. Vercel will automatically detect Next.js and build the project.

### Self-Hosted

```bash
# Build the production bundle
npm run build

# Start the production server (default port 3000)
npm run start

# Or specify a custom port
PORT=8080 npm run start
```

Set the environment variables on your server via `.env.local`, system environment, or your hosting provider's dashboard.

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
