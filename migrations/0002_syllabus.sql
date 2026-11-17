-- 0002_syllabus.sql — ExamArchive Appwrite -> Cloudflare D1, Phase 3
-- Syllabus tables: syllabus_table (2,585 rows), questions_table (0 rows),
-- legacy `syllabus` collection (0 rows), syllabus_stats (25 rows),
-- generated_notes_cache (0 rows).
-- See 0001_init.sql header for shared conventions.
--
-- BIG-TEXT RULE: syllabus_content / question_content / generated_markdown
-- are up to 1,000,000 chars. They stay in these tables as TEXT, but list
-- queries must NEVER select them (select explicit columns only). Fetch the
-- big column only on the single-row detail query. D1 bills rows read, and
-- a 1 MB column on every list row would burn the budget.

-- syllabus_table: Appwrite `Syllabus_Table` (2,585 rows, 30 attributes).
-- semester_no AND semester are both INTEGER and usually equal; both kept
-- for import fidelity. Canonical field for Phase 6: semester_no.
-- aliases / keywords / tags are string[] stored as JSON TEXT (see README).
CREATE TABLE IF NOT EXISTS syllabus_table (
  id TEXT PRIMARY KEY,
  entry_type TEXT,
  entry_id TEXT,
  college TEXT,
  university TEXT NOT NULL,
  course TEXT NOT NULL,
  stream TEXT NOT NULL,
  "group" TEXT,
  session TEXT,
  year INTEGER,
  type TEXT NOT NULL,
  paper_code TEXT NOT NULL,
  paper_name TEXT,
  subject TEXT,
  semester_code TEXT,
  semester_no INTEGER,
  semester INTEGER,
  credits INTEGER,
  marks_total INTEGER,
  syllabus_pdf_url TEXT,
  source_reference TEXT,
  status TEXT,
  aliases TEXT NOT NULL DEFAULT '[]',  -- string[] as JSON TEXT
  keywords TEXT NOT NULL DEFAULT '[]', -- string[] as JSON TEXT
  notes TEXT,
  version INTEGER,
  last_updated TEXT,               -- TEXT in Appwrite (not a datetime); kept as-is
  unit_number INTEGER NOT NULL,
  syllabus_content TEXT NOT NULL,  -- up to 1 MB: NEVER select in list queries
  lectures INTEGER,
  tags TEXT NOT NULL DEFAULT '[]', -- string[] as JSON TEXT
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_syllabus_paper_code ON syllabus_table(paper_code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_syllabus_paper_unit ON syllabus_table(paper_code, unit_number);
CREATE INDEX IF NOT EXISTS idx_syllabus_semester ON syllabus_table(semester_no);
CREATE INDEX IF NOT EXISTS idx_syllabus_course ON syllabus_table(course, stream);
CREATE INDEX IF NOT EXISTS idx_syllabus_subject ON syllabus_table(subject);
CREATE INDEX IF NOT EXISTS idx_syllabus_entry_id ON syllabus_table(entry_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_status ON syllabus_table(status);

-- questions_table: Appwrite `Questions_Table` (0 rows, 31 attributes).
-- question_content is up to 1 MB: same big-text rule as syllabus_content.
CREATE TABLE IF NOT EXISTS questions_table (
  id TEXT PRIMARY KEY,
  entry_type TEXT,
  question_id TEXT,
  college TEXT,
  university TEXT NOT NULL,
  course TEXT NOT NULL,
  stream TEXT NOT NULL,
  "group" TEXT,
  type TEXT NOT NULL,
  paper_code TEXT NOT NULL,
  paper_name TEXT,
  subject TEXT,
  exam_year INTEGER,
  exam_session TEXT,
  exam_month TEXT,
  attempt_type TEXT,
  semester_code TEXT,
  semester_no INTEGER,
  question_pdf_url TEXT,
  source_reference TEXT,
  status TEXT,
  question_no TEXT,
  question_subpart TEXT,
  year INTEGER,
  question_content TEXT NOT NULL, -- up to 1 MB: NEVER select in list queries
  marks INTEGER,
  tags TEXT NOT NULL DEFAULT '[]', -- string[] as JSON TEXT
  linked_syllabus_entry_id TEXT,
  link_status TEXT,
  ocr_text_path TEXT,
  ai_summary_status TEXT,
  difficulty_estimate TEXT,
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_questions_paper_code ON questions_table(paper_code);
CREATE INDEX IF NOT EXISTS idx_questions_question_id ON questions_table(question_id);
CREATE INDEX IF NOT EXISTS idx_questions_exam_year ON questions_table(exam_year);
CREATE INDEX IF NOT EXISTS idx_questions_status ON questions_table(status);
CREATE INDEX IF NOT EXISTS idx_questions_linked_syllabus ON questions_table(linked_syllabus_entry_id);

-- syllabus: Appwrite `syllabus` collection (0 rows, 13 attributes).
-- Largely superseded by syllabus_table; kept as a table so the Phase 4
-- import has somewhere to put it if rows ever appear. Phase 6 should
-- confirm whether the app still reads this collection at all.
CREATE TABLE IF NOT EXISTS syllabus (
  id TEXT PRIMARY KEY,
  university TEXT,
  subject TEXT,
  department TEXT,
  semester TEXT,
  programme TEXT,
  year INTEGER,
  uploader_id TEXT,
  approval_status TEXT,
  file_url TEXT,
  uploaded_by_username TEXT,
  course_code TEXT,
  course_name TEXT,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_syllabus_course_code ON syllabus(course_code);
CREATE INDEX IF NOT EXISTS idx_syllabus_dept_sem ON syllabus(department, semester);
CREATE INDEX IF NOT EXISTS idx_syllabus_approval ON syllabus(approval_status);

-- syllabus_stats: Appwrite `syllabus_stats` (25 rows, 3 attributes).
-- Carries the only Appwrite index in the schema besides user_activity
-- (idx_paper_code), preserved here as a UNIQUE index.
-- Counters: same write-on-read warning as papers — do not increment per view.
CREATE TABLE IF NOT EXISTS syllabus_stats (
  id TEXT PRIMARY KEY,
  paper_code TEXT NOT NULL,
  view_count INTEGER NOT NULL DEFAULT 0,
  download_count INTEGER NOT NULL DEFAULT 0,
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_syllabus_stats_paper_code ON syllabus_stats(paper_code);

-- generated_notes_cache: Appwrite `Generated_Notes_Cache`
-- (0 rows, 17 attributes). generated_markdown / syllabus_content up to
-- 1 MB: same big-text rule. year/semester are TEXT here (unlike the
-- INTEGER year in syllabus_table); kept as TEXT for import fidelity.
CREATE TABLE IF NOT EXISTS generated_notes_cache (
  id TEXT PRIMARY KEY,
  university TEXT,
  course TEXT,
  stream TEXT,
  selection_type TEXT,
  paper_code TEXT NOT NULL,
  type TEXT NOT NULL,
  year TEXT,
  semester TEXT,
  unit_number INTEGER NOT NULL,
  part_number INTEGER,
  markdown_file_id TEXT NOT NULL,
  generated_markdown TEXT,         -- up to 1 MB: NEVER select in list queries
  syllabus_content TEXT,           -- up to 1 MB: NEVER select in list queries
  pdf_file_id TEXT,
  status TEXT NOT NULL,
  last_processed_index INTEGER,
  legacy_appwrite_id TEXT UNIQUE,
  created_at INTEGER NOT NULL,     -- Appwrite created_at (was datetime, required)
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_gnc_paper_unit ON generated_notes_cache(paper_code, unit_number);
CREATE INDEX IF NOT EXISTS idx_gnc_status ON generated_notes_cache(status);
CREATE INDEX IF NOT EXISTS idx_gnc_markdown_file ON generated_notes_cache(markdown_file_id);
