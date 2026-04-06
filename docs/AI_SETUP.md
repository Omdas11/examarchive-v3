# AI Setup — ExamArchive v3 (OpenRouter)

ExamArchive v3 ships with a lightweight AI assistant (ExamBot) that prefers **Google Gemini (Flash Lite)** when a Gemini key is present, then automatically falls back to **OpenRouter** free-tier models whose prompt **and** completion prices are `$0`.

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
# Primary — Google Gemini (server-only, never NEXT_PUBLIC_)
GEMINI_API_KEY=your-gemini-api-key
# Optional: override Gemini model (default: gemini-3.1-flash-lite-preview)
# GEMINI_MODEL_ID=gemini-3.1-flash-lite-preview

# OpenRouter fallback — server-only (never NEXT_PUBLIC_)
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

### 1. AI Chat API (`/api/ai/chat`)
- Requires login; otherwise redirects to `/login`
- Server-side only OpenRouter calls in `/api/ai/chat`
- Uses archive/web context when helpful and surfaces source links

### 2. AI Generated Content Page (`/ai-content`)
- Signed-in users can generate revision summaries and download PDFs
- **Daily limit:** 5 generations per user (admin/founder unlimited)
- Auto-fallback tries Gemini first, then OpenRouter free allowlist; admin/founder can set a `gemini:` or `openrouter:` override (optional “apply to everyone” toggle)
- Generated PDFs include a low-opacity, 45° tiled **ExamArchive** watermark on every page

#### AI Content data fetch pipeline (Unit Notes + Solved Papers)

This pipeline is driven by data ingested from `DEMO_DATA_ENTRY.md` into:
- `Syllabus_Table` (unit-wise syllabus rows)
- `Questions_Table` (question rows, optional `year`)
- `ai_ingestions` (ingestion logs used for dropdown option discovery)

1. **Paper-code and year/unit option load** (`GET /api/generate-notes`)
   - Reads `Syllabus_Table` and `Questions_Table` scoped by `university + course + type`.
   - Uses cursor-based pagination on `Syllabus_Table`, `Questions_Table`, and `ai_ingestions` to avoid truncating dropdown data on larger datasets.
   - Builds paper-code dropdown options from non-failure ingestion logs (`ai_ingestions`) with field fallbacks (`paper_code`, digest fields, `source_label`), then constrains them to table-backed data.
   - Returns:
     - `paperCodes`
     - `notesPaperCodes` (paper codes that exist in `Syllabus_Table`; shown in **Unit Notes** tab)
     - `papersPaperCodes` (paper codes that exist in `Questions_Table`; shown in **Solved Papers** tab)
     - `unitsByPaperCode` (from `Syllabus_Table.unit_number`)
     - `yearsByPaperCode` (from `Questions_Table.year`)
   - Inclusion behavior:
     - Start from non-failure `ai_ingestions` discovery.
     - Merge in all table-backed scoped codes for each tab (`Syllabus_Table` for Notes, `Questions_Table` for Solved Papers).
    - This keeps ingestion-discovered options while ensuring table-present codes are never hidden when ingestion logs are partial.
   - Solved Papers tab options are intentionally permissive in UI:
     - If a paper exists in `Syllabus_Table` but has no `Questions_Table` rows yet, the paper code still appears in Solved Papers.
     - Year selector and Solved Paper generate action are disabled until question-year rows exist for that code.

2. **Unit Notes generation** (`GET /api/generate-notes-stream`)
   - Uses selected `university + course + type + paperCode + unitNumber`.
   - Fetches syllabus from `Syllabus_Table`.
   - Fetches related questions from `Questions_Table` (same selection scope) and includes them in prompt context.
   - If syllabus row is missing, route returns: `No syllabus data found for this unit.`
   - In UI, if a selected paper has no `unitsByPaperCode` entries, Unit dropdown is disabled and notes generation is blocked to prevent invalid unit requests.

3. **Solved Paper generation** (`GET /api/generate-solved-paper-stream`)
   - Uses selected `university + course + type + paperCode + year`.
   - Fetches questions from `Questions_Table`.
   - If no rows match, route returns: `No questions found for the selected paper/year.`

To avoid pipeline breakage:
- Keep `course`, `type`, `paper_code`, and `year` (for solved papers) consistent between ingested markdown and UI selections.
- Ensure ingestion status is not terminal failure (`failed`/`error`) when relying on ingestion-driven paper-code options.
- If `ai_ingestions` has a code but corresponding `Syllabus_Table`/`Questions_Table` rows are missing, the code is intentionally hidden for that tab until table rows exist.

#### Full reset / re-bootstrap (harsh recovery)

If data drift is severe and you need to rebuild from scratch, use:

```bash
npx tsx scripts/hard-reset-ingestion.ts
```

Optional:
- Set `APPWRITE_PROPAGATION_DELAY_MS` before running if your Appwrite environment needs a longer settle delay between delete/recreate operations.

What this reset does:
- Truncates `Syllabus_Table` and `Questions_Table`; deletes legacy `syllabus_registry` collection if it exists
- Recreates `ai_ingestions` collection with ingestion attributes
- Recreates and clears `examarchive-md-ingestion` bucket

After reset:
1. Re-ingest markdown files strictly following `DEMO_DATA_ENTRY.md`
2. Ensure each file uses paper-code linking (`paper_code`) across syllabus + questions

#### Mobile / Manual Trigger (GitHub Actions)

If you are away from your computer or fully on mobile, you can trigger the database hard-reset directly from GitHub without needing a terminal:

1. Open the **GitHub App** or navigate to your repository in a mobile browser.
2. Go to the **Actions** tab.
3. Select the **Manual AI Ingestion Hard Reset** workflow from the list on the left.
4. Tap the **Run workflow** button (top-right of the workflow run list).
5. In the confirmation input, type exactly `RESET` (all caps).
6. Tap **Run workflow** to start the process.

You can tap on the running workflow to watch live logs and confirm that the Appwrite collections and bucket were successfully deleted and recreated.

> **Prerequisites:** Ensure `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, and `APPWRITE_API_KEY` are saved as GitHub Repository Secrets (Settings → Secrets and variables → Actions) before triggering the workflow.

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
| `/api/ai/generate` | `GET` | Required | Returns remaining daily quota and note-length presets |

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

## Model Fallback System (no manual picker)

ExamArchive now auto-selects from an OpenRouter-only **free-tier text** pool:
- The pool is resolved from `OPENROUTER_MODEL_ALLOWLIST` (comma-separated). If unset, the app auto-syncs with the current OpenRouter free catalog and falls back to the built-in free allowlist.
- Each ID is validated against OpenRouter’s model catalog and kept only if both prompt+completion pricing are `$0` (embeddings/vision/video/VL/flux/veo are filtered out).
- The built-in default list is the user-requested catalog (ordered for speed first):  
  `nvidia/nemotron-3-super:free, minimax/minimax-m2.5:free, sourceful/riverflow-v2-pro:free, sourceful/riverflow-v2-fast:free, stepfun/step-3.5-flash:free, arcee/trinity-large-preview:free, liquid/lfm-2.5-1.2b-thinking:free, liquid/lfm-2.5-1.2b-instruct:free, nvidia/nemotron-3-nano-30b-a3b:free, sourceful/riverflow-v2-max-preview:free, sourceful/riverflow-v2-standard-preview:free, sourceful/riverflow-v2-fast-preview:free, arcee/trinity-mini:free, qwen/qwen-3-next-80b-a3b-instruct:free, nvidia/nemotron-nano-9b-v2:free, openai/gpt-oss-120b:free, openai/gpt-oss-20b:free, z-ai/glm-4.5-air:free, qwen/qwen-3-coder-480b-a35b:free, venice/uncensored:free, google/gemma-3n-2b:free, google/gemma-3n-4b:free, qwen/qwen-3-4b:free, mistralai/mistral-small-3.1-24b:free, google/gemma-3-4b:free, google/gemma-3-12b:free, google/gemma-3-27b:free, meta-llama/llama-3.3-70b-instruct:free, meta-llama/llama-3.2-3b-instruct:free, nousresearch/hermes-3-405b-instruct:free`.
- The API automatically falls back across this ordered pool; no manual selection is exposed in the UI.

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
| `"Service temporarily unavailable. Please try again shortly."` | Allowlist empty, models no longer $0, or provider-side model issues | Verify `OPENROUTER_MODEL_ALLOWLIST` IDs still show $0 input/output, or leave it unset to auto-sync the free catalog. The API now tries your preferred model first and then the remaining free pool (ordered by speed) to avoid one-model failures. |
| `"Daily limit reached."` | User exceeded 5/day | Wait until next UTC day (admin/founder exempt) |
| Watermark missing in PDFs | Old cached build | Restart server; ensure `printBackground` stays enabled |

For quick endpoint testing, start the app with `npm run dev`, log in, and call the API routes above with sample payloads.

---

## Appwrite Collections referenced by AI routes

- `ai_usage`: `user_id` (string), `date` (string YYYY-MM-DD), `count` (integer; optional). Each generation inserts one document for daily rate limiting.
- `pdf_usage`: `user_id` (string), `date` (string YYYY-MM-DD). Each PDF render/download inserts one document.
- `ai_embeddings`: stores RAG chunks (`file_id`, `source_type`, `source_label`, `text_chunk`, `embedding[]`, metadata).

Ensure these attributes exist in the `examarchive` database before deploying the backend.
