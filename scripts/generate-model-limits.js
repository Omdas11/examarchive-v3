#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

async function fetchOpenRouterFreeModels() {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) return [];
    const payload = await response.json();
    const models = Array.isArray(payload?.data) ? payload.data : [];
    return models
      .filter((model) => model?.pricing?.prompt === "0" && model?.pricing?.completion === "0")
      .map((model) => ({
        provider: "OpenRouter",
        id: String(model?.id || "").trim(),
        name: String(model?.name || model?.id || "").trim(),
        context: model?.context_length ?? "N/A",
        promptPricing: model?.pricing?.prompt ?? "N/A",
        completionPricing: model?.pricing?.completion ?? "N/A",
      }))
      .filter((model) => model.id);
  } catch (error) {
    console.error("[generate-model-limits] OpenRouter fetch failed:", error);
    return [];
  }
}

async function fetchGroqModels() {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return [];
    const response = await fetch("https://api.groq.com/openai/v1/models", {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (!response.ok) return [];
    const payload = await response.json();
    const models = Array.isArray(payload?.data) ? payload.data : [];
    return models
      .map((model) => ({
        provider: "Groq",
        id: String(model?.id || "").trim(),
        name: String(model?.id || "").trim(),
        context: model?.context_window ?? model?.context_length ?? "N/A",
        promptPricing: "0",
        completionPricing: "0",
      }))
      .filter((model) => model.id);
  } catch (error) {
    console.error("[generate-model-limits] Groq fetch failed:", error);
    return [];
  }
}

function googleFreeModels() {
  return [
    {
      provider: "Google",
      id: "gemini-3.1-flash-lite-preview",
      name: "Gemini 3.1 Flash Lite Preview",
      context: "N/A",
      promptPricing: "0",
      completionPricing: "0",
    },
    {
      provider: "Google",
      id: "gemini-2.5-flash",
      name: "Gemini 2.5 Flash",
      context: "N/A",
      promptPricing: "0",
      completionPricing: "0",
    },
    {
      provider: "Google",
      id: "gemini-1.5-flash",
      name: "Gemini 1.5 Flash",
      context: "N/A",
      promptPricing: "0",
      completionPricing: "0",
    },
  ];
}

function toMarkdownTable(models) {
  const lines = [
    "# FREE MODELS LIMITS",
    "",
    `Generated at: ${new Date().toISOString()}`,
    "",
    "| Provider | Model ID | Name | Context Window | Prompt Cost | Completion Cost |",
    "|---|---|---|---:|---:|---:|",
  ];
  for (const model of models) {
    lines.push(
      `| ${model.provider} | \`${model.id}\` | ${model.name} | ${model.context} | ${model.promptPricing} | ${model.completionPricing} |`,
    );
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const [openRouter, groq] = await Promise.all([
    fetchOpenRouterFreeModels(),
    fetchGroqModels(),
  ]);
  const combined = [...googleFreeModels(), ...openRouter, ...groq];
  const markdown = toMarkdownTable(combined);
  const outputPath = path.join(process.cwd(), "docs", "FREE_MODELS_LIMITS.md");
  fs.writeFileSync(outputPath, markdown, "utf8");
  console.log(`[generate-model-limits] Wrote ${combined.length} rows to ${outputPath}`);
}

main().catch((error) => {
  console.error("[generate-model-limits] Failed:", error);
  process.exitCode = 1;
});
