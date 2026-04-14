const REFERRAL_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const REFERRAL_CODE_LENGTH = 6;

export function isValidReferralCode(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(code);
}

export function normalizeReferralCode(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase();
}

export function generateReferralCode(): string {
  let code = "";
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i += 1) {
    const index = Math.floor(Math.random() * REFERRAL_CODE_ALPHABET.length);
    code += REFERRAL_CODE_ALPHABET[index];
  }
  return code;
}

export function buildReferralPath(directReferrerId: string): string[] {
  return [directReferrerId];
}
