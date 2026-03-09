# ExamArchive v3

ExamArchive is a community-driven platform for sharing and discovering university exam question papers and syllabi. Built with Next.js 15 (App Router) and Appwrite Cloud as the backend.

## Tech Stack

| Layer      | Technology                           |
|------------|--------------------------------------|
| Frontend   | Next.js 15 (App Router, TypeScript)  |
| Auth       | Appwrite Auth (email + Google OAuth) |
| Database   | Appwrite Databases                   |
| Storage    | Appwrite Storage (3 buckets)         |
| Hosting    | Vercel                               |

## Quick Start

1. **Clone the repository** and install dependencies:
   ```bash
   npm install
   ```

2. **Configure environment variables** — copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_APPWRITE_ENDPOINT` — Appwrite API endpoint (e.g. `https://cloud.appwrite.io/v1`)
   - `NEXT_PUBLIC_APPWRITE_PROJECT_ID` — your Appwrite project ID
   - `APPWRITE_API_KEY` — server-side Appwrite API key (never expose this client-side)
   - `APPWRITE_BUCKET_ID` — bucket for exam paper PDFs (default: `papers`)
   - `APPWRITE_SYLLABUS_BUCKET_ID` — bucket for syllabus PDFs (default: `syllabus-files`)
   - `APPWRITE_AVATARS_BUCKET_ID` — bucket for user avatars (default: `avatars`)

3. **Run the development server**:
   ```bash
   npm run dev
   ```

## Key Features

- **Upload Question Papers** — Users enter university, paper code, and year; all other metadata (course name, semester, department, paper type, exam type) is auto-resolved from the syllabus registry. Paper code suffix determines exam type: `T` = Theory, `P` = Practical.
- **Upload Syllabi** — Same simplified three-field form; metadata auto-resolved from registry.
- **Admin Moderation Queue** — All uploads require admin approval before publishing.
- **Browse & Search** — Filter papers by department, year, semester, and exam type.
- **User Roles & XP** — Role hierarchy with XP and achievement tracking.

## Documentation

| Document | Description |
|----------|-------------|
| [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | Appwrite collection schemas (active fields) |
| [docs/UPLOAD_FLOW.md](docs/UPLOAD_FLOW.md) | End-to-end upload architecture |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture overview |

## Project Structure

```
src/
  app/           # Next.js App Router pages and API routes
    api/
      upload/    # POST /api/upload (papers) + /syllabus
      admin/     # Admin moderation actions
      profile/   # User profile update
    upload/      # Upload UI page
    browse/      # Browse/search papers
    syllabus/    # Syllabus listing and detail
    admin/       # Admin dashboard
  components/    # Shared React components
    UploadForm.tsx           # Question paper upload form
    SyllabusUploadForm.tsx   # Single-semester syllabus upload form
    DeptSyllabusUploadForm.tsx # Departmental (all-semester) syllabus form
  data/
    syllabus-registry.ts  # Canonical paper metadata registry
  lib/
    appwrite.ts        # Server-side Appwrite client + collection IDs
    appwrite-client.ts # Browser-side Appwrite SDK upload helpers
    auth.ts            # Session helpers and user profile resolution
    roles.ts           # Role hierarchy helpers
  types/
    index.ts   # TypeScript interfaces and Appwrite document mappers
```
