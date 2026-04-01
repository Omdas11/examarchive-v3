import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import { adminDatabases, COLLECTION, DATABASE_ID, ID, Query } from "@/lib/appwrite";
import { getDailyLimit } from "@/lib/ai-limits";
import { GeminiServiceError, runGeminiCompletion } from "@/lib/gemini";
import { readMasterNotesPrompt } from "@/lib/master-notes-prompt";

type GenerateNotesBody = {
  university?: string;
  course?: string;
  type?: string;
  paperCode?: string;
  unitNumber?: number;
};

function isAdminPlus(role: string): boolean {
  return role === "admin" || role === "founder";
}

function normalizeTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
      .filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
}

async function getDailyCount(userId: string, todayStr: string): Promise<number> {
  const db = adminDatabases();
  try {
    const res = await db.listDocuments(DATABASE_ID, COLLECTION.ai_usage, [
      Query.equal("user_id", userId),
      Query.equal("date", todayStr),
    ]);
    return res.total;
  } catch {
    return 0;
  }
}

async function recordGeneration(userId: string, todayStr: string): Promise<void> {
  const db = adminDatabases();
  try {
    await db.createDocument(DATABASE_ID, COLLECTION.ai_usage, ID.unique(), {
      user_id: userId,
      date: todayStr,
    });
  } catch (error) {
    console.error("[generate-notes] Failed to record usage:", error);
  }
}

export async function GET(request: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const dailyLimit = getDailyLimit();
  const used = isAdminPlus(user.role) ? 0 : await getDailyCount(user.id, todayStr);
  const remaining = isAdminPlus(user.role) ? null : Math.max(0, dailyLimit - used);

  const { searchParams } = new URL(request.url);
  const university = (searchParams.get("university") || "Assam University").trim();
  const course = (searchParams.get("course") || "").trim();
  const type = (searchParams.get("type") || "").trim();

  try {
    const queries = [Query.equal("university", university), Query.limit(500)];
    if (course) queries.push(Query.equal("course", course));
    if (type) queries.push(Query.equal("type", type));

    const db = adminDatabases();
    const { documents } = await db.listDocuments(DATABASE_ID, COLLECTION.syllabus_table, queries);
    const paperCodes = Array.from(
      new Set(
        documents
          .map((doc) => (typeof doc.paper_code === "string" ? doc.paper_code.trim() : ""))
          .filter(Boolean),
      ),
    );

    return NextResponse.json({
      remaining,
      limit: isAdminPlus(user.role) ? null : dailyLimit,
      paperCodes,
    });
  } catch (error) {
    console.error("[generate-notes] Failed to load options:", error);
    return NextResponse.json({
      remaining,
      limit: isAdminPlus(user.role) ? null : dailyLimit,
      paperCodes: [],
    });
  }
}

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiApiKey) {
    return NextResponse.json({ error: "Gemini is not configured." }, { status: 503 });
  }

  let body: GenerateNotesBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const university = (body.university || "Assam University").trim();
  const course = (body.course || "").trim();
  const type = (body.type || "").trim();
  const paperCode = (body.paperCode || "").trim();
  const unitNumber = Number(body.unitNumber);

  if (!course || !type || !paperCode || !Number.isInteger(unitNumber) || unitNumber < 1 || unitNumber > 5) {
    return NextResponse.json({ error: "Invalid selection. Please choose course, type, paper code, and unit 1-5." }, { status: 400 });
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const dailyLimit = getDailyLimit();
  let usedBefore = 0;

  if (!isAdminPlus(user.role)) {
    usedBefore = await getDailyCount(user.id, todayStr);
    if (usedBefore >= dailyLimit) {
      return NextResponse.json(
        { error: "Generation quota exceeded.", code: "QUOTA_EXCEEDED", remaining: 0 },
        { status: 403 },
      );
    }
  }

  try {
    const db = adminDatabases();
    const syllabusRes = await db.listDocuments(DATABASE_ID, COLLECTION.syllabus_table, [
      Query.equal("university", university),
      Query.equal("course", course),
      Query.equal("type", type),
      Query.equal("paper_code", paperCode),
      Query.equal("unit_number", unitNumber),
      Query.limit(1),
    ]);

    const syllabusDoc = syllabusRes.documents[0];
    if (!syllabusDoc) {
      return NextResponse.json({ error: "No syllabus data found for this unit." }, { status: 404 });
    }

    const syllabusContent = typeof syllabusDoc.syllabus_content === "string" ? syllabusDoc.syllabus_content.trim() : "";
    const syllabusTags = normalizeTags(syllabusDoc.tags);
    if (!syllabusContent) {
      return NextResponse.json({ error: "Syllabus content is empty for this unit." }, { status: 404 });
    }

    const questionsRes = await db.listDocuments(DATABASE_ID, COLLECTION.questions_table, [
      Query.equal("paper_code", paperCode),
      Query.limit(500),
    ]);

    const filteredQuestions = questionsRes.documents.filter((questionDoc) => {
      const questionTags = normalizeTags(questionDoc.tags);
      if (syllabusTags.length === 0) return true;
      return questionTags.some((tag) => syllabusTags.includes(tag));
    });

    const formattedQuestions = filteredQuestions
      .map((questionDoc, idx) => {
        const content = typeof questionDoc.question_content === "string" ? questionDoc.question_content.trim() : "";
        if (!content) return null;
        const marks = typeof questionDoc.marks === "number" ? `${questionDoc.marks} marks` : "marks N/A";
        const number = questionDoc.question_no ?? idx + 1;
        const sub = questionDoc.question_subpart ? `(${questionDoc.question_subpart})` : "";
        return `${idx + 1}. Q${number}${sub}: ${content} [${marks}]`;
      })
      .filter((line): line is string => Boolean(line))
      .join("\n");

    const masterPrompt = readMasterNotesPrompt();
    const prompt = `${masterPrompt}

University: ${university}
Course: ${course}
Type: ${type}
Paper Code: ${paperCode}
Unit Number: ${unitNumber}
Unit Tags: ${syllabusTags.length > 0 ? syllabusTags.join(", ") : "N/A"}

Syllabus Content:
${syllabusContent}

Related Past Questions (matched by paper code and tags):
${formattedQuestions || "No related questions found."}
`;

    const gemini = await runGeminiCompletion({
      apiKey: geminiApiKey,
      prompt,
      maxTokens: 3500,
      temperature: 0.4,
      model: "gemini-3.1-flash-lite-preview",
    });

    if (!isAdminPlus(user.role)) {
      await recordGeneration(user.id, todayStr);
    }

    const remaining = isAdminPlus(user.role) ? null : Math.max(0, dailyLimit - (usedBefore + 1));
    return NextResponse.json({
      markdown: gemini.content,
      model: gemini.model,
      remaining,
    });
  } catch (error) {
    if (error instanceof GeminiServiceError) {
      if (error.status === 429) {
        return NextResponse.json(
          { error: "AI rate limit reached. Please wait a moment and try again." },
          { status: 429 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[generate-notes] Failed:", error);
    return NextResponse.json({ error: "Failed to generate notes." }, { status: 503 });
  }
}
