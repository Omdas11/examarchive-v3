let dailyLimitOverride: number | null = null;
let rpmLimitOverride: number | null = null;

const DEFAULT_DAILY_LIMIT = Math.max(1, Number(process.env.AI_DAILY_LIMIT ?? 5));
const DEFAULT_RPM_LIMIT = Math.max(1, Number(process.env.AI_RPM_LIMIT ?? 15));

export function getDailyLimit(): number {
  return dailyLimitOverride ?? DEFAULT_DAILY_LIMIT;
}

export function getRpmLimit(): number {
  return rpmLimitOverride ?? DEFAULT_RPM_LIMIT;
}

export function setLimits(opts: { dailyLimit?: number; rpmLimit?: number }) {
  if (typeof opts.dailyLimit === "number" && Number.isFinite(opts.dailyLimit) && opts.dailyLimit > 0) {
    dailyLimitOverride = Math.floor(opts.dailyLimit);
  }
  if (typeof opts.rpmLimit === "number" && Number.isFinite(opts.rpmLimit) && opts.rpmLimit > 0) {
    rpmLimitOverride = Math.floor(opts.rpmLimit);
  }
}

export function getLimitConfig() {
  return {
    dailyLimit: getDailyLimit(),
    rpmLimit: getRpmLimit(),
    defaults: {
      dailyLimit: DEFAULT_DAILY_LIMIT,
      rpmLimit: DEFAULT_RPM_LIMIT,
    },
  };
}
