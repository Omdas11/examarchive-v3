# AI Setup — ExamArchive v3 (OpenRouter)

ExamArchive v3 ships with a lightweight AI assistant (ExamBot) powered exclusively by **OpenRouter**. The backend restricts all inference to OpenRouter models whose prompt **and** completion prices are `$0`.

---

## Prerequisites

- An OpenRouter account with API access
- An OpenRouter API key
- At least one OpenRouter model that shows `$0` for both **Input** and **Output** pricing (see the Models page filter: Pricing Low→High)

---

## Getting an OpenRouter API Key

1. Go to [https://openrouter.ai/keys](https://openrouter.ai/keys)
2. Sign in to your OpenRouter account
3. Click **Create Key** and copy the generated key (keep it secret)
4. Visit [https://openrouter.ai/models](https://openrouter.ai/models) and filter pricing to **Low → High**
5. Select only models where both **Input** and **Output** columns display **$0** (e.g. `meta-llama/llama-3.1-8b-instruct:free`, `mistralai/mistral-7b-instruct:free`, `qwen/qwen-2.5-14b-instruct:free`)
6. Add those model IDs to `OPENROUTER_MODEL_ALLOWLIST` in `.env.local` (comma-separated) to lock the app to free-tier choices. Model availability and pricing can change, so re-check the OpenRouter models page periodically.

---

## Environment Configuration

Add the following variables to your `.env.local` file:

```env
# OpenRouter — server-only (never NEXT_PUBLIC_)
OPENROUTER_API_KEY=your-openrouter-api-key

# Only include models that show $0 for both prompt+completion
# Example: meta-llama/llama-3.1-8b-instruct:free,mistralai/mistral-7b-instruct:free
OPENROUTER_MODEL_ALLOWLIST=

# Optional attribution headers recommended by OpenRouter
# OPENROUTER_APP_URL=https://your-domain.com
# OPENROUTER_APP_NAME=ExamArchive

# Embeddings (still OpenAI-compatible for RAG)
OPENAI_API_KEY=your-openai-api-key
```

> **Security note:** `OPENROUTER_API_KEY` is server-only (no `NEXT_PUBLIC_`). It never reaches the browser or client bundles.

---

## Features

### 1. AI Chat Bubble (`💭`)
- Requires login; otherwise redirects to `/login`
- Server-side only OpenRouter calls in `/api/ai/chat`
- Uses archive/web context when helpful and surfaces source links

### 2. AI Generated Content Page (`/ai-content`)
- Signed-in users can generate revision summaries and download PDFs
- **Daily limit:** 5 generations per user (admin/founder unlimited)
- Users can choose page length (1–5), model (role-limited), and optional live web search
- Generated PDFs include a low-opacity, 45° tiled **ExamArchive** watermark on every page

---

## Usage Limits

| User role        | Daily AI generations |
|------------------|----------------------|
| Regular users    | 5 per day            |
| `admin`/`founder`| Unlimited            |

Tracked in Appwrite `ai_usage` collection (`{ user_id, date }`).

---

## API Routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/ai/chat` | `POST` | Required | Sends a chat message; returns `{ reply: string }` |
| `/api/ai/generate` | `POST` | Required | Generates a study document; returns `{ content, topic, generatedAt, remaining }` |
| `/api/ai/generate` | `GET` | Required | Returns remaining daily quota and available models |

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
  "paperContext": "(optional) raw text from a relevant syllabus or paper",
  "model": "meta-llama/llama-3.1-8b-instruct:free"
}
```

---

## Model Fallback + Selection System

ExamArchive uses an OpenRouter-only pool filtered to **free-tier** models:
- The pool is resolved from `OPENROUTER_MODEL_ALLOWLIST` (comma-separated). If unset, the app auto-syncs with the current OpenRouter free catalog and falls back to the built-in free allowlist.
- Each ID is validated against OpenRouter’s model catalog and kept only if both prompt+completion pricing are `$0` (embeddings/vision/video are filtered out).
- All free models in the pool are selectable for every role; the preferred model is honored first, then the rest of the free pool is attempted sequentially.

If no free models are available, the API responds with a temporary-unavailable 503. Check `OPENROUTER_MODEL_ALLOWLIST` and confirm the listed models still show $0 pricing on OpenRouter.

---

## Security Checklist

- [x] `OPENROUTER_API_KEY` is server-only (no `NEXT_PUBLIC_`)
- [x] API routes require an authenticated session before hitting OpenRouter
- [x] Model selection is restricted to $0/$0 models only
- [x] Keys are never returned in responses
- [x] Message/topic length limits enforced (chat: 1–1000 chars, generate topic: 1–500 chars)
- [x] HTML for PDFs is sanitized before rendering; watermark is applied at render time only

---

## Appwrite-only RAG + Web Search

- PDF text is chunked and stored in Appwrite collection `ai_embeddings`
- Embeddings currently use `OPENAI_API_KEY` (OpenAI-compatible)
- Tavily-style web search is optional (server-side only)
- Retrieval + web results are injected as **untrusted** context into prompts

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `"AI assistant is not configured."` | `OPENROUTER_API_KEY` missing | Add the key to `.env.local` and restart |
| `"Service temporarily unavailable. Please try again shortly."` | Allowlist empty, models no longer $0, or provider-side model issues | Verify `OPENROUTER_MODEL_ALLOWLIST` IDs still show $0 input/output, or leave it unset to auto-sync the free catalog and retry |
| `"Daily limit reached."` | User exceeded 5/day | Wait until next UTC day (admin/founder exempt) |
| Watermark missing in PDFs | Old cached build | Restart server; ensure `printBackground` stays enabled |

For quick endpoint testing, start the app with `npm run dev`, log in, and call the API routes above with sample payloads.

---

## Appwrite Collections referenced by AI routes

- `ai_usage`: `user_id` (string), `date` (string YYYY-MM-DD), `count` (integer; optional). Each generation inserts one document for daily rate limiting.
- `pdf_usage`: `user_id` (string), `date` (string YYYY-MM-DD). Each PDF render/download inserts one document.
- `ai_embeddings`: stores RAG chunks (`file_id`, `source_type`, `source_label`, `text_chunk`, `embedding[]`, metadata).

Ensure these attributes exist in the `examarchive` database before deploying the backend.
