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
  "openai/gpt-oss-120b": {
    id: "openai/gpt-oss-120b",
    label: "GPT OSS 120B",
    displayName: "GPT-OSS 120B",
    speed: "slow",
    quality: "high",
    cost: "high",
    description: "Largest open-source GPT model. Best quality for complex topics.",
    badge: "Best Quality",
  },
  "openai/gpt-oss-20b": {
    id: "openai/gpt-oss-20b",
    label: "GPT OSS 20B",
    displayName: "GPT-OSS 20B",
    speed: "medium",
    quality: "high",
    cost: "medium",
    description: "Balanced performance and quality for academic content.",
    badge: "Recommended",
  },
  "llama-3.3-70b-versatile": {
    id: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B",
    displayName: "Llama 3.3 70B Versatile",
    speed: "medium",
    quality: "high",
    cost: "medium",
    description: "Versatile model with strong reasoning capabilities.",
  },
  "llama-3.1-8b-instant": {
    id: "llama-3.1-8b-instant",
    label: "Llama 3.1 8B",
    displayName: "Llama 3.1 8B Instant",
    speed: "fast",
    quality: "medium",
    cost: "low",
    description: "Fast generation for quick study notes and summaries.",
    badge: "Fastest",
  },
  "llama-3.1-70b-versatile": {
    id: "llama-3.1-70b-versatile",
    label: "Llama 3.1 70B",
    displayName: "Llama 3.1 70B Versatile",
    speed: "medium",
    quality: "high",
    cost: "medium",
    description: "Reliable choice for detailed academic explanations.",
  },
};

/**
 * Get capability info for a model ID
 */
export function getModelCapability(modelId: string): ModelCapability {
  return MODEL_CAPABILITIES[modelId] || {
    id: modelId,
    label: modelId,
    displayName: modelId,
    speed: "medium",
    quality: "medium",
    cost: "medium",
    description: "Standard AI model",
  };
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
