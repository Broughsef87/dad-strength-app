-- ============================================================
-- Add 'session_complete' to the ares_session_logs.log_type check
-- constraint. A session_complete row is the sentinel that marks
-- "the athlete finished this whole day's workout" — distinct from
-- individual set/block completions.
-- ============================================================

ALTER TABLE ares_session_logs
  DROP CONSTRAINT IF EXISTS ares_session_logs_log_type_check;

ALTER TABLE ares_session_logs
  ADD CONSTRAINT ares_session_logs_log_type_check
  CHECK (log_type IN (
    'strength_set',
    'build_to_max',
    'skill_work',
    'monostructural',
    'metcon',
    'session_complete'
  ));
