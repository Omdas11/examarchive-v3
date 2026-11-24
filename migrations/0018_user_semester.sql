-- 0018_user_semester.sql — Current semester per user (2026-11-24)
-- The site collected course subjects (user_course_prefs) but never the
-- student's current semester. This adds it as a user attribute so the
-- course-setup modal can ask for it on next visit and the admin users
-- table can show it. Values 1-8 (FYUGP semesters); NULL = not set yet.
-- See 0001_init.sql header for shared conventions.

ALTER TABLE users ADD COLUMN semester INTEGER;
