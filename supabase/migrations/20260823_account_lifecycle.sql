-- ============================================================
-- Account lifecycle (2026-08-23).
-- 1. disclaimer_accepted_at — first-run fitness/medical
--    acknowledgement timestamp (legal requirement for a strength
--    app prescribing heavy loads).
-- 2. Deletion-ready FKs: auth.admin.deleteUser() must cascade the
--    whole account. Every user table already cascaded except
--    workout_logs / workouts (NO ACTION — would block deletion);
--    programs.created_by now detaches instead of blocking.
--
-- Applied to production 2026-08-23 via Supabase migration
-- "account_lifecycle".
-- ============================================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS disclaimer_accepted_at timestamptz;

ALTER TABLE workout_logs DROP CONSTRAINT IF EXISTS workout_logs_user_id_fkey;
ALTER TABLE workout_logs
  ADD CONSTRAINT workout_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE workout_logs DROP CONSTRAINT IF EXISTS workout_logs_workout_id_fkey;
ALTER TABLE workout_logs
  ADD CONSTRAINT workout_logs_workout_id_fkey
  FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE SET NULL;

ALTER TABLE workouts DROP CONSTRAINT IF EXISTS workouts_user_id_fkey;
ALTER TABLE workouts
  ADD CONSTRAINT workouts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE programs DROP CONSTRAINT IF EXISTS programs_created_by_fkey;
ALTER TABLE programs
  ADD CONSTRAINT programs_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
