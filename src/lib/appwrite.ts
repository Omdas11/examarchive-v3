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
} as const;

/** Storage bucket for uploaded PDFs and files. */
export const BUCKET_ID = process.env.APPWRITE_BUCKET_ID ?? "papers";

/** Storage bucket for user avatar images. */
export const AVATARS_BUCKET_ID = process.env.APPWRITE_AVATARS_BUCKET_ID ?? "avatars";

/** Storage bucket for syllabus PDFs. */
export const SYLLABUS_BUCKET_ID = process.env.APPWRITE_SYLLABUS_BUCKET_ID ?? "syllabus-files";
export const MD_INGESTION_BUCKET_ID = process.env.APPWRITE_MD_INGESTION_BUCKET_ID ?? "examarchive-md-ingestion";
/** Storage bucket for generated markdown cache payloads. */
export const MARKDOWN_CACHE_BUCKET_ID =
  process.env.APPWRITE_MD_CACHE_BUCKET_ID ??
  process.env.APPWRITE_BUCKET_ID ??
  "examarchive-md-bucket";

// ── Server-side admin client (uses API key) ─────────────────────────────
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

  return new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);
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
 * Upload an avatar image to the avatars bucket and return its file ID.
 * Sets authenticated-user read permissions to match the bucket's access policy.
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
  ]);
  return { fileId, bucketId: AVATARS_BUCKET_ID };
}

/**
 * Delete an avatar file from the avatars bucket.
 */
export async function deleteAvatarFromAppwrite(fileId: string): Promise<void> {
  const storage = adminStorage();
  await storage.deleteFile(AVATARS_BUCKET_ID, fileId);
}

/**
 * Build the preview URL for an avatar stored in the avatars bucket.
 *
 * Returns a Next.js proxy URL (/api/files/avatars/{fileId}) instead of a
 * direct Appwrite URL so that requests are authenticated server-side with
 * the admin API key. This is required because the avatars bucket is
 * restricted to authenticated users and direct browser requests would fail.
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
 * Delete a file from Appwrite storage by its file ID.
 */
export async function deleteFileFromAppwrite(fileId: string): Promise<void> {
  const storage = adminStorage();
  await storage.deleteFile(BUCKET_ID, fileId);
}

// Re-export utilities so consumers can import from a single module.
export { Account, Databases, Storage, Users, Functions, ID, Query, Permission, Role };
