import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import {
  adminDatabases,
  DATABASE_ID,
  COLLECTION,
  Query,
  ID,
} from "@/lib/appwrite";

/** Maximum AI-generated PDFs per user per calendar day. */
const DAILY_LIMIT = 3;

/** Check how many documents a user has generated today. */
async function getDailyCount(userId: string, todayStr: string): Promise<number> {
  const db = adminDatabases();
  try {
    const res = await db.listDocuments(DATABASE_ID, COLLECTION.ai_usage, [
      Query.equal("user_id", userId),
      Query.equal("date", todayStr),
    ]);
    return res.total;
  } catch {
    // Collection may not exist yet — treat as zero
    return 0;
  }
}

/** Record a generation event for rate-limiting. */
async function recordGeneration(userId: string, todayStr: string): Promise<void> {
  const db = adminDatabases();
  try {
    await db.createDocument(DATABASE_ID, COLLECTION.ai_usage, ID.unique(), {
      user_id: userId,
      date: todayStr,
    });
  } catch (e) {
    console.error("[AI generate] Failed to record usage:", e);
  }
}

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI generation is not configured." }, { status: 503 });
  }

  let body: { topic?: string; paperContext?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const topic = (body.topic ?? "").trim();
  if (!topic || topic.length > 500) {
    return NextResponse.json({ error: "Topic must be 1–500 characters." }, { status: 400 });
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  // Enforce daily limit — founders are exempt
  let usedBefore = 0;
  if (user.role !== "founder") {
    usedBefore = await getDailyCount(user.id, todayStr);
    if (usedBefore >= DAILY_LIMIT) {
      return NextResponse.json(
        {
          error: `Daily limit of ${DAILY_LIMIT} AI-generated documents reached. Try again tomorrow.`,
          limitReached: true,
          remaining: 0,
        },
        { status: 429 },
      );
    }
  }

  try {
    const paperContext = (body.paperContext ?? "").slice(0, 2000);
    const contextSection = paperContext
      ? `\n\nReference material from uploaded syllabus/papers:\n${paperContext}`
      : "";

    const prompt = `You are an academic assistant helping a student prepare for exams.

Generate a concise, well-structured study summary document for the following topic:
"${topic}"${contextSection}

Format requirements:
- Start with a brief overview (2-3 sentences).
- List 5–8 key concepts with short explanations.
- Include a "Tips for Exam" section with 3–5 practical study tips.
- End with a "Quick Revision Checklist" of 5 bullet points.
- Use clear headings (## for sections, ### for sub-sections).
- Keep total length under 600 words.

Write in plain text with Markdown headings only (no HTML).`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024,
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      let groqError = `Groq request failed with status ${response.status}`;
      try {
        const payload = (await response.json()) as { error?: { message?: string } };
        if (payload.error?.message) {
          groqError = payload.error.message;
        }
      } catch {
        // ignore response parsing errors
      }
      throw new Error(groqError);
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content?.trim()
      || "## Overview\nI couldn’t generate the summary right now. Please try again in a moment.";

    // Record this generation for rate-limiting
    if (user.role !== "founder") {
      await recordGeneration(user.id, todayStr);
    }

    // Compute remaining quota using the pre-fetched count (avoids a second DB query)
    const remaining = user.role === "founder"
      ? null
      : Math.max(0, DAILY_LIMIT - (usedBefore + 1));

    return NextResponse.json({
      content,
      topic,
      generatedAt: new Date().toISOString(),
      remaining,
    });
  } catch (err) {
    console.error("[AI generate] Groq error:", err);
    return NextResponse.json({ error: "AI generation failed. Please try again." }, { status: 500 });
  }
}

/** GET: returns remaining daily quota for the current user. */
export async function GET() {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  if (user.role === "founder") {
    return NextResponse.json({ remaining: null, limit: null, isFounder: true });
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const used = await getDailyCount(user.id, todayStr);
  const remaining = Math.max(0, DAILY_LIMIT - used);
  return NextResponse.json({ remaining, limit: DAILY_LIMIT, isFounder: false });
}
