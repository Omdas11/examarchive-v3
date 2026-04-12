#!/usr/bin/env node

/**
 * AI-focused Appwrite bootstrap: creates missing collections/attributes needed for
 * the AI upgrade phases and ensures placeholder Functions exist for deployment hooks.
 *
 * Usage:
 * node scripts/v2/sync-appwrite-ai.js
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { Client, Functions, InputFile } = require("node-appwrite");
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
const AI_NOTE_WORKER_FUNCTION_ID = "ai-note-worker";
const AI_NOTE_WORKER_ENTRYPOINT = "index.js";
const AI_NOTE_WORKER_SOURCE_DIR = path.resolve(__dirname, "../../appwrite/functions/ai-note-worker");
const DEFAULT_SITE_URL = "https://www.examarchive.dev";

const AI_COLLECTIONS = [
  {
    id: "ai_ingestions",
    name: "ai_ingestions",
    attributes: [
      { key: "entry_type", type: "string", required: false, size: 32 },
      { key: "paper_code", type: "string", required: false, size: 256 },
      { key: "source_label", type: "string", required: false, size: 256 },
      { key: "file_id", type: "string", required: false, size: 64 },
      { key: "file_url", type: "string", required: false, size: 2048 },
      { key: "status", type: "string", required: false, size: 32 },
      { key: "model", type: "string", required: false, size: 64 },
      { key: "characters_ingested", type: "integer", required: false },
      { key: "digest", type: "string", required: false, size: 8192 },
      // ── Syllabus-tracker fields (added for launch-readiness) ──────────────
      // paper_name avoids a cross-join to Questions_Table for human-readable logs.
      { key: "paper_name", type: "string", required: false, size: 255 },
      // ingested_at is an explicit ISO-8601 timestamp (vs relying on $createdAt).
      { key: "ingested_at", type: "datetime", required: false },
      // row_count: total syllabus + question rows written in the ingestion.
      { key: "row_count", type: "integer", required: false },
      // error_summary: comma-joined parse/DB errors for quick mobile triage.
      { key: "error_summary", type: "string", required: false, size: 2000 },
      // subject / dept_code for department-scoped dashboard filters.
      { key: "subject", type: "string", required: false, size: 128 },
      { key: "dept_code", type: "string", required: false, size: 16 },
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
      { key: "modules_json", type: "string", required: false, size: 10000 },
      { key: "model", type: "string", required: false, size: 64 },
      { key: "source_syllabus_id", type: "string", required: false, size: 64 },
    ],
  },
  {
    id: "ai_flashcards",
    name: "ai_flashcards",
    attributes: [
      { key: "userId", type: "string", required: false, size: 64 },
      { key: "source_paper_id", type: "string", required: false, size: 64 },
      { key: "payload", type: "string", required: false, size: 10000 },
      { key: "model", type: "string", required: false, size: 64 },
      { key: "tags", type: "string", required: false, size: 128, array: true },
    ],
  },
  {
    id: "ai_admin_reports",
    name: "ai_admin_reports",
    attributes: [
      { key: "run_at", type: "datetime", required: false },
      { key: "summary", type: "string", required: false, size: 10000 },
      { key: "risks_json", type: "string", required: false, size: 10000 },
      { key: "model", type: "string", required: false, size: 64 },
    ],
  },
  {
    id: "ai_generation_jobs",
    name: "ai_generation_jobs",
    attributes: [
      { key: "user_id", type: "string", required: true, size: 64 },
      { key: "paper_code", type: "string", required: true, size: 128 },
      { key: "unit_number", type: "integer", required: true },
      { key: "status", type: "string", required: true, size: 32 },
      { key: "progress_percent", type: "integer", required: false },
      { key: "input_payload_json", type: "string", required: true, size: 20000 },
      { key: "result_note_id", type: "string", required: false, size: 64 },
      { key: "error_message", type: "string", required: false, size: 2000 },
      { key: "started_at", type: "datetime", required: false },
      { key: "completed_at", type: "datetime", required: false },
      { key: "idempotency_key", type: "string", required: true, size: 128 },
      { key: "created_at", type: "datetime", required: true },
    ],
  },
];

// These are initialized in main() after loadAppwriteEnv() to respect CLI/.env overrides
let DEFAULT_FUNCTION_RUNTIME;
const FALLBACK_FUNCTION_RUNTIMES = ["node-20.0", "node-18.0"];
let TARGET_FUNCTIONS;
const REQUIRED_FUNCTION_IDS = [AI_NOTE_WORKER_FUNCTION_ID];

function initializeFunctionConfig() {
  DEFAULT_FUNCTION_RUNTIME = process.env.APPWRITE_FUNCTION_RUNTIME || "node-22.0";
  TARGET_FUNCTIONS = [
    {
      id: "ai-admin-report",
      name: "ai-admin-report",
      runtime: DEFAULT_FUNCTION_RUNTIME,
      description: "Weekly Gemini 2.5 Flash admin/security digest",
      schedule: "0 2 * * 1",
      execute: ["any"],
    },
    {
      id: "ai-syllabus-map",
      name: "ai-syllabus-map",
      runtime: DEFAULT_FUNCTION_RUNTIME,
      description: "Gemini 3.1 Flash Lite syllabus to archive mapper",
      execute: ["any"],
    },
    {
      id: "ai-flashcards",
      name: "ai-flashcards",
      runtime: DEFAULT_FUNCTION_RUNTIME,
      description: "Gemini 3.1 Flash Lite flashcard/quiz generator",
      execute: ["any"],
    },
    {
      id: AI_NOTE_WORKER_FUNCTION_ID,
      name: AI_NOTE_WORKER_FUNCTION_ID,
      runtime: DEFAULT_FUNCTION_RUNTIME,
      description: "Async notes generation worker",
      execute: ["any"],
      entrypoint: AI_NOTE_WORKER_ENTRYPOINT,
      sourceDir: AI_NOTE_WORKER_SOURCE_DIR,
    },
  ];
}

function createFunctionsClient() {
  const { endpoint, projectId, apiKey } = loadAppwriteEnv();
  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  return new Functions(client);
}

function isAttributeLimitExceeded(error) {
  const type = error?.type ?? error?.response?.type;
  return type === "attribute_limit_exceeded";
}


function runtimeErrorLooksRecoverable(error) {
  const type = `${error?.type ?? error?.response?.type ?? ""}`.toLowerCase();
  const message = `${error?.message ?? error?.response?.message ?? ""}`.toLowerCase();
  return type.includes("runtime") || message.includes("runtime");
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
    const existing = await functions.get(func.id);
    try {
      await functions.update({
        functionId: func.id,
        name: func.name,
        runtime: func.runtime,
        execute: func.execute ?? [],
        events: func.events,
        schedule: func.schedule,
        entrypoint: func.entrypoint,
        commands: func.commands,
        enabled: true,
        logging: true,
      });
    } catch (updateError) {
      throw new Error(
        `Failed to update function configuration for "${func.id}": ${
          updateError instanceof Error ? updateError.message : String(updateError)
        }`,
      );
    }
    console.log(`[exists] function ${func.id}`);
    return { functionId: func.id, created: false, runtime: existing.runtime || func.runtime };
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }

    const runtimesToTry = [func.runtime, ...FALLBACK_FUNCTION_RUNTIMES.filter((runtime) => runtime !== func.runtime)];
    let lastError;

    for (const runtime of runtimesToTry) {
      try {
        await functions.create(
          func.id,
          func.name,
          runtime,
          func.execute ?? [],
          func.events,
          func.schedule,
          undefined,
          true,
          true,
          func.entrypoint,
          func.commands,
        );
        if (runtime !== func.runtime) {
          console.warn(`[warn] function ${func.id} created with fallback runtime ${runtime} (requested ${func.runtime})`);
        }
        console.log(`[create] function ${func.id}`);
        return { functionId: func.id, created: true, runtime };
      } catch (createError) {
        lastError = createError;
        if (!runtimeErrorLooksRecoverable(createError) || runtime === runtimesToTry[runtimesToTry.length - 1]) {
          throw createError;
        }
        console.warn(
          `[warn] function ${func.id} runtime ${runtime} failed, retrying with fallback runtime...`,
        );
      }
    }

    throw lastError;
  }
}

function normalizeBaseUrl(value) {
  const input = `${value || ""}`.trim();
  if (!input) return DEFAULT_SITE_URL;
  return input.replace(/\/+$/, "");
}

function resolveWorkerVariables() {
  const sharedSecret = process.env.APPWRITE_AI_WORKER_SHARED_SECRET || process.env.APPWRITE_WORKER_SHARED_SECRET || "";
  if (!sharedSecret) {
    throw new Error(
      "Missing APPWRITE_AI_WORKER_SHARED_SECRET/APPWRITE_WORKER_SHARED_SECRET for ai-note-worker variable sync.",
    );
  }
  return [
    {
      key: "EXAMARCHIVE_BASE_URL",
      value: normalizeBaseUrl(process.env.APPWRITE_AI_WORKER_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL),
      secret: false,
    },
    {
      key: "EXAMARCHIVE_WORKER_SHARED_SECRET",
      value: sharedSecret,
      secret: true,
    },
  ];
}

async function upsertFunctionVariables(functions, functionId, variables) {
  const current = await functions.listVariables(functionId);
  const byKey = new Map(current.variables.map((variable) => [variable.key, variable]));
  for (const variable of variables) {
    const existing = byKey.get(variable.key);
    if (existing) {
      await functions.updateVariable(functionId, existing.$id, variable.key, variable.value, variable.secret);
      console.log(`[update] function variable ${functionId}.${variable.key}`);
      continue;
    }
    await functions.createVariable(functionId, variable.key, variable.value, variable.secret);
    console.log(`[create] function variable ${functionId}.${variable.key}`);
  }
}

function createFunctionArchive(functionId, sourceDir) {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Function source directory missing for ${functionId}: ${sourceDir}`);
  }
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `${functionId}-deployment-`));
  const archivePath = path.join(tmpDir, `${functionId}.tar.gz`);
  try {
    execFileSync("tar", ["-czf", archivePath, "-C", sourceDir, "."], { stdio: "inherit" });
  } catch (error) {
    throw new Error(
      `Failed to create deployment archive for "${functionId}" from "${sourceDir}": ${
        error instanceof Error ? error.message : String(error)
      }. Verify 'tar' is installed (if you see command-not-found) and source files are readable.`,
    );
  }
  const stats = fs.statSync(archivePath);
  if (!stats.isFile()) {
    throw new Error(`Generated deployment archive path is not a file for ${functionId}: ${archivePath}`);
  }
  if (stats.size <= 0) {
    throw new Error(`Generated deployment archive has zero bytes for ${functionId}: ${archivePath}`);
  }
  return { tmpDir, archivePath, archiveSize: stats.size };
}

async function deployFunctionSource(functions, func) {
  if (!func.sourceDir) {
    return null;
  }
  const { tmpDir, archivePath, archiveSize } = createFunctionArchive(func.id, func.sourceDir);
  try {
    const deployment = await functions.createDeployment(
      func.id,
      InputFile.fromPath(archivePath, `${func.id}.tar.gz`),
      true,
      func.entrypoint,
      func.commands,
    );
    console.log(
      `[deploy] function ${func.id} deployment=${deployment.$id} status=${deployment.status} archive_size=${archiveSize}B`,
    );
    return {
      functionId: func.id,
      deploymentId: deployment.$id,
      status: deployment.status,
      archiveSize,
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function assertRequiredFunctionsSynced(functionResults) {
  const syncedIds = new Set(functionResults.map((result) => result.functionId));
  for (const requiredId of REQUIRED_FUNCTION_IDS) {
    if (!syncedIds.has(requiredId)) {
      throw new Error(
        `Required AI function "${requiredId}" was not synced. Check TARGET_FUNCTIONS and Appwrite credentials.`,
      );
    }
  }
}

async function main() {
  // Load environment variables first (including .env overrides)
  loadAppwriteEnv();
  // Initialize function configuration with the loaded environment
  initializeFunctionConfig();

  const databases = createAppwriteDatabasesClient();
  const functions = createFunctionsClient();

  console.log("Starting AI Appwrite sync…");
  const collectionResults = [];
  for (const collection of AI_COLLECTIONS) {
    collectionResults.push(await syncCollection(databases, collection));
  }

  const functionResults = [];
  const deploymentResults = [];
  for (const func of TARGET_FUNCTIONS) {
    functionResults.push(await ensureFunctionExists(functions, func));
    if (func.id === AI_NOTE_WORKER_FUNCTION_ID) {
      await upsertFunctionVariables(functions, func.id, resolveWorkerVariables());
    }
    deploymentResults.push(await deployFunctionSource(functions, func));
  }
  assertRequiredFunctionsSynced(functionResults);

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
    console.log(` ${result.created ? "[create]" : "[exists]"} ${result.functionId} (runtime=${result.runtime})`);
  }
  for (const deployment of deploymentResults.filter(Boolean)) {
    console.log(
      ` [deploy] ${deployment.functionId} -> ${deployment.deploymentId} (status=${deployment.status}, size=${deployment.archiveSize}B)`,
    );
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
  main,
  AI_COLLECTIONS,
  TARGET_FUNCTIONS,
  syncCollection,
  ensureFunctionExists,
  createFunctionArchive,
  deployFunctionSource,
  resolveWorkerVariables,
  upsertFunctionVariables,
  assertRequiredFunctionsSynced,
};
