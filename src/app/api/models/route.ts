import { NextResponse } from "next/server";

type ModelOption = {
  id: string;
  name: string;
};

type ModelsPayload = {
  google: ModelOption[];
  openrouter: ModelOption[];
  groq: ModelOption[];
};

const GOOGLE_FREE_MODELS: ModelOption[] = [
  { id: "gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash Lite Preview" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" },
];

export const revalidate = 3600;

export async function GET() {
  const payload: ModelsPayload = {
    google: GOOGLE_FREE_MODELS,
    openrouter: [],
    groq: [],
  };

  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "Content-Type": "application/json" },
      next: { revalidate },
    });
    if (response.ok) {
      const data = (await response.json()) as { data?: Array<Record<string, unknown>> };
      const mapped = (data.data ?? [])
        .filter((model) => {
          const pricing = model.pricing as { prompt?: unknown; completion?: unknown } | undefined;
          return pricing?.prompt === "0" && pricing?.completion === "0";
        })
        .map((model) => {
          const id = String(model.id ?? "").trim();
          const name = String(model.name ?? id).trim();
          return id ? { id, name: name || id } : null;
        })
        .filter((entry): entry is ModelOption => Boolean(entry));
      payload.openrouter = mapped;
    }
  } catch (error) {
    console.error("[api/models] OpenRouter fetch failed:", error);
  }

  try {
    const groqApiKey = process.env.GROQ_API_KEY;
    if (groqApiKey) {
      const response = await fetch("https://api.groq.com/openai/v1/models", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqApiKey}`,
        },
        cache: "no-store",
      });
      if (response.ok) {
        const data = (await response.json()) as { data?: Array<Record<string, unknown>> };
        payload.groq = (data.data ?? [])
          .map((model) => {
            const id = String(model.id ?? "").trim();
            return id ? { id, name: id } : null;
          })
          .filter((entry): entry is ModelOption => Boolean(entry));
      }
    }
  } catch (error) {
    console.error("[api/models] Groq fetch failed:", error);
  }

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=7200",
    },
  });
}
