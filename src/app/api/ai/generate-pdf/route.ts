import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { getServerUser } from "@/lib/auth";
import { getDailyLimit } from "@/lib/ai-limits";
import { checkAndResetQuotas, incrementQuotaCounter, rollbackQuotaCounter } from "@/lib/user-quotas";
import { NOTES_DAILY_LIMIT } from "@/lib/quota-config";
import {
  adminDatabases,
  adminFunctions,
  adminStorage,
  CACHED_UNIT_NOTES_BUCKET_ID,
  CACHED_SOLVED_PAPERS_BUCKET_ID,
  COLLECTION,
  DATABASE_ID,
  ID,
  Query,
} from "@/lib/appwrite";
import {
  sendGenerationFailureEmail,
  sendGenerationPdfEmail,
  sendGenerationStartedEmail,
} from "@/lib/generation-notifications";
import { buildSignedPdfDownloadPath } from "@/lib/pdf-download-link";
import {
  GENERATION_COST_ELECTRONS,
  SUPPORTED_AI_MODELS,
  isSupportedAiModel,
} from "@/lib/economy";
import { withElectronBalanceLock } from "@/lib/electron-lock";

// Keep route timeout explicit for current deployment while allowing complex note generation.
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const DEFAULT_AI_MODEL = "gemini-3.1-flash-lite-preview";
const CACHE_LOOKUP_DEFAULT_MODEL =
  String(process.env.GEMINI_MODEL_ID || "").trim() || DEFAULT_AI_MODEL;
const GEMMA_UNLIMITED_TPM_MODEL = "gemma-4-31b-it";
const MIN_SEMESTER = 1;
const MAX_SEMESTER = 8;
const UNDICI_CONNECT_TIMEOUT_CODE = "UND_ERR_CONNECT_TIMEOUT";
const QUOTA_RESERVATION_FAILED_CODE = "QUOTA_RESERVATION_FAILED";
const QUOTA_RESERVATION_FAILED_MESSAGE = "Failed to reserve generation quota. Please try again later.";
const QUOTA_CHECK_FAILED_CODE = "QUOTA_CHECK_FAILED";
const APPWRITE_DOC_ID_HASH_LENGTH = 31;
const JOB_STATUS_QUEUED = "queued";
const JOB_STATUS_RUNNING = "running";
const JOB_STATUS_PROCESSING = "processing";
const JOB_STATUS_COMPLETED = "completed";
const ACCEPTED_EXECUTION_STATUSES = new Set(["queued", "waiting", "processing"]);
const LOCALHOST_HOSTS = ["localhost", "127.0.0.1", "::1"];

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

function resolvePdfGeneratorFunctionId(): string {
  const functionId = process.env.APPWRITE_PDF_GENERATOR_FUNCTION_ID?.trim() || "";
  if (!functionId) {
    throw new Error("Missing APPWRITE_PDF_GENERATOR_FUNCTION_ID for Appwrite function dispatch.");
  }
  return functionId;
}

function normalizeSelectedModel(value: string): string {
  if (value === "gemini-3.1-flash-lite") return DEFAULT_AI_MODEL;
  if (value === "gemma-4-31b") return GEMMA_UNLIMITED_TPM_MODEL;
  return value;
}

function buildContentHash(parts: Array<string | number | null | undefined>): string {
  const normalized = parts
    .map((part) => (part === null || typeof part === "undefined" ? "" : String(part).trim().toLowerCase()))
    .join("::");
  return createHash("sha256").update(normalized).digest("hex");
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

async function queueGenerationRecording(
  userId: string,
  counter: "notes_generated_today" | "papers_solved_today",
): Promise<void> {
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
      { status: 500 },
    );
  }

  return null;
}

function getAppwriteErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const err = error as {
    status?: unknown;
    code?: unknown;
    response?: { status?: unknown; code?: unknown };
  };
  const errorStatusCode = Number(err.status ?? err.code ?? err.response?.status ?? err.response?.code ?? NaN);
  if (Number.isInteger(errorStatusCode) && errorStatusCode >= 100 && errorStatusCode <= 599) {
    return errorStatusCode;
  }
  return null;
}

async function checkQuotasOrError(userId: string): Promise<
  { quota: Awaited<ReturnType<typeof checkAndResetQuotas>>; errorResponse: null } |
  { quota: null; errorResponse: NextResponse }
> {
  try {
    const quota = await checkAndResetQuotas(userId);
    return { quota, errorResponse: null };
  } catch (error) {
    const status = getAppwriteErrorStatus(error);
    console.error("[ai/generate-pdf] Quota check failed.", {
      userId,
      status,
      error,
    });
    return {
      quota: null,
      errorResponse: NextResponse.json(
        {
          error: "Unable to verify generation quota right now. Please try again.",
          code: QUOTA_CHECK_FAILED_CODE,
        },
        { status: 500 },
      ),
    };
  }
}

function shouldSkipDispatchForExistingJob(status: string): boolean {
  // Only skip dispatch when a job is actively in-flight.
  // Completed and failed jobs are intentionally excluded so that a new request
  // for the same content creates a fresh job with proper email notifications,
  // while the pdf-generator re-uses the cached markdown to avoid LLM credits.
  const normalizedStatus = normalizeJobStatus(status);
  return (
    normalizedStatus === JOB_STATUS_QUEUED ||
    normalizedStatus === JOB_STATUS_RUNNING ||
    normalizedStatus === JOB_STATUS_PROCESSING
  );
}

function normalizeJobStatus(status: string | null | undefined): string {
  return String(status || "").trim().toLowerCase();
}

function hasReadyEmailAlreadyBeenSent(job: Record<string, unknown> | null | undefined): boolean {
  if (!job || typeof job !== "object") return false;
  const emailStatus = String(job.email_status || "").trim().toLowerCase();
  if (emailStatus === "completion_sent" || emailStatus === "sent") return true;
  return String(job.email_sent_at || "").trim().length > 0;
}

function normalizeTrustedSiteUrl(rawUrl: string): string {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    // Allow localhost and 127.0.0.1 for development
    const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1";
    if (parsed.protocol !== "https:" && !isLocalhost) {
      return "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

function buildTrustedSiteUrlFromVercelUrl(rawVercelUrl: string): string {
  const normalizedVercelUrl = String(rawVercelUrl || "").trim().replace(/^https?:\/\//i, "");
  if (!normalizedVercelUrl) return "";
  return normalizeTrustedSiteUrl(`https://${normalizedVercelUrl}`);
}

function shouldUsePreviewWebhookUrl(params: {
  canonicalUrl: string;
  previewUrl: string;
  vercelEnv: string;
}): boolean {
  if (!params.previewUrl) return false;
  if (!params.canonicalUrl) return true;
  if (params.vercelEnv !== "preview") return false;
  try {
    return new URL(params.canonicalUrl).origin !== new URL(params.previewUrl).origin;
  } catch {
    return true;
  }
}

function shouldUseRequestOriginForWebhook(params: {
  requestSiteUrl: string;
  canonicalSiteUrl: string;
  trustedVercelSiteUrl: string;
}): boolean {
  if (!params.requestSiteUrl) return false;
  try {
    const requestOrigin = new URL(params.requestSiteUrl).origin;
    if (params.canonicalSiteUrl && requestOrigin === new URL(params.canonicalSiteUrl).origin) {
      return true;
    }
    if (params.trustedVercelSiteUrl && requestOrigin === new URL(params.trustedVercelSiteUrl).origin) {
      return true;
    }
    const host = new URL(params.requestSiteUrl).hostname.toLowerCase();
    if (LOCALHOST_HOSTS.includes(host)) return true;
    if (host.endsWith(".vercel.app")) return true;
    return false;
  } catch {
    return false;
  }
}

function buildCompletionWebhookUrl(request?: NextRequest): string {
  const siteUrl = normalizeTrustedSiteUrl(String(process.env.SITE_URL || ""));
  const nextPublicSiteUrl = normalizeTrustedSiteUrl(String(process.env.NEXT_PUBLIC_SITE_URL || ""));
  const canonicalSiteUrl = siteUrl || nextPublicSiteUrl;
  const vercelUrl = String(process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL || "").trim();
  const trustedVercelSiteUrl = buildTrustedSiteUrlFromVercelUrl(vercelUrl);
  const trustedRequestSiteUrl = normalizeTrustedSiteUrl(String(request?.nextUrl?.origin || ""));
  if (shouldUseRequestOriginForWebhook({
    requestSiteUrl: trustedRequestSiteUrl,
    canonicalSiteUrl,
    trustedVercelSiteUrl,
  })) {
    try {
      return new URL("/api/ai/notify-completion", trustedRequestSiteUrl).toString();
    } catch {
      // Fall through to environment-derived URL.
    }
  }
  const vercelEnv = String(process.env.VERCEL_ENV || "").trim().toLowerCase();
  const trustedSiteUrl = shouldUsePreviewWebhookUrl({
    canonicalUrl: canonicalSiteUrl,
    previewUrl: trustedVercelSiteUrl,
    vercelEnv,
  })
    ? trustedVercelSiteUrl
    : canonicalSiteUrl || trustedVercelSiteUrl;
  if (!trustedSiteUrl) {
    console.error("[ai/generate-pdf] CRITICAL: Failed to build completion webhook URL because no trusted site URL is configured. Webhook callbacks will be disabled, breaking worker/Appwrite integration contract.", {
      siteUrlConfigured: Boolean(siteUrl),
      nextPublicSiteUrlConfigured: Boolean(nextPublicSiteUrl),
      vercelUrlConfigured: Boolean(vercelUrl),
      vercelUrlUsable: Boolean(trustedVercelSiteUrl),
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
    });
    return "";
  }
  try {
    return new URL("/api/ai/notify-completion", trustedSiteUrl).toString();
  } catch (error) {
    console.error("[ai/generate-pdf] Failed to build completion webhook URL from trusted site URL.", {
      trustedSiteUrl,
      failureType: "invalid_or_unusable_trusted_site_url",
      message: error instanceof Error ? error.message : String(error),
      error,
    });
    return "";
  }
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

function isConflictError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as {
    code?: unknown;
    status?: unknown;
    type?: unknown;
    message?: unknown;
    response?: { code?: unknown; status?: unknown; type?: unknown; message?: unknown };
  };
  const status = Number(err.status ?? err.code ?? err.response?.status ?? err.response?.code ?? 0);
  if (status === 409) return true;
  const type = String(err.type ?? err.response?.type ?? "").toLowerCase();
  if (type.includes("conflict") || type.includes("already_exists") || type.includes("already exists")) return true;
  const message = String(err.message ?? err.response?.message ?? "").toLowerCase();
  return message.includes("conflict") || message.includes("already exists");
}

/**
 * Looks up the globally-cached markdown for a generation job by reading the
 * matching file from the appropriate Appwrite storage bucket.  The cache key
 * replicates the logic used by the pdf-generator Appwrite function so both
 * sides agree on the file name.
 *
 * Returns the markdown string when a cache hit is found, or `null` otherwise.
 * Failures are swallowed so callers can treat a miss as a cache-miss gracefully.
 */
async function lookupMarkdownFileCache(
  payload: Record<string, unknown>,
): Promise<string | null> {
  const normalizedJobType = String(payload.jobType ?? "").trim().toLowerCase();
  if (normalizedJobType !== "notes" && normalizedJobType !== "solved-paper") return null;

  const normalize = (v: unknown): string => String(v ?? "").trim();

  const paperCode = normalize(payload.paperCode);
  const stream = normalize(payload.stream);
  const course = normalize(payload.course);
  const type = normalize(payload.type);
  const university = normalize(payload.university);
  if (!paperCode || !stream || !course || !type || !university) return null;

  const cacheScopeSegment =
    normalizedJobType === "notes"
      ? normalize(payload.unitNumber)
      : normalize(payload.year);
  if (!cacheScopeSegment) return null;

  const semester = normalize(payload.semester) || "na";
  const model = normalize(payload.model) || CACHE_LOOKUP_DEFAULT_MODEL;

  // NOTE: The cache-key construction below mirrors the same logic used by the
  // pdf-generator Appwrite function (processGenerationJob).  If the format
  // ever changes, both places must be updated together.
  const cacheKey = [paperCode, cacheScopeSegment, stream, course, type, university, semester, model]
    .join("_")
    .replace(/[^a-zA-Z0-9_-]/g, "_");
  const legacyCacheKey = [paperCode, cacheScopeSegment, stream, course, type]
    .join("_")
    .replace(/[^a-zA-Z0-9_-]/g, "_");
  const cacheFileName = `${cacheKey}.md`;
  const legacyCacheFileName = `${legacyCacheKey}.md`;

  const cacheBucketId =
    normalizedJobType === "notes" ? CACHED_UNIT_NOTES_BUCKET_ID : CACHED_SOLVED_PAPERS_BUCKET_ID;

  // Limit matches the pdf-generator's own file-listing query so that both sides
  // scan the same candidates and pick the most-recently-created exact match.
  const CACHE_FILE_QUERY_LIMIT = 10;
  try {
    const storage = adminStorage();
    const exactNames = new Set([cacheFileName, legacyCacheFileName]);
    const matchByFileName = (files: Array<{ name?: unknown; $id?: string }>): { name?: unknown; $id?: string } | undefined =>
      files.find((f) => exactNames.has(String(f.name ?? "").trim()));
    const cachedFiles = await storage.listFiles(cacheBucketId, [
      Query.search("name", cacheKey),
      Query.orderDesc("$createdAt"),
      Query.limit(CACHE_FILE_QUERY_LIMIT),
    ]);
    let exactMatch = Array.isArray(cachedFiles.files) ? matchByFileName(cachedFiles.files) : null;
    if (!exactMatch && legacyCacheKey !== cacheKey) {
      const legacyCachedFiles = await storage.listFiles(cacheBucketId, [
        Query.search("name", legacyCacheKey),
        Query.orderDesc("$createdAt"),
        Query.limit(CACHE_FILE_QUERY_LIMIT),
      ]);
      exactMatch = Array.isArray(legacyCachedFiles.files) ? matchByFileName(legacyCachedFiles.files) : null;
    }
    if (!exactMatch?.$id) return null;

    const buffer = await storage.getFileDownload(cacheBucketId, exactMatch.$id);
    const markdown = Buffer.from(buffer).toString("utf-8").trim();
    return markdown || null;
  } catch {
    return null;
  }
}

async function enqueueAndDispatchPdfJob(params: {
  userId: string;
  paperCode: string;
  unitNumber: number;
  payload: Record<string, unknown>;
  title: string;
}): Promise<{ jobId: string; executionTriggered: boolean; existingStatus?: string; resultFileId?: string; readyEmailAlreadySent?: boolean }> {
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
  const deterministicJobId = `j${createHash("sha1").update(idempotencyKey).digest("hex").slice(0, APPWRITE_DOC_ID_HASH_LENGTH)}`;
  const existingBeforeCreate = await db.listDocuments(DATABASE_ID, COLLECTION.ai_generation_jobs, [
    Query.equal("idempotency_key", idempotencyKey),
    Query.equal("user_id", params.userId),
    Query.orderDesc("$createdAt"),
    Query.limit(1),
  ]);
  let jobId = "";
  const priorJob = existingBeforeCreate.documents[0];

  // Return early ONLY for in-flight jobs (queued / running / processing).
  // Completed and failed jobs allow a fresh job to be created so the user
  // receives the normal start-email and completion-email flows.
  if (priorJob && typeof priorJob.$id === "string" && priorJob.$id) {
    const priorStatus = normalizeJobStatus(priorJob.status);
    if (shouldSkipDispatchForExistingJob(priorStatus)) {
      jobId = String(priorJob.$id);
      console.warn("[ai/generate-pdf] Skipping Appwrite dispatch for existing in-flight job.", {
        jobId,
        existingStatus: priorStatus,
        userId: params.userId,
      });
      return {
        jobId,
        executionTriggered: false,
        existingStatus: priorStatus,
        resultFileId: String(priorJob.result_file_id || "").trim(),
        readyEmailAlreadySent: hasReadyEmailAlreadyBeenSent(priorJob as Record<string, unknown>),
      };
    }
  }

  // No in-flight job found (or prior job is completed/failed) → create a new job.
  // When a prior completed/failed job exists the deterministic ID is already taken,
  // so use ID.unique() to avoid a document-ID conflict.
  {
    let job;
    const jobCreatePayload = {
      user_id: params.userId,
      paper_code: params.paperCode,
      unit_number: params.unitNumber,
      status: "queued",
      progress_percent: 0,
      input_payload_json: JSON.stringify(params.payload),
      idempotency_key: idempotencyKey,
      created_at: nowIso,
    };
  // When a prior completed/failed job exists the deterministic ID is already taken,
    // so use ID.unique() to create a brand-new document and avoid a conflict error.
    const newJobDocId = priorJob ? ID.unique() : deterministicJobId;
    try {
      job = await db.createDocument(DATABASE_ID, COLLECTION.ai_generation_jobs, newJobDocId, jobCreatePayload);
    } catch (error) {
      if (!isConflictError(error)) {
        throw error;
      }
      try {
        const conflictJob = await db.getDocument(DATABASE_ID, COLLECTION.ai_generation_jobs, deterministicJobId);
        if (typeof conflictJob?.$id === "string" && conflictJob.$id) {
          const conflictStatus = normalizeJobStatus(conflictJob.status);
          if (shouldSkipDispatchForExistingJob(conflictStatus)) {
            jobId = conflictJob.$id;
            console.warn("[ai/generate-pdf] Skipping Appwrite dispatch for in-flight job found during conflict resolution.", {
              jobId,
              existingStatus: conflictStatus,
              userId: params.userId,
            });
            return {
              jobId,
              executionTriggered: false,
              existingStatus: conflictStatus,
              resultFileId: String(conflictJob.result_file_id || "").trim(),
              readyEmailAlreadySent: hasReadyEmailAlreadyBeenSent(conflictJob as Record<string, unknown>),
            };
          }
          // Conflict job is completed/failed: create a unique fallback below.
        }
      } catch (readConflictError) {
        console.warn("[ai/generate-pdf] Conflict on deterministic job id but could not load existing job; creating unique fallback job id.", {
          deterministicJobId,
          userId: params.userId,
          error: readConflictError,
        });
      }
      if (!jobId) {
        job = await db.createDocument(DATABASE_ID, COLLECTION.ai_generation_jobs, ID.unique(), jobCreatePayload);
      }
    }
    if (!jobId && job?.$id) {
      jobId = String(job.$id);
    }
  }

  if (!jobId) {
    throw new Error("Failed to resolve job ID before Appwrite function dispatch.");
  }

  // Look up the global markdown file-cache so the pdf-generator can skip
  // the LLM step entirely when cached markdown already exists.  The content
  // is passed in the function-execution body (not stored in the DB job
  // document) to avoid the 10 000-char limit on input_payload_json.
  let cachedMarkdown: string | null = null;
  try {
    cachedMarkdown = await lookupMarkdownFileCache(params.payload);
    if (cachedMarkdown) {
      console.info("[ai/generate-pdf] Global markdown cache hit – will bypass LLM in pdf-generator.", {
        jobId,
        jobType: params.payload.jobType,
      });
    }
  } catch (cacheErr) {
    console.warn(
      "[ai/generate-pdf] Global markdown cache lookup failed; pdf-generator will fall back to its own cache/LLM path.",
      { jobId, error: cacheErr },
    );
  }

  const dispatchPayload = cachedMarkdown
    ? { ...params.payload, cachedMarkdown }
    : params.payload;

  console.info("[ai/generate-pdf] Dispatching Appwrite function execution.", {
    FUNCTION_ID: functionId,
    jobId,
    executionMethod: "async",
    cachedMarkdownInjected: !!cachedMarkdown,
  });
  try {
    console.log(`Attempting to trigger Appwrite Function ID: ${functionId}`);
    const execution = await functions.createExecution(
      functionId,
      JSON.stringify({
        jobId,
        payload: dispatchPayload,
      }),
      // `true` requests asynchronous execution in node-appwrite.
      true,
    );
    const executionStatus = String(execution.status || "unknown");
    console.log(`Appwrite Execution Response Status: ${executionStatus}`);
    const triggerAccepted =
      typeof execution.$id === "string" &&
      execution.$id.length > 0 &&
      ACCEPTED_EXECUTION_STATUSES.has(executionStatus.toLowerCase());
    console.info("[ai/generate-pdf] Appwrite function execution trigger response.", {
      triggerAccepted,
      FUNCTION_ID: functionId,
      jobId,
      execution,
    });
    if (!triggerAccepted) {
      throw new Error(
        `Function dispatch did not return an accepted execution payload for FUNCTION_ID=${functionId}`,
      );
    }
  } catch (error) {
    const appwriteError = error as Error & {
      status?: number;
      code?: number | string;
      type?: string;
      response?: string | Record<string, unknown>;
    };
    console.error("[ai/generate-pdf] Appwrite function execution trigger failed.", {
      FUNCTION_ID: functionId,
      jobId,
      message: appwriteError?.message,
      status: appwriteError?.status,
      code: appwriteError?.code,
      type: appwriteError?.type,
      response: appwriteError?.response,
      error,
    });
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

  return { jobId, executionTriggered: true };
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
  const appwriteEndpoint = (process.env.APPWRITE_ENDPOINT || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "").trim();
  const appwriteProjectId = (process.env.APPWRITE_PROJECT_ID || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || "").trim();
  const appwriteApiKey = (process.env.APPWRITE_API_KEY || "").trim();

  checks.push({
    name: "APPWRITE_ENDPOINT|NEXT_PUBLIC_APPWRITE_ENDPOINT",
    ok: !!appwriteEndpoint,
    detail: appwriteEndpoint ? "configured" : "missing",
  });
  if (!appwriteEndpoint) {
    errors.push("Missing APPWRITE_ENDPOINT (or NEXT_PUBLIC_APPWRITE_ENDPOINT fallback).");
  }
  checks.push({
    name: "APPWRITE_PROJECT_ID|NEXT_PUBLIC_APPWRITE_PROJECT_ID",
    ok: !!appwriteProjectId,
    detail: appwriteProjectId ? "configured" : "missing",
  });
  if (!appwriteProjectId) {
    errors.push("Missing APPWRITE_PROJECT_ID (or NEXT_PUBLIC_APPWRITE_PROJECT_ID fallback).");
  }
  checks.push({
    name: "APPWRITE_API_KEY",
    ok: !!appwriteApiKey,
    detail: appwriteApiKey ? "configured" : "missing",
  });
  if (!appwriteApiKey) {
    errors.push("Missing APPWRITE_API_KEY.");
  }

  const pdfGeneratorFunctionId = process.env.APPWRITE_PDF_GENERATOR_FUNCTION_ID?.trim() || "";
  const pdfGeneratorFunctionIdDetail = pdfGeneratorFunctionId ? `configured (${pdfGeneratorFunctionId})` : "missing";
  checks.push({
    name: "APPWRITE_PDF_GENERATOR_FUNCTION_ID (resolved)",
    ok: !!pdfGeneratorFunctionId,
    detail: pdfGeneratorFunctionIdDetail,
  });
  if (!pdfGeneratorFunctionId) {
    errors.push("Missing APPWRITE_PDF_GENERATOR_FUNCTION_ID.");
  }

  const workerOnlyChecks = [
    "GEMINI_API_KEY|GOOGLE_API_KEY",
    "GOTENBERG_URL",
    "GOTENBERG_AUTH_TOKEN",
  ] as const;
  for (const checkName of workerOnlyChecks) {
    const [primary, fallback] = checkName.split("|");
    const raw = ((primary && process.env[primary]) || (fallback && process.env[fallback]) || "").trim();
    checks.push({
      name: checkName,
      ok: !!raw,
      detail: raw ? "configured (route env)" : "not set on route (expected in Appwrite function env)",
    });
    if (!raw) {
      warnings.push(`${checkName} is not set on route runtime; ensure it is configured in Appwrite function variables.`);
    }
  }
  checks.push({
    name: "DISPATCHER_MODE",
    ok: true,
    detail: "enabled (Appwrite function dispatcher)",
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

async function ensureGenerationReadyEmail(
  email: string,
  title: string,
  fileId: string,
  userId: string,
): Promise<boolean> {
  const normalizedFileId = String(fileId || "").trim();
  if (!normalizedFileId) return false;
  try {
    await sendGenerationPdfEmail({
      email,
      title,
      downloadUrl: buildSignedPdfDownloadPath({
        fileId: normalizedFileId,
        userId,
      }),
    });
    return true;
  } catch (error) {
    console.error("[ai/generate-pdf] Failed to send cached PDF ready email.", {
      email,
      title,
      fileId: normalizedFileId,
      error,
    });
    return false;
  }
}

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
  const completionWebhookUrl = buildCompletionWebhookUrl(request);

  if (jobType === "notes") {
    const unitNumber = Number(body.unitNumber);
    if (!Number.isInteger(unitNumber) || unitNumber < 1 || unitNumber > 5) {
      return NextResponse.json(
        { error: "Invalid selection: unit number must be between 1 and 5." },
        { status: 400 },
      );
    }

    if (!admin) {
      const quotaCheckResult = await checkQuotasOrError(user.id);
      if (quotaCheckResult.errorResponse) {
        return quotaCheckResult.errorResponse;
      }
      const quota = quotaCheckResult.quota;
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
          callbackUrl: completionWebhookUrl,
        },
      });
      notesJobId = dispatched.jobId;
      if (!dispatched.executionTriggered) {
        try {
          await rollbackReservedGenerationResources({
            admin,
            userId: user.id,
            counter: "notes_generated_today",
          });
        } catch (rollbackError) {
          console.error("[ai/generate-pdf] Failed to rollback notes reservation on non-dispatch path.", {
            userId: user.id,
            jobId: notesJobId,
            rollbackError,
          });
        }
        const normalizedExistingStatus = normalizeJobStatus(dispatched.existingStatus);
        const isCompleted = normalizedExistingStatus === JOB_STATUS_COMPLETED;
        const responseStatus = normalizedExistingStatus || "unknown";
        const shouldAttemptReadyEmail = isCompleted && !dispatched.readyEmailAlreadySent;
        let readyEmailSent = !!dispatched.readyEmailAlreadySent;
        if (shouldAttemptReadyEmail) {
          readyEmailSent = await ensureGenerationReadyEmail(
            userEmail,
            `Unit Notes (${paperCode} - Unit ${unitNumber})`,
            dispatched.resultFileId || "",
            user.id,
          );
          if (readyEmailSent && notesJobId) {
            try {
              await adminDatabases().updateDocument(
                DATABASE_ID,
                COLLECTION.ai_generation_jobs,
                notesJobId,
                {
                  email_status: "sent",
                  email_sent_at: new Date().toISOString(),
                },
              );
            } catch (emailStatePersistError) {
              console.error(
                "[ai/generate-pdf] Ready email sent for cached notes job, but failed to persist email dedupe state.",
                {
                  userId: user.id,
                  jobId: notesJobId,
                  emailStatePersistError,
                },
              );
            }
          }
        }
        const cachedDownloadUrl = isCompleted && dispatched.resultFileId
          ? buildSignedPdfDownloadPath({
            fileId: dispatched.resultFileId,
            userId: user.id,
          })
          : "";
        return NextResponse.json({
          ok: true,
          jobId: notesJobId,
          status: responseStatus,
          cached: true,
          readyEmailNotificationAttempted: shouldAttemptReadyEmail,
          readyEmailSent,
          fileId: isCompleted ? (dispatched.resultFileId || "") : "",
          downloadUrl: cachedDownloadUrl,
          message:
            isCompleted
              ? "A matching notes job is already completed. Returning cached file."
              : "A matching notes job is already in progress. Please check back shortly.",
        });
      }
      if (!admin) {
        await queueGenerationRecording(user.id, "notes_generated_today");
      }
      const startEmailSent = await ensureGenerationStartedEmail(
        userEmail,
        `Unit Notes (${paperCode} - Unit ${unitNumber})`,
      );
      if (!startEmailSent) {
        console.error(
          "[ai/generate-pdf] Started email failed after successful notes dispatch. Job is already queued and will continue in background.",
          {
            userId: user.id,
            paperCode,
            unitNumber,
            jobId: notesJobId,
          },
        );
      }
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
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      jobId: notesJobId,
      message: userEmail
        ? `Your notes are being generated for ${userEmail}. You can safely close this tab and check back shortly.`
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
    const quotaCheckResult = await checkQuotasOrError(user.id);
    if (quotaCheckResult.errorResponse) {
      return quotaCheckResult.errorResponse;
    }
    const quota = quotaCheckResult.quota;
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
        callbackUrl: completionWebhookUrl,
      },
    });
    solvedJobId = dispatched.jobId;
    if (!dispatched.executionTriggered) {
      try {
        await rollbackReservedGenerationResources({
          admin,
          userId: user.id,
          counter: "papers_solved_today",
        });
      } catch (rollbackError) {
        console.error("[ai/generate-pdf] Failed to rollback solved-paper reservation on non-dispatch path.", {
          userId: user.id,
          jobId: solvedJobId,
          rollbackError,
        });
      }
      const normalizedExistingStatus = normalizeJobStatus(dispatched.existingStatus);
      const isCompleted = normalizedExistingStatus === JOB_STATUS_COMPLETED;
      const responseStatus = normalizedExistingStatus || "unknown";
      const shouldAttemptReadyEmail = isCompleted && !dispatched.readyEmailAlreadySent;
      let readyEmailSent = !!dispatched.readyEmailAlreadySent;
      if (shouldAttemptReadyEmail) {
        readyEmailSent = await ensureGenerationReadyEmail(
          userEmail,
          `Solved Paper (${paperCode} ${year})`,
          dispatched.resultFileId || "",
          user.id,
        );
        if (readyEmailSent && solvedJobId) {
          try {
            await adminDatabases().updateDocument(
              DATABASE_ID,
              COLLECTION.ai_generation_jobs,
              solvedJobId,
              {
                email_status: "sent",
                email_sent_at: new Date().toISOString(),
              },
            );
          } catch (emailStatePersistError) {
            console.error(
              "[ai/generate-pdf] Ready email sent for cached solved-paper job, but failed to persist email dedupe state.",
              {
                userId: user.id,
                jobId: solvedJobId,
                emailStatePersistError,
              },
            );
          }
        }
      }
      const cachedDownloadUrl = isCompleted && dispatched.resultFileId
        ? buildSignedPdfDownloadPath({
          fileId: dispatched.resultFileId,
          userId: user.id,
        })
        : "";
      return NextResponse.json({
        ok: true,
        jobId: solvedJobId,
        status: responseStatus,
        cached: true,
        readyEmailNotificationAttempted: shouldAttemptReadyEmail,
        readyEmailSent,
        fileId: isCompleted ? (dispatched.resultFileId || "") : "",
        downloadUrl: cachedDownloadUrl,
        message:
          isCompleted
            ? "A matching solved-paper job is already completed. Returning cached file."
            : "A matching solved-paper job is already in progress. Please check back shortly.",
      });
    }
    if (!admin) {
      await queueGenerationRecording(user.id, "papers_solved_today");
    }
    const startEmailSent = await ensureGenerationStartedEmail(userEmail, `Solved Paper (${paperCode} ${year})`);
    if (!startEmailSent) {
      console.error(
        "[ai/generate-pdf] Started email failed after successful solved-paper dispatch. Job is already queued and will continue in background.",
        {
          userId: user.id,
          paperCode,
          year,
          jobId: solvedJobId,
        },
      );
    }
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
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    jobId: solvedJobId,
    message: userEmail
      ? `Your solved paper is being generated for ${userEmail}. You can safely close this tab and check back shortly.`
      : "Your solved paper is being generated. The PDF will be ready shortly.",
  });
}
