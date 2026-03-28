export type NoteLength = "concise" | "standard" | "detailed" | "comprehensive" | "exhaustive";

interface NoteLengthPreset {
  label: string;
  description: string;
  targetWords: number;
  maxTokens: number;
  maxPages: number;
}

export const NOTE_LENGTH_PRESETS: Record<NoteLength, NoteLengthPreset> = {
  concise: {
    label: "Concise",
    description: "Quick skim, high-yield pointers",
    targetWords: 450,
    maxTokens: 1700,
    maxPages: 3,
  },
  standard: {
    label: "Standard",
    description: "Balanced depth for a chapter",
    targetWords: 800,
    maxTokens: 2500,
    maxPages: 5,
  },
  detailed: {
    label: "Detailed",
    description: "Extended explanations + examples",
    targetWords: 1400,
    maxTokens: 3800,
    maxPages: 9,
  },
  comprehensive: {
    label: "Comprehensive",
    description: "Deep dive, approx 8-10 pages",
    targetWords: 1900,
    maxTokens: 5000,
    maxPages: 10,
  },
  exhaustive: {
    label: "Exhaustive",
    description: "Maximum depth, approx 12-15 pages",
    targetWords: 2800,
    maxTokens: 7000,
    maxPages: 15,
  },
};

export function normalizeNoteLength(raw: unknown): NoteLength {
  if (typeof raw !== "string") return "standard";
  const value = raw.trim().toLowerCase();
  if (
    value === "concise" ||
    value === "standard" ||
    value === "detailed" ||
    value === "comprehensive" ||
    value === "exhaustive"
  ) {
    return value;
  }
  return "standard";
}

export function getNoteLengthTargets(length: NoteLength): NoteLengthPreset {
  return NOTE_LENGTH_PRESETS[length];
}

export function getNoteLengthOptions(): Array<{ value: NoteLength; label: string; description: string }> {
  return (Object.keys(NOTE_LENGTH_PRESETS) as NoteLength[]).map((value) => {
    const preset = NOTE_LENGTH_PRESETS[value];
    return {
      value,
      label: preset.label,
      description: preset.description,
    };
  });
}
