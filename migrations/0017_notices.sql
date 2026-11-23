-- 0017: official notices (Assam University + Haflong Govt College) for the
-- /notices page. Seeded from the live notice boards; the notices watch cron
-- inserts a row per new notice as it appears. source_url is the official
-- PDF/link and doubles as the watch's dedupe key (see notices_seen.json).
CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL,
  notice_date TEXT,
  category TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notices_created ON notices (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notices_source_url ON notices (source_url);
