import { toRoman, cn } from "@/lib/utils";

describe("utils", () => {
  describe("toRoman", () => {
    it("converts positive integers to Roman numerals", () => {
      expect(toRoman(1)).toBe("I");
      expect(toRoman(4)).toBe("IV");
      expect(toRoman(5)).toBe("V");
      expect(toRoman(9)).toBe("IX");
      expect(toRoman(10)).toBe("X");
      expect(toRoman(14)).toBe("XIV");
    });

    it("returns empty string for invalid inputs", () => {
      expect(toRoman(0)).toBe("");
      expect(toRoman(-5)).toBe("");
      expect(toRoman(NaN)).toBe("");
      expect(toRoman(Infinity)).toBe("");
    });
  });

  describe("cn", () => {
    it("joins valid class names", () => {
      expect(cn("foo", "bar")).toBe("foo bar");
    });

    it("ignores falsy values", () => {
      expect(cn("foo", false, null, undefined, "", "bar")).toBe("foo bar");
    });
  });
});
