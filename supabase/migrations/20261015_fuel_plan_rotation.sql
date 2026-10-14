-- ============================================================
-- Fuel: the menu a plan was built from (FOR-279) — 2026-10-13
--
-- ADDITIVE: one nullable column, fuel_plans.rotation_slug. No column is
-- dropped or renamed, no row is written by this file, no function, policy or
-- trigger changes.
--
-- Which menu a plan ran was read back from its nights: the menu with the most
-- picked dinners that belong to it ALONE. The four soup menus (FOR-250) share
-- all but two of their dinners with the everyday menus, so a household whose
-- cook cap leaves the soups out, or one swapped night, and the nights say
-- nothing — and the next plan starts from the menu just eaten.
--
-- The menu is now recorded when the plan is built. The app sends it in
-- rules_snapshot, which fuel_create_version already stores, and this column
-- is GENERATED from that key:
--
--   * the version functions do not change. Adding a parameter to them is a
--     second overload beside the first, and a call with the old four
--     arguments is then ambiguous;
--   * the column and the snapshot cannot disagree, because there is one
--     value and the database derives the other;
--   * it cannot be written on its own — no UPDATE can move a plan to a
--     different menu after the fact.
--
-- NULL is a valid value and the common one today: every plan built before
-- this, and any plan built from no menu. The app reads those as it always
-- did, from the nights.
--
-- Not a foreign key to fuel_rotations: a menu retired later must not take the
-- record of what was eaten with it, and the app ignores a slug that no
-- longer names a menu.
--
-- REVERT, exactly:
--   ALTER TABLE public.fuel_plans DROP COLUMN rotation_slug;
-- ============================================================

ALTER TABLE public.fuel_plans
  ADD COLUMN IF NOT EXISTS rotation_slug text
  GENERATED ALWAYS AS (rules_snapshot ->> 'rotation_slug') STORED;

COMMENT ON COLUMN public.fuel_plans.rotation_slug IS
  'The menu (fuel_rotations.slug) this plan was built from, generated from rules_snapshot. NULL = built from no menu, or before FOR-279.';
