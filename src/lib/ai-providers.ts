import { runGeminiCompletion, GeminiServiceError } from "./gemini";

/**
 * Free-tier AI provider chain for ExamArchive.
 *
 * Tries providers in order, rotating through multiple keys per provider,
 * failing over on rate limits (429) / server errors (5xx) / network issues.
 * Auth errors (401/403) and bad requests (400) skip the provider entirely —
 * retrying those burns nothing but time.
 *
 * All providers except Gemini-native speak OpenAI-compatible chat completions.
 *
 * Env vars (comma-separated for rotation):
 *   GEMINI_KEYS (or GEMINI_API_KEY), GEMINI_MODEL_ID
 *   GROQ_KEYS (or GROQ_API_KEY), GROQ_MODEL
 *   OPENROUTER_KEYS (or OPENROUTER_API_KEY), OPENROUTER_MODEL
 *   GITHUB_KEYS (or GITHUB_TOKEN), GITHUB_MODEL
 *   VYCEAI_KEYS (or VYCEAI_API_KEY), VYCEAI_MODEL
 *   (Pollinations needs no key — always last resort)
 */

const REQUEST_TIMEOUT_MS = Math.max(
  1_000,
  Number.isFinite(Number(process.env.AI_PROVIDER_TIMEOUT_MS))
    ? Number(process.env.AI_PROVIDER_TIMEOUT_MS)
    : 120_000,
);

export class AIProviderError extends Error {
  constructor(
    public readonly provider: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface OpenAIProviderConfig {
  id: string;
  baseUrl: string;
  model: string;
  keys: string[];
  /** Extra headers (e.g. OpenRouter's HTTP-Referer). */
  headers?: Record<string, string>;
  /** Use simple GET ?model= text API (Pollinations keyless lane) instead of /chat/completions. */
  simpleGet?: boolean;
}

function parseKeys(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

function getProviders(): OpenAIProviderConfig[] {
  return [
    {
      id: "groq",
      baseUrl: "https://api.groq.com/openai/v1",
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      keys: parseKeys(process.env.GROQ_KEYS || process.env.GROQ_API_KEY),
    },
    {
      id: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.3-70b-instruct:free",
      keys: parseKeys(process.env.OPENROUTER_KEYS || process.env.OPENROUTER_API_KEY),
      headers: {
        "HTTP-Referer": "https://www.examarchive.dev",
        "X-Title": "ExamArchive",
      },
    },
    {
      id: "github-models",
      baseUrl: "https://models.github.ai/inference",
      model: process.env.GITHUB_MODEL || "openai/gpt-4o-mini",
      keys: parseKeys(process.env.GITHUB_KEYS || process.env.GITHUB_TOKEN),
    },
    {
      id: "vyceai",
      baseUrl: "https://vyceai.com/v1",
      model: process.env.VYCEAI_MODEL || "deepseek-v4-flash",
      keys: parseKeys(process.env.VYCEAI_KEYS || process.env.VYCEAI_API_KEY),
    },
    {
      id: "llm7",
      baseUrl: "https://api.llm7.io/v1",
      model: process.env.LLM7_MODEL || "gpt-oss:20b",
      keys: ["keyless"], // anonymous tier: 10 RPM / 60 req/hr, no key needed
    },
    {
      id: "pollinations",
      baseUrl: "https://text.pollinations.ai",
      model: process.env.POLLINATIONS_MODEL || "openai",
      keys: ["keyless"], // simple GET text API — keyless lane; /v1/chat/completions needs a key
      simpleGet: true,
    },
  ];
}

/** Round-robin cursor per provider (in-memory; resets on deploy — fine). */
const keyCursors = new Map<string, number>();

async function callOpenAICompatible(
  provider: OpenAIProviderConfig,
  apiKey: string,
  args: { prompt: string; maxTokens: number; temperature: number; systemPrompt?: string },
): Promise<string> {
  const messages: Array<{ role: string; content: string }> = [];
  if (args.systemPrompt) messages.push({ role: "system", content: args.systemPrompt });
  messages.push({ role: "user", content: args.prompt });

  // Keyless simple GET lane (Pollinations legacy text API)
  if (provider.simpleGet) {
    const fullPrompt = args.systemPrompt
      ? `${args.systemPrompt}\n\n${args.prompt}`
      : args.prompt;
    const url =
      `${provider.baseUrl}/${encodeURIComponent(fullPrompt)}` +
      `?model=${encodeURIComponent(provider.model)}`;
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (error) {
      throw new AIProviderError(provider.id, 503, error instanceof Error ? error.message : "Network error");
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new AIProviderError(provider.id, response.status, `HTTP ${response.status}: ${body.slice(0, 200)}`);
    }
    const text = (await response.text()).trim();
    if (!text) throw new AIProviderError(provider.id, 503, "Empty response");
    return text;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(provider.headers ?? {}),
  };
  if (apiKey !== "keyless") headers["Authorization"] = `Bearer ${apiKey}`;

  let response: Response;
  try {
    response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: provider.model,
        messages,
        max_tokens: args.maxTokens,
        temperature: args.temperature,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new AIProviderError(provider.id, 503, error instanceof Error ? error.message : "Network error");
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new AIProviderError(provider.id, response.status, `HTTP ${response.status}: ${body.slice(0, 200)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) throw new AIProviderError(provider.id, 503, "Empty response");
  return text;
}

function isRetryable(status: number): boolean {
  return status === 429 || status === 503 || (status >= 500 && status <= 599);
}

function isAuthError(status: number): boolean {
  return status === 400 || status === 401 || status === 403;
}

export interface GenerateTextArgs {
  prompt: string;
  maxTokens: number;
  temperature: number;
  systemPrompt?: string;
}

export interface GenerateTextResult {
  content: string;
  provider: string;
  model: string;
}

/**
 * Generate text via the free-tier provider chain.
 * Gemini (native) first for quality, then OpenAI-compatible fallbacks.
 * Throws AIProviderError only when every provider is exhausted.
 */
export async function generateAIText(args: GenerateTextArgs): Promise<GenerateTextResult> {
  const errors: string[] = [];

  // ── 1. Gemini native (best free quality) ──────────────────────────────
  const geminiKeys = parseKeys(process.env.GEMINI_KEYS || process.env.GEMINI_API_KEY);
  const geminiModel = process.env.GEMINI_MODEL_ID || "gemini-3.5-flash-lite";
  if (geminiKeys.length > 0) {
    const startIdx = keyCursors.get("gemini") ?? 0;
    for (let i = 0; i < geminiKeys.length; i++) {
      const key = geminiKeys[(startIdx + i) % geminiKeys.length];
      try {
        const result = await runGeminiCompletion({
          apiKey: key,
          prompt: args.prompt,
          maxTokens: args.maxTokens,
          temperature: args.temperature,
          model: geminiModel,
        });
        keyCursors.set("gemini", (startIdx + i + 1) % geminiKeys.length);
        return { content: result.content, provider: "gemini", model: result.model };
      } catch (error) {
        const status = error instanceof GeminiServiceError ? error.status : 503;
        errors.push(`gemini: ${error instanceof Error ? error.message : "failed"}`);
        if (isAuthError(status)) break; // bad key config — don't try other keys
        if (!isRetryable(status)) break;
      }
    }
  } else {
    errors.push("gemini: no keys configured");
  }

  // ── 2. OpenAI-compatible fallbacks ────────────────────────────────────
  for (const provider of getProviders()) {
    if (provider.keys.length === 0) {
      errors.push(`${provider.id}: no keys configured`);
      continue;
    }
    const startIdx = keyCursors.get(provider.id) ?? 0;
    for (let i = 0; i < provider.keys.length; i++) {
      const key = provider.keys[(startIdx + i) % provider.keys.length];
      try {
        const content = await callOpenAICompatible(provider, key, args);
        keyCursors.set(provider.id, (startIdx + i + 1) % provider.keys.length);
        return { content, provider: provider.id, model: provider.model };
      } catch (error) {
        const status = error instanceof AIProviderError ? error.status : 503;
        errors.push(`${provider.id}: ${error instanceof Error ? error.message : "failed"}`);
        if (isAuthError(status)) break; // skip remaining keys for this provider
        if (!isRetryable(status)) break;
      }
    }
  }

  throw new AIProviderError("all", 503, `All providers exhausted. ${errors.join(" | ")}`);
}
