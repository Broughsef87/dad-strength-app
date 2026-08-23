-- ============================================================
-- Reconcile production with the repo schema (2026-08-23).
-- The repo (revival.sql + migrations) replays to a schema that
-- production almost matches. These are the five pieces prod lacked:
-- four columns the shipped code already reads/writes (silent 400s),
-- and the program-tier-gate trigger, whose function and backfill
-- were applied but whose CREATE TRIGGER never landed.
--
-- Applied to production 2026-08-23 via Supabase migration
-- "reconcile_prod_drift". Idempotent; a fresh rebuild gets these
-- from revival.sql + 20260710_program_tier_gate.sql already.
-- ============================================================

ALTER TABLE daily_checkins
  ADD COLUMN IF NOT EXISTS sleep_quality int;

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS body_composition jsonb,
  ADD COLUMN IF NOT EXISTS sleep_log jsonb,
  ADD COLUMN IF NOT EXISTS workout_notes jsonb;

-- Reinstall the tier gate (see 20260710_program_tier_gate.sql).
-- enforce_program_tier() already exists in prod and matches the repo.
DROP TRIGGER IF EXISTS user_programs_tier_gate ON user_programs;
CREATE TRIGGER user_programs_tier_gate
  BEFORE INSERT OR UPDATE ON user_programs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_program_tier();
