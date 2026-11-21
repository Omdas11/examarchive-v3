-- 0013_md_verification_suggestions_locks.sql — suggestions + soft locks
-- for MD verification v2 (2026-11-21)
--
-- Suggestions: anyone with page access who is NOT the assigned
-- verifier can suggest an edit instead of editing directly. The
-- assignee applies (replaces that question's text, history action
-- 'edited') or dismisses. Status: pending / applied / dismissed.
--
-- Soft locks: opening the detail page claims a lock for the editor
-- (heartbeat every 30 s, 2-minute expiry checked server-side by
-- timestamp, no cron). A lock never blocks a save by itself — it only
-- shows "X is editing this now" — the version check on PUT is what
-- stops an overwrite. Locks live in their own table so the code can
-- fail open when this migration has not been applied yet.
--
-- One-time apply, same style as 0011/0012: plain CREATE TABLE IF NOT
-- EXISTS (safe to re-run). Apply with the Cloudflare connector or the
-- dashboard after deploying the v2 code; the code treats a missing
-- table as "suggestions / locks unavailable" instead of crashing.

CREATE TABLE IF NOT EXISTS md_verification_suggestions (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  author_id TEXT,
  author_label TEXT,
  question_ref TEXT NOT NULL DEFAULT '',
  proposed_text TEXT NOT NULL DEFAULT '',
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'applied', 'dismissed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_md_suggestions_item
  ON md_verification_suggestions (item_id, status);

CREATE TABLE IF NOT EXISTS md_verification_locks (
  item_id TEXT PRIMARY KEY,
  locked_by TEXT NOT NULL,
  locked_by_label TEXT,
  locked_at INTEGER NOT NULL
);
