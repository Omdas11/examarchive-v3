-- 0008_ai_notes.sql — AI Notes (Cloudflare-native generator, 2026-11-20)
-- Ledger for the AI Notes generator. One row per generation attempt.
-- Free tier: exactly 1 free PDF per day per registered account (UTC date).
-- The daily-free check is a query on this table (is_free_daily = 1,
-- status = 'completed'), never in-memory state.
-- Paid: 10 credits per set, deducted ONLY after a PDF is delivered
-- (the route inserts the row and deducts in one D1 batch).
-- Rerun: 1 free manual rerun per PAID generation (credits_charged = 0,
-- is_rerun = 1, rerun_of = paid generation id); a rerun of a free daily
-- generation costs 10 credits.
-- See 0001_init.sql header for shared conventions.

CREATE TABLE IF NOT EXISTS ai_notes_generations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL, -- YYYY-MM-DD (UTC calendar day)
  topic TEXT NOT NULL,
  paper_code TEXT,
  note_length TEXT NOT NULL DEFAULT 'standard',
  provider TEXT, -- e.g. gemini, gemma-4, groq, openrouter, github-models
  model TEXT,
  credits_charged INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed', -- completed | failed
  is_free_daily INTEGER NOT NULL DEFAULT 0, -- 1 = consumed the daily free PDF
  is_rerun INTEGER NOT NULL DEFAULT 0,
  rerun_of TEXT, -- id of the generation being rerun (NULL for new generations)
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_ai_notes_user_date ON ai_notes_generations(user_id, date);
CREATE INDEX IF NOT EXISTS idx_ai_notes_rerun_of ON ai_notes_generations(rerun_of);
