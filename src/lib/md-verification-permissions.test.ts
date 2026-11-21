/**
 * Tests for the assigned-only action rule
 * (md-verification-permissions). This is the rule the detail page's
 * buttons vs suggest-form switch is built on: the API returns
 * can_act from the same function.
 */
import { canActOnMdItem } from "./md-verification-permissions";

describe("canActOnMdItem", () => {
  it("the assigned verifier can act", () => {
    expect(
      canActOnMdItem({ id: "verifier-1" }, { assigned_to: "verifier-1" }),
    ).toBe(true);
  });

  it("a founder who is not the assignee cannot act", () => {
    expect(
      canActOnMdItem({ id: "founder-1" }, { assigned_to: "verifier-1" }),
    ).toBe(false);
  });

  it("a moderator who is not the assignee cannot act", () => {
    expect(
      canActOnMdItem({ id: "mod-1" }, { assigned_to: "verifier-1" }),
    ).toBe(false);
  });

  it("nobody can act on an unassigned item", () => {
    expect(canActOnMdItem({ id: "founder-1" }, { assigned_to: null })).toBe(
      false,
    );
    expect(canActOnMdItem({ id: "verifier-1" }, { assigned_to: null })).toBe(
      false,
    );
  });

  it("a different verifier cannot act", () => {
    expect(
      canActOnMdItem({ id: "verifier-2" }, { assigned_to: "verifier-1" }),
    ).toBe(false);
  });
});
