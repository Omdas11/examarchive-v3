import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { InputFile } from "node-appwrite/file";
import { getServerUser } from "@/lib/auth";
import { getDailyLimit } from "@/lib/ai-limits";
import { checkAndResetQuotas, incrementQuotaCounter, rollbackQuotaCounter } from "@/lib/user-quotas";
import { NOTES_DAILY_LIMIT } from "@/lib/quota-config";
import {
  adminDatabases,
  adminFunctions,
  adminStorage,
  BUCKET_ID,
  CACHED_SOLVED_PAPERS_BUCKET_ID,
  CACHED_UNIT_NOTES_BUCKET_ID,
  COLLECTION,
  DATABASE_ID,
  getAppwriteFileDownloadUrl,
  ID,
  Query,
} from "@/lib/appwrite";
import { GeminiServiceError, runGeminiCompletion } from "@/lib/gemini";
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

// Keep route timeout explicit for current deployment while allowing complex note generation.
export const maxDuration = 60;

const DEFAULT_AI_MODEL = "gemini-3.1-flash-lite-preview";
const GEMMA_UNLIMITED_TPM_MODEL = "gemma-4-31b-it";
const MIN_TOPIC_RESPONSE_CHARS = 50;
const TOPIC_FALLBACK_MAX_TOKENS = 3000;
const MIN_SOLUTION_RESPONSE_CHARS = 10;
const RETRY_BASE_DELAY_MS = 2000;
const TAVILY_TIMEOUT_MS = 4000;
const LOGICAL_CHUNK_COUNT = 5;
const GEMINI_CALL_COOLDOWN_MS = 3000;
const CHUNK_MAX_ATTEMPTS = 3;
const DEFAULT_BACKGROUND_JOB_TIMEOUT_MS = 12 * 60 * 1000;
const envBackgroundJobTimeoutMs = Number(process.env.AI_PDF_BACKGROUND_JOB_TIMEOUT_MS);
const BACKGROUND_JOB_TIMEOUT_MS = Number.isFinite(envBackgroundJobTimeoutMs)
  ? Math.max(60_000, envBackgroundJobTimeoutMs)
  : DEFAULT_BACKGROUND_JOB_TIMEOUT_MS;
const MIN_SEMESTER = 1;
const MAX_SEMESTER = 8;
const CACHE_HASH_PREFIX_LENGTH = 16;
const TRUSTED_GOTENBERG_HOST_SUFFIX = ".hf.space";
const UNDICI_CONNECT_TIMEOUT_CODE = "UND_ERR_CONNECT_TIMEOUT";
const EMAIL_DELIVERY_UNAVAILABLE_CODE = "EMAIL_DELIVERY_UNAVAILABLE";
const EMAIL_DELIVERY_UNAVAILABLE_MESSAGE =
  "Unable to send generation confirmation email. Request was not started. Please verify email settings and try again.";
const QUOTA_RESERVATION_FAILED_CODE = "QUOTA_RESERVATION_FAILED";
const QUOTA_RESERVATION_FAILED_MESSAGE = "Failed to reserve generation quota. Please try again later.";
const GOTENBERG_AUTH_DEBUG_LOG_ENABLED = process.env.GOTENBERG_AUTH_DEBUG_LOG === "1";
const DEFAULT_PDF_GENERATOR_FUNCTION_ID = "pdf-generator";

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

type CacheType = "notes" | "solved-paper";

function isAdminPlus(role: string): boolean {
  return role === "moderator" || role === "admin" || role === "founder";
}

function normalizeYear(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.floor(parsed);
}

function normalizeSemester(value: unknown): number | null {
  if (value === null || typeof value === "undefined" || value === "") return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (!Number.isInteger(parsed) || parsed < MIN_SEMESTER || parsed > MAX_SEMESTER) return null;
  return parsed;
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
      const safeCurrent = Number.isFinite(current) ? current : 0;
      await db.updateDocument(DATABASE_ID, COLLECTION.users, userId, {
        ai_credits: Math.max(0, safeCurrent + cost),
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

function logGotenbergAuthDebug(): void {
  if (!GOTENBERG_AUTH_DEBUG_LOG_ENABLED) return;
  console.log("[ai/generate-pdf] GOTENBERG_AUTH_TOKEN loaded:", {
    present: Boolean(process.env.GOTENBERG_AUTH_TOKEN?.trim()),
    looksLikeHfToken: process.env.GOTENBERG_AUTH_TOKEN?.trim().startsWith("hf_") ?? false,
  });
}

function resolveGotenbergUrl(): string {
  return process.env.GOTENBERG_URL?.trim() || "";
}

function resolvePdfGeneratorFunctionId(): string {
  return process.env.APPWRITE_PDF_GENERATOR_FUNCTION_ID?.trim() || DEFAULT_PDF_GENERATOR_FUNCTION_ID;
}

function normalizeSelectedModel(value: string): string {
  if (value === "gemini-3.1-flash-lite") return DEFAULT_AI_MODEL;
  if (value === "gemma-4-31b") return GEMMA_UNLIMITED_TPM_MODEL;
  return value;
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

function abortError(signal: AbortSignal): Error {
  const reason = signal.reason;
  if (reason instanceof Error) return reason;
  if (typeof reason === "string" && reason.trim()) return new Error(reason);
  return new Error("Operation aborted");
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw abortError(signal);
  }
}

async function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  if (!signal) {
    await sleep(ms);
    return;
  }
  throwIfAborted(signal);
  await new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timeoutHandle);
      signal.removeEventListener("abort", onAbort);
      reject(abortError(signal));
    };
    const timeoutHandle = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function splitIntoLogicalChunks<T>(items: readonly T[], chunkCount: number): T[][] {
  if (items.length === 0) return [];
  const safeChunkCount = Math.max(1, Math.min(chunkCount, items.length));
  const baseSize = Math.floor(items.length / safeChunkCount);
  const remainder = items.length % safeChunkCount;
  const chunks: T[][] = [];
  let start = 0;
  for (let index = 0; index < safeChunkCount; index += 1) {
    const size = baseSize + (index < remainder ? 1 : 0);
    const end = start + size;
    chunks.push(items.slice(start, end));
    start = end;
  }
  return chunks.filter((chunk) => chunk.length > 0);
}

function buildContentHash(parts: Array<string | number | null | undefined>): string {
  const normalized = parts
    .map((part) => (part === null || typeof part === "undefined" ? "" : String(part).trim().toLowerCase()))
    .join("::");
  return createHash("sha256").update(normalized).digest("hex");
}

async function hasCachedPdf(fileId: string): Promise<boolean> {
  const trimmed = fileId.trim();
  if (!trimmed) return false;
  const storage = adminStorage();
  try {
    await storage.getFile(BUCKET_ID, trimmed);
    return true;
  } catch {
    return false;
  }
}

async function readCachedMarkdown(params: {
  contentHash: string;
  cacheType: CacheType;
  defaultBucketId: string;
}): Promise<{ cacheId: string; markdown: string; pdfFileId: string | null } | null> {
  const db = adminDatabases();
  const storage = adminStorage();
  try {
    const result = await db.listDocuments(DATABASE_ID, COLLECTION.ai_cache_index, [
      Query.equal("content_hash", params.contentHash),
      Query.equal("cache_type", params.cacheType),
      Query.equal("status", "completed"),
      Query.orderDesc("$createdAt"),
      Query.limit(1),
    ]);
    const doc = result.documents[0];
    if (!doc) return null;
    const markdownFileId = typeof doc.markdown_file_id === "string" ? doc.markdown_file_id.trim() : "";
    if (!markdownFileId) return null;
    const bucketId = typeof doc.bucket_id === "string" && doc.bucket_id.trim()
      ? doc.bucket_id.trim()
      : params.defaultBucketId;
    const markdownBuffer = await storage.getFileDownload(bucketId, markdownFileId);
    const markdown = Buffer.from(markdownBuffer).toString("utf-8").trim();
    if (!markdown) return null;
    const pdfFileId = typeof doc.pdf_file_id === "string" && doc.pdf_file_id.trim()
      ? doc.pdf_file_id.trim()
      : null;
    return {
      cacheId: String(doc.$id),
      markdown,
      pdfFileId,
    };
  } catch (error) {
    console.warn("[ai/generate-pdf] Cache lookup unavailable, continuing with fresh generation.", { error });
    return null;
  }
}

async function upsertCacheEntry(params: {
  contentHash: string;
  cacheType: CacheType;
  bucketId: string;
  markdown: string;
  pdfFileId: string;
}): Promise<void> {
  const db = adminDatabases();
  const storage = adminStorage();
  try {
    const hashPrefixLength = Math.min(CACHE_HASH_PREFIX_LENGTH, params.contentHash.length || CACHE_HASH_PREFIX_LENGTH);
    const markdownInput = InputFile.fromBuffer(
      Buffer.from(params.markdown, "utf-8"),
      `${params.cacheType}-${params.contentHash.slice(0, hashPrefixLength)}.md`,
    );
    const markdownUpload = await storage.createFile(params.bucketId, ID.unique(), markdownInput);
    const markdownFileId = String(markdownUpload.$id);
    const existing = await db.listDocuments(DATABASE_ID, COLLECTION.ai_cache_index, [
      Query.equal("content_hash", params.contentHash),
      Query.equal("cache_type", params.cacheType),
      Query.orderDesc("$createdAt"),
      Query.limit(1),
    ]);
    const existingId = typeof existing.documents[0]?.$id === "string" ? existing.documents[0].$id : "";
    const payload = {
      content_hash: params.contentHash,
      cache_type: params.cacheType,
      status: "completed",
      bucket_id: params.bucketId,
      markdown_file_id: markdownFileId,
      pdf_file_id: params.pdfFileId,
      created_at: new Date().toISOString(),
    };
    if (existingId) {
      await db.updateDocument(DATABASE_ID, COLLECTION.ai_cache_index, existingId, payload);
    } else {
      const docId = ID.unique();
      await db.createDocument(DATABASE_ID, COLLECTION.ai_cache_index, docId, payload);
    }
  } catch (error) {
    console.warn("[ai/generate-pdf] Failed to persist ai_cache_index entry.", { error });
  }
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

function isTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const errObj = error as {
    status?: unknown;
    code?: unknown;
    message?: unknown;
    cause?: unknown;
  };
  const status = errObj.status;
  const code = errObj.code;
  const message = String(errObj.message ?? "");
  if (code === UNDICI_CONNECT_TIMEOUT_CODE) return true;
  if (status === 408 || status === 504) return true;
  if (status === 503 && /timeout/i.test(message)) return true;
  if (/aborted due to timeout|timed out|timeout/i.test(message)) return true;
  const cause = errObj.cause as { message?: unknown } | undefined;
  const causeMessage = typeof cause?.message === "string" ? cause.message : "";
  return /timeout/i.test(causeMessage);
}

function getModelFallback(primaryModel: string): string | null {
  if (primaryModel === DEFAULT_AI_MODEL) return GEMMA_UNLIMITED_TPM_MODEL;
  if (primaryModel === GEMMA_UNLIMITED_TPM_MODEL) return DEFAULT_AI_MODEL;
  return null;
}

function getExponentialBackoffMs(attempt: number): number {
  const exponent = Math.min(Math.max(0, attempt - 1), 4);
  return RETRY_BASE_DELAY_MS * (2 ** exponent);
}

type GeminiCooldownState = { lastCallStartedAt: number };

async function runGeminiWithCooldown(
  args: Parameters<typeof runGeminiCompletion>[0],
  cooldownState: GeminiCooldownState,
  signal?: AbortSignal,
): Promise<Awaited<ReturnType<typeof runGeminiCompletion>>> {
  throwIfAborted(signal);
  if (cooldownState.lastCallStartedAt > 0) {
    const elapsed = Date.now() - cooldownState.lastCallStartedAt;
    const waitMs = Math.max(0, GEMINI_CALL_COOLDOWN_MS - elapsed);
    if (waitMs > 0) {
      await sleepWithAbort(waitMs, signal);
    }
  }

  throwIfAborted(signal);
  cooldownState.lastCallStartedAt = Date.now();
  return runGeminiCompletion({ ...args, signal });
}

function buildGeminiErrorContext(error: unknown): Record<string, unknown> {
  if (error instanceof GeminiServiceError) {
    const details: Record<string, unknown> = {
      status: error.status,
      message: error.message,
    };
    if ((error.status === 429 || error.status === 503) && typeof error.responseBody === "string") {
      details.responseBody = error.responseBody;
    }
    return details;
  }
  if (error instanceof Error) {
    return {
      message: error.message,
      cause: (error as { cause?: unknown }).cause,
    };
  }
  return { error };
}

async function withGlobalJobTimeout<T>(
  label: string,
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let settled = false;
  const timeoutMessage = `[ai/generate-pdf] ${label} exceeded timeout after ${BACKGROUND_JOB_TIMEOUT_MS}ms.`;
  const abortController = new AbortController();
  try {
    const jobPromise = fn(abortController.signal).finally(() => {
      settled = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
    });
    return await Promise.race([
      jobPromise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          if (settled) return;
          abortController.abort(new Error(timeoutMessage));
          reject(new Error(timeoutMessage));
        }, BACKGROUND_JOB_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
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

type UsageCounter = "notes_generated_today" | "papers_solved_today";

async function reserveGenerationResources(params: {
  admin: boolean;
  userId: string;
  counter: UsageCounter;
  quotaLogContext: string;
}): Promise<NextResponse | null> {
  if (params.admin) return null;

  try {
    await reserveElectronCost(params.userId, GENERATION_COST_ELECTRONS);
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_ELECTRONS") {
      return NextResponse.json(
        { error: `Not enough electrons. Each generation costs ${GENERATION_COST_ELECTRONS}e.` },
        { status: 403 },
      );
    }
    return NextResponse.json({ error: "Unable to reserve electrons. Please try again." }, { status: 503 });
  }

  try {
    await reserveQuotaForAcceptedRequest(params.userId, params.counter);
  } catch (error) {
    console.error(params.quotaLogContext, {
      userId: params.userId,
      counter: params.counter,
      error,
    });
    await rollbackElectronCost(params.userId, GENERATION_COST_ELECTRONS);
    return NextResponse.json(
      { error: QUOTA_RESERVATION_FAILED_MESSAGE, code: QUOTA_RESERVATION_FAILED_CODE },
      { status: 503 },
    );
  }

  return null;
}

async function rollbackReservedGenerationResources(params: {
  admin: boolean;
  userId: string;
  counter: UsageCounter;
}): Promise<void> {
  if (params.admin) return;
  await rollbackQuotaReservation(params.userId, params.counter);
  await rollbackElectronCost(params.userId, GENERATION_COST_ELECTRONS);
}

async function enqueueAndDispatchPdfJob(params: {
  userId: string;
  paperCode: string;
  unitNumber: number;
  payload: Record<string, unknown>;
  title: string;
}): Promise<{ jobId: string }> {
  const nowIso = new Date().toISOString();
  const db = adminDatabases();
  const functions = adminFunctions();
  const functionId = resolvePdfGeneratorFunctionId();
  const idempotencyKey = buildContentHash([
    params.userId,
    params.paperCode,
    params.unitNumber,
    params.title,
    JSON.stringify(params.payload),
  ]);

  const job = await db.createDocument(DATABASE_ID, COLLECTION.ai_generation_jobs, ID.unique(), {
    user_id: params.userId,
    paper_code: params.paperCode,
    unit_number: params.unitNumber,
    status: "queued",
    progress_percent: 0,
    input_payload_json: JSON.stringify(params.payload),
    idempotency_key: idempotencyKey,
    created_at: nowIso,
  });

  const jobId = String(job.$id);
  try {
    await functions.createExecution(
      functionId,
      JSON.stringify({
        jobId,
        payload: params.payload,
      }),
      true,
    );
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message.slice(0, 1000) : "Function dispatch failed.";
    await db.updateDocument(DATABASE_ID, COLLECTION.ai_generation_jobs, jobId, {
      status: "failed",
      error_message: safeMessage,
      completed_at: new Date().toISOString(),
    }).catch((updateError) => {
      console.error("[ai/generate-pdf] Failed to mark job as failed after dispatch error.", {
        jobId,
        updateError,
      });
    });
    throw error;
  }

  return { jobId };
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

function formatFailureDiagnostics(error: unknown): string {
  if (!error) return "No additional diagnostics available.";
  if (!(error instanceof Error)) return String(error);

  const lines: string[] = [];
  const visited = new Set<unknown>();
  let current: unknown = error;
  let depth = 0;

  while (current && depth < 3 && !visited.has(current)) {
    visited.add(current);
    if (!(current instanceof Error)) break;
    const prefix = depth === 0 ? "error" : `cause_${depth}`;
    lines.push(`${prefix}.name=${current.name || "Error"}`);
    if (current.message?.trim()) lines.push(`${prefix}.message=${current.message.trim()}`);
    const status = (current as { status?: unknown }).status;
    if (typeof status !== "undefined") lines.push(`${prefix}.status=${String(status)}`);
    const code = (current as { code?: unknown }).code;
    if (typeof code !== "undefined") lines.push(`${prefix}.code=${String(code)}`);
    if (current.stack?.trim()) {
      lines.push(`${prefix}.stack=`);
      lines.push(...current.stack.trim().split("\n").slice(0, 30));
    }
    current = (current as { cause?: unknown }).cause;
    depth += 1;
  }

  const text = lines.join("\n").trim();
  return text || "No additional diagnostics available.";
}

type EnvCheckResult = {
  name: string;
  ok: boolean;
  detail: string;
};

function collectGeneratePdfEnvChecks(): {
  ok: boolean;
  errors: string[];
  warnings: string[];
  checks: EnvCheckResult[];
} {
  const checks: EnvCheckResult[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const geminiApiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
  const gotenbergUrlRaw = resolveGotenbergUrl();
  const gotenbergAuthToken = (process.env.GOTENBERG_AUTH_TOKEN || "").trim();

  checks.push({
    name: "GEMINI_API_KEY|GOOGLE_API_KEY",
    ok: !!geminiApiKey,
    detail: geminiApiKey ? "configured" : "missing",
  });
  if (!geminiApiKey) {
    errors.push("Missing GEMINI_API_KEY (or GOOGLE_API_KEY fallback).");
  }

  let gotenbergUrlValid = false;
  let gotenbergUrlDetail = "missing";
  if (gotenbergUrlRaw) {
    try {
      const parsed = new URL(gotenbergUrlRaw);
      const usesHttps = parsed.protocol === "https:";
      const isTrustedHost = parsed.hostname.toLowerCase().endsWith(TRUSTED_GOTENBERG_HOST_SUFFIX);
      gotenbergUrlValid = usesHttps && isTrustedHost;
      if (!usesHttps) {
        gotenbergUrlDetail = "must use HTTPS";
      } else if (!isTrustedHost) {
        gotenbergUrlDetail = `must be a trusted ${TRUSTED_GOTENBERG_HOST_SUFFIX} host`;
      } else {
        gotenbergUrlDetail = "configured";
      }
    } catch {
      gotenbergUrlValid = false;
      gotenbergUrlDetail = "invalid URL format";
    }
  }
  checks.push({
    name: "GOTENBERG_URL",
    ok: gotenbergUrlValid,
    detail: gotenbergUrlDetail,
  });
  if (!gotenbergUrlRaw) {
    errors.push("Missing GOTENBERG_URL.");
  } else if (!gotenbergUrlValid) {
    errors.push(`GOTENBERG_URL must be an HTTPS ${TRUSTED_GOTENBERG_HOST_SUFFIX} URL.`);
  }

  checks.push({
    name: "GOTENBERG_AUTH_TOKEN",
    ok: !!gotenbergAuthToken,
    detail: gotenbergAuthToken ? "configured" : "missing",
  });
  if (!gotenbergAuthToken) {
    errors.push("Missing GOTENBERG_AUTH_TOKEN for private Hugging Face Space.");
  }

  const pdfGeneratorFunctionId = resolvePdfGeneratorFunctionId();
  checks.push({
    name: "APPWRITE_PDF_GENERATOR_FUNCTION_ID",
    ok: !!pdfGeneratorFunctionId,
    detail: pdfGeneratorFunctionId || "missing",
  });
  if (!pdfGeneratorFunctionId) {
    errors.push("Missing APPWRITE_PDF_GENERATOR_FUNCTION_ID.");
  }

  const numericChecks = [
    "GEMINI_REQUEST_TIMEOUT_MS",
    "GOTENBERG_REQUEST_TIMEOUT_MS",
    "GOTENBERG_MAX_ATTEMPTS",
    "GOTENBERG_RETRY_DELAY_MS",
  ] as const;
  for (const envName of numericChecks) {
    const raw = process.env[envName];
    if (!raw || !raw.trim()) {
      checks.push({ name: envName, ok: true, detail: "not set (default in use)" });
      continue;
    }
    const parsed = Number(raw);
    const isValid = Number.isInteger(parsed) && parsed >= 1;
    checks.push({
      name: envName,
      ok: isValid,
      detail: isValid ? `configured (${raw.trim()})` : `invalid numeric value (${raw.trim()})`,
    });
    if (!isValid) {
      warnings.push(`${envName} has invalid value "${raw.trim()}"; default runtime value will be used.`);
    }
  }
  checks.push({
    name: "DISPATCHER_MODE",
    ok: true,
    detail: `enabled (legacy-inline-handlers=${LEGACY_INLINE_BACKGROUND_HANDLERS.length})`,
  });

  return { ok: errors.length === 0, errors, warnings, checks };
}

async function notifyGenerationFailure(email: string, title: string, error: unknown): Promise<void> {
  await sendGenerationFailureEmail({
    email,
    title,
    reason: formatFailureReason(error),
    diagnostics: formatFailureDiagnostics(error),
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
  semester: number | null;
  model: string;
  signal?: AbortSignal;
}): Promise<void> {
  const {
    userEmail, university, course, stream, type,
    paperCode, unitNumber, semester, model, signal,
  } = params;

  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const gotenbergUrl = resolveGotenbergUrl();
  const gotenbergAuthToken = (process.env.GOTENBERG_AUTH_TOKEN || "").trim();

  if (!geminiApiKey) throw new Error("Google Gemini is not configured.");
  if (!gotenbergUrl) throw new Error("Server misconfiguration: missing GOTENBERG_URL.");
  if (!gotenbergAuthToken) throw new Error("Server misconfiguration: missing GOTENBERG_AUTH_TOKEN.");
  logGotenbergAuthDebug();

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

  const notesContentHash = buildContentHash([
    "notes",
    university,
    course,
    stream,
    type,
    paperCode,
    `unit-${unitNumber}`,
    `semester-${semester ?? "all"}`,
  ]);
  const notesCacheBucketId = CACHED_UNIT_NOTES_BUCKET_ID;
  const cachedNotes = await readCachedMarkdown({
    contentHash: notesContentHash,
    cacheType: "notes",
    defaultBucketId: notesCacheBucketId,
  });
  if (cachedNotes) {
    const cachedPdfFileId = cachedNotes.pdfFileId ?? "";
    const cachedPdfAvailable = cachedPdfFileId ? await hasCachedPdf(cachedPdfFileId) : false;
    const cachedRender = cachedPdfAvailable
      ? { fileId: cachedPdfFileId, fileUrl: getAppwriteFileDownloadUrl(cachedPdfFileId) }
      : await renderMarkdownPdfToAppwrite({
        markdown: cachedNotes.markdown,
        fileBaseName: `${paperCode}_unit_${unitNumber}_cache_${Date.now()}`,
        fileName: `${paperCode}_Unit_${unitNumber}_Notes.pdf`,
        gotenbergUrl,
        gotenbergAuthToken,
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
      await sendGenerationPdfEmail({
        email: userEmail,
        downloadUrl: cachedRender.fileUrl,
        title: `Unit Notes (${paperCode} - Unit ${unitNumber})`,
      });
    }
    if (!cachedPdfAvailable) {
      await upsertCacheEntry({
        contentHash: notesContentHash,
        cacheType: "notes",
        bucketId: notesCacheBucketId,
        markdown: cachedNotes.markdown,
        pdfFileId: cachedRender.fileId,
      });
    }
    return;
  }

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
  const fallbackModel = getModelFallback(model);
  const logicalChunks = splitIntoLogicalChunks(subTopics, LOGICAL_CHUNK_COUNT);
  const cooldownState: GeminiCooldownState = { lastCallStartedAt: 0 };
  const generatedChunks: string[] = [];
  for (const [index, topicsChunk] of logicalChunks.entries()) {
    throwIfAborted(signal);
    const promptBody = `University: ${university}
Course: ${course}
Stream: ${stream}
Type: ${type}
Paper Code: ${paperCode}
Unit Number: ${unitNumber}
Unit Tags: ${syllabusTags.length > 0 ? syllabusTags.join(", ") : "N/A"}
Sub-Topic Chunk: ${index + 1}/${logicalChunks.length}
Sub-Topics in this chunk:
${topicsChunk.map((topic, topicIndex) => `${topicIndex + 1}. ${topic}`).join("\n")}

All Questions for this Unit:
${formattedQuestions || "No related questions found."}

CRITICAL FORMAT CONSTRAINTS:
1. Do NOT write the unit number in heading text or repeat the paper code as heading text.
2. Do NOT use numeric prefixes for main headings (e.g. avoid "1. Heading").
3. Start directly with a ## or ### heading for this sub-topic.
4. Generate detailed markdown notes that cover all listed sub-topics in this chunk.`;

    let aiResponseText = "";
    let lastChunkError: unknown = null;
    for (let attempt = 1; attempt <= CHUNK_MAX_ATTEMPTS; attempt += 1) {
      try {
        const result = await runGeminiWithCooldown({
          apiKey: String(geminiApiKey),
          prompt: `${systemPrompt}\n\n${promptBody}`,
          maxTokens: 4000,
          temperature: 0.4,
          model,
        }, cooldownState, signal);
        const candidate = String(result.content ?? "").trim();
        if (candidate.length > MIN_TOPIC_RESPONSE_CHARS) {
          aiResponseText = candidate;
          break;
        }
      } catch (error) {
        throwIfAborted(signal);
        lastChunkError = error;
        console.warn("[ai/generate-pdf] Notes chunk failed; retrying.", {
          chunkIndex: index + 1,
          attempt,
          maxAttempts: CHUNK_MAX_ATTEMPTS,
          model,
          error: buildGeminiErrorContext(error),
        });
        if (attempt < CHUNK_MAX_ATTEMPTS) {
          await sleepWithAbort(getExponentialBackoffMs(attempt), signal);
        }
      }
    }

    if (
      !aiResponseText
      && fallbackModel
      && lastChunkError
      && (isTimeoutError(lastChunkError) || isRateLimitError(lastChunkError))
    ) {
      try {
        console.warn("[ai/generate-pdf] Retrying chunk on fallback model.", {
          chunkIndex: index + 1,
          fromModel: model,
          toModel: fallbackModel,
        });
        const fallbackResult = await runGeminiWithCooldown({
          apiKey: String(geminiApiKey),
          prompt: `${systemPrompt}\n\n${promptBody}`,
          maxTokens: TOPIC_FALLBACK_MAX_TOKENS,
          temperature: 0.4,
          model: fallbackModel,
        }, cooldownState, signal);
        const fallbackCandidate = String(fallbackResult.content ?? "").trim();
        if (fallbackCandidate.length > MIN_TOPIC_RESPONSE_CHARS) {
          aiResponseText = fallbackCandidate;
        }
      } catch (fallbackError) {
        console.warn("[ai/generate-pdf] Chunk fallback model retry failed.", {
          chunkIndex: index + 1,
          model: fallbackModel,
          error: buildGeminiErrorContext(fallbackError),
        });
      }
    }

    if (!aiResponseText) {
      throw new Error(`Failed to generate chunk ${index + 1} after retries.`, {
        cause: lastChunkError instanceof Error ? lastChunkError : undefined,
      });
    }

    generatedChunks.push(aiResponseText);
  }

  const masterMarkdown = generatedChunks.join("\n\n---\n\n");

  const dynamicPdfName = `${paperCode}_Unit_${unitNumber}_Notes.pdf`;
  const fileToken = ID.unique();
  const rendered = await renderMarkdownPdfToAppwrite({
    markdown: masterMarkdown,
    fileBaseName: `${paperCode}_unit_${unitNumber}_${fileToken}_${Date.now()}`,
    fileName: dynamicPdfName,
    gotenbergUrl,
    gotenbergAuthToken,
    modelName: model,
    generatedAtIso: new Date().toISOString(),
    paperCode,
    paperName,
    unitNumber,
    unitName,
    syllabusContent,
    userEmail: userEmail || undefined,
  });
  await upsertCacheEntry({
    contentHash: notesContentHash,
    cacheType: "notes",
    bucketId: notesCacheBucketId,
    markdown: masterMarkdown,
    pdfFileId: rendered.fileId,
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
  semester: number | null;
  signal?: AbortSignal;
}): Promise<void> {
  const {
    userEmail, university, course, stream, type,
    paperCode, year, model, semester, signal,
  } = params;

  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const gotenbergUrl = resolveGotenbergUrl();
  const gotenbergAuthToken = (process.env.GOTENBERG_AUTH_TOKEN || "").trim();

  if (!geminiApiKey) throw new Error("Google Gemini is not configured.");
  if (!gotenbergUrl) throw new Error("Server misconfiguration: missing GOTENBERG_URL.");
  if (!gotenbergAuthToken) throw new Error("Server misconfiguration: missing GOTENBERG_AUTH_TOKEN.");
  logGotenbergAuthDebug();

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

  const solvedContentHash = buildContentHash([
    "solved-paper",
    university,
    course,
    stream,
    type,
    paperCode,
    `year-${year}`,
    `semester-${semester ?? "all"}`,
  ]);
  const solvedCacheBucketId = CACHED_SOLVED_PAPERS_BUCKET_ID;
  const cachedSolved = await readCachedMarkdown({
    contentHash: solvedContentHash,
    cacheType: "solved-paper",
    defaultBucketId: solvedCacheBucketId,
  });
  if (cachedSolved) {
    const cachedPdfFileId = cachedSolved.pdfFileId ?? "";
    const cachedPdfAvailable = cachedPdfFileId ? await hasCachedPdf(cachedPdfFileId) : false;
    const cachedRender = cachedPdfAvailable
      ? { fileId: cachedPdfFileId, fileUrl: getAppwriteFileDownloadUrl(cachedPdfFileId) }
      : await renderMarkdownPdfToAppwrite({
        markdown: cachedSolved.markdown.trim(),
        fileBaseName: `${paperCode}_${year}_solved_cache_${Date.now()}`,
        fileName: `${paperCode}_${year}_solved_paper.pdf`,
        gotenbergUrl,
        gotenbergAuthToken,
        paperCode,
        year,
      });
    if (userEmail) {
      await sendGenerationPdfEmail({
        email: userEmail,
        downloadUrl: cachedRender.fileUrl,
        title: `Solved Paper (${paperCode} ${year})`,
      });
    }
    if (!cachedPdfAvailable) {
      await upsertCacheEntry({
        contentHash: solvedContentHash,
        cacheType: "solved-paper",
        bucketId: solvedCacheBucketId,
        markdown: cachedSolved.markdown,
        pdfFileId: cachedRender.fileId,
      });
    }
    return;
  }

  const systemPrompt = readDynamicSystemPrompt({ promptType: "solved_paper" });
  const paperWebContext = allQuestions.length > 0
    ? await fetchTavilyContext(`${university} ${course} ${paperCode} ${year} solved paper key points`)
    : "";
  const questionChunks = splitIntoLogicalChunks(allQuestions, LOGICAL_CHUNK_COUNT);
  const cooldownState: GeminiCooldownState = { lastCallStartedAt: 0 };
  const solvedChunks: string[] = [];
  for (const [index, questionsChunk] of questionChunks.entries()) {
    throwIfAborted(signal);
    const questionText = `University: ${university}
Course: ${course}
Stream: ${stream}
Type: ${type}
Paper Code: ${paperCode}
Year: ${year}
Chunk: ${index + 1}/${questionChunks.length}
Questions in this chunk:
${questionsChunk.map((questionDoc, questionIndex) => {
  const qNo = String(questionDoc.question_no ?? questionIndex + 1).trim();
  const qSub = typeof questionDoc.question_subpart === "string" ? questionDoc.question_subpart.trim() : "";
  const questionContent = String(questionDoc.question_content ?? "").trim();
  const parsedMarks = typeof questionDoc.marks === "string" ? Number(questionDoc.marks) : NaN;
  const marks = typeof questionDoc.marks === "number"
    ? questionDoc.marks
    : (Number.isFinite(parsedMarks) ? parsedMarks : "N/A");
  return `Q${qNo}${qSub ? `(${qSub})` : ""} [${marks} marks]\n${questionContent}`;
}).join("\n\n")}

Paper-level Web Context:
${paperWebContext || "No external web context available."}

CRITICAL FORMAT CONSTRAINTS:
1. Do NOT write a document title.
2. Return answers for every question in this chunk.
3. Keep each answer grouped under a clear heading for its question.
4. Do NOT use numeric prefixes in major headings.
`;

    let aiResponseText = "";
    let lastChunkError: unknown = null;
    for (let attempt = 1; attempt <= CHUNK_MAX_ATTEMPTS; attempt += 1) {
      try {
        const result = await runGeminiWithCooldown({
          apiKey: String(geminiApiKey),
          prompt: `${systemPrompt}\n\n${questionText}`,
          maxTokens: 4000,
          temperature: 0.4,
          model,
        }, cooldownState, signal);
        const candidate = String(result.content ?? "").trim();
        if (candidate.length > MIN_SOLUTION_RESPONSE_CHARS) {
          aiResponseText = candidate;
          break;
        }
      } catch (error) {
        throwIfAborted(signal);
        lastChunkError = error;
        console.warn("[ai/generate-pdf] Solved-paper chunk failed; retrying.", {
          chunkIndex: index + 1,
          attempt,
          maxAttempts: CHUNK_MAX_ATTEMPTS,
          model,
          error: buildGeminiErrorContext(error),
        });
        if (attempt < CHUNK_MAX_ATTEMPTS) {
          await sleepWithAbort(getExponentialBackoffMs(attempt), signal);
        }
      }
    }

    if (!aiResponseText) {
      throw new Error(`Failed to generate solved-paper chunk ${index + 1} after retries.`, {
        cause: lastChunkError instanceof Error ? lastChunkError : undefined,
      });
    }
    solvedChunks.push(aiResponseText);
  }
  const masterMarkdown = solvedChunks.join("\n\n---\n\n");

  const fileToken = ID.unique();
  const rendered = await renderMarkdownPdfToAppwrite({
    markdown: masterMarkdown.trim(),
    fileBaseName: `${paperCode}_${year}_solved_${fileToken}_${Date.now()}`,
    fileName: `${paperCode}_${year}_solved_paper.pdf`,
    gotenbergUrl,
    gotenbergAuthToken,
    paperCode,
    year,
  });
  await upsertCacheEntry({
    contentHash: solvedContentHash,
    cacheType: "solved-paper",
    bucketId: solvedCacheBucketId,
    markdown: masterMarkdown,
    pdfFileId: rendered.fileId,
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

const LEGACY_INLINE_BACKGROUND_HANDLERS = [
  withGlobalJobTimeout,
  runNotesBackground,
  runSolvedPaperBackground,
] as const;

export async function GET() {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }
  if (!isAdminPlus(user.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const envChecks = collectGeneratePdfEnvChecks();
  return NextResponse.json({
    ok: envChecks.ok,
    errors: envChecks.errors,
    warnings: envChecks.warnings,
    checks: envChecks.checks,
  });
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
  const parsedSemester = normalizeSemester(body.semester ?? null);
  if (typeof body.semester !== "undefined" && body.semester !== null && parsedSemester === null) {
    return NextResponse.json(
      { error: "Invalid selection: semester must be between 1 and 8 when provided." },
      { status: 400 },
    );
  }
  const userEmail = typeof user.email === "string" ? user.email.trim() : "";

  if (!course) return NextResponse.json({ error: "Invalid selection: course is required." }, { status: 400 });
  if (!stream) return NextResponse.json({ error: "Invalid selection: stream is required." }, { status: 400 });
  if (!type) return NextResponse.json({ error: "Invalid selection: type is required." }, { status: 400 });
  if (!paperCode) return NextResponse.json({ error: "Invalid selection: paper code is required." }, { status: 400 });
  if (!isSupportedAiModel(selectedModel)) {
    return NextResponse.json(
      {
        error: `Unsupported model. Allowed values: ${SUPPORTED_AI_MODELS.join(", ")}.`,
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

  const envChecks = collectGeneratePdfEnvChecks();
  if (!envChecks.ok) {
    console.error("[ai/generate-pdf] Environment check failed.", {
      errors: envChecks.errors,
      warnings: envChecks.warnings,
      checks: envChecks.checks,
    });
    return NextResponse.json(
      {
        error: "Server misconfiguration for AI PDF generation.",
        code: "SERVER_MISCONFIGURATION",
        checks: envChecks.checks,
        errors: envChecks.errors,
      },
      { status: 503 },
    );
  }
  if (envChecks.warnings.length > 0) {
    console.warn("[ai/generate-pdf] Environment check warnings.", {
      warnings: envChecks.warnings,
      checks: envChecks.checks,
    });
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
    const notesReservationError = await reserveGenerationResources({
      admin,
      userId: user.id,
      counter: "notes_generated_today",
      quotaLogContext: "[ai/generate-pdf] Failed to reserve notes quota for accepted request.",
    });
    if (notesReservationError) return notesReservationError;
    const startEmailSent = await ensureGenerationStartedEmail(
      userEmail,
      `Unit Notes (${paperCode} - Unit ${unitNumber})`,
    );
    if (!startEmailSent) {
      await rollbackReservedGenerationResources({
        admin,
        userId: user.id,
        counter: "notes_generated_today",
      });
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
    let notesJobId = "";
    try {
      const dispatched = await enqueueAndDispatchPdfJob({
        userId: user.id,
        paperCode,
        unitNumber,
        title: `Unit Notes (${paperCode} - Unit ${unitNumber})`,
        payload: {
          jobType: "notes",
          userId: user.id,
          userEmail,
          university,
          course,
          stream,
          type,
          paperCode,
          unitNumber,
          semester: parsedSemester,
          model: selectedModel,
        },
      });
      notesJobId = dispatched.jobId;
    } catch (error) {
      console.error("[ai/generate-pdf] Failed to dispatch notes job.", {
        userId: user.id,
        paperCode,
        unitNumber,
        error,
      });
      await rollbackReservedGenerationResources({
        admin,
        userId: user.id,
        counter: "notes_generated_today",
      });
      await notifyGenerationFailure(userEmail, `Unit Notes (${paperCode} - Unit ${unitNumber})`, error);
      return NextResponse.json(
        {
          error: "Unable to start background generation right now. Please try again.",
          code: "JOB_DISPATCH_FAILED",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      ok: true,
      jobId: notesJobId,
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
  const solvedReservationError = await reserveGenerationResources({
    admin,
    userId: user.id,
    counter: "papers_solved_today",
    quotaLogContext: "[ai/generate-pdf] Failed to reserve solved-paper quota for accepted request.",
  });
  if (solvedReservationError) return solvedReservationError;
  const startEmailSent = await ensureGenerationStartedEmail(userEmail, `Solved Paper (${paperCode} ${year})`);
  if (!startEmailSent) {
    await rollbackReservedGenerationResources({
      admin,
      userId: user.id,
      counter: "papers_solved_today",
    });
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
  let solvedJobId = "";
  try {
    const dispatched = await enqueueAndDispatchPdfJob({
      userId: user.id,
      paperCode,
      unitNumber: 0,
      title: `Solved Paper (${paperCode} ${year})`,
      payload: {
        jobType: "solved-paper",
        userId: user.id,
        userEmail,
        university,
        course,
        stream,
        type,
        paperCode,
        year,
        semester: parsedSemester,
        model: selectedModel,
      },
    });
    solvedJobId = dispatched.jobId;
  } catch (error) {
    console.error("[ai/generate-pdf] Failed to dispatch solved-paper job.", {
      userId: user.id,
      paperCode,
      year,
      error,
    });
    await rollbackReservedGenerationResources({
      admin,
      userId: user.id,
      counter: "papers_solved_today",
    });
    await notifyGenerationFailure(userEmail, `Solved Paper (${paperCode} ${year})`, error);
    return NextResponse.json(
      {
        error: "Unable to start background generation right now. Please try again.",
        code: "JOB_DISPATCH_FAILED",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    jobId: solvedJobId,
    message: userEmail
      ? `Your solved paper is being generated. We'll email the PDF to ${userEmail} when ready. You can safely close this tab.`
      : "Your solved paper is being generated. The PDF will be ready shortly.",
  });
}
