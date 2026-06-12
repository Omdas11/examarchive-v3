/**
 * Tests for src/lib/roles.ts
 *
 * These are pure utility functions with no external dependencies,
 * so they can be tested directly without mocking.
 */
import {
  normalizeRole,
  roleLabel,
  hasRole,
  isAdmin,
  isModerator,
  isFounder,
  hasTier,
  isValidCustomRole,
  isValidTier,
  isValidUserRole,
  ROLE_XO_THRESHOLDS,
} from "@/lib/roles";

describe("normalizeRole", () => {
  it("returns 'student' for null/undefined/empty", () => {
    expect(normalizeRole(null)).toBe("student");
    expect(normalizeRole(undefined)).toBe("student");
    expect(normalizeRole("")).toBe("student");
  });

  it("returns canonical roles unchanged", () => {
    expect(normalizeRole("student")).toBe("student");
    expect(normalizeRole("contributor")).toBe("contributor");
    expect(normalizeRole("specialist")).toBe("specialist");
    expect(normalizeRole("subject_admin")).toBe("subject_admin");
    expect(normalizeRole("moderator")).toBe("moderator");
    expect(normalizeRole("founder")).toBe("founder");
  });

  it("maps legacy roles correctly", () => {
    expect(normalizeRole("guest")).toBe("student");
    expect(normalizeRole("viewer")).toBe("student");
    expect(normalizeRole("visitor")).toBe("student");
    expect(normalizeRole("explorer")).toBe("student");
    expect(normalizeRole("curator")).toBe("specialist");
    expect(normalizeRole("verified_contributor")).toBe("specialist");
    expect(normalizeRole("admin")).toBe("moderator");
    expect(normalizeRole("maintainer")).toBe("moderator");
  });

  it("returns 'student' for unknown roles", () => {
    expect(normalizeRole("nonexistent_role")).toBe("student");
  });
});

describe("roleLabel", () => {
  it("returns human-readable labels for canonical roles", () => {
    expect(roleLabel("student")).toBe("Student");
    expect(roleLabel("contributor")).toBe("Contributor");
    expect(roleLabel("specialist")).toBe("Specialist");
    expect(roleLabel("subject_admin")).toBe("Subject Administrator");
    expect(roleLabel("moderator")).toBe("Moderator");
    expect(roleLabel("founder")).toBe("Founder");
  });

  it("normalizes legacy roles before labelling", () => {
    expect(roleLabel("admin")).toBe("Moderator");
    expect(roleLabel("guest")).toBe("Student");
  });

  it("handles null/undefined", () => {
    expect(roleLabel(null)).toBe("Student");
    expect(roleLabel(undefined)).toBe("Student");
  });
});

describe("hasRole", () => {
  it("returns true when user role meets the required role", () => {
    expect(hasRole("founder", "student")).toBe(true);
    expect(hasRole("moderator", "contributor")).toBe(true);
    expect(hasRole("student", "student")).toBe(true);
  });

  it("returns false when user role is below the required role", () => {
    expect(hasRole("student", "moderator")).toBe(false);
    expect(hasRole("contributor", "specialist")).toBe(false);
  });
});

describe("isAdmin / isModerator / isFounder", () => {
  it("isAdmin returns true for moderator and above", () => {
    expect(isAdmin("moderator")).toBe(true);
    expect(isAdmin("founder")).toBe(true);
    expect(isAdmin("student")).toBe(false);
  });

  it("isModerator returns true for moderator and above", () => {
    expect(isModerator("moderator")).toBe(true);
    expect(isModerator("founder")).toBe(true);
    expect(isModerator("contributor")).toBe(false);
  });

  it("isFounder returns true only for 'founder'", () => {
    expect(isFounder("founder")).toBe(true);
    expect(isFounder("moderator")).toBe(false);
    expect(isFounder("student")).toBe(false);
  });
});

describe("hasTier", () => {
  it("returns true when user tier meets required tier", () => {
    expect(hasTier("diamond", "bronze")).toBe(true);
    expect(hasTier("gold", "gold")).toBe(true);
    expect(hasTier("bronze", "bronze")).toBe(true);
  });

  it("returns false when user tier is below required", () => {
    expect(hasTier("bronze", "gold")).toBe(false);
    expect(hasTier("silver", "platinum")).toBe(false);
  });
});

describe("isValidCustomRole", () => {
  it("accepts null as valid", () => {
    expect(isValidCustomRole(null)).toBe(true);
  });

  it("accepts valid custom roles", () => {
    expect(isValidCustomRole("supporter")).toBe(true);
    expect(isValidCustomRole("mentor")).toBe(true);
    expect(isValidCustomRole("archivist")).toBe(true);
    expect(isValidCustomRole("ambassador")).toBe(true);
  });

  it("rejects invalid values", () => {
    expect(isValidCustomRole("student")).toBe(false);
    expect(isValidCustomRole(123)).toBe(false);
    expect(isValidCustomRole(undefined)).toBe(false);
  });
});

describe("isValidTier", () => {
  it("accepts valid tiers", () => {
    expect(isValidTier("bronze")).toBe(true);
    expect(isValidTier("diamond")).toBe(true);
  });

  it("rejects invalid values", () => {
    expect(isValidTier("mythical")).toBe(false);
    expect(isValidTier(42)).toBe(false);
  });
});

describe("isValidUserRole", () => {
  it("accepts valid user roles including legacy", () => {
    expect(isValidUserRole("student")).toBe(true);
    expect(isValidUserRole("founder")).toBe(true);
    expect(isValidUserRole("guest")).toBe(true);
    expect(isValidUserRole("admin")).toBe(true);
  });

  it("rejects invalid values", () => {
    expect(isValidUserRole("superuser")).toBe(false);
    expect(isValidUserRole(null)).toBe(false);
    expect(isValidUserRole(42)).toBe(false);
  });
});

describe("ROLE_XO_THRESHOLDS", () => {
  it("has thresholds for canonical roles", () => {
    expect(ROLE_XO_THRESHOLDS.student).toBe(0);
    expect(ROLE_XO_THRESHOLDS.contributor).toBe(30);
    expect(ROLE_XO_THRESHOLDS.specialist).toBe(150);
    expect(ROLE_XO_THRESHOLDS.subject_admin).toBe(400);
  });
});
