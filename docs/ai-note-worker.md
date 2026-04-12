# AI Note Worker Deployment & Website Flow

## What was broken

`ai-note-worker` was only being created as an Appwrite Function resource, but no code deployment was uploaded by automation.  
That can result in failed builds / no active deployment, and Appwrite showing deployment size anomalies (including effectively empty deployments).

## What automation now does

The Appwrite AI sync script (`npm run sync:appwrite-ai`) now:

1. Ensures `ai-note-worker` exists.
2. Updates function configuration (runtime, execute permissions, entrypoint).
3. Builds a tar.gz from:
   - `appwrite/functions/ai-note-worker/`
4. Uploads that archive via Appwrite `createDeployment(..., activate=true, entrypoint=index.js)`.
5. Upserts required function variables:
   - `EXAMARCHIVE_BASE_URL`
   - `EXAMARCHIVE_WORKER_SHARED_SECRET`

This guarantees every sync includes real worker code, so deployment source/build size is non-zero and executable.

## Website execution flow

1. Website API `POST /api/ai/jobs` creates `ai_generation_jobs` with `queued`.
2. It triggers Appwrite execution for function ID `ai-note-worker`.
3. Appwrite function (`appwrite/functions/ai-note-worker/index.js`) receives payload with `jobId`.
4. The function calls website endpoint `POST /api/ai/jobs/execute` using header `x-worker-key`.
5. Website endpoint validates secret, then runs `processAiGenerationJob(jobId)` from `src/lib/ai-generation-worker.ts`.
6. Job status progresses (`queued` → `running` → `completed`/`failed`) in `ai_generation_jobs`.

## Required secrets/variables

Set in GitHub Actions/Appwrite environment:

- `APPWRITE_ENDPOINT`
- `APPWRITE_PROJECT_ID`
- `APPWRITE_API_KEY`
- `APPWRITE_AI_WORKER_SHARED_SECRET` (recommended dedicated secret)
- `APPWRITE_AI_WORKER_BASE_URL` (or fallback `NEXT_PUBLIC_SITE_URL`)

> If `APPWRITE_AI_WORKER_SHARED_SECRET` is absent, automation falls back to `APPWRITE_API_KEY` for compatibility.
