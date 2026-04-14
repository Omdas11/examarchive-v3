#!/usr/bin/env node
/* eslint-disable no-console */

const { Client, Databases, Query } = require("node-appwrite");

const DATABASE_ID = "examarchive";
const USERS_COLLECTION_ID = "users";
const PAGE_LIMIT = 100;

const ROLE_MAP = {
  guest: "student",
  viewer: "student",
  visitor: "student",
  explorer: "student",
  curator: "specialist",
  verified_contributor: "specialist",
  admin: "moderator",
  maintainer: "moderator",
};

function getEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function normalizeRole(role) {
  const raw = typeof role === "string" ? role : "student";
  return ROLE_MAP[raw] || raw;
}

function getInitialCreditsByRole(role) {
  return role === "moderator" || role === "founder" ? 1000 : 100;
}

async function main() {
  const endpoint = getEnv("NEXT_PUBLIC_APPWRITE_ENDPOINT");
  const project = getEnv("NEXT_PUBLIC_APPWRITE_PROJECT_ID");
  const key = getEnv("APPWRITE_API_KEY");

  const client = new Client().setEndpoint(endpoint).setProject(project).setKey(key);
  const db = new Databases(client);

  let cursor = null;
  let processed = 0;
  let updated = 0;

  while (true) {
    const queries = [Query.limit(PAGE_LIMIT), Query.orderAsc("$id")];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const { documents } = await db.listDocuments(DATABASE_ID, USERS_COLLECTION_ID, queries);
    if (!documents.length) break;

    for (const doc of documents) {
      processed += 1;
      const role = normalizeRole(doc.role);
      const aiCredits = Number.isFinite(Number(doc.ai_credits)) ? Number(doc.ai_credits) : null;
      const referredUsersCount = Number.isFinite(Number(doc.referred_users_count))
        ? Number(doc.referred_users_count)
        : 0;
      const referralPath = Array.isArray(doc.referral_path) ? doc.referral_path : [];
      const oneLevelPath = referralPath.length > 0 ? [String(referralPath[0])] : [];

      const patch = {};
      if (role !== doc.role) patch.role = role;
      if (doc.primary_role !== role) patch.primary_role = role;
      if (aiCredits === null) patch.ai_credits = getInitialCreditsByRole(role);
      if (!Array.isArray(doc.referral_path) || referralPath.length > 1) patch.referral_path = oneLevelPath;
      if (doc.referred_users_count === undefined || doc.referred_users_count === null) {
        patch.referred_users_count = referredUsersCount;
      }

      if (Object.keys(patch).length > 0) {
        await db.updateDocument(DATABASE_ID, USERS_COLLECTION_ID, doc.$id, patch);
        updated += 1;
      }
    }

    cursor = documents[documents.length - 1].$id;
    if (documents.length < PAGE_LIMIT) break;
  }

  console.log(`[migrate] processed=${processed} updated=${updated}`);
}

main().catch((error) => {
  console.error("[migrate] failed:", error);
  process.exit(1);
});
