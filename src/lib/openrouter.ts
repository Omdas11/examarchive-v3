type OpenRouterRole = "system" | "user" | "assistant";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_ENDPOINT = "https://openrouter.ai/api/v1/models";
const REQUEST_TIMEOUT_MS = 15_000;
const OVERALL_TIMEOUT_MS = 25_000;
const MODEL_CACHE_TTL_MS = 10 * 60 * 1000;

const DEFAULT_APP_URL =
  process.env.OPENROUTER_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://www.examarchive.dev";
const DEFAULT_APP_NAME = process.env.OPENROUTER_APP_NAME || "ExamArchive";

export type AIErrorCode = "HIGH_TRAFFIC" | "DAILY_LIMIT_REACHED" | "SERVICE_UNAVAILABLE";

export class AIServiceError extends Error {
  constructor(
    public readonly code: AIErrorCode,
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface OpenRouterErrorPayload {
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

interface OpenRouterCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

interface ModelAttemptFailure {
  status: number;
  message: string;
  timeout?: boolean;
}

interface OpenRouterModelListResponse {
  data?: Array<{
    id: string;
    pricing?: {
      prompt?: number | string | null;
      completion?: number | string | null;
    };
  }>;
}

let cachedFreeModels: { models: string[]; fetchedAt: number } | null = null;

function parseAllowlist(): string[] {
  return (process.env.OPENROUTER_MODEL_ALLOWLIST ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
}

function classifyProviderError(failure: ModelAttemptFailure): AIServiceError {
  const normalized = (failure.message ?? "").toLowerCase();

  if (
    failure.timeout ||
    failure.status === 429 ||
    normalized.includes("rate limit") ||
    normalized.includes("too many requests") ||
    normalized.includes("overload") ||
    normalized.includes("capacity")
  ) {
    return new AIServiceError("HIGH_TRAFFIC", 503, "AI is under high traffic. Please try again in a moment.");
  }

  if (
    failure.status === 402 ||
    normalized.includes("quota") ||
    normalized.includes("billing") ||
    normalized.includes("insufficient_quota")
  ) {
    return new AIServiceError("SERVICE_UNAVAILABLE", 503, "Service temporarily unavailable. Please try again shortly.");
  }

  return new AIServiceError("SERVICE_UNAVAILABLE", 503, "Service temporarily unavailable. Please try again shortly.");
}

function summarizeFailures(failures: ModelAttemptFailure[]): AIServiceError {
  const classifiedCodes = failures.map((failure) => classifyProviderError(failure).code);
  if (classifiedCodes.includes("HIGH_TRAFFIC")) {
    return new AIServiceError("HIGH_TRAFFIC", 503, "AI is under high traffic. Please try again in a moment.");
  }
  if (classifiedCodes.includes("DAILY_LIMIT_REACHED")) {
    return new AIServiceError("DAILY_LIMIT_REACHED", 429, "Daily limit reached. Please try again tomorrow.");
  }
  return new AIServiceError("SERVICE_UNAVAILABLE", 503, "Service temporarily unavailable. Please try again shortly.");
}

async function fetchFreeModelsFromOpenRouter(apiKey: string): Promise<string[]> {
  const response = await fetch(OPENROUTER_MODELS_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": DEFAULT_APP_URL,
      "X-Title": DEFAULT_APP_NAME,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch OpenRouter models (status ${response.status})`);
  }

  const payload = (await response.json()) as OpenRouterModelListResponse;
  const models = payload.data ?? [];
  return models
    .filter((model) => {
      const promptCost = Number(model.pricing?.prompt ?? Number.POSITIVE_INFINITY);
      const completionCost = Number(model.pricing?.completion ?? Number.POSITIVE_INFINITY);
      return promptCost === 0 && completionCost === 0;
    })
    .map((model) => model.id)
    .filter(Boolean);
}

export async function getOpenRouterModelPool(apiKey?: string): Promise<string[]> {
  const allowlist = parseAllowlist();
  if (!apiKey) {
    return allowlist;
  }

  const now = Date.now();
  if (cachedFreeModels && now - cachedFreeModels.fetchedAt < MODEL_CACHE_TTL_MS) {
    const fromCache = cachedFreeModels.models;
    return allowlist.length ? allowlist.filter((id) => fromCache.includes(id)) : fromCache;
  }

  try {
    const freeModels = await fetchFreeModelsFromOpenRouter(apiKey);
    const uniqueFree = [...new Set(freeModels)];
    const filtered = allowlist.length ? allowlist.filter((id) => uniqueFree.includes(id)) : uniqueFree;
    if (filtered.length > 0) {
      cachedFreeModels = { models: filtered, fetchedAt: now };
      return filtered;
    }
    // If no overlap with allowlist, fall back to discovered free models.
    if (uniqueFree.length > 0) {
      cachedFreeModels = { models: uniqueFree, fetchedAt: now };
      return uniqueFree;
    }
  } catch (error) {
    console.error("[OpenRouter] Failed to list models:", error);
  }

  // Last-resort: return allowlist without validation (assumed to be free per developer configuration)
  return allowlist;
}

async function callOpenRouterModel(args: {
  apiKey: string;
  model: string;
  messages: Array<{ role: OpenRouterRole; content: string }>;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  referer?: string;
  appName?: string;
}): Promise<{ content: string }> {
  let response: Response;
  try {
    response = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.apiKey}`,
        "HTTP-Referer": args.referer || DEFAULT_APP_URL,
        "X-Title": args.appName || DEFAULT_APP_NAME,
      },
      body: JSON.stringify({
        model: args.model,
        messages: args.messages,
        max_tokens: args.maxTokens,
        temperature: args.temperature,
      }),
      signal: AbortSignal.timeout(args.timeoutMs),
    });
  } catch (error) {
    const isTimeout = error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
    throw {
      status: 503,
      timeout: isTimeout,
      message: isTimeout ? "Request timed out" : "Network request failed",
    } satisfies ModelAttemptFailure;
  }

  if (!response.ok) {
    let payload: OpenRouterErrorPayload | null = null;
    try {
      payload = (await response.json()) as OpenRouterErrorPayload;
    } catch {
      payload = null;
    }
    throw {
      status: response.status,
      message: payload?.error?.message || `Provider returned status ${response.status}`,
      timeout: false,
    } satisfies ModelAttemptFailure;
  }

  const payload = (await response.json()) as OpenRouterCompletionResponse;
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw {
      status: 503,
      message: "Provider returned an empty response",
      timeout: false,
    } satisfies ModelAttemptFailure;
  }
  return { content };
}

function isModelAttemptFailure(error: unknown): error is ModelAttemptFailure {
  return Boolean(
    error &&
      typeof error === "object" &&
      "status" in error &&
      typeof (error as { status: unknown }).status === "number" &&
      "message" in error &&
      typeof (error as { message: unknown }).message === "string",
  );
}

export async function runOpenRouterCompletionWithFallback(args: {
  apiKey: string;
  messages: Array<{ role: OpenRouterRole; content: string }>;
  maxTokens: number;
  temperature: number;
  preferredModel?: string;
  modelPool?: string[];
  referer?: string;
  appName?: string;
}): Promise<{ content: string; model: string }> {
  const basePool = args.modelPool && args.modelPool.length > 0
    ? args.modelPool
    : await getOpenRouterModelPool(args.apiKey);
  const preferred = args.preferredModel?.trim();
  const modelPool = preferred && basePool.includes(preferred)
    ? [preferred, ...basePool.filter((model) => model !== preferred)]
    : basePool;
  if (modelPool.length === 0) {
    throw new AIServiceError("SERVICE_UNAVAILABLE", 503, "Service temporarily unavailable. Please try again shortly.");
  }

  const failures: ModelAttemptFailure[] = [];
  const deadline = Date.now() + OVERALL_TIMEOUT_MS;
  let timedOutBeforeAttempt = false;
  for (const model of modelPool) {
    const remainingOverallMs = deadline - Date.now();
    if (remainingOverallMs < 0) {
      timedOutBeforeAttempt = true;
      break;
    }
    try {
      const result = await callOpenRouterModel({
        apiKey: args.apiKey,
        model,
        messages: args.messages,
        maxTokens: args.maxTokens,
        temperature: args.temperature,
        timeoutMs: Math.min(REQUEST_TIMEOUT_MS, remainingOverallMs),
        referer: args.referer,
        appName: args.appName,
      });
      return { ...result, model };
    } catch (error) {
      if (!isModelAttemptFailure(error)) {
        throw error;
      }
      failures.push(error);
    }
  }

  if (failures.length === 0) {
    if (timedOutBeforeAttempt) {
      throw new AIServiceError("SERVICE_UNAVAILABLE", 503, "Service temporarily unavailable. Please try again shortly.");
    }
    throw new AIServiceError("SERVICE_UNAVAILABLE", 503, "Service temporarily unavailable. Please try again shortly.");
  }
  throw summarizeFailures(failures);
}
