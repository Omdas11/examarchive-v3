import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import { adminDatabases, COLLECTION, DATABASE_ID, ID, Query } from "@/lib/appwrite";
import { getDailyLimit } from "@/lib/ai-limits";
import { GeminiServiceError, runGeminiCompletion } from "@/lib/gemini";
import { readMasterNotesPrompt } from "@/lib/master-notes-prompt";
import { checkAndResetQuotas } from "@/lib/user-quotas";
import { NOTES_DAILY_LIMIT, PAPERS_DAILY_LIMIT } from "@/lib/quota-config";
import curriculumData from "@/data/curriculum.json";

type GenerateNotesBody = {
  university?: string;
  course?: string;
  stream?: string;
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

function normalizeSemester(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 8) return null;
  return parsed;
}

type CurriculumTable = {
  id: string;
  rows: Array<{
    semester: number;
    slots: Record<string, { code: string | null }>;
  }>;
};

function buildCanonicalSemestersByPaperCode(): Record<string, number[]> {
  const result: Record<string, number[]> = {};
  const tables = (curriculumData as { tables?: CurriculumTable[] }).tables ?? [];
  for (const table of tables) {
    for (const row of table.rows ?? []) {
      const semester = Number(row.semester);
      if (!Number.isInteger(semester) || semester < 1 || semester > 8) continue;
      for (const slot of Object.values(row.slots ?? {})) {
        const code = typeof slot?.code === "string" ? slot.code.trim().toUpperCase() : "";
        if (!code) continue;
        if (!result[code]) result[code] = [];
        if (!result[code].includes(semester)) result[code].push(semester);
      }
    }
  }
  for (const code of Object.keys(result)) {
    result[code].sort((a, b) => a - b);
  }
  return result;
}

const CANONICAL_SEMESTERS_BY_PAPER_CODE = buildCanonicalSemestersByPaperCode();

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
  const quota = await checkAndResetQuotas(user.id);

  const { searchParams } = new URL(request.url);
  const university = (searchParams.get("university") || "Assam University").trim();
  const course = (searchParams.get("course") || "").trim();
  const stream = (searchParams.get("stream") || "").trim();
  const type = (searchParams.get("type") || "").trim();
  const semester = normalizeSemester(searchParams.get("semester"));

  try {
    const queries = [Query.equal("university", university)];
    if (course) queries.push(Query.equal("course", course));
    if (stream) queries.push(Query.equal("stream", stream));
    if (type) queries.push(Query.equal("type", type));

    const db = adminDatabases();
    const OPTION_MAX_PAGES = 20;
    type OptionDoc = Record<string, unknown> & { $id: string };

    async function listAllOptionDocs(
      collectionId: string,
      baseQueries: string[],
      pageSize: number,
      label: string,
    ): Promise<OptionDoc[]> {
      const allDocuments: OptionDoc[] = [];
      let cursorAfter = "";

      for (let page = 0; page < OPTION_MAX_PAGES; page++) {
        const pageQueries = [
          ...baseQueries,
          Query.limit(pageSize),
          ...(cursorAfter ? [Query.cursorAfter(cursorAfter)] : []),
        ];
        const res = await db.listDocuments(DATABASE_ID, collectionId, pageQueries);
        const currentPageDocuments = (res.documents || []) as OptionDoc[];
        allDocuments.push(...currentPageDocuments);

        if (currentPageDocuments.length < pageSize) return allDocuments;
        const lastDoc = currentPageDocuments[currentPageDocuments.length - 1];
        const nextCursor = typeof lastDoc.$id === "string" ? lastDoc.$id : "";
        if (!nextCursor) return allDocuments;
        cursorAfter = nextCursor;
      }

      console.warn(`[generate-notes] ${label} option query reached page cap (${OPTION_MAX_PAGES})`);
      return allDocuments;
    }

    const [syllabusDocs, questionDocs] = await Promise.all([
      listAllOptionDocs(COLLECTION.syllabus_table, queries, 500, "syllabus"),
      listAllOptionDocs(
        COLLECTION.questions_table,
        [
          Query.equal("university", university),
          ...(course ? [Query.equal("course", course)] : []),
          ...(stream ? [Query.equal("stream", stream)] : []),
          ...(type ? [Query.equal("type", type)] : []),
        ],
        1000,
        "questions",
      ),
    ]);
    const papersMap = new Map<string, string>();
    const storePaperName = (code: string, nameCandidate: unknown) => {
      const name = typeof nameCandidate === "string" ? nameCandidate.trim() : "";
      if (name && !papersMap.has(code)) papersMap.set(code, name);
    };
    const syllabusPaperCodes = new Set<string>();
    const unitsByPaperCode: Record<string, number[]> = {};
    const semestersByPaperCode: Record<string, number[]> = {};
    const addSemesterForCode = (code: string, semesterValue: number) => {
      if (!Number.isInteger(semesterValue) || semesterValue < 1 || semesterValue > 8) return;
      if (!semestersByPaperCode[code]) semestersByPaperCode[code] = [];
      if (!semestersByPaperCode[code].includes(semesterValue)) semestersByPaperCode[code].push(semesterValue);
    };
    const applyCanonicalOrFallbackSemester = (code: string, semesterCandidate: number) => {
      const canonicalSemesters = CANONICAL_SEMESTERS_BY_PAPER_CODE[code];
      if (Array.isArray(canonicalSemesters) && canonicalSemesters.length > 0) {
        for (const canonicalSemester of canonicalSemesters) addSemesterForCode(code, canonicalSemester);
        return;
      }
      addSemesterForCode(code, semesterCandidate);
    };
    for (const doc of syllabusDocs) {
      const code = typeof doc.paper_code === "string" ? doc.paper_code.trim().toUpperCase() : "";
      if (!code) continue;
      storePaperName(code, doc.paper_name);
      syllabusPaperCodes.add(code);

      const unitRaw = doc.unit_number;
      const unit =
        typeof unitRaw === "number"
          ? unitRaw
          : typeof unitRaw === "string"
            ? Number(unitRaw)
            : NaN;
      if (!Number.isInteger(unit) || unit < 1) continue;
      if (!unitsByPaperCode[code]) unitsByPaperCode[code] = [];
      if (!unitsByPaperCode[code].includes(unit)) unitsByPaperCode[code].push(unit);

      const semesterRaw = doc.semester;
      const semesterValue =
        typeof semesterRaw === "number"
          ? semesterRaw
          : typeof semesterRaw === "string"
            ? Number(semesterRaw)
            : NaN;
      applyCanonicalOrFallbackSemester(code, semesterValue);
    }
    for (const code of Object.keys(unitsByPaperCode)) {
      unitsByPaperCode[code].sort((a, b) => a - b);
    }
    for (const code of Object.keys(semestersByPaperCode)) {
      semestersByPaperCode[code].sort((a, b) => a - b);
    }
    const questionPaperCodes = new Set<string>();
    for (const questionDoc of questionDocs) {
      const code = typeof questionDoc.paper_code === "string" ? questionDoc.paper_code.trim().toUpperCase() : "";
      if (!code) continue;
      questionPaperCodes.add(code);
      storePaperName(code, questionDoc.paper_name);
      applyCanonicalOrFallbackSemester(code, NaN);
    }
    const availableSemesters = Array.from(
      new Set(Object.values(semestersByPaperCode).flat()),
    ).sort((a, b) => a - b);
    const notesPaperCodes = Array.from(syllabusPaperCodes).sort((a, b) => a.localeCompare(b));
    const papersPaperCodes = Array.from(questionPaperCodes).sort((a, b) => a.localeCompare(b));
    const allPaperCodes = [...new Set([...notesPaperCodes, ...papersPaperCodes])].sort((a, b) => a.localeCompare(b));
    const paperCodes = semester === null
      ? allPaperCodes
      : allPaperCodes.filter((code) => (semestersByPaperCode[code] ?? []).includes(semester));
    const paperCodesSet = new Set(paperCodes);
    const papers = paperCodes.map((code) => ({ code, name: papersMap.get(code) || code }));
    const yearsByPaperCode: Record<string, number[]> = {};
    for (const questionDoc of questionDocs) {
      const code = typeof questionDoc.paper_code === "string" ? questionDoc.paper_code.trim().toUpperCase() : "";
      if (!code || !paperCodesSet.has(code)) continue;
      const yearRaw = questionDoc.year;
      const year =
        typeof yearRaw === "number"
          ? yearRaw
          : typeof yearRaw === "string"
            ? Number(yearRaw)
            : NaN;
      if (!Number.isInteger(year)) continue;
      if (!yearsByPaperCode[code]) yearsByPaperCode[code] = [];
      if (!yearsByPaperCode[code].includes(year)) yearsByPaperCode[code].push(year);
    }
    for (const code of Object.keys(yearsByPaperCode)) {
      yearsByPaperCode[code]?.sort((a, b) => b - a);
    }
    const filteredNotesPaperCodes = notesPaperCodes.filter((code) => paperCodesSet.has(code));
    const filteredPapersPaperCodes = papersPaperCodes.filter((code) => paperCodesSet.has(code));

    return NextResponse.json({
      remaining,
      limit: isAdminPlus(user.role) ? null : dailyLimit,
      notesRemaining: isAdminPlus(user.role) ? null : Math.max(0, NOTES_DAILY_LIMIT - quota.notes_generated_today),
      papersRemaining: isAdminPlus(user.role) ? null : Math.max(0, PAPERS_DAILY_LIMIT - quota.papers_solved_today),
      notesDailyLimit: isAdminPlus(user.role) ? null : NOTES_DAILY_LIMIT,
      papersDailyLimit: isAdminPlus(user.role) ? null : PAPERS_DAILY_LIMIT,
      paperCodes,
      notesPaperCodes: filteredNotesPaperCodes,
      papersPaperCodes: filteredPapersPaperCodes,
      papers,
      unitsByPaperCode,
      yearsByPaperCode,
      semestersByPaperCode,
      availableSemesters,
    });
  } catch (error) {
    console.error("[generate-notes] Failed to load options:", error);
    return NextResponse.json({
      remaining,
      limit: isAdminPlus(user.role) ? null : dailyLimit,
      notesRemaining: isAdminPlus(user.role) ? null : Math.max(0, NOTES_DAILY_LIMIT - quota.notes_generated_today),
      papersRemaining: isAdminPlus(user.role) ? null : Math.max(0, PAPERS_DAILY_LIMIT - quota.papers_solved_today),
      notesDailyLimit: isAdminPlus(user.role) ? null : NOTES_DAILY_LIMIT,
      papersDailyLimit: isAdminPlus(user.role) ? null : PAPERS_DAILY_LIMIT,
      paperCodes: [],
      notesPaperCodes: [],
      papersPaperCodes: [],
      papers: [],
      unitsByPaperCode: {},
      yearsByPaperCode: {},
      semestersByPaperCode: {},
      availableSemesters: [],
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
  const stream = (body.stream || "").trim();
  const type = (body.type || "").trim();
  const paperCode = (body.paperCode || "").trim();
  const unitNumber = Number(body.unitNumber);

  if (!course || !stream || !type || !paperCode || !Number.isInteger(unitNumber) || unitNumber < 1 || unitNumber > 5) {
    return NextResponse.json({ error: "Invalid selection. Please choose course, stream, type, paper code, and unit 1-5." }, { status: 400 });
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
      Query.equal("stream", stream),
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
      Query.equal("university", university),
      Query.equal("course", course),
      Query.equal("stream", stream),
      Query.equal("type", type),
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
Stream: ${stream}
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
      maxTokens: 8192,
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
      syllabusContent: syllabusContent,
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
