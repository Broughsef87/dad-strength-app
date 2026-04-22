-- ============================================================
-- ares_session_logs: make it idempotent + mark completion explicitly
--
-- Problem today:
--   1. Clicking "Done" multiple times on a set or block inserts
--      duplicate rows (no unique constraint). UI hydration can't
--      tell "which row is the latest" for a given set.
--   2. There's no explicit "this block/set is finished" flag —
--      code uses `completed: true` as a boolean but also treats
--      every inserted row as complete, which falls apart once we
--      start writing rows as the user types.
--
-- Fix:
--   1. Add `completed_at timestamptz` — set when the user marks a
--      set/block done. NULL while still in-progress.
--   2. Deduplicate any existing rows, keeping the newest `id` per
--      (user_id, generated_workout_id, block_name, set_number).
--   3. Create a unique index with NULLS NOT DISTINCT (Postgres 15+)
--      so future writes can upsert cleanly — including rows where
--      set_number IS NULL (olympic / metcon / accessory / etc.),
--      which should collapse to one row per block.
-- ============================================================

-- 1. Column for explicit completion timestamp
ALTER TABLE ares_session_logs
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Back-fill: existing rows were all treated as "done", so copy
-- their created_at forward so they stay marked complete.
UPDATE ares_session_logs
SET completed_at = created_at
WHERE completed_at IS NULL
  AND completed IS TRUE;

-- 2. Deduplicate. Keep the newest row per uniqueness tuple.
--    Only applies where generated_workout_id IS NOT NULL — older
--    fire-and-forget rows without a workout linkage stay untouched.
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, generated_workout_id, block_name, set_number
      ORDER BY id DESC
    ) AS rn
  FROM ares_session_logs
  WHERE generated_workout_id IS NOT NULL
)
DELETE FROM ares_session_logs
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 3. Unique index so future writes can use ON CONFLICT.
--    NULLS NOT DISTINCT means set_number = NULL counts as a single
--    distinct value — one row per (user, workout, block) for blocks
--    that don't have numbered sets (olympic, metcon, skill, mono).
CREATE UNIQUE INDEX IF NOT EXISTS ares_session_logs_session_block_set_unique
  ON ares_session_logs (user_id, generated_workout_id, block_name, set_number)
  NULLS NOT DISTINCT
  WHERE generated_workout_id IS NOT NULL;
