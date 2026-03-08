# ExamArchive – Future Architecture & Roadmap

This document outlines the planned technical architecture for ExamArchive as the
platform scales beyond its initial soft launch. All items are subject to change as
priorities evolve.

---

## 1. Planned Subdomains

| Subdomain | Purpose | Priority |
|-----------|---------|----------|
| `examarchive.dev` | Main application (current) | ✅ Live |
| `admin.examarchive.dev` | Dedicated admin control panel (separate deployment) | High |
| `support.examarchive.dev` | Help centre / knowledge base (e.g. Docusaurus or Crisp) | Medium |
| `api.examarchive.dev` | Public REST/GraphQL API for third-party integrations | Medium |
| `ai.examarchive.dev` | AI-powered features (syllabus parsing, intelligent search) | Low (future) |

### DNS / Routing Notes

- All subdomains should be configured as CNAME records pointing to the Vercel
  deployment (or the appropriate hosting provider for that service).
- Use Vercel's **Custom Domains** panel to add each subdomain to the project.
- Each subdomain may be a separate Vercel project (recommended for
  `admin.examarchive.dev` and `api.examarchive.dev`) or path-based rewrites in
  `next.config.mjs` for simpler cases.

---

## 2. Admin Subdomain (`admin.examarchive.dev`)

**Rationale:** Separating the admin panel from the public site reduces the attack
surface and allows independent access control.

**Recommended approach:**
- Create a separate Next.js project (or a standalone React app) deployed to
  `admin.examarchive.dev`.
- Share the same Appwrite backend; admin-panel sessions use the existing
  `ea_session` cookie scoped to `examarchive.dev` (set `domain=.examarchive.dev`
  so it is accessible across subdomains).
- Restrict access at the middleware level using `isAdmin()` / `isFounder()` from
  `src/lib/roles.ts`.

---

## 3. API Subdomain (`api.examarchive.dev`)

**Rationale:** A versioned public API enables mobile apps, browser extensions, and
third-party integrations without coupling them to the Next.js rendering layer.

**Recommended stack:**
- **Hono** (lightweight, edge-compatible) or **Next.js API routes** re-exported
  under the subdomain.
- Versioned routes: `api.examarchive.dev/v1/papers`, `v1/syllabus`, `v1/users`,
  `v1/search`.
- Authentication: JWT bearer tokens issued by Appwrite (reuse existing session
  infrastructure).
- Rate limiting: Cloudflare Workers or Upstash Ratelimit (free tier available).

---

## 4. Support Subdomain (`support.examarchive.dev`)

**Recommended options (all free / student-accessible):**

| Tool | Notes |
|------|-------|
| **Docusaurus** | Free, open-source, static docs site |
| **Crisp** | Free live-chat widget; embeds in the main site |
| **Notion** (public page) | Fastest to set up; link from `support.examarchive.dev` |
| **Gitbook** | Free for open-source / student projects |

---

## 5. AI Integration Roadmap (`ai.examarchive.dev`)

All integrations below prioritise **free or student-accessible** options. Where
costs are unavoidable, they are deferred until the platform has sufficient usage to
justify them.

### 5.1 Syllabus Parsing

| Feature | Free Tool / Library | Notes |
|---------|-------------------|-------|
| PDF text extraction | `pdf-parse` (npm, free) | Run server-side in an API route |
| Unit / topic extraction | `compromise` (NLP, free, MIT) or regex rules | Good enough for structured syllabi |
| AI summarisation | **Google Gemini API** (free tier: 60 req/min) | Flash model is fast & free |

**Implementation sketch:**
```
POST /api/ai/parse-syllabus
  → Extract text from uploaded PDF (pdf-parse)
  → Send to Gemini Flash with a structured prompt
  → Return { units: [], topics: [], credits: number }
```

### 5.2 Question Analysis

| Feature | Free Tool | Notes |
|---------|-----------|-------|
| Keyword / topic extraction | `compromise` or `natural` (npm) | Client-side capable |
| Difficulty classification | Rule-based heuristics initially | ML model added later |
| AI analysis | Gemini Flash free tier | 1 call per paper on first view |

### 5.3 Intelligent Search

| Feature | Free Tool | Notes |
|---------|-----------|-------|
| Full-text search | Appwrite's built-in full-text index | Already available |
| Semantic / vector search | **Weaviate** (free cloud sandbox) or **Qdrant** (free tier) | Add embeddings for papers |
| Embeddings generation | **Hugging Face Inference API** (free tier) or Gemini Embedding | Low cost for small corpus |

**Phase 1:** Upgrade Appwrite full-text search with proper indexes.  
**Phase 2:** Generate embeddings for paper titles + course names on upload; store
in a vector DB for semantic search.

### 5.4 Automated Notes Generation

| Feature | Free Tool | Notes |
|---------|-----------|-------|
| Notes from syllabus | Gemini Flash (free tier) | Prompt: "Generate study notes for unit X" |
| Flashcard generation | Same prompt + structured JSON output | Export to Anki format |
| Question prediction | Gemini / GPT-4o mini | Based on past papers + syllabus topics |

**Cost estimate:** At Gemini Flash free-tier limits (60 req/min, 1M tokens/month),
a small student platform can sustain hundreds of notes generation requests per day
at zero cost.

---

## 6. Infrastructure Cost Model

| Component | Current | Future (scaled) |
|-----------|---------|----------------|
| Hosting | Vercel Hobby (free) | Vercel Pro (~$20/mo) |
| Database / Auth | Appwrite Cloud (free tier) | Appwrite Cloud Pro (~$15/mo) |
| File storage | Appwrite Storage (free tier) | Appwrite Storage (pay-as-you-go) |
| AI (text) | Gemini Flash free tier | Gemini Pay-as-you-go or GPT-4o mini |
| Search (semantic) | Qdrant / Weaviate free tier | Managed plan when corpus > 10k docs |
| Email delivery | Cloudflare Email Routing (free) | Resend / SendGrid free tier (100/day) |

**Target:** Keep infrastructure cost below **$0/month** until the platform reaches
500+ active monthly users, then graduate to paid tiers only as needed.

---

## 7. Security Considerations

- All new subdomains must share the same Content Security Policy (CSP) headers.
- The `ea_session` cookie should be scoped to `domain=.examarchive.dev` so it
  works across subdomains, but `Secure` and `HttpOnly` flags must remain set.
- The AI endpoints (`/api/ai/*`) must validate the user's session before
  processing requests to prevent abuse of free-tier API quotas.
- API keys for Gemini / Hugging Face / vector DBs must be stored as Vercel
  environment secrets and never exposed to the browser.

---

## 8. Mobile App (Stretch Goal)

A React Native / Expo app sharing the `api.examarchive.dev` backend is a
long-term goal. No timeline yet; prioritise the web platform first.
