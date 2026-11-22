import { mergeVerifiedCounts } from "./verified-counts";

describe("mergeVerifiedCounts", () => {
  it("gives users with rows their count and users without rows 0", () => {
    const counts = mergeVerifiedCounts(["a", "b", "c"], [
      { user_id: "a", n: 3 },
      { user_id: "c", n: 1 },
    ]);
    expect(counts.get("a")).toBe(3);
    expect(counts.get("b")).toBe(0);
    expect(counts.get("c")).toBe(1);
  });

  it("ignores rows for user ids not on the page", () => {
    const counts = mergeVerifiedCounts(["a"], [
      { user_id: "a", n: 2 },
      { user_id: "ghost", n: 99 },
    ]);
    expect(counts.get("a")).toBe(2);
    expect(counts.has("ghost")).toBe(false);
    expect(counts.size).toBe(1);
  });

  it("returns all zeros when the grouped query returns no rows", () => {
    const counts = mergeVerifiedCounts(["a", "b"], []);
    expect(counts.get("a")).toBe(0);
    expect(counts.get("b")).toBe(0);
  });

  it("ignores rows with an empty user id", () => {
    const counts = mergeVerifiedCounts(["a"], [
      { user_id: "", n: 5 },
      { user_id: "a", n: 4 },
    ]);
    expect(counts.get("a")).toBe(4);
    expect(counts.has("")).toBe(false);
  });
});
