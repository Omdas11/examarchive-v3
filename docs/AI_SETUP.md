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
6. Add those model IDs to `OPENROUTER_MODEL_ALLOWLIST` in `.env.local` (comma-separated) to lock the app to free-tier choices

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
- The pool is resolved from `OPENROUTER_MODEL_ALLOWLIST` (comma-separated)
- Each ID is validated against OpenRouter’s model catalog and kept only if both prompt+completion pricing are `$0`
- Non-admin users: top 3 free models in the pool are selectable
- Admin/Founder: full free pool is unlocked
- Preferred model is tried first, then the rest of the free pool is attempted sequentially

If no free models are available, the API responds with a 503 explaining how to set `OPENROUTER_MODEL_ALLOWLIST`.

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
| `"No free OpenRouter models are available."` | Allowlist empty or models not $0 | Set `OPENROUTER_MODEL_ALLOWLIST` to IDs showing $0 input/output |
| `"Daily limit reached."` | User exceeded 5/day | Wait until next UTC day (admin/founder exempt) |
| Watermark missing in PDFs | Old cached build | Restart server; ensure `printBackground` stays enabled |

For quick endpoint testing, start the app with `npm run dev`, log in, and call the API routes above with sample payloads.
