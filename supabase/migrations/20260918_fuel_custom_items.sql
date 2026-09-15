-- ── Fuel: the athlete's own items (FOR-240) ─────────────────────────────────
-- Recurring staples and one-offs: lines on the list the solver has never heard
-- of. Hand-written, not generated — no fixture carries user data.
--
-- THE CHOICE, stated where the merge happens (FOR-240 §4): custom lines are
-- merged into fuel_lists.items — one items array, one tick path, one guard.
-- A staple lives in fuel_staples and is merged when a version is created, so
-- regeneration carries it and cannot delete it. A one-off, or a staple added
-- mid-cycle, is appended to THIS list through fuel_add_custom_item, which
-- takes the same per-cycle lock and refuses a superseded list with FU001
-- exactly as fuel_set_item_checked does. A staple edited or removed reaches
-- future lists only; a list already built keeps its copy.
--
-- Custom keys live in a namespace the solver cannot mint: a solver key is
-- section:item:unit and always holds a colon; a custom key is 'custom~' and
-- letters and digits only, never a colon.
--
-- A version is written through fuel_create_version_with_staples. The database
-- is the ONLY source of staple lines (Andrew's ruling A, after Codex rounds 1
-- and 2 found two sources): it drops every custom line the client sends and
-- rebuilds the staples from its own read under the version's per-cycle lock,
-- then writes through fuel_create_version, unchanged.
--
-- Additive: one new table, three new functions. Nothing existing changes.
-- Dated after 20260917 so it sorts after everything it references.

-- ── fuel_staples: on every list, every cycle, until removed ──────────────────
CREATE TABLE IF NOT EXISTS public.fuel_staples (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item          text NOT NULL CHECK (char_length(btrim(item)) BETWEEN 1 AND 80),
  store_section text NOT NULL CHECK (char_length(btrim(store_section)) BETWEEN 1 AND 40),
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- Removal is deliberate and scoped to future lists: a removed staple keeps
  -- its row, stamped, and is simply not merged again. Nothing is hard-deleted
  -- through the app — there is no DELETE policy.
  removed_at    timestamptz
);
ALTER TABLE public.fuel_staples ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fuel_staples: owner reads" ON public.fuel_staples;
CREATE POLICY "fuel_staples: owner reads" ON public.fuel_staples
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "fuel_staples: owner adds" ON public.fuel_staples;
CREATE POLICY "fuel_staples: owner adds" ON public.fuel_staples
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "fuel_staples: owner removes" ON public.fuel_staples;
CREATE POLICY "fuel_staples: owner removes" ON public.fuel_staples
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- One active staple per item per aisle, so adding coffee twice is one coffee.
CREATE UNIQUE INDEX IF NOT EXISTS fuel_staples_one_active
  ON public.fuel_staples (user_id, lower(btrim(item)), store_section) WHERE removed_at IS NULL;
DROP TRIGGER IF EXISTS fuel_staples_pro_gate ON public.fuel_staples;
CREATE TRIGGER fuel_staples_pro_gate BEFORE INSERT OR UPDATE ON public.fuel_staples
  FOR EACH ROW EXECUTE FUNCTION public.enforce_fuel_pro();

-- ── Add a custom line to ONE list: a one-off, or a staple added mid-cycle ────
-- p_staple_id: the staple's own line, keyed on its id so it matches the line
-- every future version merges — added once, however often it is asked for.
-- Otherwise a one-off, with its item and section as given.
CREATE OR REPLACE FUNCTION public.fuel_add_custom_item(p_list_id uuid, p_item text, p_section text, p_staple_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_plan_id uuid;
  v_week_start date;
  v_item text := btrim(coalesce(p_item, ''));
  v_section text := btrim(coalesce(p_section, ''));
  v_kind text := 'one-off';
  v_key text;
  new_items jsonb;
BEGIN
  SELECT l.plan_id, p.week_start INTO v_plan_id, v_week_start
  FROM public.fuel_lists l JOIN public.fuel_plans p ON p.id = l.plan_id
  WHERE l.id = p_list_id AND l.user_id = auth.uid();
  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'fuel list % is not yours or does not exist', p_list_id USING ERRCODE = '42501';
  END IF;
  IF p_staple_id IS NOT NULL THEN
    SELECT btrim(item), btrim(store_section) INTO v_item, v_section
    FROM public.fuel_staples WHERE id = p_staple_id AND user_id = auth.uid() AND removed_at IS NULL;
    IF v_item IS NULL THEN
      RAISE EXCEPTION 'staple % is not yours, or was removed', p_staple_id USING ERRCODE = '42501';
    END IF;
    v_kind := 'staple';
    v_key := 'custom~' || replace(p_staple_id::text, '-', '');
  ELSE
    v_key := 'custom~' || replace(gen_random_uuid()::text, '-', '');
  END IF;
  IF char_length(v_item) NOT BETWEEN 1 AND 80 OR char_length(v_section) NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'a custom item needs a name of 1 to 80 characters and a section' USING ERRCODE = '22023';
  END IF;
  -- The same per-cycle lock and the same refusal as a tick: a line never lands
  -- on a list its cycle has superseded (FOR-233).
  PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text || ':' || v_week_start::text));
  IF EXISTS (
    SELECT 1 FROM public.fuel_plans p
    JOIN public.fuel_plans newer ON newer.user_id = p.user_id AND newer.week_start = p.week_start AND newer.version > p.version
    WHERE p.id = v_plan_id
  ) THEN
    RAISE EXCEPTION 'fuel list % is superseded by a newer version of its cycle', p_list_id USING ERRCODE = 'FU001';
  END IF;
  UPDATE public.fuel_lists
  SET items = CASE
        WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(items) AS e WHERE e->>'key' = v_key) THEN items
        ELSE items || jsonb_build_array(jsonb_build_object(
          'key', v_key, 'item', v_item, 'qty', 0, 'unit', '', 'section', v_section, 'from', '[]'::jsonb,
          'second_trip', false, 'inferred', false, 'stocked', false, 'checked', false, 'custom', v_kind))
      END,
      updated_at = now()
  WHERE id = p_list_id AND user_id = auth.uid()
  RETURNING items INTO new_items;
  IF new_items IS NULL THEN
    RAISE EXCEPTION 'fuel list % is not yours or does not exist', p_list_id USING ERRCODE = '42501';
  END IF;
  RETURN new_items;
END
$$;
REVOKE EXECUTE ON FUNCTION public.fuel_add_custom_item(uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fuel_add_custom_item(uuid, text, text, uuid) TO authenticated;

-- ── Take a custom line off ONE list ──────────────────────────────────────────
-- Only a custom key: a solver line is never removed this way — the solver
-- decides those, on the next version.
CREATE OR REPLACE FUNCTION public.fuel_remove_custom_item(p_list_id uuid, p_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_plan_id uuid;
  v_week_start date;
  new_items jsonb;
BEGIN
  IF p_key IS NULL OR p_key !~ '^custom~[A-Za-z0-9]+$' THEN
    RAISE EXCEPTION 'only a custom line can be removed from a list' USING ERRCODE = '22023';
  END IF;
  SELECT l.plan_id, p.week_start INTO v_plan_id, v_week_start
  FROM public.fuel_lists l JOIN public.fuel_plans p ON p.id = l.plan_id
  WHERE l.id = p_list_id AND l.user_id = auth.uid();
  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'fuel list % is not yours or does not exist', p_list_id USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text || ':' || v_week_start::text));
  IF EXISTS (
    SELECT 1 FROM public.fuel_plans p
    JOIN public.fuel_plans newer ON newer.user_id = p.user_id AND newer.week_start = p.week_start AND newer.version > p.version
    WHERE p.id = v_plan_id
  ) THEN
    RAISE EXCEPTION 'fuel list % is superseded by a newer version of its cycle', p_list_id USING ERRCODE = 'FU001';
  END IF;
  UPDATE public.fuel_lists
  SET items = (
        SELECT COALESCE(jsonb_agg(elem ORDER BY ord), '[]'::jsonb)
        FROM jsonb_array_elements(items) WITH ORDINALITY AS t(elem, ord)
        WHERE elem->>'key' <> p_key
      ),
      updated_at = now()
  WHERE id = p_list_id AND user_id = auth.uid()
  RETURNING items INTO new_items;
  IF new_items IS NULL THEN
    RAISE EXCEPTION 'fuel list % is not yours or does not exist', p_list_id USING ERRCODE = '42501';
  END IF;
  RETURN new_items;
END
$$;
REVOKE EXECUTE ON FUNCTION public.fuel_remove_custom_item(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fuel_remove_custom_item(uuid, text) TO authenticated;

-- ── A new version: the solver's lines as sent, every staple line rebuilt here ─
-- The database is the ONLY source of staple lines (FOR-240, Andrew's ruling A).
-- Codex rounds 1 and 2 were one cause, two sources: a client read of the
-- staples, and this function's. The client sends the solver's lines only; a
-- custom line it sends anyway is stale by definition and is dropped. This takes
-- the per-cycle lock FIRST, then reads the staples still on and rebuilds every
-- staple line from that read: a staple saved in the gap is on the new version,
-- one stopped in the gap is not, and a staple line can only have reached the
-- version this supersedes by holding this same lock. A stop that commits after
-- this read is after this build, and the list built first keeps its copy, as
-- any list built before a stop does. The write goes through fuel_create_version
-- unchanged; advisory transaction locks are re-entrant, so it takes the lock
-- again as a no-op. It answers with the items it stored, and the page holds
-- exactly those.
CREATE OR REPLACE FUNCTION public.fuel_create_version_with_staples(p_week_start date, p_meal_ids jsonb, p_rules_snapshot jsonb, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_items jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text || ':' || p_week_start::text));
  -- The client's lines with every custom one taken out: a custom key is 'custom~' and never holds a colon.
  SELECT COALESCE(jsonb_agg(c.elem ORDER BY c.ord), '[]'::jsonb)
    INTO v_items
  FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) WITH ORDINALITY AS c(elem, ord)
  WHERE NOT (COALESCE(c.elem->>'key', '') LIKE 'custom~%' AND strpos(COALESCE(c.elem->>'key', ''), ':') = 0);
  -- Every staple line, rebuilt from the staples still on, read under the lock.
  SELECT v_items || COALESCE(jsonb_agg(jsonb_build_object(
           'key', 'custom~' || replace(s.id::text, '-', ''), 'item', btrim(s.item), 'qty', 0, 'unit', '', 'section', s.store_section,
           'from', '[]'::jsonb, 'second_trip', false, 'inferred', false, 'stocked', false, 'checked', false, 'custom', 'staple'
         ) ORDER BY s.created_at, s.id), '[]'::jsonb)
    INTO v_items
  FROM public.fuel_staples s
  WHERE s.user_id = auth.uid() AND s.removed_at IS NULL;
  RETURN public.fuel_create_version(p_week_start, p_meal_ids, p_rules_snapshot, v_items) || jsonb_build_object('items', v_items);
END
$$;
REVOKE EXECUTE ON FUNCTION public.fuel_create_version_with_staples(date, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fuel_create_version_with_staples(date, jsonb, jsonb, jsonb) TO authenticated;
