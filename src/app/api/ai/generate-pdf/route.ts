import { after } from "next/server";
import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import { getDailyLimit } from "@/lib/ai-limits";
import { checkAndResetQuotas, incrementQuotaCounter, rollbackQuotaCounter } from "@/lib/user-quotas";
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
import {
  sendGenerationFailureEmail,
  sendGenerationPdfEmail,
  sendGenerationStartedEmail,
} from "@/lib/generation-notifications";
import { formatSearchResults, runWebSearch } from "@/lib/web-search";
import {
  GENERATION_COST_ELECTRONS,
  SUPPORTED_AI_MODELS,
  isSupportedAiModel,
} from "@/lib/economy";
import { withElectronBalanceLock } from "@/lib/electron-lock";

export const maxDuration = 300;

const DEFAULT_AI_MODEL = "gemini-3.1-flash-lite";
const LEGACY_GEMINI_PREVIEW_MODEL = "gemini-3.1-flash-lite-preview";
const GEMMA_UNLIMITED_TPM_MODEL = "gemma-4-31b";
const TOPIC_RETRY_MAX = 3;
const MIN_TOPIC_RESPONSE_CHARS = 50;
const QUESTION_MAX_RETRIES = 4;
const MIN_SOLUTION_RESPONSE_CHARS = 10;
const RETRY_ERROR_DELAY_MS = 4000;
const TAVILY_TIMEOUT_MS = 4000;
const DEFAULT_TOPIC_CONCURRENCY = 3;
const DEFAULT_QUESTION_CONCURRENCY = 2;
const GEMMA_TOPIC_CONCURRENCY = 6;
const GEMMA_QUESTION_CONCURRENCY = 4;
const UNDICI_CONNECT_TIMEOUT_CODE = "UND_ERR_CONNECT_TIMEOUT";
const EMAIL_DELIVERY_UNAVAILABLE_CODE = "EMAIL_DELIVERY_UNAVAILABLE";
const EMAIL_DELIVERY_UNAVAILABLE_MESSAGE =
  "Unable to send generation confirmation email. Request was not started. Please verify email settings and try again.";
const QUOTA_RESERVATION_FAILED_CODE = "QUOTA_RESERVATION_FAILED";
const QUOTA_RESERVATION_FAILED_MESSAGE = "Failed to reserve generation quota. Please try again later.";

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
  model?: string;
};

function isAdminPlus(role: string): boolean {
  return role === "moderator" || role === "admin" || role === "founder" || role === "maintainer";
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

async function reserveElectronCost(userId: string, cost: number): Promise<void> {
  await withElectronBalanceLock(userId, async () => {
    const db = adminDatabases();
    const profile = await db.getDocument(DATABASE_ID, COLLECTION.users, userId);
    const current = Number(profile.ai_credits ?? 0);
    if (!Number.isFinite(current) || current < cost) {
      throw new Error("INSUFFICIENT_ELECTRONS");
    }
    await db.updateDocument(DATABASE_ID, COLLECTION.users, userId, {
      ai_credits: current - cost,
    });
  });
}

async function rollbackElectronCost(userId: string, cost: number): Promise<void> {
  try {
    await withElectronBalanceLock(userId, async () => {
      const db = adminDatabases();
      const profile = await db.getDocument(DATABASE_ID, COLLECTION.users, userId);
      const current = Number(profile.ai_credits ?? 0);
      await db.updateDocument(DATABASE_ID, COLLECTION.users, userId, {
        ai_credits: Math.max(0, current + cost),
      });
    });
  } catch (error) {
    console.error("[ai/generate-pdf] Failed to rollback electrons after start-email failure.", {
      userId,
      cost,
      error,
    });
  }
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
  let nextIndex = 0;
  const workers = Array.from({ length: safeLimit }, async () => {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await mapper(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

const ABBREV_DOT_RE = /\b(?:\d+|[a-zA-Z])\.(?=\s|$)|(?:\d+(?:st|nd|rd|th)\.)/gi;
const ABBREV_PLACEHOLDER = "\x00";
const SYLLABUS_TOPIC_SPLIT_PATTERN = /(?:(?<=[.;])\s*|\n{2,})/;

function splitSyllabusIntoSubTopics(syllabusContent: string): string[] {
  const protected_ = syllabusContent.replace(ABBREV_DOT_RE, (m) => m.slice(0, -1) + ABBREV_PLACEHOLDER);
  return protected_
    // Split on sentence-ending punctuation + whitespace, or on blank-line separators.
    .split(SYLLABUS_TOPIC_SPLIT_PATTERN)
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
  const errObj = error as {
    status?: unknown;
    code?: unknown;
    message?: unknown;
    response?: { status?: unknown };
    error?: { status?: unknown; code?: unknown };
  };
  const status = errObj.status ?? errObj.response?.status ?? errObj.error?.status;
  const code = errObj.code ?? errObj.error?.code;
  if (status === 429 || code === 429 || code === "429") return true;
  const message = String(errObj.message ?? "");
  return /rate limit|resource exhausted/i.test(message);
}

function normalizeSelectedModel(model: string): string {
  return model === LEGACY_GEMINI_PREVIEW_MODEL ? DEFAULT_AI_MODEL : model;
}

function getModelConcurrency(model: string): { topic: number; question: number } {
  if (model === GEMMA_UNLIMITED_TPM_MODEL) {
    return { topic: GEMMA_TOPIC_CONCURRENCY, question: GEMMA_QUESTION_CONCURRENCY };
  }
  return { topic: DEFAULT_TOPIC_CONCURRENCY, question: DEFAULT_QUESTION_CONCURRENCY };
}

function getRateLimitBackoffMs(model: string, limitedModelMultiplier: number): number {
  return model === GEMMA_UNLIMITED_TPM_MODEL ? RETRY_ERROR_DELAY_MS : RETRY_ERROR_DELAY_MS * limitedModelMultiplier;
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

async function reserveQuotaForAcceptedRequest(
  userId: string,
  counter: "notes_generated_today" | "papers_solved_today",
): Promise<void> {
  try {
    await incrementQuotaCounter(userId, counter);
  } catch (error) {
    throw new Error(`[ai/generate-pdf] Failed to reserve ${counter}: ${String(error)}`);
  }
}

async function rollbackQuotaReservation(
  userId: string,
  counter: "notes_generated_today" | "papers_solved_today",
): Promise<void> {
  try {
    await rollbackQuotaCounter(userId, counter);
  } catch (error) {
    console.error("[ai/generate-pdf] Failed to rollback reserved quota after email failure.", {
      userId,
      counter,
      error,
    });
  }
}

function queueGenerationRecording(
  userId: string,
  counter: "notes_generated_today" | "papers_solved_today",
): void {
  const todayStr = new Date().toISOString().slice(0, 10);
  // Metrics recording is non-critical and should not block accepted requests.
  void recordGeneration(userId, todayStr).catch((error) => {
    console.error("[ai/generate-pdf] Failed to record usage metrics after quota reservation.", {
      userId,
      todayStr,
      counter,
      error,
    });
  });
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

function formatFailureReason(error: unknown): string {
  if (!(error instanceof Error)) return "Background generation failed.";

  const details: string[] = [];
  const visited = new Set<unknown>();
  let current: unknown = error;
  let depth = 0;

  while (current && depth < 3 && !visited.has(current)) {
    visited.add(current);
    if (current instanceof Error) {
      const message = current.message.trim();
      if (message) details.push(message);
      const status = (current as { status?: unknown }).status;
      if (typeof status === "number") details.push(`status=${status}`);
      const code = (current as { code?: unknown }).code;
      if (typeof code === "string" && code) details.push(`code=${code}`);
      current = (current as { cause?: unknown }).cause;
      depth += 1;
      continue;
    }
    break;
  }

  const normalized = details.join(" | ");
  if (normalized.includes(UNDICI_CONNECT_TIMEOUT_CODE)) {
    return `${normalized} | The server timed out while connecting to a required upstream service.`;
  }
  return normalized || "Background generation failed.";
}

async function notifyGenerationFailure(email: string, title: string, error: unknown): Promise<void> {
  await sendGenerationFailureEmail({
    email,
    title,
    reason: formatFailureReason(error),
  }).catch((mailError) => {
    console.error("[ai/generate-pdf] Failed to send generation failure email:", mailError);
  });
}

async function ensureGenerationStartedEmail(email: string, title: string): Promise<boolean> {
  try {
    await sendGenerationStartedEmail({ email, title });
    return true;
  } catch (mailError) {
    console.error("[ai/generate-pdf] Failed to send generation started email:", mailError);
    return false;
  }
}

async function runNotesBackground(params: {
  userEmail: string;
  university: string;
  course: string;
  stream: string;
  type: string;
  paperCode: string;
  unitNumber: number;
  model: string;
}): Promise<void> {
  const {
    userEmail, university, course, stream, type,
    paperCode, unitNumber, model,
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
  const { topic: topicConcurrency } = getModelConcurrency(model);
  const generatedChunks = await mapWithConcurrency(subTopics, topicConcurrency, async (topic, index) => {
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
          model,
        });
        const candidate = String(result.content ?? "").trim();
        if (candidate.length > MIN_TOPIC_RESPONSE_CHARS) {
          aiResponseText = candidate;
          break;
        }
      } catch (error) {
        if (isRateLimitError(error)) {
          await sleep(getRateLimitBackoffMs(model, 3));
        } else {
          await sleep(RETRY_ERROR_DELAY_MS);
        }
        if (retries >= TOPIC_RETRY_MAX - 1) {
          console.error("[ai/generate-pdf] Topic failed after retries.", { topicIndex: index + 1, error });
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
  const fileToken = ID.unique();
  const rendered = await renderMarkdownPdfToAppwrite({
    markdown: masterMarkdown,
    fileBaseName: `${paperCode}_unit_${unitNumber}_${fileToken}_${Date.now()}`,
    fileName: dynamicPdfName,
    gotenbergUrl: azureGotenbergUrl,
    modelName: model,
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
}

async function runSolvedPaperBackground(params: {
  userEmail: string;
  university: string;
  course: string;
  stream: string;
  type: string;
  paperCode: string;
  year: number;
  model: string;
}): Promise<void> {
  const {
    userEmail, university, course, stream, type,
    paperCode, year, model,
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
  const { question: questionConcurrency } = getModelConcurrency(model);
  const solvedChunks = await mapWithConcurrency(allQuestions, questionConcurrency, async (questionDoc, index) => {
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
          model,
        });
        const candidate = String(result.content ?? "").trim();
        if (candidate.length > MIN_SOLUTION_RESPONSE_CHARS) {
          aiResponseText = candidate;
          break;
        }
      } catch (error) {
        if (isRateLimitError(error)) {
          await sleep(getRateLimitBackoffMs(model, 5));
        } else {
          await sleep(RETRY_ERROR_DELAY_MS);
        }
        if (retries >= QUESTION_MAX_RETRIES - 1) {
          console.error("[ai/generate-pdf] Question failed after retries.", { questionLabel: qLabel, error });
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

  const fileToken = ID.unique();
  const rendered = await renderMarkdownPdfToAppwrite({
    markdown: masterMarkdown.trim(),
    fileBaseName: `${paperCode}_${year}_solved_${fileToken}_${Date.now()}`,
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
  const selectedModelRaw = typeof body.model === "string" ? body.model.trim() : "";
  const selectedModel = normalizeSelectedModel(selectedModelRaw || DEFAULT_AI_MODEL);
  const userEmail = typeof user.email === "string" ? user.email.trim() : "";

  if (!course) return NextResponse.json({ error: "Invalid selection: course is required." }, { status: 400 });
  if (!stream) return NextResponse.json({ error: "Invalid selection: stream is required." }, { status: 400 });
  if (!type) return NextResponse.json({ error: "Invalid selection: type is required." }, { status: 400 });
  if (!paperCode) return NextResponse.json({ error: "Invalid selection: paper code is required." }, { status: 400 });
  if (!isSupportedAiModel(selectedModel)) {
    return NextResponse.json(
      {
        error: `Unsupported model. Allowed values: ${SUPPORTED_AI_MODELS.join(", ")}. Legacy '${LEGACY_GEMINI_PREVIEW_MODEL}' is auto-mapped to '${DEFAULT_AI_MODEL}'.`,
      },
      { status: 400 },
    );
  }
  if (!isValidEmail(userEmail)) {
    return NextResponse.json(
      { error: "A valid account email is required to receive generated PDFs." },
      { status: 400 },
    );
  }

  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiApiKey?.trim()) {
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
    try {
      await reserveElectronCost(user.id, GENERATION_COST_ELECTRONS);
    } catch (error) {
      if (error instanceof Error && error.message === "INSUFFICIENT_ELECTRONS") {
        return NextResponse.json(
          { error: `Not enough electrons. Each generation costs ${GENERATION_COST_ELECTRONS}e.` },
          { status: 403 },
        );
      }
      return NextResponse.json({ error: "Unable to reserve electrons. Please try again." }, { status: 503 });
    }
    if (!admin) {
      try {
        await reserveQuotaForAcceptedRequest(user.id, "notes_generated_today");
      } catch (error) {
        console.error("[ai/generate-pdf] Failed to reserve notes quota for accepted request.", {
          userId: user.id,
          error,
        });
        await rollbackElectronCost(user.id, GENERATION_COST_ELECTRONS);
        return NextResponse.json(
          { error: QUOTA_RESERVATION_FAILED_MESSAGE, code: QUOTA_RESERVATION_FAILED_CODE },
          { status: 503 },
        );
      }
    }
    const startEmailSent = await ensureGenerationStartedEmail(
      userEmail,
      `Unit Notes (${paperCode} - Unit ${unitNumber})`,
    );
    if (!startEmailSent) {
      if (!admin) {
        await rollbackQuotaReservation(user.id, "notes_generated_today");
      }
      await rollbackElectronCost(user.id, GENERATION_COST_ELECTRONS);
      return NextResponse.json(
        {
          error: EMAIL_DELIVERY_UNAVAILABLE_MESSAGE,
          code: EMAIL_DELIVERY_UNAVAILABLE_CODE,
        },
        { status: 503 },
      );
    }
    if (!admin) {
      queueGenerationRecording(user.id, "notes_generated_today");
    }

    after(async () => {
      try {
        await runNotesBackground({
          userEmail,
          university,
          course,
          stream,
          type,
          paperCode,
          unitNumber,
          model: selectedModel,
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
  try {
    await reserveElectronCost(user.id, GENERATION_COST_ELECTRONS);
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_ELECTRONS") {
      return NextResponse.json(
        { error: `Not enough electrons. Each generation costs ${GENERATION_COST_ELECTRONS}e.` },
        { status: 403 },
      );
    }
    return NextResponse.json({ error: "Unable to reserve electrons. Please try again." }, { status: 503 });
  }
  if (!admin) {
    try {
      await reserveQuotaForAcceptedRequest(user.id, "papers_solved_today");
    } catch (error) {
      console.error("[ai/generate-pdf] Failed to reserve solved-paper quota for accepted request.", {
        userId: user.id,
        error,
      });
      await rollbackElectronCost(user.id, GENERATION_COST_ELECTRONS);
      return NextResponse.json(
        { error: QUOTA_RESERVATION_FAILED_MESSAGE, code: QUOTA_RESERVATION_FAILED_CODE },
        { status: 503 },
      );
    }
  }
  const startEmailSent = await ensureGenerationStartedEmail(userEmail, `Solved Paper (${paperCode} ${year})`);
  if (!startEmailSent) {
    if (!admin) {
      await rollbackQuotaReservation(user.id, "papers_solved_today");
    }
    await rollbackElectronCost(user.id, GENERATION_COST_ELECTRONS);
    return NextResponse.json(
      {
        error: EMAIL_DELIVERY_UNAVAILABLE_MESSAGE,
        code: EMAIL_DELIVERY_UNAVAILABLE_CODE,
      },
      { status: 503 },
    );
  }
  if (!admin) {
    queueGenerationRecording(user.id, "papers_solved_today");
  }

  after(async () => {
    try {
      await runSolvedPaperBackground({
        userEmail,
        university,
        course,
        stream,
        type,
        paperCode,
        year,
        model: selectedModel,
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
