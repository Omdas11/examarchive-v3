import { Client, Storage, ID } from "node-appwrite";

/**
 * Server-side Appwrite client for file storage (PDFs, profile images).
 * All three variables below are server-only – never prefixed with NEXT_PUBLIC_.
 */
function createAppwriteClient(): Client {
  const endpoint = process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!endpoint || !projectId || !apiKey) {
    throw new Error(
      "Missing Appwrite environment variables: APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY",
    );
  }

  return new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);
}

/**
 * Upload a file to the configured Appwrite bucket and return its file ID.
 * The caller can then build the public view URL using the project/bucket IDs.
 * A unique file ID is always generated server-side.
 */
export async function uploadFileToAppwrite(
  file: File,
): Promise<{ fileId: string; bucketId: string }> {
  const bucketId = process.env.APPWRITE_BUCKET_ID;
  if (!bucketId) {
    throw new Error("Missing APPWRITE_BUCKET_ID environment variable");
  }

  const client = createAppwriteClient();
  const storage = new Storage(client);
  const fileId = ID.unique();

  await storage.createFile(bucketId, fileId, file);

  return { fileId, bucketId };
}

/**
 * Build the public view URL for a file stored in Appwrite.
 * This does not expose any server-only keys.
 */
export function getAppwriteFileUrl(fileId: string): string {
  const endpoint = process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID;
  const bucketId = process.env.APPWRITE_BUCKET_ID;

  if (!endpoint || !projectId || !bucketId) {
    throw new Error(
      "Missing Appwrite environment variables for URL construction",
    );
  }

  return `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/view?project=${projectId}`;
}

/**
 * Delete a file from Appwrite storage by its file ID.
 */
export async function deleteFileFromAppwrite(fileId: string): Promise<void> {
  const bucketId = process.env.APPWRITE_BUCKET_ID;
  if (!bucketId) {
    throw new Error("Missing APPWRITE_BUCKET_ID environment variable");
  }

  const client = createAppwriteClient();
  const storage = new Storage(client);

  await storage.deleteFile(bucketId, fileId);
}
