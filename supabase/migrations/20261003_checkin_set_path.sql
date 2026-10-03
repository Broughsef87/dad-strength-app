-- ── Check-ins: write one field, not the whole entry (FOR-231 v2) ────────────
-- Andrew's ruling, 2026-10-03, on the round-2 trigger: field-level writes
-- through a jsonb-merge function. Accepting last-write-wins was rejected (one
-- user, one tab, and a tick undone in the database). Serializing the writers is
-- a queue and stays out.
--
-- THE DEFECT THIS EXISTS FOR. `daily_checkins.spirit_state` has four writers —
-- generation, a step tick, gratitude leaving its field, and the Goals step —
-- and every one of them sent the WHOLE entry. Two that overlap clobber each
-- other's fields: tick a step, then leave a gratitude input before that write
-- lands, and the gratitude write carries the completion flags it read before
-- the tick. The tick is undone in the row while the screen still shows it
-- ticked. Deleting localStorage did not cause this and did not cure it; there is
-- no cache, no queue, no outbox and no retained state anywhere near it. It is
-- four whole-entry writers on one jsonb column.
--
-- THE MERGE HAS TO HAPPEN AT THE CONTENDED PATH. All four writers live under
-- `spirit_state.morning`, so a top-level `spirit_state || $new` still replaces
-- `morning` whole and fixes nothing at all. This patches BY PATH, so
-- `{morning,completed}` and `{morning,gratitude}` are independent writes that
-- cannot carry each other's values.
--
-- ONE STATEMENT, so it is atomic. The INSERT ... ON CONFLICT DO UPDATE reads
-- the existing value on its right-hand side, inside the same statement that
-- writes it. Two concurrent calls serialize on the row lock and the second
-- applies to the first's result, which is the whole point: neither needs to
-- know the other exists, and nothing has to decide which of them wins.
--
-- THE PATHS, so a reviewer can see they do not overlap:
--
--   generation / rebuild   spirit_state  {morning}                  whole entry
--   a step tick            spirit_state  {morning,completed}
--   gratitude on blur      spirit_state  {morning,gratitude}
--   the Goals step         mind_state    (root)                     whole entry
--   an objective tick      mind_state    {completedObjectives}
--
-- The two whole-entry writes are the ones that CREATE the record, which is the
-- one time writing everything is right — there is nothing yet to clobber. Every
-- write that changes an existing record touches one field. A root write is why
-- `p_path` may be empty, and it is the only reason.
--
-- SECURITY. SECURITY INVOKER, so row-level security applies to the caller and
-- the existing `auth.uid() = user_id` policy on daily_checkins decides every
-- row this touches (migration-003.sql: FOR ALL USING, which with no separate
-- WITH CHECK governs the insert too). The row is addressed by auth.uid() and
-- never by an argument, so there is no user_id to pass and none to forge. A
-- SECURITY DEFINER version would let a caller write another athlete's row.
-- `p_column` is checked against the two check-in columns before it reaches
-- format(%I), so the dynamic identifier cannot become some other column.
-- search_path is pinned.
--
-- ADDITIVE. Two CREATE OR REPLACE FUNCTION statements and their grants. No
-- table, column, policy, index or data change, and no existing row is touched.
-- Nothing calls it yet: the client converts to it in a follow-up commit, after
-- Andrew has applied this.
--
-- REVERT:
--   DROP FUNCTION IF EXISTS public.checkin_set_path(date, text, text[], jsonb);
--   DROP FUNCTION IF EXISTS public.checkin_jsonb_set_deep(jsonb, text[], jsonb);
--
-- Dated after 20260920_fuel_own_meals.sql, the last migration in this tree.

-- ── 1. set a value deep inside a document, creating the ancestors ───────────
-- jsonb_set's create_missing only creates the LAST key, so patching
-- {morning,completed} on an empty document returns the document UNCHANGED
-- rather than building `morning`. That silent no-op is the failure mode this
-- helper exists to remove: every ancestor is made an object first.
CREATE OR REPLACE FUNCTION public.checkin_jsonb_set_deep(
  doc  jsonb,
  path text[],
  val  jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  out_doc jsonb := COALESCE(doc, '{}'::jsonb);
  i       int;
BEGIN
  -- A column holding a scalar or an array cannot be patched by path. Treat it
  -- as absent rather than raising: the record is the row, and a row whose
  -- column is not an object holds no record to preserve.
  IF jsonb_typeof(out_doc) IS DISTINCT FROM 'object' THEN
    out_doc := '{}'::jsonb;
  END IF;

  -- An empty path means the whole column, which is the record-creating write.
  IF path IS NULL OR array_length(path, 1) IS NULL THEN
    RETURN COALESCE(val, '{}'::jsonb);
  END IF;

  FOR i IN 1 .. array_length(path, 1) - 1 LOOP
    IF jsonb_typeof(out_doc #> path[1:i]) IS DISTINCT FROM 'object' THEN
      out_doc := jsonb_set(out_doc, path[1:i], '{}'::jsonb, true);
    END IF;
  END LOOP;

  RETURN jsonb_set(out_doc, path, COALESCE(val, 'null'::jsonb), true);
END;
$fn$;

-- ── 2. write one field of one check-in, as the caller, atomically ───────────
CREATE OR REPLACE FUNCTION public.checkin_set_path(
  p_date   date,
  p_column text,
  p_path   text[],
  p_value  jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'checkin_set_path: no authenticated user'
      USING ERRCODE = '28000';
  END IF;

  -- Allowlisted BEFORE it reaches format(%I). %I makes injection impossible,
  -- but without this a caller could patch any jsonb column on the table.
  IF p_column IS NULL OR p_column NOT IN ('spirit_state', 'mind_state') THEN
    RAISE EXCEPTION 'checkin_set_path: % is not a check-in column', p_column
      USING ERRCODE = '22023';
  END IF;

  IF p_date IS NULL THEN
    RAISE EXCEPTION 'checkin_set_path: date is required'
      USING ERRCODE = '22023';
  END IF;

  -- One statement. The right-hand side of DO UPDATE reads the row as it is now,
  -- inside the statement that writes it, so a concurrent call to a different
  -- path cannot be lost and cannot carry this call's values.
  EXECUTE format($q$
    INSERT INTO public.daily_checkins (user_id, date, %1$I, updated_at)
    VALUES ($1, $2, public.checkin_jsonb_set_deep('{}'::jsonb, $3, $4), now())
    ON CONFLICT (user_id, date) DO UPDATE
       SET %1$I = public.checkin_jsonb_set_deep(daily_checkins.%1$I, $3, $4),
           updated_at = now()
  $q$, p_column)
  USING v_uid, p_date, p_path, p_value;
END;
$fn$;

-- Only a signed-in athlete calls these. An anonymous caller would raise 28000
-- on auth.uid() anyway; this keeps the grant honest about who it is for.
REVOKE ALL ON FUNCTION public.checkin_jsonb_set_deep(jsonb, text[], jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.checkin_set_path(date, text, text[], jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.checkin_jsonb_set_deep(jsonb, text[], jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkin_set_path(date, text, text[], jsonb) TO authenticated;
