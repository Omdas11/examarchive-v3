import { adminDatabases, adminFunctions, COLLECTION, DATABASE_ID, ID, Query } from "./appwrite";

export const DAILY_FLASHCARD_LIMIT = 5;
export const FLASHCARDS_FUNCTION_ID = "ai-flashcards";

export function startOfTodayISOString(now: Date = new Date()): string {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

export async function checkDailyLimit(userId: string) {
  const db = adminDatabases();
  const startOfDay = startOfTodayISOString();

  try {
    const res = await db.listDocuments(DATABASE_ID, COLLECTION.ai_flashcards, [
      Query.equal("userId", userId),
      Query.greaterThanEqual("$createdAt", startOfDay),
    ]);

    const used = res.total ?? 0;
    return {
      allowed: used < DAILY_FLASHCARD_LIMIT,
      used,
      limit: DAILY_FLASHCARD_LIMIT,
      startOfDay,
    };
  } catch (error) {
    console.error("[flashcards] Failed to read daily limit", error);
    return {
      allowed: false,
      used: 0,
      limit: DAILY_FLASHCARD_LIMIT,
      startOfDay,
    };
  }
}

export interface FlashcardPayload {
  question: string;
  answer: string;
  hint?: string;
}

export interface FlashcardSavePayload {
  userId: string;
  subject: string;
  topic: string;
  flashcards: FlashcardPayload[];
  model?: string;
}

export async function runFlashcardsFunction(payload: { subject: string; topic: string }) {
  const functions = adminFunctions();
  let execution;
  try {
    execution = await functions.createExecution(FLASHCARDS_FUNCTION_ID, JSON.stringify(payload), false);
  } catch (error) {
    console.error("[flashcards] Failed to trigger ai-flashcards function", error);
    throw new Error("Flashcard generator is currently unavailable. Please try again later.");
  }

  let flashcards: FlashcardPayload[] = [];
  if (execution.responseBody) {
    try {
      const parsed = JSON.parse(execution.responseBody);
      if (Array.isArray(parsed)) {
        flashcards = parsed;
      }
    } catch (error) {
      console.error("[flashcards] Failed to parse flashcards response", {
        error,
        responseBody: execution.responseBody?.slice(0, 500),
      });
      flashcards = [];
    }
  }

  return { execution, flashcards };
}

export async function saveFlashcardsDocument(data: FlashcardSavePayload) {
  const db = adminDatabases();
  const documentPayload = {
    userId: data.userId,
    payload: JSON.stringify({
      subject: data.subject,
      topic: data.topic,
      flashcards: data.flashcards,
      generatedAt: new Date().toISOString(),
    }),
    model: data.model ?? "ai-flashcards",
    tags: [data.subject],
  };

  return db.createDocument(DATABASE_ID, COLLECTION.ai_flashcards, ID.unique(), documentPayload);
}
