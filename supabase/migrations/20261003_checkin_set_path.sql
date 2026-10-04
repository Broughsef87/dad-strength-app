-- ── Check-ins: write your own fields, not the whole entry (FOR-231 v2) ──────
-- Andrew's ruling, 2026-10-03: field-level writes through a jsonb-merge
-- function. Accepting last-write-wins was rejected (one user, one tab, and a
-- tick undone in the database). Serializing the writers is a queue and stays
-- out. Revised 2026-10-04 on Blaine's review of the draft — see THE ROOT WRITE
-- IS GONE below.
--
-- THE DEFECT THIS EXISTS FOR. `daily_checkins.spirit_state` has four writers —
-- generation, a step tick, gratitude leaving its field, and the Goals step —
-- and every one of them sent the WHOLE entry. Two that overlap clobber each
-- other's fields: tick a step, then leave a gratitude input before that write
-- lands, and the gratitude write carries the completion flags it read before
-- the tick. The tick is undone in the row while the screen still shows it
-- ticked. Deleting localStorage did not cause this and did not cure it; there
-- is no cache, no queue, no outbox and no retained state anywhere near it. It
-- is four whole-entry writers on one jsonb column.
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
-- SEVERAL PATHS IN ONE CALL, for the same reason. `mind_state.objectives` and
-- `mind_state.completedObjectives` are paired BY INDEX — the render path and
-- normalise() both assume objective i owns flag i. Written as two calls they
-- are two statements, and between them the row holds a new objective list
-- against the old list's flags: three flags for two objectives, or a completion
-- sitting on the wrong line. So `checkin_patch` takes a LIST of patches and
-- applies them inside one statement. `checkin_set_path` is the single-patch
-- case, and is a wrapper over it.
--
-- THE ROOT WRITE IS GONE (Blaine's draft review, 2026-10-04). The first draft
-- let an empty path replace a whole column, and justified it as the write that
-- creates the record, where there is nothing yet to clobber. **That is false on
-- Rebuild.** `MorningProtocol.tsx` Rebuild clears `configured`, the Goals step
-- runs again on a row that already exists, and it wrote `mind_state` whole with
-- every completion flag false — wiping ticked objectives today, and after
-- FOR-229 wiping the 1–5 spiritual rating and any carried-over item too, since
-- both live in `mind_state`. A guard that holds only until someone presses
-- Rebuild is a convention rather than a guard, so the capability is removed:
-- **a path must name at least one key, and replacing a whole column is now
-- unrepresentable.** Nothing needs it — generation writes `{morning}`, which is
-- a path, and the Goals step writes its own four keys.
--
-- THE PATHS, so a reviewer can see what each writer owns and what it cannot
-- reach:
--
--   generation / rebuild   spirit_state  {morning}
--   a step tick            spirit_state  {morning,completed}
--   gratitude on blur      spirit_state  {morning,gratitude}
--   the Goals step         mind_state    {objectives} {completedObjectives}
--                                        {lockedIn} {date}   — ONE atomic call
--   an objective tick      mind_state    {completedObjectives}
--   FOR-229's rating       mind_state    {spiritual}         — survives all of
--   FOR-229's carry-over   mind_state    on TOMORROW's row     the above
--
-- `spirit_state {morning}` whole on generation and rebuild stays: a new
-- protocol resets its own completion and gratitude, and nothing else lives
-- under `morning`.
--
-- A REBUILD DOES NOT KEEP TICKS, and that one was left to me. The Goals step
-- rewrites `{objectives}` and `{completedObjectives}` together, so completion
-- resets for the new list. Keeping a tick across a rewrite means matching
-- objective TEXT to decide which flag survives, and FOR-243 is the standing
-- evidence for where that goes: a tick carried to the wrong line is the
-- dangerous failure, because unticked costs one tap and wrongly ticked is a
-- lie. Resetting is the safe direction. Keys the Goals step does not own are
-- untouched, which is what the ruling actually required.
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
-- ADDITIVE. Four CREATE OR REPLACE FUNCTION statements and their grants. No
-- table, column, policy, index or data change, and no existing row is touched.
-- Nothing calls it yet: the client converts to it in a follow-up commit, after
-- Andrew has applied this.
--
-- PROVEN BEFORE IT IS APPLIED: `npm run proof:checkins`.
--
-- NOT INDEPENDENTLY REVIEWED. The ruling asked for two Codex passes on this
-- draft before it is applied. Codex is refusing every model for this account
-- ("The 'gpt-6.1-sol' model is not supported when using Codex with a ChatGPT
-- account"), after working earlier the same day, so those passes did not run.
-- What follows is my own review against the same five criteria, which is not a
-- substitute for an independent one. It found two defects, both fixed above:
--
--   1. A path THROUGH a non-object destroyed it. {morning,completed,0} on
--      {"morning":{"completed":[true,false]}} replaced the array with {} and
--      set "0". A missing ancestor is still created; one that exists and is
--      not an object now raises.
--   2. search_path was pinned on the two writers and not on the two helpers.
--      Now pinned on all four.
--
-- CONCURRENCY IS DEMONSTRATED, not just argued. The sibling cases run two
-- writes sequentially, which proves the merge keeps siblings and says nothing
-- about interleaving. So the proof also opens two sessions: the first writes
-- and then HOLDS the row lock, the second writes a different path, blocks for
-- over a second, and applies to the first's result. Both values survive.
--
-- A numeric path key is still an array index to jsonb_set, which is Postgres
-- behaviour rather than a defect here: no writer uses one, and a path through
-- an array now raises before it can reach that.
--
-- REVERT:
--   DROP FUNCTION IF EXISTS public.checkin_set_path(date, text, text[], jsonb);
--   DROP FUNCTION IF EXISTS public.checkin_patch(date, text, jsonb);
--   DROP FUNCTION IF EXISTS public.checkin_jsonb_apply(jsonb, jsonb);
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
SET search_path = public, pg_temp
AS $fn$
DECLARE
  out_doc jsonb := COALESCE(doc, '{}'::jsonb);
  i       int;
BEGIN
  -- A path must name at least one key. Replacing a whole column is not a thing
  -- this function can do (see THE ROOT WRITE IS GONE).
  IF path IS NULL OR array_length(path, 1) IS NULL THEN
    RAISE EXCEPTION 'checkin: a path must name at least one key'
      USING ERRCODE = '22023';
  END IF;

  -- A column holding a scalar or an array cannot be patched by path. Treat it
  -- as absent rather than raising: the record is the row, and a row whose
  -- column is not an object holds no record to preserve.
  IF jsonb_typeof(out_doc) IS DISTINCT FROM 'object' THEN
    out_doc := '{}'::jsonb;
  END IF;

  -- An ancestor that is MISSING gets created. An ancestor that exists and is
  -- not an object is refused, never replaced: a path through an array would
  -- otherwise destroy it. {morning,completed,0} on
  -- {"morning":{"completed":[true,false]}} replaced the array with {} and set
  -- "0", turning two flags into {"0": true}. Silent loss, so it raises.
  FOR i IN 1 .. array_length(path, 1) - 1 LOOP
    IF out_doc #> path[1:i] IS NULL THEN
      out_doc := jsonb_set(out_doc, path[1:i], '{}'::jsonb, true);
    ELSIF jsonb_typeof(out_doc #> path[1:i]) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'checkin: % is a %, so nothing can be patched beneath it',
        array_to_string(path[1:i], '.'), jsonb_typeof(out_doc #> path[1:i])
        USING ERRCODE = '22023';
    END IF;
  END LOOP;

  RETURN jsonb_set(out_doc, path, COALESCE(val, 'null'::jsonb), true);
END;
$fn$;

-- ── 2. fold a list of patches over one document ─────────────────────────────
-- `patches` is a jsonb array of {"path": ["a","b"], "value": <any>}, applied
-- left to right. Called once inside the write statement, so every patch in a
-- call lands together or none of them does.
CREATE OR REPLACE FUNCTION public.checkin_jsonb_apply(
  doc     jsonb,
  patches jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $fn$
DECLARE
  out_doc jsonb := COALESCE(doc, '{}'::jsonb);
  patch   jsonb;
  path    text[];
BEGIN
  IF patches IS NULL OR jsonb_typeof(patches) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'checkin: patches must be a jsonb array'
      USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(patches) = 0 THEN
    RAISE EXCEPTION 'checkin: at least one patch is required'
      USING ERRCODE = '22023';
  END IF;

  FOR patch IN SELECT * FROM jsonb_array_elements(patches) LOOP
    IF jsonb_typeof(patch) IS DISTINCT FROM 'object'
       OR jsonb_typeof(patch -> 'path') IS DISTINCT FROM 'array'
       OR NOT (patch ? 'value') THEN
      RAISE EXCEPTION 'checkin: each patch needs an array path and a value, got %', patch
        USING ERRCODE = '22023';
    END IF;
    -- Every element of the path must be a string, or #> would address an array
    -- index and a typo could write into the wrong place silently.
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(patch -> 'path') AS k
      WHERE jsonb_typeof(k.value) IS DISTINCT FROM 'string'
    ) THEN
      RAISE EXCEPTION 'checkin: every key in a path must be a string, got %', patch -> 'path'
        USING ERRCODE = '22023';
    END IF;

    SELECT array_agg(k.value #>> '{}' ORDER BY k.ord)
      INTO path
      FROM jsonb_array_elements(patch -> 'path') WITH ORDINALITY AS k(value, ord);

    out_doc := public.checkin_jsonb_set_deep(out_doc, path, patch -> 'value');
  END LOOP;

  RETURN out_doc;
END;
$fn$;

-- ── 3. write those patches into one check-in, as the caller, atomically ─────
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
  v_uid uuid := auth.uid();
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

-- ── 4. the single-patch case ────────────────────────────────────────────────
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
BEGIN
  IF p_path IS NULL OR array_length(p_path, 1) IS NULL THEN
    RAISE EXCEPTION 'checkin_set_path: a path must name at least one key'
      USING ERRCODE = '22023';
  END IF;
  PERFORM public.checkin_patch(
    p_date,
    p_column,
    jsonb_build_array(jsonb_build_object('path', to_jsonb(p_path), 'value', COALESCE(p_value, 'null'::jsonb)))
  );
END;
$fn$;

-- Only a signed-in athlete calls these. An anonymous caller would raise 28000
-- on auth.uid() anyway; this keeps the grant honest about who it is for.
REVOKE ALL ON FUNCTION public.checkin_jsonb_set_deep(jsonb, text[], jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.checkin_jsonb_apply(jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.checkin_patch(date, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.checkin_set_path(date, text, text[], jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.checkin_jsonb_set_deep(jsonb, text[], jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkin_jsonb_apply(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkin_patch(date, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.checkin_set_path(date, text, text[], jsonb) TO authenticated;
