-- Ares shared WOD: add missing columns + unique index.
--
-- The generated_workouts table was originally per-user (unique per user_id+week+day).
-- Ares needs two new columns and a SHARED uniqueness guarantee across all users
-- so that exactly one canonical WOD exists per (program_slug, week_number, day_number).
--
-- Uses a partial unique index (WHERE program_slug IS NOT NULL) so existing per-user
-- rows with NULL program_slug are unaffected.

-- 1. Columns the Ares page code expects
ALTER TABLE generated_workouts
  ADD COLUMN IF NOT EXISTS program_slug TEXT,
  ADD COLUMN IF NOT EXISTS workout_data JSONB;

-- 2. One WOD per Ares day — shared across all users
CREATE UNIQUE INDEX IF NOT EXISTS generated_workouts_slug_week_day_unique
  ON generated_workouts (program_slug, week_number, day_number)
  WHERE program_slug IS NOT NULL;
