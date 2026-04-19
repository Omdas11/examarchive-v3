#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { loadEnvConfig } from "@next/env";
import { Client, Databases, Query, Storage } from "node-appwrite";

const require = createRequire(import.meta.url);
type BucketSpec = {
  id: string;
  name: string;
};

type SyncResourceResult = {
  kind: "bucket" | "database" | "collection";
  name: string;
  id: string;
  status: "created" | "exists";
};

type ExpectedAttribute = {
  name: string;
  typeRaw: string;
  required: boolean;
  baseType: string;
  isArray: boolean;
  stringLength?: number;
};

type ExpectedCollectionSchema = {
  name: string;
  attributes: ExpectedAttribute[];
};

type LiveCollection = {
  $id: string;
  name: string;
};

type LiveBucket = {
  $id: string;
  name: string;
};

type LiveAttribute = {
  key: string;
  type: string;
  required: boolean;
  array?: boolean;
  size?: number;
};

const SCHEMA_STATUS_START_TAG = "<!-- SCHEMA_SYNC_STATUS_START -->";
const SCHEMA_STATUS_END_TAG = "<!-- SCHEMA_SYNC_STATUS_END -->";
const REQUIRED_BUCKETS: BucketSpec[] = [
  { id: "papers", name: "papers" },
  { id: "examarchive-syllabus-md-ingestion", name: "examarchive-syllabus-md-ingestion" },
  { id: "examarchive_question_ingest_assets", name: "examarchive_question_ingest_assets" },
  { id: "syllabus-files", name: "syllabus-files" },
  { id: "avatars", name: "avatars" },
  { id: "generated-md-cache", name: "generated-md-cache" },
  { id: "cached-unit-notes", name: "cached-unit-notes" },
  { id: "cached-solved-papers", name: "cached-solved-papers" },
];
const LEGACY_BUCKET_IDS = new Set([
  "examarchive-md-ingestion",
  "examarchive-question-ingestion-assets",
  // Transitional bucket id used during a short-lived migration attempt; keep for cleanup safety.
  "examarchive-question-ingestion-asset",
]);

const TARGET_DATABASE_ID = "examarchive";
const TARGET_DATABASE_NAME = "ExamArchive";

/**
 * Fallback collection list used when the schema modules cannot be loaded.
 * Covers the most critical runtime collections so the app can start up.
 */
const FALLBACK_COLLECTION_SPECS: Array<{ id: string; name: string }> = [
  { id: "ai_generation_jobs", name: "ai_generation_jobs" },
  { id: "Syllabus_Table", name: "Syllabus_Table" },
  { id: "Questions_Table", name: "Questions_Table" },
  { id: "Generated_Notes_Cache", name: "Generated_Notes_Cache" },
  { id: "ai_cache_index", name: "ai_cache_index" },
  { id: "User_Quotas", name: "User_Quotas" },
  { id: "papers", name: "papers" },
  { id: "users", name: "users" },
  { id: "uploads", name: "uploads" },
  { id: "ai_flashcards", name: "ai_flashcards" },
  { id: "ai_ingestions", name: "ai_ingestions" },
];

function loadAppwriteEnv() {
  loadEnvConfig(path.resolve(__dirname, "../.."));

  const endpoint = process.env.APPWRITE_ENDPOINT || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!endpoint || !projectId || !apiKey) {
    throw new Error(
      "Missing required Appwrite env vars. Ensure APPWRITE_API_KEY and endpoint/project values are set " +
        "(APPWRITE_ENDPOINT + APPWRITE_PROJECT_ID or NEXT_PUBLIC_APPWRITE_ENDPOINT + NEXT_PUBLIC_APPWRITE_PROJECT_ID).",
    );
  }

  return { endpoint, projectId, apiKey };
}

type CollectionAttributeDef = {
  key: string;
  type: string;
  required: boolean;
  size?: number;
  array?: boolean;
  min?: number;
  max?: number;
  default?: unknown;
};

type CollectionDef = {
  id: string;
  name: string;
  attributes: CollectionAttributeDef[];
};

type AttributeSyncResult = {
  collectionId: string;
  createdCollection: boolean;
  createdAttributes: number;
  totalTargetAttributes: number;
  connected: boolean;
  attributeLimitExceeded: boolean;
};

/**
 * Imports the syncCollection function from sync-appwrite-schema.js and
 * sync-appwrite-ai.js and calls them to create missing attributes for all
 * known collections. This makes `npm run appwrite:sync` a single comprehensive
 * command that creates the database, buckets, collections, AND their attributes.
 */
async function syncAllCollectionAttributes(databases: Databases): Promise<AttributeSyncResult[]> {
  let syncSchemaCollection: (databases: Databases, databaseId: string, collection: CollectionDef) => Promise<AttributeSyncResult>;
  let targetSchema: CollectionDef[];
  let syncAiCollection: (databases: Databases, collection: CollectionDef) => Promise<AttributeSyncResult>;
  let aiCollections: CollectionDef[];
  try {
    const schemaModule = require("./sync-appwrite-schema") as {
      syncCollection: (databases: Databases, databaseId: string, collection: CollectionDef) => Promise<AttributeSyncResult>;
      TARGET_SCHEMA: CollectionDef[];
    };
    const aiModule = require("./sync-appwrite-ai") as {
      syncCollection: (databases: Databases, collection: CollectionDef) => Promise<AttributeSyncResult>;
      AI_COLLECTIONS: CollectionDef[];
    };
    syncSchemaCollection = schemaModule.syncCollection;
    targetSchema = schemaModule.TARGET_SCHEMA;
    syncAiCollection = aiModule.syncCollection;
    aiCollections = aiModule.AI_COLLECTIONS;
  } catch (error) {
    console.warn("⚠️ Skipping attribute sync because schema modules could not be loaded.", {
      message: error instanceof Error ? error.message : String(error),
    });
    return [];
  }

  const results: AttributeSyncResult[] = [];

  console.log("\n--- Syncing standard collection attributes ---");
  for (const collection of targetSchema) {
    results.push(await syncSchemaCollection(databases, TARGET_DATABASE_ID, collection));
  }

  console.log("\n--- Syncing AI collection attributes ---");
  for (const collection of aiCollections) {
    results.push(await syncAiCollection(databases, collection));
  }

  return results;
}

function isNotFoundError(error: unknown): boolean {
  const maybeError = error as { code?: number; response?: { code?: number }; message?: string };
  const code = maybeError?.code ?? maybeError?.response?.code;
  return code === 404 || /not found/i.test(String(maybeError?.message ?? ""));
}

function createClients() {
  const { endpoint, projectId, apiKey } = loadAppwriteEnv();
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  return {
    storage: new Storage(client),
    databases: new Databases(client),
  };
}

async function ensureBucket(storage: Storage, bucket: BucketSpec): Promise<SyncResourceResult> {
  try {
    await storage.getBucket({ bucketId: bucket.id });
    console.log(`[exists] bucket ${bucket.name} (${bucket.id})`);
    return { kind: "bucket", name: bucket.name, id: bucket.id, status: "exists" };
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }

  const created = await storage.createBucket({
    bucketId: bucket.id,
    name: bucket.name,
    permissions: [],
    fileSecurity: false,
    enabled: true,
  });

  console.log(`[create] bucket ${bucket.name} (${created.$id})`);
  return { kind: "bucket", name: bucket.name, id: created.$id, status: "created" };
}

async function ensureDatabase(databases: Databases, databaseId: string, databaseName: string): Promise<SyncResourceResult> {
  try {
    const existing = await databases.get(databaseId);
    console.log(`[exists] database ${databaseName} (${existing.$id})`);
    return { kind: "database", name: databaseName, id: existing.$id, status: "exists" };
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }

  const created = await databases.create(databaseId, databaseName);
  console.log(`[create] database ${databaseName} (${created.$id})`);
  return { kind: "database", name: databaseName, id: created.$id, status: "created" };
}

async function ensureCollection(
  databases: Databases,
  databaseId: string,
  collectionId: string,
  collectionName: string,
): Promise<SyncResourceResult> {
  try {
    const existing = await databases.getCollection(databaseId, collectionId);
    console.log(`[exists] collection ${collectionId} (${existing.$id})`);
    return { kind: "collection", name: collectionId, id: existing.$id, status: "exists" };
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }

  const created = await databases.createCollection(databaseId, collectionId, collectionName);
  console.log(`[create] collection ${collectionId} (${created.$id})`);
  return { kind: "collection", name: collectionId, id: created.$id, status: "created" };
}

async function listCollections(databases: Databases, databaseId: string): Promise<Array<{ id: string; name: string }>> {
  const response = await databases.listCollections(databaseId);
  return response.collections.map((collection) => ({ id: collection.$id, name: collection.name }));
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/`/g, "\\`");
}

function parseExpectedBaseType(typeRaw: string): string {
  const normalized = typeRaw.toLowerCase().trim();
  if (normalized.includes("datetime")) return "datetime";
  if (normalized.includes("boolean")) return "boolean";
  if (normalized.includes("integer")) return "integer";
  if (normalized.includes("float") || normalized.includes("double") || normalized.includes("number")) return "double";
  if (normalized.includes("string")) return "string";
  if (normalized.includes("array")) return "string";
  return normalized;
}

function parseExpectedStringLength(typeRaw: string): number | undefined {
  const match = typeRaw.match(/string\s*(?:\(|\[)\s*(\d+)\s*(?:\)|\])/i);
  if (!match) {
    return undefined;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseExpectedCollectionsFromDoc(docContent: string): ExpectedCollectionSchema[] {
  const collectionMatches = [...docContent.matchAll(/## Collection: `([^`]+)`\s*([\s\S]*?)(?=\n## Collection: `|$)/g)];
  const parsed: ExpectedCollectionSchema[] = [];

  for (const match of collectionMatches) {
    const collectionName = match[1].trim();
    const sectionContent = match[2] ?? "";
    const tableMatch = sectionContent.match(/\|[^\n]*\|\n\|[-:\s|]+\|\n(?:\|[^\n]*\|\n?)*/);
    const tableContent = tableMatch?.[0] ?? "";

    const attributes: ExpectedAttribute[] = [];
    const rows = tableContent.split("\n").filter(Boolean).slice(2);

    for (const row of rows) {
      const cells = row
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());
      if (cells.length < 3) {
        continue;
      }

      const name = cells[0].replace(/^`|`$/g, "").trim();
      const typeRaw = cells[1].trim();
      const requiredRaw = cells[2].replace(/\*/g, "").trim().toLowerCase();
      const isArray = /array|\[\]/i.test(typeRaw);
      attributes.push({
        name,
        typeRaw,
        required: requiredRaw === "yes" || requiredRaw === "true",
        baseType: parseExpectedBaseType(typeRaw),
        isArray,
        stringLength: parseExpectedStringLength(typeRaw),
      });
    }

    parsed.push({
      name: collectionName,
      attributes,
    });
  }

  return parsed;
}

function normalizeLiveBaseType(type: string): string {
  const normalized = type.toLowerCase().trim();
  if (normalized === "float" || normalized === "double" || normalized === "number") return "double";
  return normalized;
}

function attributeTypeMatches(expected: ExpectedAttribute, live: LiveAttribute): boolean {
  const liveBaseType = normalizeLiveBaseType(live.type);
  if (expected.baseType !== liveBaseType) {
    return false;
  }

  const liveIsArray = Boolean(live.array);
  if (expected.isArray !== liveIsArray) {
    return false;
  }

  if (expected.baseType === "string" && typeof expected.stringLength === "number" && typeof live.size === "number") {
    return expected.stringLength === live.size;
  }

  return true;
}

async function fetchLiveCollections(databases: Databases): Promise<LiveCollection[]> {
  const response = await databases.listCollections(TARGET_DATABASE_ID);
  return response.collections.map((collection) => ({ $id: collection.$id, name: collection.name }));
}

function shouldDeleteOrphanBucket(bucketId: string, requiredBucketIds: Set<string>): boolean {
  if (requiredBucketIds.has(bucketId)) {
    return false;
  }
  if (LEGACY_BUCKET_IDS.has(bucketId)) {
    return true;
  }
  // Treat non-required examarchive-prefixed buckets as managed and safe to prune.
  return bucketId.startsWith("examarchive-") || bucketId.startsWith("examarchive_");
}

async function emptyBucket(storage: Storage, bucketId: string): Promise<void> {
  while (true) {
    const list = await storage.listFiles(bucketId, [Query.limit(100)]);
    if (list.files.length === 0) {
      break;
    }
    for (const file of list.files) {
      await storage.deleteFile(bucketId, file.$id);
    }
    if (list.files.length < 100) {
      break;
    }
  }
}

async function cleanupOrphanBuckets(storage: Storage, liveBuckets: LiveBucket[]): Promise<string[]> {
  const requiredBucketIds = new Set(REQUIRED_BUCKETS.map((bucket) => bucket.id));
  const deleted: string[] = [];
  for (const bucket of liveBuckets) {
    if (!shouldDeleteOrphanBucket(bucket.$id, requiredBucketIds)) {
      continue;
    }
    try {
      await storage.deleteBucket(bucket.$id);
    } catch (error) {
      const maybeError = error as { code?: number; response?: { code?: number }; message?: string };
      const code = maybeError?.code ?? maybeError?.response?.code;
      if (code === 409) {
        await emptyBucket(storage, bucket.$id);
        await storage.deleteBucket(bucket.$id);
      } else if (isNotFoundError(error)) {
        continue;
      } else {
        throw error;
      }
    }
    deleted.push(bucket.$id);
    console.log(`[delete] orphan bucket ${bucket.$id}`);
  }
  return deleted;
}

async function cleanupOrphanDatabases(databases: Databases): Promise<string[]> {
  const deleted: string[] = [];
  const response = await databases.list([Query.limit(100)]);
  for (const db of response.databases) {
    if (db.$id === TARGET_DATABASE_ID || (!db.$id.startsWith("examarchive-") && !db.$id.startsWith("examarchive_"))) {
      continue;
    }
    const collections = await databases.listCollections(db.$id, [Query.limit(100)]);
    for (const collection of collections.collections) {
      await databases.deleteCollection(db.$id, collection.$id);
    }
    await databases.delete(db.$id);
    deleted.push(db.$id);
    console.log(`[delete] orphan database ${db.$id}`);
  }
  return deleted;
}

async function fetchLiveAttributes(databases: Databases, collectionId: string): Promise<LiveAttribute[]> {
  const response = await databases.listAttributes(TARGET_DATABASE_ID, collectionId);
  return response.attributes
    .map((attribute): LiveAttribute => ({
      key: attribute.key,
      type: attribute.type,
      required: Boolean(attribute.required),
      array: Boolean(attribute.array),
      size: "size" in attribute && typeof attribute.size === "number" ? attribute.size : undefined,
    }))
    .filter((attribute) => Boolean(attribute.key));
}

function buildSchemaStatusTableFromDiff(input: {
  syncedAt: string;
  liveBuckets: LiveBucket[];
  expectedSchemas: ExpectedCollectionSchema[];
  liveCollections: LiveCollection[];
  perCollection: Array<{
    collectionName: string;
    status: string;
    createdInRun: number;
    notes: string;
  }>;
}): string {
  const { syncedAt, liveBuckets, perCollection } = input;
  let statusTable = "## Schema Sync Status (Auto-generated)\n\n";
  statusTable += `_Last synced: ${syncedAt}_\n\n`;
  statusTable += "### Storage Buckets\n";
  statusTable += "| Bucket | Status | ID |\n";
  statusTable += "|---|---|---|\n";
  if (liveBuckets.length === 0) {
    statusTable += "| N/A | ⚠️ Connected with differences | N/A |\n";
  } else {
    liveBuckets.forEach((bucket) => {
      const safeName = escapeMarkdownTableCell(bucket.name);
      const safeId = escapeMarkdownTableCell(bucket.$id);
      statusTable += `| \`${safeName}\` | ✅ Connected | ${safeId} |\n`;
    });
  }
  statusTable += "\n### Database Collections\n";
  statusTable += "| Collection | Status | Created in run | Notes |\n";
  statusTable += "|---|---|---:|---|\n";

  if (perCollection.length === 0) {
    statusTable += "| N/A | ⚠️ Connected with differences | 0 | No collection schema sections parsed from Markdown |\n";
    return statusTable;
  }

  perCollection.forEach((row) => {
    const safeName = escapeMarkdownTableCell(row.collectionName);
    const safeStatus = escapeMarkdownTableCell(row.status);
    const safeNotes = escapeMarkdownTableCell(row.notes);
    statusTable += `| \`${safeName}\` | ${safeStatus} | ${row.createdInRun} | ${safeNotes} |\n`;
  });

  return statusTable;
}

function injectSchemaStatusIntoDatabaseDoc(statusTable: string) {
  const docPath = path.resolve(__dirname, "../../docs/DATABASE_SCHEMA.md");
  if (!fs.existsSync(docPath)) {
    console.error("docs/DATABASE_SCHEMA.md not found!");
    return;
  }

  const pattern = `${escapeRegex(SCHEMA_STATUS_START_TAG)}[\\s\\S]*?${escapeRegex(SCHEMA_STATUS_END_TAG)}`;
  const regex = new RegExp(pattern);
  const globalRegex = new RegExp(pattern, "g");
  const newBlock = `${SCHEMA_STATUS_START_TAG}\n${statusTable}\n${SCHEMA_STATUS_END_TAG}`;
  const existingContent = fs.readFileSync(docPath, "utf8");
  const hasTags = existingContent.includes(SCHEMA_STATUS_START_TAG) && existingContent.includes(SCHEMA_STATUS_END_TAG);
  let nextContent = `${existingContent}\n\n${newBlock}`;

  if (hasTags) {
    const tagBlockMatches = existingContent.match(globalRegex) ?? [];
    if (tagBlockMatches.length !== 1) {
      throw new Error(
        `Expected exactly one schema status tag block in docs/DATABASE_SCHEMA.md, found ${tagBlockMatches.length}.`,
      );
    }
    nextContent = existingContent.replace(regex, newBlock);
  }

  fs.writeFileSync(docPath, nextContent, "utf8");
  console.log("Successfully injected live status into docs/DATABASE_SCHEMA.md");
}

function deleteLegacySchemaDoc() {
  const oldDocPath = path.resolve(__dirname, "../../docs/launch/v2/APPWRITE_SCHEMA.md");
  if (!fs.existsSync(oldDocPath)) {
    return;
  }

  fs.unlinkSync(oldDocPath);
  console.log("Deleted deprecated docs/launch/v2/APPWRITE_SCHEMA.md");
}

async function syncInfrastructure() {
  const { storage, databases } = createClients();
  const syncedAt = new Date().toISOString();

  // ── Step 1: Ensure all required storage buckets exist ──────────────────
  console.log("\n--- Syncing storage buckets ---");
  const bucketResults: SyncResourceResult[] = [];
  for (const bucket of REQUIRED_BUCKETS) {
    bucketResults.push(await ensureBucket(storage, bucket));
  }

  // ── Step 2: Ensure the primary database exists ─────────────────────────
  console.log("\n--- Syncing database ---");
  const databaseResult = await ensureDatabase(databases, TARGET_DATABASE_ID, TARGET_DATABASE_NAME);

  // ── Step 3: Derive the full collection list from schema modules ─────────
  // This ensures every collection defined in TARGET_SCHEMA (sync-appwrite-schema.js)
  // or AI_COLLECTIONS (sync-appwrite-ai.js) is explicitly created before the
  // attribute-sync pass. The fallback list covers the most critical collections
  // if the schema modules cannot be loaded (e.g. missing deps in CI).
  let requiredCollectionSpecs: Array<{ id: string; name: string }>;
  try {
    const { TARGET_SCHEMA: schemaCollections } = require("./sync-appwrite-schema") as {
      TARGET_SCHEMA: Array<{ id: string; name: string }>;
    };
    const { AI_COLLECTIONS: aiCollections } = require("./sync-appwrite-ai") as {
      AI_COLLECTIONS: Array<{ id: string; name: string }>;
    };
    const seenIds = new Set<string>();
    requiredCollectionSpecs = [];
    for (const collection of [...schemaCollections, ...aiCollections]) {
      if (!seenIds.has(collection.id)) {
        seenIds.add(collection.id);
        requiredCollectionSpecs.push({ id: collection.id, name: collection.name });
      }
    }
    console.log(`\n--- Derived ${requiredCollectionSpecs.length} collections from schema definitions ---`);
  } catch (loadErr) {
    console.warn(
      "[sync] Could not load schema modules; falling back to essential collection list.",
      loadErr instanceof Error ? loadErr.message : String(loadErr),
    );
    requiredCollectionSpecs = FALLBACK_COLLECTION_SPECS;
  }

  // ── Step 4: Ensure all collections exist ───────────────────────────────
  console.log("\n--- Syncing collections ---");
  const requiredCollectionResults: SyncResourceResult[] = [];
  for (const collectionSpec of requiredCollectionSpecs) {
    requiredCollectionResults.push(
      await ensureCollection(databases, TARGET_DATABASE_ID, collectionSpec.id, collectionSpec.name),
    );
  }

  // ── Step 5: Sync all collection attributes ─────────────────────────────
  // syncAllCollectionAttributes creates missing attributes for every collection
  // defined in both schema files.  Collections already created above will not
  // be re-created; only missing attributes are added.
  const attributeSyncResults = await syncAllCollectionAttributes(databases);

  // ── Step 6: Prune orphan databases and buckets ─────────────────────────
  const orphanDatabasesDeleted = await cleanupOrphanDatabases(databases);
  const liveBucketsResponse = await storage.listBuckets([Query.limit(100)]);
  const orphanBucketsDeleted = await cleanupOrphanBuckets(
    storage,
    liveBucketsResponse.buckets.map((bucket) => ({ $id: bucket.$id, name: bucket.name })),
  );
  const liveBucketsAfterCleanup = await storage.listBuckets([Query.limit(100)]);
  const liveBuckets = liveBucketsAfterCleanup.buckets.map((bucket) => ({ $id: bucket.$id, name: bucket.name }));
  const docPath = path.resolve(__dirname, "../../docs/DATABASE_SCHEMA.md");
  const docContent = fs.existsSync(docPath) ? fs.readFileSync(docPath, "utf8") : "";
  const expectedSchemas = parseExpectedCollectionsFromDoc(docContent);
  const liveCollections = await fetchLiveCollections(databases);

  const perCollectionRows: Array<{ collectionName: string; status: string; createdInRun: number; notes: string }> = [];

  for (const expectedCollection of expectedSchemas) {
    const liveCollection = liveCollections.find(
      (collection) => collection.name === expectedCollection.name || collection.$id === expectedCollection.name,
    );

    if (!liveCollection) {
      perCollectionRows.push({
        collectionName: expectedCollection.name,
        status: "⚠️ Connected with differences",
        createdInRun: 0,
        notes: "collection not found in Appwrite; 0 missing attrs created; 0 attr definition mismatch(es)",
      });
      continue;
    }

    const liveAttributes = await fetchLiveAttributes(databases, liveCollection.$id);
    const liveAttrByKey = new Map(liveAttributes.map((attribute) => [attribute.key, attribute]));
    // Appwrite system-managed attributes (e.g. $createdAt, $updatedAt) are omitted from live listAttributes
    // and should not be treated as user-schema drift.
    const expectedComparableAttributes = expectedCollection.attributes.filter((attribute) => !attribute.name.startsWith("$"));

    let missingAttrs = 0;
    let mismatches = 0;
    const missingNames: string[] = [];
    const mismatchNames: string[] = [];

    for (const expectedAttribute of expectedComparableAttributes) {
      const liveAttribute = liveAttrByKey.get(expectedAttribute.name);
      if (!liveAttribute) {
        missingAttrs += 1;
        missingNames.push(expectedAttribute.name);
        continue;
      }

      const requiredMismatch = expectedAttribute.required !== Boolean(liveAttribute.required);
      const typeMismatch = !attributeTypeMatches(expectedAttribute, liveAttribute);
      if (requiredMismatch || typeMismatch) {
        mismatches += 1;
        mismatchNames.push(expectedAttribute.name);
      }
    }

    const status =
      missingAttrs === 0 && mismatches === 0 ? "✅ Perfectly connected" : "⚠️ Connected with differences";

    const missingSummary = missingNames.length > 0 ? `; missing: ${missingNames.join(", ")}` : "";
    const mismatchSummary = mismatchNames.length > 0 ? `; mismatch: ${mismatchNames.join(", ")}` : "";
    const missingAttrsCreated = attributeSyncResults.find((r) => r.collectionId === liveCollection.$id)?.createdAttributes ?? 0;
    const notes = `collection existed; ${missingAttrsCreated} missing attrs created; ${mismatches} attr definition mismatch(es); ${missingAttrs} missing expected attr(s)${missingSummary}${mismatchSummary}`;

    perCollectionRows.push({
      collectionName: expectedCollection.name,
      status,
      createdInRun: missingAttrsCreated,
      notes,
    });
  }

  for (const liveCollection of liveCollections) {
    const documented = expectedSchemas.some(
      (schema) => schema.name === liveCollection.name || schema.name === liveCollection.$id,
    );
    if (documented) {
      continue;
    }

    perCollectionRows.push({
      collectionName: liveCollection.name,
      status: "⚠️ Connected with differences",
      createdInRun: 0,
      notes: `undocumented live collection (${liveCollection.name}); exists in Appwrite but missing from docs/DATABASE_SCHEMA.md`,
    });
  }

  const statusTable = buildSchemaStatusTableFromDiff({
    syncedAt,
    liveBuckets,
    expectedSchemas,
    liveCollections,
    perCollection: perCollectionRows,
  });
  injectSchemaStatusIntoDatabaseDoc(statusTable);
  deleteLegacySchemaDoc();

  const createdInfraCount = [...bucketResults, databaseResult, ...requiredCollectionResults].filter(
    (item) => item.status === "created",
  ).length;
  const createdAttrsCount = attributeSyncResults.reduce((sum, r) => sum + r.createdAttributes, 0);
  console.log(
    `Appwrite infrastructure sync complete. created=${createdInfraCount}, attributesCreated=${createdAttrsCount}, orphanBucketsDeleted=${orphanBucketsDeleted.length}, orphanDatabasesDeleted=${orphanDatabasesDeleted.length}`,
  );
}

syncInfrastructure().catch((error) => {
  console.error("Appwrite infrastructure sync failed:", error);
  process.exitCode = 1;
});
