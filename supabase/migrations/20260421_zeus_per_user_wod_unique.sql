-- ============================================================
-- generated_workouts: per-user uniqueness for Zeus (and any future
-- personal programs). The existing partial unique index was built
-- for Ares (a shared daily WOD across all users) and does not
-- include user_id, so two Zeus rows can land for the same
-- (user, week, day) and each device reads a different one.
--
-- Fix:
--   - Keep the Ares shared index intact.
--   - Add a second partial unique index for every program_slug
--     EXCEPT 'ares', keyed on (user_id, program_slug, week_number,
--     day_number) so each user owns one row per (zeus, week, day).
-- ============================================================

-- 1. Deduplicate any existing rows — keep one row per
--    (user_id, program_slug, week_number, day_number), drop the rest.
--    This is safe for personal programs like Zeus; Ares is skipped.
--    Ordered by id ASC since generated_workouts lacks a created_at column.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, program_slug, week_number, day_number
           ORDER BY id ASC
         ) AS rn
  FROM generated_workouts
  WHERE program_slug IS NOT NULL AND program_slug <> 'ares'
)
DELETE FROM generated_workouts
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2. Add the per-user unique index now that the table is clean.
CREATE UNIQUE INDEX IF NOT EXISTS generated_workouts_user_slug_week_day_unique
  ON generated_workouts (user_id, program_slug, week_number, day_number)
  WHERE program_slug IS NOT NULL AND program_slug <> 'ares';
