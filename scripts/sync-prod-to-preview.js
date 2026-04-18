#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const { Client, Databases, Query } = require("node-appwrite");

const DEFAULT_DATABASE_ID = "examarchive";
const DEFAULT_COLLECTION_IDS = ["Syllabus_Table", "Questions_Table"];

function readRequiredEnv(name) {
  const value = (process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function readOptionalEnv(name, fallback = "") {
  const value = (process.env[name] || "").trim();
  if (value) {
    return value;
  }
  return (fallback || "").trim();
}

function createDatabasesClient({ endpoint, projectId, apiKey }) {
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  return new Databases(client);
}

function isAlreadyExistsError(error) {
  const code = error?.code ?? error?.response?.code;
  const type = error?.type ?? error?.response?.type;
  const message = String(error?.message ?? error?.response?.message ?? "");
  return code === 409 || code === "409" || type === "document_already_exists" || /already exist(s)?/i.test(message);
}

function sanitizeDocumentData(document) {
  const clean = {};
  for (const [key, value] of Object.entries(document || {})) {
    if (key.startsWith("$")) continue;
    clean[key] = value;
  }
  return clean;
}

function parseCollectionIds(raw) {
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function loadSyncConfig() {
  const prodEndpoint = readOptionalEnv(
    "PROD_APPWRITE_ENDPOINT",
    process.env.APPWRITE_ENDPOINT || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
  );
  const prodProjectId = readOptionalEnv("PROD_APPWRITE_PROJECT_ID", process.env.APPWRITE_PROJECT_ID);
  const prodApiKey = readOptionalEnv("PROD_APPWRITE_API_KEY", process.env.APPWRITE_API_KEY);

  const previewEndpoint = readOptionalEnv("PREVIEW_APPWRITE_ENDPOINT", prodEndpoint);
  const previewProjectId = readRequiredEnv("PREVIEW_APPWRITE_PROJECT_ID");
  const previewApiKey = readRequiredEnv("PREVIEW_APPWRITE_API_KEY");

  if (!prodEndpoint || !prodProjectId || !prodApiKey) {
    throw new Error(
      "Missing production Appwrite credentials. Set PROD_APPWRITE_ENDPOINT/PROJECT_ID/API_KEY " +
        "or fall back to APPWRITE_ENDPOINT/PROJECT_ID/API_KEY.",
    );
  }

  if (prodProjectId === previewProjectId) {
    throw new Error("Production and Preview project IDs must be different to prevent destructive syncs.");
  }

  const databaseId = readOptionalEnv("APPWRITE_DATABASE_ID", DEFAULT_DATABASE_ID);
  const collectionIds = parseCollectionIds(readOptionalEnv("CORE_SYNC_COLLECTIONS", DEFAULT_COLLECTION_IDS.join(",")));
  if (collectionIds.length === 0) {
    throw new Error("No collections configured to sync. Set CORE_SYNC_COLLECTIONS to a comma-separated list.");
  }

  return {
    databaseId,
    collectionIds,
    prod: { endpoint: prodEndpoint, projectId: prodProjectId, apiKey: prodApiKey },
    preview: { endpoint: previewEndpoint, projectId: previewProjectId, apiKey: previewApiKey },
  };
}

function runPreviewProvisioning(previewEnv) {
  const child = spawnSync("npx", ["tsx", "scripts/v2/sync-appwrite.ts"], {
    stdio: "inherit",
    env: {
      ...process.env,
      APPWRITE_ENDPOINT: previewEnv.endpoint,
      APPWRITE_PROJECT_ID: previewEnv.projectId,
      APPWRITE_API_KEY: previewEnv.apiKey,
    },
  });
  if (child.status !== 0) {
    throw new Error("Preview auto-provisioning failed while running scripts/v2/sync-appwrite.ts");
  }
}

async function listAllDocuments(databases, databaseId, collectionId) {
  const documents = [];
  let cursor;
  while (true) {
    const queries = [Query.limit(100)];
    if (cursor) {
      queries.push(Query.cursorAfter(cursor));
    }
    const page = await databases.listDocuments(databaseId, collectionId, queries);
    documents.push(...page.documents);
    if (page.documents.length < 100) {
      break;
    }
    cursor = page.documents[page.documents.length - 1].$id;
  }
  return documents;
}

async function upsertDocument(databases, databaseId, collectionId, document) {
  const data = sanitizeDocumentData(document);
  try {
    await databases.createDocument(databaseId, collectionId, document.$id, data);
    return "created";
  } catch (error) {
    if (!isAlreadyExistsError(error)) {
      throw error;
    }
    await databases.updateDocument(databaseId, collectionId, document.$id, data);
    return "updated";
  }
}

async function syncCollection(prodDatabases, previewDatabases, databaseId, collectionId) {
  const sourceDocs = await listAllDocuments(prodDatabases, databaseId, collectionId);
  let created = 0;
  let updated = 0;

  for (const doc of sourceDocs) {
    const result = await upsertDocument(previewDatabases, databaseId, collectionId, doc);
    if (result === "created") created += 1;
    if (result === "updated") updated += 1;
  }

  return { collectionId, total: sourceDocs.length, created, updated };
}

async function syncProdToPreview() {
  const config = loadSyncConfig();
  console.log("[sync-prod-to-preview] Provisioning preview buckets/database/collections...");
  runPreviewProvisioning(config.preview);

  const prodDatabases = createDatabasesClient(config.prod);
  const previewDatabases = createDatabasesClient(config.preview);
  const results = [];

  for (const collectionId of config.collectionIds) {
    console.log(`[sync-prod-to-preview] Syncing ${collectionId}...`);
    const result = await syncCollection(prodDatabases, previewDatabases, config.databaseId, collectionId);
    results.push(result);
    console.log(
      `[sync-prod-to-preview] ${collectionId}: total=${result.total}, created=${result.created}, updated=${result.updated}`,
    );
  }

  console.log(
    "[sync-prod-to-preview] Completed core data sync. Note: Appwrite users/password hashes/oauth identities and project roles are not copied by this script.",
  );
  return results;
}

if (require.main === module) {
  syncProdToPreview().catch((error) => {
    console.error("[sync-prod-to-preview] Failed:", error);
    process.exitCode = 1;
  });
}

module.exports = {
  sanitizeDocumentData,
  isAlreadyExistsError,
  listAllDocuments,
  upsertDocument,
  parseCollectionIds,
  loadSyncConfig,
  syncCollection,
};
