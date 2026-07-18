-- ============================================================
-- Exercise-substitution scope
--
-- A swap can now be scoped instead of applying forever:
--   • repeat_meso = true  → repeat for the rest of the current mesocycle
--                           (from created_week through the meso's last week)
--   • repeat_meso = false → this session only (created_week + day)
--
-- created_week is the absolute week the swap was made. Existing rows predate
-- this and keep created_week = NULL, which the app treats as legacy "always
-- apply" so no current swap changes behavior. New swaps default to repeat_meso.
-- ============================================================

ALTER TABLE public.user_exercise_subs
  ADD COLUMN IF NOT EXISTS created_week INT,
  ADD COLUMN IF NOT EXISTS created_day INT,
  ADD COLUMN IF NOT EXISTS repeat_meso BOOLEAN NOT NULL DEFAULT true;
