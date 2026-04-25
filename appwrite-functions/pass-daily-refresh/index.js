/* eslint-disable no-console */
/**
 * pass-daily-refresh — Appwrite Scheduled Function
 *
 * Runs daily (e.g. "0 0 * * *" = 00:00 UTC) to expire stale passes.
 *
 * What it does:
 *  1. Lists all `user_passes` documents with status="active" and expires_at < now.
 *  2. Marks each one as status="expired".
 *
 * Note: This function does NOT automatically credit electrons.
 * Users must actively click "Claim" in the UI via POST /api/payments/claim-daily.
 *
 * Environment variables (all must be set in Appwrite Console → Function → Settings):
 *   APPWRITE_FUNCTION_API_KEY  — server-side API key with database write permissions
 *   APPWRITE_ENDPOINT          — e.g. https://cloud.appwrite.io/v1
 *   NEXT_PUBLIC_APPWRITE_PROJECT_ID — Appwrite project ID
 *   DATABASE_ID                — defaults to "examarchive"
 */

const { Client, Databases, Query } = require("node-appwrite");

const DATABASE_ID = process.env.DATABASE_ID || "examarchive";
const COLLECTION_USER_PASSES = "user_passes";
const PAGE_LIMIT = 100;

function createAdminClient() {
  const endpoint =
    process.env.APPWRITE_ENDPOINT ||
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ||
    "https://cloud.appwrite.io/v1";
  const projectId =
    process.env.APPWRITE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ||
    "";
  const apiKey = process.env.APPWRITE_FUNCTION_API_KEY || process.env.APPWRITE_API_KEY || "";

  if (!projectId || !apiKey) {
    throw new Error(
      "Missing required environment variables: APPWRITE_PROJECT_ID (or NEXT_PUBLIC_APPWRITE_PROJECT_ID), APPWRITE_FUNCTION_API_KEY (or APPWRITE_API_KEY)",
    );
  }

  return new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
}

/**
 * Main entry point called by Appwrite Functions runtime.
 * The `context` object provides `req`, `res`, and `log`/`error` helpers.
 */
module.exports = async function (context) {
  const log = context?.log ?? console.log;
  const logError = context?.error ?? console.error;

  try {
    const client = createAdminClient();
    const db = new Databases(client);

    const now = new Date().toISOString();
    let expired = 0;
    let cursor = null;

    log(`[pass-daily-refresh] Starting pass expiry check. now=${now}`);

    // Paginate through all active passes that have expired
    for (;;) {
      const queries = [
        Query.equal("status", "active"),
        Query.lessThan("expires_at", now),
        Query.limit(PAGE_LIMIT),
      ];
      if (cursor) {
        queries.push(Query.cursorAfter(cursor));
      }

      const { documents } = await db.listDocuments(DATABASE_ID, COLLECTION_USER_PASSES, queries);

      if (documents.length === 0) break;

      for (const doc of documents) {
        try {
          await db.updateDocument(DATABASE_ID, COLLECTION_USER_PASSES, doc.$id, {
            status: "expired",
          });
          expired += 1;
        } catch (err) {
          logError(`[pass-daily-refresh] Failed to expire pass ${doc.$id}:`, err);
        }
      }

      if (documents.length < PAGE_LIMIT) break;
      cursor = documents[documents.length - 1].$id;
    }

    log(`[pass-daily-refresh] Done. Expired ${expired} pass(es).`);

    if (context?.res) {
      return context.res.json({ ok: true, expired });
    }
  } catch (error) {
    logError("[pass-daily-refresh] Fatal error:", error);
    if (context?.res) {
      return context.res.json({ ok: false, error: String(error) }, 500);
    }
    process.exitCode = 1;
  }
};
