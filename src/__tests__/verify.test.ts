/**
 * Tests for src/lib/verify.ts reward rules (pure, no mocking needed).
 */
import { verifyAwards } from "@/lib/verify";

describe("verifyAwards", () => {
  it("pays full rewards for a correct check under the caps", () => {
    expect(verifyAwards({ verdict: "correct", xpToday: 0, creditsToday: 0 })).toEqual({
      xp: 10,
      credits: 1,
    });
  });

  it("pays XP only for a flagged report", () => {
    expect(verifyAwards({ verdict: "flagged", xpToday: 0, creditsToday: 0 })).toEqual({
      xp: 10,
      credits: 0,
    });
  });

  it("caps XP at the daily limit with a partial award", () => {
    expect(verifyAwards({ verdict: "correct", xpToday: 95, creditsToday: 0 })).toEqual({
      xp: 5,
      credits: 1,
    });
  });

  it("pays nothing once the daily caps are reached", () => {
    expect(verifyAwards({ verdict: "correct", xpToday: 100, creditsToday: 10 })).toEqual({
      xp: 0,
      credits: 0,
    });
    expect(verifyAwards({ verdict: "flagged", xpToday: 100, creditsToday: 0 })).toEqual({
      xp: 0,
      credits: 0,
    });
  });

  it("caps credits independently of XP", () => {
    expect(verifyAwards({ verdict: "correct", xpToday: 0, creditsToday: 10 })).toEqual({
      xp: 10,
      credits: 0,
    });
  });
});
