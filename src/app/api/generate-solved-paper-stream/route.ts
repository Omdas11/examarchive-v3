import { NextResponse, type NextRequest } from "next/server";
import { getServerUser } from "@/lib/auth";
import { Compression } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import {
  adminDatabases,
  adminStorage,
  COLLECTION,
  DATABASE_ID,
  getAppwriteFileDownloadUrl,
  ID,
  MARKDOWN_CACHE_BUCKET_ID,
  Query,
} from "@/lib/appwrite";
import { getDailyLimit } from "@/lib/ai-limits";
import { readDynamicSystemPrompt } from "@/lib/system-prompt";
import { formatSearchResults, runWebSearch } from "@/lib/web-search";
import { checkAndResetQuotas, incrementQuotaCounter } from "@/lib/user-quotas";
import { sendGenerationPdfEmail } from "@/lib/generation-notifications";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { renderMarkdownPdfToAppwrite } from "@/lib/ai-pdf-pipeline";

export const maxDuration = 300;

const QUESTION_LOOP_DELAY_MS = 7000;
const PART_SIZE = 10;
const QUESTION_MAX_RETRIES = 4;
// Standard fallback delay for non-rate-limit/non-5xx retryable errors.
const RETRY_ERROR_DELAY_MS = 5000;
const SERVER_ERROR_RETRY_DELAY_MS = 15000;
const HEARTBEAT_INTERVAL_MS = 15000;
const MIN_SOLUTION_RESPONSE_CHARS = 10;
// Solved-paper streaming runs close to serverless time limits, so web search must fail fast.
const TAVILY_TIMEOUT_MS = 4000;
const GENERATING_STATUS = "generating";
const COMPLETED_STATUS = "completed";
const INITIAL_LAST_PROCESSED_INDEX = -1;
const ATTRIBUTE_AVAILABILITY_POLL_INTERVAL_MS = 300;
const ATTRIBUTE_AVAILABILITY_TIMEOUT_MS = 12000;
const SOLVED_PAPER_CACHE_TYPE = "solved_paper";
const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";
const SYLLABUS_CONTENT_MAX_LEN = 10_000;

class GeminiRequestError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

type SolvedPaperCheckpoint = {
  id: string;
  markdown: string;
  markdownFileId: string;
  pdfFileId: string;
  status: string;
  lastProcessedIndex: number;
};

function toSseData(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function toSseComment(comment: string): Uint8Array {
  return new TextEncoder().encode(`: ${comment}\n\n`);
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

/**
 * Safely extracts an HTTP-like status code from an unknown error object.
 * Supports numeric and numeric-string `status` fields.
 */
function getErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const raw = "status" in error ? (error as { status?: unknown }).status : null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/**
 * Fallback parser for extracting valid 4xx/5xx HTTP status codes from error text.
 * Used when upstream errors omit a structured numeric `status`.
 */
function getErrorStatusFromMessage(message: string): number | null {
  const match = message.match(/\b(4(?:0[0-9]|1[0-9]|2[0-9]|3[01])|5(?:0[0-9]|1[01]))\b/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function getAppwriteErrorCode(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const raw = "code" in error ? (error as { code?: unknown }).code : null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

async function waitForAttributeAvailable(key: string): Promise<void> {
  const db = adminDatabases();
  const deadline = Date.now() + ATTRIBUTE_AVAILABILITY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const attribute = await db.getAttribute(DATABASE_ID, COLLECTION.generated_notes_cache, key);
      if (attribute.status === "available") return;
      if (attribute.status === "failed" || attribute.status === "stuck") {
        throw new Error(
          `[generate-solved-paper-stream] Attribute ${key} failed to build with status=${attribute.status}: ${attribute.error || "unknown error"}`,
        );
      }
    } catch (error) {
      const code = getAppwriteErrorCode(error);
      if (code !== 404) {
        throw error;
      }
    }
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
    await sleep(Math.min(ATTRIBUTE_AVAILABILITY_POLL_INTERVAL_MS, remainingMs));
  }
  throw new Error(`[generate-solved-paper-stream] Timed out waiting for attribute ${key} to become available.`);
}

async function runRateLimitCountdown(params: {
  controller: ReadableStreamDefaultController<Uint8Array>;
  index: number;
  total: number;
  question: string;
  part: number;
  totalParts: number;
}): Promise<void> {
  for (let remainingSeconds = 60; remainingSeconds > 5; remainingSeconds -= 5) {
    params.controller.enqueue(toSseData({
      event: "progress",
      status: `Rate limit (TPM) active. Cooling down... resuming in ${remainingSeconds} seconds.`,
      index: params.index,
      total: params.total,
      question: params.question,
      part: params.part,
      totalParts: params.totalParts,
    }));
    params.controller.enqueue(toSseData({
      log: `Rate limit (TPM) active. Cooling down... resuming in ${remainingSeconds} seconds.`,
    }));
    await sleep(5000);
  }
  params.controller.enqueue(toSseData({
    event: "progress",
    status: "Rate limit (TPM) active. Cooling down... resuming in 5 seconds.",
    index: params.index,
    total: params.total,
    question: params.question,
    part: params.part,
    totalParts: params.totalParts,
  }));
  params.controller.enqueue(toSseData({
    log: "Rate limit (TPM) active. Cooling down... resuming in 5 seconds.",
  }));
  await sleep(5000);
  params.controller.enqueue(toSseData({
    log: "Cooldown complete. Retrying chunk...",
  }));
}

async function ensureSolvedPaperCacheSchema(): Promise<void> {
  const db = adminDatabases();
  const ensureAttribute = async (
    key: string,
    create: () => Promise<unknown>,
  ) => {
    try {
      const attribute = await db.getAttribute(DATABASE_ID, COLLECTION.generated_notes_cache, key);
      if (attribute.status !== "available") {
        await waitForAttributeAvailable(key);
      }
      return;
    } catch (error) {
      const code = getAppwriteErrorCode(error);
      if (code !== 400 && code !== 404) {
        throw error;
      }
    }

    try {
      await create();
    } catch (error) {
      const code = getAppwriteErrorCode(error);
      if (code !== 409) {
        throw error;
      }
    }
    await waitForAttributeAvailable(key);
  };

  await ensureAttribute("status", () =>
    db.createStringAttribute(
      DATABASE_ID,
      COLLECTION.generated_notes_cache,
      "status",
      50,
      true,
      undefined,
    ),
  );
  await ensureAttribute("last_processed_index", () =>
    db.createIntegerAttribute(
      DATABASE_ID,
      COLLECTION.generated_notes_cache,
      "last_processed_index",
      false,
      0,
      // 10k keeps a practical headroom far above current paper sizes while
      // staying finite so malformed writes cannot store unbounded values.
      10000,
      INITIAL_LAST_PROCESSED_INDEX,
    ),
  );
  await ensureAttribute("type", () =>
    db.createStringAttribute(
      DATABASE_ID,
      COLLECTION.generated_notes_cache,
      "type",
      50,
      true,
      SOLVED_PAPER_CACHE_TYPE,
    ),
  );
  await ensureAttribute("year", () =>
    db.createStringAttribute(
      DATABASE_ID,
      COLLECTION.generated_notes_cache,
      "year",
      10,
      false,
      undefined,
    ),
  );
  await ensureAttribute("part_number", () =>
    db.createIntegerAttribute(
      DATABASE_ID,
      COLLECTION.generated_notes_cache,
      "part_number",
      false,
      1,
      1000,
      1,
    ),
  );
  await ensureAttribute("markdown_file_id", () =>
    db.createStringAttribute(
      DATABASE_ID,
      COLLECTION.generated_notes_cache,
      "markdown_file_id",
      100,
      false,
      undefined,
    ),
  );
  await ensureAttribute("pdf_file_id", () =>
    db.createStringAttribute(
      DATABASE_ID,
      COLLECTION.generated_notes_cache,
      "pdf_file_id",
      100,
      false,
      undefined,
    ),
  );
  await ensureAttribute("paper_code", () =>
    db.createStringAttribute(
      DATABASE_ID,
      COLLECTION.generated_notes_cache,
      "paper_code",
      128,
      false,
      undefined,
    ),
  );
  await ensureAttribute("unit_number", () =>
    db.createIntegerAttribute(
      DATABASE_ID,
      COLLECTION.generated_notes_cache,
      "unit_number",
      false,
      0,
      9999,
      undefined,
    ),
  );
  await ensureAttribute("syllabus_content", () =>
    db.createStringAttribute(
      DATABASE_ID,
      COLLECTION.generated_notes_cache,
      "syllabus_content",
      SYLLABUS_CONTENT_MAX_LEN,
      false,
      undefined,
    ),
  );
}

async function ensureMarkdownCacheBucket(): Promise<void> {
  const storage = adminStorage();
  try {
    await storage.getBucket({ bucketId: MARKDOWN_CACHE_BUCKET_ID });
  } catch (error) {
    const code = getAppwriteErrorCode(error);
    if (code !== 404) throw error;
    await storage.createBucket({
      bucketId: MARKDOWN_CACHE_BUCKET_ID,
      name: MARKDOWN_CACHE_BUCKET_ID,
      permissions: [],
      fileSecurity: false,
      enabled: true,
      maximumFileSize: 20 * 1024 * 1024,
      allowedFileExtensions: ["md"],
      compression: Compression.None,
      encryption: true,
      antivirus: true,
      transformations: false,
    });
  }
}

async function uploadMarkdownToCacheFile(args: {
  markdown: string;
  cachePaperCode: string;
  year: number;
  partNumber: number;
}): Promise<string> {
  const storage = adminStorage();
  const inputFile = InputFile.fromBuffer(
    Buffer.from(args.markdown, "utf-8"),
    `${args.cachePaperCode}_${args.year}_part${args.partNumber}.md`,
  );
  const upload = await storage.createFile(MARKDOWN_CACHE_BUCKET_ID, ID.unique(), inputFile);
  return String(upload.$id);
}

async function downloadMarkdownFromCacheFile(markdownFileId: string): Promise<string> {
  const storage = adminStorage();
  const fileBuffer = await storage.getFileDownload(MARKDOWN_CACHE_BUCKET_ID, markdownFileId);
  return Buffer.from(fileBuffer).toString("utf-8");
}

async function fetchTavilyContext(query: string): Promise<string> {
  try {
    const results = await runWebSearch(query, 5, TAVILY_TIMEOUT_MS);
    return formatSearchResults(results) || "";
  } catch (error) {
    console.warn("Tavily search timed out, proceeding without context", error);
    return "";
  }
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/**
 * Extract a sortable question number from mixed input types.
 * @param value Question number as number/string/unknown from DB row.
 * Returns Number.MAX_SAFE_INTEGER when no numeric value can be parsed,
 * so malformed question numbers are pushed to the end of sorted results.
 */
function extractQuestionNumber(value: unknown): number {
  const normalized = normalizeNumber(value);
  if (normalized !== null) return normalized;
  if (typeof value === "string") {
    const match = value.match(/\d+/);
    if (match) {
      const parsed = Number(match[0]);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return Number.MAX_SAFE_INTEGER;
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
    console.error("[generate-solved-paper-stream] Failed to record usage:", error);
  }
}

function getSolvedPaperCacheKey(course: string, type: string, paperCode: string): string {
  return `${course}::${type}::${paperCode}`.slice(0, 128);
}

function normalizeSemester(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 8) return null;
  return parsed;
}

async function readSolvedPaperCheckpoint(
  cachePaperCode: string,
  year: number,
): Promise<SolvedPaperCheckpoint | null> {
  const db = adminDatabases();
  try {
    const res = await db.listDocuments(DATABASE_ID, COLLECTION.generated_notes_cache, [
      Query.equal("paper_code", cachePaperCode),
      Query.equal("type", SOLVED_PAPER_CACHE_TYPE),
      Query.equal("unit_number", year),
      Query.equal("year", String(year)),
      Query.orderDesc("$createdAt"),
      Query.limit(1),
    ]);
    const doc = res.documents[0];
    if (!doc) return null;
    const markdownFileId = typeof doc.markdown_file_id === "string" ? doc.markdown_file_id.trim() : "";
    const markdown = markdownFileId ? await downloadMarkdownFromCacheFile(markdownFileId) : "";
    return {
      id: String(doc.$id),
      markdown,
      markdownFileId,
      pdfFileId: typeof doc.pdf_file_id === "string" ? doc.pdf_file_id.trim() : "",
      status: typeof doc.status === "string" ? doc.status : "",
      lastProcessedIndex:
        typeof doc.last_processed_index === "number"
          ? doc.last_processed_index
          : INITIAL_LAST_PROCESSED_INDEX,
    };
  } catch (error) {
    console.error("[generate-solved-paper-stream] Failed to read checkpoint:", error);
    return null;
  }
}

async function readCompletedSolvedPaperCache(
  cachePaperCode: string,
  year: number,
): Promise<{ id: string; markdown: string; pdfFileId: string } | null> {
  const db = adminDatabases();
  try {
    const res = await db.listDocuments(DATABASE_ID, COLLECTION.generated_notes_cache, [
      Query.equal("paper_code", cachePaperCode),
      Query.equal("type", SOLVED_PAPER_CACHE_TYPE),
      Query.equal("status", COMPLETED_STATUS),
      Query.equal("unit_number", year),
      Query.equal("year", String(year)),
      Query.orderDesc("$createdAt"),
      Query.limit(1),
    ]);
    const doc = res.documents[0];
    if (!doc) return null;
    const markdownFileId = typeof doc.markdown_file_id === "string" ? doc.markdown_file_id.trim() : "";
    if (!markdownFileId) return null;
    const markdown = (await downloadMarkdownFromCacheFile(markdownFileId)).trim();
    if (!markdown) return null;
    return {
      id: String(doc.$id),
      markdown,
      pdfFileId: typeof doc.pdf_file_id === "string" ? doc.pdf_file_id.trim() : "",
    };
  } catch (error) {
    console.error("[generate-solved-paper-stream] Failed to read completed cache:", error);
    return null;
  }
}

async function upsertSolvedPaperCheckpoint(params: {
  checkpointId: string | null;
  cachePaperCode: string;
  year: number;
  markdown: string;
  status: string;
  lastProcessedIndex: number;
}): Promise<string | null> {
  const db = adminDatabases();
  const resolvedPartNumber = Math.max(1, Math.floor(params.lastProcessedIndex / PART_SIZE) + 1);
  const buildPayload = (docId: string, markdownFileId: string) => ({
    id: docId,
    paper_code: params.cachePaperCode,
    unit_number: params.year,
    year: String(params.year),
    part_number: resolvedPartNumber,
    type: SOLVED_PAPER_CACHE_TYPE,
    markdown_file_id: markdownFileId,
    status: params.status,
    last_processed_index: params.lastProcessedIndex,
    syllabus_content: "",
    created_at: new Date().toISOString(),
  });
  try {
    const uploadedFileId = await uploadMarkdownToCacheFile({
      markdown: params.markdown,
      cachePaperCode: params.cachePaperCode,
      year: params.year,
      partNumber: resolvedPartNumber,
    });

    const tryUpdateById = async (docId: string): Promise<boolean> => {
      try {
        await db.updateDocument(
          DATABASE_ID,
          COLLECTION.generated_notes_cache,
          docId,
          buildPayload(docId, uploadedFileId),
        );
        return true;
      } catch (error) {
        console.warn(
          `[generate-solved-paper-stream] Checkpoint update failed for id=${docId}; falling back to query-based update/create:`,
          error,
        );
        return false;
      }
    };

    if (params.checkpointId && (await tryUpdateById(params.checkpointId))) {
      return params.checkpointId;
    }

    let queriedCheckpointId: string | undefined;
    try {
      const existing = await db.listDocuments(DATABASE_ID, COLLECTION.generated_notes_cache, [
        Query.equal("paper_code", params.cachePaperCode),
        Query.equal("type", SOLVED_PAPER_CACHE_TYPE),
        Query.equal("unit_number", params.year),
        Query.equal("year", String(params.year)),
        Query.orderDesc("$createdAt"),
        Query.limit(1),
      ]);
      queriedCheckpointId = existing.documents[0]?.$id;
    } catch (error) {
      console.warn(
        "[generate-solved-paper-stream] Checkpoint lookup failed; falling back to create:",
        error,
      );
    }
    if (queriedCheckpointId && (await tryUpdateById(queriedCheckpointId))) {
      return queriedCheckpointId;
    }

    const createdId = ID.unique();
    const created = await db.createDocument(
      DATABASE_ID,
      COLLECTION.generated_notes_cache,
      createdId,
      buildPayload(createdId, uploadedFileId),
    );
    return String(created.$id);
  } catch (error) {
    console.error("[generate-solved-paper-stream] Failed to persist checkpoint:", error);
    return params.checkpointId;
  }
}

async function updateSolvedPaperCheckpointPdfFileId(checkpointId: string, pdfFileId: string): Promise<void> {
  const db = adminDatabases();
  try {
    await db.updateDocument(
      DATABASE_ID,
      COLLECTION.generated_notes_cache,
      checkpointId,
      { pdf_file_id: pdfFileId },
    );
  } catch (error) {
    console.error("[generate-solved-paper-stream] Failed to persist cached PDF file id:", error);
  }
}

export async function GET(request: NextRequest) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const metaFlag = (searchParams.get("meta") || "").toLowerCase();
  const metaOnly = metaFlag === "1" || metaFlag === "true";
  const partParam = searchParams.get("part");
  const parsedPart = partParam === null ? 1 : Number(partParam);
  if (!Number.isInteger(parsedPart) || parsedPart < 1) {
    return NextResponse.json({ error: "Invalid part parameter. Must be a positive integer." }, { status: 400 });
  }
  const part = parsedPart;

  const university = (searchParams.get("university") || "Assam University").trim();
  const course = (searchParams.get("course") || "").trim();
  const streamName = (searchParams.get("stream") || "").trim();
  const type = (searchParams.get("type") || "").trim();
  const paperCode = (searchParams.get("paperCode") || "").trim();
  const year = normalizeNumber(searchParams.get("year"));
  const semester = normalizeSemester(searchParams.get("semester"));
  const gotenbergUrl = process.env.GOTENBERG_URL || process.env.HF_GOTENBERG_URL || process.env.AZURE_GOTENBERG_URL;

  if (!course || !streamName || !type || !paperCode || year === null) {
    return NextResponse.json(
      { error: "Invalid selection. Please choose course, stream, type, paper code, and year." },
      { status: 400 },
    );
  }
  if (!gotenbergUrl) {
    return NextResponse.json(
      { error: "Server misconfiguration: GOTENBERG_URL is missing." },
      { status: 503 },
    );
  }
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    return NextResponse.json(
      { error: "Invalid year. Please provide a valid year between 1900 and 2100." },
      { status: 400 },
    );
  }

  const isAdminPlus = user.role === "admin" || user.role === "founder";

  await ensureSolvedPaperCacheSchema();
  await ensureMarkdownCacheBucket();
  const cachePaperCode = getSolvedPaperCacheKey(course, type, `${paperCode}:${semester ?? "all"}`);

  if (metaOnly) {
    try {
      const db = adminDatabases();
      const questionsRes = await db.listDocuments(DATABASE_ID, COLLECTION.questions_table, [
        Query.equal("university", university),
        Query.equal("course", course),
        Query.equal("stream", streamName),
        Query.equal("type", type),
        Query.equal("paper_code", paperCode),
        Query.equal("year", year),
        Query.limit(500),
      ]);
      const totalQuestions = questionsRes.documents.filter((doc) =>
        typeof doc.question_content === "string" && doc.question_content.trim().length > 0,
      ).length;
      const dynamicPartSize = PART_SIZE;
      const totalParts = Math.max(1, Math.ceil(totalQuestions / dynamicPartSize));
      return NextResponse.json({
        totalQuestions,
        partSize: dynamicPartSize,
        totalParts,
        etaMinutes: Math.ceil((totalQuestions * 16) / 60),
      });
    } catch (error) {
      console.error("[generate-solved-paper-stream] Failed to read question metadata:", error);
      return NextResponse.json({ error: "Failed to fetch solved-paper metadata." }, { status: 500 });
    }
  }

  const completedCache = await readCompletedSolvedPaperCache(cachePaperCode, year);
  if (completedCache) {
    const stream = new ReadableStream<Uint8Array>({
      start: async (controller) => {
        let pdfUrl = completedCache.pdfFileId ? getAppwriteFileDownloadUrl(completedCache.pdfFileId) : "";
        if (!pdfUrl) {
          try {
            controller.enqueue(toSseData({ log: "Cache hit: generating PDF from cached markdown..." }));
            const rendered = await renderMarkdownPdfToAppwrite({
              markdown: completedCache.markdown,
              fileBaseName: `${paperCode}_${year}_solved_cache`,
              fileName: `${paperCode}_${year}_solved_paper.pdf`,
              gotenbergUrl,
              paperCode,
              year,
            });
            pdfUrl = rendered.fileUrl;
            await updateSolvedPaperCheckpointPdfFileId(completedCache.id, rendered.fileId);
            controller.enqueue(toSseData({ log: "PDF rendered successfully from cached content." }));
          } catch (pdfError) {
            const pipelineMessage = pdfError instanceof Error ? pdfError.message : String(pdfError);
            controller.enqueue(toSseData({ event: "error", error: `PDF generation failed: ${pipelineMessage}` }));
            controller.close();
            return;
          }
        } else {
          controller.enqueue(toSseData({ log: "Cache hit: reusing previously rendered PDF." }));
        }
        controller.enqueue(toSseData({
          event: "done",
          markdown: completedCache.markdown,
          model: "cache",
          cached: true,
          pdf_url: pdfUrl || null,
        }));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  const quota = await checkAndResetQuotas(user.id);
  if (!metaOnly && !isAdminPlus && quota.papers_solved_today >= 1) {
    return NextResponse.json(
      { error: "Daily limit reached for Solved Papers (1/day)." },
      { status: 429 },
    );
  }

  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiApiKey) return NextResponse.json({ error: "Google Gemini is not configured." }, { status: 503 });

  const todayStr = new Date().toISOString().slice(0, 10);
  const dailyLimit = getDailyLimit();
  let usedBefore = 0;
  if (!metaOnly && !isAdminPlus) {
    usedBefore = await getDailyCount(user.id, todayStr);
    if (usedBefore >= dailyLimit) {
      return NextResponse.json(
        { error: "Generation quota exceeded.", code: "QUOTA_EXCEEDED", remaining: 0 },
        { status: 403 },
      );
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      let isClosed = false;
      const heartbeat = setInterval(() => {
        if (isClosed) return;
        try {
          controller.enqueue(toSseComment("heartbeat"));
        } catch {
          clearInterval(heartbeat);
        }
      }, HEARTBEAT_INTERVAL_MS);
      const closeStream = () => {
        if (isClosed) return;
        isClosed = true;
        controller.close();
      };

      try {
        controller.enqueue(toSseData({
          log: `Starting free-tier generation for ${paperCode}...`,
        }));
        const db = adminDatabases();
        const questionsRes = await db.listDocuments(DATABASE_ID, COLLECTION.questions_table, [
          Query.equal("university", university),
          Query.equal("course", course),
          Query.equal("stream", streamName),
          Query.equal("type", type),
          Query.equal("paper_code", paperCode),
          Query.equal("year", year),
          Query.orderAsc("question_no"),
          Query.limit(500),
        ]);

        const allQuestions = questionsRes.documents
          .filter((doc) => typeof doc.question_content === "string" && doc.question_content.trim().length > 0)
          .sort((a, b) => {
            const questionNumberCompare = extractQuestionNumber(a.question_no) - extractQuestionNumber(b.question_no);
            if (questionNumberCompare !== 0) return questionNumberCompare;
            const aSub = typeof a.question_subpart === "string" ? a.question_subpart : "";
            const bSub = typeof b.question_subpart === "string" ? b.question_subpart : "";
            // subparts may contain mixed forms like "2", "2a", "10b", so keep locale numeric compare.
            return aSub.localeCompare(bSub, undefined, { sensitivity: "base", numeric: true });
          });

        if (allQuestions.length === 0) {
          controller.enqueue(toSseData({ event: "error", error: "No questions found for the selected paper/year." }));
          closeStream();
          return;
        }
        const model = GEMINI_MODEL;
        const dynamicPartSize = PART_SIZE;
        const totalParts = Math.max(1, Math.ceil(allQuestions.length / dynamicPartSize));
        if (part > totalParts) {
          controller.enqueue(toSseData({ event: "error", error: `Invalid part ${part}. Last available part is ${totalParts}.` }));
          closeStream();
          return;
        }
        const requestedStartIndex = (part - 1) * dynamicPartSize;
        const requestedEndIndex = Math.min(requestedStartIndex + dynamicPartSize, allQuestions.length);

        const systemPrompt = readDynamicSystemPrompt({
          routePath: request.nextUrl.pathname,
          promptType: "solved_paper",
        });
        controller.enqueue(toSseData({
          log: `Using provider/model: google/${model}`,
        }));
        const googleClient = new GoogleGenerativeAI(String(geminiApiKey));
        const cachePaperCode = getSolvedPaperCacheKey(course, type, `${paperCode}:${semester ?? "all"}`);
        const checkpoint = await readSolvedPaperCheckpoint(cachePaperCode, year);
        if (checkpoint?.status === COMPLETED_STATUS && checkpoint.markdown.trim().length > 0) {
          let pdfUrl = checkpoint.pdfFileId ? getAppwriteFileDownloadUrl(checkpoint.pdfFileId) : "";
          if (!pdfUrl) {
            controller.enqueue(toSseData({
              log: "Cache hit: generating PDF from completed cached markdown.",
            }));
            try {
              const rendered = await renderMarkdownPdfToAppwrite({
                markdown: checkpoint.markdown.trim(),
                fileBaseName: `${paperCode}_${year}_solved_cache`,
                fileName: `${paperCode}_${year}_solved_paper.pdf`,
                gotenbergUrl,
                paperCode,
                year,
              });
              pdfUrl = rendered.fileUrl;
              await updateSolvedPaperCheckpointPdfFileId(checkpoint.id, rendered.fileId);
              controller.enqueue(toSseData({ log: "PDF rendered successfully from cached content." }));
            } catch (pdfError) {
              const pipelineMessage = pdfError instanceof Error ? pdfError.message : String(pdfError);
              controller.enqueue(toSseData({ event: "error", error: `PDF generation failed: ${pipelineMessage}` }));
              closeStream();
              return;
            }
          } else {
            controller.enqueue(toSseData({ log: "Cache hit: reusing previously rendered PDF." }));
          }
          controller.enqueue(toSseData({
            event: "done",
            markdown: checkpoint.markdown.trim(),
            model: "cache",
            total: allQuestions.length,
            cached: true,
            pdf_url: pdfUrl || null,
          }));
          closeStream();
          return;
        }

        // Keep already-generated content when continuing chained parts, and also
        // when part 1 is retrying/resuming an interrupted "generating" checkpoint.
        const shouldAccumulateCheckpointMarkdown =
          part > 1 || checkpoint?.status === GENERATING_STATUS;
        let masterMarkdown = shouldAccumulateCheckpointMarkdown ? checkpoint?.markdown ?? "" : "";
        if (masterMarkdown && !masterMarkdown.endsWith("\n")) {
          masterMarkdown += "\n";
        }
        let lastProcessedIndex =
          typeof checkpoint?.lastProcessedIndex === "number"
            ? checkpoint.lastProcessedIndex
            : INITIAL_LAST_PROCESSED_INDEX;
        const resumeStartIndex = lastProcessedIndex + 1;
        // When resuming an interrupted generation, never go backwards.
        const startIndex = checkpoint?.status === GENERATING_STATUS
          ? Math.max(0, resumeStartIndex, requestedStartIndex)
          : requestedStartIndex;
        const endIndex = Math.min(Math.max(startIndex, requestedEndIndex), allQuestions.length);
        const isLastPart = endIndex >= allQuestions.length;
        // NOTE: When validating TPM behavior, keep each part very small
        // (ideally 1-2 questions) because prompt context can already be several thousand tokens.
        let checkpointId =
          (await upsertSolvedPaperCheckpoint({
            checkpointId: checkpoint?.id ?? null,
            cachePaperCode,
            year,
            markdown: masterMarkdown,
            status: GENERATING_STATUS,
            lastProcessedIndex,
          })) ?? checkpoint?.id ?? null;

        if (checkpoint?.status === GENERATING_STATUS) {
          controller.enqueue(toSseData({
            event: "progress",
            status: `Resuming generation from question ${startIndex + 1}...`,
            index: startIndex,
            total: allQuestions.length,
          }));
        }
        if (startIndex >= allQuestions.length) {
          checkpointId = await upsertSolvedPaperCheckpoint({
            checkpointId,
            cachePaperCode,
            year,
            markdown: masterMarkdown,
            status: COMPLETED_STATUS,
            lastProcessedIndex: allQuestions.length - 1,
          });
          let pdfUrl = checkpoint?.pdfFileId ? getAppwriteFileDownloadUrl(checkpoint.pdfFileId) : "";
          if (!pdfUrl) {
            try {
              controller.enqueue(toSseData({ log: "All questions processed. Generating PDF from cached markdown..." }));
              const rendered = await renderMarkdownPdfToAppwrite({
                markdown: masterMarkdown.trim(),
                fileBaseName: `${paperCode}_${year}_solved_cache`,
                fileName: `${paperCode}_${year}_solved_paper.pdf`,
                gotenbergUrl,
                paperCode,
                year,
              });
              pdfUrl = rendered.fileUrl;
              if (checkpointId) {
                await updateSolvedPaperCheckpointPdfFileId(checkpointId, rendered.fileId);
              }
              controller.enqueue(toSseData({ log: "PDF rendered successfully." }));
            } catch (pdfError) {
              const pipelineMessage = pdfError instanceof Error ? pdfError.message : String(pdfError);
              controller.enqueue(toSseData({ event: "error", error: `PDF generation failed: ${pipelineMessage}` }));
              closeStream();
              return;
            }
          } else {
            controller.enqueue(toSseData({ log: "All questions processed. Reusing cached PDF." }));
          }
          controller.enqueue(toSseData({
            event: "done",
            markdown: masterMarkdown.trim(),
            model: "cache",
            total: allQuestions.length,
            cached: true,
            pdf_url: pdfUrl || null,
          }));
          closeStream();
          return;
        }

        for (const [offset, questionDoc] of allQuestions.slice(startIndex, endIndex).entries()) {
          const index = startIndex + offset;
          const qNo = String(questionDoc.question_no ?? index + 1).trim();
          const qSub = typeof questionDoc.question_subpart === "string" ? questionDoc.question_subpart.trim() : "";
          const qLabel = `Q${qNo}${qSub ? `(${qSub})` : ""}`;
          const questionContent = String(questionDoc.question_content ?? "").trim();
          const marks =
            typeof questionDoc.marks === "number"
              ? questionDoc.marks
              : normalizeNumber(questionDoc.marks);

          controller.enqueue(toSseData({
            event: "progress",
            status: `Searching web and solving ${qLabel} (${index + 1}/${allQuestions.length})...`,
            index: index + 1,
            total: allQuestions.length,
            question: qLabel,
            part,
            totalParts,
          }));

          const tavilyContext = await fetchTavilyContext(questionContent);

          const questionText = `University: ${university}

Course: ${course}
Stream: ${streamName}
Type: ${type}
Paper Code: ${paperCode}
Year: ${year}
Question Label: ${qLabel}
Marks: ${marks ?? "N/A"}

CRITICAL LENGTH CONSTRAINT: This question is worth ${marks ?? "N/A"} marks. If it is 1 or 2 marks, provide a highly concise definition or final formula without any long derivations. If it is 4 or more marks, provide a detailed, step-by-step exhaustive derivation and explanation.

Question:
${questionContent}

Tavily Web Context:
${tavilyContext}

CRITICAL FORMAT CONSTRAINTS:
1. Do NOT write a document title.
2. Do NOT repeat syllabus or section roadmap.
3. Do NOT include introductory filler or meta commentary.
4. Start directly with the answer to this specific question.
5. Use concise markdown only for this question (equations/steps where needed).
6. Do NOT write "Unit", paper code, or course title as headings.
7. Do NOT use numeric prefixes in major headings (e.g. avoid "1. Definition").
`;

          let aiResponseText = "";
          let retries = 0;
          while (retries < QUESTION_MAX_RETRIES) {
            try {
              let candidate = "";
              controller.enqueue(toSseData({
                log: `Prompting google/${model} for Part ${part} (${qLabel})...`,
              }));
              try {
                const aiModel = googleClient.getGenerativeModel({
                  model,
                  systemInstruction: systemPrompt,
                });
                const result = await aiModel.generateContent(questionText);
                candidate = String(result.response.text?.() ?? "").trim();
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error ?? "Google request failed");
                const status = getErrorStatus(error) ?? getErrorStatusFromMessage(errorMessage) ?? 503;
                throw new GeminiRequestError(status, errorMessage);
              }
              if (candidate.length > MIN_SOLUTION_RESPONSE_CHARS) {
                aiResponseText = candidate;
                break;
              }
            } catch (error) {
              const errorStatus = getErrorStatus(error);
              const errorMessage =
                error instanceof Error ? error.message : String(error ?? "");
              const messageStatus = getErrorStatusFromMessage(errorMessage);
              if (isRateLimitError(error)) {
                await runRateLimitCountdown({
                  controller,
                  index: index + 1,
                  total: allQuestions.length,
                  question: qLabel,
                  part,
                  totalParts,
                });
              } else if (
                (errorStatus !== null && errorStatus >= 500) ||
                (messageStatus !== null && messageStatus >= 500)
              ) {
                controller.enqueue(toSseData({
                  event: "progress",
                  status: "AI server overloaded (5xx). Retrying shortly...",
                  index: index + 1,
                  total: allQuestions.length,
                  question: qLabel,
                  part,
                  totalParts,
                }));
                await sleep(SERVER_ERROR_RETRY_DELAY_MS);
              } else {
                console.error("[generate-solved-paper-stream] Gemini API error:", error);
                controller.enqueue(toSseData({
                  log: "Model error (404/401/429). Check Gemini API key or rate limits.",
                }));
                await sleep(RETRY_ERROR_DELAY_MS);
              }
            }
            retries += 1;
          }

          const solvedChunk = aiResponseText || "_No solution generated after retries._";
          const displaySubpart = qSub || "-";
          const questionYear =
            typeof questionDoc.year === "number"
              ? questionDoc.year
              : normalizeNumber(String(questionDoc.year ?? "")) ?? year;
          const header = `### Q${qNo}(${displaySubpart}) [${questionYear}] [${marks ?? "N/A"} Marks]\n**${questionContent}**\n\n`;
          if (masterMarkdown) masterMarkdown += "\n\n";
          masterMarkdown += `${header}${solvedChunk}\n\n---\n`;
          lastProcessedIndex = index;
          checkpointId = await upsertSolvedPaperCheckpoint({
            checkpointId,
            cachePaperCode,
            year,
            markdown: masterMarkdown,
            status: GENERATING_STATUS,
            lastProcessedIndex,
          });
          controller.enqueue(toSseData({
            log: "Chunk successfully saved to Appwrite Cache.",
          }));

          await sleep(QUESTION_LOOP_DELAY_MS);
        }

        await upsertSolvedPaperCheckpoint({
          checkpointId,
          cachePaperCode,
          year,
          markdown: masterMarkdown,
          status: isLastPart ? COMPLETED_STATUS : GENERATING_STATUS,
          lastProcessedIndex,
        });

        if (!isLastPart) {
          controller.enqueue(toSseData({
            event: "handoff",
            action: "auto_continue",
            nextPart: part + 1,
            part,
            totalParts,
            total: allQuestions.length,
          }));
          closeStream();
          return;
        }

        controller.enqueue(toSseData({ log: "AI generation complete. Sending to Azure for PDF rendering..." }));
        let pdfUrl: string | null = null;
        try {
          controller.enqueue(toSseData({ log: "Sending HTML payload to Azure Gotenberg..." }));
          const rendered = await renderMarkdownPdfToAppwrite({
            markdown: masterMarkdown.trim(),
            fileBaseName: `${paperCode}_${year}_solved_${Date.now()}`,
            fileName: `${paperCode}_${year}_solved_paper.pdf`,
            gotenbergUrl,
            paperCode,
            year,
          });
          pdfUrl = rendered.fileUrl;
          controller.enqueue(toSseData({ log: "PDF rendered and uploaded successfully." }));
        } catch (pdfError) {
          console.error("[generate-solved-paper-stream] PDF Engine Error:", pdfError);
          const pipelineMessage = pdfError instanceof Error ? pdfError.message : String(pdfError);
          controller.enqueue(toSseData({ event: "error", error: `PDF generation failed: ${pipelineMessage}` }));
          closeStream();
          return;
        }

        if (typeof user.email === "string" && user.email.trim().length > 0) {
          try {
            if (pdfUrl) {
              await sendGenerationPdfEmail({
                email: user.email,
                downloadUrl: pdfUrl,
                title: `Solved Paper (${paperCode} ${year})`,
              });
            }
          } catch (emailError) {
            console.error("[generate-solved-paper-stream] Failed to send generation email:", emailError);
          }
        }

        controller.enqueue(toSseData({
          event: "done",
          markdown: masterMarkdown.trim(),
          model,
          total: allQuestions.length,
          part,
          totalParts,
          pdf_url: pdfUrl,
        }));
        if (!isAdminPlus) {
          await recordGeneration(user.id, todayStr);
          await incrementQuotaCounter(user.id, "papers_solved_today");
        }
      } catch (error) {
        console.error("[generate-solved-paper-stream] Failed:", error);
        controller.enqueue(toSseData({ event: "error", error: "Failed to generate solved paper." }));
      } finally {
        clearInterval(heartbeat);
        closeStream();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
