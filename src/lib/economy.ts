import { normalizeRole } from "@/lib/roles";

export const ELECTRON_SYMBOL = "e";
export const GENERATION_COST_ELECTRONS = 10;
export const DEFAULT_ELECTRONS = 100;
export const ADMIN_PLUS_DEFAULT_ELECTRONS = 1000;
export const REFERRAL_NEW_USER_BONUS_ELECTRONS = 10;
export const REFERRAL_REFERRER_BONUS_ELECTRONS = 20;
export const REFERRAL_SUCCESS_CAP = 10;

export const SUPPORTED_AI_MODELS = [
  "gemini-3.1-flash-lite-preview",
  "gemma-4-31b",
] as const;

export type SupportedAiModel = (typeof SUPPORTED_AI_MODELS)[number];

export function isSupportedAiModel(value: string): value is SupportedAiModel {
  return (SUPPORTED_AI_MODELS as readonly string[]).includes(value);
}

export function getInitialElectronBalance(role: string | null | undefined): number {
  const normalized = normalizeRole(role);
  return normalized === "moderator" || normalized === "founder"
    ? ADMIN_PLUS_DEFAULT_ELECTRONS
    : DEFAULT_ELECTRONS;
}
