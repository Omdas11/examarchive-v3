/**
 * Soft reset utility for launch/data cleanup.
 * - Base reset clears Syllabus_Table and Questions_Table.
 * - Optional launch reset additionally clears launch-facing collections and
 *   resets users/site metrics counters back to zero.
 * - Optional bucket cleanup clears generated markdown cache buckets.
 *
 * Usage:
 * npx tsx scripts/soft-reset-data.ts
 * npx tsx scripts/soft-reset-data.ts --skip-ingestions --clear-bucket
 * npx tsx scripts/soft-reset-data.ts --launch-reset --clear-bucket
 *
 * Environment variables required:
 * APPWRITE_API_KEY and either:
 * - APPWRITE_ENDPOINT + APPWRITE_PROJECT_ID
 * - NEXT_PUBLIC_APPWRITE_ENDPOINT + NEXT_PUBLIC_APPWRITE_PROJECT_ID
 */

import { Client, Databases, Storage, Query, IndexType, OrderBy } from "node-appwrite";
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
const PAPERS_COL_ID = "papers";
const SYLLABUS_COL_ID = "syllabus";
const UPLOADS_COL_ID = "uploads";
const AI_USAGE_COL_ID = "ai_usage";
const PDF_USAGE_COL_ID = "pdf_usage";
const AI_EMBEDDINGS_COL_ID = "ai_embeddings";
const GENERATED_NOTES_CACHE_COL_ID = "Generated_Notes_Cache";
const AI_FLASHCARDS_COL_ID = "ai_flashcards";
const AI_CACHE_INDEX_COL_ID = "ai_cache_index";
const PURCHASES_COL_ID = "purchases";
const USER_PASSES_COL_ID = "user_passes";
const USERS_COL_ID = "users";
const SITE_METRICS_COL_ID = "site_metrics";
const SITE_METRICS_DOC_ID = "singleton";
const PAPERS_BUCKET_ID = process.env.APPWRITE_BUCKET_ID || "papers";
const GHOST_NOTES_BUCKET_ID = "cached-unit-notes";
const NOTES_MARKDOWN_BUCKETS_TO_CLEAR = [
  GHOST_NOTES_BUCKET_ID,
  "cached-solved-papers",
];
const PROTECTED_GHOST_JOB_TYPE_PATTERNS = ["syllabus", "question", "solved-paper"];
const TARGET_GHOST_JOB_TYPES = ["notes", "unknown"];
const LIST_PAGE_LIMIT = 100;
const MAX_TRUNCATION_ITERATIONS = 1000;
const DELETE_THROTTLE_MS = 20;
const GHOST_CLEANUP_MAX_NO_PROGRESS_ITERATIONS = 3;
const BASE_RESET_COLLECTIONS = [SYLLABUS_TABLE_COL_ID, QUESTIONS_TABLE_COL_ID];
const LAUNCH_RESET_COLLECTIONS = [
  PAPERS_COL_ID,
  SYLLABUS_COL_ID,
  UPLOADS_COL_ID,
  AI_USAGE_COL_ID,
  PDF_USAGE_COL_ID,
  AI_EMBEDDINGS_COL_ID,
  GENERATED_NOTES_CACHE_COL_ID,
  AI_FLASHCARDS_COL_ID,
  AI_CACHE_INDEX_COL_ID,
  PURCHASES_COL_ID,
  USER_PASSES_COL_ID,
  AI_GENERATION_JOBS_COL_ID,
];
const USER_COUNTER_FIELDS = [
  "upload_count",
  "view_count",
  "download_count",
  "xo",
  "xp",
  "streak",
  "streak_days",
  "ai_credits",
  "referred_users_count",
] as const;
const DEFAULT_SITE_LAUNCH_PROGRESS = 40;
const DEFAULT_INDEX_BUILD_WAIT_MS = 3000;
const parsedIndexBuildWaitMs = Number(
  process.env.SOFT_RESET_INDEX_BUILD_WAIT_MS || String(DEFAULT_INDEX_BUILD_WAIT_MS),
);
const INDEX_BUILD_WAIT_MS = Number.isFinite(parsedIndexBuildWaitMs) && parsedIndexBuildWaitMs >= 0
  ? parsedIndexBuildWaitMs
  : DEFAULT_INDEX_BUILD_WAIT_MS;

function isNotFoundError(error: unknown): boolean {
  const maybeError = error as {
    code?: number;
    type?: string;
    message?: string;
    response?: { code?: number; type?: string; message?: string };
  };
  const code = maybeError?.code ?? maybeError?.response?.code;
  const type = maybeError?.type ?? maybeError?.response?.type ?? "";
  const message = String(maybeError?.message ?? "");
  const responseMessage = String(maybeError?.response?.message ?? "");
  return (
    code === 404 ||
    /not found/i.test(message) ||
    /not found/i.test(responseMessage) ||
    /_not_found$/.test(type)
  );
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
      await new Promise(resolve => setTimeout(resolve, DELETE_THROTTLE_MS));
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
      await new Promise(resolve => setTimeout(resolve, DELETE_THROTTLE_MS));
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

async function truncateCollections(collectionIds: readonly string[]): Promise<void> {
  for (const collectionId of collectionIds) {
    await truncateCollection(collectionId);
  }
}

async function resetUserCountersToZero(): Promise<void> {
  try {
    await databases.getCollection(DB_ID, USERS_COL_ID);
  } catch (error) {
    if (isNotFoundError(error)) {
      console.log(`[soft-reset] skip ${USERS_COL_ID}: collection not found`);
      return;
    }
    throw error;
  }

  let lastId: string | null = null;
  let updated = 0;
  let failed = 0;

  for (let iteration = 0; iteration < MAX_TRUNCATION_ITERATIONS; iteration++) {
    const queries = [
      Query.limit(LIST_PAGE_LIMIT),
      Query.orderAsc("$id"),
    ];
    if (lastId) {
      queries.push(Query.cursorAfter(lastId));
    }
    const page = await databases.listDocuments(DB_ID, USERS_COL_ID, queries);
    if (!Array.isArray(page.documents) || page.documents.length === 0) {
      break;
    }

    for (const doc of page.documents) {
      const update: Record<string, unknown> = {};
      for (const key of USER_COUNTER_FIELDS) {
        if (key in doc) update[key] = 0;
      }
      if ("last_activity" in doc) {
        update.last_activity = null;
      }
      if (Object.keys(update).length === 0) continue;
      try {
        await databases.updateDocument(DB_ID, USERS_COL_ID, doc.$id, update);
        updated++;
      } catch (error) {
        failed++;
        console.error(`[soft-reset] Failed to zero counters for user ${doc.$id}:`, error);
      }
      await new Promise((resolve) => setTimeout(resolve, DELETE_THROTTLE_MS));
    }

    lastId = page.documents[page.documents.length - 1].$id;
    if (page.documents.length < LIST_PAGE_LIMIT) break;
  }

  if (failed > 0) {
    console.warn(`[soft-reset] reset user counters completed with ${failed} failed profile update(s).`);
  }
  console.log(`[soft-reset] reset counters to zero for ${updated} user profile(s).`);
}

async function resetSiteMetricsToZero(): Promise<void> {
  try {
    await databases.getCollection(DB_ID, SITE_METRICS_COL_ID);
  } catch (error) {
    if (isNotFoundError(error)) {
      console.log(`[soft-reset] skip ${SITE_METRICS_COL_ID}: collection not found`);
      return;
    }
    throw error;
  }

  const payload = {
    visitor_count: 0,
  };

  try {
    await databases.updateDocument(DB_ID, SITE_METRICS_COL_ID, SITE_METRICS_DOC_ID, payload);
    console.log("[soft-reset] reset site_metrics visitor_count to zero and preserved launch_progress.");
  } catch (error) {
    if (isNotFoundError(error)) {
      await databases.createDocument(DB_ID, SITE_METRICS_COL_ID, SITE_METRICS_DOC_ID, {
        ...payload,
        launch_progress: DEFAULT_SITE_LAUNCH_PROGRESS,
      });
      console.log("[soft-reset] created site_metrics singleton with default launch_progress.");
      return;
    }
    throw error;
  }
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

async function ensureAiGenerationJobIndexes(): Promise<"created" | "exists" | "missing_collection"> {
  try {
    await databases.getCollection(DB_ID, AI_GENERATION_JOBS_COL_ID);
  } catch (error) {
    if (isNotFoundError(error)) {
      console.log(
        `[soft-reset] skip index bootstrap and ghost-cache cleanup: ${AI_GENERATION_JOBS_COL_ID} collection not found`,
      );
      return "missing_collection";
    }
    throw error;
  }

  let createdAny = false;
  const indexes = [
    { key: "unit_number_idx", attributes: ["unit_number"] },
    { key: "result_file_id_idx", attributes: ["result_file_id"] },
  ];

  for (const index of indexes) {
    try {
      await databases.createIndex(
        DB_ID,
        AI_GENERATION_JOBS_COL_ID,
        index.key,
        IndexType.Key,
        index.attributes as string[],
        [OrderBy.Asc],
      );
      createdAny = true;
      console.log(`[soft-reset] created index ${index.key} on ${AI_GENERATION_JOBS_COL_ID}.`);
    } catch (error) {
      if (isConflictError(error)) {
        console.log(`[soft-reset] index ${index.key} already exists on ${AI_GENERATION_JOBS_COL_ID}.`);
        continue;
      }
      throw error;
    }
  }

  return createdAny ? "created" : "exists";
}

async function cleanupGhostCacheRecords(): Promise<void> {
  let deletedDocs = 0;
  let deletedFiles = 0;
  let failedDocs = 0;
  let failedFiles = 0;
  let hitIterationLimit = false;
  let noProgressIterations = 0;

  for (let iteration = 0; iteration < MAX_TRUNCATION_ITERATIONS; iteration++) {
    const deletedDocsBeforeIteration = deletedDocs;
    const response = await databases.listDocuments(DB_ID, AI_GENERATION_JOBS_COL_ID, [
      Query.select(["$id", "result_file_id", "input_payload_json"]),
      Query.limit(LIST_PAGE_LIMIT),
    ]);

    if (!Array.isArray(response.documents) || response.documents.length === 0) {
      break;
    }

    for (const doc of response.documents) {
      let jobType = "unknown";

      try {
        const inputPayloadJson = String((doc as { input_payload_json?: string }).input_payload_json || "").trim();
        if (inputPayloadJson) {
          const payload = JSON.parse(inputPayloadJson) as { jobType?: unknown };
          const payloadJobType = typeof payload.jobType === "string" ? payload.jobType.trim() : "";
          jobType = payloadJobType.length > 0 ? payloadJobType : "unknown";
        }
      } catch {
        // Unparseable JSON defaults to "unknown" ghost
      }

      const normalizedJobType = jobType.toLowerCase();
      const isProtectedData = PROTECTED_GHOST_JOB_TYPE_PATTERNS.some((pattern) =>
        normalizedJobType.includes(pattern),
      );
      const isTargetGhost = !isProtectedData && TARGET_GHOST_JOB_TYPES.includes(normalizedJobType);

      if (isTargetGhost) {
        console.log(`[soft-reset] [DESTROYING] Notes/Ghost job: ${doc.$id} (Type: ${jobType})`);

        const resultFileId = String((doc as { result_file_id?: string }).result_file_id || "").trim();
        if (resultFileId) {
          try {
            await storage.deleteFile(GHOST_NOTES_BUCKET_ID, resultFileId);
            deletedFiles++;
          } catch (error) {
            if (!isNotFoundError(error)) {
              console.error("[soft-reset] Failed to delete file from notes cache bucket.", {
                bucketId: GHOST_NOTES_BUCKET_ID,
                fileId: resultFileId,
                error,
              });
              failedFiles++;
            }
          }
        }

        try {
          await databases.deleteDocument(DB_ID, AI_GENERATION_JOBS_COL_ID, doc.$id);
          deletedDocs++;
        } catch (error) {
          console.error("[soft-reset] Failed to delete ghost cache document.", {
            collectionId: AI_GENERATION_JOBS_COL_ID,
            documentId: doc.$id,
            error,
          });
          failedDocs++;
        }
      } else {
        console.log(`[soft-reset] [PROTECTED] Kept ${jobType} data: ${doc.$id}`);
      }

      await new Promise((resolve) => setTimeout(resolve, DELETE_THROTTLE_MS));
    }

    if (response.documents.length < LIST_PAGE_LIMIT) {
      break;
    }
    if (deletedDocs === deletedDocsBeforeIteration) {
      noProgressIterations++;
      if (noProgressIterations >= GHOST_CLEANUP_MAX_NO_PROGRESS_ITERATIONS) {
        console.warn(
          `[soft-reset] ghost cache cleanup had no document deletion progress for ${GHOST_CLEANUP_MAX_NO_PROGRESS_ITERATIONS} iteration(s); stopping early`,
        );
        break;
      }
    } else {
      noProgressIterations = 0;
    }
    if (iteration === MAX_TRUNCATION_ITERATIONS - 1) {
      hitIterationLimit = true;
    }
  }

  if (hitIterationLimit) {
    console.warn(
      `[soft-reset] ${AI_GENERATION_JOBS_COL_ID} ghost-cache cleanup hit iteration cap (${MAX_TRUNCATION_ITERATIONS})`,
    );
  }

  console.log(
    `[soft-reset] ghost cache cleanup complete. Docs deleted: ${deletedDocs}, file(s) deleted: ${deletedFiles}, doc failures: ${failedDocs}, file failures: ${failedFiles}.`,
  );
}

async function softReset(includeIngestions: boolean, clearBucket: boolean, launchReset: boolean): Promise<void> {
  const indexState = await ensureAiGenerationJobIndexes();
  if (indexState === "created") {
    await new Promise((resolve) => setTimeout(resolve, INDEX_BUILD_WAIT_MS));
  }

  if (indexState !== "missing_collection") {
    await cleanupGhostCacheRecords();
  }

  await deleteLegacySyllabusRegistryCollection();

  console.log("    Clearing canonical ingestion tables.");
  await truncateCollections(BASE_RESET_COLLECTIONS);

  if (launchReset) {
    console.log("    Launch reset enabled: clearing launch-facing collections and zeroing counters.");
    await truncateCollections(LAUNCH_RESET_COLLECTIONS);
    await resetUserCountersToZero();
    await resetSiteMetricsToZero();
  } else {
    console.log("    Launch reset not requested (pass --launch-reset to clear launch-facing collections/counters).");
  }

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
  if (launchReset) {
    console.log("All configured launch counters and launch-facing collections were reset to zero/empty state.");
  } else {
    console.log("Next steps:");
    console.log("1) Re-ingest markdown files following docs/MASTER_SYLLABUS_ENTRY.md or docs/MASTER_QUESTION_ENTRY.md.");
    console.log("   Be sure to include paper metadata (`paper_code`, `paper_type`, and title fields) in frontmatter.");
    console.log("2) Upload files via the Admin → MD Ingest panel or POST /api/admin/ingest-md.");
  }
}

const includeIngestions = !process.argv.includes("--skip-ingestions");
const clearBucket = process.argv.includes("--clear-bucket");
const launchReset = process.argv.includes("--launch-reset");

softReset(includeIngestions, clearBucket, launchReset).catch((error) => {
  console.error("[soft-reset] failed:", error);
  process.exitCode = 1;
});
