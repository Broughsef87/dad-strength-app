-- ============================================================
-- ares_session_logs unique index: drop the WHERE partial predicate
-- so PostgREST upsert ON CONFLICT can actually use it.
--
-- Problem:
--   Old index was CREATE UNIQUE INDEX ... WHERE generated_workout_id IS NOT NULL.
--   PostgreSQL can only use a partial index for INSERT ... ON CONFLICT
--   if the conflict target includes the WHERE predicate too — and the
--   PostgREST upsert API doesn't support that. Every upsert was failing
--   with 42P10 'there is no unique or exclusion constraint matching
--   the ON CONFLICT specification'.
--
-- Fix:
--   1. Delete orphan rows with generated_workout_id IS NULL (they'd all
--      collapse to a single row under NULLS NOT DISTINCT anyway).
--   2. Drop the partial index.
--   3. Recreate without the WHERE clause. NULLS NOT DISTINCT ensures
--      rows without a workout id still dedupe correctly per user/block.
-- ============================================================

DELETE FROM ares_session_logs
WHERE generated_workout_id IS NULL;

DROP INDEX IF EXISTS ares_session_logs_session_block_set_unique;

CREATE UNIQUE INDEX ares_session_logs_session_block_set_unique
  ON ares_session_logs (user_id, generated_workout_id, block_name, set_number)
  NULLS NOT DISTINCT;
