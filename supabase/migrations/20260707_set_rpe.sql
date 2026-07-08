-- ============================================================
-- Per-set RPE feedback + stable slot identity on session logs.
--
-- rpe:  1-10 difficulty reported after each set (9 ≈ 1 rep in
--       reserve). Drives deterministic autoregulation — next
--       week's percentage for a slot shifts (bounded) based on
--       how the same slot felt this week.
-- slot: the config slot id (e.g. 'snatch_primary'). Variation
--       NAMES rotate weekly; the slot is the stable join key
--       for week-over-week comparisons.
-- ============================================================

ALTER TABLE ares_session_logs
  ADD COLUMN IF NOT EXISTS rpe int CHECK (rpe BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS slot text;

CREATE INDEX IF NOT EXISTS idx_ares_logs_slot
  ON ares_session_logs (user_id, slot)
  WHERE slot IS NOT NULL;
