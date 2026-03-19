type GroqRole = "system" | "user" | "assistant";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 15_000;

const DEFAULT_MODEL_POOL = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "llama-3.1-70b-versatile",
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
  const normalized = failure.message.toLowerCase();

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
    return new AIServiceError("DAILY_LIMIT_REACHED", 429, "Daily limit reached. Please try again tomorrow.");
  }

  return new AIServiceError("SERVICE_UNAVAILABLE", 503, "Service temporarily unavailable. Please try again shortly.");
}

function summarizeFailures(failures: ModelAttemptFailure[]): AIServiceError {
  if (failures.some((f) => classifyProviderError(f).code === "HIGH_TRAFFIC")) {
    return new AIServiceError("HIGH_TRAFFIC", 503, "AI is under high traffic. Please try again in a moment.");
  }
  if (failures.some((f) => classifyProviderError(f).code === "DAILY_LIMIT_REACHED")) {
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
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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

export async function runGroqCompletionWithFallback(args: {
  apiKey: string;
  messages: Array<{ role: GroqRole; content: string }>;
  maxTokens: number;
  temperature: number;
}): Promise<{ content: string; model: string }> {
  const failures: ModelAttemptFailure[] = [];
  for (const model of getGroqModelPool()) {
    try {
      const result = await callGroqModel({
        apiKey: args.apiKey,
        model,
        messages: args.messages,
        maxTokens: args.maxTokens,
        temperature: args.temperature,
      });
      return { ...result, model };
    } catch (error) {
      const failure = error as ModelAttemptFailure;
      failures.push(failure);
    }
  }

  throw summarizeFailures(failures);
}
