-- ============================================================
-- Proof for supabase/migrations/20261026_one_session_row_per_run.sql.
-- Run like scripts/checks/billing-columns-proof.sql (a replayed local
-- database, never production). One transaction, rolled back.
--
-- Covers the sequential rules. The concurrent case — two connections
-- inserting the same session at once, the second blocked on the advisory lock
-- and then refused with 23505 — was run separately with two live
-- connections, and again end to end with two browsers opening one session.
-- ============================================================
BEGIN;
INSERT INTO auth.users (id, email) VALUES ('c2222222-0000-4000-8000-000000000001', 'proof-sessions@example.invalid');
INSERT INTO user_programs (user_id, program_slug, started_at) VALUES ('c2222222-0000-4000-8000-000000000001', 'dad-built', now() - interval '1 day');

CREATE OR REPLACE FUNCTION pg_temp.ins(w int, d int) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"c2222222-0000-4000-8000-000000000001","role":"authenticated"}', true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO generated_workouts (user_id, program_slug, week_number, day_number, workout_data)
    VALUES (auth.uid(), 'dad-built', w, d, '{}');
  EXCEPTION WHEN OTHERS THEN RESET ROLE; RETURN SQLSTATE;
  END;
  RESET ROLE;
  RETURN 'ok';
END $$;

DO $$
DECLARE r text;
BEGIN
  r := pg_temp.ins(1, 1);
  IF r <> 'ok' THEN RAISE EXCEPTION 'FAIL the first row for a session was refused (%)', r; END IF;
  r := pg_temp.ins(1, 1);
  IF r <> '23505' THEN RAISE EXCEPTION 'FAIL a second row for the same session in the same run gave % (want 23505)', r; END IF;
  RAISE NOTICE 'PASS a session gets one row per run; the second insert is a unique violation';
  r := pg_temp.ins(1, 3);
  IF r <> 'ok' THEN RAISE EXCEPTION 'FAIL another day of the same week was refused (%)', r; END IF;
  RAISE NOTICE 'PASS other sessions are unaffected';
END $$;

-- A restart (new run) may reuse the week/day an earlier run used.
UPDATE user_programs SET started_at = clock_timestamp() + interval '1 second' WHERE user_id = 'c2222222-0000-4000-8000-000000000001';
UPDATE generated_workouts SET created_at = now() - interval '1 hour' WHERE user_id = 'c2222222-0000-4000-8000-000000000001';
UPDATE user_programs SET started_at = now() - interval '1 minute' WHERE user_id = 'c2222222-0000-4000-8000-000000000001';
DO $$
DECLARE r text;
BEGIN
  r := pg_temp.ins(1, 1);
  IF r <> 'ok' THEN RAISE EXCEPTION 'FAIL a new run could not reuse week 1 day 1 (%)', r; END IF;
  RAISE NOTICE 'PASS a new run of the program may reuse an earlier run''s week and day';
END $$;
ROLLBACK;
