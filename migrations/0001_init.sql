-- 0001_init.sql — ExamArchive Appwrite -> Cloudflare D1, Phase 3
-- Core tables: users, sessions, papers.
-- Source: docs/cloudflare-migration/phase1-inventory.md (backup 2026-11-17,
-- project 6af69cb60001f52c7704, 4,400 docs). No data is imported here (Phase 4).
--
-- Conventions used in every migration file in this directory:
-- * id TEXT PRIMARY KEY is a new D1 id (uuid). legacy_appwrite_id TEXT UNIQUE
--   keeps the Appwrite $id so Phase 4 can map rows back. Drop it only after
--   the migration is verified (migration doc Phase 3).
-- * Timestamps are INTEGER epoch milliseconds (Appwrite $createdAt/$updatedAt
--   and datetime attributes are ISO strings; Phase 4 converts them).
-- * Booleans are INTEGER 0/1. Arrays are JSON TEXT (see README).
-- * No FOREIGN KEYs except sessions.user_id. Appwrite has no declared
--   relationships; every other link is a plain string id and is often empty
--   or orphaned (papers.uploaded_by is empty on all 636 rows), so a FK
--   would break the import. The app must enforce ownership/role checks.

-- users: Appwrite `users` collection (3 rows) + MD Section 5 auth columns.
-- google_sub is new: no auth data exists in the backup, Phase 5 fills it.
-- role values seen in the backup: 'founder', 'student'. The app enforces
-- roles server-side (roles.ts); D1 has no per-document permissions, so the
-- per-row $permissions read("user:<id>") from Appwrite become an ownership
-- check in code, not a database feature.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,                       -- display name (Appwrite: display_name)
  display_name TEXT,
  username TEXT,
  avatar_url TEXT,
  google_sub TEXT UNIQUE,          -- Google stable user id (Phase 5)
  role TEXT NOT NULL DEFAULT 'user', -- 'founder' | 'student' | 'admin' | 'user'
  primary_role TEXT,
  secondary_role TEXT,
  tertiary_role TEXT,
  tier TEXT,                       -- 'bronze' | 'silver' | 'gold' | ...
  xp INTEGER NOT NULL DEFAULT 0,
  streak_days INTEGER NOT NULL DEFAULT 0,
  last_activity INTEGER,           -- epoch ms (was datetime)
  upload_count INTEGER NOT NULL DEFAULT 0,
  username_last_changed TEXT,      -- TEXT in Appwrite (not a datetime); kept as-is
  referral_code TEXT,
  ai_credits INTEGER NOT NULL DEFAULT 0,
  referred_by TEXT,
  referral_path TEXT NOT NULL DEFAULT '[]', -- string[] stored as JSON TEXT
  discord_id TEXT,
  discord_username TEXT,
  discord_avatar TEXT,
  discord_in_server INTEGER NOT NULL DEFAULT 0,
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

-- sessions: MD Section 5. id stores a HASH of the session token, never the
-- raw token. No legacy column: sessions cannot be migrated (none in backup);
-- every user signs in again after cutover.
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,             -- hash of the random session token
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- papers: Appwrite `papers` collection (636 rows, 23 attributes).
-- file_key is new: the R2 object key (Phase 4 sets it; file_id/file_url are
-- the legacy Appwrite references, kept for mapping back).
-- institute AND institution are both kept for import fidelity; both are
-- usually "Assam University". Canonical field for Phase 6: institution.
-- view_count / download_count are KEPT as columns but must NOT be
-- incremented on every page view (MD Section 2: D1 bills rows written).
-- The app must batch/aggregate counts instead; see README.
CREATE TABLE IF NOT EXISTS papers (
  id TEXT PRIMARY KEY,
  course_code TEXT NOT NULL,
  paper_name TEXT,
  year INTEGER NOT NULL,
  semester TEXT,
  department TEXT,
  programme TEXT,
  exam_type TEXT,
  institute TEXT,
  institution TEXT,
  stream TEXT,
  paper_type TEXT,
  marks INTEGER,
  duration INTEGER,
  file_id TEXT,                    -- legacy Appwrite Storage file id
  file_url TEXT NOT NULL,          -- legacy Appwrite URL; R2 replaces it
  file_key TEXT,                   -- R2 object key, e.g. papers/{subject}/{year}/{slug}.pdf
  uploaded_by TEXT,
  uploaded_by_username TEXT,
  approved INTEGER NOT NULL DEFAULT 0,
  status TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  download_count INTEGER NOT NULL DEFAULT 0,
  source_name TEXT,
  source_url TEXT,
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
-- NOTE: papers has no `subject` column in Appwrite (subject lives in
-- Syllabus_Table). The hot-query composite is (department, year) instead.
CREATE INDEX IF NOT EXISTS idx_papers_dept_year ON papers(department, year);
CREATE INDEX IF NOT EXISTS idx_papers_department ON papers(department);
CREATE INDEX IF NOT EXISTS idx_papers_course_code ON papers(course_code);
CREATE INDEX IF NOT EXISTS idx_papers_year ON papers(year);
CREATE INDEX IF NOT EXISTS idx_papers_semester ON papers(semester);
CREATE INDEX IF NOT EXISTS idx_papers_approved_status ON papers(approved, status);
CREATE INDEX IF NOT EXISTS idx_papers_created_at ON papers(created_at);
CREATE INDEX IF NOT EXISTS idx_papers_file_id ON papers(file_id);
