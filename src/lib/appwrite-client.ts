/**
 * Client-side Appwrite helper.
 *
 * Uploads files **directly** from the browser to Appwrite Storage without
 * routing the binary payload through the Next.js server.  This eliminates
 * Vercel's 4.5 MB body-size limit and "413 Payload Too Large" errors for
 * large PDFs.
 *
 * Authentication: The server issues a short-lived JWT via /api/upload/token;
 * the client sends it in the `x-appwrite-jwt` header.  We intentionally use
 * `credentials: 'omit'` so that no browser cookies are included – JWT auth
 * does not need cookies, and omitting credentials lets the request succeed
 * from any origin without needing to register the domain in the Appwrite
 * Console as a web platform (which fixes the common "Failed to fetch" / CORS
 * error users encounter).
 */

import { ID } from "appwrite";

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
 * Internal helper: uploads a file to an Appwrite Storage bucket using the
 * REST API directly (not the SDK) with `credentials: 'omit'`.  JWT is sent
 * as an `x-appwrite-jwt` header so no browser cookie is needed, which
 * avoids the CORS pre-flight credential requirement and the "Failed to fetch"
 * error that appears when the domain is not yet registered in the Appwrite
 * project's web-platform list.
 *
 * Progress is tracked via XHR (XMLHttpRequest) because the Fetch API does not
 * expose upload progress natively.
 */
function uploadWithProgress(
  endpoint: string,
  projectId: string,
  bucketId: string,
  fileId: string,
  jwt: string,
  file: File,
  onProgress?: (evt: UploadProgress) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = `${endpoint}/storage/buckets/${encodeURIComponent(bucketId)}/files`;

    const formData = new FormData();
    formData.append("fileId", fileId);
    formData.append("file", file, file.name);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.timeout = 10 * 60 * 1000; // 10-minute timeout for large files

    // JWT authentication – no cookies required
    xhr.setRequestHeader("x-appwrite-project", projectId);
    xhr.setRequestHeader("x-appwrite-jwt", jwt);
    // Omit credentials so Appwrite's CORS policy can use a wildcard origin
    // and the request succeeds even if the domain is not registered as a
    // web platform in the Appwrite project settings.
    xhr.withCredentials = false;

    if (onProgress) {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          onProgress({
            progress: Math.round((e.loaded / e.total) * 100),
            loaded: e.loaded,
            total: e.total,
          });
        }
      });
    }

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        let message = `Upload failed (HTTP ${xhr.status})`;
        try {
          const body = JSON.parse(xhr.responseText) as { message?: string };
          if (body.message) message = body.message;
        } catch {
          // ignore JSON parse errors
        }
        reject(new Error(message));
      }
    });

    xhr.addEventListener("error", () => {
      reject(
        new Error(
          "Failed to reach the storage server. Check your internet connection and ensure the Appwrite endpoint is correct.",
        ),
      );
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload was aborted."));
    });

    xhr.addEventListener("timeout", () => {
      reject(new Error("Upload timed out. Please check your connection and try again."));
    });

    xhr.send(formData);
  });
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
  assertEnv();
  const fileId = ID.unique();
  await uploadWithProgress(
    APPWRITE_ENDPOINT,
    APPWRITE_PROJECT_ID,
    BUCKET_ID,
    fileId,
    jwt,
    file,
    onProgress,
  );
  return fileId;
}

/**
 * Upload a file directly from the browser to the syllabus-files Appwrite bucket.
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
  assertEnv();
  const fileId = ID.unique();
  await uploadWithProgress(
    APPWRITE_ENDPOINT,
    APPWRITE_PROJECT_ID,
    SYLLABUS_BUCKET_ID,
    fileId,
    jwt,
    file,
    onProgress,
  );
  return fileId;
}
