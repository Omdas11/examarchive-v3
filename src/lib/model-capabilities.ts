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
