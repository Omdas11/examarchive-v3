import {
  getCreditPackByCode,
  getFirstTimerAmountInPaise,
  CREDIT_PACKS,
  getRazorpayPlanId,
  getRazorpayClient,
} from "./payments";
import Razorpay from "razorpay";

jest.mock("razorpay");

describe("payments", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("getCreditPackByCode", () => {
    it("returns the correct pack for a valid code", () => {
      const pack = CREDIT_PACKS[0];
      expect(getCreditPackByCode(pack.code)).toEqual(pack);
    });

    it("returns undefined for an invalid code", () => {
      expect(getCreditPackByCode("invalid_code")).toBeUndefined();
    });
  });

  describe("getFirstTimerAmountInPaise", () => {
    it("returns the amountInPaise unchanged (current implementation)", () => {
      const pack = { amountInPaise: 1000 };
      expect(getFirstTimerAmountInPaise(pack)).toBe(1000);
    });
  });

  describe("getRazorpayPlanId", () => {
    it("returns correctly mapped plan IDs from environment variables", () => {
      process.env.RAZORPAY_PLAN_ID_WEEKLY_PASS = "plan_weekly";
      process.env.RAZORPAY_PLAN_ID_MONTHLY_PASS = "plan_monthly";
      process.env.RAZORPAY_PLAN_ID_SUPPORTER = "plan_supporter";

      expect(getRazorpayPlanId("weekly_pass")).toBe("plan_weekly");
      expect(getRazorpayPlanId("monthly_pass")).toBe("plan_monthly");
      expect(getRazorpayPlanId("supporter")).toBe("plan_supporter");
    });

    it("returns null when environment variable is not set", () => {
      delete process.env.RAZORPAY_PLAN_ID_WEEKLY_PASS;
      expect(getRazorpayPlanId("weekly_pass")).toBeNull();
    });
  });

  describe("getRazorpayClient", () => {
    it("instantiates Razorpay when keys are present", () => {
      process.env.RAZORPAY_KEY_ID = "key_id";
      process.env.RAZORPAY_KEY_SECRET = "key_secret";

      const client = getRazorpayClient();
      expect(client).toBeDefined();
      expect(Razorpay).toHaveBeenCalledWith({
        key_id: "key_id",
        key_secret: "key_secret",
      });
    });

    it("throws error when keys are missing", () => {
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;

      expect(() => getRazorpayClient()).toThrow("Razorpay is not configured");
    });
  });
});
