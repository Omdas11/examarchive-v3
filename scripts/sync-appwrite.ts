#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { Client, Databases, Storage } from "node-appwrite";

type BucketSpec = {
  id: string;
  name: string;
};

type CollectionSpec = {
  id: string;
  name: string;
};

type DatabaseSpec = {
  id: string;
  name: string;
  collections: CollectionSpec[];
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

const TARGET_DATABASE: DatabaseSpec = {
  id: "ExamArchiveDB",
  name: "ExamArchiveDB",
  collections: [{ id: "NotesCache", name: "NotesCache" }],
};

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

async function ensureDatabase(databases: Databases, database: DatabaseSpec): Promise<SyncResourceResult> {
  try {
    const existing = await databases.get(database.id);
    console.log(`[exists] database ${database.name} (${existing.$id})`);
    return { kind: "database", name: database.name, id: existing.$id, status: "exists" };
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }

  const created = await databases.create(database.id, database.name);
  console.log(`[create] database ${database.name} (${created.$id})`);
  return { kind: "database", name: database.name, id: created.$id, status: "created" };
}

async function ensureCollection(
  databases: Databases,
  databaseId: string,
  collection: CollectionSpec,
): Promise<SyncResourceResult> {
  try {
    const existing = await databases.getCollection(databaseId, collection.id);
    console.log(`[exists] collection ${collection.name} (${existing.$id})`);
    return { kind: "collection", name: collection.name, id: existing.$id, status: "exists" };
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }

  const created = await databases.createCollection(databaseId, collection.id, collection.name);
  console.log(`[create] collection ${collection.name} (${created.$id})`);
  return { kind: "collection", name: collection.name, id: created.$id, status: "created" };
}

function renderSchemaMarkdown(params: {
  syncedAt: string;
  buckets: SyncResourceResult[];
  database: SyncResourceResult;
  collections: SyncResourceResult[];
}): string {
  const { syncedAt, buckets, database, collections } = params;

  const bucketLines = buckets
    .map((item) => `- ${item.status === "created" ? "✅ Created" : "⚡ Exists"}: **${item.name}** (ID: ${item.id})`)
    .join("\n");

  const dbLine = `- ${database.status === "created" ? "✅ Created" : "⚡ Exists"}: **${database.name}** (ID: ${database.id})`;

  const collectionLines = collections
    .map((item) => `- ${item.status === "created" ? "✅ Created" : "⚡ Exists"}: **${item.name}** (ID: ${item.id})`)
    .join("\n");

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
    `### Collections in ${TARGET_DATABASE.name}`,
    collectionLines || "- (none)",
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

  const databaseResult = await ensureDatabase(databases, TARGET_DATABASE);

  const collectionResults: SyncResourceResult[] = [];
  for (const collection of TARGET_DATABASE.collections) {
    collectionResults.push(await ensureCollection(databases, TARGET_DATABASE.id, collection));
  }

  const schemaMarkdown = renderSchemaMarkdown({
    syncedAt,
    buckets: bucketResults,
    database: databaseResult,
    collections: collectionResults,
  });

  writeSchemaFile(schemaMarkdown);

  const createdCount = [...bucketResults, databaseResult, ...collectionResults].filter((item) => item.status === "created").length;
  console.log(`Appwrite infrastructure sync complete. created=${createdCount}`);
}

syncInfrastructure().catch((error) => {
  console.error("Appwrite infrastructure sync failed:", error);
  process.exitCode = 1;
});
