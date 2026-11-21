-- 0009_user_course_prefs.sql — Course selection stored in D1 (2026-11-21)
-- Course prefs (DSC / DSM1 / DSM2 / SEC / IDC / AEC / VAC) used to live only
-- in the browser's localStorage (key ea_course_prefs), so the site could never
-- tell which users had picked their courses. This table mirrors them per user:
-- the client POSTs on every save and syncs any older local prefs on next visit.
-- One row per user (user_id PK); upsert via INSERT ... ON CONFLICT(user_id).
-- See 0001_init.sql header for shared conventions.

CREATE TABLE IF NOT EXISTS user_course_prefs (
  user_id TEXT PRIMARY KEY,
  dsc TEXT NOT NULL DEFAULT '',
  dsm1 TEXT NOT NULL DEFAULT '',
  dsm2 TEXT NOT NULL DEFAULT '',
  sec TEXT NOT NULL DEFAULT '',
  idc TEXT NOT NULL DEFAULT '',
  aec TEXT NOT NULL DEFAULT '',
  vac TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);
