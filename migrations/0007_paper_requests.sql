-- 0007_paper_requests.sql — requests from the browse empty state
-- ("Can't find the paper? Request it"). Guests included; email is required
-- so the team can send the requester a copy once the paper is added.
CREATE TABLE IF NOT EXISTS paper_requests (
  id TEXT PRIMARY KEY,
  course_code TEXT,
  paper_name TEXT,
  semester TEXT,
  year INTEGER,
  department TEXT,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_paper_requests_email ON paper_requests(email);
CREATE INDEX IF NOT EXISTS idx_paper_requests_status ON paper_requests(status);
CREATE INDEX IF NOT EXISTS idx_paper_requests_created_at ON paper_requests(created_at);
