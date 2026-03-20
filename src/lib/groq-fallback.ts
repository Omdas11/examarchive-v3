type GroqRole = "system" | "user" | "assistant";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 15_000;
const OVERALL_TIMEOUT_MS = 25_000;

// All free/open-source models available on Groq dashboard
const DEFAULT_MODEL_POOL = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "llama-3.1-70b-versatile",
  "mixtral-8x7b-32768",
  "gemma-7b-it",
  "gemma2-9b-it",
];

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

interface GroqErrorPayload {
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

interface GroqCompletionResponse {
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

export function getGroqModelPool(): string[] {
  const fromEnv = (process.env.GROQ_MODEL_POOL ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
  return [...new Set(fromEnv.length ? fromEnv : DEFAULT_MODEL_POOL)];
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

async function callGroqModel(args: {
  apiKey: string;
  model: string;
  messages: Array<{ role: GroqRole; content: string }>;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
}): Promise<{ content: string }> {
  let response: Response;
  try {
    response = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${args.apiKey}`,
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
    let payload: GroqErrorPayload | null = null;
    try {
      payload = (await response.json()) as GroqErrorPayload;
    } catch {
      payload = null;
    }
    throw {
      status: response.status,
      message: payload?.error?.message || `Provider returned status ${response.status}`,
      timeout: false,
    } satisfies ModelAttemptFailure;
  }

  const payload = (await response.json()) as GroqCompletionResponse;
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

export async function runGroqCompletionWithFallback(args: {
  apiKey: string;
  messages: Array<{ role: GroqRole; content: string }>;
  maxTokens: number;
  temperature: number;
  preferredModel?: string;
}): Promise<{ content: string; model: string }> {
  const basePool = getGroqModelPool();
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
      const result = await callGroqModel({
        apiKey: args.apiKey,
        model,
        messages: args.messages,
        maxTokens: args.maxTokens,
        temperature: args.temperature,
        timeoutMs: Math.min(REQUEST_TIMEOUT_MS, remainingOverallMs),
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
