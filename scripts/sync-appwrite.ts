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

const SCHEMA_STATUS_START_TAG = "<!-- SCHEMA_SYNC_STATUS_START -->";
const SCHEMA_STATUS_END_TAG = "<!-- SCHEMA_SYNC_STATUS_END -->";
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

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSchemaStatusTable(collections: Array<{ id: string; name: string }>, syncedAt: string): string {
  let statusTable = "## Schema Sync Status (Auto-generated)\n\n";
  statusTable += `_Last synced: ${syncedAt}_\n\n`;
  statusTable += "| Collection | Status | ID |\n";
  statusTable += "|---|---|---|\n";

  if (collections.length === 0) {
    statusTable += "| N/A | ⚠️ No collections found | N/A |\n";
    return statusTable;
  }

  collections.forEach((collection) => {
    statusTable += `| \`${collection.name}\` | ✅ Connected | ${collection.id} |\n`;
  });

  return statusTable;
}

function injectSchemaStatusIntoDatabaseDoc(statusTable: string) {
  const docPath = path.resolve(__dirname, "../docs/DATABASE_SCHEMA.md");
  if (!fs.existsSync(docPath)) {
    console.error("docs/DATABASE_SCHEMA.md not found!");
    return;
  }

  const regex = new RegExp(`${escapeRegex(SCHEMA_STATUS_START_TAG)}[\\s\\S]*?${escapeRegex(SCHEMA_STATUS_END_TAG)}`, "g");
  const newBlock = `${SCHEMA_STATUS_START_TAG}\n${statusTable}\n${SCHEMA_STATUS_END_TAG}`;
  const existingContent = fs.readFileSync(docPath, "utf8");
  const hasTags = regex.test(existingContent);
  const nextContent = hasTags ? existingContent.replace(regex, newBlock) : `${existingContent}\n\n${newBlock}`;

  fs.writeFileSync(docPath, nextContent, "utf8");
  console.log("Successfully injected live status into docs/DATABASE_SCHEMA.md");
}

function deleteLegacySchemaDoc() {
  const oldDocPath = path.resolve(__dirname, "../docs/APPWRITE_SCHEMA.md");
  if (!fs.existsSync(oldDocPath)) {
    return;
  }

  fs.unlinkSync(oldDocPath);
  console.log("Deleted deprecated docs/APPWRITE_SCHEMA.md");
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
  const statusTable = buildSchemaStatusTable(allCollections, syncedAt);
  injectSchemaStatusIntoDatabaseDoc(statusTable);
  deleteLegacySchemaDoc();

  const createdCount = [...bucketResults, databaseResult, requiredCollectionResult].filter((item) => item.status === "created").length;
  console.log(`Appwrite infrastructure sync complete. created=${createdCount}`);
}

syncInfrastructure().catch((error) => {
  console.error("Appwrite infrastructure sync failed:", error);
  process.exitCode = 1;
});
