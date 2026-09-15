-- ── Fuel: the write-side guard (FOR-233) ────────────────────────────────────
-- A tick may land only on the NEWEST version of its cycle. A list whose plan
-- has been superseded — a newer version of the same start, built here or in
-- another tab — refuses the tick with SQLSTATE FU001, never writes it, and
-- the page re-reads and moves to the newer list. The cycle model (page.tsx)
-- makes a failed refresh visible; only this guard makes the write correct.
--
-- Same signature, same owner test, same SECURITY INVOKER as phase 1; the
-- REVOKE is repeated because CREATE OR REPLACE keeps grants but the intent
-- belongs in the file. Dated after 20260915_fuel_macro_columns.sql so it
-- sorts after the table and function it replaces. Idempotent.

CREATE OR REPLACE FUNCTION public.fuel_set_item_checked(p_list_id uuid, p_key text, p_checked boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  new_items jsonb;
  v_plan_id uuid;
BEGIN
  SELECT plan_id INTO v_plan_id FROM public.fuel_lists WHERE id = p_list_id AND user_id = auth.uid();
  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'fuel list % is not yours or does not exist', p_list_id USING ERRCODE = '42501';
  END IF;
  -- FOR-233: superseded lists refuse ticks. Newer = same user, same start, higher version.
  IF EXISTS (
    SELECT 1
    FROM public.fuel_plans p
    JOIN public.fuel_plans newer
      ON newer.user_id = p.user_id AND newer.week_start = p.week_start AND newer.version > p.version
    WHERE p.id = v_plan_id
  ) THEN
    RAISE EXCEPTION 'fuel list % is superseded by a newer version of its cycle', p_list_id USING ERRCODE = 'FU001';
  END IF;
  UPDATE public.fuel_lists
  SET items = (
        SELECT COALESCE(
          jsonb_agg(
            CASE WHEN elem->>'key' = p_key THEN jsonb_set(elem, '{checked}', to_jsonb(p_checked), true) ELSE elem END
            ORDER BY ord
          ), '[]'::jsonb)
        FROM jsonb_array_elements(items) WITH ORDINALITY AS t(elem, ord)
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
REVOKE EXECUTE ON FUNCTION public.fuel_set_item_checked(uuid, text, boolean) FROM PUBLIC, anon;
