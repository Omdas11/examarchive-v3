-- 0004_commerce.sql — ExamArchive Appwrite -> Cloudflare D1, Phase 3
-- Commerce / access tables: purchases, user_passes, night_access_codes,
-- night_access_blocks. See 0001_init.sql header for shared conventions.

-- purchases: Appwrite `purchases` (0 rows, 7 attributes).
-- Razorpay ids are stored as plain TEXT; never store secrets here.
CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  amount INTEGER,
  currency TEXT,
  status TEXT,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,     -- Appwrite created_at (was datetime)
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_order ON purchases(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);

-- user_passes: Appwrite `user_passes` (0 rows, 11 attributes).
-- Supporter pass state (Rs 49/month pass exists in code; Rs 99 undecided).
CREATE TABLE IF NOT EXISTS user_passes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  pass_id TEXT,
  mode TEXT,
  status TEXT,
  daily_credits INTEGER,
  days_remaining INTEGER,
  last_daily_claim_at INTEGER,     -- epoch ms (was datetime)
  activated_at INTEGER,            -- epoch ms (was datetime)
  expires_at INTEGER,              -- epoch ms (was datetime)
  razorpay_subscription_id TEXT,
  razorpay_order_id TEXT,
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_user_passes_user ON user_passes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_passes_status ON user_passes(status);
CREATE INDEX IF NOT EXISTS idx_user_passes_expires ON user_passes(expires_at);

-- night_access_codes / night_access_blocks: Appwrite collections
-- (0 rows each). DEPRECATED: the 10pm-6am nightly closure they served was
-- REMOVED permanently 2026-11-14 and the site is now open 24/7. Tables are
-- created only so the Phase 4 import has a faithful target; do not build
-- new code on them. Phase 6 should confirm deletion with the owner.
CREATE TABLE IF NOT EXISTS night_access_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  note TEXT,
  expires_at INTEGER,              -- epoch ms (Appwrite: expiresAt datetime)
  max_uses INTEGER,
  used_count INTEGER,
  created_by TEXT,
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,     -- Appwrite createdAt (was datetime)
  updated_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_night_codes_code ON night_access_codes(code);
CREATE INDEX IF NOT EXISTS idx_night_codes_expires ON night_access_codes(expires_at);

CREATE TABLE IF NOT EXISTS night_access_blocks (
  id TEXT PRIMARY KEY,
  ip TEXT NOT NULL,
  failed_attempts INTEGER,
  blocked INTEGER NOT NULL DEFAULT 0,
  blocked_at INTEGER,              -- epoch ms (was datetime)
  last_attempt_at INTEGER,         -- epoch ms (was datetime)
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_night_blocks_ip ON night_access_blocks(ip);
CREATE INDEX IF NOT EXISTS idx_night_blocks_blocked ON night_access_blocks(blocked);
