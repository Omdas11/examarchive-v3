-- 0014: emailed 6-char upload codes for MD verification (replaces the
-- revoked X-Upload-Code token system; the md_upload_tokens table is kept
-- for history only and its API routes were removed).
--
-- A code is single-use, expires after 24 hours, and stops working after
-- 3 wrong attempts. Only the SHA-256 hash is stored, never the code.
CREATE TABLE IF NOT EXISTS md_upload_codes (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  created_by TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_md_upload_codes_hash ON md_upload_codes (code_hash);
CREATE INDEX IF NOT EXISTS idx_md_upload_codes_email ON md_upload_codes (email);
