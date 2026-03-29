import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import {
  checkDailyLimit,
  generateFlashcards,
  saveFlashcardsDocument,
  DAILY_FLASHCARD_LIMIT,
} from "@/lib/flashcards";
import { FLASHCARD_COUNT_OPTIONS, FLASHCARD_FIELD_MAX_LEN } from "@/lib/flashcards-constants";

function normalizeField(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, FLASHCARD_FIELD_MAX_LEN) : "";
}

export async function GET() {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await checkDailyLimit(user.id);
  return NextResponse.json({
    used: status.used,
    limit: status.limit,
    remaining: Math.max(status.limit - status.used, 0),
  });
}

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Login required" }, { status: 401 });
  }

  let body: { subject?: string; topic?: string; count?: number };
  try {
    body = await request.json();
  } catch (error) {
    console.error("[study] Invalid flashcards request body", error);
    return NextResponse.json(
      {
        error: "Invalid request body. Expected valid JSON.",
      },
      { status: 400 },
    );
  }

  const subject = normalizeField(body.subject);
  const topic = normalizeField(body.topic);
  const targetTopic = topic || subject;
  if (!targetTopic) {
    return NextResponse.json({ error: "Please provide a subject or topic." }, { status: 400 });
  }
  const finalSubject = subject || targetTopic;
  const requestedCount = typeof body.count === "number" ? body.count : FLASHCARD_COUNT_OPTIONS[0];
  const count = FLASHCARD_COUNT_OPTIONS.includes(requestedCount)
    ? requestedCount
    : FLASHCARD_COUNT_OPTIONS[0];

  const limitStatus = await checkDailyLimit(user.id);
  if (!limitStatus.allowed) {
    return NextResponse.json(
      {
        error: "Daily limit reached. Try again tomorrow.",
        limit: DAILY_FLASHCARD_LIMIT,
        used: limitStatus.used,
      },
      { status: 429 },
    );
  }

  try {
    const { flashcards, model } = await generateFlashcards({
      subject: finalSubject,
      topic: targetTopic,
      count,
    });

    if (!flashcards || flashcards.length === 0) {
      return NextResponse.json(
        { error: "Flashcard generator returned no cards. Please try again." },
        { status: 503 },
      );
    }

    let postSaveStatus = await checkDailyLimit(user.id);
    let saved = true;
    try {
      await saveFlashcardsDocument({
        userId: user.id,
        subject: finalSubject,
        topic: targetTopic,
        flashcards,
        model,
      });
      postSaveStatus = await checkDailyLimit(user.id);
    } catch (saveError) {
      saved = false;
      console.error("[study] Failed to persist flashcards", saveError);
      // Best-effort optimistic increment when persistence fails
      postSaveStatus = {
        allowed: postSaveStatus.allowed,
        used: Math.min(postSaveStatus.used + 1, DAILY_FLASHCARD_LIMIT),
        limit: postSaveStatus.limit,
        startOfDay: postSaveStatus.startOfDay,
      };
    }

    return NextResponse.json({
      flashcards,
      used: postSaveStatus.used,
      limit: postSaveStatus.limit,
      saved,
      count,
    });
  } catch (error) {
    console.error("[study] Failed to generate flashcards", error);
    return NextResponse.json({ error: "Failed to generate flashcards. Please try again." }, { status: 500 });
  }
}
