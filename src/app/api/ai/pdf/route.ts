import { NextResponse, type NextRequest } from "next/server";
import { adminDatabases, COLLECTION, DATABASE_ID, Query, ID } from "@/lib/appwrite";
import { getServerUser } from "@/lib/auth";
import { generatePDF, markdownToHTML } from "@/lib/pdf-generator";
import { getNoteLengthTargets, normalizeNoteLength, type NoteLength } from "@/lib/note-length";

const MAX_PAGES = 8;
const PDF_DAILY_LIMIT = 5;
const TOPIC_MAX_LENGTH = 500;
const CONTENT_MAX_LENGTH = 100_000;

function isAdminPlus(role: string): boolean {
  return role === "admin" || role === "founder";
}

function normalizePageLength(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  const rounded = Math.floor(n);
  if (rounded < 1) return 1;
  if (rounded > MAX_PAGES) return MAX_PAGES;
  return rounded;
}

async function getDailyPdfCount(userId: string, todayStr: string): Promise<number> {
  const db = adminDatabases();
  try {
    const res = await db.listDocuments(DATABASE_ID, COLLECTION.pdf_usage, [
      Query.equal("user_id", userId),
      Query.equal("date", todayStr),
    ]);
    return res.total;
  } catch {
    return 0;
  }
}

async function recordPdfGeneration(userId: string, todayStr: string): Promise<void> {
  const db = adminDatabases();
  try {
    await db.createDocument(DATABASE_ID, COLLECTION.pdf_usage, ID.unique(), {
      user_id: userId,
      date: todayStr,
    });
  } catch (e) {
    console.error("[PDF generate] Failed to record usage:", e);
  }
}

/**
 * POST /api/ai/pdf
 * Generate a PDF from markdown content.
 * This endpoint is called after content generation to create the actual PDF file.
 */
export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  let body: {
    content?: string;
    topic?: string;
    pageLength?: number;
    noteLength?: NoteLength;
    model?: string;
    modelLabel?: string;
    generatedAt?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const rawContent = typeof body.content === "string" ? body.content : "";
  const rawTopic = typeof body.topic === "string" ? body.topic : "";
  const content = rawContent.trim();
  const topic = (rawTopic || "Document").trim();
  const noteLength = normalizeNoteLength(body.noteLength);
  const pageLength = normalizePageLength(body.pageLength ?? getNoteLengthTargets(noteLength).maxPages);

  if (!content) {
    return NextResponse.json({ error: "Content is required." }, { status: 400 });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    return NextResponse.json(
      {
        error: "Content too long. Please limit to 100,000 characters.",
        code: "CONTENT_TOO_LONG",
      },
      { status: 413 },
    );
  }
  if (topic.length > TOPIC_MAX_LENGTH) {
    return NextResponse.json({ error: "Topic must be 1–500 characters." }, { status: 400 });
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  let usedBefore = 0;
  if (!isAdminPlus(user.role)) {
    usedBefore = await getDailyPdfCount(user.id, todayStr);
    if (usedBefore >= PDF_DAILY_LIMIT) {
      return NextResponse.json(
        {
          error: "Daily PDF limit reached. Please try again tomorrow.",
          code: "PDF_DAILY_LIMIT_REACHED",
          limit: PDF_DAILY_LIMIT,
          remaining: 0,
        },
        { status: 429 },
      );
    }
  }

  try {
    // Convert markdown to HTML
    const html = markdownToHTML(content);

    // Generate PDF with strict page limit
    const { buffer } = await generatePDF({
      html,
      maxPages: pageLength,
      title: topic,
      meta: {
        topic,
        model: body.model,
        modelLabel: body.modelLabel,
        generatedAt: body.generatedAt,
      },
    });

    // Return PDF as a downloadable file
    const filename = `${topic.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`;

    if (!isAdminPlus(user.role)) {
      await recordPdfGeneration(user.id, todayStr);
    }
    const remaining = isAdminPlus(user.role)
      ? null
      : Math.max(0, PDF_DAILY_LIMIT - (usedBefore + 1));

    const response = new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.length.toString(),
      },
    });

    if (!isAdminPlus(user.role)) {
      response.headers.set("X-RateLimit-Limit", PDF_DAILY_LIMIT.toString());
      response.headers.set("X-RateLimit-Remaining", remaining?.toString() ?? "0");
    }

    return response;
  } catch (error) {
    console.error("[PDF Generation] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF. Please try again." },
      { status: 500 }
    );
  }
}
