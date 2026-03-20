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
  speedMultiplier: number; // Relative speed multiplier (1x, 2x, 3x)
  qualityMultiplier: number; // Relative quality multiplier
  costMultiplier: number; // Relative cost multiplier
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
    speedMultiplier: 1,
    qualityMultiplier: 3,
    costMultiplier: 3,
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
    speedMultiplier: 2,
    qualityMultiplier: 2.5,
    costMultiplier: 2,
  },
  "llama-3.3-70b-versatile": {
    id: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B",
    displayName: "Llama 3.3 70B Versatile",
    speed: "medium",
    quality: "high",
    cost: "medium",
    description: "Versatile model with strong reasoning capabilities.",
    speedMultiplier: 2,
    qualityMultiplier: 2.5,
    costMultiplier: 2,
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
    speedMultiplier: 3,
    qualityMultiplier: 1.5,
    costMultiplier: 1,
  },
  "llama-3.1-70b-versatile": {
    id: "llama-3.1-70b-versatile",
    label: "Llama 3.1 70B",
    displayName: "Llama 3.1 70B Versatile",
    speed: "medium",
    quality: "high",
    cost: "medium",
    description: "Reliable choice for detailed academic explanations.",
    speedMultiplier: 2,
    qualityMultiplier: 2.5,
    costMultiplier: 2,
  },
  "mixtral-8x7b-32768": {
    id: "mixtral-8x7b-32768",
    label: "Mixtral 8x7B",
    displayName: "Mixtral 8x7B",
    speed: "fast",
    quality: "high",
    cost: "low",
    description: "Fast mixture-of-experts model with excellent performance.",
    speedMultiplier: 2.5,
    qualityMultiplier: 2,
    costMultiplier: 1,
  },
  "gemma-7b-it": {
    id: "gemma-7b-it",
    label: "Gemma 7B",
    displayName: "Gemma 7B Instruct",
    speed: "fast",
    quality: "medium",
    cost: "low",
    description: "Lightweight Google model for quick responses.",
    speedMultiplier: 2.5,
    qualityMultiplier: 1.5,
    costMultiplier: 1,
  },
  "gemma2-9b-it": {
    id: "gemma2-9b-it",
    label: "Gemma 2 9B",
    displayName: "Gemma 2 9B Instruct",
    speed: "fast",
    quality: "medium",
    cost: "low",
    description: "Updated Gemma model with improved capabilities.",
    speedMultiplier: 2.5,
    qualityMultiplier: 2,
    costMultiplier: 1,
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
    speedMultiplier: 2,
    qualityMultiplier: 2,
    costMultiplier: 2,
  };
}

/**
 * SVG icon component for speed indicator
 */
export function SpeedIcon({ speed, size = 12 }: { speed: "fast" | "medium" | "slow"; size?: number }) {
  if (speed === "fast") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    );
  }
  if (speed === "medium") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="11" rx="3" ry="2"/>
      <path d="M12 13v5"/>
      <path d="M12 3v3"/>
      <path d="M8 11l-3 3"/>
      <path d="M16 11l3 3"/>
    </svg>
  );
}

/**
 * SVG icon component for quality indicator
 */
export function QualityIcon({ quality, size = 12 }: { quality: "high" | "medium" | "basic"; size?: number }) {
  if (quality === "high") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    );
  }
  if (quality === "medium") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
    </svg>
  );
}

/**
 * SVG icon component for cost indicator
 */
export function CostIcon({ cost, size = 12 }: { cost: "low" | "medium" | "high"; size?: number }) {
  const coins = cost === "low" ? 1 : cost === "medium" ? 2 : 3;
  return (
    <svg width={size * coins} height={size} viewBox={`0 0 ${24 * coins} 24`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {Array.from({ length: coins }).map((_, i) => (
        <g key={i} transform={`translate(${i * 24}, 0)`}>
          <circle cx="12" cy="12" r="10"/>
          <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/>
          <path d="M12 18V6"/>
        </g>
      ))}
    </svg>
  );
}
