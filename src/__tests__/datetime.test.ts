import { formatIstTime, formatIstDateTime } from "@/lib/datetime";

describe("datetime", () => {
  const mockDate = new Date("2024-05-15T12:30:45Z"); // UTC time

  describe("formatIstTime", () => {
    it("formats a Date object to IST time", () => {
      const result = formatIstTime(mockDate);
      // 12:30:45 UTC is 18:00:45 IST
      expect(result).toMatch(/6:00:45\s*(pm|PM)/i);
    });

    it("formats a timestamp to IST time", () => {
      const result = formatIstTime(mockDate.getTime());
      expect(result).toMatch(/6:00:45\s*(pm|PM)/i);
    });

    it("handles undefined by defaulting to current time", () => {
      const result = formatIstTime(undefined);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("formatIstDateTime", () => {
    it("formats a Date object to IST date and time", () => {
      const result = formatIstDateTime(mockDate);
      expect(result).toMatch(/15\s*May\s*2024/i);
      expect(result).toMatch(/6:00:45\s*(pm|PM)/i);
    });

    it("handles invalid dates by defaulting to current time", () => {
      const result = formatIstDateTime(NaN);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
