# AI Setup — ExamArchive v3

ExamArchive v3 ships with a lightweight AI assistant (ExamBot) powered by Groq.
This document explains how to configure the integration, the security model, usage limits,
and how to extend it.

---

## Prerequisites

- A Groq account with API access
- A Groq API key

---

## Getting a Groq API Key

1. Go to [https://console.groq.com/keys](https://console.groq.com/keys)
2. Sign in to your Groq account
3. Click **Create API Key**
4. Copy the generated key and keep it secret

---

## Environment Configuration

Add the following variable to your `.env.local` file:

```env
# Groq API key — server-side only, never exposed to the browser
GROQ_API_KEY=gsk_your_key_here

# Optional: override model fallback priority (comma-separated)
# GROQ_MODEL_POOL=openai/gpt-oss-120b,openai/gpt-oss-20b,llama-3.3-70b-versatile,llama-3.1-8b-instant,llama-3.1-70b-versatile
```

> **Security note:** `GROQ_API_KEY` does **not** have the `NEXT_PUBLIC_` prefix.
> This means it is only available in server-side code (API routes, Server Components)
> and is **never** bundled into the client-side JavaScript. It will not appear in
> browser DevTools, network requests, or the compiled page source.

---

## Features

### 1. AI Chat Bubble (`💭`)

A floating bubble appears on every page (bottom-right corner).

- **Requires login:** Unauthenticated users are redirected to `/login` when they click the bubble.
- **Server-side only:** All Groq API calls happen in `/api/ai/chat` — the key never reaches the browser.
- **Context-aware:** ExamBot is aware of the site's structure (browse, syllabus, upload, profile pages) and provides navigation guidance.
- **History:** Up to the last 10 messages are sent as context with each request, keeping conversations coherent.

### 2. AI Generated Content Page (`/ai-content`)

Signed-in users can request AI-generated revision summaries.

- **Daily limit:** 3 generated documents per user per calendar day.
- **Founder bypass:** The `founder` role has unlimited generations for testing.
- **Admin+ unlimited:** `admin` and `founder` roles are treated as unlimited.
- **Output format:** Structured Markdown with headings, key concepts, exam tips, and a quick-revision checklist.
- **Print / Save PDF:** Users can open a print-friendly version via the browser's native print dialog.
- **Advanced controls:** Users can choose page length (1–5), model (role-limited), and optional live web search.
- **RAG priority:** Archive syllabus/paper context is retrieved first (Appwrite-only embeddings) before fallback to raw topic input.

---

## Usage Limits

| User role  | Daily AI generations |
|------------|----------------------|
| All roles (except founder) | 3 per day |
| `founder`  | Unlimited            |

Limits are tracked in the Appwrite `ai_usage` collection. Each generation creates one document with `{ user_id, date }`. The quota check counts documents matching `(user_id, today_date)`.

See [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md) for the full `ai_usage` collection schema.

---

## API Routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/ai/chat` | `POST` | Required | Sends a chat message; returns `{ reply: string }` |
| `/api/ai/generate` | `POST` | Required | Generates a study document; returns `{ content, topic, generatedAt, remaining }` |
| `/api/ai/generate` | `GET` | Required | Returns remaining daily quota: `{ remaining, limit, isFounder }` |

### Chat request body

```json
{
  "message": "How do I find past papers for Physics?",
  "history": [
    { "role": "user", "text": "Hi" },
    { "role": "assistant", "text": "Hello! How can I help?" }
  ]
}
```

### Generate request body

```json
{
  "topic": "Photosynthesis",
  "paperContext": "(optional) raw text from a relevant syllabus or paper"
}
```

---

## Model Fallback + Selection System

ExamArchive now uses a **priority-based multi-model fallback pool** for both:
- `POST /api/ai/chat`
- `POST /api/ai/generate`

Default model priority:
1. `openai/gpt-oss-120b`
2. `openai/gpt-oss-20b`
3. `llama-3.3-70b-versatile`
4. `llama-3.1-8b-instant`
5. `llama-3.1-70b-versatile`

If the current model fails (timeout, overload/rate limit, or provider error), the API automatically retries the next model until one succeeds or the pool is exhausted.

Users can select a preferred model in `/ai-content`:
- non-admin users: can select from allowed model subset
- admin/founder: full pool access
- preferred model is used first, then fallback pool continues automatically

You can override the priority order using `GROQ_MODEL_POOL` (comma-separated) without code changes.

### Notes on model differences vs Gemini

- Output style may be slightly less verbose than Gemini on the same prompt.
- Reasoning depth can vary for highly technical topics; adjust prompt detail for best results.
- Latency is typically lower, but occasional provider-side throttling can still happen.

---

## Security Checklist

- [x] `GROQ_API_KEY` is a server-only environment variable (no `NEXT_PUBLIC_` prefix)
- [x] AI API routes verify user session before making Groq calls
- [x] API key is never returned in any API response
- [x] Web search API key (`TAVILY_API_KEY`) and embeddings key (`OPENAI_API_KEY`) are server-only
- [x] Model fallback executes server-side only; no model credentials or internal errors are exposed to the browser
- [x] System prompt instructs ExamBot to refuse sharing internal details
- [x] Message length is limited (1–1000 characters for chat, 1–500 for topic)
- [x] Rate limiting (3/day) prevents abuse of AI quota

---

## Appwrite-only RAG + Web Search

- PDF text is extracted from Appwrite storage uploads.
- Text is chunked and stored in Appwrite collection `ai_embeddings` with embeddings array + metadata.
- Retrieval computes cosine similarity server-side and injects relevant chunks into prompts.
- Tavily-style web search is invoked server-side only and summarized before prompt injection.
- If retrieval/search is unavailable, generation falls back gracefully to topic-driven notes.

See [`../AI_EXTENSIONS_SETUP.md`](../AI_EXTENSIONS_SETUP.md) for full schema and setup details.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `"AI assistant is not configured."` | `GROQ_API_KEY` is missing | Add the key to `.env.local` and restart the dev server |
| `"AI is under high traffic. Please try again in a moment."` | Temporary provider overload/rate limit/timeout across fallback pool | Retry shortly; request will auto-fallback across models |
| `"Daily limit reached. Please try again tomorrow."` | Daily generation quota reached (or provider quota issue) | Wait until next day for app quota; check provider billing if persistent |
| `"Service temporarily unavailable. Please try again shortly."` | All models in fallback pool failed | Retry in a few moments |
| `"Daily limit reached"` | User exceeded 3 generations | Wait until the next calendar day (UTC) |
| Bubble does not appear | Component not rendering | Ensure `AIBubble` is imported in `src/app/layout.tsx` |

## Quick endpoint testing

1. Start app with `npm run dev`.
2. Log in with a non-founder user and test:
   - `POST /api/ai/chat` with a sample message/history payload.
   - `GET /api/ai/generate` to confirm remaining quota.
   - `POST /api/ai/generate` with a topic (and optional paperContext), verify `remaining` decreases.
3. Log in as founder and confirm `GET /api/ai/generate` returns `{ isFounder: true, remaining: null }`.
