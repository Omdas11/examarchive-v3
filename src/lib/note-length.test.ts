import { getNoteLengthTargets, normalizeNoteLength } from "./note-length";

describe("note-length helpers", () => {
  it("normalizes unknown values to standard", () => {
    expect(normalizeNoteLength(undefined)).toBe("standard");
    expect(normalizeNoteLength("")).toBe("standard");
    expect(normalizeNoteLength("invalid")).toBe("standard");
    expect(normalizeNoteLength("comprehensive")).toBe("comprehensive");
    expect(normalizeNoteLength("exhaustive")).toBe("exhaustive");
  });

  it("returns presets for valid lengths", () => {
    const concise = getNoteLengthTargets("concise");
    const standard = getNoteLengthTargets("standard");
    const detailed = getNoteLengthTargets("detailed");
    const comprehensive = getNoteLengthTargets("comprehensive");
    const exhaustive = getNoteLengthTargets("exhaustive");

    expect(concise.maxPages).toBeLessThanOrEqual(detailed.maxPages);
    expect(concise.targetWords).toBeLessThan(standard.targetWords);
    expect(detailed.targetWords).toBeGreaterThan(standard.targetWords);
    expect(comprehensive.maxPages).toBeGreaterThanOrEqual(detailed.maxPages);
    expect(exhaustive.maxPages).toBeGreaterThan(comprehensive.maxPages);
  });
});
