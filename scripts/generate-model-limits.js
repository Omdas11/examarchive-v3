#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function googleFreeModels() {
  return [
    {
      provider: "Google",
      id: "gemini-3.1-flash-lite",
      name: "Gemini 3.1 Flash Lite",
      context: "N/A",
      promptPricing: "0",
      completionPricing: "0",
    },
    {
      provider: "Google",
      id: "gemma-4-31b",
      name: "Gemma 4 31B",
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
  const combined = googleFreeModels();
  const markdown = toMarkdownTable(combined);
  const outputPath = path.join(process.cwd(), "docs", "FREE_MODELS_LIMITS.md");
  fs.writeFileSync(outputPath, markdown, "utf8");
  console.log(`[generate-model-limits] Wrote ${combined.length} rows to ${outputPath}`);
}

main().catch((error) => {
  console.error("[generate-model-limits] Failed:", error);
  process.exitCode = 1;
});
