-- Migration: 20260409_canonical_workout_schema
-- Completes the schema consolidation started in 20260408_workout_logs_consolidation.
--
-- This migration finalises the canonical workout_logs schema:
--   - weight_lbs  (NOT NULL)  replaces legacy `weight` column
--   - generated_workout_id    canonical FK for AI / Ares program sessions
--   - workout_id              retained for legacy workout player only (nullable)
--
-- Safe to run against production. The `weight` column backfill was confirmed
-- complete in 20260408. All application code now writes `weight_lbs`.

-- 1. Enforce weight_lbs as the canonical weight column (NOT NULL, default 0).
--    Any remaining NULLs (pre-backfill orphan rows) are coerced to 0.
UPDATE workout_logs
  SET weight_lbs = 0
  WHERE weight_lbs IS NULL;

ALTER TABLE workout_logs
  ALTER COLUMN weight_lbs SET NOT NULL,
  ALTER COLUMN weight_lbs SET DEFAULT 0;

-- 2. Drop the legacy `weight` column.
--    No code writes to it. 20260408 backfilled it from weight_lbs for query
--    compatibility during the transition window; that window is now closed.
ALTER TABLE workout_logs
  DROP COLUMN IF EXISTS weight;

-- 3. Add a covering unique index for AI-program session upserts.
--    The existing workout_logs_unique_set constraint covers the legacy player
--    path (user_id, workout_id, exercise_name, set_number). This adds a
--    parallel index for the AI / generated-workout path so program/[day]/page
--    and ares/[day]/page can upsert without conflicts.
CREATE UNIQUE INDEX IF NOT EXISTS workout_logs_generated_unique_set
  ON workout_logs (user_id, generated_workout_id, exercise_name, set_number)
  WHERE generated_workout_id IS NOT NULL;

-- 4. Index: cover the common query shape (user + date range + both IDs).
--    Already created in 20260408 but reproduced here idempotently for clarity.
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_created
  ON workout_logs (user_id, created_at DESC);

-- ── Future migration (run after legacy workout player is retired) ────────────
-- DROP INDEX IF EXISTS workout_logs_unique_set constraint first:
--   ALTER TABLE workout_logs DROP CONSTRAINT IF EXISTS workout_logs_unique_set;
-- Then drop the column:
--   ALTER TABLE workout_logs DROP COLUMN IF EXISTS workout_id;
-- ─────────────────────────────────────────────────────────────────────────────
