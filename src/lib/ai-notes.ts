/**
 * AI Notes — Cloudflare-native core (2026-11-20).
 *
 * Everything the AI Notes generator needs, with no Appwrite imports:
 * - Provider chain (keys from the Worker env via getCloudflareContext —
 *   `process.env` does NOT see Worker secrets under OpenNext).
 * - D1 ledger helpers for the daily-free rule and credit deduction.
 * - The notes prompt builder.
 *
 * Free tier: exactly 1 free PDF per day per registered account (UTC day).
 * Paid: 10 credits per set, deducted ONLY after a PDF is delivered.
 * Rerun: 1 free manual rerun per PAID generation (different provider);
 * a rerun of a free daily generation costs 10 credits.
 *
 * Kaggle Model Proxy overflow is NOT wired in: minting its token needs the
 * Kaggle API credential plus a 2h refresh loop, neither of which exists in
 * the Worker. Documented gap — the chain below is complete without it.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { runGeminiCompletion, GeminiServiceError } from "./gemini";
import {
  getNoteLengthTargets,
  type NoteLength,
} from "./note-length";
import { GENERATION_COST_CREDITS } from "./economy";

export const AI_NOTES_DAILY_FREE_LIMIT = 1;
export const GEMINI_FLASH_LITE_MODEL = "gemini-3.5-flash-lite";
export const GEMMA_4_MODEL = "gemma-4-31b-it";
export const MAX_COMPLETION_TOKENS = 3800;

/** Worker env values the AI Notes flow reads. All optional — a provider
 * whose key is missing is skipped, never retried with an empty key. */
export interface AiNotesEnv {
  geminiApiKey?: string;
  groqKeys: string[];
  openrouterKeys: string[];
  githubKeys: string[];
  gotenbergUrl?: string;
  gotenbergAuthToken?: string;
}

function parseKeys(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

/** Read AI Notes env from the Worker bindings. */
export async function getAiNotesEnv(): Promise<AiNotesEnv> {
  const { env } = await getCloudflareContext({ async: true });
  const e = env as unknown as Record<string, string | undefined>;
  return {
    geminiApiKey:
      (e.GEMINI_API_KEY ?? e.GOOGLE_API_KEY ?? "").trim() || undefined,
    groqKeys: parseKeys(e.GROQ_KEYS ?? e.GROQ_API_KEY),
    openrouterKeys: parseKeys(e.OPENROUTER_KEYS ?? e.OPENROUTER_API_KEY),
    githubKeys: parseKeys(e.GITHUB_KEYS ?? e.GITHUB_TOKEN),
    gotenbergUrl: (e.GOTENBERG_URL ?? "").trim() || undefined,
    gotenbergAuthToken: (e.GOTENBERG_AUTH_TOKEN ?? "").trim() || undefined,
  };
}

/** UTC calendar day, YYYY-MM-DD — the free-tier day boundary. */
export function todayUtcDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

// ── Provider chain ───────────────────────────────────────────────────────

export interface GenerateTextResult {
  content: string;
  provider: string;
  model: string;
}

export class AiNotesProviderError extends Error {
  constructor(
    public readonly provider: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function isRetryable(status: number): boolean {
  return status === 429 || status === 503 || (status >= 500 && status <= 599);
}

function isAuthError(status: number): boolean {
  return status === 400 || status === 401 || status === 403;
}

async function callOpenAiCompatible(args: {
  baseUrl: string;
  model: string;
  apiKey: string;
  prompt: string;
  maxTokens: number;
  temperature: number;
  headers?: Record<string, string>;
}): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${args.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(args.headers ?? {}),
        Authorization: `Bearer ${args.apiKey}`,
      },
      body: JSON.stringify({
        model: args.model,
        messages: [{ role: "user", content: args.prompt }],
        max_tokens: args.maxTokens,
        temperature: args.temperature,
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    throw new AiNotesProviderError(
      args.baseUrl,
      503,
      error instanceof Error ? error.message : "Network error",
    );
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new AiNotesProviderError(
      args.baseUrl,
      response.status,
      `HTTP ${response.status}: ${body.slice(0, 200)}`,
    );
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) throw new AiNotesProviderError(args.baseUrl, 503, "Empty response");
  return text;
}

/**
 * Generate notes markdown via the free-tier chain, in order:
 * Gemini 3.5 Flash-Lite → Gemma 4 (gemma-4-31b-it, same Gemini key) →
 * Groq → OpenRouter :free → GitHub Models.
 * Providers without a key are skipped. Throws only when all fail.
 */
export async function generateAiNotesText(
  env: AiNotesEnv,
  args: { prompt: string; maxTokens: number; temperature?: number },
): Promise<GenerateTextResult> {
  const errors: string[] = [];
  const temperature = args.temperature ?? 0.6;

  // ── 1 + 2. Gemini native: Flash-Lite, then Gemma 4 on the same key ─────
  if (env.geminiApiKey) {
    for (const model of [GEMINI_FLASH_LITE_MODEL, GEMMA_4_MODEL]) {
      try {
        const result = await runGeminiCompletion({
          apiKey: env.geminiApiKey,
          prompt: args.prompt,
          maxTokens: args.maxTokens,
          temperature,
          model,
        });
        return { content: result.content, provider: "gemini", model: result.model };
      } catch (error) {
        const status = error instanceof GeminiServiceError ? error.status : 503;
        errors.push(`${model}: ${error instanceof Error ? error.message : "failed"}`);
        if (isAuthError(status)) break; // bad key config — Gemma would fail the same way
        if (!isRetryable(status)) break;
      }
    }
  } else {
    errors.push("gemini: no key configured");
  }

  // ── 3–5. OpenAI-compatible fallbacks ───────────────────────────────────
  const fallbacks: Array<{
    id: string;
    baseUrl: string;
    model: string;
    keys: string[];
    headers?: Record<string, string>;
  }> = [
    {
      id: "groq",
      baseUrl: "https://api.groq.com/openai/v1",
      model: "llama-3.3-70b-versatile",
      keys: env.groqKeys,
    },
    {
      id: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1",
      model: "meta-llama/llama-3.3-70b-instruct:free",
      keys: env.openrouterKeys,
      headers: {
        "HTTP-Referer": "https://www.examarchive.dev",
        "X-Title": "ExamArchive",
      },
    },
    {
      id: "github-models",
      baseUrl: "https://models.github.ai/inference",
      model: "openai/gpt-4o-mini",
      keys: env.githubKeys,
    },
  ];
  for (const provider of fallbacks) {
    if (provider.keys.length === 0) {
      errors.push(`${provider.id}: no key configured`);
      continue;
    }
    for (const key of provider.keys) {
      try {
        const content = await callOpenAiCompatible({
          baseUrl: provider.baseUrl,
          model: provider.model,
          apiKey: key,
          prompt: args.prompt,
          maxTokens: args.maxTokens,
          temperature,
          headers: provider.headers,
        });
        return { content, provider: provider.id, model: provider.model };
      } catch (error) {
        const status = error instanceof AiNotesProviderError ? error.status : 503;
        errors.push(`${provider.id}: ${error instanceof Error ? error.message : "failed"}`);
        if (isAuthError(status)) break;
        if (!isRetryable(status)) break;
      }
    }
  }

  throw new AiNotesProviderError(
    "all",
    503,
    `All providers exhausted. ${errors.join(" | ")}`,
  );
}

// ── Prompt ───────────────────────────────────────────────────────────────

export function buildAiNotesPrompt(args: {
  topic: string;
  paperCode?: string;
  paperName?: string;
  noteLength: NoteLength;
}): string {
  const targets = getNoteLengthTargets(args.noteLength);
  const paperLine =
    args.paperCode || args.paperName
      ? `\nPaper: ${[args.paperCode, args.paperName].filter(Boolean).join(" — ")}`
      : "";
  return `You are an expert university professor generating rigorous, exam-ready study notes.
Analyze the topic to pick the correct academic domain, then produce one complete response without requesting follow-up.

Topic: "${args.topic}"${paperLine}

Strict formatting:
- Return plain Markdown text only; do not include any HTML/XML tags or blocks.
- Use Markdown headings only.
- Use only $...$ for inline math and $$...$$ on their own lines for display math.
- Never use \\(...\\) or \\[...\\] delimiters.
- Do NOT mix plain text with math symbols; wrap every symbol/variable in LaTeX.

Before generating the notes, silently analyze the topic's academic domain. Dynamically alter section headings and formatting to fit the subject matter:
- For STEM (Math, Physics, Engineering): use "Derivations & Step-by-Step Methodologies" and include rigorous mathematical proofs and formulas.
- For Humanities & Arts (History, Literature, Sociology): replace derivations with "Historical Context", "Critical Analysis", or "Major Themes". Do not invent or force mathematical equations.
- For Business & Commerce: use "Core Frameworks", "Real-World Applications", and "Economic Impact".
- For Computer Science: use "Algorithmic Logic", "Code Implementation Concepts", and "Time/Space Complexity".

Required sections in order:
1) ## Precise Definition — concise, domain-accurate definition.
2) ## Core Theories & Methodologies — key laws/principles; cite assumptions.
3) ## Domain-Specific Deep Dive — use the domain-appropriate heading/rules above.
4) ## Two Worked Examples — fully solved with step-by-step reasoning; include final answers.
5) ## Common Pitfalls & Exam Strategies — high-yield warnings and timing tips.
6) ## Quick Revision Table — Markdown table of symbols, meanings, and must-know facts.
7) ## References & Further Study — 2 to 3 realistic academic references (e.g., standard textbooks, reputable academic sites).

Additional requirements:
- Target length: about ${targets.targetWords} words (${targets.label}).
- If context is missing, state that and rely on standard academic knowledge only.
- Prioritize correctness over length; avoid speculation or hallucinations.`;
}

// ── D1 ledger ────────────────────────────────────────────────────────────

export interface AiNotesGenerationRow {
  id: string;
  user_id: string;
  date: string;
  topic: string;
  paper_code: string | null;
  note_length: string;
  provider: string | null;
  model: string | null;
  credits_charged: number;
  status: string;
  is_free_daily: number;
  is_rerun: number;
  rerun_of: string | null;
  created_at: number;
}

/** Has this user already used today's free PDF? */
export async function getFreeUsedToday(
  db: D1Database,
  userId: string,
  date: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      "SELECT id FROM ai_notes_generations WHERE user_id = ? AND date = ? AND is_free_daily = 1 AND status = 'completed' LIMIT 1",
    )
    .bind(userId, date)
    .first<{ id: string }>();
  return Boolean(row);
}

/** Current credit balance for a user. */
export async function getUserCreditBalance(
  db: D1Database,
  userId: string,
): Promise<number> {
  const row = await db
    .prepare("SELECT ai_credits FROM users WHERE id = ? LIMIT 1")
    .bind(userId)
    .first<{ ai_credits: number }>();
  return Number(row?.ai_credits ?? 0);
}

/** One generation by id (any user — callers must check ownership). */
export async function getGenerationById(
  db: D1Database,
  id: string,
): Promise<AiNotesGenerationRow | null> {
  const row = await db
    .prepare(
      "SELECT id, user_id, date, topic, paper_code, note_length, provider, model, credits_charged, status, is_free_daily, is_rerun, rerun_of, created_at FROM ai_notes_generations WHERE id = ? LIMIT 1",
    )
    .bind(id)
    .first<AiNotesGenerationRow>();
  return row ?? null;
}

/** Has the one free rerun of this paid generation already been used? */
export async function hasFreeRerunBeenUsed(
  db: D1Database,
  rerunOfId: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      "SELECT id FROM ai_notes_generations WHERE rerun_of = ? AND is_rerun = 1 AND credits_charged = 0 AND status = 'completed' LIMIT 1",
    )
    .bind(rerunOfId)
    .first<{ id: string }>();
  return Boolean(row);
}

export interface RecordGenerationArgs {
  id: string;
  userId: string;
  date: string;
  topic: string;
  paperCode?: string | null;
  noteLength: NoteLength;
  provider?: string | null;
  model?: string | null;
  creditsCharged: number;
  status: "completed" | "failed";
  isFreeDaily: boolean;
  isRerun: boolean;
  rerunOf?: string | null;
}

/**
 * Record a generation AND deduct credits (when charged) in one D1 batch,
 * so the ledger and the balance can never drift apart. The credit update
 * is guarded by `ai_credits >= ?` — if it affects 0 rows the caller must
 * treat the charge as failed (balance moved under us).
 * Returns true when the batch applied (including the guarded update).
 */
export async function recordCompletedGeneration(
  db: D1Database,
  args: RecordGenerationArgs,
): Promise<boolean> {
  const now = Date.now();
  const insert = db
    .prepare(
      "INSERT INTO ai_notes_generations (id, user_id, date, topic, paper_code, note_length, provider, model, credits_charged, status, is_free_daily, is_rerun, rerun_of, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      args.id,
      args.userId,
      args.date,
      args.topic,
      args.paperCode ?? null,
      args.noteLength,
      args.provider ?? null,
      args.model ?? null,
      args.creditsCharged,
      args.status,
      args.isFreeDaily ? 1 : 0,
      args.isRerun ? 1 : 0,
      args.rerunOf ?? null,
      now,
      now,
    );
  if (args.creditsCharged > 0) {
    const deduct = db
      .prepare(
        "UPDATE users SET ai_credits = ai_credits - ? WHERE id = ? AND ai_credits >= ?",
      )
      .bind(args.creditsCharged, args.userId, args.creditsCharged);
    const results = await db.batch([deduct, insert]);
    const deductMeta = results[0]?.meta as { changes?: number } | undefined;
    if ((deductMeta?.changes ?? 0) !== 1) {
      // Balance moved under us (concurrent generation): undo the ledger
      // row so a paid generation is never recorded without its charge.
      try {
        await db
          .prepare("DELETE FROM ai_notes_generations WHERE id = ?")
          .bind(args.id)
          .run();
      } catch {
        // Best effort — the caller reports the charge failure either way.
      }
      return false;
    }
    return true;
  }
  await insert.run();
  return true;
}

/** Best-effort record of a failed attempt. Never consumes the free slot
 * and never charges — a failed generation costs the user nothing. */
export async function recordFailedGeneration(
  db: D1Database,
  args: Omit<RecordGenerationArgs, "status" | "creditsCharged" | "isFreeDaily">,
): Promise<void> {
  try {
    await recordCompletedGeneration(db, {
      ...args,
      status: "failed",
      creditsCharged: 0,
      isFreeDaily: false,
    });
  } catch {
    // Ledger failures must never fail the request itself.
  }
}

export { GENERATION_COST_CREDITS };
