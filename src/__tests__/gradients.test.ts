import { makeAccentGradient } from "@/lib/gradients";

describe("gradients", () => {
  it("creates a gradient using provided primary and secondary colors", () => {
    const result = makeAccentGradient("#ff0000", "#00ff00");
    expect(result).toBe("linear-gradient(90deg, #ff0000 0%, #00ff00 60%, var(--color-primary) 100%)");
  });

  it("falls back to var(--color-primary) if secondary is not provided", () => {
    const result = makeAccentGradient("#ff0000");
    expect(result).toBe("linear-gradient(90deg, #ff0000 0%, var(--color-primary) 60%, var(--color-primary) 100%)");
  });
});
