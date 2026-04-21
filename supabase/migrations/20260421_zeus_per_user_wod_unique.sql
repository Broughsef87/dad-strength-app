-- ============================================================
-- generated_workouts: per-user uniqueness for Zeus only.
--
-- The existing partial unique index on (program_slug, week_number,
-- day_number) WHERE program_slug IS NOT NULL is specifically for
-- Ares (shared daily WOD across all users). It does not include
-- user_id, so Zeus races between devices can produce duplicate rows
-- — each device then reads its own duplicate and users see different
-- workouts (most visibly: different metcons).
--
-- Fix, scoped to zeus only:
--   1. Dedupe any existing zeus duplicates (keep one per
--      user/week/day, drop the rest).
--   2. Add a partial unique index on (user_id, week_number,
--      day_number) WHERE program_slug = 'zeus'.
--
-- Leaves Ares and all other programs untouched.
-- ============================================================

-- 1. Deduplicate zeus rows. Ordered by id ASC since the table has no
--    created_at column — deterministic tiebreak is all we need.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, program_slug, week_number, day_number
           ORDER BY id ASC
         ) AS rn
  FROM generated_workouts
  WHERE program_slug = 'zeus'
)
DELETE FROM generated_workouts
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2. Add per-user unique index for zeus.
CREATE UNIQUE INDEX IF NOT EXISTS generated_workouts_zeus_user_week_day_unique
  ON generated_workouts (user_id, week_number, day_number)
  WHERE program_slug = 'zeus';
