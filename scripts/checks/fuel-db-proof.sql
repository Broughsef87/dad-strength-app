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
  -- FOR-243 made a tick carry across a rebuild, so this case now says what
  -- coffee's tick IS before it asks what a rebuild does with what the client
  -- sent. The athlete unticks it on the newest list; the client then sends
  -- checked:true and is still ignored, which is what this case has always
  -- been about. Without this line coffee is still ticked from case 4, and the
  -- assertion would be testing the carry instead of the provenance.
  PERFORM public.fuel_set_item_checked(current_setting('t.l2')::uuid, k_coffee, false);
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

-- ── FOR-243: a tick survives a rebuild wherever the line's identity survives ──
-- On their own cycle, so these stand on their own state and not on cases 1-16.
-- ListItem.key IS the identity (FOR-243 §4): section, item, unit and trip. The
-- client always sends checked:false — it solves the list fresh — so a tick on a
-- new version can only have come from the database's own read of the previous
-- one, under the lock the staple rebuild already holds.

-- 17. a rebuild keeps the ticks of every line whose key is unchanged, solver
--     lines and staple lines alike, and leaves the untouched ones unticked
DO $t$
DECLARE v jsonb; items jsonb; l1 uuid; k_st text; sent jsonb;
BEGIN
  INSERT INTO public.fuel_staples (user_id, item, store_section) VALUES (auth.uid(), 'tinned tomatoes', 'Pantry')
    RETURNING 'custom~' || replace(id::text, '-', '') INTO k_st;
  PERFORM set_config('t.k243', k_st, true);
  sent := jsonb_build_array(
    jsonb_build_object('key','Pantry:rice:cup dry','item','rice','qty',4,'unit','cup dry','section','Pantry','from','[]'::jsonb,'second_trip',false,'inferred',true,'stocked',false,'checked',false),
    jsonb_build_object('key','Meat & Seafood:chicken:lb','item','chicken','qty',4,'unit','lb','section','Meat & Seafood','from','[]'::jsonb,'second_trip',false,'inferred',false,'stocked',false,'checked',false),
    jsonb_build_object('key','Produce:broccoli:each','item','broccoli','qty',2,'unit','each','section','Produce','from','[]'::jsonb,'second_trip',false,'inferred',false,'stocked',false,'checked',false));
  v := public.fuel_create_version_with_staples('2026-11-02', '[]'::jsonb, '{}'::jsonb, sent);
  l1 := (v->>'list_id')::uuid;
  PERFORM public.fuel_set_item_checked(l1, 'Pantry:rice:cup dry', true);
  PERFORM public.fuel_set_item_checked(l1, 'Meat & Seafood:chicken:lb', true);
  PERFORM public.fuel_set_item_checked(l1, k_st, true);
  PERFORM set_config('t.l243a', l1::text, true);

  -- the rebuild: a night changed, so the client solves again and sends every line unticked
  v := public.fuel_create_version_with_staples('2026-11-02', '[]'::jsonb, '{}'::jsonb, sent);
  items := v->'items';
  IF (SELECT (e->>'checked')::boolean FROM jsonb_array_elements(items) e WHERE e->>'key' = 'Pantry:rice:cup dry') IS DISTINCT FROM true
     OR (SELECT (e->>'checked')::boolean FROM jsonb_array_elements(items) e WHERE e->>'key' = 'Meat & Seafood:chicken:lb') IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL a solver line lost its tick across a rebuild: %', items; END IF;
  IF (SELECT (e->>'checked')::boolean FROM jsonb_array_elements(items) e WHERE e->>'key' = k_st) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL a staple line lost its tick across a rebuild: %', items; END IF;
  IF (SELECT (e->>'checked')::boolean FROM jsonb_array_elements(items) e WHERE e->>'key' = 'Produce:broccoli:each') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FAIL a line nobody ticked came back ticked: %', items; END IF;
  IF (SELECT l.items FROM public.fuel_lists l WHERE l.id = (v->>'list_id')::uuid) IS DISTINCT FROM items THEN
    RAISE EXCEPTION 'FAIL the answered items are not the stored items: %', v; END IF;
  PERFORM set_config('t.l243b', v->>'list_id', true);
  RAISE NOTICE 'PASS 17 (FOR-243) a rebuild keeps the ticks of every line whose key is unchanged, solver and staple alike, and leaves the untouched ones unticked';
END
$t$;

-- 18. a quantity change is not an identity change (FOR-243 §4): six pounds of
--     chicken instead of four is the same line, and it keeps its tick
DO $t$
DECLARE v jsonb; items jsonb; line jsonb;
BEGIN
  v := public.fuel_create_version_with_staples('2026-11-02', '[]'::jsonb, '{}'::jsonb, jsonb_build_array(
    jsonb_build_object('key','Pantry:rice:cup dry','item','rice','qty',4,'unit','cup dry','section','Pantry','from','[]'::jsonb,'second_trip',false,'inferred',true,'stocked',false,'checked',false),
    jsonb_build_object('key','Meat & Seafood:chicken:lb','item','chicken','qty',6,'unit','lb','section','Meat & Seafood','from','[]'::jsonb,'second_trip',false,'inferred',false,'stocked',false,'checked',false)));
  items := v->'items';
  SELECT e INTO line FROM jsonb_array_elements(items) e WHERE e->>'key' = 'Meat & Seafood:chicken:lb';
  IF (line->>'qty')::numeric <> 6 THEN RAISE EXCEPTION 'FAIL the quantity did not change: %', line; END IF;
  IF (line->>'checked')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL a line lost its tick because its quantity changed: %', line; END IF;
  PERFORM set_config('t.l243c', v->>'list_id', true);
  RAISE NOTICE 'PASS 18 (FOR-243) a quantity change keeps the key, so the line keeps its tick';
END
$t$;

-- 19. a line whose key changed is a DIFFERENT line: it starts unticked and
--     inherits nothing. Carrying a tick to the wrong line is the dangerous
--     failure (FOR-243 §7) — unticked means check the shelf, wrongly ticked
--     means walk past it. A staple beside it still carries, so this is not
--     passing by carrying nothing.
DO $t$
DECLARE v jsonb; items jsonb;
BEGIN
  v := public.fuel_create_version_with_staples('2026-11-02', '[]'::jsonb, '{}'::jsonb, jsonb_build_array(
    -- rice by the pound now: a different unit is a different key
    jsonb_build_object('key','Pantry:rice:lb','item','rice','qty',2,'unit','lb','section','Pantry','from','[]'::jsonb,'second_trip',false,'inferred',true,'stocked',false,'checked',false)));
  items := v->'items';
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(items) e WHERE e->>'key' = 'Pantry:rice:cup dry') THEN
    RAISE EXCEPTION 'FAIL a line the rebuild did not send survived: %', items; END IF;
  IF (SELECT (e->>'checked')::boolean FROM jsonb_array_elements(items) e WHERE e->>'key' = 'Pantry:rice:lb') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FAIL a line whose key changed inherited a tick: %', items; END IF;
  IF (SELECT (e->>'checked')::boolean FROM jsonb_array_elements(items) e WHERE e->>'key' = current_setting('t.k243')) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL the staple beside it lost its tick, so this case proves nothing: %', items; END IF;
  PERFORM set_config('t.l243d', v->>'list_id', true);
  RAISE NOTICE 'PASS 19 (FOR-243) a line whose key changed starts unticked and inherits nothing from the line it replaced';
END
$t$;

-- 20. the DATABASE decides a tick, not the client: a line the previous version
--     had unticked comes back unticked though the client sent checked:true, for
--     a solver line and a staple line alike. An untick sticks across a rebuild.
DO $t$
DECLARE v jsonb; items jsonb; k_st text;
BEGIN
  k_st := current_setting('t.k243');
  -- the athlete unticks the staple on the newest list: that must survive too
  PERFORM public.fuel_set_item_checked(current_setting('t.l243d')::uuid, k_st, false);
  v := public.fuel_create_version_with_staples('2026-11-02', '[]'::jsonb, '{}'::jsonb, jsonb_build_array(
    jsonb_build_object('key','Pantry:rice:lb','item','rice','qty',2,'unit','lb','section','Pantry','from','[]'::jsonb,'second_trip',false,'inferred',true,'stocked',false,'checked',true),
    jsonb_build_object('key',k_st,'item','tinned tomatoes','qty',0,'unit','','section','Pantry','from','[]'::jsonb,'second_trip',false,'inferred',false,'stocked',false,'checked',true,'custom','staple')));
  items := v->'items';
  IF (SELECT (e->>'checked')::boolean FROM jsonb_array_elements(items) e WHERE e->>'key' = 'Pantry:rice:lb') IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FAIL the client dictated a tick on a solver line: %', items; END IF;
  IF (SELECT (e->>'checked')::boolean FROM jsonb_array_elements(items) e WHERE e->>'key' = k_st) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FAIL an untick did not survive the rebuild, or the client dictated a staple tick: %', items; END IF;
  RAISE NOTICE 'PASS 20 (FOR-243) the database decides a tick: a line unticked on the previous version comes back unticked though the client sent it ticked, and an untick survives';
END
$t$;

-- 21. old versions keep the ticks they had (FOR-243 AC5): the list the athlete
--     shopped is still the list they shopped, whatever was built after it
DO $t$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.fuel_lists l, jsonb_array_elements(l.items) e
   WHERE l.id = current_setting('t.l243a')::uuid AND (e->>'checked')::boolean;
  IF n <> 3 THEN RAISE EXCEPTION 'FAIL the first version has % ticks, expected the 3 it was left with', n; END IF;
  RAISE NOTICE 'PASS 21 (FOR-243) an old version keeps the ticks it had, whatever was built after it';
END
$t$;

-- ── FOR-242: the athlete's own meals live in fuel_meals, owned ───────────────
-- One table, one nullable user_id. NULL is the seeded library. A value is that
-- athlete's own meal. AC4 says invisible to any other user, asserted AT THE
-- DATABASE and not from the UI — so these run as two different signed-in users.

-- 22. an own meal is created with a namespaced slug, and its owner reads it
--     beside the seeded library through the SAME select the app uses
DO $t$
DECLARE own_slug text; n_lib int; n_all int;
BEGIN
  own_slug := 'u' || replace(auth.uid()::text, '-', '') || '~lisas-chicken-thing';
  PERFORM set_config('t.m242', own_slug, true);
  INSERT INTO public.fuel_meals (user_id, slug, name, protein_cut, spice_profile, format, active_cook_minutes, total_minutes, servings, protein_g_per_person, perishable_within_days, ingredients)
  VALUES (auth.uid(), own_slug, 'Lisa''s chicken thing', 'chicken_thigh', 'house', 'skillet', 15, 25, 3, 42, 3,
    '[{"item":"gochujang","qty_per_person":1,"unit":"tbsp","store_section":"Pantry","inferred":false}]'::jsonb);
  SELECT count(*) INTO n_lib FROM public.fuel_meals WHERE user_id IS NULL;
  SELECT count(*) INTO n_all FROM public.fuel_meals;
  IF n_lib < 8 OR n_all <> n_lib + 1 THEN
    RAISE EXCEPTION 'FAIL the owner does not read the library plus exactly their own: % library, % total', n_lib, n_all; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.fuel_meals WHERE slug = own_slug AND user_id = auth.uid() AND active) THEN
    RAISE EXCEPTION 'FAIL the own meal is not readable by its owner, or is not active by default'; END IF;
  RAISE NOTICE 'PASS 22 (FOR-242) an own meal is created and its owner reads it beside the seeded library, through one select';
END
$t$;

-- 23. the slug namespace is enforced BY THE DATABASE, not by the client: a slug
--     that is not namespaced to its owner is refused, and a seeded slug cannot
--     be taken at all. Slugs are foreign keys; a collision corrupts history.
DO $t$
BEGIN
  BEGIN
    INSERT INTO public.fuel_meals (user_id, slug, name, protein_cut, spice_profile, format, active_cook_minutes, servings, ingredients)
    VALUES (auth.uid(), 'lisas-other-thing', 'not namespaced', 'x', 'x', 'x', 10, 2, '[]'::jsonb);
    RAISE EXCEPTION 'FAIL an own meal was accepted with an un-namespaced slug';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.fuel_meals (user_id, slug, name, protein_cut, spice_profile, format, active_cook_minutes, servings, ingredients)
    VALUES (auth.uid(), 'u' || replace('00000000-0000-4000-8000-0000000002ff'::uuid::text, '-', '') || '~stolen', 'someone else''s namespace', 'x', 'x', 'x', 10, 2, '[]'::jsonb);
    RAISE EXCEPTION 'FAIL an own meal was accepted namespaced to ANOTHER athlete';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.fuel_meals (user_id, slug, name, protein_cut, spice_profile, format, active_cook_minutes, servings, ingredients)
    VALUES (auth.uid(), 'jerk-thighs', 'shadowing a seeded slug', 'x', 'x', 'x', 10, 2, '[]'::jsonb);
    RAISE EXCEPTION 'FAIL an own meal took a seeded slug';
  EXCEPTION WHEN check_violation THEN NULL; WHEN unique_violation THEN NULL; END;
  RAISE NOTICE 'PASS 23 (FOR-242) the slug namespace is a database constraint: un-namespaced, another athlete''s namespace, and a seeded slug are all refused';
END
$t$;

-- 24. nobody writes the library. Not an insert with no owner, and not an edit of
--     a seeded row — an UPDATE cannot even see one, so it can be neither taken
--     over nor pushed out of the library.
DO $t$
DECLARE n int;
BEGIN
  BEGIN
    INSERT INTO public.fuel_meals (slug, name, protein_cut, spice_profile, format, active_cook_minutes, servings, ingredients)
    VALUES ('planted-library-meal', 'planted', 'x', 'x', 'x', 10, 2, '[]'::jsonb);
    RAISE EXCEPTION 'FAIL an athlete wrote a library row (user_id IS NULL)';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.fuel_meals SET name = 'hijacked' WHERE slug = 'jerk-thighs';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL an athlete edited % seeded row(s)', n; END IF;
  UPDATE public.fuel_meals SET user_id = auth.uid() WHERE slug = 'jerk-thighs';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL an athlete took over a seeded row'; END IF;
  IF (SELECT name FROM public.fuel_meals WHERE slug = 'jerk-thighs') = 'hijacked' THEN
    RAISE EXCEPTION 'FAIL the seeded row changed'; END IF;
  RAISE NOTICE 'PASS 24 (FOR-242) nobody writes the library: no owner-less insert, and a seeded row can be neither edited nor taken over';
END
$t$;

-- 25. AC4 at the database: another athlete cannot read, edit, retire or delete
--     an own meal, and cannot plant one on its owner
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000002ff","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000002ff', true);
DO $t$
DECLARE n int; other text;
BEGIN
  other := current_setting('t.m242');
  IF EXISTS (SELECT 1 FROM public.fuel_meals WHERE slug = other) THEN
    RAISE EXCEPTION 'FAIL another athlete can READ an own meal'; END IF;
  IF (SELECT count(*) FROM public.fuel_meals WHERE user_id IS NOT NULL) <> 0 THEN
    RAISE EXCEPTION 'FAIL another athlete sees somebody''s own meals'; END IF;
  UPDATE public.fuel_meals SET name = 'hijacked' WHERE slug = other;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL another athlete edited an own meal'; END IF;
  UPDATE public.fuel_meals SET active = false WHERE slug = other;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL another athlete retired an own meal'; END IF;
  DELETE FROM public.fuel_meals WHERE slug = other;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL another athlete deleted an own meal'; END IF;
  BEGIN
    INSERT INTO public.fuel_meals (user_id, slug, name, protein_cut, spice_profile, format, active_cook_minutes, servings, ingredients)
    VALUES ('00000000-0000-4000-8000-000000000240', 'u00000000000040008000000000000240~planted', 'planted', 'x', 'x', 'x', 10, 2, '[]'::jsonb);
    RAISE EXCEPTION 'FAIL a meal was planted on another athlete';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'PASS 25 (FOR-242) another athlete cannot read, edit, retire, delete or plant an own meal';
END
$t$;

-- 26. the owner can retire their own meal, and retiring is the only removal
--     there is — there is no DELETE policy, so a stored plan's slug still resolves
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000240","role":"authenticated"}', true);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000240', true);
DO $t$
DECLARE n int; own_slug text;
BEGIN
  own_slug := current_setting('t.m242');
  UPDATE public.fuel_meals SET active = false WHERE slug = own_slug;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL the owner could not retire their own meal (% rows)', n; END IF;
  DELETE FROM public.fuel_meals WHERE slug = own_slug;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL an own meal was DELETED — retiring must be the only removal, or a stored plan stops resolving'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.fuel_meals WHERE slug = own_slug AND NOT active) THEN
    RAISE EXCEPTION 'FAIL the retired meal is gone rather than retired'; END IF;
  UPDATE public.fuel_meals SET active = true WHERE slug = own_slug;
  RAISE NOTICE 'PASS 26 (FOR-242) the owner retires their own meal, and cannot delete it — the row stays so a stored plan keeps resolving its slug';
END
$t$;

-- 27. a slug never moves once a row exists (FOR-242). The UPDATE policy and the
--     namespace CHECK would both accept a rename inside the owner's namespace,
--     and PostgREST would send one — but fuel_plans.meal_ids and stored lists
--     carry the slug as written and nothing rewrites them, so a rename orphans
--     every plan already shopped. Renaming a slug is a migration, not an edit.
DO $t$
DECLARE own_slug text; n int;
BEGIN
  own_slug := current_setting('t.m242');
  BEGIN
    UPDATE public.fuel_meals SET slug = 'u' || replace(auth.uid()::text, '-', '') || '~renamed' WHERE slug = own_slug;
    RAISE EXCEPTION 'FAIL an own meal was renamed, orphaning any plan that references it';
  EXCEPTION WHEN check_violation THEN NULL; END;
  IF NOT EXISTS (SELECT 1 FROM public.fuel_meals WHERE slug = own_slug) THEN
    RAISE EXCEPTION 'FAIL the meal is no longer under its original slug'; END IF;
  -- Editing everything else still works: it is the SLUG that is frozen, not the meal.
  UPDATE public.fuel_meals SET name = 'Lisa''s chicken thing, hotter' WHERE slug = own_slug;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL the owner could not edit their own meal at all (% rows)', n; END IF;
  RAISE NOTICE 'PASS 27 (FOR-242) a slug never moves once a row exists, though everything else about the meal can be edited';
END
$t$;

-- 28. a cut a plan has already counted cannot be edited, AT THE WRITE BOUNDARY
--     (FOR-242). The form disables the control, but a second tab holding a stale
--     plan list, or a direct API call, goes straight past it. steakWindowWarnings
--     decides whether a PAST night was a steak by looking the slug up in today's
--     library, so this edit rewrites what last month allowed.
DO $t$
DECLARE own_slug text; n int;
BEGIN
  own_slug := current_setting('t.m242');
  -- Not planned yet: the cut is the athlete's to correct.
  UPDATE public.fuel_meals SET protein_cut = 'ribeye' WHERE slug = own_slug;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL an unplanned meal could not have its cut corrected (% rows)', n; END IF;
  -- Plan it, and it is now history.
  PERFORM public.fuel_create_version('2026-11-16', jsonb_build_array(jsonb_build_object('slug', own_slug, 'week', 1, 'servings', 3)), '{}'::jsonb, '[]'::jsonb);
  BEGIN
    UPDATE public.fuel_meals SET protein_cut = 'chicken_thigh' WHERE slug = own_slug;
    RAISE EXCEPTION 'FAIL a planned meal had its cut changed, rewriting what the steak allowance counted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  IF (SELECT protein_cut FROM public.fuel_meals WHERE slug = own_slug) <> 'ribeye' THEN
    RAISE EXCEPTION 'FAIL the cut changed anyway'; END IF;
  -- Everything else about a planned meal is still editable.
  UPDATE public.fuel_meals SET name = 'renamed, still a ribeye' WHERE slug = own_slug;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL a planned meal became entirely uneditable (% rows)', n; END IF;
  RAISE NOTICE 'PASS 28 (FOR-242) a cut a plan has already counted cannot be edited at the write boundary, though the rest of the meal still can';
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
  -- FOR-242: own meals are Pro, like every other Fuel write path (Andrew's ruling).
  BEGIN
    INSERT INTO public.fuel_meals (user_id, slug, name, protein_cut, spice_profile, format, active_cook_minutes, servings, ingredients)
    VALUES (auth.uid(), 'u' || replace(auth.uid()::text, '-', '') || '~free-tier-meal', 'free tier', 'x', 'x', 'x', 10, 2, '[]'::jsonb);
    RAISE EXCEPTION 'FAIL a free user added their own meal';
  EXCEPTION WHEN SQLSTATE '42501' THEN NULL; END;
  -- ...but the seeded library is still readable: the gate has a WHEN clause,
  -- so it never touches a user_id IS NULL row.
  IF (SELECT count(*) FROM public.fuel_meals WHERE user_id IS NULL) < 8 THEN
    RAISE EXCEPTION 'FAIL a free user cannot read the seeded library'; END IF;
  RAISE NOTICE 'PASS 11a a free user is refused a staple, a custom line, a version with staples and their own meal at the database (42501), and still reads the seeded library';
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
