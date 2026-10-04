import { normalizeRole } from "@/lib/roles";

export const CREDIT_SYMBOL = "₹";
/** Display name for the virtual token. UI shows the CreditIcon coin instead of a text symbol. */
export const TOKEN_NAME = "tokens";
export const GENERATION_COST_CREDITS = 10;
/** Cost of a cleaned print-perfect question-paper PDF (one-time batch cost, cached). */
export const CLEAN_PAPER_COST_CREDITS = 2;
export const DEFAULT_CREDITS = 100;
export const ADMIN_PLUS_DEFAULT_CREDITS = 1000;

export const SUPPORTED_AI_MODELS = [
  "gemini-3.5-flash-lite",
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
