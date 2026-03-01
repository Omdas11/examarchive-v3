# ExamArchive v3 – Setup Guide

ExamArchive v3 uses a **hybrid architecture**:

- **Supabase** – Auth, database (profiles, papers, syllabi, achievements) and RLS-enforced access control.
- **Appwrite** – File storage for PDFs and profile images (server-side only; API key never reaches the browser).

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in every value before running the app.

| Variable | Scope | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public (browser + server) | Your Supabase project URL, e.g. `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (browser + server) | Supabase anonymous/public key for client-side queries |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Supabase service-role key with elevated privileges. **Never expose to the browser.** |
| `APPWRITE_ENDPOINT` | **Server only** | Appwrite API endpoint, e.g. `https://cloud.appwrite.io/v1` |
| `APPWRITE_PROJECT_ID` | **Server only** | Your Appwrite project ID |
| `APPWRITE_API_KEY` | **Server only** | Appwrite server-side API key. **Never expose to the browser.** |
| `APPWRITE_BUCKET_ID` | **Server only** | ID of the Appwrite storage bucket for exam PDFs and profile images |

> **Security note:** Variables without the `NEXT_PUBLIC_` prefix are **never** inlined into the client bundle by Next.js. The Appwrite API key and Supabase service-role key are used only in Route Handlers and Server Components.

---

## Database Schema (Supabase)

### `profiles` table

Extends `auth.users`. Created automatically via a Supabase trigger on sign-up.

```sql
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  -- Primary access-control role
  role          text not null default 'student',   -- legacy column kept for compatibility
  primary_role  text not null default 'student',   -- 'student' | 'moderator' | 'admin'
  -- Community / custom roles (nullable)
  secondary_role text default null,  -- 'contributor' | 'reviewer' | 'curator' | 'mentor' | null
  tertiary_role  text default null,  -- same values as secondary_role
  -- Activity tier
  tier          text not null default 'bronze',    -- 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
  created_at    timestamptz default now()
);
```

### `achievements` table

```sql
create table public.achievements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  slug        text not null,
  label       text not null,
  description text not null default '',
  earned_at   timestamptz not null default now()
);

create index on public.achievements(user_id);
```

### `papers` table

```sql
create table public.papers (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  course_code  text not null,
  course_name  text not null,
  year         integer not null,
  semester     text not null,
  exam_type    text not null,
  department   text not null,
  file_url     text not null,   -- Appwrite public view URL
  uploaded_by  uuid references public.profiles(id),
  approved     boolean not null default false,
  created_at   timestamptz default now()
);
```

### RPC helpers (optional)

Create a `search_papers` RPC function in the Supabase SQL editor for full-text search if needed:

```sql
create or replace function search_papers(query text)
returns setof papers language sql stable as $$
  select * from papers
  where approved = true
    and (
      to_tsvector('english', title || ' ' || course_name || ' ' || course_code)
      @@ plainto_tsquery('english', query)
    )
  order by created_at desc;
$$;
```

---

## Appwrite Storage Setup

1. Create a new **Project** in the [Appwrite Console](https://cloud.appwrite.io).
2. Go to **Storage → Buckets** and create a bucket (e.g. `exam-papers`).
3. Set bucket permissions to allow **create** for authenticated users (or restrict to the API key only for server-side-only uploads).
4. Copy the **Bucket ID** into `APPWRITE_BUCKET_ID`.
5. Go to **Overview → API Keys**, create a key with `storage.files.create`, `storage.files.read`, and `storage.files.delete` scopes, and copy it into `APPWRITE_API_KEY`.

---

## Local Development

```bash
# 1. Clone and install
git clone https://github.com/Omdas11/examarchive-v3.git
cd examarchive-v3
npm install

# 2. Copy and fill environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase + Appwrite credentials

# 3. Start the dev server
npm run dev
# → http://localhost:3000
```

---

## Vercel Deployment

1. Push the repository to GitHub (already done).
2. Import the repo in the [Vercel Dashboard](https://vercel.com/new).
3. In **Project Settings → Environment Variables**, add **all** variables from `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `APPWRITE_ENDPOINT`
   - `APPWRITE_PROJECT_ID`
   - `APPWRITE_API_KEY`
   - `APPWRITE_BUCKET_ID`
4. Deploy. Vercel will automatically run `next build`.

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

## Production Build Check

```bash
npm run build   # must exit 0 with no TypeScript or lint errors
npm run lint    # must exit 0
```

Confirm that no `APPWRITE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` or any other server-only secret appears in the `.next/static` output:

```bash
grep -r "APPWRITE_API_KEY\|SERVICE_ROLE" .next/static/ 2>/dev/null && echo "LEAK DETECTED" || echo "No secrets leaked"
```
