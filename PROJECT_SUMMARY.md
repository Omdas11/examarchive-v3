# ExamArchive v3 — Project Audit Summary

## 1. High-Level Architecture & Frontend-Backend Connection
**ExamArchive v3** is a Next.js (App Router) web application utilizing Appwrite as a Backend-as-a-Service (BaaS). The system heavily integrates with Google's Gemini LLMs and a Gotenberg PDF-rendering microservice to generate study notes and solved past papers on-demand.

**How it connects:**
* **Authentication:** Next.js Server Actions (`src/app/auth/actions.ts`) proxy authentication requests to Appwrite and securely store the session secret in an `httpOnly` cookie (`ea_session`).
* **Direct-to-Storage Uploads:** To bypass Vercel's 4.5MB serverless payload limit, the frontend requests a short-lived Appwrite JWT (`/api/upload/token`). The browser then uploads PDFs directly to the Appwrite Storage bucket (`src/lib/appwrite-client.ts`), followed by a metadata submission to a Next.js API route.
* **Server-side Proxying:** Database reads and writes (like fetching syllabus data or updating user stats) are securely proxied through Next.js API routes using a server-side Appwrite API Key or the user's session token. This prevents exposing the DB directly to the client.
* **Asynchronous AI Workers:** AI PDF generation (`/api/ai/generate-pdf`) relies on an Appwrite Function (`@appwrite-functions/pdf-generator`). The Next.js backend enqueues the job in the database, triggers the Appwrite function asynchronously, and provides a webhook callback URL (`/api/ai/notify-completion`) to get notified when the PDF is ready.

## 2. Architectural Improvements & Performance Optimizations
### Architectural Improvements
* **Migrate Appwrite Functions to TypeScript:** The `pdf-generator` function is currently written in plain JavaScript. Migrating it to TypeScript will ensure type parity with the Next.js backend, reducing runtime errors related to mismatched JSON payloads.
* **Centralized API Validation:** Many API routes (e.g., `src/app/api/upload/route.ts`, `src/app/api/payments/...`) rely on manual `typeof` checks to validate incoming JSON payloads. Implementing a validation library like `Zod` or `Valibot` would drastically clean up the API routes and ensure stronger type safety.
* **Decouple In-Route Puppeteer Rendering:** The `/api/ai/pdf` route spins up `@sparticuz/chromium` via Puppeteer directly inside a Next.js serverless function. This is highly susceptible to cold start delays, memory limits, and timeouts. This logic should be fully offloaded to the existing Gotenberg microservice.

### Performance Optimizations
* **Aggressive Caching for Reads:** Public data like the `Syllabus_Table`, `papers`, and platform stats are fetched from Appwrite on every request. Introducing Redis or Next.js `unstable_cache` with revalidation tags would significantly reduce database reads and lower TTFB (Time to First Byte).
* **Pagination Refactoring:** The `/api/devtool` and `/api/syllabus/table` routes use `while(true)` loops to fetch chunks of documents up to a hard cap. This is inefficient and memory-heavy. The frontend should rely on cursor-based infinite scrolling or explicit pagination rather than having the backend fetch massive arrays in memory.

### Cleaner TypeScript Types
* **Remove `any` in Document Mappers:** In `src/types/index.ts`, functions like `toPaper(doc: any)` undermine type safety. They should be strictly typed using `import { Models } from "node-appwrite";` (e.g., `doc: Models.Document`).

## 3. Hidden Bugs, Memory Leaks, and Edge Cases
### 🚨 Race Condition in Quota Tracking
* **Location:** `src/lib/user-quotas.ts` (`incrementQuotaCounter`)
* **Issue:** The backend reads the current daily quota, increments it, and writes it back. Appwrite lacks native atomic increments. If two AI requests hit the API simultaneously, they will both read the same base value and overwrite each other, leading to "lost updates" and allowing users to bypass their daily generation limits.

### 🚨 Serverless Font Loading Failure
* **Location:** `src/lib/pdf-watermark.ts` (`loadInterFont`)
* **Issue:** The code uses `fs.readFileSync(path.join(process.cwd(), "node_modules/@fontsource/..."))`. In serverless environments like Vercel, `node_modules` paths are heavily pruned or shifted during the build step. This will almost certainly throw a runtime error in production, forcing the PDF watermarker to fall back to `Helvetica-Bold`.

### 🚨 Eventual Consistency Webhook Race
* **Location:** `src/app/api/ai/notify-completion/route.ts`
* **Issue:** The Appwrite `pdf-generator` function fires the webhook immediately upon completion. However, due to database eventual consistency, the `result_file_id` might not be fully written to the Appwrite DB by the time the webhook is received. The code attempts to sleep/poll for up to 5 seconds (`UNVERIFIED_CALLBACK_MAX_JOB_CONSISTENCY_RETRIES`), which ties up Vercel connection limits and threatens to exceed timeout bounds.

### 🚨 Unbounded Execution Timeouts
* **Location:** `src/app/api/devtool/route.ts`
* **Issue:** The `purge_collections`, `reset_all_papers`, and `clear_activity_logs` endpoints run synchronous `while(true)` loops awaiting deletions. In a production database with thousands of records, this will easily exceed the standard Vercel serverless function timeout (60-300s), terminating the process abruptly and leaving the database in a corrupted/partial state.

### ⚠️ Orphaned Appwrite Storage Files
* **Location:** `src/app/api/upload/route.ts`
* **Issue:** If the database `createDocument` call fails to store paper metadata, the backend attempts to delete the newly uploaded file via `rollbackUploadedPaper`. If this secondary `deleteFile` API call fails (e.g., due to a network blip), the file becomes permanently orphaned in Appwrite Storage, consuming space indefinitely. A background cron-job cleanup script is recommended.