# AI Extensions Setup — ExamArchive v3

This setup enables:
- Server-side web search (Tavily-style) in `/api/ai/chat` and `/api/ai/generate`
- Appwrite-only PDF RAG (chunk + embedding arrays + metadata in Appwrite)
- Advanced AI generation UX controls (model + page length + role limits)

---

## 1) Environment Variables

Add these to `.env.local` (server-side only, **never** `NEXT_PUBLIC_`):

```env
# OpenRouter free-tier inference
OPENROUTER_API_KEY=...
# Only include $0/$0 models
# OPENROUTER_MODEL_ALLOWLIST=meta-llama/llama-3.1-8b-instruct:free,mistralai/mistral-7b-instruct:free
# OPENROUTER_APP_URL=https://your-domain.com
# OPENROUTER_APP_NAME=ExamArchive

# Embeddings (OpenAI-compatible)
OPENAI_API_KEY=...

# Optional Tavily-style search
TAVILY_API_KEY=...
# Optional, for Tavily-compatible endpoint override:
# TAVILY_SEARCH_URL=https://api.tavily.com/search
```

---

## 2) Appwrite Collection for RAG

Create collection: **`ai_embeddings`** in database `examarchive`.

Recommended attributes:

| Field | Type | Required | Notes |
|---|---|---:|---|
| `file_id` | string | yes | Appwrite storage file id |
| `source_type` | string | yes | `paper` or `syllabus` |
| `source_label` | string | yes | Human-readable source label |
| `course_code` | string | no | Paper code where available |
| `department` | string | no | Subject/department |
| `year` | integer | no | Year metadata |
| `uploaded_by` | string | no | Uploader id |
| `embedding_model` | string | yes | e.g. `text-embedding-3-small` |
| `chunk_index` | integer | yes | Chunk order in source doc |
| `text_chunk` | string | yes | Chunked PDF text |
| `embedding` | float[] | yes | Embedding vector array |

Recommended indexes:
- `file_id`
- `department`
- `(source_type, file_id, chunk_index)`

> Note: similarity ranking is computed server-side (cosine), so this works without external vector DB.

---

## 3) RAG Ingestion Flow

Implemented in:
- `/src/app/api/upload/route.ts` (paper upload)
- `/src/app/api/upload/syllabus/route.ts` (syllabus upload)
- `/src/lib/pdf-rag.ts`

Flow:
1. File is uploaded to Appwrite Storage (existing flow).
2. Metadata document is saved (existing flow).
3. Best-effort ingestion extracts PDF text, chunks it, embeds each chunk, stores in `ai_embeddings`.

If ingestion fails, upload remains valid (non-blocking).

---

## 4) Retrieval + Generation Flow

### `/api/ai/generate`
- Prioritizes archive context via Appwrite RAG retrieval.
- Optional live web search results included (Tavily-style).
- Generates detailed notes (theory, derivation logic, examples, PYQ-style patterns, revision table, references).
- Page length selector: 1–5 pages.
- Quota coupling for non-admin roles:
  - Remaining quota also constrains max page choice.
- Admin and Founder are unlimited.
- Model selection:
  - Non-admin users: top 3 model options available.
  - Admin/Founder: full pool unlocked.

### `/api/ai/chat`
- Uses archive retrieval + optional web search trigger for timely queries.
- Adds UI-aware and paper-code-aware guidance.
- Returns `model` and `sources` metadata for better UX transparency.

---

## 5) Security Notes

- All external API calls happen server-side only.
- API keys are never exposed to the client.
- Search results are sanitized and truncated before prompt injection.
- PDF text is chunked and stored in Appwrite only (no external DB).
- Existing auth checks in AI routes remain required.
- Existing quota enforcement remains active and now also drives page-length limits for standard users.

---

## 6) Operational Tips

- Run ingestion once enough uploads exist; retrieval quality improves as `ai_embeddings` grows.
- Keep `OPENROUTER_MODEL_ALLOWLIST` sorted by your preferred free-tier model priority.
- If web search quota is exhausted, routes gracefully continue with archive context only.
- If embedding key is missing, RAG gracefully degrades to non-embedded behavior (no hard crash).
