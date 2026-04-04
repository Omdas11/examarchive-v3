#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { Client, Databases, Storage } from "node-appwrite";

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

const REQUIRED_BUCKETS: BucketSpec[] = [
  { id: "papers", name: "papers" },
  { id: "examarchive-md-ingestion", name: "examarchive-md-ingestion" },
  { id: "syllabus-files", name: "syllabus-files" },
  { id: "avatars", name: "avatars" },
];

const TARGET_DATABASE_ID = "examarchive";
const TARGET_DATABASE_NAME = "ExamArchive";
const REQUIRED_COLLECTION_ID = "Generated_Notes_Cache";

function loadAppwriteEnv() {
  loadEnvConfig(path.resolve(__dirname, ".."));

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

async function ensureCollection(databases: Databases, databaseId: string, collectionId: string): Promise<SyncResourceResult> {
  try {
    const existing = await databases.getCollection(databaseId, collectionId);
    console.log(`[exists] collection ${collectionId} (${existing.$id})`);
    return { kind: "collection", name: collectionId, id: existing.$id, status: "exists" };
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }

  const created = await databases.createCollection(databaseId, collectionId, collectionId);
  console.log(`[create] collection ${collectionId} (${created.$id})`);
  return { kind: "collection", name: collectionId, id: created.$id, status: "created" };
}

async function listCollections(databases: Databases, databaseId: string): Promise<Array<{ id: string; name: string }>> {
  const response = await databases.listCollections(databaseId);
  return response.collections.map((collection) => ({ id: collection.$id, name: collection.name }));
}

function renderSchemaMarkdown(params: {
  syncedAt: string;
  buckets: SyncResourceResult[];
  database: SyncResourceResult;
  requiredCollection: SyncResourceResult;
  allCollections: Array<{ id: string; name: string }>;
}): string {
  const { syncedAt, buckets, database, requiredCollection, allCollections } = params;

  const bucketLines = buckets
    .map((item) => `- ${item.status === "created" ? "✅ Created" : "⚡ Exists"}: **${item.name}** (ID: ${item.id})`)
    .join("\n");

  const dbLine = `- ${database.status === "created" ? "✅ Created" : "⚡ Exists"}: **${database.name}** (ID: ${database.id})`;

  const requiredCollectionLine = `- ${requiredCollection.status === "created" ? "✅ Created" : "⚡ Exists"}: **${requiredCollection.name}** (ID: ${requiredCollection.id})`;
  const allCollectionLines = allCollections.map((item) => `- 📄 **${item.name}** (ID: ${item.id})`).join("\n");

  return [
    "# Appwrite Infrastructure Sync",
    `Last Synced: ${syncedAt}`,
    "",
    "## Storage Buckets",
    bucketLines || "- (none)",
    "",
    "## Databases",
    dbLine,
    "",
    `### Required Collection in ${TARGET_DATABASE_ID}`,
    requiredCollectionLine,
    "",
    `### Collections within ${TARGET_DATABASE_ID}`,
    allCollectionLines || "- No collections found.",
    "",
  ].join("\n");
}

function writeSchemaFile(markdown: string) {
  const outPath = path.resolve(__dirname, "../docs/APPWRITE_SCHEMA.md");
  fs.writeFileSync(outPath, markdown, "utf8");
  console.log(`Wrote schema documentation to ${outPath}`);
}

async function syncInfrastructure() {
  const { storage, databases } = createClients();
  const syncedAt = new Date().toISOString();

  const bucketResults: SyncResourceResult[] = [];
  for (const bucket of REQUIRED_BUCKETS) {
    bucketResults.push(await ensureBucket(storage, bucket));
  }

  const databaseResult = await ensureDatabase(databases, TARGET_DATABASE_ID, TARGET_DATABASE_NAME);
  const requiredCollectionResult = await ensureCollection(databases, TARGET_DATABASE_ID, REQUIRED_COLLECTION_ID);
  const allCollections = await listCollections(databases, TARGET_DATABASE_ID);

  const schemaMarkdown = renderSchemaMarkdown({
    syncedAt,
    buckets: bucketResults,
    database: databaseResult,
    requiredCollection: requiredCollectionResult,
    allCollections,
  });

  writeSchemaFile(schemaMarkdown);

  const createdCount = [...bucketResults, databaseResult, requiredCollectionResult].filter((item) => item.status === "created").length;
  console.log(`Appwrite infrastructure sync complete. created=${createdCount}`);
}

syncInfrastructure().catch((error) => {
  console.error("Appwrite infrastructure sync failed:", error);
  process.exitCode = 1;
});
