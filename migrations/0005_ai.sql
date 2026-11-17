-- 0005_ai.sql — ExamArchive Appwrite -> Cloudflare D1, Phase 3
-- AI / usage tables: ai_usage, pdf_usage, ai_generation_jobs,
-- ai_embeddings, ai_ingestions, ai_syllabus_maps, ai_flashcards,
-- ai_admin_reports, ai_cache_index. All 0 rows in the backup.
-- See 0001_init.sql header for shared conventions.
--
-- ai_embeddings.embedding is a double[] vector. It is stored as JSON TEXT
-- (same rule as every other array in this schema). D1 has NO vector index
-- and no vector search: do NOT build similarity search on this column.
-- If embeddings are ever used for real, they need a real vector store.
-- The pdf-generator Function that would read these tables was never copied
-- to the new Appwrite project and is not a straight port to Workers
-- (Phase 1 report); these tables are kept for import fidelity.

-- ai_usage: Appwrite `ai_usage` (0 rows, 2 attributes).
-- date is TEXT 'YYYY-MM-DD' in Appwrite; kept as TEXT.
CREATE TABLE IF NOT EXISTS ai_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_usage_user_date ON ai_usage(user_id, date);

-- pdf_usage: Appwrite `pdf_usage` (0 rows, 2 attributes). Same shape as ai_usage.
CREATE TABLE IF NOT EXISTS pdf_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pdf_usage_user_date ON pdf_usage(user_id, date);

-- ai_generation_jobs: Appwrite `ai_generation_jobs` (0 rows, 12 attributes).
-- input_payload_json stores JSON as TEXT; keep as TEXT, parse in code.
CREATE TABLE IF NOT EXISTS ai_generation_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  paper_code TEXT NOT NULL,
  unit_number INTEGER NOT NULL,
  status TEXT NOT NULL,
  progress_percent INTEGER,
  input_payload_json TEXT NOT NULL, -- JSON-in-a-string; keep TEXT, parse in code
  result_file_id TEXT,
  error_message TEXT,
  started_at INTEGER,              -- epoch ms (was datetime)
  completed_at INTEGER,            -- epoch ms (was datetime)
  idempotency_key TEXT NOT NULL,
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,     -- Appwrite created_at (was datetime, required)
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_user ON ai_generation_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON ai_generation_jobs(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_jobs_idempotency ON ai_generation_jobs(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_paper_unit ON ai_generation_jobs(paper_code, unit_number);

-- ai_embeddings: Appwrite `ai_embeddings` (0 rows, 11 attributes).
CREATE TABLE IF NOT EXISTS ai_embeddings (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_label TEXT NOT NULL,
  course_code TEXT,
  department TEXT,
  year INTEGER,
  uploaded_by TEXT,
  embedding_model TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  text_chunk TEXT NOT NULL,
  embedding TEXT NOT NULL,         -- double[] vector as JSON TEXT; NO vector index
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_ai_emb_file ON ai_embeddings(file_id);
CREATE INDEX IF NOT EXISTS idx_ai_emb_source ON ai_embeddings(source_type, source_label);
CREATE INDEX IF NOT EXISTS idx_ai_emb_course ON ai_embeddings(course_code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_emb_file_chunk ON ai_embeddings(file_id, chunk_index);

-- ai_ingestions: Appwrite `ai_ingestions` (0 rows, 15 attributes).
CREATE TABLE IF NOT EXISTS ai_ingestions (
  id TEXT PRIMARY KEY,
  entry_type TEXT,
  paper_code TEXT,
  source_label TEXT,
  file_id TEXT,
  file_url TEXT,
  status TEXT,
  model TEXT,
  characters_ingested INTEGER,
  digest TEXT,
  paper_name TEXT,
  ingested_at INTEGER,             -- epoch ms (was datetime)
  row_count INTEGER,
  error_summary TEXT,
  subject TEXT,
  dept_code TEXT,
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_ai_ing_paper ON ai_ingestions(paper_code);
CREATE INDEX IF NOT EXISTS idx_ai_ing_status ON ai_ingestions(status);
CREATE INDEX IF NOT EXISTS idx_ai_ing_file ON ai_ingestions(file_id);

-- ai_syllabus_maps: Appwrite `ai_syllabus_maps` (0 rows, 8 attributes).
-- modules_json stores JSON as TEXT; keep as TEXT, parse in code.
CREATE TABLE IF NOT EXISTS ai_syllabus_maps (
  id TEXT PRIMARY KEY,
  university TEXT,
  college TEXT,
  program TEXT,
  semester TEXT,
  checksum TEXT,
  modules_json TEXT,               -- JSON-in-a-string; keep TEXT, parse in code
  model TEXT,
  source_syllabus_id TEXT,
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_ai_maps_checksum ON ai_syllabus_maps(checksum);
CREATE INDEX IF NOT EXISTS idx_ai_maps_source ON ai_syllabus_maps(source_syllabus_id);

-- ai_flashcards: Appwrite `ai_flashcards` (0 rows, 5 attributes).
-- payload stores JSON as TEXT (up to 10,000 chars); tags is string[] as JSON TEXT.
-- Note the camelCase userId: kept as-is for import fidelity.
CREATE TABLE IF NOT EXISTS ai_flashcards (
  id TEXT PRIMARY KEY,
  userId TEXT,
  source_paper_id TEXT,
  payload TEXT,
  model TEXT,
  tags TEXT NOT NULL DEFAULT '[]', -- string[] as JSON TEXT
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_ai_fc_user ON ai_flashcards(userId);
CREATE INDEX IF NOT EXISTS idx_ai_fc_source ON ai_flashcards(source_paper_id);

-- ai_admin_reports: Appwrite `ai_admin_reports` (0 rows, 4 attributes).
-- summary / risks_json are large TEXT; risks_json is JSON-in-a-string.
CREATE TABLE IF NOT EXISTS ai_admin_reports (
  id TEXT PRIMARY KEY,
  run_at INTEGER,                  -- epoch ms (was datetime)
  summary TEXT,
  model TEXT,
  risks_json TEXT,                 -- JSON-in-a-string; keep TEXT, parse in code
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_ai_reports_run ON ai_admin_reports(run_at);

-- ai_cache_index: Appwrite `ai_cache_index` (0 rows, 5 attributes).
CREATE TABLE IF NOT EXISTS ai_cache_index (
  id TEXT PRIMARY KEY,
  cache_key TEXT NOT NULL,
  paper_code TEXT,
  type TEXT,
  file_id TEXT,
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,     -- Appwrite created_at (was datetime)
  updated_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_cache_key ON ai_cache_index(cache_key);
CREATE INDEX IF NOT EXISTS idx_ai_cache_paper ON ai_cache_index(paper_code, type);
