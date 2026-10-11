-- ── Check-ins: a morning sub-path lands only on that day's entry (FOR-231 v3) ─
-- The 2026-10-09 ruling on FOR-231. Additive: two new functions and a
-- CREATE OR REPLACE of `checkin_patch`. No table, column, policy, index or row
-- is touched.
--
-- THE DEFECT. Since 20261003_checkin_set_path.sql each writer of the morning
-- protocol names its own path: a step tick writes {morning,completed},
-- gratitude writes {morning,gratitude}, generation writes {morning} whole. A
-- sub-path patch onto a row with no morning entry SUCCEEDED: the function built
-- the missing ancestor, so the row ended with `{"morning":{"completed":[...]}}`
-- and no protocol. The loader skips an entry with no protocol, so the next
-- reload showed nothing and nothing had ever said so.
--
-- v2's r4 tried to hold this on the client with a boolean, `entryInRow`, and
-- Codex broke it two ways:
--   1. the boolean described the row the loader read, while the destination row
--      was recomputed per write from the 4am cutoff. Load at 3:50, tick at 4:10,
--      and the tick was addressed to the next day's row, which has no entry.
--   2. where the boolean was false, gratitude returned without writing and
--      without saying so. The orphan became a silent loss.
-- The client cannot hold a fact about the row. The row can.
--
-- THE RULE. In `spirit_state`, a patch whose path is `morning` plus at least
-- one more key is applied only if the row, at the moment of the write, already
-- holds a morning entry for ITS OWN day:
--   * `spirit_state.morning` is an object,
--   * it carries a `protocol` object (the loader's own test for an entry),
--   * and `morning.date` equals the row's `date`.
-- Anything else is refused with SQLSTATE CK001 and nothing is written. The
-- client reads CK001 as "the entry is not in the row", which is a different
-- message and a different Retry from a network failure.
--
-- The date clause covers the pre-fix rows: before FOR-228 ruling 2 the row was
-- keyed on the calendar day while the entry carried the 4am-cutoff day, so a
-- 1am finish sat in the next day's row with another day's date inside it. A
-- tick is never written onto one of those now.
--
-- A SUB-PATH WRITE ON A MISSING ROW IS REFUSED, not inserted. The sub-path case
-- is an UPDATE, never the upsert: there is no row to hold an entry, so there is
-- nothing to patch. `{morning}` whole, every other spirit_state path, and every
-- mind_state write keep the upsert exactly as before.
--
-- ATOMIC WITH THE WRITE. The row is locked with SELECT ... FOR UPDATE, and then
-- the entry check runs inside the UPDATE's SET expression, a new statement
-- with a new snapshot, under that lock. So the check reads the row as the
-- write sees it, never as it was when the call began. The first draft had no
-- FOR UPDATE and relied on the UPDATE's own re-check after waiting; the proof
-- showed that fails in one direction, because an UPDATE builds its new value
-- from the scanned version BEFORE it waits, so a stale "no entry" refused while
-- the entry was being committed. The proof now holds the lock in one session
-- in both directions (removing the entry, and writing it) and shows the
-- waiting tick refused in the first and landed in the second.
--
-- A LIST THAT MIXES `{morning}` WHOLE WITH A SUB-PATH is judged before any of
-- it applies, so it is refused when the row has no entry even though its own
-- first patch would have made one. No writer sends that list. Generation and
-- the protocol Retry send `{morning}` alone.
--
-- WHY CK001. A SQLSTATE is five characters from 0-9 and A-Z. Class CK is not a
-- standard class, so it cannot collide with a Postgres error, and PostgREST
-- passes an unknown SQLSTATE through as the error's `code`.
--
-- SECURITY. Unchanged from 20261003: SECURITY INVOKER, row addressed by
-- auth.uid(), never by an argument, column allowlisted before format(%I),
-- search_path pinned. The UPDATE runs under the same RLS policy as the upsert.
-- A row the caller cannot see updates nothing and is refused as CK001.
--
-- NOTHING CALLS IT YET. As of this file, production master
-- (`7892ad8`) does not call `checkin_patch` at all. The only caller is PR #34,
-- which is unmerged. Applying this changes the behaviour of no live client.
--
-- PROVEN BEFORE IT IS APPLIED: `npm run proof:checkin-entry` (needs Docker).
--
-- REVERT, both statements, in order:
--   1. re-apply supabase/migrations/20261003_checkin_set_path.sql in full. It
--      is four CREATE OR REPLACE FUNCTION statements and their grants, and
--      re-applying it is proven harmless, so it puts `checkin_patch` back to its
--      2026-10-03 body.
--   2. DROP FUNCTION IF EXISTS public.checkin_require_entry(jsonb, date);
--      DROP FUNCTION IF EXISTS public.checkin_patch_needs_entry(text, jsonb);
-- The proof runs exactly that revert and checks the body matches.

-- ── 1. does this call write beneath the morning entry? ──────────────────────
-- True when the column is spirit_state and any patch's path is `morning`
-- followed by at least one more key. A malformed list answers false here and
-- is refused by checkin_jsonb_apply with its own message.
CREATE OR REPLACE FUNCTION public.checkin_patch_needs_entry(
  p_column  text,
  p_patches jsonb
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $fn$
  SELECT p_column = 'spirit_state'
     AND jsonb_typeof(p_patches) = 'array'
     AND EXISTS (
       SELECT 1
         FROM jsonb_array_elements(p_patches) AS p(patch)
        WHERE jsonb_typeof(p.patch) = 'object'
          AND jsonb_typeof(p.patch -> 'path') = 'array'
          AND jsonb_array_length(p.patch -> 'path') >= 2
          AND (p.patch -> 'path') -> 0 = '"morning"'::jsonb
     )
$fn$;

-- ── 2. the entry must be there, and be this row's own day ───────────────────
-- Returns the column unchanged, or raises CK001. Called inside the UPDATE's SET
-- so it reads the locked row version.
--
-- THE DATE IS COMPARED AS THE CALENDAR DAY, built from its own fields (Codex
-- draft pass 1). The first draft used to_char(p_date, 'YYYY-MM-DD'), which
-- (a) returns NULL for 'infinity', so a NULL entry date matched it, (b) drops
-- the BC era, so an AD string matched a BC row, and (c) goes through a
-- timestamptz conversion, so in a zone that skipped a day (Pacific/Apia,
-- 2011-12-30) it named the wrong day. Now: the row's date must be finite and
-- AD, the entry's date must be a JSON STRING, and the string is compared with
-- the year, month and day extracted from the date itself. EXTRACT on a `date`
-- reads its fields with no time zone involved, so this is IMMUTABLE honestly.
CREATE OR REPLACE FUNCTION public.checkin_require_entry(
  doc    jsonb,
  p_date date
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_day text;
BEGIN
  IF p_date IS NOT NULL AND isfinite(p_date) AND EXTRACT(year FROM p_date) BETWEEN 1 AND 9999 THEN
    v_day := lpad(EXTRACT(year FROM p_date)::int::text, 4, '0') || '-'
          || lpad(EXTRACT(month FROM p_date)::int::text, 2, '0') || '-'
          || lpad(EXTRACT(day FROM p_date)::int::text, 2, '0');
  END IF;

  IF v_day IS NULL
     OR jsonb_typeof(doc -> 'morning') IS DISTINCT FROM 'object'
     OR jsonb_typeof(doc #> '{morning,protocol}') IS DISTINCT FROM 'object'
     OR jsonb_typeof(doc #> '{morning,date}') IS DISTINCT FROM 'string'
     OR (doc #>> '{morning,date}') IS DISTINCT FROM v_day THEN
    RAISE EXCEPTION 'checkin_patch: no morning entry for % in this row', p_date
      USING ERRCODE = 'CK001';
  END IF;
  RETURN doc;
END;
$fn$;

-- ── 3. checkin_patch, with the entry rule ───────────────────────────────────
-- Identical to the 2026-10-03 body except for the branch marked NEW.
CREATE OR REPLACE FUNCTION public.checkin_patch(
  p_date    date,
  p_column  text,
  p_patches jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_uid  uuid := auth.uid();
  v_rows bigint;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'checkin_patch: no authenticated user'
      USING ERRCODE = '28000';
  END IF;

  -- Allowlisted BEFORE it reaches format(%I). %I makes injection impossible,
  -- but without this a caller could patch any jsonb column on the table.
  IF p_column IS NULL OR p_column NOT IN ('spirit_state', 'mind_state') THEN
    RAISE EXCEPTION 'checkin_patch: % is not a check-in column', p_column
      USING ERRCODE = '22023';
  END IF;

  IF p_date IS NULL THEN
    RAISE EXCEPTION 'checkin_patch: date is required'
      USING ERRCODE = '22023';
  END IF;

  -- NEW (2026-10-09). Beneath the morning entry: UPDATE only, and only onto an
  -- entry for this row's own day. No row, or no entry, or another day's entry,
  -- and nothing is written.
  IF public.checkin_patch_needs_entry(p_column, p_patches) THEN
    -- Lock the row FIRST, in its own statement. An UPDATE computes its new
    -- value from the row version its snapshot scanned, BEFORE it tries to lock
    -- that row, so on its own the entry check raised against a stale version
    -- that had no entry while another session was committing one (measured by
    -- the proof, which then failed). FOR UPDATE waits for that session, and the
    -- UPDATE below is a new statement with a new snapshot, so it reads what
    -- the lock holder left.
    --
    -- A ROW THAT DOES NOT EXIST YET LOCKS NOTHING (Codex draft pass 1). If a
    -- concurrent session inserts it and commits between this SELECT and the
    -- UPDATE, the UPDATE's new snapshot sees it and patches it — and that is
    -- still judged: the entry check runs inside the UPDATE against that row,
    -- so it lands only if the inserted row holds this day's entry. If the
    -- insert has not committed by then, the UPDATE finds no row and the patch
    -- is refused. Either way the rule holds; what is not promised is WHICH of
    -- the two a racing insert gets.
    EXECUTE 'SELECT 1 FROM public.daily_checkins WHERE user_id = $1 AND date = $2 FOR UPDATE'
      USING v_uid, p_date;
    EXECUTE format($q$
      UPDATE public.daily_checkins
         SET %1$I = public.checkin_jsonb_apply(public.checkin_require_entry(daily_checkins.%1$I, $2), $3),
             updated_at = now()
       WHERE user_id = $1 AND date = $2
    $q$, p_column)
    USING v_uid, p_date, p_patches;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
      RAISE EXCEPTION 'checkin_patch: no check-in row for % to hold a morning entry', p_date
        USING ERRCODE = 'CK001';
    END IF;
    RETURN;
  END IF;

  -- One statement. The right-hand side of DO UPDATE reads the row as it is now,
  -- inside the statement that writes it, so a concurrent call to a different
  -- path cannot be lost and cannot carry this call's values.
  EXECUTE format($q$
    INSERT INTO public.daily_checkins (user_id, date, %1$I, updated_at)
    VALUES ($1, $2, public.checkin_jsonb_apply('{}'::jsonb, $3), now())
    ON CONFLICT (user_id, date) DO UPDATE
       SET %1$I = public.checkin_jsonb_apply(daily_checkins.%1$I, $3),
           updated_at = now()
  $q$, p_column)
  USING v_uid, p_date, p_patches;
END;
$fn$;

-- WHO MAY CALL THESE: the same grants as 20261003, for the same reasons. anon
-- is named because Supabase's default privileges grant it EXECUTE on new
-- public functions as a role grant, which REVOKE ... FROM PUBLIC leaves alone.
REVOKE ALL ON FUNCTION public.checkin_patch_needs_entry(text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.checkin_require_entry(jsonb, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.checkin_patch(date, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checkin_patch_needs_entry(text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.checkin_require_entry(jsonb, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.checkin_patch(date, text, jsonb) TO authenticated, service_role;
