/**
 * Client-side Appwrite helper.
 *
 * Uploads files **directly** from the browser to Appwrite Storage without
 * routing the binary payload through the Next.js server.  This eliminates
 * Vercel's 4.5 MB body-size limit and "413 Payload Too Large" errors for
 * large PDFs.
 *
 * Authentication: The server issues a short-lived JWT via /api/upload/token;
 * the client sets it on the Appwrite Web SDK client via `client.setJWT()`.
 * The SDK handles CORS, chunked uploads (for files > 5 MB), and progress
 * tracking automatically.
 */

import { Client, Storage, ID, type UploadProgress as SdkUploadProgress } from "appwrite";

export const APPWRITE_ENDPOINT =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "";
export const APPWRITE_PROJECT_ID =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";
export const BUCKET_ID = process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID ?? "papers";
export const SYLLABUS_BUCKET_ID =
  process.env.NEXT_PUBLIC_APPWRITE_SYLLABUS_BUCKET_ID ?? "syllabus-files";

/** Maximum allowed upload size (bytes). Enforced client-side before upload. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

/** Progress event passed to the `onProgress` callback. */
export interface UploadProgress {
  /** 0–100 integer representing how much of the file has been sent. */
  progress: number;
  /** Bytes uploaded so far. */
  loaded: number;
  /** Total file size in bytes. */
  total: number;
}

/**
 * Validate that required Appwrite client-side environment variables are set.
 * Throws a descriptive error early so the user sees a useful message instead
 * of the opaque "Failed to fetch" that the SDK would produce.
 */
function assertEnv(): void {
  if (!APPWRITE_ENDPOINT) {
    throw new Error(
      "Appwrite endpoint is not configured (NEXT_PUBLIC_APPWRITE_ENDPOINT is missing). Please contact support.",
    );
  }
  if (!APPWRITE_PROJECT_ID) {
    throw new Error(
      "Appwrite project is not configured (NEXT_PUBLIC_APPWRITE_PROJECT_ID is missing). Please contact support.",
    );
  }
}

/**
 * Create a JWT-authenticated Appwrite client for direct browser-to-storage uploads.
 */
function createJwtClient(jwt: string): Client {
  assertEnv();
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID);
  client.setJWT(jwt);
  return client;
}

/**
 * Upload a single file directly from the browser to Appwrite Storage.
 * Uses the Appwrite Web SDK which handles CORS and chunked uploads automatically.
 *
 * @param jwt       Short-lived JWT obtained from `/api/upload/token`.
 * @param file      Browser `File` object selected by the user.
 * @param onProgress Optional callback receiving upload progress (0–100).
 * @returns The Appwrite file ID of the uploaded file.
 */
export async function uploadFileDirectly(
  jwt: string,
  file: File,
  onProgress?: (evt: UploadProgress) => void,
): Promise<string> {
  const client = createJwtClient(jwt);
  const storage = new Storage(client);
  const fileId = ID.unique();

  const sdkProgress = onProgress
    ? (p: SdkUploadProgress) => {
        onProgress({
          progress: Math.round(p.progress),
          loaded: p.sizeUploaded,
          total: file.size,
        });
      }
    : undefined;

  await storage.createFile(BUCKET_ID, fileId, file, [], sdkProgress);
  return fileId;
}

/**
 * Upload a file directly from the browser to the syllabus-files Appwrite bucket.
 * Uses the Appwrite Web SDK which handles CORS and chunked uploads automatically.
 *
 * @param jwt       Short-lived JWT obtained from `/api/upload/token`.
 * @param file      Browser `File` object selected by the user.
 * @param onProgress Optional callback receiving upload progress (0–100).
 * @returns The Appwrite file ID of the uploaded file.
 */
export async function uploadSyllabusFileDirectly(
  jwt: string,
  file: File,
  onProgress?: (evt: UploadProgress) => void,
): Promise<string> {
  const client = createJwtClient(jwt);
  const storage = new Storage(client);
  const fileId = ID.unique();

  const sdkProgress = onProgress
    ? (p: SdkUploadProgress) => {
        onProgress({
          progress: Math.round(p.progress),
          loaded: p.sizeUploaded,
          total: file.size,
        });
      }
    : undefined;

  await storage.createFile(SYLLABUS_BUCKET_ID, fileId, file, [], sdkProgress);
  return fileId;
}
