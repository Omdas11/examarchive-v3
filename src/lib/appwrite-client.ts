/**
 * Client-side Appwrite helper.
 *
 * Uses the `appwrite` Web SDK (already in package.json) so the browser can
 * upload files **directly** to Appwrite Storage without routing the binary
 * payload through the Next.js server.  This eliminates Vercel's 4.5 MB body-
 * size limit and "413 Payload Too Large" errors for large PDFs.
 *
 * Authentication: The server issues a short-lived JWT via /api/upload/token;
 * the client passes it to `client.setJWT()` so Appwrite honours the request
 * under the uploading user's identity.
 */

import { Client, Storage, ID } from "appwrite";

export const APPWRITE_ENDPOINT =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "";
export const APPWRITE_PROJECT_ID =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";
export const BUCKET_ID = process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID ?? "papers";

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
 * Upload a single file directly from the browser to Appwrite Storage.
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
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setJWT(jwt);

  const storage = new Storage(client);
  const fileId = ID.unique();

  await storage.createFile(
    BUCKET_ID,
    fileId,
    file,
    undefined, // permissions – inherit bucket defaults
    onProgress
      ? (event) => {
          onProgress({
            progress: Math.round(event.progress),
            loaded: event.sizeUploaded,
            total: file.size,
          });
        }
      : undefined,
  );

  return fileId;
}
