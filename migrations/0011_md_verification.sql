-- 0011_md_verification.sql — MD verification queue (2026-11-21)
--
-- Side-by-side verification of markdown against the official PDF, for
-- AI Notes grounding. Two flows feed the same queue:
--   1. Manual: a verifier opens an item, compares the PDF (left) with the
--      md text (right), edits the md in place, and submits / approves.
--   2. AI upload: the friend's IDE AI posts one item per call to
--      POST /api/md-verification/upload with an access code (header
--      X-Upload-Code). The PDF goes to R2 under md-verification/, the md
--      text lands here with status 'pending', and a verifier reviews it.
--
-- Conventions (see 0001_init.sql): epoch-ms timestamps, TEXT ids,
-- explicit CHECKs on enums, no SELECT * in app code. This file is NOT
-- applied to production by the md-verification branch — apply it only
-- with the user's go-ahead, then deploy the branch.
--
-- Approved md is the source of truth for AI Notes. Nothing here
-- auto-publishes to the live paper page; that is a separate, later step.

CREATE TABLE IF NOT EXISTS md_verification_items (
  id TEXT PRIMARY KEY,
  paper_code TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('question', 'syllabus')),
  batch_id TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_review', 'needs_fix', 'approved')),
  md_text TEXT NOT NULL DEFAULT '',
  pdf_key TEXT,
  submitted_by TEXT,
  submitted_via TEXT NOT NULL DEFAULT 'manual'
    CHECK (submitted_via IN ('manual', 'upload')),
  upload_token_id TEXT,
  assigned_to TEXT,
  edited_by TEXT,
  edited_at INTEGER,
  verified_by TEXT,
  verified_at INTEGER,
  note TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_md_items_status
  ON md_verification_items (status);
CREATE INDEX IF NOT EXISTS idx_md_items_paper_code
  ON md_verification_items (paper_code);
CREATE INDEX IF NOT EXISTS idx_md_items_assigned_to
  ON md_verification_items (assigned_to);
CREATE INDEX IF NOT EXISTS idx_md_items_batch
  ON md_verification_items (batch_id);
CREATE INDEX IF NOT EXISTS idx_md_items_type_status
  ON md_verification_items (type, status);

-- Every edit / review decision, with the previous md text kept so an
-- edit can be audited (and undone by hand) without losing the original.
CREATE TABLE IF NOT EXISTS md_verification_history (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  actor_id TEXT,
  actor_label TEXT,
  action TEXT NOT NULL
    CHECK (action IN ('created', 'edited', 'submitted', 'approved', 'needs_fix', 'assigned')),
  note TEXT,
  previous_md_text TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_md_history_item
  ON md_verification_history (item_id);

-- Assigned verifiers. The friend gets a row here, NOT a moderator role:
-- the page gate is isModerator OR founder OR a row in this table.
CREATE TABLE IF NOT EXISTS md_verifiers (
  user_id TEXT PRIMARY KEY,
  assigned_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Upload access codes for the friend's IDE AI. Only the SHA-256 hash is
-- stored — the raw code is shown once at creation and never again.
CREATE TABLE IF NOT EXISTS md_upload_tokens (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  daily_cap INTEGER NOT NULL DEFAULT 50,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_md_tokens_hash
  ON md_upload_tokens (token_hash);
