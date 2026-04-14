import { AppwriteException } from "node-appwrite";
import { adminDatabases, COLLECTION, DATABASE_ID } from "@/lib/appwrite";

const LOCK_PREFIX = "electron_lock_";
const LOCK_USER_PREFIX = "__electron_lock__";
// Sentinel date used only for synthetic lock rows in ai_usage.
const LOCK_MARKER_DATE = "1970-01-01";
const LOCK_TTL_MS = 30_000;
const MAX_LOCK_ID_USER_SEGMENT_LENGTH = 36 - LOCK_PREFIX.length;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function lockDocumentId(userId: string): string {
  if (!userId.trim()) {
    throw new Error("ELECTRON_BALANCE_LOCK_INVALID_USER_ID");
  }
  const normalized =
    userId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, MAX_LOCK_ID_USER_SEGMENT_LENGTH);
  return `${LOCK_PREFIX}${normalized}`;
}

export async function withElectronBalanceLock<T>(
  userId: string,
  fn: () => Promise<T>,
  maxAttempts = 30,
): Promise<T> {
  const db = adminDatabases();
  const lockId = lockDocumentId(userId);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await db.createDocument(DATABASE_ID, COLLECTION.ai_usage, lockId, {
        user_id: `${LOCK_USER_PREFIX}${userId}`,
        date: LOCK_MARKER_DATE,
      });
      try {
        return await fn();
      } finally {
        await db.deleteDocument(DATABASE_ID, COLLECTION.ai_usage, lockId).catch(() => undefined);
      }
    } catch (error) {
      if (!(error instanceof AppwriteException) || error.code !== 409) {
        throw error;
      }

      try {
        const existingLock = await db.getDocument(DATABASE_ID, COLLECTION.ai_usage, lockId);
        const createdAtRaw = typeof existingLock.$createdAt === "string" ? existingLock.$createdAt : "";
        const createdAtMs = createdAtRaw ? Date.parse(createdAtRaw) : NaN;
        const lockAgeMs = Number.isFinite(createdAtMs) ? Date.now() - createdAtMs : NaN;
        if (Number.isFinite(lockAgeMs) && lockAgeMs > LOCK_TTL_MS) {
          await db.deleteDocument(DATABASE_ID, COLLECTION.ai_usage, lockId).catch(() => undefined);
          continue;
        }
      } catch {
        // best effort: if lock lookup fails, continue retry with backoff
      }

      if (attempt === maxAttempts) {
        throw new Error("ELECTRON_BALANCE_LOCK_TIMEOUT");
      }
      await sleep(Math.min(150 * attempt, 1_000));
    }
  }

  throw new Error("ELECTRON_BALANCE_LOCK_TIMEOUT");
}
