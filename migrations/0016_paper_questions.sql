-- 0016: per-question index for approved md (AI Notes queries by unit /
-- keyword later). Written only on Approve, from the approved md's
-- transcript rows merged with the index table's keywords (see
-- src/lib/md-question-index.ts). One row per sub-question; the question
-- id is `<paper_code>-Q<label>`, e.g. COMDSC-352T-Q1a. Re-approving an
-- item replaces its rows (DELETE by item_id, then INSERT).
CREATE TABLE IF NOT EXISTS paper_questions (
  question_id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  paper_code TEXT NOT NULL,
  label TEXT NOT NULL,
  question_text TEXT NOT NULL,
  marks INTEGER,
  unit TEXT,
  group_rule TEXT,
  keywords TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_paper_questions_paper_unit ON paper_questions (paper_code, unit);
CREATE INDEX IF NOT EXISTS idx_paper_questions_item ON paper_questions (item_id);
