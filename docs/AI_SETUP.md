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
- **Output format:** Structured Markdown with headings, key concepts, exam tips, and a quick-revision checklist.
- **Print / Save PDF:** Users can open a print-friendly version via the browser's native print dialog.

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

## Model

ExamBot uses `llama3-8b-8192` on Groq, which is:
- Fast (low latency)
- Cost-efficient for chat and study summaries
- Suitable for educational summarisation tasks

To change the model, update the `model` parameter in:
- `src/app/api/ai/chat/route.ts`
- `src/app/api/ai/generate/route.ts`

### Notes on model differences vs Gemini

- Output style may be slightly less verbose than Gemini on the same prompt.
- Reasoning depth can vary for highly technical topics; adjust prompt detail for best results.
- Latency is typically lower, but occasional provider-side throttling can still happen.

---

## Security Checklist

- [x] `GROQ_API_KEY` is a server-only environment variable (no `NEXT_PUBLIC_` prefix)
- [x] AI API routes verify user session before making Groq calls
- [x] API key is never returned in any API response
- [x] System prompt instructs ExamBot to refuse sharing internal details
- [x] Message length is limited (1–1000 characters for chat, 1–500 for topic)
- [x] Rate limiting (3/day) prevents abuse of AI quota

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `"AI assistant is not configured."` | `GROQ_API_KEY` is missing | Add the key to `.env.local` and restart the dev server |
| `"AI response failed."` | Groq returned an error | Check the server console for the Groq error message |
| `"Daily limit reached"` | User exceeded 3 generations | Wait until the next calendar day (UTC) |
| Bubble does not appear | Component not rendering | Ensure `AIBubble` is imported in `src/app/layout.tsx` |

## Quick endpoint testing

1. Start app with `npm run dev`.
2. Log in with a non-founder user and test:
   - `POST /api/ai/chat` with a sample message/history payload.
   - `GET /api/ai/generate` to confirm remaining quota.
   - `POST /api/ai/generate` with a topic (and optional paperContext), verify `remaining` decreases.
3. Log in as founder and confirm `GET /api/ai/generate` returns `{ isFounder: true, remaining: null }`.
