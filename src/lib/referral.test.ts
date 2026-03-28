import {
  buildReferralPath,
  generateReferralCode,
  isValidReferralCode,
  normalizeReferralCode,
} from "./referral";

describe("referral helpers", () => {
  it("generates a 6-char uppercase alphanumeric code", () => {
    const code = generateReferralCode();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });

  it("normalizes referral codes to uppercase and trims spaces", () => {
    expect(normalizeReferralCode(" ab12c3 ")).toBe("AB12C3");
  });

  it("validates only 6-char uppercase alphanumeric codes", () => {
    expect(isValidReferralCode("AB12C3")).toBe(true);
    expect(isValidReferralCode("AB12C")).toBe(false);
    expect(isValidReferralCode("AB12C#")).toBe(false);
    expect(isValidReferralCode("ab12c3")).toBe(false);
  });

  it("builds a referral path capped to 5 levels", () => {
    expect(buildReferralPath("U1", ["U2", "U3", "U4", "U5", "U6"])).toEqual([
      "U1",
      "U2",
      "U3",
      "U4",
      "U5",
    ]);
  });
});
