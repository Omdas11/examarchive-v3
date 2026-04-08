import { Client, Databases, Query, Storage } from "node-appwrite";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(path.resolve(__dirname, ".."));

const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT!)
  .setProject(process.env.APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);
const storage = new Storage(client);
const DB_ID = "examarchive";
const AI_INGESTIONS_COL_ID = "ai_ingestions";
const SYLLABUS_TABLE_COL_ID = "Syllabus_Table";
const QUESTIONS_TABLE_COL_ID = "Questions_Table";
const SYLLABUS_REGISTRY_COL_ID = "syllabus_registry";
const MD_BUCKET_ID = "examarchive-md-ingestion";
const LIST_PAGE_LIMIT = 100;
const APPWRITE_PROPAGATION_DELAY_MS = Number(process.env.APPWRITE_PROPAGATION_DELAY_MS || 1500);
const MAX_TRUNCATION_ITERATIONS = 1000;

type IngestionAttribute =
  | { key: string; type: "string"; size: number; required: boolean }
  | { key: string; type: "integer"; required: boolean }
  | { key: string; type: "datetime"; required: boolean };

const INGESTION_ATTRIBUTES: IngestionAttribute[] = [
  { key: "paper_code", type: "string", size: 256, required: false },
  { key: "source_label", type: "string", size: 256, required: false },
  { key: "file_id", type: "string", size: 64, required: false },
  { key: "file_url", type: "string", size: 2048, required: false },
  { key: "status", type: "string", size: 32, required: false },
  { key: "model", type: "string", size: 64, required: false },
  { key: "characters_ingested", type: "integer", required: false },
  { key: "digest", type: "string", size: 8192, required: false },
  // ── Syllabus-tracker fields ───────────────────────────────────────────
  { key: "paper_name", type: "string", size: 255, required: false },
  { key: "ingested_at", type: "datetime", required: false },
  { key: "row_count", type: "integer", required: false },
  { key: "error_summary", type: "string", size: 2000, required: false },
  { key: "subject", type: "string", size: 128, required: false },
  { key: "dept_code", type: "string", size: 16, required: false },
];

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

async function createIngestionAttribute(attribute: IngestionAttribute) {
  if (attribute.type === "string") {
    await databases.createStringAttribute(DB_ID, AI_INGESTIONS_COL_ID, attribute.key, attribute.size, attribute.required);
    return;
  }
  if (attribute.type === "datetime") {
    await databases.createDatetimeAttribute(DB_ID, AI_INGESTIONS_COL_ID, attribute.key, attribute.required);
    return;
  }
  await databases.createIntegerAttribute(DB_ID, AI_INGESTIONS_COL_ID, attribute.key, attribute.required);
}

async function truncateCollection(collectionId: string) {
  try {
    await databases.getCollection(DB_ID, collectionId);
  } catch (error) {
    if (isNotFoundError(error)) {
      console.log(`[hard-reset-ingestion] skip ${collectionId}: collection not found`);
      return;
    }
    throw error;
  }

  let deleted = 0;
  let hitIterationLimit = true;
  for (let iteration = 0; iteration < MAX_TRUNCATION_ITERATIONS; iteration++) {
    const list = await databases.listDocuments(DB_ID, collectionId, [Query.limit(LIST_PAGE_LIMIT)]);
    if (!Array.isArray(list.documents) || list.documents.length === 0) {
      hitIterationLimit = false;
      break;
    }
    await Promise.all(list.documents.map((doc) => databases.deleteDocument(DB_ID, collectionId, doc.$id)));
    deleted += list.documents.length;
    if (list.documents.length < LIST_PAGE_LIMIT) {
      hitIterationLimit = false;
      break;
    }
  }
  if (hitIterationLimit) {
    console.warn(`[hard-reset-ingestion] ${collectionId} truncation hit iteration cap (${MAX_TRUNCATION_ITERATIONS})`);
  }
  if (deleted > 0) {
    const remaining = await databases.listDocuments(DB_ID, collectionId, [Query.limit(1)]);
    if (remaining.total > 0) {
      console.warn(`[hard-reset-ingestion] ${collectionId} still has ${remaining.total} doc(s) after capped truncation loop`);
    }
  }
  console.log(`[hard-reset-ingestion] truncated ${collectionId}: ${deleted} doc(s) removed`);
}

async function truncateBucket(bucketId: string) {
  try {
    await storage.getBucket(bucketId);
  } catch (error) {
    if (isNotFoundError(error)) {
      console.log(`[hard-reset-ingestion] skip bucket ${bucketId}: bucket not found`);
      return;
    }
    throw error;
  }

  let deleted = 0;
  let hitIterationLimit = true;
  for (let iteration = 0; iteration < MAX_TRUNCATION_ITERATIONS; iteration++) {
    const list = await storage.listFiles(bucketId, [Query.limit(LIST_PAGE_LIMIT)]);
    if (!Array.isArray(list.files) || list.files.length === 0) {
      hitIterationLimit = false;
      break;
    }
    await Promise.all(list.files.map((file) => storage.deleteFile(bucketId, file.$id)));
    deleted += list.files.length;
    if (list.files.length < LIST_PAGE_LIMIT) {
      hitIterationLimit = false;
      break;
    }
  }
  if (hitIterationLimit) {
    console.warn(`[hard-reset-ingestion] bucket ${bucketId} truncation hit iteration cap (${MAX_TRUNCATION_ITERATIONS})`);
  }
  if (deleted > 0) {
    const remaining = await storage.listFiles(bucketId, [Query.limit(1)]);
    if (remaining.total > 0) {
      console.warn(`[hard-reset-ingestion] bucket ${bucketId} still has ${remaining.total} file(s) after capped truncation loop`);
    }
  }
  console.log(`[hard-reset-ingestion] truncated bucket ${bucketId}: ${deleted} file(s) removed`);
}

async function recreateIngestionCollection() {
  try {
    await databases.deleteCollection(DB_ID, AI_INGESTIONS_COL_ID);
    console.log(`[hard-reset-ingestion] deleted collection ${AI_INGESTIONS_COL_ID}`);
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
    console.log(`[hard-reset-ingestion] collection ${AI_INGESTIONS_COL_ID} not found, recreating fresh`);
  }

  await new Promise((resolve) => setTimeout(resolve, APPWRITE_PROPAGATION_DELAY_MS));
  const recreated = await databases.createCollection(DB_ID, AI_INGESTIONS_COL_ID, "AI Ingestions");
  console.log(`[hard-reset-ingestion] recreated collection ${recreated.$id}`);

  for (const attribute of INGESTION_ATTRIBUTES) {
    await createIngestionAttribute(attribute);
  }
  console.log(`[hard-reset-ingestion] recreated ${INGESTION_ATTRIBUTES.length} ai_ingestions attributes`);
}

async function recreateMdIngestionBucket() {
  try {
    await storage.deleteBucket(MD_BUCKET_ID);
    console.log(`[hard-reset-ingestion] deleted bucket ${MD_BUCKET_ID}`);
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
    console.log(`[hard-reset-ingestion] bucket ${MD_BUCKET_ID} not found, recreating fresh`);
  }

  await new Promise((resolve) => setTimeout(resolve, APPWRITE_PROPAGATION_DELAY_MS));
  const recreated = await storage.createBucket(MD_BUCKET_ID, "MD Ingestion Cache");
  console.log(`[hard-reset-ingestion] recreated bucket ${recreated.$id}`);
}

async function deleteLegacySyllabusRegistryCollection() {
  try {
    await databases.deleteCollection(DB_ID, SYLLABUS_REGISTRY_COL_ID);
    console.log(`[hard-reset-ingestion] deleted legacy collection ${SYLLABUS_REGISTRY_COL_ID}`);
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
    console.log(`[hard-reset-ingestion] legacy collection ${SYLLABUS_REGISTRY_COL_ID} already absent`);
  }
}

async function hardReset() {
  console.log("☢️ INITIATING FULL AI INGESTION PIPELINE RESET ☢️");

  await truncateCollection(SYLLABUS_TABLE_COL_ID);
  await truncateCollection(QUESTIONS_TABLE_COL_ID);
  await deleteLegacySyllabusRegistryCollection();

  await recreateIngestionCollection();
  await recreateMdIngestionBucket();

  console.log("🎉 RESET COMPLETE.");
  console.log("Next steps:");
  console.log("1) Re-ingest markdown files using docs/MASTER_SYLLABUS_ENTRY.md and docs/MASTER_QUESTION_ENTRY.md formats.");
  console.log("2) Validate AI Content tabs: units should work when syllabus exists, solved papers only when question-year rows exist.");
}

hardReset().catch((error) => {
  console.error("[hard-reset-ingestion] reset failed:", error);
  process.exitCode = 1;
});
