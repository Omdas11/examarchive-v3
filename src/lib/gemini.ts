const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL_ID || "gemini-1.5-flash-latest";
const REQUEST_TIMEOUT_MS = 20_000;

export class GeminiServiceError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

interface GeminiResult {
  content: string;
  model: string;
}

export async function runGeminiCompletion(args: {
  apiKey: string;
  prompt: string;
  maxTokens: number;
  temperature: number;
  model?: string;
  contents?: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>;
}): Promise<GeminiResult> {
  const model = (args.model || DEFAULT_GEMINI_MODEL).trim();
  const url = `${GEMINI_ENDPOINT}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(args.apiKey)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: args.contents && args.contents.length > 0
          ? args.contents
          : [{ role: "user", parts: [{ text: args.prompt }] }],
        generationConfig: {
          maxOutputTokens: args.maxTokens,
          temperature: args.temperature,
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new GeminiServiceError(503, error instanceof Error ? error.message : "Network error");
  }

  if (!response.ok) {
    const message = `Gemini request failed (status ${response.status})`;
    throw new GeminiServiceError(response.status, message);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new GeminiServiceError(503, "Gemini returned an empty response");
  }
  return { content: text, model };
}
