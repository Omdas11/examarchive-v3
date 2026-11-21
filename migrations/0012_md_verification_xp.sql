-- 0012_md_verification_xp.sql — XP for completing a full md (2026-11-21)
--
-- On Approve, the completer earns +25 XP and +5 AI credits, once per
-- item — the same size as the moderator-accepted correction bonus in
-- src/lib/verify.ts (CORRECTION_BONUS_XP / CORRECTION_BONUS_CREDITS),
-- and like that bonus it bypasses the daily verify caps. No XP for
-- needs_fix, Save draft, or Submit alone.
--
-- Completer order (see resolveMdCompleter in src/lib/md-verification.ts):
-- edited_by, else submitted_by, else assigned_to, else the approver.
-- Self-approve earns the XP once — intentional, the founder tries the
-- first item himself. If the completer has no users row, the award is
-- skipped but the approval still stands.
--
-- Guard columns: xp_awarded stays 0 and xp_awarded_to stays NULL until
-- the award lands; the review route only awards on the transition into
-- approved (status was not already approved) and only when xp_awarded
-- is 0, so re-approving an approved item pays nothing. The item status
-- update and the users xp/ai_credits update run in one D1 batch.
--
-- One-time apply, same style as 0010: D1's SQLite rejects ADD COLUMN
-- IF NOT EXISTS (syntax error), so these are plain ALTERs. Do not
-- re-run after applying; the columns already exist then.

ALTER TABLE md_verification_items ADD COLUMN xp_awarded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE md_verification_items ADD COLUMN xp_awarded_to TEXT;
