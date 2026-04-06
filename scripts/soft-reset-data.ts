/**
 * Soft reset: clears all rows from Syllabus_Table, Questions_Table, and ai_ingestions
 * without dropping or recreating any collection or bucket. Also deletes legacy
 * syllabus_registry collection if it still exists.
 *
 * Use this when you want to re-ingest fresh markdown files without losing the
 * collection schemas, indexes, or the md-ingestion storage bucket.
 *
 * Usage:
 *   npx tsx scripts/soft-reset-data.ts
 *   npx tsx scripts/soft-reset-data.ts --skip-ingestions
 *
 * Environment variables required:
 *   APPWRITE_API_KEY and either:
 *   - APPWRITE_ENDPOINT + APPWRITE_PROJECT_ID
 *   - NEXT_PUBLIC_APPWRITE_ENDPOINT + NEXT_PUBLIC_APPWRITE_PROJECT_ID
 */

import { Client, Databases, Query } from "node-appwrite";
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

const DB_ID = "examarchive";
const SYLLABUS_TABLE_COL_ID = "Syllabus_Table";
const QUESTIONS_TABLE_COL_ID = "Questions_Table";
const AI_INGESTIONS_COL_ID = "ai_ingestions";
const SYLLABUS_REGISTRY_COL_ID = "syllabus_registry";
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
  let hitIterationLimit = false;
  for (let iteration = 0; iteration < MAX_TRUNCATION_ITERATIONS; iteration++) {
    const list = await databases.listDocuments(DB_ID, collectionId, [Query.limit(LIST_PAGE_LIMIT)]);
    if (!Array.isArray(list.documents) || list.documents.length === 0) {
      break;
    }
    await Promise.all(
      list.documents.map((doc) => databases.deleteDocument(DB_ID, collectionId, doc.$id)),
    );
    deleted += list.documents.length;
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
  if (deleted > 0) {
    const remaining = await databases.listDocuments(DB_ID, collectionId, [Query.limit(1)]);
    if (remaining.total > 0) {
      console.warn(
        `[soft-reset] ${collectionId} still has ${remaining.total} doc(s) after capped truncation loop`,
      );
    }
  }
  console.log(`[soft-reset] truncated ${collectionId}: ${deleted} doc(s) removed`);
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

async function softReset(includeIngestions: boolean): Promise<void> {
  console.log("🗑️  SOFT RESET: clearing Syllabus_Table and Questions_Table rows…");
  console.log("    Collection schemas and storage buckets are preserved.");

  await truncateCollection(SYLLABUS_TABLE_COL_ID);
  await truncateCollection(QUESTIONS_TABLE_COL_ID);
  await deleteLegacySyllabusRegistryCollection();

  if (includeIngestions) {
    console.log("    Also clearing ai_ingestions (default behavior).");
    await truncateCollection(AI_INGESTIONS_COL_ID);
  } else {
    console.log("    Skipping ai_ingestions (--skip-ingestions flag set).");
  }

  console.log("✅  Soft reset complete.");
  console.log("Next steps:");
  console.log("1) Re-ingest markdown files following the DEMO_DATA_ENTRY.md format.");
  console.log("   Be sure to include the `subject` field in every file's frontmatter.");
  console.log("2) Upload files via the Admin → MD Ingest panel or POST /api/admin/ingest-md.");
}

const includeIngestions = !process.argv.includes("--skip-ingestions");
softReset(includeIngestions).catch((error) => {
  console.error("[soft-reset] failed:", error);
  process.exitCode = 1;
});
