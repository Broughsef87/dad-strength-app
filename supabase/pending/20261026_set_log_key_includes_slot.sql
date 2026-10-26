-- ============================================================
-- PENDING — APPLY ONLY AFTER the code that writes the new key is DEPLOYED.
-- (It lives outside supabase/migrations/ so that it cannot be applied early.)
--
-- Why the order matters: this drops the unique index the CURRENT client's
-- upserts name in on_conflict. Applied first, every set save fails with
-- 42P10 until the new client ships. The new client (train/[program]/[day]
-- page, logConflictKey) tries the new key and falls back to the old one on
-- 42P10, so it is safe to deploy before this and keeps working after it.
--
-- What it fixes: ares_session_logs was unique on
--   (user_id, generated_workout_id, block_name, set_number)
-- and Power Dad lists a top single and its back-offs under ONE name
-- ("Snatch", "Power Clean") on 14 days of the macro (7 in time-crunch mode).
-- The two cards upserted the same rows; the top single was overwritten by
-- back-off set 1. Reproduced locally in the running app.
--
-- The new key adds slot. It is strictly looser than the old one, so creating
-- it cannot fail on existing rows. NULLS NOT DISTINCT keeps metcon / outside /
-- session_complete rows (slot NULL, set_number NULL) one per name, as before.
-- No row is read, changed or removed.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS ares_session_logs_session_block_slot_set_unique
  ON ares_session_logs (user_id, generated_workout_id, block_name, slot, set_number)
  NULLS NOT DISTINCT;

DROP INDEX IF EXISTS ares_session_logs_session_block_set_unique;
