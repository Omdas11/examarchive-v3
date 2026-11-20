import { normalizeRole } from "@/lib/roles";

export const CREDIT_SYMBOL = "₹";
/** Display name for the virtual token. UI shows the CreditIcon coin instead of a text symbol. */
export const TOKEN_NAME = "tokens";
export const GENERATION_COST_CREDITS = 10;
/**
 * New signups start at 0 credits (2026-11-20): the AI Notes daily free
 * PDF (1 free PDF per day per registered account) replaces the old
 * 100-credit signup grant. Existing users keep their current balance.
 */
export const DEFAULT_CREDITS = 0;
/**
 * Store is closed for now: the store page shows a closed notice and credit
 * balances are hidden (header chip, profile stats). Flip to `false` when
 * credit top-ups reopen — the store, its routes and the balance displays
 * all come back with it. The economy itself (earning/spending tokens)
 * keeps running underneath.
 */
export const STORE_COMING_SOON = true;
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
