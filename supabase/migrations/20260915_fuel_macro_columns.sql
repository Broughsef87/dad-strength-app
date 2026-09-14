-- ── Fuel: macro columns on fuel_meals (FOR-234 §4) ─────────────────────────
-- Schema only. Carbs, fat and calories per person alongside the existing
-- protein_g_per_person, so the meal library can grow against its final shape
-- before the goal-driven diet (FOR-234) reads them. Nothing reads these
-- columns yet: no solver change, no UI change.
--
-- NULL on the eight seeded meals. The source documents give protein per
-- person and nothing else; the values are supplied by Andrew or computed
-- from a source later — never estimated here.
--
-- Dated the day after 20260914_fuel_phase_1.sql so it sorts after it: apply
-- after phase 1. Idempotent.

ALTER TABLE public.fuel_meals
  ADD COLUMN IF NOT EXISTS carbs_g_per_person   int CHECK (carbs_g_per_person IS NULL OR carbs_g_per_person >= 0),
  ADD COLUMN IF NOT EXISTS fat_g_per_person     int CHECK (fat_g_per_person IS NULL OR fat_g_per_person >= 0),
  ADD COLUMN IF NOT EXISTS calories_per_person  int CHECK (calories_per_person IS NULL OR calories_per_person >= 0);

COMMENT ON COLUMN public.fuel_meals.carbs_g_per_person  IS 'Carbohydrate per person, grams, as cooked. NULL until sourced (FOR-234 §4); never estimated.';
COMMENT ON COLUMN public.fuel_meals.fat_g_per_person    IS 'Fat per person, grams, as cooked. NULL until sourced (FOR-234 §4); never estimated.';
COMMENT ON COLUMN public.fuel_meals.calories_per_person IS 'Calories per person, as cooked. NULL until sourced (FOR-234 §4); never estimated.';
