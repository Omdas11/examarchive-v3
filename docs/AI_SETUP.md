# AI Setup — ExamArchive v3

ExamArchive v3 ships with a lightweight AI assistant (ExamBot) powered by Google Gemini.
This document explains how to configure the integration, the security model, usage limits,
and how to extend it.

---

## Prerequisites

- A Google account with access to [Google AI Studio](https://aistudio.google.com/)
- A Gemini API key (free tier is sufficient for development)

---

## Getting a Gemini API Key

1. Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **Create API key**
4. Copy the generated key (starts with `AIza…`)

---

## Environment Configuration

Add the following variable to your `.env.local` file:

```env
# Google Gemini API key — server-side only, never exposed to the browser
GEMINI_API_KEY=AIzaSyYOUR_KEY_HERE
```

> **Security note:** `GEMINI_API_KEY` does **not** have the `NEXT_PUBLIC_` prefix.
> This means it is only available in server-side code (API routes, Server Components)
> and is **never** bundled into the client-side JavaScript. It will not appear in
> browser DevTools, network requests, or the compiled page source.

---

## Features

### 1. AI Chat Bubble (`💭`)

A floating bubble appears on every page (bottom-right corner).

- **Requires login:** Unauthenticated users are redirected to `/login` when they click the bubble.
- **Server-side only:** All Gemini API calls happen in `/api/ai/chat` — the key never reaches the browser.
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

ExamBot uses `gemini-1.5-flash`, which is:
- Fast (low latency)
- Free-tier eligible
- Suitable for educational summarisation tasks

To change the model, update the `model` parameter in:
- `src/app/api/ai/chat/route.ts`
- `src/app/api/ai/generate/route.ts`

---

## Security Checklist

- [x] `GEMINI_API_KEY` is a server-only environment variable (no `NEXT_PUBLIC_` prefix)
- [x] AI API routes verify user session before making Gemini calls
- [x] API key is never returned in any API response
- [x] System prompt instructs ExamBot to refuse sharing internal details
- [x] Message length is limited (1–1000 characters for chat, 1–500 for topic)
- [x] Rate limiting (3/day) prevents abuse of the Gemini quota

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `"AI assistant is not configured."` | `GEMINI_API_KEY` is missing | Add the key to `.env.local` and restart the dev server |
| `"AI response failed."` | Gemini returned an error | Check the server console for the Gemini error message |
| `"Daily limit reached"` | User exceeded 3 generations | Wait until the next calendar day (UTC) |
| Bubble does not appear | Component not rendering | Ensure `AIBubble` is imported in `src/app/layout.tsx` |
