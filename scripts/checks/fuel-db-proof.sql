-- ── Fuel database proof (FOR-240) ────────────────────────────────────────────
-- Run by scripts/fuel-db-proof.mjs (npm run proof:db) against a throwaway
-- Postgres after every Fuel migration has been applied. Everything runs in ONE
-- transaction and is rolled back. Each block raises 'FAIL …' on the first wrong
-- answer (ON_ERROR_STOP aborts) and NOTICEs 'PASS …' otherwise. The runner
-- counts the PASS notices against this file.
\set ON_ERROR_STOP 1
\set VERBOSITY terse
BEGIN;
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-000000000240', 'custom-items-test@example.invalid'),
  ('00000000-0000-4000-8000-0000000002ff', 'someone-else@example.invalid');

-- signed in as the athlete
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000240","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000240', true);
SET LOCAL ROLE authenticated;

DO $t$
DECLARE
  v jsonb; l1 uuid; l2 uuid; s1 uuid; s2 uuid; items jsonb; k_candles text; k_coffee text; n int;
BEGIN
  v := public.fuel_create_version('2026-09-21', '[]'::jsonb, '{}'::jsonb,
    '[{"key":"Pantry:rice:cup dry","item":"rice","qty":4,"unit":"cup dry","section":"Pantry","from":[],"second_trip":false,"inferred":true,"stocked":false,"checked":false}]'::jsonb);
  l1 := (v->>'list_id')::uuid;

  -- 1. a one-off lands on this list, trimmed, keyed in the custom namespace, no quantity
  items := public.fuel_add_custom_item(l1, '  birthday candles ', 'Pantry');
  SELECT e->>'key' INTO k_candles FROM jsonb_array_elements(items) e WHERE e->>'item' = 'birthday candles';
  IF jsonb_array_length(items) <> 2 OR k_candles IS NULL OR k_candles !~ '^custom~[0-9a-f]{32}$' THEN RAISE EXCEPTION 'FAIL one-off: %', items; END IF;
  IF (SELECT (e->>'qty')::numeric FROM jsonb_array_elements(items) e WHERE e->>'key' = k_candles) <> 0
     OR (SELECT e->>'custom' FROM jsonb_array_elements(items) e WHERE e->>'key' = k_candles) <> 'one-off' THEN RAISE EXCEPTION 'FAIL one-off shape: %', items; END IF;
  RAISE NOTICE 'PASS 1 a one-off lands on the list: trimmed, qty 0, custom one-off, key %', k_candles;

  -- 2. a one-off named like a solver line is a second line
  items := public.fuel_add_custom_item(l1, 'rice', 'Pantry');
  SELECT count(*) INTO n FROM jsonb_array_elements(items) e WHERE e->>'item' = 'rice';
  IF n <> 2 OR (SELECT count(DISTINCT e->>'key') FROM jsonb_array_elements(items) e WHERE e->>'item' = 'rice') <> 2 THEN RAISE EXCEPTION 'FAIL collision: %', items; END IF;
  RAISE NOTICE 'PASS 2 a custom rice beside the solver rice is two lines with two keys';

  -- 3. a staple's line is keyed on the staple; asked for twice, it is one line
  INSERT INTO public.fuel_staples (user_id, item, store_section) VALUES (auth.uid(), 'coffee', 'Snacks') RETURNING id INTO s1;
  k_coffee := 'custom~' || replace(s1::text, '-', '');
  PERFORM public.fuel_add_custom_item(l1, NULL, NULL, s1);
  items := public.fuel_add_custom_item(l1, 'ignored', 'ignored', s1);
  SELECT count(*) INTO n FROM jsonb_array_elements(items) e WHERE e->>'key' = k_coffee AND e->>'item' = 'coffee' AND e->>'section' = 'Snacks' AND e->>'custom' = 'staple';
  IF n <> 1 OR jsonb_array_length(items) <> 4 THEN RAISE EXCEPTION 'FAIL staple line: %', items; END IF;
  RAISE NOTICE 'PASS 3 a staple''s line is keyed on the staple, takes the staple''s name and aisle, and added twice is one line';

  -- 4. a tick on a custom line goes through the tick function and is on the row when read back
  PERFORM public.fuel_set_item_checked(l1, k_coffee, true);
  SELECT l.items INTO items FROM public.fuel_lists l WHERE l.id = l1;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(items) e WHERE e->>'key' = k_coffee AND (e->>'checked')::boolean) THEN RAISE EXCEPTION 'FAIL tick: %', items; END IF;
  RAISE NOTICE 'PASS 4 a tick on a custom line is on the row when it is read back';

  -- 5. remove takes one custom line off, and refuses a solver line
  items := public.fuel_remove_custom_item(l1, k_candles);
  IF jsonb_array_length(items) <> 3 OR EXISTS (SELECT 1 FROM jsonb_array_elements(items) e WHERE e->>'key' = k_candles) THEN RAISE EXCEPTION 'FAIL remove: %', items; END IF;
  BEGIN
    PERFORM public.fuel_remove_custom_item(l1, 'Pantry:rice:cup dry');
    RAISE EXCEPTION 'FAIL a solver line was removable';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  RAISE NOTICE 'PASS 5 remove takes a custom line off and refuses a solver key (22023)';

  -- 6. an empty name is refused; a stopped staple cannot be put on a list
  BEGIN PERFORM public.fuel_add_custom_item(l1, '   ', 'Pantry'); RAISE EXCEPTION 'FAIL an empty name was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  INSERT INTO public.fuel_staples (user_id, item, store_section) VALUES (auth.uid(), 'oat milk', 'Dairy') RETURNING id INTO s2;
  UPDATE public.fuel_staples SET removed_at = now() WHERE id = s2;
  BEGIN PERFORM public.fuel_add_custom_item(l1, NULL, NULL, s2); RAISE EXCEPTION 'FAIL a stopped staple was added';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
  RAISE NOTICE 'PASS 6 an empty name is refused (22023) and a stopped staple is refused (42501)';

  -- 7. one active staple per item per aisle; a stopped one does not count against it
  BEGIN INSERT INTO public.fuel_staples (user_id, item, store_section) VALUES (auth.uid(), ' Coffee', 'Snacks'); RAISE EXCEPTION 'FAIL a duplicate staple was accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  INSERT INTO public.fuel_staples (user_id, item, store_section) VALUES (auth.uid(), 'oat milk', 'Dairy');
  RAISE NOTICE 'PASS 7 the same staple twice is refused (23505); a stopped one can be added again';

  -- 8. nothing is deleted through the app: the owner's DELETE removes nothing
  DELETE FROM public.fuel_staples WHERE id = s1;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 OR NOT EXISTS (SELECT 1 FROM public.fuel_staples WHERE id = s1) THEN RAISE EXCEPTION 'FAIL a staple was deleted'; END IF;
  RAISE NOTICE 'PASS 8 a staple cannot be deleted through the app — there is no delete policy';

  -- 9. superseded: a newer version refuses an add and a remove on the old list and writes nothing; the newest list takes the add
  SELECT l.items INTO items FROM public.fuel_lists l WHERE l.id = l1;
  v := public.fuel_create_version('2026-09-21', '[]'::jsonb, '{}'::jsonb, '[]'::jsonb);
  l2 := (v->>'list_id')::uuid;
  BEGIN PERFORM public.fuel_add_custom_item(l1, 'late', 'Pantry'); RAISE EXCEPTION 'FAIL an add landed on a superseded list';
  EXCEPTION WHEN SQLSTATE 'FU001' THEN NULL; END;
  BEGIN PERFORM public.fuel_add_custom_item(l1, NULL, NULL, s1); RAISE EXCEPTION 'FAIL a staple line landed on a superseded list';
  EXCEPTION WHEN SQLSTATE 'FU001' THEN NULL; END;
  BEGIN PERFORM public.fuel_remove_custom_item(l1, k_coffee); RAISE EXCEPTION 'FAIL a remove landed on a superseded list';
  EXCEPTION WHEN SQLSTATE 'FU001' THEN NULL; END;
  IF (SELECT l.items FROM public.fuel_lists l WHERE l.id = l1) IS DISTINCT FROM items THEN RAISE EXCEPTION 'FAIL the superseded list changed'; END IF;
  items := public.fuel_add_custom_item(l2, 'fresh basil', 'Produce');
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(items) e WHERE e->>'item' = 'fresh basil' AND e->>'custom' = 'one-off') THEN RAISE EXCEPTION 'FAIL an add on the newest list: %', items; END IF;
  RAISE NOTICE 'PASS 9 a superseded list refuses an add, a staple line and a remove with FU001 and is unchanged; the newest list takes the add';
END
$t$;

-- 12. a version written through fuel_create_version_with_staples carries every staple still on:
--     one the client never sent (saved after its read) once, one it sent once, a stopped one
--     never, the solver's lines first, and it answers exactly the items it stored
DO $t$
DECLARE v jsonb; items jsonb; k_diapers text; k_coffee text; k_stopped text; n int;
BEGIN
  INSERT INTO public.fuel_staples (user_id, item, store_section) VALUES (auth.uid(), 'diapers', 'Pantry') RETURNING 'custom~' || replace(id::text, '-', '') INTO k_diapers;
  SELECT 'custom~' || replace(id::text, '-', '') INTO k_coffee FROM public.fuel_staples WHERE item = 'coffee' AND removed_at IS NULL;
  SELECT 'custom~' || replace(id::text, '-', '') INTO k_stopped FROM public.fuel_staples WHERE removed_at IS NOT NULL;
  v := public.fuel_create_version_with_staples('2026-09-21', '[]'::jsonb, '{}'::jsonb, jsonb_build_array(
    jsonb_build_object('key', 'Pantry:rice:cup dry', 'item', 'rice', 'qty', 4, 'unit', 'cup dry', 'section', 'Pantry', 'from', '[]'::jsonb, 'second_trip', false, 'inferred', true, 'stocked', false, 'checked', false),
    jsonb_build_object('key', k_coffee, 'item', 'coffee', 'qty', 0, 'unit', '', 'section', 'Snacks', 'from', '[]'::jsonb, 'second_trip', false, 'inferred', false, 'stocked', false, 'checked', false, 'custom', 'staple')));
  items := v->'items';
  IF items IS NULL OR (SELECT l.items FROM public.fuel_lists l WHERE l.id = (v->>'list_id')::uuid) IS DISTINCT FROM items THEN RAISE EXCEPTION 'FAIL the answered items are not the stored items: %', v; END IF;
  SELECT count(*) INTO n FROM jsonb_array_elements(items) e WHERE e->>'key' = k_diapers AND e->>'item' = 'diapers' AND e->>'section' = 'Pantry' AND e->>'custom' = 'staple' AND (e->>'qty')::numeric = 0;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL a staple the client never sent is not on the version once: %', items; END IF;
  SELECT count(*) INTO n FROM jsonb_array_elements(items) e WHERE e->>'key' = k_coffee;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL coffee is on the version % times', n; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(items) e WHERE e->>'key' = k_stopped) THEN RAISE EXCEPTION 'FAIL a stopped staple is on the version'; END IF;
  IF (items->0->>'key') <> 'Pantry:rice:cup dry' THEN RAISE EXCEPTION 'FAIL the solver lines do not come first: %', items; END IF;
  IF (v->>'version')::int <> 3 THEN RAISE EXCEPTION 'FAIL the version is %, expected 3', v->>'version'; END IF;
  PERFORM set_config('t.l2', v->>'list_id', true);
  RAISE NOTICE 'PASS 12 a version built with staples carries one the client never sent, once; one it sent, once; a stopped one, never; solver lines first; and answers what it stored';
END
$t$;

-- 13. Codex r2 / Andrew's ruling A — the database is the only source of staple lines:
--     a staple the client read and another tab then STOPPED inside the gap is not on the new
--     version, though the client still sends its line; a one-off the client sends is dropped;
--     a client that sends a previous list back whole (staples and all) still gets each staple
--     exactly once; and the solver's lines survive untouched, first
DO $t$
DECLARE v jsonb; items jsonb; prev jsonb; s_gap uuid; k_gap text; k_coffee text; n int;
BEGIN
  INSERT INTO public.fuel_staples (user_id, item, store_section) VALUES (auth.uid(), 'paper towels', 'Pantry') RETURNING id INTO s_gap;
  k_gap := 'custom~' || replace(s_gap::text, '-', '');
  SELECT 'custom~' || replace(id::text, '-', '') INTO k_coffee FROM public.fuel_staples WHERE item = 'coffee' AND removed_at IS NULL;
  -- the client read paper towels, so its lines carry it; another tab stops it before the build lands
  UPDATE public.fuel_staples SET removed_at = now() WHERE id = s_gap;
  v := public.fuel_create_version_with_staples('2026-09-21', '[]'::jsonb, '{}'::jsonb, jsonb_build_array(
    jsonb_build_object('key', 'Pantry:rice:cup dry', 'item', 'rice', 'qty', 4, 'unit', 'cup dry', 'section', 'Pantry', 'from', '[]'::jsonb, 'second_trip', false, 'inferred', true, 'stocked', false, 'checked', false),
    jsonb_build_object('key', k_gap, 'item', 'paper towels', 'qty', 0, 'unit', '', 'section', 'Pantry', 'from', '[]'::jsonb, 'second_trip', false, 'inferred', false, 'stocked', false, 'checked', false, 'custom', 'staple'),
    jsonb_build_object('key', 'custom~00000000000040008000000000000bad', 'item', 'smuggled one-off', 'qty', 0, 'unit', '', 'section', 'Pantry', 'from', '[]'::jsonb, 'second_trip', false, 'inferred', false, 'stocked', false, 'checked', false, 'custom', 'one-off')));
  items := v->'items';
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(items) e WHERE e->>'key' = k_gap) THEN RAISE EXCEPTION 'FAIL a staple stopped inside the gap is on the new version: %', items; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(items) e WHERE e->>'item' = 'smuggled one-off') THEN RAISE EXCEPTION 'FAIL a custom line the client sent is on the new version: %', items; END IF;
  IF (items->0->>'key') <> 'Pantry:rice:cup dry' OR (SELECT count(*) FROM jsonb_array_elements(items) e WHERE e->>'key' = 'Pantry:rice:cup dry') <> 1 THEN RAISE EXCEPTION 'FAIL the solver line is not kept, first, once: %', items; END IF;
  SELECT count(*) INTO n FROM jsonb_array_elements(items) e WHERE e->>'key' = k_coffee;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL coffee, still on, is on the version % times', n; END IF;
  -- the worst client: it sends the list it holds, staples and all, straight back
  prev := items;
  v := public.fuel_create_version_with_staples('2026-09-21', '[]'::jsonb, '{}'::jsonb, prev);
  items := v->'items';
  IF EXISTS (SELECT 1 FROM (SELECT e->>'key' AS k, count(*) AS c FROM jsonb_array_elements(items) e GROUP BY 1) g WHERE g.c > 1) THEN RAISE EXCEPTION 'FAIL a line is duplicated when a stored list is sent back: %', items; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(items) e WHERE e->>'custom' = 'staple') <> (SELECT count(*) FROM public.fuel_staples WHERE user_id = auth.uid() AND removed_at IS NULL) THEN RAISE EXCEPTION 'FAIL the staple lines are not exactly the staples still on: %', items; END IF;
  PERFORM set_config('t.l2', v->>'list_id', true);
  RAISE NOTICE 'PASS 13 the database is the only source of staple lines: a staple stopped in the gap is gone though the client sent it, a sent one-off is dropped, a list sent back whole gets each staple once, solver lines kept first';
END
$t$;

-- 14. Andrew's ruling on the third provenance finding — every writer of a list row rebuilds the staple
--     lines: an old tab calling fuel_create_version directly with the solver's lines only, and a raw
--     list row inserted by its owner carrying a stale line for a stopped staple, both store exactly the
--     staples still on
DO $t$
DECLARE v jsonb; items jsonb; n_active int; v_plan uuid; v_list uuid; k_gap text;
BEGIN
  SELECT count(*) INTO n_active FROM public.fuel_staples WHERE user_id = auth.uid() AND removed_at IS NULL;
  SELECT 'custom~' || replace(id::text, '-', '') INTO k_gap FROM public.fuel_staples WHERE item = 'paper towels';
  v := public.fuel_create_version('2026-09-21', '[]'::jsonb, '{}'::jsonb, jsonb_build_array(
    jsonb_build_object('key', 'Pantry:rice:cup dry', 'item', 'rice', 'qty', 4, 'unit', 'cup dry', 'section', 'Pantry', 'from', '[]'::jsonb, 'second_trip', false, 'inferred', true, 'stocked', false, 'checked', false)));
  SELECT l.items INTO items FROM public.fuel_lists l WHERE l.id = (v->>'list_id')::uuid;
  IF n_active = 0 OR (SELECT count(*) FROM jsonb_array_elements(items) e WHERE e->>'custom' = 'staple') <> n_active THEN
    RAISE EXCEPTION 'FAIL a version written through fuel_create_version directly does not carry the % staples still on: %', n_active, items; END IF;
  IF (items->0->>'key') <> 'Pantry:rice:cup dry' THEN RAISE EXCEPTION 'FAIL the old writer''s solver line is not kept first: %', items; END IF;
  PERFORM set_config('t.l2', v->>'list_id', true);
  -- a raw list row, inserted by its owner (row security allows it), carrying a stale line for a stopped staple
  INSERT INTO public.fuel_plans (user_id, week_start, version, meal_ids, rules_snapshot) VALUES (auth.uid(), '2026-10-05', 1, '[]'::jsonb, '{}'::jsonb) RETURNING id INTO v_plan;
  INSERT INTO public.fuel_lists (plan_id, user_id, version, items) VALUES (v_plan, auth.uid(), 1, jsonb_build_array(
    jsonb_build_object('key', k_gap, 'item', 'paper towels', 'qty', 0, 'unit', '', 'section', 'Pantry', 'from', '[]'::jsonb, 'second_trip', false, 'inferred', false, 'stocked', false, 'checked', false, 'custom', 'staple')))
    RETURNING id INTO v_list;
  SELECT l.items INTO items FROM public.fuel_lists l WHERE l.id = v_list;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(items) e WHERE e->>'key' = k_gap) OR (SELECT count(*) FROM jsonb_array_elements(items) e WHERE e->>'custom' = 'staple') <> n_active THEN
    RAISE EXCEPTION 'FAIL a raw list row is not rebuilt from the staples still on: %', items; END IF;
  RAISE NOTICE 'PASS 14 every writer rebuilds the staple lines: an old tab calling fuel_create_version directly, and a raw list row, both store exactly the staples still on';
END
$t$;

-- 15. a rebuilt staple line is built from its staple row, whatever the client sent for it: the staple's
--     name and aisle, no quantity, never ticked, marked staple; and the aisle follows the row when it moves
DO $t$
DECLARE v jsonb; line jsonb; k_coffee text; k_diapers text;
BEGIN
  SELECT 'custom~' || replace(id::text, '-', '') INTO k_coffee FROM public.fuel_staples WHERE item = 'coffee' AND removed_at IS NULL;
  SELECT 'custom~' || replace(id::text, '-', '') INTO k_diapers FROM public.fuel_staples WHERE item = 'diapers' AND removed_at IS NULL;
  UPDATE public.fuel_staples SET store_section = 'Frozen' WHERE item = 'diapers' AND removed_at IS NULL;
  v := public.fuel_create_version_with_staples('2026-09-21', '[]'::jsonb, '{}'::jsonb, jsonb_build_array(
    jsonb_build_object('key', k_coffee, 'item', 'stale coffee', 'qty', 3, 'unit', 'lb', 'section', 'Frozen', 'from', '["x"]'::jsonb, 'second_trip', true, 'inferred', true, 'stocked', true, 'checked', true, 'custom', 'staple')));
  SELECT e INTO line FROM jsonb_array_elements(v->'items') e WHERE e->>'key' = k_coffee;
  IF line IS DISTINCT FROM jsonb_build_object('key', k_coffee, 'item', 'coffee', 'qty', 0, 'unit', '', 'section', 'Snacks', 'from', '[]'::jsonb, 'second_trip', false, 'inferred', false, 'stocked', false, 'checked', false, 'custom', 'staple') THEN
    RAISE EXCEPTION 'FAIL a rebuilt staple line is not built from its staple row: %', line; END IF;
  SELECT e INTO line FROM jsonb_array_elements(v->'items') e WHERE e->>'key' = k_diapers;
  IF line->>'section' IS DISTINCT FROM 'Frozen' OR (line->>'checked')::boolean IS DISTINCT FROM false OR line->>'item' IS DISTINCT FROM 'diapers' THEN
    RAISE EXCEPTION 'FAIL a rebuilt staple line does not take its aisle from the staple row, unticked: %', line; END IF;
  PERFORM set_config('t.l2', v->>'list_id', true);
  RAISE NOTICE 'PASS 15 a rebuilt staple line is built from its staple row (name, aisle, no quantity, unticked) whatever the client sent, and its aisle follows the row';
END
$t$;

-- 16. a staple named like a solver line is its own line on a rebuilt version, beside the solver's
DO $t$
DECLARE v jsonb; k_rice text;
BEGIN
  INSERT INTO public.fuel_staples (user_id, item, store_section) VALUES (auth.uid(), 'rice', 'Pantry') RETURNING 'custom~' || replace(id::text, '-', '') INTO k_rice;
  v := public.fuel_create_version_with_staples('2026-09-21', '[]'::jsonb, '{}'::jsonb, jsonb_build_array(
    jsonb_build_object('key', 'Pantry:rice:cup dry', 'item', 'rice', 'qty', 4, 'unit', 'cup dry', 'section', 'Pantry', 'from', '[]'::jsonb, 'second_trip', false, 'inferred', true, 'stocked', false, 'checked', false)));
  IF (SELECT count(*) FROM jsonb_array_elements(v->'items') e WHERE e->>'item' = 'rice') <> 2
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v->'items') e WHERE e->>'key' = 'Pantry:rice:cup dry')
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v->'items') e WHERE e->>'key' = k_rice AND e->>'custom' = 'staple') THEN
    RAISE EXCEPTION 'FAIL a staple named like a solver line is not its own line beside the solver''s: %', v->'items'; END IF;
  PERFORM set_config('t.l2', v->>'list_id', true);
  RAISE NOTICE 'PASS 16 a staple named like a solver line is its own line on a rebuilt version, beside the solver''s';
END
$t$;

-- 10. someone else cannot touch the list, see the staples, or plant one
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000002ff","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000002ff', true);
DO $t$
DECLARE n int;
BEGIN
  BEGIN PERFORM public.fuel_add_custom_item(current_setting('t.l2')::uuid, 'intruder', 'Pantry'); RAISE EXCEPTION 'FAIL another user added to the list';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
  BEGIN PERFORM public.fuel_remove_custom_item(current_setting('t.l2')::uuid, 'custom~abc'); RAISE EXCEPTION 'FAIL another user removed from the list';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
  SELECT count(*) INTO n FROM public.fuel_staples;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL another user sees % staples', n; END IF;
  BEGIN INSERT INTO public.fuel_staples (user_id, item, store_section) VALUES ('00000000-0000-4000-8000-000000000240', 'planted', 'Pantry'); RAISE EXCEPTION 'FAIL a staple was planted on another user';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'PASS 10 another user cannot add to or remove from the list (42501), sees no staples, and cannot plant one';
END
$t$;

-- 11. the Pro gate holds at the database, and anon cannot call any of the three functions
RESET ROLE;
CREATE OR REPLACE FUNCTION public.is_premium(user_id uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000240","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000240', true);
SET LOCAL ROLE authenticated;
DO $t$
BEGIN
  BEGIN INSERT INTO public.fuel_staples (user_id, item, store_section) VALUES (auth.uid(), 'free tier', 'Pantry'); RAISE EXCEPTION 'FAIL a free user added a staple';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
  BEGIN PERFORM public.fuel_add_custom_item(current_setting('t.l2')::uuid, 'free tier', 'Pantry'); RAISE EXCEPTION 'FAIL a free user added to a list';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
  BEGIN PERFORM public.fuel_create_version_with_staples('2026-09-28', '[]'::jsonb, '{}'::jsonb, '[]'::jsonb); RAISE EXCEPTION 'FAIL a free user built a version with staples';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
  RAISE NOTICE 'PASS 11a a free user is refused a staple, a custom line and a version with staples at the database (42501)';
END
$t$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $t$
BEGIN
  BEGIN PERFORM public.fuel_add_custom_item(gen_random_uuid(), 'anon', 'Pantry'); RAISE EXCEPTION 'FAIL anon called fuel_add_custom_item';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.fuel_remove_custom_item(gen_random_uuid(), 'custom~a'); RAISE EXCEPTION 'FAIL anon called fuel_remove_custom_item';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN PERFORM public.fuel_create_version_with_staples('2026-09-28', '[]'::jsonb, '{}'::jsonb, '[]'::jsonb); RAISE EXCEPTION 'FAIL anon called fuel_create_version_with_staples';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'PASS 11b anon cannot call any of the three functions';
END
$t$;
ROLLBACK;
\echo proof-complete
