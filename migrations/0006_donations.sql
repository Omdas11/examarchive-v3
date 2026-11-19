-- 0006_donations.sql — ExamArchive support pool (Keep ExamArchive Alive)
-- One-time donations toward the domain renewal (₹2,254.75/year, due
-- 2027-01-27). Guests may donate (user_id NULL); logged-in donors get
-- their id recorded. Minimum donation is ₹20 (2,000 paise), enforced in
-- the API route. Razorpay ids are stored as plain TEXT; never store
-- secrets here. Total raised = SUM(amount_paise WHERE status = 'paid').
CREATE TABLE IF NOT EXISTS donations (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  donor_name TEXT,
  amount_paise INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'created', -- created | paid | failed
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_user ON donations(user_id);
CREATE INDEX IF NOT EXISTS idx_donations_order ON donations(razorpay_order_id);
