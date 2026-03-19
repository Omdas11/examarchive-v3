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
   - `GROQ_API_KEY` — server-side Groq API key for AI chat/content generation

3. **Run the development server**:
   ```bash
   npm run dev
   ```

## Key Features

- **Upload Question Papers** — Users enter university, paper code, and year; all other metadata is auto-resolved from the syllabus registry. Paper code suffix determines exam type: `T` = Theory, `P` = Practical.
- **Upload Syllabi** — Same simplified three-field form; metadata auto-resolved from registry.
- **Admin Moderation Queue** — All uploads require admin approval before publishing.
- **Browse & Search** — Filter papers by department, year, semester, and exam type.
- **Authenticated File Access** — PDFs are served through a Next.js proxy and require a valid login session.
- **User Roles & XP** — Role hierarchy with XP and achievement tracking.
- **Resilient AI Assistant** — `/api/ai/chat` and `/api/ai/generate` use Groq multi-model fallback (`openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `llama-3.1-70b-versatile`) with user-friendly high-traffic/service error messages.

## Security

- All paper and syllabus PDFs are stored with `read("users")` permission — they are accessible only to authenticated users.
- Files are served via `/api/files/papers/[fileId]` and `/api/files/syllabus/[fileId]` proxy routes which verify the user's session before streaming the file.
- Guests visiting `/paper/*` routes are automatically redirected to `/login`.

## Documentation

| Document | Description |
|----------|-------------|
| [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | Appwrite collection schemas |
| [docs/UPLOAD_FLOW.md](docs/UPLOAD_FLOW.md) | End-to-end upload architecture |
| [docs/AI_SETUP.md](docs/AI_SETUP.md) | Groq-based AI setup, limits, and endpoint usage |
| [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) | Complete environment variable reference |
| [docs/AI_EXTENSIONS_SETUP.md](docs/AI_EXTENSIONS_SETUP.md) | AI extensions and RAG setup |

## Project Structure

```text
src/
  app/           # Next.js App Router pages and API routes
    api/
      upload/    # POST /api/upload (papers) + /syllabus
      admin/     # Admin moderation actions
      files/     # Authenticated file proxy routes
      profile/   # User profile update
    paper/       # Individual paper page (requires auth)
    browse/      # Browse/search papers
    syllabus/    # Syllabus listing and detail
    admin/       # Admin dashboard
  components/    # Shared React components
  data/
    syllabus-registry.ts  # Canonical paper metadata registry
  lib/
    appwrite.ts        # Server-side Appwrite client + collection IDs
    appwrite-client.ts # Browser-side Appwrite SDK upload helpers
    auth.ts            # Session helpers and user profile resolution
    roles.ts           # Role hierarchy helpers
  middleware.ts  # Route protection — redirects guests from protected paths
  types/
    index.ts   # TypeScript interfaces and Appwrite document mappers
```
