# AI Notes Setup Guide

The AI features (AI study-notes generation on `/ai-content`, the AI assistant
chat, solved-paper generation, and study flashcards) were intentionally
disabled by removing the API key. The routes (`/api/ai/*`), the `/ai-content`
and `/study` pages are all intact — reintroducing the feature is purely a
matter of setting environment variables and redeploying.

When the key is missing, the site shows a graceful
"AI notes unavailable — not configured" notice (with a link to this guide)
instead of a raw error. You can verify the state at any time with
`GET /api/ai/status` → `{"configured": true|false}`.

> ⚠️ **Never commit API keys or secrets to the repo.** All values below go
> into environment variables only (Vercel project settings and/or the
> Appwrite Function settings). No key values are stored anywhere in this
> repository.

## 1. Get a Gemini API key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey) and create an
   API key.
2. Keep it somewhere safe (a password manager) — you will paste it into
   Vercel and Appwrite below, never into code.

## 2. Vercel project environment (`examarchive-v3`)

Vercel Dashboard → your project → **Settings → Environment Variables**.
Add these for the **Production** environment (add to Preview too if you want
AI on preview deployments):

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | **Yes** (or `GOOGLE_API_KEY`) | Enables `/api/ai/generate`, `/api/ai/chat`, `/api/study/flashcards`. `GOOGLE_API_KEY` is accepted as a fallback alias. |
| `GEMINI_MODEL_ID` | No | Overrides the default model (`gemini-3.1-flash-lite-preview`). |
| `GEMINI_REQUEST_TIMEOUT_MS` | No | Request timeout in ms (default `120000`). |
| `OPENAI_API_KEY` | No | Enables PDF-upload RAG embeddings (`src/lib/pdf-rag.ts`). Without it, RAG context is skipped gracefully. |
| `AI_JOB_WEBHOOK_SECRET` | **Yes** (for PDF jobs) | Long random string shared with the Appwrite `pdf-generator` function. Used by `/api/ai/notify-completion` to authenticate the function's completion callback. |
| `PDF_DOWNLOAD_TOKEN_SECRET` | **Yes** (for PDF jobs) | Long random string used by `/api/ai/pdf` to sign secure download links. |

After saving, **redeploy** the project (Deployments → ⋯ → Redeploy). Environment
variable changes do not apply to existing deployments.

## 3. Appwrite Function environment (`pdf-generator`)

Appwrite Console → **Functions → `pdf-generator` → Settings → Variables**.
Add:

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | **Yes** (or `GOOGLE_API_KEY`) | Key the function uses to call Gemini while rendering notes/solved papers. |
| `GEMINI_MODEL_ID` | No | Model override (default `gemini-3.1-flash-lite-preview`). |
| `GEMINI_REQUEST_TIMEOUT_MS` | No | Per-request timeout. |
| `GEMINI_MAX_ATTEMPTS` | No | Retry attempts on transient failures. |
| `GEMINI_BASE_BACKOFF_MS` | No | Base backoff between retries. |
| `GOTENBERG_URL` | **Yes** (for PDF output) | URL of your Gotenberg instance (e.g. a Hugging Face Space `https://<user>-<space>.hf.space`). See `docs/HF_GOTENBERG_SETUP.md`. |
| `GOTENBERG_AUTH_TOKEN` | **Yes** (private Space) | HF token when the Gotenberg Space is private. |
| `AI_JOB_WEBHOOK_SECRET` | **Yes** | **Must be identical** to the Vercel value. The function signs its completion callback to `/api/ai/notify-completion` with it; mismatched values cause callbacks to be rejected. |

After saving variables, **redeploy the function** (Functions → `pdf-generator` →
Deployments → Redeploy) so the new variables take effect.

## 4. Verify

1. Visit `https://www.examarchive.dev/api/ai/status` — it should return
   `{"configured": true}`.
2. Open `/ai-content` — the "AI notes unavailable" notice should be gone.
3. Generate a small test note (a founder/admin account is not rate-limited).

## 5. Troubleshooting

- **`/api/ai/status` still returns `false`** — the key is set on Preview but
  not Production (or vice versa), or the deployment predates the variable
  change. Redeploy.
- **`AI generation is not configured` (503) on `/api/ai/generate`** —
  `GEMINI_API_KEY`/`GOOGLE_API_KEY` is missing or empty in the Vercel runtime
  environment.
- **PDF jobs never complete** — check that `AI_JOB_WEBHOOK_SECRET` matches
  byte-for-byte between Vercel and the Appwrite function, and that
  `GOTENBERG_URL` is reachable (see `docs/HF_GOTENBERG_SETUP.md`).
- **Region errors from Appwrite** — unrelated to AI keys; see
  `.agents/AGENTS.md` → "Appwrite & DNS Troubleshooting".

## Related docs

- `docs/HF_GOTENBERG_SETUP.md` — Gotenberg on Hugging Face Spaces.
- `docs/FREE_MODELS_LIMITS.md` — free-tier model limits.
- `.agents/AGENTS.md` — required env vars and cross-subdomain auth rules
  (do not touch the `ea_session` auth flow when working on AI routes).
