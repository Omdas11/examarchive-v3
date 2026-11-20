import {
  getInitialCreditBalance,
  isSupportedAiModel,
  SUPPORTED_AI_MODELS,
  CREDIT_SYMBOL,
} from "./economy";

describe("economy", () => {
  describe("getInitialCreditBalance", () => {
    it("returns ADMIN_PLUS_DEFAULT_CREDITS for moderator", () => {
      expect(getInitialCreditBalance("moderator")).toBe(1000);
    });

    it("returns ADMIN_PLUS_DEFAULT_CREDITS for founder", () => {
      expect(getInitialCreditBalance("founder")).toBe(1000);
    });

    it("returns DEFAULT_CREDITS (0) for student", () => {
      // 2026-11-20: new signups start at 0 — the AI Notes daily free PDF
      // replaces the old 100-credit signup grant.
      expect(getInitialCreditBalance("student")).toBe(0);
    });

    it("returns DEFAULT_CREDITS for unknown role", () => {
      expect(getInitialCreditBalance("unknown")).toBe(0);
    });

    it("returns DEFAULT_CREDITS for null/undefined role", () => {
      expect(getInitialCreditBalance(null)).toBe(0);
      expect(getInitialCreditBalance(undefined)).toBe(0);
    });
  });

  describe("isSupportedAiModel", () => {
    it("returns true for supported models", () => {
      SUPPORTED_AI_MODELS.forEach((model) => {
        expect(isSupportedAiModel(model)).toBe(true);
      });
    });

    it("returns false for unsupported models", () => {
      expect(isSupportedAiModel("unsupported-model")).toBe(false);
      expect(isSupportedAiModel("")).toBe(false);
    });
  });

  it("has the correct CREDIT_SYMBOL", () => {
    expect(CREDIT_SYMBOL).toBe("₹");
  });
});
