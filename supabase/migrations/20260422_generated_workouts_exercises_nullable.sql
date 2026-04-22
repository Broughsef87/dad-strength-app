-- ============================================================
-- generated_workouts.exercises: make nullable.
--
-- Legacy column from the original generated_workouts schema when the
-- workout body lived in a top-level `exercises` jsonb column. That's
-- been superseded by `workout_data` (jsonb) which carries the full
-- AI-generated day object for Zeus/Ares/etc.
--
-- Keeping `exercises` around for backwards-read compatibility with any
-- old rows, but new inserts shouldn't be required to fill it. Making
-- it nullable also removes the need for the client to pass a
-- placeholder empty array on every insert.
-- ============================================================

ALTER TABLE generated_workouts
  ALTER COLUMN exercises DROP NOT NULL;
