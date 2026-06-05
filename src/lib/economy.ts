import { normalizeRole } from "@/lib/roles";

export const CREDIT_SYMBOL = "₹";
export const GENERATION_COST_CREDITS = 1;
export const DEFAULT_CREDITS = 0;
export const ADMIN_PLUS_DEFAULT_CREDITS = 100;

export const SUPPORTED_AI_MODELS = [
  "gemini-3.1-flash-lite-preview",
  "gemma-4-31b-it",
] as const;

export type SupportedAiModel = (typeof SUPPORTED_AI_MODELS)[number];

export function isSupportedAiModel(value: string): value is SupportedAiModel {
  return (SUPPORTED_AI_MODELS as readonly string[]).includes(value);
}

export function getInitialCreditBalance(role: string | null | undefined): number {
  const normalized = normalizeRole(role);
  return normalized === "moderator" || normalized === "founder"
    ? ADMIN_PLUS_DEFAULT_CREDITS
    : DEFAULT_CREDITS;
}
