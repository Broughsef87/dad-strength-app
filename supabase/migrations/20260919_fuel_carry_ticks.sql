-- ── Fuel: a tick survives a rebuild (FOR-243) ───────────────────────────────
-- "Change the plan", alter one night, rebuild — and every tick on the shopping
-- list was gone, including ticks on lines the change never touched. Half a
-- trolley in, one swap, and a 33-line list reset to zero. No warning: the
-- button says "change the plan", not "start your shop over".
--
-- WHERE THIS LIVES, and why it is SQL and not client code. FOR-243 §4 asks for
-- the carry at version creation, in the same place the staple rebuild happens,
-- so there is ONE merge point rather than two. Since FOR-240 that place is this
-- trigger — Andrew's ruling on the third provenance finding: one rebuild site
-- for every writer. Doing it in the client would put the second merge point
-- back, and a client can only copy from the list ITS tab is holding, so a tick
-- made in another tab would be dropped silently. The database already holds the
-- per-cycle lock here, so its read cannot race a write in either direction.
--
-- THE IDENTITY IS THE KEY (§4): section, item, unit and trip. A line present on
-- both versions keeps its tick. A quantity change is NOT an identity change —
-- six pounds of chicken instead of four is the same line and keeps its tick.
-- A line whose key changed is a different line and starts unticked, and it
-- inherits nothing from the line it replaced: carrying a tick to the WRONG line
-- is the dangerous failure (§7), because unticked means check the shelf and
-- wrongly ticked means walk past it. Every ambiguous case falls to unticked,
-- because a key that is not in both lists is simply not in the ticked set.
--
-- THE DATABASE DECIDES A TICK, not the client. `checked` on a new row is set
-- from the previous version and from nothing else — the client solves the list
-- fresh and sends checked:false on every line, and anything it does send is
-- overwritten. That is the same rule the staple lines already follow, now
-- covering the whole row.
--
-- Old versions are untouched: this is BEFORE INSERT, so a version already built
-- keeps the ticks it had (§3, AC5). Ticks made after a version exists go
-- through fuel_set_item_checked, which UPDATEs and never fires this.
--
-- Additive and reversible: CREATE OR REPLACE on one trigger function. No table,
-- column, policy, grant or data change, and no new object. A revert is the body
-- from 20260918. Dated after 20260918, whose function this replaces.

CREATE OR REPLACE FUNCTION public.fuel_lists_rebuild_staples()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_week_start date;
  v_items jsonb;
  v_ticked jsonb;
BEGIN
  SELECT p.week_start INTO v_week_start FROM public.fuel_plans p WHERE p.id = NEW.plan_id;
  IF v_week_start IS NULL THEN
    RAISE EXCEPTION 'fuel list for plan % has no plan the writer can read', NEW.plan_id USING ERRCODE = '23503';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text || ':' || v_week_start::text));
  -- The row's lines with every custom one taken out: a custom key is 'custom~' and never holds a colon.
  SELECT COALESCE(jsonb_agg(c.elem ORDER BY c.ord), '[]'::jsonb)
    INTO v_items
  FROM jsonb_array_elements(COALESCE(NEW.items, '[]'::jsonb)) WITH ORDINALITY AS c(elem, ord)
  WHERE NOT (COALESCE(c.elem->>'key', '') LIKE 'custom~%' AND strpos(COALESCE(c.elem->>'key', ''), ':') = 0);
  -- Every staple line, rebuilt from the staples still on, read under the lock.
  SELECT v_items || COALESCE(jsonb_agg(jsonb_build_object(
           'key', 'custom~' || replace(s.id::text, '-', ''), 'item', btrim(s.item), 'qty', 0, 'unit', '', 'section', s.store_section,
           'from', '[]'::jsonb, 'second_trip', false, 'inferred', false, 'stocked', false, 'checked', false, 'custom', 'staple'
         ) ORDER BY s.created_at, s.id), '[]'::jsonb)
    INTO v_items
  FROM public.fuel_staples s
  WHERE s.user_id = NEW.user_id AND s.removed_at IS NULL;

  -- FOR-243: the keys this cycle's previous version had ticked. The newest list
  -- below the row being inserted — "below", not "the one before", so a gap in
  -- version numbers cannot lose a shop. Read under the lock already held above.
  -- Nothing yet built for this cycle leaves the set empty, and a first version
  -- is unticked, which is right.
  SELECT COALESCE(jsonb_agg(e.value->>'key'), '[]'::jsonb) INTO v_ticked
  FROM (
    SELECT l.items
      FROM public.fuel_lists l
      JOIN public.fuel_plans p ON p.id = l.plan_id
     WHERE l.user_id = NEW.user_id AND p.week_start = v_week_start AND l.version < NEW.version
     ORDER BY l.version DESC
     LIMIT 1
  ) prev
  CROSS JOIN LATERAL jsonb_array_elements(prev.items) AS e(value)
  WHERE (e.value->>'checked')::boolean AND e.value->>'key' IS NOT NULL;

  -- Set from the previous version and from nothing else, staple lines included.
  -- A key absent from the set is unticked, so a line the rebuild invented, a
  -- line whose key changed, and a line the athlete unticked all come out
  -- unticked — and a tick the client tried to assert is overwritten.
  SELECT COALESCE(jsonb_agg(
           jsonb_set(c.elem, '{checked}', to_jsonb(COALESCE(v_ticked ? (c.elem->>'key'), false)))
           ORDER BY c.ord), '[]'::jsonb)
    INTO v_items
  FROM jsonb_array_elements(v_items) WITH ORDINALITY AS c(elem, ord);

  NEW.items := v_items;
  RETURN NEW;
END
$$;
