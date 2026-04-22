-- ============================================================
-- Drop user_programs.done_days — duplicate state, now derived.
--
-- Previously user_programs.done_days (int[]) tracked which days of the
-- current week the user had marked complete. This duplicated what's
-- already in ares_session_logs (rows with completed_at IS NOT NULL),
-- and the two sources of truth drifted apart — the most painful symptom
-- being "back to dashboard, it thinks I never did the workout" even
-- though session logs clearly showed completion.
--
-- After commit 4/4 of the workout-logger rewrite, nothing reads or
-- writes this column. Drop it.
--
-- user_programs.current_week is retained — it represents an explicit
-- "which week is the user actively training" value that users advance
-- on completion, not something derivable from logs.
-- ============================================================

ALTER TABLE user_programs
  DROP COLUMN IF EXISTS done_days;

-- Drop the positivity check we added for done_days/current_week earlier;
-- re-add just the current_week one since done_days is gone.
ALTER TABLE user_programs
  DROP CONSTRAINT IF EXISTS user_programs_current_week_positive;

ALTER TABLE user_programs
  ADD CONSTRAINT user_programs_current_week_positive CHECK (current_week >= 1);
