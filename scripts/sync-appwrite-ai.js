#!/usr/bin/env node

/**
 * AI-focused Appwrite bootstrap: creates missing collections/attributes needed for
 * the AI upgrade phases and ensures placeholder Functions exist for deployment hooks.
 *
 * Usage:
 *   node scripts/sync-appwrite-ai.js
 */

const { Client, Functions } = require("node-appwrite");
const {
  createAppwriteDatabasesClient,
  loadAppwriteEnv,
} = require("./appwrite-schema-setup");
const {
  createAttribute,
  getMissingAttributes,
  waitForAttributeAvailability,
  isNotFoundError,
} = require("./sync-appwrite-schema");

const DATABASE_ID = "examarchive";

const AI_COLLECTIONS = [
  {
    id: "ai_ingestions",
    name: "ai_ingestions",
    attributes: [
      { key: "source_label", type: "string", required: false, size: 256 },
      { key: "file_id", type: "string", required: false, size: 64 },
      { key: "file_url", type: "string", required: false, size: 2048 },
      { key: "status", type: "string", required: false, size: 32 },
      { key: "model", type: "string", required: false, size: 64 },
      { key: "characters_ingested", type: "integer", required: false },
      { key: "digest", type: "string", required: false, size: 8192 },
    ],
  },
  {
    id: "ai_syllabus_maps",
    name: "ai_syllabus_maps",
    attributes: [
      { key: "university", type: "string", required: false, size: 256 },
      { key: "college", type: "string", required: false, size: 256 },
      { key: "program", type: "string", required: false, size: 128 },
      { key: "semester", type: "string", required: false, size: 32 },
      { key: "checksum", type: "string", required: false, size: 128 },
      { key: "modules_json", type: "string", required: false, size: 65535 },
      { key: "model", type: "string", required: false, size: 64 },
      { key: "source_syllabus_id", type: "string", required: false, size: 64 },
    ],
  },
  {
    id: "ai_flashcards",
    name: "ai_flashcards",
    attributes: [
      { key: "source_paper_id", type: "string", required: false, size: 64 },
      { key: "payload", type: "string", required: false, size: 65535 },
      { key: "model", type: "string", required: false, size: 64 },
      { key: "tags", type: "string", required: false, size: 128, array: true },
    ],
  },
  {
    id: "ai_admin_reports",
    name: "ai_admin_reports",
    attributes: [
      { key: "run_at", type: "datetime", required: false },
      { key: "summary", type: "string", required: false, size: 8192 },
      { key: "risks_json", type: "string", required: false, size: 8192 },
      { key: "model", type: "string", required: false, size: 64 },
    ],
  },
];

const TARGET_FUNCTIONS = [
  {
    id: "ai-admin-report",
    name: "ai-admin-report",
    runtime: "node-20.0",
    description: "Weekly Gemini 2.5 Flash admin/security digest",
    schedule: "0 2 * * 1",
    execute: ["role:admin"],
  },
  {
    id: "ai-syllabus-map",
    name: "ai-syllabus-map",
    runtime: "node-20.0",
    description: "Gemini 3.1 Flash Lite syllabus to archive mapper",
    execute: ["role:admin", "role:service"],
  },
  {
    id: "ai-flashcards",
    name: "ai-flashcards",
    runtime: "node-20.0",
    description: "Gemini 3.1 Flash Lite flashcard/quiz generator",
    execute: ["role:admin", "role:service"],
  },
];

function createFunctionsClient() {
  const { endpoint, projectId, apiKey } = loadAppwriteEnv();
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  return new Functions(client);
}

function isAttributeLimitExceeded(error) {
  const type = error?.type ?? error?.response?.type;
  return type === "attribute_limit_exceeded";
}

async function ensureCollectionExists(databases, collection) {
  try {
    await databases.getCollection(DATABASE_ID, collection.id);
    return false;
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
    await databases.createCollection(DATABASE_ID, collection.id, collection.name);
    return true;
  }
}

async function syncCollection(databases, collection) {
  const createdCollection = await ensureCollectionExists(databases, collection);
  const liveAttributesResponse = await databases.listAttributes(DATABASE_ID, collection.id);
  const liveAttributes = liveAttributesResponse.attributes;
  const missing = getMissingAttributes(collection.attributes, liveAttributes);
  let createdAttributes = 0;
  let attributeLimitExceeded = false;

  for (const attribute of missing) {
    console.log(`[create] attribute ${collection.id}.${attribute.key}`);
    try {
      await createAttribute(databases, DATABASE_ID, collection.id, attribute);
      await waitForAttributeAvailability(databases, DATABASE_ID, collection.id, attribute.key);
      createdAttributes += 1;
    } catch (error) {
      if (isAttributeLimitExceeded(error)) {
        attributeLimitExceeded = true;
        console.warn(
          `[warn] attribute limit reached for ${collection.id} while creating ${attribute.key}; ` +
            "skipping remaining attributes. Remove unused attributes in Appwrite and re-run sync if needed.",
        );
        break;
      }
      throw error;
    }
  }

  if (missing.length === 0 && !createdCollection) {
    console.log(`[up-to-date] ${collection.id}`);
  }

  return {
    collectionId: collection.id,
    createdCollection,
    createdAttributes,
    totalTargetAttributes: collection.attributes.length,
    connected: missing.length === 0 && !createdCollection,
    attributeLimitExceeded,
  };
}

async function ensureFunctionExists(functions, func) {
  try {
    await functions.get(func.id);
    console.log(`[exists] function ${func.id}`);
    return { functionId: func.id, created: false };
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
    await functions.create(
      func.id,
      func.name,
      func.execute ?? [],
      func.runtime,
      undefined,
      undefined,
      func.schedule,
    );
    console.log(`[create] function ${func.id}`);
    return { functionId: func.id, created: true };
  }
}

async function main() {
  const databases = createAppwriteDatabasesClient();
  const functions = createFunctionsClient();

  console.log("Starting AI Appwrite sync…");
  const collectionResults = [];
  for (const collection of AI_COLLECTIONS) {
    collectionResults.push(await syncCollection(databases, collection));
  }

  const functionResults = [];
  for (const func of TARGET_FUNCTIONS) {
    functionResults.push(await ensureFunctionExists(functions, func));
  }

  console.log("AI collections:");
  for (const result of collectionResults) {
    const status = result.attributeLimitExceeded ? "⚠️" : result.connected ? "✅" : "⚙️";
    console.log(
      ` ${status} ${result.collectionId}: created collection=${result.createdCollection} ` +
        `created attributes=${result.createdAttributes}/${result.totalTargetAttributes}` +
        (result.attributeLimitExceeded ? " (attribute limit reached)" : ""),
    );
  }

  console.log("AI functions:");
  for (const result of functionResults) {
    console.log(` ${result.created ? "[create]" : "[exists]"} ${result.functionId}`);
  }

  console.log("AI Appwrite sync complete.");
}

if (require.main === module) {
  main().catch((error) => {
    console.error("AI Appwrite sync failed:", error);
    process.exitCode = 1;
  });
}

module.exports = {
  AI_COLLECTIONS,
  TARGET_FUNCTIONS,
  syncCollection,
  ensureFunctionExists,
};
