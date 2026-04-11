-- Guarantee exactly one WOD per (program_slug, week_number, day_number).
--
-- Without this, concurrent first-generation requests from different users
-- both insert, leaving duplicate rows. Any subsequent .maybeSingle() call
-- returns null (multiple rows), causing every user without localStorage to
-- re-generate — producing a different workout each time.
--
-- With this constraint:
--   • The first insert wins and becomes the canonical WOD for the week.
--   • Any racing insert gets a 23505 unique-violation error.
--   • The page code catches that error and fetches the canonical version,
--     overwriting the user's locally-generated (potentially different) copy.
--   • All users converge on the same workout regardless of race timing.

ALTER TABLE generated_workouts
  ADD CONSTRAINT generated_workouts_slug_week_day_unique
  UNIQUE (program_slug, week_number, day_number);
