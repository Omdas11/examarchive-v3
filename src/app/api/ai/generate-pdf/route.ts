import { after } from "next/server";
import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import { getDailyLimit } from "@/lib/ai-limits";
import { checkAndResetQuotas, incrementQuotaCounter } from "@/lib/user-quotas";
import { NOTES_DAILY_LIMIT } from "@/lib/quota-config";
import {
  adminDatabases,
  COLLECTION,
  DATABASE_ID,
  ID,
  Query,
} from "@/lib/appwrite";
import { runGeminiCompletion } from "@/lib/gemini";
import { readDynamicSystemPrompt } from "@/lib/system-prompt";
import { renderMarkdownPdfToAppwrite } from "@/lib/ai-pdf-pipeline";
import { sendGenerationFailureEmail, sendGenerationPdfEmail } from "@/lib/generation-notifications";
import { formatSearchResults, runWebSearch } from "@/lib/web-search";

export const maxDuration = 300;

const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";
const TOPIC_RETRY_MAX = 3;
const MIN_TOPIC_RESPONSE_CHARS = 50;
const QUESTION_MAX_RETRIES = 4;
const MIN_SOLUTION_RESPONSE_CHARS = 10;
const RETRY_ERROR_DELAY_MS = 4000;
const TAVILY_TIMEOUT_MS = 4000;
const TOPIC_CONCURRENCY = 3;
const QUESTION_CONCURRENCY = 3;
const MIN_SEMESTER = 1;
const MAX_SEMESTER = 8;

type GenerateBody = {
  jobType?: string;
  university?: string;
  course?: string;
  stream?: string;
  type?: string;
  paperCode?: string;
  unitNumber?: number;
  semester?: number | null;
  year?: number | null;
};

function isAdminPlus(role: string): boolean {
  return role === "admin" || role === "founder";
}

function normalizeSemester(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < MIN_SEMESTER || parsed > MAX_SEMESTER) return null;
  return parsed;
}

function normalizeYear(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.floor(parsed);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((tag) => (typeof tag === "string" ? tag.trim() : "")).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw.split(",").map((tag) => tag.trim()).filter(Boolean);
  }
  return [];
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const safeLimit = Math.max(1, Math.min(limit, items.length));
  const results: R[] = new Array(items.length);
  const workers = Array.from({ length: safeLimit }, async (_, workerIndex) => {
    for (let current = workerIndex; current < items.length; current += safeLimit) {
      results[current] = await mapper(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

const ABBREV_DOT_RE = /\d+(?:st|nd|rd|th)\./gi;
const ABBREV_PLACEHOLDER = "\x00";

function splitSyllabusIntoSubTopics(syllabusContent: string): string[] {
  const protected_ = syllabusContent.replace(ABBREV_DOT_RE, (m) => m.slice(0, -1) + ABBREV_PLACEHOLDER);
  return protected_
    .split(/(?<=[.;])\s+/)
    .map((part) => part.replace(/\x00/g, ".").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function formatQuestionsForPrompt(questions: Array<Record<string, unknown>>, unitNumber: number): string {
  return questions
    .filter((doc) => {
      const unitRaw = doc.unit_number;
      if (typeof unitRaw === "number") return unitRaw === unitNumber;
      if (typeof unitRaw === "string") {
        const parsed = Number(unitRaw);
        return Number.isInteger(parsed) ? parsed === unitNumber : false;
      }
      return false;
    })
    .map((doc, idx) => {
      const content = typeof doc.question_content === "string" ? doc.question_content.trim() : "";
      const marks = typeof doc.marks === "number" ? ` [${doc.marks} marks]` : "";
      return `${idx + 1}. ${content}${marks}`;
    })
    .filter((q) => q.trim().length > 2)
    .join("\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = "status" in error ? (error as { status?: unknown }).status : undefined;
  const message = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  return status === 429 || message.includes("429");
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
    console.error("[ai/generate-pdf] Failed to record usage:", error);
  }
}

async function fetchTavilyContext(query: string): Promise<string> {
  try {
    const results = await Promise.race([
      runWebSearch(query, 2),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Tavily timeout")), TAVILY_TIMEOUT_MS),
      ),
    ]);
    return formatSearchResults(results);
  } catch {
    return "";
  }
}

async function notifyGenerationFailure(email: string, title: string, error: unknown): Promise<void> {
  await sendGenerationFailureEmail({
    email,
    title,
    reason: error instanceof Error ? error.message : "Background generation failed.",
  }).catch((mailError) => {
    console.error("[ai/generate-pdf] Failed to send generation failure email:", mailError);
  });
}

async function runNotesBackground(params: {
  userId: string;
  userEmail: string;
  university: string;
  course: string;
  stream: string;
  type: string;
  paperCode: string;
  unitNumber: number;
  semester: number | null;
  isAdmin: boolean;
  todayStr: string;
}): Promise<void> {
  const {
    userId, userEmail, university, course, stream, type,
    paperCode, unitNumber, semester, isAdmin, todayStr,
  } = params;

  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const azureGotenbergUrl = process.env.AZURE_GOTENBERG_URL;

  if (!geminiApiKey) throw new Error("Google Gemini is not configured.");
  if (!azureGotenbergUrl) throw new Error("Server misconfiguration: AZURE_GOTENBERG_URL is missing.");

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
  if (!syllabusDoc) throw new Error("No syllabus data found for this unit.");

  const syllabusContent = typeof syllabusDoc.syllabus_content === "string" ? syllabusDoc.syllabus_content.trim() : "";
  if (!syllabusContent) throw new Error("Syllabus content is empty for this unit.");

  const paperName = typeof syllabusDoc.paper_name === "string" ? syllabusDoc.paper_name.trim() : "";
  const unitNameRaw =
    typeof syllabusDoc.unit_name === "string"
      ? syllabusDoc.unit_name
      : (typeof syllabusDoc.unit_title === "string" ? syllabusDoc.unit_title : "");
  const unitName = unitNameRaw.trim();

  const subTopics = splitSyllabusIntoSubTopics(syllabusContent);
  if (subTopics.length === 0) throw new Error("No sub-topics found for this unit.");

  const questionsRes = await db.listDocuments(DATABASE_ID, COLLECTION.questions_table, [
    Query.equal("university", university),
    Query.equal("course", course),
    Query.equal("stream", stream),
    Query.equal("type", type),
    Query.equal("paper_code", paperCode),
    Query.limit(500),
  ]);

  const syllabusTags = normalizeTags(syllabusDoc.tags);
  const formattedQuestions = formatQuestionsForPrompt(questionsRes.documents, unitNumber);
  const systemPrompt = readDynamicSystemPrompt({ promptType: "unit_notes" });
  const generatedChunks = await mapWithConcurrency(subTopics, TOPIC_CONCURRENCY, async (topic, index) => {
    const promptBody = `University: ${university}
Course: ${course}
Stream: ${stream}
Type: ${type}
Paper Code: ${paperCode}
Unit Number: ${unitNumber}
Unit Tags: ${syllabusTags.length > 0 ? syllabusTags.join(", ") : "N/A"}

Current Sub-Topic:
${topic}

All Questions for this Unit:
${formattedQuestions || "No related questions found."}

CRITICAL FORMAT CONSTRAINTS:
1. Do NOT write the unit number in heading text or repeat the paper code as heading text.
2. Do NOT use numeric prefixes for main headings (e.g. avoid "1. Heading").
3. Start directly with a ## or ### heading for this sub-topic.
`;

    let aiResponseText = "";
    for (let retries = 0; retries < TOPIC_RETRY_MAX; retries += 1) {
      try {
        const result = await runGeminiCompletion({
          apiKey: String(geminiApiKey),
          prompt: `${systemPrompt}\n\n${promptBody}`,
          maxTokens: 4000,
          temperature: 0.4,
          model: GEMINI_MODEL,
        });
        const candidate = String(result.content ?? "").trim();
        if (candidate.length > MIN_TOPIC_RESPONSE_CHARS) {
          aiResponseText = candidate;
          break;
        }
      } catch (error) {
        if (isRateLimitError(error)) {
          await sleep(RETRY_ERROR_DELAY_MS * 3);
        } else {
          await sleep(RETRY_ERROR_DELAY_MS);
        }
        if (retries >= TOPIC_RETRY_MAX - 1) {
          console.error(`[ai/generate-pdf] Topic ${index + 1} failed after retries:`, error);
        }
      }
    }

    if (!aiResponseText) {
      return [
        `## ${topic}`,
        "",
        `> *Note: ExamArchive could not generate notes for this sub-topic after retries. Please refer to standard texts for: ${topic}*`,
      ].join("\n");
    }

    return aiResponseText;
  });

  const masterMarkdown = generatedChunks.join("\n\n---\n\n");

  const dynamicPdfName = `${paperCode}_Unit_${unitNumber}_Notes.pdf`;
  const rendered = await renderMarkdownPdfToAppwrite({
    markdown: masterMarkdown,
    fileBaseName: `${paperCode}_unit_${unitNumber}_${Date.now()}`,
    fileName: dynamicPdfName,
    gotenbergUrl: azureGotenbergUrl,
    modelName: GEMINI_MODEL,
    generatedAtIso: new Date().toISOString(),
    paperCode,
    paperName,
    unitNumber,
    unitName,
    syllabusContent,
    userEmail: userEmail || undefined,
  });

  if (userEmail) {
    try {
      await sendGenerationPdfEmail({
        email: userEmail,
        downloadUrl: rendered.fileUrl,
        title: `Unit Notes (${paperCode} - Unit ${unitNumber})`,
      });
    } catch (emailError) {
      console.error("[ai/generate-pdf] Failed to send notes email:", emailError);
    }
  }

  if (!isAdmin) {
    await recordGeneration(userId, todayStr);
    await incrementQuotaCounter(userId, "notes_generated_today");
  }

  void semester; // used for quota key differentiation in future
}

async function runSolvedPaperBackground(params: {
  userId: string;
  userEmail: string;
  university: string;
  course: string;
  stream: string;
  type: string;
  paperCode: string;
  year: number;
  semester: number | null;
  isAdmin: boolean;
  todayStr: string;
}): Promise<void> {
  const {
    userId, userEmail, university, course, stream, type,
    paperCode, year, isAdmin, todayStr,
  } = params;

  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const azureGotenbergUrl = process.env.AZURE_GOTENBERG_URL;

  if (!geminiApiKey) throw new Error("Google Gemini is not configured.");
  if (!azureGotenbergUrl) throw new Error("Server misconfiguration: AZURE_GOTENBERG_URL is missing.");

  const db = adminDatabases();

  const questionsRes = await db.listDocuments(DATABASE_ID, COLLECTION.questions_table, [
    Query.equal("university", university),
    Query.equal("course", course),
    Query.equal("stream", stream),
    Query.equal("type", type),
    Query.equal("paper_code", paperCode),
    Query.equal("year", year),
    Query.orderAsc("question_no"),
    Query.limit(500),
  ]);

  const allQuestions = questionsRes.documents.filter(
    (doc) => typeof doc.question_content === "string" && doc.question_content.trim().length > 0,
  );

  if (allQuestions.length === 0) throw new Error("No questions found for the selected paper/year.");

  const systemPrompt = readDynamicSystemPrompt({ promptType: "solved_paper" });
  const paperWebContext = allQuestions.length > 0
    ? await fetchTavilyContext(`${university} ${course} ${paperCode} ${year} solved paper key points`)
    : "";
  const solvedChunks = await mapWithConcurrency(allQuestions, QUESTION_CONCURRENCY, async (questionDoc, index) => {
    const qNo = String(questionDoc.question_no ?? index + 1).trim();
    const qSub = typeof questionDoc.question_subpart === "string" ? questionDoc.question_subpart.trim() : "";
    const qLabel = `Q${qNo}${qSub ? `(${qSub})` : ""}`;
    const questionContent = String(questionDoc.question_content ?? "").trim();
    const marks =
      typeof questionDoc.marks === "number"
        ? questionDoc.marks
        : (typeof questionDoc.marks === "string" ? Number(questionDoc.marks) || null : null);

    const questionText = `University: ${university}
Course: ${course}
Stream: ${stream}
Type: ${type}
Paper Code: ${paperCode}
Year: ${year}
Question Label: ${qLabel}
Marks: ${marks ?? "N/A"}

CRITICAL LENGTH CONSTRAINT: This question is worth ${marks ?? "N/A"} marks. If it is 1 or 2 marks, provide a highly concise definition or final formula. If it is 4 or more marks, provide a detailed, step-by-step exhaustive derivation.

Question:
${questionContent}

Paper-level Web Context:
${paperWebContext || "No external web context available."}

CRITICAL FORMAT CONSTRAINTS:
1. Do NOT write a document title.
2. Start directly with the answer to this specific question.
3. Use concise markdown only for this question.
4. Do NOT use numeric prefixes in major headings.
`;

    let aiResponseText = "";
    for (let retries = 0; retries < QUESTION_MAX_RETRIES; retries += 1) {
      try {
        const result = await runGeminiCompletion({
          apiKey: String(geminiApiKey),
          prompt: `${systemPrompt}\n\n${questionText}`,
          maxTokens: 4000,
          temperature: 0.4,
          model: GEMINI_MODEL,
        });
        const candidate = String(result.content ?? "").trim();
        if (candidate.length > MIN_SOLUTION_RESPONSE_CHARS) {
          aiResponseText = candidate;
          break;
        }
      } catch (error) {
        if (isRateLimitError(error)) {
          await sleep(RETRY_ERROR_DELAY_MS * 5);
        } else {
          await sleep(RETRY_ERROR_DELAY_MS);
        }
        if (retries >= QUESTION_MAX_RETRIES - 1) {
          console.error(`[ai/generate-pdf] Question ${qLabel} failed after retries:`, error);
        }
      }
    }

    const solvedChunk = aiResponseText || "_No solution generated after retries._";
    const displaySubpart = qSub || "-";
    const questionYear =
      typeof questionDoc.year === "number"
        ? questionDoc.year
        : (Number(String(questionDoc.year ?? "")) || year);
    const header = `### Q${qNo}(${displaySubpart}) [${questionYear}] [${marks ?? "N/A"} Marks]\n**${questionContent}**\n\n`;
    return `${header}${solvedChunk}`;
  });
  const masterMarkdown = solvedChunks.join("\n\n---\n\n");

  const rendered = await renderMarkdownPdfToAppwrite({
    markdown: masterMarkdown.trim(),
    fileBaseName: `${paperCode}_${year}_solved_${Date.now()}`,
    fileName: `${paperCode}_${year}_solved_paper.pdf`,
    gotenbergUrl: azureGotenbergUrl,
    paperCode,
    year,
  });

  if (userEmail) {
    try {
      await sendGenerationPdfEmail({
        email: userEmail,
        downloadUrl: rendered.fileUrl,
        title: `Solved Paper (${paperCode} ${year})`,
      });
    } catch (emailError) {
      console.error("[ai/generate-pdf] Failed to send solved paper email:", emailError);
    }
  }

  if (!isAdmin) {
    await recordGeneration(userId, todayStr);
    await incrementQuotaCounter(userId, "papers_solved_today");
  }
}

export async function POST(request: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  let body: GenerateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const jobType = (body.jobType || "notes").trim().toLowerCase();
  if (jobType !== "notes" && jobType !== "solved-paper") {
    return NextResponse.json({ error: "Invalid jobType. Must be 'notes' or 'solved-paper'." }, { status: 400 });
  }

  const university = (body.university || "Assam University").trim();
  const course = (body.course || "").trim();
  const stream = (body.stream || "").trim();
  const type = (body.type || "").trim();
  const paperCode = (body.paperCode || "").trim();
  const semester = normalizeSemester(body.semester);
  const userEmail = typeof user.email === "string" ? user.email.trim() : "";

  if (!course) return NextResponse.json({ error: "Invalid selection: course is required." }, { status: 400 });
  if (!stream) return NextResponse.json({ error: "Invalid selection: stream is required." }, { status: 400 });
  if (!type) return NextResponse.json({ error: "Invalid selection: type is required." }, { status: 400 });
  if (!paperCode) return NextResponse.json({ error: "Invalid selection: paper code is required." }, { status: 400 });
  if (!isValidEmail(userEmail)) {
    return NextResponse.json(
      { error: "A valid account email is required to receive generated PDFs." },
      { status: 400 },
    );
  }

  if (!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)?.trim()) {
    return NextResponse.json(
      { error: "AI Service not configured (missing GEMINI_API_KEY).", code: "SERVER_MISCONFIGURATION" },
      { status: 503 },
    );
  }

  if (!(process.env.AZURE_GOTENBERG_URL || "").trim()) {
    return NextResponse.json(
      { error: "PDF Engine not configured (missing AZURE_GOTENBERG_URL).", code: "SERVER_MISCONFIGURATION" },
      { status: 503 },
    );
  }

  const admin = isAdminPlus(user.role);
  const todayStr = new Date().toISOString().slice(0, 10);

  if (jobType === "notes") {
    const unitNumber = Number(body.unitNumber);
    if (!Number.isInteger(unitNumber) || unitNumber < 1 || unitNumber > 5) {
      return NextResponse.json(
        { error: "Invalid selection: unit number must be between 1 and 5." },
        { status: 400 },
      );
    }

    if (!admin) {
      const quota = await checkAndResetQuotas(user.id);
      if (quota.notes_generated_today >= NOTES_DAILY_LIMIT) {
        return NextResponse.json(
          { error: `Daily limit reached for Unit Notes (${NOTES_DAILY_LIMIT}/day).`, code: "NOTES_DAILY_LIMIT_REACHED" },
          { status: 403 },
        );
      }
      const dailyLimit = getDailyLimit();
      const used = await getDailyCount(user.id, todayStr);
      if (used >= dailyLimit) {
        return NextResponse.json(
          { error: "Generation quota exceeded.", code: "QUOTA_EXCEEDED", remaining: 0 },
          { status: 403 },
        );
      }
    }

    after(async () => {
      try {
        await runNotesBackground({
          userId: user.id,
          userEmail,
          university,
          course,
          stream,
          type,
          paperCode,
          unitNumber,
          semester,
          isAdmin: admin,
          todayStr,
        });
      } catch (error) {
        console.error("[ai/generate-pdf] Notes background job failed:", error);
        await notifyGenerationFailure(userEmail, `Unit Notes (${paperCode} - Unit ${unitNumber})`, error);
      }
    });

    return NextResponse.json({
      ok: true,
      message: userEmail
        ? `Your notes are being generated. We'll email the PDF to ${userEmail} when ready. You can safely close this tab.`
        : "Your notes are being generated. The PDF will be ready shortly.",
    });
  }

  // solved-paper
  const year = normalizeYear(body.year);
  if (year === null || year < 1900 || year > 2100) {
    return NextResponse.json(
      { error: "Invalid selection: valid year is required for solved paper." },
      { status: 400 },
    );
  }

  if (!admin) {
    const quota = await checkAndResetQuotas(user.id);
    if (quota.papers_solved_today >= 1) {
      return NextResponse.json(
        { error: "Daily limit reached for Solved Papers (1/day)." },
        { status: 403 },
      );
    }
    const dailyLimit = getDailyLimit();
    const used = await getDailyCount(user.id, todayStr);
    if (used >= dailyLimit) {
      return NextResponse.json(
        { error: "Generation quota exceeded.", code: "QUOTA_EXCEEDED", remaining: 0 },
        { status: 403 },
      );
    }
  }

  after(async () => {
    try {
      await runSolvedPaperBackground({
        userId: user.id,
        userEmail,
        university,
        course,
        stream,
        type,
        paperCode,
        year,
        semester,
        isAdmin: admin,
        todayStr,
      });
    } catch (error) {
      console.error("[ai/generate-pdf] Solved paper background job failed:", error);
      await notifyGenerationFailure(userEmail, `Solved Paper (${paperCode} ${year})`, error);
    }
  });

  return NextResponse.json({
    ok: true,
    message: userEmail
      ? `Your solved paper is being generated. We'll email the PDF to ${userEmail} when ready. You can safely close this tab.`
      : "Your solved paper is being generated. The PDF will be ready shortly.",
  });
}
