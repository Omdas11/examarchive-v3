-- 0019_leaderboard_name_consent.sql — Leaderboard name consent (2026-11-28)
-- The public XP leaderboard showed every user's real name. Now each user
-- is asked once on login whether their name may appear: NULL = not asked
-- yet (prompt shows, mandatory choice), 1 = show real name, 0 = username
-- only (or "Anonymous" when no username is set). No names are shown until
-- the user opts in.
-- See 0001_init.sql header for shared conventions.

ALTER TABLE users ADD COLUMN leaderboard_name_visible INTEGER;
