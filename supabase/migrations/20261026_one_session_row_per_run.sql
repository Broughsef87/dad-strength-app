-- ============================================================
-- One generated_workouts row per session per run (2026-10-26).
--
-- The macrocycle programs (hybrid-power, dad-built, hybrid-dad) have no unique
-- index on generated_workouts — they cannot have a plain one, because a new
-- RUN of a program legitimately reuses week/day numbers an earlier run used
-- (src/lib/programs/run.ts). The only guard against a second row for the same
-- session was findOrCreateSession (src/lib/sessionLookup.ts): an in-memory map
-- in ONE browser tab. A phone and a laptop, two tabs, or a reload racing a
-- slow load each found nothing and each inserted. Reproduced locally: two
-- devices opening week 10 day 5 together made two rows 12 ms apart. Sets then
-- split across them, and autoreg reads only the first.
--
-- This makes the second insert fail the way a unique index would (23505), so
-- the train page's existing 23505 path adopts the first row instead. The
-- advisory lock serialises concurrent inserts for one session key, and the
-- EXISTS runs after it, on a fresh snapshot, so it sees the winner's row.
--
-- Additive: one function, one trigger. Existing rows — including duplicates
-- already in production — are not read, changed or removed. Cleaning those up
-- is a separate, data-rewriting change and is listed in REVIEW.md.
-- ============================================================

CREATE OR REPLACE FUNCTION public.one_session_row_per_run()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  run_start timestamptz;
BEGIN
  -- legacy / zeus / ares keep their own partial unique indexes.
  IF NEW.program_slug IS NULL OR NEW.program_slug IN ('zeus', 'ares') THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    NEW.user_id::text || '|' || NEW.program_slug || '|' || NEW.week_number || '|' || NEW.day_number, 0));

  SELECT started_at INTO run_start
  FROM user_programs
  WHERE user_id = NEW.user_id AND program_slug = NEW.program_slug;

  IF EXISTS (
    SELECT 1 FROM generated_workouts
    WHERE user_id = NEW.user_id
      AND program_slug = NEW.program_slug
      AND week_number = NEW.week_number
      AND day_number = NEW.day_number
      AND created_at >= COALESCE(run_start, '-infinity'::timestamptz)
  ) THEN
    RAISE EXCEPTION 'This session already has a row in the current run.'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.one_session_row_per_run() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS generated_workouts_one_per_run ON generated_workouts;
CREATE TRIGGER generated_workouts_one_per_run
  BEFORE INSERT ON generated_workouts
  FOR EACH ROW
  EXECUTE FUNCTION public.one_session_row_per_run();
