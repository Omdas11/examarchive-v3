type OpenRouterRole = "system" | "user" | "assistant";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_ENDPOINT = "https://openrouter.ai/api/v1/models";
const REQUEST_TIMEOUT_MS = 20_000;
const OVERALL_TIMEOUT_MS = 40_000;
const MAX_FALLBACK_MODELS = 12;
const MODEL_CACHE_TTL_MS = 10 * 60 * 1000;
const DOMEXCEPTION_TIMEOUT_ERR = 23;

// Fallback pool of known $0/$0 OpenRouter models so the app works out-of-the-box
// without a custom allowlist. This mirrors the pricing Low→High free list.
const NON_TEXT_FREE_REGEX = /embed|vision|image|video|sora|veo|flux|-vl\b/i;

const DEFAULT_FREE_MODEL_ALLOWLIST = [
  // Prioritized quick/cheap text models first
  "sourceful/riverflow-v2-fast:free",
  "sourceful/riverflow-v2:free",
  "sourceful/riverflow-v2-pro:free",
  "stepfun/step-3.5-flash:free",
  "liquid/lfm-2.5-1.2b-thinking:free",
  "liquid/lfm-2.5-1.2b-instruct:free",
  "arcee-ai/trinity-mini:free",
  "arcee-ai/trinity-large-preview:free",
  "qwen/qwen-2.5-3b-instruct:free",
  "qwen/qwen-2.5-7b-instruct:free",
  "qwen/qwen-2.5-14b-instruct:free",
  "qwen/qwen-2.5-coder-7b-instruct:free",
  "qwen/qwen-2.5-math-7b-instruct:free",
  "google/gemma-3-4b-it:free",
  "google/gemma-3n-2b:free",
  "google/gemma-3n-4b:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "meta-llama/llama-3.2-1b-instruct:free",
  // High-quality but slower fallbacks
  "deepseek/deepseek-r1-distill-llama-8b:free",
  "deepseek/deepseek-r1:free",
  "meta-llama/llama-3.1-8b-instruct:free",
  "meta-llama/llama-3.1-70b-instruct:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-3-12b-it:free",
  "google/gemma-3-27b-it:free",
  "google/gemma-2-2b-it:free",
  "google/gemma-2-9b-it:free",
  "qwen/qwen-2.5-8b-instruct:free",
  "qwen/qwen-2.5-32b-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "qwen/qwen-2.5-1.5b-instruct:free",
  "qwen/qwen-2.5-math-1.5b-instruct:free",
  "qwen/qwen-2.5-math-72b-instruct:free",
  "qwen/qwen-2.5-coder-14b-instruct:free",
  "qwen/qwen-2.5-coder-32b-instruct:free",
  "qwen/qwen3-8b:free",
  "qwen/qwen3-4b:free",
  "openai/gpt-oss-20b:free",
  "openai/gpt-oss-120b:free",
  "openchat/openchat-3.6-8b:free",
  "nousresearch/hermes-3-llama-3.1-8b:free",
  "nousresearch/hermes-3-405b-instruct:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "z-ai/glm-4.5-air:free",
];

// Optional ordering preference so we try the most responsive free models first.
// This is intentionally a subset/ordering of the default allowlist to bias toward
// speedy text models; keep in sync when adjusting the allowlist.
const PRIORITY_MODEL_ORDER = [
  "sourceful/riverflow-v2-fast:free",
  "sourceful/riverflow-v2:free",
  "sourceful/riverflow-v2-pro:free",
  "stepfun/step-3.5-flash:free",
  "liquid/lfm-2.5-1.2b-thinking:free",
  "liquid/lfm-2.5-1.2b-instruct:free",
  "arcee-ai/trinity-mini:free",
  "arcee-ai/trinity-large-preview:free",
  "qwen/qwen-2.5-3b-instruct:free",
  "qwen/qwen-2.5-7b-instruct:free",
  "qwen/qwen-2.5-14b-instruct:free",
  "google/gemma-3-4b-it:free",
  "google/gemma-3n-2b:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "deepseek/deepseek-r1-distill-llama-8b:free",
];

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

function isTimeoutLikeError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { name?: unknown; message?: unknown; code?: unknown };
  const name = typeof maybeError.name === "string" ? maybeError.name : "";
  const message = typeof maybeError.message === "string" ? maybeError.message : "";
  return (
    name === "AbortError" ||
    name === "TimeoutError" ||
    maybeError.code === DOMEXCEPTION_TIMEOUT_ERR ||
    /timed out|timeout|aborted due to timeout|operation was aborted due to timeout/i.test(message)
  );
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
  const fromEnv = (process.env.OPENROUTER_MODEL_ALLOWLIST ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_FREE_MODEL_ALLOWLIST;
}

function orderModelPool(models: string[]): string[] {
  const modelSet = new Set(models);
  const seen = new Set<string>();
  const prioritized = PRIORITY_MODEL_ORDER.filter((id) => {
    if (seen.has(id)) return false;
    if (!modelSet.has(id)) return false;
    seen.add(id);
    return true;
  });
  const remaining = models.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return [...prioritized, ...remaining];
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
      // Treat missing pricing as non-free to avoid accidental paid usage.
      return promptCost === 0 && completionCost === 0;
    })
    .map((model) => model.id)
    .filter(Boolean)
    .filter((id) => !NON_TEXT_FREE_REGEX.test(id));
}

export async function getOpenRouterModelPool(apiKey?: string): Promise<string[]> {
  const allowlist = parseAllowlist();
  const isDefaultAllowlist = (process.env.OPENROUTER_MODEL_ALLOWLIST ?? "").trim().length === 0;
  if (!apiKey) {
    return orderModelPool(allowlist);
  }

  const now = Date.now();
  if (cachedFreeModels && now - cachedFreeModels.fetchedAt < MODEL_CACHE_TTL_MS) {
    const fromCache = cachedFreeModels.models;
    return allowlist.length ? allowlist.filter((id) => fromCache.includes(id)) : fromCache;
  }

  try {
    const freeModels = await fetchFreeModelsFromOpenRouter(apiKey);
    const uniqueFree = [...new Set(freeModels)];
    const filtered =
      isDefaultAllowlist && uniqueFree.length > 0
        ? uniqueFree
        : allowlist.length
          ? allowlist.filter((id) => uniqueFree.includes(id))
          : uniqueFree;
    const ordered = orderModelPool(filtered);
    if (ordered.length > 0) {
      cachedFreeModels = { models: ordered, fetchedAt: now };
      return ordered;
    }
    // Keep routing pinned to the curated allowlist to avoid pulling non-text
    // free models (e.g., image/video) into the app's text-generation UI.
  } catch (error) {
    console.error("[OpenRouter] Failed to list models:", error);
  }

  // Last-resort: return allowlist without validation (assumed to be free per developer configuration)
  return orderModelPool(allowlist);
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
    const isTimeout = isTimeoutLikeError(error);
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
    } catch (error) {
      if (isTimeoutLikeError(error)) {
        throw {
          status: 503,
          message: "Request timed out",
          timeout: true,
        } satisfies ModelAttemptFailure;
      }
      const parseMessage = error instanceof Error ? error.message : "unknown parse error";
      throw {
        status: response.status,
        message: `Provider error response parse failed: ${parseMessage}`,
        timeout: false,
      } satisfies ModelAttemptFailure;
    }
    throw {
      status: response.status,
      message: payload?.error?.message || `Provider returned status ${response.status}`,
      timeout: false,
    } satisfies ModelAttemptFailure;
  }

  let payload: OpenRouterCompletionResponse;
  try {
    payload = (await response.json()) as OpenRouterCompletionResponse;
  } catch (error) {
    const isTimeout = isTimeoutLikeError(error);
    throw {
      status: 503,
      message: isTimeout ? "Request timed out" : "Provider response parse failed",
      timeout: isTimeout,
    } satisfies ModelAttemptFailure;
  }
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
  const basePoolRaw =
    args.modelPool && args.modelPool.length > 0
      ? args.modelPool
      : await getOpenRouterModelPool(args.apiKey);
  const orderedBase = orderModelPool(basePoolRaw);
  const limitedBase = orderedBase.slice(0, MAX_FALLBACK_MODELS);
  const preferred = args.preferredModel?.trim();
  const modelPool =
    preferred && limitedBase.includes(preferred)
      ? [preferred, ...limitedBase.filter((model) => model !== preferred)]
      : preferred
        ? [preferred, ...limitedBase].slice(0, MAX_FALLBACK_MODELS)
        : limitedBase;
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
