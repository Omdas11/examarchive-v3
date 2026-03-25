/**
 * Model capability data for UI display
 */

export interface ModelCapability {
  id: string;
  label: string;
  displayName: string;
  speed: "fast" | "medium" | "slow";
  quality: "high" | "medium" | "basic";
  cost: "low" | "medium" | "high";
  description: string;
  badge?: string;
}

export const MODEL_CAPABILITIES: Record<string, ModelCapability> = {
  "deepseek/deepseek-r1-distill-llama-8b:free": {
    id: "deepseek/deepseek-r1-distill-llama-8b:free",
    label: "DeepSeek R1 Distill 8B (Free)",
    displayName: "DeepSeek R1 Distill 8B (Free)",
    speed: "fast",
    quality: "medium",
    cost: "low",
    description: "Distilled reasoning model for quick academic answers at free-tier pricing.",
    badge: "Free Tier",
  },
  "deepseek/deepseek-r1:free": {
    id: "deepseek/deepseek-r1:free",
    label: "DeepSeek R1 (Free)",
    displayName: "DeepSeek R1 (Free)",
    speed: "medium",
    quality: "high",
    cost: "low",
    description: "Full DeepSeek reasoning model offered in OpenRouter’s free tier.",
    badge: "Free Tier",
  },
  "meta-llama/llama-3.2-1b-instruct:free": {
    id: "meta-llama/llama-3.2-1b-instruct:free",
    label: "Llama 3.2 1B (Free)",
    displayName: "Llama 3.2 1B (Free)",
    speed: "fast",
    quality: "basic",
    cost: "low",
    description: "Ultra-light Llama 3.2 1B for speedy drafts where latency matters most.",
    badge: "Fastest",
  },
  "meta-llama/llama-3.2-3b-instruct:free": {
    id: "meta-llama/llama-3.2-3b-instruct:free",
    label: "Llama 3.2 3B (Free)",
    displayName: "Llama 3.2 3B (Free)",
    speed: "fast",
    quality: "medium",
    cost: "low",
    description: "Small-footprint Llama 3.2 3B for concise study aids on the free tier.",
  },
  "meta-llama/llama-3.1-8b-instruct:free": {
    id: "meta-llama/llama-3.1-8b-instruct:free",
    label: "Llama 3.1 8B (Free)",
    displayName: "Llama 3.1 8B (Free)",
    speed: "fast",
    quality: "medium",
    cost: "low",
    description: "Fast, lightweight Llama 3.1 8B tuned for instruction-following. Great for quick drafts.",
    badge: "Free Tier",
  },
  "meta-llama/llama-3.1-70b-instruct:free": {
    id: "meta-llama/llama-3.1-70b-instruct:free",
    label: "Llama 3.1 70B (Free)",
    displayName: "Llama 3.1 70B (Free)",
    speed: "medium",
    quality: "high",
    cost: "low",
    description: "High-quality Llama 70B for detailed academic answers while staying on free pricing.",
    badge: "Best Quality",
  },
  "mistralai/mistral-7b-instruct:free": {
    id: "mistralai/mistral-7b-instruct:free",
    label: "Mistral 7B (Free)",
    displayName: "Mistral 7B (Free)",
    speed: "fast",
    quality: "medium",
    cost: "low",
    description: "Low-latency Mistral 7B instruct. Good for concise summaries and quick feedback.",
    badge: "Fastest",
  },
  "openchat/openchat-3.6-8b:free": {
    id: "openchat/openchat-3.6-8b:free",
    label: "OpenChat 3.6 8B (Free)",
    displayName: "OpenChat 3.6 8B (Free)",
    speed: "fast",
    quality: "medium",
    cost: "low",
    description: "Chat-focused 8B model tuned for helpful, concise answers.",
  },
  "nousresearch/hermes-3-llama-3.1-8b:free": {
    id: "nousresearch/hermes-3-llama-3.1-8b:free",
    label: "Hermes 3 Llama 3.1 8B (Free)",
    displayName: "Hermes 3 Llama 3.1 8B (Free)",
    speed: "fast",
    quality: "medium",
    cost: "low",
    description: "Hermes-tuned Llama 3.1 8B for instruction following on the free tier.",
  },
  "qwen/qwen-2.5-1.5b-instruct:free": {
    id: "qwen/qwen-2.5-1.5b-instruct:free",
    label: "Qwen 2.5 1.5B (Free)",
    displayName: "Qwen 2.5 1.5B (Free)",
    speed: "fast",
    quality: "basic",
    cost: "low",
    description: "Tiny Qwen 2.5 1.5B for ultra-fast responses where brevity is fine.",
    badge: "Fastest",
  },
  "qwen/qwen-2.5-3b-instruct:free": {
    id: "qwen/qwen-2.5-3b-instruct:free",
    label: "Qwen 2.5 3B (Free)",
    displayName: "Qwen 2.5 3B (Free)",
    speed: "fast",
    quality: "medium",
    cost: "low",
    description: "Lightweight Qwen 3B for quick notes and summaries on free tier.",
  },
  "qwen/qwen-2.5-7b-instruct:free": {
    id: "qwen/qwen-2.5-7b-instruct:free",
    label: "Qwen 2.5 7B (Free)",
    displayName: "Qwen 2.5 7B (Free)",
    speed: "fast",
    quality: "medium",
    cost: "low",
    description: "Balanced Qwen 2.5 7B for quick academic explanations at free-tier pricing.",
  },
  "qwen/qwen-2.5-8b-instruct:free": {
    id: "qwen/qwen-2.5-8b-instruct:free",
    label: "Qwen 2.5 8B (Free)",
    displayName: "Qwen 2.5 8B (Free)",
    speed: "fast",
    quality: "medium",
    cost: "low",
    description: "Instruction-tuned Qwen 8B for responsive study notes.",
  },
  "qwen/qwen-2.5-14b-instruct:free": {
    id: "qwen/qwen-2.5-14b-instruct:free",
    label: "Qwen 2.5 14B (Free)",
    displayName: "Qwen 2.5 14B (Free)",
    speed: "medium",
    quality: "high",
    cost: "low",
    description: "Balanced reasoning and creativity with Qwen 14B while keeping both token costs at $0.",
    badge: "Balanced",
  },
  "qwen/qwen-2.5-32b-instruct:free": {
    id: "qwen/qwen-2.5-32b-instruct:free",
    label: "Qwen 2.5 32B (Free)",
    displayName: "Qwen 2.5 32B (Free)",
    speed: "medium",
    quality: "high",
    cost: "low",
    description: "Large Qwen 32B for higher-quality notes with $0/$0 pricing.",
  },
  "qwen/qwen-2.5-72b-instruct:free": {
    id: "qwen/qwen-2.5-72b-instruct:free",
    label: "Qwen 2.5 72B (Free)",
    displayName: "Qwen 2.5 72B (Free)",
    speed: "slow",
    quality: "high",
    cost: "low",
    description: "Top-tier Qwen 72B for the best quality in the free model lineup.",
    badge: "Best Quality",
  },
  "qwen/qwen-2.5-coder-7b-instruct:free": {
    id: "qwen/qwen-2.5-coder-7b-instruct:free",
    label: "Qwen 2.5 Coder 7B (Free)",
    displayName: "Qwen 2.5 Coder 7B (Free)",
    speed: "fast",
    quality: "medium",
    cost: "low",
    description: "Code-focused Qwen 7B variant for lightweight coding explanations.",
  },
  "qwen/qwen-2.5-coder-14b-instruct:free": {
    id: "qwen/qwen-2.5-coder-14b-instruct:free",
    label: "Qwen 2.5 Coder 14B (Free)",
    displayName: "Qwen 2.5 Coder 14B (Free)",
    speed: "medium",
    quality: "high",
    cost: "low",
    description: "Coder-tuned 14B for more detailed programming assistance on free tier.",
  },
  "qwen/qwen-2.5-coder-32b-instruct:free": {
    id: "qwen/qwen-2.5-coder-32b-instruct:free",
    label: "Qwen 2.5 Coder 32B (Free)",
    displayName: "Qwen 2.5 Coder 32B (Free)",
    speed: "medium",
    quality: "high",
    cost: "low",
    description: "Large coder-tuned Qwen for complex code-focused study material.",
  },
  "qwen/qwen-2.5-math-1.5b-instruct:free": {
    id: "qwen/qwen-2.5-math-1.5b-instruct:free",
    label: "Qwen 2.5 Math 1.5B (Free)",
    displayName: "Qwen 2.5 Math 1.5B (Free)",
    speed: "fast",
    quality: "basic",
    cost: "low",
    description: "Math-tuned Qwen 1.5B for ultra-fast, light derivations.",
  },
  "qwen/qwen-2.5-math-7b-instruct:free": {
    id: "qwen/qwen-2.5-math-7b-instruct:free",
    label: "Qwen 2.5 Math 7B (Free)",
    displayName: "Qwen 2.5 Math 7B (Free)",
    speed: "fast",
    quality: "medium",
    cost: "low",
    description: "Math-tuned Qwen 7B for quick derivations and problem steps on free tier.",
  },
  "qwen/qwen-2.5-math-72b-instruct:free": {
    id: "qwen/qwen-2.5-math-72b-instruct:free",
    label: "Qwen 2.5 Math 72B (Free)",
    displayName: "Qwen 2.5 Math 72B (Free)",
    speed: "slow",
    quality: "high",
    cost: "low",
    description: "High-capacity math specialist for detailed step-by-step derivations.",
  },
  "google/gemma-2-9b-it:free": {
    id: "google/gemma-2-9b-it:free",
    label: "Gemma 2 9B IT (Free)",
    displayName: "Gemma 2 9B IT (Free)",
    speed: "medium",
    quality: "high",
    cost: "low",
    description: "Google Gemma 2 9B instruction-tuned model in the free tier.",
  },
  "google/gemma-2-2b-it:free": {
    id: "google/gemma-2-2b-it:free",
    label: "Gemma 2 2B IT (Free)",
    displayName: "Gemma 2 2B IT (Free)",
    speed: "fast",
    quality: "basic",
    cost: "low",
    description: "Tiny Gemma 2B instruction model for ultra-fast responses.",
  },
};

/**
 * Get capability info for a model ID
 */
export function getModelCapability(modelId: string): ModelCapability {
  return MODEL_CAPABILITIES[modelId] || {
    id: modelId,
    label: modelId,
    displayName: humanizeModelId(modelId),
    speed: "medium",
    quality: "medium",
    cost: "medium",
    description: "Standard AI model",
  };
}

function humanizeModelId(modelId: string): string {
  return modelId
    .replace(/[:/_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

/**
 * Get speed indicator emoji/icon
 */
export function getSpeedIcon(speed: "fast" | "medium" | "slow"): string {
  switch (speed) {
    case "fast":
      return "⚡";
    case "medium":
      return "⏱️";
    case "slow":
      return "🐢";
  }
}

/**
 * Get quality indicator emoji/icon
 */
export function getQualityIcon(quality: "high" | "medium" | "basic"): string {
  switch (quality) {
    case "high":
      return "⭐";
    case "medium":
      return "✓";
    case "basic":
      return "○";
  }
}

/**
 * Get cost indicator emoji/icon
 */
export function getCostIcon(cost: "low" | "medium" | "high"): string {
  switch (cost) {
    case "low":
      return "💰";
    case "medium":
      return "💰💰";
    case "high":
      return "💰💰💰";
  }
}
