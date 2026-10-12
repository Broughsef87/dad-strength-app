-- ============================================================
-- Fuel menu names (FOR-281) — 2026-10-12
--
-- ROW UPDATES ONLY, on the six fuel_rotations rows: `name` and `note`. No
-- table, column, constraint, policy or index changes. No slug moves — a slug is
-- a foreign key in fuel_rotation_meals — and no membership row is touched.
--
-- Andrew, 2026-10-12: "start with fortnight one", "start with soup fortnight
-- two" is confusing. The menus get plain names, and the note becomes the one
-- line the menu card shows under the name, so it can no longer speak in
-- fortnights and rotations either.
--
-- The fixtures (fixtures/fuel-seed-rotation-b.json, -c.json) carry the same
-- values and the seed migrations generated from them were regenerated, so a
-- fresh database lands on these names without this file; this file is what
-- moves a database that was already seeded. scripts/checks/fuel-flow.mjs holds
-- the two together.
--
-- REVERT, exactly:
--   UPDATE public.fuel_rotations SET name = 'Fortnight One', note = 'The original eight. Ran Aug 24 – Sep 14, 2026.' WHERE slug = 'rotation-a';
--   UPDATE public.fuel_rotations SET name = 'Fortnight Two', note = 'Five new meals plus the three keepers. Same cut mix as rotation A — ribeye 1, chicken thigh 2, ground turkey 2, fish 2, chicken breast 1 — so the Costco shop is identical in shape and cost. Every spice profile and format is new against rotation A.' WHERE slug = 'rotation-b';
--   UPDATE public.fuel_rotations SET name = 'Soup Fortnight One', note = 'Week 1 is Fortnight One''s first week with beef and barley stew in place of the ribeye. Week 2 is Fortnight Two''s second week with chicken tortilla soup in place of the jerk thighs.' WHERE slug = 'rotation-c1';
--   UPDATE public.fuel_rotations SET name = 'Soup Fortnight Two', note = 'Week 1 is Fortnight One''s first week with white chicken chili in place of the chili-lime thighs. Week 2 is Fortnight Two''s second week with Italian wedding soup in place of the turkey meatballs.' WHERE slug = 'rotation-c2';
--   UPDATE public.fuel_rotations SET name = 'Soup Fortnight Three', note = 'Week 1 is Fortnight One''s first week with pork green chili in place of the ribeye. Week 2 is Fortnight Two''s second week with lentil and sausage soup in place of the tandoori chicken.' WHERE slug = 'rotation-c3';
--   UPDATE public.fuel_rotations SET name = 'Soup Fortnight Four', note = 'Week 1 is Fortnight One''s first week with turkey chili in place of the Greek turkey bowl. Week 2 is Fortnight Two''s second week with zuppa toscana in place of the jerk thighs.' WHERE slug = 'rotation-c4';
-- ============================================================

UPDATE public.fuel_rotations SET name = 'Everyday menu 1', note = 'The original eight: ribeye, chili-lime thighs, lemon-garlic salmon, turkey bowls and burgers, blackened cod and a stir-fry.' WHERE slug = 'rotation-a';
UPDATE public.fuel_rotations SET name = 'Everyday menu 2', note = 'Same shop, new flavours: miso salmon, jerk thighs, turkey meatballs, tandoori chicken and cod tacos.' WHERE slug = 'rotation-b';
UPDATE public.fuel_rotations SET name = 'Soup season 1', note = 'Beef and barley stew one week, chicken tortilla soup the next.' WHERE slug = 'rotation-c1';
UPDATE public.fuel_rotations SET name = 'Soup season 2', note = 'White chicken chili one week, Italian wedding soup the next.' WHERE slug = 'rotation-c2';
UPDATE public.fuel_rotations SET name = 'Soup season 3', note = 'Pork green chili one week, lentil and sausage soup the next.' WHERE slug = 'rotation-c3';
UPDATE public.fuel_rotations SET name = 'Soup season 4', note = 'Turkey chili one week, zuppa toscana the next.' WHERE slug = 'rotation-c4';
