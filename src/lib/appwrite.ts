import {
  Client,
  Account,
  Databases,
  Storage,
  Users,
  Functions,
  ID,
  Query,
  Permission,
  Role,
} from "node-appwrite";
import { InputFile } from "node-appwrite/file";

// ── Environment helpers ────────────────────────────────────────────────────
export const APPWRITE_ENDPOINT =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "";
export const APPWRITE_PROJECT_ID =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY ?? "";

/** Appwrite database that holds all ExamArchive collections. */
export const DATABASE_ID = "examarchive";

/** Collection IDs inside the `examarchive` database. */
export const COLLECTION = {
  users: "users",
  papers: "papers",
  syllabus: "syllabus",
  uploads: "uploads",
  activity_logs: "activity_logs",
  achievements: "achievements",
  /**
   * Site-wide analytics / metrics.
   * Stores a single document (ID = "singleton") with fields:
   *   visitor_count (integer), launch_progress (integer 0-100)
   * Create this collection manually in the Appwrite console with those attributes.
   */
  site_metrics: "site_metrics",
  /**
   * User-submitted feedback / testimonials.
   * Each document has: name (string), university (string), text (string), approved (boolean)
   * Create this collection manually in the Appwrite console.
   */
  feedback: "feedback",
  /**
   * Tracks daily AI-generated PDF usage per user.
   * Each document represents one generation event.
   * Fields: user_id (string), date (string YYYY-MM-DD), count (integer).
   * The compound key is (user_id + date) to enable efficient daily-limit queries.
   * Create this collection in the Appwrite console with the attributes above.
   */
  ai_usage: "ai_usage",
  user_quotas: "User_Quotas",
  generated_notes_cache: "Generated_Notes_Cache",
  ai_flashcards: "ai_flashcards",
  ai_ingestions: "ai_ingestions",
  syllabus_table: "Syllabus_Table",
  questions_table: "Questions_Table",
  /**
   * Tracks daily PDF render/download usage per user to protect the Puppeteer route.
   * Each document: user_id (string), date (string YYYY-MM-DD).
   */
  pdf_usage: "pdf_usage",
  /**
   * Stores RAG chunks extracted from uploaded papers/syllabi.
   * Fields include file_id, source_type, source_label, text_chunk, embedding[], and metadata.
   */
  ai_embeddings: "ai_embeddings",
  purchases: "purchases",
  /**
   * Tracks active/expired passes for each user.
   * Fields: user_id, pass_id, mode, status, daily_credits, days_remaining,
   *         last_daily_claim_at, activated_at, expires_at,
   *         razorpay_subscription_id, razorpay_order_id.
   */
  user_passes: "user_passes",
  ai_cache_index: "ai_cache_index",
  ai_generation_jobs: "ai_generation_jobs",
  /**
   * Raw visit log for the site's own analytics (IPs, bots, own-visit detection).
   * Written server-side by /api/log-visit from a fire-and-forget beacon.
   * Fields: ip (string), path (string), user_agent (string),
   * referrer (string), country (string), city (string),
   * user_id (string, optional), user_role (string, optional).
   * Create this collection manually in the Appwrite console with those
   * attributes. Read access must stay admin-only: the route writes with the
   * server API key, and no page ever reads this collection client-side.
   * The route degrades silently (still returns 200) if the collection
   * does not exist yet, so pages never break.
   */
  visit_logs: "visit_logs",
} as const;

/**
 * Surviving storage buckets (Appwrite free tier allows 3 per project).
 * Everything else lives as a folder inside one of these three — see the
 * folder constants below. Do NOT add a new bucket without deleting one
 * first, or Appwrite disables the oldest buckets on the free plan.
 */
/** Storage bucket for uploaded PDFs and files. */
export const BUCKET_ID = process.env.APPWRITE_BUCKET_ID ?? "papers";

/** Storage bucket for syllabus PDFs (allows any file type). */
export const SYLLABUS_BUCKET_ID = process.env.APPWRITE_SYLLABUS_BUCKET_ID ?? "syllabus-files";
/** Storage bucket for digitized question-paper markdown (paper-markdown). */
export const PAPER_MARKDOWN_BUCKET_ID =
  process.env.APPWRITE_PAPER_MARKDOWN_BUCKET_ID ?? "paper-markdown";

/**
 * Folder-based homes for the former single-purpose buckets (deleted
 * 2026-10-27 for the free-tier 3-bucket limit). Fetch-by-ID calls only
 * need the bucket; pass the folder when UPLOADING so files stay organised
 * (node-appwrite createFile takes folder as its 5th argument).
 */
/** User avatar images live in syllabus-files/avatars/ (it allows images; papers is PDF-only). */
export const AVATARS_BUCKET_ID = SYLLABUS_BUCKET_ID;
export const AVATARS_FOLDER = "avatars";
/** Uploaded syllabus markdown ingestion files live in paper-markdown/syllabus-md-ingestion/. */
export const SYLLABUS_MD_INGESTION_BUCKET_ID = PAPER_MARKDOWN_BUCKET_ID;
export const SYLLABUS_MD_INGESTION_FOLDER = "syllabus-md-ingestion";
/** Question ingestion assets (source markdown + rendered PDFs) live in syllabus-files/question-ingest-assets/. */
export const QUESTION_INGESTION_ASSETS_BUCKET_ID = SYLLABUS_BUCKET_ID;
export const QUESTION_INGESTION_FOLDER = "question-ingest-assets";
/** Generated markdown cache payloads live in paper-markdown/generated-md-cache/. */
export const MARKDOWN_CACHE_BUCKET_ID = PAPER_MARKDOWN_BUCKET_ID;
export const MARKDOWN_CACHE_FOLDER = "generated-md-cache";
/** Stitched unit-notes markdown cache payloads live in paper-markdown/cached-unit-notes/. */
export const CACHED_UNIT_NOTES_BUCKET_ID = PAPER_MARKDOWN_BUCKET_ID;
export const CACHED_UNIT_NOTES_FOLDER = "cached-unit-notes";
/** Stitched solved-paper markdown cache payloads live in paper-markdown/cached-solved-papers/. */
export const CACHED_SOLVED_PAPERS_BUCKET_ID = PAPER_MARKDOWN_BUCKET_ID;
export const CACHED_SOLVED_PAPERS_FOLDER = "cached-solved-papers";
/** User-uploaded handmade PDF notes live in papers/notes/. */
export const NOTES_BUCKET_ID = BUCKET_ID;
export const NOTES_FOLDER = "notes";
/** Cleaned print-perfect question-paper PDFs live in papers/clean-papers/. */
export const CLEAN_PAPERS_BUCKET_ID = BUCKET_ID;
export const CLEAN_PAPERS_FOLDER = "clean-papers";

// ── Server-side admin client (uses API key) ─────────────────────────────
let adminClientSingleton: Client | null = null;
/**
 * Create a keyless Appwrite client (endpoint + project only, no API key).
 * Use this for OAuth2 URL generation — the OAuth state must bind to the
 * user's browser, not to an API key session. Using the admin client here
 * causes "user_oauth2_state_invalid" errors.
 */
export function createOAuthClient(): Client {
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID) {
    throw new Error(
      "Missing Appwrite environment variables: " +
        "NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID",
    );
  }
  return new Client().setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID);
}
/**
 * Create an Appwrite client authenticated with the server-side API key.
 * Use this for all server-only operations (database writes, user management,
 * file storage, etc.).
 */
export function createAdminClient(): Client {
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
    throw new Error(
      "Missing Appwrite environment variables: " +
        "NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID, APPWRITE_API_KEY",
    );
  }

  if (adminClientSingleton) {
    return adminClientSingleton;
  }

  adminClientSingleton = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);

  return adminClientSingleton;
}

/**
 * Create an Appwrite client scoped to a user session.
 * Pass the session secret (from cookie) so the client acts on behalf of that user.
 */
export function createSessionClient(session: string): Client {
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID) {
    throw new Error(
      "Missing Appwrite environment variables: " +
        "NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID",
    );
  }

  return new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setSession(session);
}

// ── Convenience service factories ───────────────────────────────────────
export function adminDatabases() {
  return new Databases(createAdminClient());
}

export function adminStorage() {
  return new Storage(createAdminClient());
}

export function adminUsers() {
  return new Users(createAdminClient());
}

export function adminAccount() {
  return new Account(createAdminClient());
}

export function adminFunctions() {
  return new Functions(createAdminClient());
}

// ── File storage helpers ────────────────────────────────────────────────
/**
 * Upload a file to the configured Appwrite bucket and return its file ID.
 * Uses InputFile.fromBuffer so large files are sent correctly to Appwrite.
 */
export async function uploadFileToAppwrite(
  file: File,
): Promise<{ fileId: string; bucketId: string }> {
  const storage = adminStorage();
  const fileId = ID.unique();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const inputFile = InputFile.fromBuffer(buffer, file.name);
  await storage.createFile(BUCKET_ID, fileId, inputFile);
  return { fileId, bucketId: BUCKET_ID };
}

/**
 * Upload an avatar image to the avatars folder and return its file ID.
 * Sets authenticated-user read permissions; the syllabus-files bucket
 * itself is public-read, so avatars stay publicly viewable via the proxy.
 */
export async function uploadAvatarToAppwrite(
  file: File,
): Promise<{ fileId: string; bucketId: string }> {
  const storage = adminStorage();
  const fileId = ID.unique();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const inputFile = InputFile.fromBuffer(buffer, file.name);
  // Allow any authenticated user to read avatars (matches the bucket's "users" permission)
  await storage.createFile(AVATARS_BUCKET_ID, fileId, inputFile, [
    Permission.read(Role.users()),
  ], AVATARS_FOLDER);
  return { fileId, bucketId: AVATARS_BUCKET_ID };
}

/**
 * Delete an avatar file from the avatars folder.
 */
export async function deleteAvatarFromAppwrite(fileId: string): Promise<void> {
  const storage = adminStorage();
  await storage.deleteFile(AVATARS_BUCKET_ID, fileId);
}

/**
 * Build the preview URL for an avatar stored in the avatars folder.
 *
 * Returns a Next.js proxy URL (/api/files/avatars/{fileId}) instead of a
 * direct Appwrite URL so that requests are authenticated server-side with
 * the admin API key.
 */
export function getAvatarPreviewUrl(fileId: string, width = 200): string {
  return `/api/files/avatars/${fileId}?w=${width}`;
}

/**
 * Build the view URL for a paper PDF stored in Appwrite.
 *
 * Returns a Next.js proxy URL (/api/files/papers/{fileId}) instead of a
 * direct Appwrite URL so that requests are authenticated server-side with
 * the admin API key. This is required because the papers bucket is
 * restricted to authenticated users and direct browser requests would fail.
 */
export function getAppwriteFileUrl(fileId: string): string {
  return `/api/files/papers/${fileId}`;
}

/**
 * Build the download URL for a paper PDF stored in Appwrite.
 */
export function getAppwriteFileDownloadUrl(fileId: string): string {
  return `/api/files/papers/${fileId}?download=1`;
}

/**
 * Build the view URL for a note PDF stored in the notes bucket.
 */
export function getNotesFileUrl(fileId: string): string {
  return `/api/files/notes/${fileId}`;
}

/**
 * Build the download URL (with watermark) for a note PDF.
 */
export function getNotesFileDownloadUrl(fileId: string): string {
  return `/api/files/notes/${fileId}?download=1`;
}

/**
 * Delete a file from Appwrite storage by its file ID.
 */
export async function deleteFileFromAppwrite(fileId: string): Promise<void> {
  const storage = adminStorage();
  await storage.deleteFile(BUCKET_ID, fileId);
}

// Re-export utilities so consumers can import from a single module.
export { Account, Databases, Storage, Users, Functions, ID, Query, Permission, Role };
