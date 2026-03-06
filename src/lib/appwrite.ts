import {
  Client,
  Account,
  Databases,
  Storage,
  Users,
  ID,
  Query,
  Permission,
  Role,
} from "node-appwrite";

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
} as const;

/** Storage bucket for uploaded PDFs and files. */
export const BUCKET_ID = process.env.APPWRITE_BUCKET_ID ?? "papers";

/** Storage bucket for user avatar images. */
export const AVATARS_BUCKET_ID = process.env.APPWRITE_AVATARS_BUCKET_ID ?? "avatars";

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

// ── File storage helpers ────────────────────────────────────────────────
/**
 * Upload a file to the configured Appwrite bucket and return its file ID.
 */
export async function uploadFileToAppwrite(
  file: File,
): Promise<{ fileId: string; bucketId: string }> {
  const storage = adminStorage();
  const fileId = ID.unique();
  await storage.createFile(BUCKET_ID, fileId, file);
  return { fileId, bucketId: BUCKET_ID };
}

/**
 * Upload an avatar image to the avatars bucket and return its file ID.
 * Sets public read permissions so avatar images can be viewed by anyone.
 */
export async function uploadAvatarToAppwrite(
  file: File,
): Promise<{ fileId: string; bucketId: string }> {
  const storage = adminStorage();
  const fileId = ID.unique();
  // Set public read permission so avatars can be viewed by anyone
  await storage.createFile(AVATARS_BUCKET_ID, fileId, file, [
    Permission.read(Role.any()),
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
 * Uses output=webp for better compression and quality.
 */
export function getAvatarPreviewUrl(fileId: string, width = 200): string {
  return `${APPWRITE_ENDPOINT}/storage/buckets/${AVATARS_BUCKET_ID}/files/${fileId}/preview?project=${APPWRITE_PROJECT_ID}&width=${width}&height=${width}&gravity=center&quality=90&output=webp`;
}

/**
 * Build the public view URL for a file stored in Appwrite.
 */
export function getAppwriteFileUrl(fileId: string): string {
  return `${APPWRITE_ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${fileId}/view?project=${APPWRITE_PROJECT_ID}`;
}

/**
 * Delete a file from Appwrite storage by its file ID.
 */
export async function deleteFileFromAppwrite(fileId: string): Promise<void> {
  const storage = adminStorage();
  await storage.deleteFile(BUCKET_ID, fileId);
}

// Re-export utilities so consumers can import from a single module.
export { Account, Databases, Storage, Users, ID, Query, Permission, Role };
