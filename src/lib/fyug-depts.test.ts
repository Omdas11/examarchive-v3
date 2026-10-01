import { FYUG_DEPT_CODES } from "./fyug-depts";

describe("FYUG_DEPT_CODES", () => {
  it("covers the 13 Haflong Government College departments (14 codes with the Chemistry alias)", () => {
    expect(FYUG_DEPT_CODES.size).toBe(14);
    for (const code of [
      "PHY", "CHE", "CHM", "ZOO", "BOT", "MAT", "COM",
      "ENG", "ECO", "BEN", "ASM", "PLS", "HIS", "PHI",
    ]) {
      expect(FYUG_DEPT_CODES.has(code as never)).toBe(true);
    }
  });

  it("uses COM for Commerce — HGC has no Computer Science department", () => {
    expect(FYUG_DEPT_CODES.has("COM" as never)).toBe(true);
    expect(FYUG_DEPT_CODES.has("CSC" as never)).toBe(false);
    expect(FYUG_DEPT_CODES.has("CSE" as never)).toBe(false);
  });
});
