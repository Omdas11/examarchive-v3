export function normalizeGeminiModelOverride(value: string): { model?: string; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { error: "Model override cannot be empty." };
  }
  const prefixedModel = trimmed.match(/^([a-z0-9_-]+):(.*)$/i);
  if (prefixedModel) {
    const [, prefix, rawModel] = prefixedModel;
    if (prefix.toLowerCase() !== "gemini") {
      return { error: "Only Gemini model overrides are supported (use 'gemini:<model>')." };
    }
    const model = rawModel.trim();
    return model
      ? { model }
      : { error: "Gemini model override is missing a model id after 'gemini:'." };
  }

  return { model: trimmed };
}
