-- ============================================================
-- Move Zeus progression state from device localStorage to server.
--
-- Before: week number + done-days tracked per-device in localStorage,
-- so two devices on the same account saw different progression.
--
-- After: user_programs row for Zeus holds the truth. Every device
-- reads the same state.
-- ============================================================

ALTER TABLE user_programs
  ADD COLUMN IF NOT EXISTS current_week INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS done_days INTEGER[] NOT NULL DEFAULT '{}';

-- Sanity constraint: week >= 1, no negative.
ALTER TABLE user_programs
  DROP CONSTRAINT IF EXISTS user_programs_current_week_positive;
ALTER TABLE user_programs
  ADD CONSTRAINT user_programs_current_week_positive CHECK (current_week >= 1);
