#!/usr/bin/env node

/**
 * Syncs docs/SYLLABUS_REGISTRY.md into an Appwrite collection so syllabus
 * metadata can be read dynamically at runtime.
 *
 * Usage:
 *   node scripts/sync-appwrite-syllabus-registry.js
 *   node scripts/sync-appwrite-syllabus-registry.js --dry-run
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createAppwriteDatabasesClient } = require("./appwrite-schema-setup");
const {
  createAttribute,
  getMissingAttributes,
  isNotFoundError,
  waitForAttributeAvailability,
} = require("./sync-appwrite-schema");

const DATABASE_ID = "examarchive";
const COLLECTION_ID = "syllabus_registry";
const REGISTRY_MD_PATH = path.resolve(__dirname, "../docs/SYLLABUS_REGISTRY.md");
const STATUS_BLOCK_START = "<!-- SYLLABUS_REGISTRY_STATUS_START -->";
const STATUS_BLOCK_END = "<!-- SYLLABUS_REGISTRY_STATUS_END -->";
const DEFAULT_STRING_SIZE = 512;
const PROGRAMME_SIZE = 64;
const UNIVERSITY_SIZE = 256;
const CATEGORY_SIZE = 32;
const PAPER_CODE_SIZE = 64;

const BASE_ATTRIBUTES = [
  { key: "paper_code", type: "string", required: true, size: PAPER_CODE_SIZE },
  { key: "paper_name", type: "string", required: true, size: DEFAULT_STRING_SIZE },
  { key: "semester", type: "integer", required: false },
  { key: "subject", type: "string", required: true, size: DEFAULT_STRING_SIZE },
  { key: "credits", type: "integer", required: false },
  { key: "programme", type: "string", required: true, size: PROGRAMME_SIZE },
  { key: "university", type: "string", required: true, size: UNIVERSITY_SIZE },
  { key: "category", type: "string", required: false, size: CATEGORY_SIZE },
  { key: "contact_hours", type: "integer", required: false },
  { key: "full_marks", type: "integer", required: false },
];

const NUMERIC_FIELDS = new Set(["semester", "credits", "contact_hours", "full_marks"]);

function parseMarkdownTable(md) {
  const lines = md
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|") && l.endsWith("|"));

  if (lines.length < 2) return [];

  const header = lines[0]
    .split("|")
    .map((h) => h.trim())
    .filter(Boolean)
    .map((h) => h.toLowerCase().replace(/\s+/g, "_"));

  const records = [];

  for (let i = 2; i < lines.length; i++) {
    const cells = lines[i]
      .split("|")
      .map((c) => c.trim())
      .filter((_, idx, arr) => idx !== 0 && idx !== arr.length - 1);

    if (cells.length === 0) continue;

    const record = {};
    header.forEach((key, idx) => {
      const raw = cells[idx] ?? "";
      if (NUMERIC_FIELDS.has(key)) {
        if (raw === "" || raw === "-") {
          record[key] = null;
        } else {
          const n = Number(raw);
          record[key] = Number.isFinite(n) ? n : null;
        }
      } else {
        record[key] = raw === "-" ? "" : raw;
      }
    });

    if (record.paper_code) {
      records.push(record);
    }
  }

  return records;
}

function buildAttributeDefinitions(records) {
  const attributes = new Map();
  for (const attribute of BASE_ATTRIBUTES) {
    attributes.set(attribute.key, attribute);
  }

  for (const record of records) {
    Object.keys(record).forEach((key) => {
      if (attributes.has(key)) return;
      const type = NUMERIC_FIELDS.has(key) ? "integer" : "string";
      const size = type === "string" ? DEFAULT_STRING_SIZE : undefined;
      attributes.set(key, { key, type, required: false, size });
    });
  }

  return Array.from(attributes.values());
}

async function ensureCollection(databases) {
  try {
    await databases.getCollection(DATABASE_ID, COLLECTION_ID);
    return false;
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
    await databases.createCollection(DATABASE_ID, COLLECTION_ID, COLLECTION_ID);
    return true;
  }
}

async function syncAttributes(databases, targetAttributes) {
  const liveAttributesResponse = await databases.listAttributes(DATABASE_ID, COLLECTION_ID);
  const liveAttributes = liveAttributesResponse.attributes;
  const missing = getMissingAttributes(targetAttributes, liveAttributes);
  let created = 0;

  for (const attribute of missing) {
    await createAttribute(databases, DATABASE_ID, COLLECTION_ID, attribute);
    await waitForAttributeAvailability(databases, DATABASE_ID, COLLECTION_ID, attribute.key);
    created += 1;
  }

  return { created, totalMissing: missing.length };
}

function sanitizeRecord(record, attributeKeys) {
  const payload = {};
  for (const key of attributeKeys) {
    if (typeof record[key] === "undefined") continue;
    payload[key] = record[key];
  }
  return payload;
}

function generateDocumentId(paperCode) {
  const normalized = String(paperCode).toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  const compact = normalized.replace(/-+/g, "-").replace(/^-|-$/g, "") || "paper";
  const hash = crypto.createHash("sha1").update(String(paperCode)).digest("hex").slice(0, 8);
  const trimmed = compact.slice(0, 24);
  return `${trimmed}-${hash}`;
}

function isDocumentConflict(error) {
  const code = error?.code ?? error?.response?.code;
  const type = error?.type ?? error?.response?.type;
  return code === 409 || type === "document_already_exists";
}

async function upsertRegistryRecord(databases, record, attributeKeys) {
  const documentId = generateDocumentId(record.paper_code);
  const payload = sanitizeRecord(record, attributeKeys);

  try {
    await databases.createDocument(DATABASE_ID, COLLECTION_ID, documentId, payload);
    return { documentId, created: true, updated: false };
  } catch (error) {
    if (!isDocumentConflict(error)) {
      throw error;
    }
    await databases.updateDocument(DATABASE_ID, COLLECTION_ID, documentId, payload);
    return { documentId, created: false, updated: true };
  }
}

async function syncRegistry(databases, records, attributeDefs) {
  const attributeKeys = attributeDefs.map((a) => a.key);
  const results = { created: 0, updated: 0 };

  for (const record of records) {
    const { created, updated } = await upsertRegistryRecord(databases, record, attributeKeys);
    if (created) results.created += 1;
    if (updated) results.updated += 1;
  }

  return results;
}

function renderStatusBlock(status) {
  const lines = [
    STATUS_BLOCK_START,
    `> Sync status: ${status.ok ? "✅ Synced" : "⚠️ Failed"}${status.dryRun ? " (dry-run)" : ""}`,
    `> Last run: ${status.runAt}`,
    `> Records in markdown: ${status.records}`,
    `> Synced: created ${status.created}, updated ${status.updated}`,
    `> Target: database \`${DATABASE_ID}\`, collection \`${COLLECTION_ID}\``,
    STATUS_BLOCK_END,
  ];
  return lines.join("\n");
}

function upsertStatusBlock(markdown, statusBlock) {
  const startIdx = markdown.indexOf(STATUS_BLOCK_START);
  const endIdx = markdown.indexOf(STATUS_BLOCK_END);

  if (startIdx === -1 || endIdx === -1) {
    return `${statusBlock}\n\n${markdown}`;
  }

  return `${markdown.slice(0, startIdx)}${statusBlock}${markdown.slice(endIdx + STATUS_BLOCK_END.length)}`;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const markdown = fs.readFileSync(REGISTRY_MD_PATH, "utf8");
  const records = parseMarkdownTable(markdown);

  if (!records.length) {
    throw new Error("No rows found in SYLLABUS_REGISTRY.md");
  }

  const attributeDefs = buildAttributeDefinitions(records);

  if (dryRun) {
    console.log(
      `[dry-run] Parsed ${records.length} records and ${attributeDefs.length} attributes from SYLLABUS_REGISTRY.md`,
    );
    return;
  }

  const databases = createAppwriteDatabasesClient();
  const createdCollection = await ensureCollection(databases);
  const attributeResult = await syncAttributes(databases, attributeDefs);
  const { created, updated } = await syncRegistry(databases, records, attributeDefs);

  const statusBlock = renderStatusBlock({
    ok: true,
    dryRun: false,
    runAt: new Date().toISOString(),
    records: records.length,
    created,
    updated,
  });

  const nextMarkdown = upsertStatusBlock(markdown, statusBlock);
  fs.writeFileSync(REGISTRY_MD_PATH, nextMarkdown);

  console.log(
    `Syllabus registry sync complete. collectionCreated=${createdCollection} attributesCreated=${attributeResult.created} recordsCreated=${created} recordsUpdated=${updated}`,
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Syllabus registry sync failed:", error);
    process.exitCode = 1;
  });
}

module.exports = {
  BASE_ATTRIBUTES,
  COLLECTION_ID,
  DATABASE_ID,
  NUMERIC_FIELDS,
  buildAttributeDefinitions,
  generateDocumentId,
  parseMarkdownTable,
  renderStatusBlock,
  sanitizeRecord,
  syncRegistry,
  syncAttributes,
  upsertRegistryRecord,
  upsertStatusBlock,
};
