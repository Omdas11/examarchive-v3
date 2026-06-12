/* eslint-disable @typescript-eslint/no-require-imports */

describe("ai-limits", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("returns default values when no overrides are set", () => {
    const limits = require("@/lib/ai-limits");
    expect(limits.getDailyLimit()).toBe(5); // Default
    expect(limits.getRpmLimit()).toBe(15); // Default
  });

  it("uses process.env if available", () => {
    process.env.AI_DAILY_LIMIT = "10";
    process.env.AI_RPM_LIMIT = "30";
    
    // Need to re-require to pick up env vars on module initialization
    const limits = require("@/lib/ai-limits");
    expect(limits.getDailyLimit()).toBe(10);
    expect(limits.getRpmLimit()).toBe(30);
  });

  it("overrides values correctly via setLimits", () => {
    const limits = require("@/lib/ai-limits");
    limits.setLimits({ dailyLimit: 20, rpmLimit: 40 });
    
    expect(limits.getDailyLimit()).toBe(20);
    expect(limits.getRpmLimit()).toBe(40);
  });

  it("ignores invalid overrides in setLimits", () => {
    const limits = require("@/lib/ai-limits");
    limits.setLimits({ dailyLimit: 20, rpmLimit: 40 }); // valid setup
    
    // Invalid values
    limits.setLimits({ dailyLimit: -5, rpmLimit: NaN });
    
    // Should retain previous valid values
    expect(limits.getDailyLimit()).toBe(20);
    expect(limits.getRpmLimit()).toBe(40);
  });

  it("returns full config from getLimitConfig", () => {
    const limits = require("@/lib/ai-limits");
    limits.setLimits({ dailyLimit: 25, rpmLimit: 50 });
    
    const config = limits.getLimitConfig();
    expect(config.dailyLimit).toBe(25);
    expect(config.rpmLimit).toBe(50);
    expect(config.defaults).toBeDefined();
  });
});
