-- Migration: 20260408_workout_logs_consolidation
-- Reconciles two incompatible write schemas that coexisted in workout_logs:
--
--   System A (AI program + squeeze pages):  weight  + generated_workout_id
--   System B (legacy workout player):       weight_lbs + workout_id
--
-- After this migration, all code writes weight_lbs. Both legacy columns are
-- kept for a backwards-compat window; weight and workout_id will be dropped
-- in a future migration once all readers are confirmed updated.
--
-- Safe to run against production: no drops, only adds + backfills.

-- 1. Ensure weight_lbs column exists (System B already uses it; System A did not)
ALTER TABLE workout_logs
  ADD COLUMN IF NOT EXISTS weight_lbs numeric;

-- 2. Ensure notes column exists (squeeze writer uses this for JSON payload)
ALTER TABLE workout_logs
  ADD COLUMN IF NOT EXISTS notes text;

-- 3. Ensure set_number column exists (legacy writer uses this)
ALTER TABLE workout_logs
  ADD COLUMN IF NOT EXISTS set_number integer;

-- 4. Backfill weight_lbs from weight for System A rows
--    (generated_workout_id IS set, weight IS set, weight_lbs IS NULL)
UPDATE workout_logs
SET weight_lbs = weight
WHERE weight_lbs IS NULL
  AND weight IS NOT NULL;

-- 5. Backfill weight from weight_lbs for System B rows
--    Lets AI context query (which currently reads weight) see legacy data too
--    until that query is updated to read weight_lbs.
UPDATE workout_logs
SET weight = weight_lbs
WHERE weight IS NULL
  AND weight_lbs IS NOT NULL;

-- 6. Indexes for query patterns used by history, DadScore, schedule, profile
CREATE INDEX IF NOT EXISTS idx_workout_logs_generated_workout_id
  ON workout_logs (generated_workout_id)
  WHERE generated_workout_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workout_logs_workout_id
  ON workout_logs (workout_id)
  WHERE workout_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workout_logs_user_created
  ON workout_logs (user_id, created_at DESC);

-- 7. RLS safety check
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;

-- ── Future migration (run after code is confirmed on weight_lbs everywhere) ──
-- ALTER TABLE workout_logs ALTER COLUMN weight_lbs SET NOT NULL;
-- ALTER TABLE workout_logs DROP COLUMN weight;
-- ALTER TABLE workout_logs DROP COLUMN workout_id;  -- only after legacy player retired
