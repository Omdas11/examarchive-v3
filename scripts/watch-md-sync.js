#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const chokidar = require("chokidar");
const { createAppwriteDatabasesClient } = require("./appwrite-schema-setup");
const { ensureMasterNotesPrompt, MASTER_NOTES_PROMPT_PATH } = require("./ensure-master-notes-prompt");
const { TARGET_SCHEMA, DATABASE_ID, syncCollection } = require("./sync-appwrite-schema");
const {
  hashCoreContent,
  parseDatabaseSchemaMarkdown,
  renderSyncRemarks,
  upsertSyncRemarks,
} = require("./md-sync-utils");

const DATABASE_SCHEMA_MD_PATH = path.resolve(__dirname, "../DATABASE_SCHEMA.md");
const WATCH_PATHS = [DATABASE_SCHEMA_MD_PATH, MASTER_NOTES_PROMPT_PATH];
const fileHashes = new Map();
const syncing = new Set();

function getOverallStatus(connectedCount, errorCount) {
  if (errorCount === 0) return "Success";
  if (connectedCount > 0) return "Partial";
  return "Failed";
}

async function syncFromDatabaseSchemaMarkdown(filePath) {
  const markdown = fs.readFileSync(filePath, "utf8");
  const parsed = parseDatabaseSchemaMarkdown(markdown);
  const parsedById = new Map(parsed.map((collection) => [collection.id, collection]));
  const effectiveSchema = TARGET_SCHEMA.map((collection) => parsedById.get(collection.id) || collection);
  const databases = createAppwriteDatabasesClient();
  const connected = [];
  const errors = [];

  for (const collection of effectiveSchema) {
    try {
      await syncCollection(databases, DATABASE_ID, collection);
      connected.push(`${collection.id} updated successfully.`);
    } catch (error) {
      errors.push(`Failed to sync ${collection.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const overallStatus = getOverallStatus(connected.length, errors.length);
  const remarks = renderSyncRemarks({
    timestamp: new Date().toISOString(),
    overallStatus,
    connected,
    errors,
  });
  fs.writeFileSync(filePath, upsertSyncRemarks(markdown, remarks), "utf8");
}

function syncMasterNotesPromptMarkdown(filePath) {
  const markdown = fs.readFileSync(filePath, "utf8");
  const remarks = renderSyncRemarks({
    timestamp: new Date().toISOString(),
    overallStatus: "Success",
    connected: ["MASTER_NOTES_PROMPT.md updated successfully."],
    errors: [],
  });
  fs.writeFileSync(filePath, upsertSyncRemarks(markdown, remarks), "utf8");
}

async function onFileChange(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  const nextHash = hashCoreContent(content);
  const prevHash = fileHashes.get(filePath);
  if (prevHash && prevHash === nextHash) {
    return;
  }

  if (syncing.has(filePath)) return;
  syncing.add(filePath);
  try {
    if (path.resolve(filePath) === path.resolve(DATABASE_SCHEMA_MD_PATH)) {
      await syncFromDatabaseSchemaMarkdown(filePath);
    } else if (path.resolve(filePath) === path.resolve(MASTER_NOTES_PROMPT_PATH)) {
      syncMasterNotesPromptMarkdown(filePath);
    }
    const updatedContent = fs.readFileSync(filePath, "utf8");
    fileHashes.set(filePath, hashCoreContent(updatedContent));
  } finally {
    syncing.delete(filePath);
  }
}

function initializeHashes() {
  ensureMasterNotesPrompt();
  for (const filePath of WATCH_PATHS) {
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf8");
    fileHashes.set(filePath, hashCoreContent(content));
  }
}

function startWatcher() {
  initializeHashes();
  const watcher = chokidar.watch(WATCH_PATHS, { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 200 } });
  watcher.on("change", (filePath) => {
    onFileChange(filePath).catch((error) => {
      console.error("[md-sync] watcher error:", error);
    });
  });
  console.log("[md-sync] Watching DATABASE_SCHEMA.md and MASTER_NOTES_PROMPT.md");
}

if (require.main === module) {
  startWatcher();
}

module.exports = {
  onFileChange,
  startWatcher,
};
