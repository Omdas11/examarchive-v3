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

    it("returns DEFAULT_CREDITS for student", () => {
      expect(getInitialCreditBalance("student")).toBe(100);
    });

    it("returns DEFAULT_CREDITS for unknown role", () => {
      expect(getInitialCreditBalance("unknown")).toBe(100);
    });

    it("returns DEFAULT_CREDITS for null/undefined role", () => {
      expect(getInitialCreditBalance(null)).toBe(100);
      expect(getInitialCreditBalance(undefined)).toBe(100);
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
