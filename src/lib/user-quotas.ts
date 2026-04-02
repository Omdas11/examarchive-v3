import { adminDatabases, COLLECTION, DATABASE_ID, Query } from "@/lib/appwrite";

const DEFAULT_DAY_START = "1970-01-01";

export interface UserQuotaRecord {
  notes_generated_today: number;
  papers_solved_today: number;
  last_generation_date: string;
}

function getTodayDateKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function toInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed));
  }
  return 0;
}

function normalizeDate(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return DEFAULT_DAY_START;
  const dateKey = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : DEFAULT_DAY_START;
}

async function getQuotaDocument(userId: string) {
  const db = adminDatabases();
  try {
    const doc = await db.getDocument(DATABASE_ID, COLLECTION.user_quotas, userId);
    return doc;
  } catch {
    const res = await db.listDocuments(DATABASE_ID, COLLECTION.user_quotas, [
      Query.equal("user_id", userId),
      Query.orderDesc("$createdAt"),
      Query.limit(1),
    ]);
    return res.documents[0] ?? null;
  }
}

export async function checkAndResetQuotas(userId: string): Promise<UserQuotaRecord> {
  const db = adminDatabases();
  const today = getTodayDateKey();
  const existing = await getQuotaDocument(userId);

  if (!existing) {
    try {
      // Use deterministic doc id = userId to guarantee one quota record per user.
      await db.createDocument(DATABASE_ID, COLLECTION.user_quotas, userId, {
        user_id: userId,
        notes_generated_today: 0,
        papers_solved_today: 0,
        last_generation_date: today,
      });
    } catch {
      // Concurrent create race: allow read path below to settle on existing record.
    }
    const settled = await getQuotaDocument(userId);
    if (settled) {
      return {
        notes_generated_today: toInt(settled.notes_generated_today),
        papers_solved_today: toInt(settled.papers_solved_today),
        last_generation_date: normalizeDate(settled.last_generation_date),
      };
    }
    return {
      notes_generated_today: 0,
      papers_solved_today: 0,
      last_generation_date: today,
    };
  }

  const lastGenerationDate = normalizeDate(existing.last_generation_date);
  const notesCount = toInt(existing.notes_generated_today);
  const papersCount = toInt(existing.papers_solved_today);

  if (lastGenerationDate < today) {
    await db.updateDocument(DATABASE_ID, COLLECTION.user_quotas, existing.$id, {
      notes_generated_today: 0,
      papers_solved_today: 0,
      last_generation_date: today,
    });
    return {
      notes_generated_today: 0,
      papers_solved_today: 0,
      last_generation_date: today,
    };
  }

  return {
    notes_generated_today: notesCount,
    papers_solved_today: papersCount,
    last_generation_date: lastGenerationDate,
  };
}

export async function incrementQuotaCounter(
  userId: string,
  counter: "notes_generated_today" | "papers_solved_today",
): Promise<UserQuotaRecord> {
  const db = adminDatabases();
  const existing = await getQuotaDocument(userId);
  const today = getTodayDateKey();

  if (!existing) {
    const payload = {
      user_id: userId,
      notes_generated_today: counter === "notes_generated_today" ? 1 : 0,
      papers_solved_today: counter === "papers_solved_today" ? 1 : 0,
      last_generation_date: today,
    };
    try {
      // Use deterministic doc id = userId to avoid duplicate records during concurrent requests.
      await db.createDocument(DATABASE_ID, COLLECTION.user_quotas, userId, payload);
      return payload;
    } catch {
      const settled = await getQuotaDocument(userId);
      if (!settled) return payload;
      const settledLastGenerationDate = normalizeDate(settled.last_generation_date);
      const settledNotes = settledLastGenerationDate < today ? 0 : toInt(settled.notes_generated_today);
      const settledPapers = settledLastGenerationDate < today ? 0 : toInt(settled.papers_solved_today);
      const nextPayload = {
        notes_generated_today: counter === "notes_generated_today" ? settledNotes + 1 : settledNotes,
        papers_solved_today: counter === "papers_solved_today" ? settledPapers + 1 : settledPapers,
        last_generation_date: today,
      };
      await db.updateDocument(DATABASE_ID, COLLECTION.user_quotas, settled.$id, nextPayload);
      return nextPayload;
    }
  }

  const lastGenerationDate = normalizeDate(existing.last_generation_date);
  const baseNotes = lastGenerationDate < today ? 0 : toInt(existing.notes_generated_today);
  const basePapers = lastGenerationDate < today ? 0 : toInt(existing.papers_solved_today);

  const payload = {
    notes_generated_today: counter === "notes_generated_today" ? baseNotes + 1 : baseNotes,
    papers_solved_today: counter === "papers_solved_today" ? basePapers + 1 : basePapers,
    last_generation_date: today,
  };

  await db.updateDocument(DATABASE_ID, COLLECTION.user_quotas, existing.$id, payload);
  return payload;
}
