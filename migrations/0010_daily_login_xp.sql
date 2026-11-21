-- 0010_daily_login_xp.sql — Daily login XP tracking (2026-11-21)
-- last_daily_xp_at (epoch ms) records when the user last received the daily
-- login XP (+10 XP, first authenticated visit of the UTC day). GET
-- /api/profile awards it with a conditional UPDATE (last_daily_xp_at <
-- start-of-today), so concurrent calls award only once. The same award
-- maintains streak_days (yesterday -> +1, earlier -> 1) and last_activity.
-- See 0001_init.sql header for shared conventions.

ALTER TABLE users ADD COLUMN last_daily_xp_at INTEGER;
