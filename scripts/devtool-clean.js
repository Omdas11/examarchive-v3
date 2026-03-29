#!/usr/bin/env node

/**
 * Devtool: Purge all Appwrite collections except `users`.
 *
 * This is intended for CI / IaC usage to guarantee a clean slate before
 * provisioning seed data. It loops through every collection in the configured
 * database and deletes all documents, skipping the `users` collection.
 *
 * Required env:
 *   - NEXT_PUBLIC_APPWRITE_ENDPOINT
 *   - NEXT_PUBLIC_APPWRITE_PROJECT_ID
 *   - APPWRITE_API_KEY
 *
 * Usage:
 *   node scripts/devtool-clean.js           # prompts for confirmation
 *   SKIP_CONFIRM=1 node scripts/devtool-clean.js   # non-interactive (CI)
 */

const readline = require("readline");
const { Client, Databases, Query } = require("node-appwrite");

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "examarchive";
const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const SKIP_CONFIRM = process.env.SKIP_CONFIRM === "1";
const PAGE_SIZE = 100;

function assertEnv() {
  const missing = [];
  if (!ENDPOINT) missing.push("NEXT_PUBLIC_APPWRITE_ENDPOINT");
  if (!PROJECT_ID) missing.push("NEXT_PUBLIC_APPWRITE_PROJECT_ID");
  if (!API_KEY) missing.push("APPWRITE_API_KEY");
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

function createAdminDatabases() {
  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
  return new Databases(client);
}

async function confirmPrompt(question) {
  if (SKIP_CONFIRM) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "yes");
    });
  });
}

async function purgeCollection(db, collectionId) {
  let deleted = 0;
  let offset = 0;
  while (true) {
    const { documents } = await db.listDocuments(DATABASE_ID, collectionId, [
      Query.limit(PAGE_SIZE),
      Query.offset(offset),
    ]);
    if (!documents.length) break;
    for (const doc of documents) {
      await db.deleteDocument(DATABASE_ID, collectionId, doc.$id);
      deleted += 1;
    }
    offset += documents.length;
  }
  return deleted;
}

async function run() {
  try {
    assertEnv();
    const db = createAdminDatabases();

    const { collections } = await db.listCollections(DATABASE_ID, [Query.limit(100)]);
    const toPurge = collections.filter((c) => c.$id !== "users");

    const ok = await confirmPrompt(
      `This will delete ALL documents from ${toPurge.length} collections (excluding users) in database "${DATABASE_ID}". Type "yes" to continue: `,
    );
    if (!ok) {
      console.log("Aborted.");
      process.exit(1);
    }

    let totalDeleted = 0;
    for (const col of toPurge) {
      const deleted = await purgeCollection(db, col.$id);
      totalDeleted += deleted;
      console.log(`[purged] ${col.$id}: ${deleted} document(s) removed`);
    }

    console.log(`\n✅ Done. Removed ${totalDeleted} documents across ${toPurge.length} collection(s).`);
  } catch (err) {
    console.error("Purge failed:", err.message || err);
    process.exit(1);
  }
}

run();

