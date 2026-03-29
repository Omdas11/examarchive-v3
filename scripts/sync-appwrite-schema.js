#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { createAppwriteDatabasesClient } = require("./appwrite-schema-setup");

const DATABASE_ID = "examarchive";
const STANDARD_STRING_SIZE = 512;
const FILENAME_SIZE = 512;
const LARGE_STRING_SIZE = 8192;
const TEXT_CHUNK_SIZE = 65535;
const REFERRAL_CODE_SIZE = 6;
const DATABASE_SCHEMA_DOC_PATH = path.resolve(__dirname, "../docs/DATABASE_SCHEMA.md");
const STATUS_BLOCK_START = "<!-- SCHEMA_SYNC_STATUS_START -->";
const STATUS_BLOCK_END = "<!-- SCHEMA_SYNC_STATUS_END -->";

const TARGET_SCHEMA = [
  {
    id: "papers",
    name: "papers",
    attributes: [
      { key: "course_code", type: "string", required: true, size: 64 },
      { key: "paper_name", type: "string", required: false, size: 256 },
      { key: "year", type: "integer", required: true },
      { key: "semester", type: "string", required: false, size: 32 },
      { key: "department", type: "string", required: false, size: 128 },
      { key: "programme", type: "string", required: false, size: 64 },
      { key: "exam_type", type: "string", required: false, size: 32 },
      { key: "institute", type: "string", required: false, size: 256 },
      { key: "institution", type: "string", required: false, size: 256 },
      { key: "stream", type: "string", required: false, size: 128 },
      { key: "paper_type", type: "string", required: false, size: 32 },
      { key: "marks", type: "integer", required: false },
      { key: "duration", type: "integer", required: false },
      { key: "file_id", type: "string", required: false, size: 64 },
      { key: "file_url", type: "string", required: true, size: 2048 },
      { key: "uploaded_by", type: "string", required: false, size: 64 },
      { key: "uploaded_by_username", type: "string", required: false, size: 128 },
      { key: "approved", type: "boolean", required: true, default: false },
      { key: "status", type: "string", required: false, size: 32 },
      { key: "view_count", type: "integer", required: false },
      { key: "download_count", type: "integer", required: false },
    ],
  },
  {
    id: "syllabus",
    name: "syllabus",
    attributes: [
      { key: "university", type: "string", required: false, size: 256 },
      { key: "subject", type: "string", required: false, size: 256 },
      { key: "department", type: "string", required: false, size: 128 },
      { key: "semester", type: "string", required: false, size: 32 },
      { key: "programme", type: "string", required: false, size: 64 },
      { key: "year", type: "integer", required: false },
      { key: "uploader_id", type: "string", required: false, size: 64 },
      { key: "approval_status", type: "string", required: false, size: 32 },
      { key: "file_url", type: "string", required: false, size: 2048 },
      { key: "uploaded_by_username", type: "string", required: false, size: 128 },
      { key: "course_code", type: "string", required: false, size: 64 },
      { key: "course_name", type: "string", required: false, size: 256 },
      { key: "is_hidden", type: "boolean", required: false, default: false },
    ],
  },
  {
    id: "users",
    name: "users",
    attributes: [
      { key: "email", type: "string", required: true, size: 320 },
      { key: "role", type: "string", required: true, size: 64 },
      { key: "primary_role", type: "string", required: false, size: 64 },
      { key: "secondary_role", type: "string", required: false, size: 64 },
      { key: "tertiary_role", type: "string", required: false, size: 64 },
      { key: "tier", type: "string", required: false, size: 32 },
      { key: "display_name", type: "string", required: false, size: 128 },
      { key: "username", type: "string", required: false, size: 64 },
      { key: "xp", type: "integer", required: false },
      { key: "streak_days", type: "integer", required: false },
      { key: "avatar_url", type: "string", required: false, size: 2048 },
      { key: "avatar_file_id", type: "string", required: false, size: 64 },
      { key: "last_activity", type: "datetime", required: false },
      {
        key: "upload_count",
        type: "integer",
        required: false,
      },
      {
        key: "username_last_changed",
        type: "string",
        required: false,
        size: 64,
      },
      { key: "referral_code", type: "string", required: false, size: REFERRAL_CODE_SIZE },
      { key: "ai_credits", type: "integer", required: false },
      { key: "referred_by", type: "string", required: false, size: 64 },
      { key: "referral_path", type: "string", required: false, size: 64, array: true },
    ],
  },
  {
    id: "uploads",
    name: "uploads",
    attributes: [
      { key: "user_id", type: "string", required: true, size: 64 },
      { key: "file_id", type: "string", required: true, size: 64 },
      { key: "file_name", type: "string", required: true, size: FILENAME_SIZE },
      { key: "status", type: "string", required: true, size: 32 },
    ],
  },
  {
    id: "activity_logs",
    name: "activity_logs",
    attributes: [
      { key: "action", type: "string", required: true, size: 64 },
      { key: "target_user_id", type: "string", required: false, size: 64 },
      { key: "target_paper_id", type: "string", required: false, size: 64 },
      { key: "admin_id", type: "string", required: false, size: 64 },
      { key: "admin_email", type: "string", required: false, size: 320 },
      { key: "details", type: "string", required: false, size: LARGE_STRING_SIZE },
      { key: "user_id", type: "string", required: true, size: 64 },
      { key: "meta", type: "string", required: true, size: LARGE_STRING_SIZE },
    ],
  },
  {
    id: "achievements",
    name: "achievements",
    attributes: [
      { key: "user_id", type: "string", required: true, size: 64 },
      { key: "slug", type: "string", required: true, size: 128 },
      { key: "label", type: "string", required: true, size: 256 },
      { key: "description", type: "string", required: false, size: LARGE_STRING_SIZE },
      { key: "earned_at", type: "datetime", required: true },
    ],
  },
  {
    id: "site_metrics",
    name: "site_metrics",
    attributes: [
      { key: "visitor_count", type: "integer", required: true },
      { key: "launch_progress", type: "integer", required: false },
    ],
  },
  {
    id: "feedback",
    name: "feedback",
    attributes: [
      { key: "name", type: "string", required: true, size: 128 },
      { key: "university", type: "string", required: false, size: 256 },
      { key: "text", type: "string", required: true, size: LARGE_STRING_SIZE },
      { key: "approved", type: "boolean", required: true, default: false },
    ],
  },
  {
    id: "ai_usage",
    name: "ai_usage",
    attributes: [
      { key: "user_id", type: "string", required: true, size: 64 },
      { key: "date", type: "string", required: true, size: 10 },
    ],
  },
  {
    id: "ai_embeddings",
    name: "ai_embeddings",
    attributes: [
      { key: "file_id", type: "string", required: true, size: 64 },
      { key: "source_type", type: "string", required: true, size: 32 },
      { key: "source_label", type: "string", required: true, size: 512 },
      { key: "course_code", type: "string", required: false, size: 64 },
      { key: "department", type: "string", required: false, size: 128 },
      { key: "year", type: "integer", required: false },
      { key: "uploaded_by", type: "string", required: false, size: 64 },
      { key: "embedding_model", type: "string", required: true, size: 128 },
      { key: "chunk_index", type: "integer", required: true },
      { key: "text_chunk", type: "string", required: true, size: TEXT_CHUNK_SIZE },
      { key: "embedding", type: "float", required: true, array: true },
    ],
  },
  {
    id: "pdf_usage",
    name: "pdf_usage",
    attributes: [
      { key: "user_id", type: "string", required: true, size: 64 },
      { key: "date", type: "string", required: true, size: 10 },
    ],
  },
];

function isNotFoundError(error) {
  const code = error?.code ?? error?.response?.code;
  return code === 404 || /not found/i.test(String(error?.message ?? ""));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getMissingAttributes(targetAttributes, liveAttributes) {
  const existingKeys = new Set(liveAttributes.map((attribute) => attribute.key));
  return targetAttributes.filter((attribute) => !existingKeys.has(attribute.key));
}

function formatType(type, array) {
  return array ? `${type}[]` : type;
}

function printMismatchWarning(collectionId, target, live) {
  const mismatches = [];
  if (live.type !== target.type) {
    mismatches.push(`type live=${formatType(live.type, live.array)} target=${formatType(target.type, target.array)}`);
  }
  if (Boolean(live.required) !== Boolean(target.required)) {
    mismatches.push(`required live=${Boolean(live.required)} target=${Boolean(target.required)}`);
  }
  if (Boolean(live.array) !== Boolean(target.array)) {
    mismatches.push(`array live=${Boolean(live.array)} target=${Boolean(target.array)}`);
  }
  if (target.type === "string" && typeof target.size === "number" && live.size !== target.size) {
    mismatches.push(`size live=${live.size} target=${target.size}`);
  }
  if (
    (target.type === "integer" || target.type === "float") &&
    typeof target.min !== "undefined" &&
    live.min !== target.min
  ) {
    mismatches.push(`min live=${String(live.min)} target=${String(target.min)}`);
  }
  if (
    (target.type === "integer" || target.type === "float") &&
    typeof target.max !== "undefined" &&
    live.max !== target.max
  ) {
    mismatches.push(`max live=${String(live.max)} target=${String(target.max)}`);
  }
  if (mismatches.length > 0) {
    console.warn(
      `[warn] ${collectionId}.${target.key} exists but differs (${mismatches.join(", ")}). ` +
        "Script only creates missing attributes and does not mutate existing definitions.",
    );
    return 1;
  }
  return 0;
}

async function waitForAttributeAvailability(
  databases,
  databaseId,
  collectionId,
  key,
  options = {},
) {
  const timeoutMs = options.timeoutMs ?? 120000;
  const pollIntervalMs = options.pollIntervalMs ?? 2000;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const attribute = await databases.getAttribute(databaseId, collectionId, key);
      if (attribute.status === "available") {
        return attribute;
      }
      if (attribute.status === "failed" || attribute.status === "stuck") {
        throw new Error(
          `Attribute ${collectionId}.${key} failed with status "${attribute.status}": ${attribute.error || "unknown error"}`,
        );
      }
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }
    await sleep(pollIntervalMs);
  }

  throw new Error(`Timed out waiting for ${collectionId}.${key} to become available`);
}

async function createAttribute(databases, databaseId, collectionId, attribute) {
  switch (attribute.type) {
    case "string":
      return databases.createStringAttribute(
        databaseId,
        collectionId,
        attribute.key,
        attribute.size ?? STANDARD_STRING_SIZE,
        attribute.required,
        attribute.default,
        Boolean(attribute.array),
      );
    case "integer":
      return databases.createIntegerAttribute(
        databaseId,
        collectionId,
        attribute.key,
        attribute.required,
        attribute.min,
        attribute.max,
        attribute.default,
        Boolean(attribute.array),
      );
    case "boolean":
      return databases.createBooleanAttribute(
        databaseId,
        collectionId,
        attribute.key,
        attribute.required,
        attribute.default,
        Boolean(attribute.array),
      );
    case "datetime":
      return databases.createDatetimeAttribute(
        databaseId,
        collectionId,
        attribute.key,
        attribute.required,
        attribute.default,
        Boolean(attribute.array),
      );
    case "float":
      return databases.createFloatAttribute(
        databaseId,
        collectionId,
        attribute.key,
        attribute.required,
        attribute.min,
        attribute.max,
        attribute.default,
        Boolean(attribute.array),
      );
    default:
      throw new Error(`Unsupported attribute type "${attribute.type}" for ${collectionId}.${attribute.key}`);
  }
}

async function ensureCollectionExists(databases, databaseId, collection) {
  try {
    await databases.getCollection(databaseId, collection.id);
    return false;
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
    await databases.createCollection(databaseId, collection.id, collection.name);
    return true;
  }
}

async function syncCollection(databases, databaseId, collection) {
  const created = await ensureCollectionExists(databases, databaseId, collection);
  console.log(created ? `[create] collection ${collection.id}` : `[exists] collection ${collection.id}`);

  const liveAttributesResponse = await databases.listAttributes(databaseId, collection.id);
  const liveAttributes = liveAttributesResponse.attributes;
  const liveByKey = new Map(liveAttributes.map((attribute) => [attribute.key, attribute]));
  const missingAttributes = getMissingAttributes(collection.attributes, liveAttributes);

  let mismatchCount = 0;
  for (const attribute of collection.attributes) {
    const existing = liveByKey.get(attribute.key);
    if (existing) {
      mismatchCount += printMismatchWarning(collection.id, attribute, existing);
    }
  }

  for (const attribute of missingAttributes) {
    console.log(`[create] attribute ${collection.id}.${attribute.key} (${formatType(attribute.type, attribute.array)})`);
    await createAttribute(databases, databaseId, collection.id, attribute);
    await waitForAttributeAvailability(databases, databaseId, collection.id, attribute.key);
    console.log(`[ready] attribute ${collection.id}.${attribute.key}`);
  }

  if (missingAttributes.length === 0) {
    console.log(`[up-to-date] ${collection.id} has all required attributes`);
  }

  return {
    collectionId: collection.id,
    createdCollection: created,
    totalTargetAttributes: collection.attributes.length,
    createdAttributes: missingAttributes.length,
    mismatchCount,
    connected: mismatchCount === 0,
  };
}

function renderSchemaStatusSection(results) {
  const lines = [
    "## Schema Sync Status (Auto-generated)",
    "",
    "_This section is updated by `scripts/sync-appwrite-schema.js` when run with `--update-schema-md`._",
    "",
    "| Collection | Status | Created in run | Notes |",
    "|---|---|---:|---|",
  ];

  for (const result of results) {
    const status = result.connected ? "✅ Perfectly connected" : "⚠️ Connected with differences";
    const createdInRun = result.createdAttributes + (result.createdCollection ? 1 : 0);
    const notes = [
      result.createdCollection ? "collection created" : "collection existed",
      `${result.createdAttributes}/${result.totalTargetAttributes} missing attrs created`,
      result.mismatchCount > 0 ? `${result.mismatchCount} attr definition mismatch(es)` : "no mismatches detected",
    ].join("; ");

    lines.push(`| \`${result.collectionId}\` | ${status} | ${createdInRun} | ${notes} |`);
  }

  lines.push("");
  return lines.join("\n");
}

function upsertSchemaStatusBlock(markdown, statusSection) {
  const wrapped = `${STATUS_BLOCK_START}\n${statusSection}\n${STATUS_BLOCK_END}`;
  const startIndex = markdown.indexOf(STATUS_BLOCK_START);
  const endIndex = markdown.indexOf(STATUS_BLOCK_END);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const before = markdown.slice(0, startIndex).replace(/\s*$/, "");
    const after = markdown.slice(endIndex + STATUS_BLOCK_END.length).replace(/^\s*/, "");
    return `${before}\n\n${wrapped}\n\n${after}`.trimEnd() + "\n";
  }

  return `${markdown.trimEnd()}\n\n---\n\n${wrapped}\n`;
}

function updateSchemaDocWithStatus(results, filePath = DATABASE_SCHEMA_DOC_PATH) {
  const current = fs.readFileSync(filePath, "utf8");
  const statusSection = renderSchemaStatusSection(results);
  const next = upsertSchemaStatusBlock(current, statusSection);
  if (next !== current) {
    fs.writeFileSync(filePath, next, "utf8");
    console.log(`[update] wrote schema sync status to ${filePath}`);
  } else {
    console.log("[up-to-date] schema markdown status already current");
  }
}

async function main() {
  const shouldUpdateSchemaDoc = process.argv.includes("--update-schema-md");
  const databases = createAppwriteDatabasesClient();

  console.log(`Starting Appwrite schema sync for database "${DATABASE_ID}"`);
  const results = [];
  for (const collection of TARGET_SCHEMA) {
    results.push(await syncCollection(databases, DATABASE_ID, collection));
  }
  if (shouldUpdateSchemaDoc) {
    updateSchemaDocWithStatus(results);
  }
  console.log("Schema sync complete.");
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Schema sync failed:", error);
    process.exitCode = 1;
  });
}

module.exports = {
  DATABASE_ID,
  TARGET_SCHEMA,
  createAttribute,
  getMissingAttributes,
  isNotFoundError,
  renderSchemaStatusSection,
  syncCollection,
  updateSchemaDocWithStatus,
  upsertSchemaStatusBlock,
  waitForAttributeAvailability,
};
