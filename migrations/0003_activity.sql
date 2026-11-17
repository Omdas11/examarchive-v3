-- 0003_activity.sql — ExamArchive Appwrite -> Cloudflare D1, Phase 3
-- Activity / user-facing tables: user_activity (3 rows), activity_logs,
-- uploads, achievements, user_badges, user_quotas, feedback,
-- content_verifications, site_metrics (1 row), visit_logs (1,147 rows).
-- See 0001_init.sql header for shared conventions.

-- user_activity: Appwrite `user_activity` (3 rows, 6 attributes).
-- Carries the second of only two Appwrite indexes (idx_user_action on
-- user_id + action), preserved here.
CREATE TABLE IF NOT EXISTS user_activity (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  scope TEXT NOT NULL,
  title TEXT NOT NULL,
  href TEXT NOT NULL,
  paper_ref TEXT NOT NULL,
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_user_activity_user_action ON user_activity(user_id, action);
CREATE INDEX IF NOT EXISTS idx_user_activity_paper_ref ON user_activity(paper_ref);

-- activity_logs: Appwrite `activity_logs` (0 rows, 8 attributes).
-- meta stores JSON as TEXT; keep as TEXT, parse in code.
CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  target_user_id TEXT,
  target_paper_id TEXT,
  admin_id TEXT,
  admin_email TEXT,
  details TEXT,
  user_id TEXT NOT NULL,
  meta TEXT NOT NULL,              -- JSON-in-a-string; keep TEXT, parse in code
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);

-- uploads: Appwrite `uploads` (0 rows, 4 attributes).
CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  status TEXT NOT NULL,
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_uploads_user ON uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_uploads_status ON uploads(status);

-- achievements: Appwrite `achievements` (0 rows, 5 attributes).
CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  earned_at INTEGER NOT NULL,      -- epoch ms (was datetime)
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_achievements_user_slug ON achievements(user_id, slug);

-- user_badges: Appwrite `user_badges` (0 rows, 3 attributes).
CREATE TABLE IF NOT EXISTS user_badges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  badge_slug TEXT,
  earned_at INTEGER,               -- epoch ms (was datetime)
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_badges_user_slug ON user_badges(user_id, badge_slug);

-- user_quotas: Appwrite `User_Quotas` (0 rows, 4 attributes).
-- One row per user: enforced with a UNIQUE index on user_id.
-- last_generation_date is TEXT 'YYYY-MM-DD' in Appwrite; kept as TEXT.
CREATE TABLE IF NOT EXISTS user_quotas (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  notes_generated_today INTEGER NOT NULL DEFAULT 0,
  papers_solved_today INTEGER NOT NULL DEFAULT 0,
  last_generation_date TEXT NOT NULL,
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_quotas_user ON user_quotas(user_id);

-- feedback: Appwrite `feedback` (0 rows, 4 attributes).
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  university TEXT,
  text TEXT NOT NULL,
  approved INTEGER NOT NULL DEFAULT 0,
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_feedback_approved ON feedback(approved);

-- content_verifications: Appwrite `content_verifications` (0 rows, 8 attributes).
-- Gamification rewards (xp/credits) live here; the app awards them, D1
-- just stores the verdict row.
CREATE TABLE IF NOT EXISTS content_verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  content_type TEXT,
  content_id TEXT,
  verdict TEXT,
  correction TEXT,
  xp_awarded INTEGER,
  credits_awarded INTEGER,
  status TEXT,
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_cv_user ON content_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_cv_content ON content_verifications(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_cv_status ON content_verifications(status);

-- site_metrics: Appwrite `site_metrics` (1 row, 2 attributes).
-- Singleton row: Phase 4 inserts it with id = 'singleton'.
-- visitor_count is a write-on-read counter: do NOT increment it per visit
-- (MD Section 2). Aggregate visits elsewhere and update this row rarely.
CREATE TABLE IF NOT EXISTS site_metrics (
  id TEXT PRIMARY KEY,             -- 'singleton'
  visitor_count INTEGER NOT NULL DEFAULT 0,
  launch_progress INTEGER,
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

-- visit_logs: Appwrite `visit_logs` (1,147 rows, 8 attributes).
-- WARNING: this is a write-on-every-request table (raw IPs + user agents).
-- It must NOT be written on every page view on Cloudflare (MD Section 2:
-- D1 bills rows written; Workers free tier is ~100K req/day). Phase 4 must
-- decide retention before migrating history — it may not need to move at
-- all. The table exists here so the import has a target if the owner keeps it.
CREATE TABLE IF NOT EXISTS visit_logs (
  id TEXT PRIMARY KEY,
  ip TEXT,
  path TEXT,
  user_agent TEXT,
  referrer TEXT,
  country TEXT,
  city TEXT,
  user_id TEXT,
  user_role TEXT,
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_visit_logs_path_created ON visit_logs(path, created_at);
CREATE INDEX IF NOT EXISTS idx_visit_logs_created ON visit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_visit_logs_user ON visit_logs(user_id);
