# AI Backend Upgrade Blueprint (Next.js + TypeScript + Appwrite)

Comprehensive implementation guide for scaling ExamArchive’s AI pipeline while staying entirely in the **Next.js/TypeScript + Appwrite** stack. All AI calls are Gemini-only; do **not** introduce Python services. Respect the Gemini **250K TPM** quota by batching, debouncing UI triggers, and reusing shared API clients.

## Prerequisites & Tooling

- **Environment**: Next.js App Router (serverless routes), Node.js runtime for PDF parsing.  
- **Models**:  
  - `gemini-3.1-flash-lite-preview` for Phases 1–3 (large-context ingestion + content generation).  
  - `gemini-2.5-flash` for Phase 4 (admin/security analytics).  
- **Env vars**: `GEMINI_API_KEY`, `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`, `APPWRITE_DB_ID`, `APPWRITE_QUESTION_PAPERS_COLLECTION_ID`. Keep them in `.env.local` / Appwrite function secrets.  
- **Node deps (install in app workspace)**:
  ```bash
  npm install @google/generative-ai pdf-parse appwrite node-appwrite
  ```
  (`pdf-parse` and Appwrite SDKs are already present; include here for clarity and parity across local/dev/CI.)

## Suggested Directory Skeleton

```
src/
  app/
    api/
      ai-ingest/route.ts          # Phase 1 serverless route (PDF ingest -> Gemini 3.1 Flash Lite Preview)
      syllabus-map/route.ts       # Phase 2 route (syllabus JSON mapping + Appwrite sync)
      flashcards/route.ts         # Phase 3 route (flashcard/quiz generation)
  lib/
    ai/
      prompts/
        syllabus-mapper.ts        # Prompt templates tuned for Assam University/Haflong Govt. College
        flashcards.ts
      ingest.ts                   # Shared PDF/text preprocessing utilities
  workers/
    admin-report.ts               # Phase 4 scheduled job entry (Gemini 2.5 Flash)
appwrite/
  functions/
    admin-report/                 # Optional Appwrite Function alternative to Vercel Cron
```

---

## Phase 1: Deep PDF Ingestion Pipeline (Model: `gemini-3.1-flash-lite-preview`)

**Goal:** Upload a syllabus/question paper, extract raw text, and push the long context into Gemini for semantic structuring.

### API Route (Next.js App Router, Serverless)

Create `src/app/api/ai-ingest/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import pdf from "pdf-parse";
import { runGeminiCompletion } from "@/lib/gemini";

export const runtime = "nodejs"; // Needed for pdf-parse (Edge = unsupported)

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY missing" }, { status: 500 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await pdf(buffer);
  const rawText = parsed.text || "";

  const prompt = [
    "You are ingesting a university syllabus or question paper.",
    "Return a concise, lossless plaintext digest that preserves headings, units, and question numbers.",
    "Do not summarize; keep all academic wording intact.",
  ].join("\n");

  const { content, model } = await runGeminiCompletion({
    apiKey: process.env.GEMINI_API_KEY,
    prompt: `${prompt}\n\n---\n${rawText}`,
    maxTokens: 2048,
    temperature: 0.2,
    model: "gemini-3.1-flash-lite-preview",
  });

  return NextResponse.json({
    model,
    digest: content,
    charactersIngested: rawText.length,
  });
}
```

**Notes**
- Keep uploads < 10 MB per request; chunk larger PDFs client-side and concatenate on the server.  
- For 250K TPM safety: debounce client uploads, queue retries with exponential backoff, and share a single Gemini client instance.

---

## Phase 2: Syllabus-to-Archive Mapping (Model: `gemini-3.1-flash-lite-preview`)

**Goal:** Parse full Assam University/Haflong Government College syllabi into structured JSON and sync to Appwrite `question_papers` collection.

### Flow
1. **Input**: Full syllabus text (prefer Phase 1 digest to reduce noise).  
2. **Prompting**: Ask Gemini to emit strict JSON:
   ```json
   {
     "university": "Assam University",
     "college": "Haflong Government College",
     "program": "BSc",
     "semester": 4,
     "modules": [
       { "code": "PHY401", "title": "Quantum Mechanics", "topics": ["..."], "hours": 40 }
     ]
   }
   ```
3. **Validation**: `JSON.parse` with a Zod schema; reject/repair missing codes, titles, or empty modules.  
4. **Persistence**: Upsert into Appwrite:
   - Key on `(program, semester, module.code)` to avoid duplicates.  
   - Store raw syllabus text, Gemini model used, and checksum for traceability.  
5. **Endpoint**: `src/app/api/syllabus-map/route.ts` POST accepts `{ syllabusText }`, returns stored document IDs.

### Appwrite Sync (pseudocode)

```ts
import { Client, Databases } from "node-appwrite";

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const db = new Databases(client);
await db.createDocument(
  process.env.APPWRITE_DB_ID!,
  process.env.APPWRITE_QUESTION_PAPERS_COLLECTION_ID!,
  "unique()",
  {
    program,
    semester,
    modules,
    source: "syllabus",
    model: "gemini-3.1-flash-lite-preview",
    checksum,
  }
);
```

---

## Phase 3: Flashcard & Quiz Generation Engine (Model: `gemini-3.1-flash-lite-preview`)

**Goal:** Mine past question papers for recurring patterns and emit flashcards/quizzes for UI rendering.

### Endpoint/Function
- **Route**: `src/app/api/flashcards/route.ts` (or Appwrite Function for batch jobs).  
- **Input**: Array of question paper IDs or raw text. Fetch text from Appwrite first to keep the request small.  
- **Prompt**: Instruct Gemini to detect high-frequency concepts and output an array:
  ```json
  [
    { "question": "...", "answer": "...", "type": "flashcard" },
    { "question": "...", "answer": "...", "type": "mcq", "choices": ["A","B","C","D"], "correctIndex": 1 }
  ]
  ```
- **Post-processing**: Validate with Zod; deduplicate by question stem; cap to N items per call to stay inside TPM and token budgets.  
- **Storage**: Save generated flashcards back to Appwrite linked to the source paper IDs and model version.

---

## Phase 4: Automated Admin Reporting (Model: `gemini-2.5-flash`)

**Goal:** Weekly security/ops digest across Appwrite logs and DB states.

### Scheduling Options
- **Vercel Cron**: `vercel.json`
  ```json
  { "crons": [ { "path": "/api/admin-report", "schedule": "0 2 * * 1" } ] }
  ```
- **Appwrite Scheduled Function**: Set a weekly trigger to call `functions/admin-report`.

### Worker/Route Sketch (Node runtime)
```ts
import { runGeminiCompletion } from "@/lib/gemini";
import { Client, Databases } from "node-appwrite";

export const runtime = "nodejs";

async function fetchAuditSignals() {
  // pull recent login failures, permission changes, backup status, and collection health
}

export async function GET() {
  const signals = await fetchAuditSignals();
  const prompt = [
    "You are an admin auditor. Summarize risks, anomalies, and recommendations.",
    "Return a JSON object: {\"summary\": \"\", \"risks\": [...], \"actions\": [...]}",
  ].join("\n");

  const { content } = await runGeminiCompletion({
    apiKey: process.env.GEMINI_API_KEY!,
    prompt: `${prompt}\nLogs:\n${JSON.stringify(signals).slice(0, 12000)}`,
    maxTokens: 1024,
    temperature: 0.1,
    model: "gemini-2.5-flash",
  });

  // Save to Appwrite or notify admins (email/Slack webhook) here.
  return new Response(content, { status: 200 });
}
```

---

## Operational Guards
- **Rate limits**: Batch Gemini calls, add jittered retries, and surface `Retry-After` headers to the client.  
- **PII handling**: Strip student names/emails before sending to Gemini; keep only course/session metadata.  
- **Observability**: Log model ID, prompt hash, latency, and Appwrite document IDs; avoid logging raw PDF content.  
- **Testing**: Add integration tests around prompt shape and Zod validation stubs; use fixtures with synthetic PDFs.  
- **Security**: Keep secrets server-side only; routes must reject unauthenticated access when wired to the UI.  

This blueprint delivers an end-to-end, Next.js + Appwrite native AI pipeline with clear model boundaries and runnable boilerplate to start Phase 1 immediately.
