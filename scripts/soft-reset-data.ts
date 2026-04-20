/**
 * Soft reset: clears all rows from Syllabus_Table, Questions_Table, and ai_ingestions.
 * Also supports optionally clearing generated notes markdown cache bucket files.
 *
 * Usage:
 * npx tsx scripts/soft-reset-data.ts
 * npx tsx scripts/soft-reset-data.ts --skip-ingestions --clear-bucket
 *
 * Environment variables required:
 * APPWRITE_API_KEY and either:
 * - APPWRITE_ENDPOINT + APPWRITE_PROJECT_ID
 * - NEXT_PUBLIC_APPWRITE_ENDPOINT + NEXT_PUBLIC_APPWRITE_PROJECT_ID
 */

import { Client, Databases, Storage, Query } from "node-appwrite";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(path.resolve(__dirname, ".."));

function loadAppwriteEnv(): { endpoint: string; projectId: string; apiKey: string } {
  const endpoint = process.env.APPWRITE_ENDPOINT || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "";
  const projectId = process.env.APPWRITE_PROJECT_ID || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "";
  const apiKey = process.env.APPWRITE_API_KEY || "";
  const missing: string[] = [];
  if (!endpoint) missing.push("APPWRITE_ENDPOINT or NEXT_PUBLIC_APPWRITE_ENDPOINT");
  if (!projectId) missing.push("APPWRITE_PROJECT_ID or NEXT_PUBLIC_APPWRITE_PROJECT_ID");
  if (!apiKey) missing.push("APPWRITE_API_KEY");
  if (missing.length > 0) {
    throw new Error(`[soft-reset] missing environment variables: ${missing.join(", ")}`);
  }
  return { endpoint, projectId, apiKey };
}

const appwriteEnv = loadAppwriteEnv();
const client = new Client()
  .setEndpoint(appwriteEnv.endpoint)
  .setProject(appwriteEnv.projectId)
  .setKey(appwriteEnv.apiKey);

const databases = new Databases(client);
const storage = new Storage(client);

const DB_ID = "examarchive";
const SYLLABUS_TABLE_COL_ID = "Syllabus_Table";
const QUESTIONS_TABLE_COL_ID = "Questions_Table";
const AI_INGESTIONS_COL_ID = "ai_ingestions";
const AI_GENERATION_JOBS_COL_ID = "ai_generation_jobs";
const SYLLABUS_REGISTRY_COL_ID = "syllabus_registry";
const PAPERS_BUCKET_ID = process.env.APPWRITE_BUCKET_ID || "papers";
const NOTES_MARKDOWN_BUCKETS_TO_CLEAR = [
  "cached-unit-notes",
  "cached-solved-papers",
];
const LIST_PAGE_LIMIT = 100;
const MAX_TRUNCATION_ITERATIONS = 1000;

function isNotFoundError(error: unknown): boolean {
  const maybeError = error as {
    code?: number;
    type?: string;
    message?: string;
    response?: { code?: number; type?: string };
  };
  const code = maybeError?.code ?? maybeError?.response?.code;
  const type = maybeError?.type ?? maybeError?.response?.type ?? "";
  const message = String(maybeError?.message ?? "");
  return code === 404 || /not found/i.test(message) || /_not_found$/.test(type);
}

function isConflictError(error: unknown): boolean {
  const maybeError = error as {
    code?: number;
    type?: string;
    message?: string;
    response?: { code?: number; type?: string; message?: string };
  };
  const code = maybeError?.code ?? maybeError?.response?.code;
  const type = String(maybeError?.type ?? maybeError?.response?.type ?? "");
  const message = String(maybeError?.message ?? maybeError?.response?.message ?? "");
  return code === 409 || /conflict/i.test(type) || /already exists/i.test(message);
}

async function emptyBucket(bucketId: string): Promise<void> {
  try {
    await storage.getBucket(bucketId);
  } catch (error) {
    if (isNotFoundError(error)) {
      console.log(`[soft-reset] skip bucket ${bucketId}: bucket not found`);
      return;
    }
    throw error;
  }

  let deleted = 0;
  let failed = 0;
  let hitIterationLimit = false;

  for (let iteration = 0; iteration < MAX_TRUNCATION_ITERATIONS; iteration++) {
    const list = await storage.listFiles(bucketId, [Query.limit(LIST_PAGE_LIMIT)]);
    if (!Array.isArray(list.files) || list.files.length === 0) {
      break;
    }

    // Process deletions sequentially to avoid 500 Server Errors
    for (const file of list.files) {
      try {
        await storage.deleteFile(bucketId, file.$id);
        deleted++;
      } catch (err) {
        console.error(`[soft-reset] Failed to delete file ${file.$id}:`, err);
        failed++;
      }
      
      // Small delay to prevent rate limits
      await new Promise(resolve => setTimeout(resolve, 20));
    }

    console.log(`[soft-reset] Progress: ${deleted} files deleted so far from bucket ${bucketId}...`);

    if (list.files.length < LIST_PAGE_LIMIT) {
      break;
    }
    if (iteration === MAX_TRUNCATION_ITERATIONS - 1) {
      hitIterationLimit = true;
    }
  }

  if (hitIterationLimit) {
    console.warn(`[soft-reset] ${bucketId} file truncation hit iteration cap (${MAX_TRUNCATION_ITERATIONS})`);
  }
  
  console.log(`[soft-reset] FINAL: emptied bucket ${bucketId}. ${deleted} file(s) successfully removed, ${failed} failed.`);
}

async function truncateCollection(collectionId: string): Promise<void> {
  try {
    await databases.getCollection(DB_ID, collectionId);
  } catch (error) {
    if (isNotFoundError(error)) {
      console.log(`[soft-reset] skip ${collectionId}: collection not found`);
      return;
    }
    throw error;
  }

  let deleted = 0;
  let failed = 0;
  let hitIterationLimit = false;

  for (let iteration = 0; iteration < MAX_TRUNCATION_ITERATIONS; iteration++) {
    const list = await databases.listDocuments(DB_ID, collectionId, [Query.limit(LIST_PAGE_LIMIT)]);
    if (!Array.isArray(list.documents) || list.documents.length === 0) {
      break;
    }

    // Process deletions sequentially to avoid 500 Server Errors
    for (const doc of list.documents) {
      try {
        await databases.deleteDocument(DB_ID, collectionId, doc.$id);
        deleted++;
      } catch (err) {
        console.error(`[soft-reset] Failed to delete doc ${doc.$id}:`, err);
        failed++;
      }
      
      // Small delay to prevent rate limits / overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 20));
    }

    console.log(`[soft-reset] Progress: ${deleted} rows deleted so far from ${collectionId}...`);

    if (list.documents.length < LIST_PAGE_LIMIT) {
      break;
    }
    if (iteration === MAX_TRUNCATION_ITERATIONS - 1) {
      hitIterationLimit = true;
    }
  }

  if (hitIterationLimit) {
    console.warn(`[soft-reset] ${collectionId} truncation hit iteration cap (${MAX_TRUNCATION_ITERATIONS})`);
  }
  
  if (deleted > 0 || failed > 0) {
    const remaining = await databases.listDocuments(DB_ID, collectionId, [Query.limit(1)]);
    if (remaining.total > 0) {
      console.warn(
        `[soft-reset] ${collectionId} still has ${remaining.total} doc(s) after capped truncation loop`,
      );
    }
  }
  
  console.log(`[soft-reset] FINAL: truncated ${collectionId}. ${deleted} doc(s) successfully removed, ${failed} failed.`);
}

async function deleteLegacySyllabusRegistryCollection(): Promise<void> {
  try {
    await databases.deleteCollection(DB_ID, SYLLABUS_REGISTRY_COL_ID);
    console.log(`[soft-reset] deleted legacy collection ${SYLLABUS_REGISTRY_COL_ID}`);
  } catch (error) {
    if (isNotFoundError(error)) {
      console.log(`[soft-reset] legacy collection ${SYLLABUS_REGISTRY_COL_ID} already absent`);
      return;
    }
    throw error;
  }
}

async function ensureUnitNumberIndex(): Promise<boolean> {
  try {
    await databases.createIndex(
      DB_ID,
      AI_GENERATION_JOBS_COL_ID,
      "unit_number_idx",
      "key",
      ["unit_number"],
      ["ASC"],
    );
    console.log(`[soft-reset] created index unit_number_idx on ${AI_GENERATION_JOBS_COL_ID}.`);
    return true;
  } catch (error) {
    if (isConflictError(error)) {
      console.log(`[soft-reset] index unit_number_idx already exists on ${AI_GENERATION_JOBS_COL_ID}.`);
      return false;
    }
    throw error;
  }
}

async function cleanupGhostCacheRecords(): Promise<void> {
  let deletedDocs = 0;
  let deletedFiles = 0;
  let failedDocs = 0;
  let failedFiles = 0;

  for (let iteration = 0; iteration < MAX_TRUNCATION_ITERATIONS; iteration++) {
    const response = await databases.listDocuments(DB_ID, AI_GENERATION_JOBS_COL_ID, [
      Query.greaterThan("unit_number", 0),
      Query.limit(100),
    ]);

    if (!Array.isArray(response.documents) || response.documents.length === 0) {
      break;
    }

    for (const doc of response.documents) {
      const resultFileId = String((doc as { result_file_id?: string }).result_file_id || "").trim();
      if (resultFileId) {
        try {
          await storage.deleteFile(PAPERS_BUCKET_ID, resultFileId);
          deletedFiles++;
        } catch (error) {
          if (!isNotFoundError(error)) {
            console.error(`[soft-reset] Failed to delete file ${resultFileId} from ${PAPERS_BUCKET_ID}:`, error);
            failedFiles++;
          }
        }
      }

      try {
        await databases.deleteDocument(DB_ID, AI_GENERATION_JOBS_COL_ID, doc.$id);
        deletedDocs++;
      } catch (error) {
        console.error(`[soft-reset] Failed to delete ghost cache doc ${doc.$id}:`, error);
        failedDocs++;
      }

      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    if (response.documents.length < 100) {
      break;
    }
  }

  console.log(
    `[soft-reset] ghost cache cleanup complete. Docs deleted: ${deletedDocs}, file(s) deleted: ${deletedFiles}, doc failures: ${failedDocs}, file failures: ${failedFiles}.`,
  );
}

async function softReset(includeIngestions: boolean, clearBucket: boolean): Promise<void> {
  const indexCreated = await ensureUnitNumberIndex();
  if (indexCreated) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  await cleanupGhostCacheRecords();

  console.log("🗑️  SOFT RESET: clearing Syllabus_Table and Questions_Table rows…");

  await truncateCollection(SYLLABUS_TABLE_COL_ID);
  await truncateCollection(QUESTIONS_TABLE_COL_ID);
  await deleteLegacySyllabusRegistryCollection();

  if (includeIngestions) {
    console.log("    Clearing ai_ingestions (default behavior).");
    await truncateCollection(AI_INGESTIONS_COL_ID);
  } else {
    console.log("    Skipping ai_ingestions (--skip-ingestions flag set).");
  }

  if (clearBucket) {
    console.log("    Clearing generated notes markdown cache buckets (--clear-bucket flag set).");
    for (const bucketId of NOTES_MARKDOWN_BUCKETS_TO_CLEAR) {
      await emptyBucket(bucketId);
    }
  } else {
    console.log("    Skipping notes markdown cache bucket cleanup (default behavior).");
  }

  console.log("✅  Soft reset complete.");
  console.log("Next steps:");
  console.log("1) Re-ingest markdown files following docs/MASTER_SYLLABUS_ENTRY.md or docs/MASTER_QUESTION_ENTRY.md.");
  console.log("   Be sure to include paper metadata (`paper_code`, `paper_type`, and title fields) in frontmatter.");
  console.log("2) Upload files via the Admin → MD Ingest panel or POST /api/admin/ingest-md.");
}

const includeIngestions = !process.argv.includes("--skip-ingestions");
const clearBucket = process.argv.includes("--clear-bucket");

softReset(includeIngestions, clearBucket).catch((error) => {
  console.error("[soft-reset] failed:", error);
  process.exitCode = 1;
});
