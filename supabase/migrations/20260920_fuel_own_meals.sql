-- ── Fuel: the athlete's own meals (FOR-242) ─────────────────────────────────
-- "We will still need to add meals as we go and maybe include some sauces and
-- stuff as we do." Today that means editing a fixture, running the generator,
-- writing a migration, a Codex round, a merge, a deploy and applying the
-- migration — for "we tried a chicken thing and Lisa liked it".
--
-- ONE TABLE, ONE NULLABLE user_id (FOR-242 §2). NULL is the seeded library:
-- everyone reads it, nobody writes it. A value is that athlete's own meal: only
-- they read it, only they write it. One table, one read path, one solver. Two
-- sources of meals is the failure mode this shape exists to avoid — it is the
-- error FOR-233, FOR-238 and FOR-240 were each spent on.
--
-- The codebase is already arranged for this: src/lib/fuel/store.ts has exactly
-- one fuel_meals select, and libraryItems/libraryVocabulary in solve.ts derive
-- the FOR-239 picker vocabulary from whatever meals they are handed. So an own
-- meal's ingredients become shoppable with no second feature and no branch.
--
-- SLUGS ARE FOREIGN KEYS — fuel_rotation_meals.meal_slug REFERENCES
-- fuel_meals(slug), and fuel_plans.meal_ids and stored list rows carry them too.
-- A collision corrupts someone's history. Andrew's ruling: keep slug GLOBALLY
-- unique and namespace the athlete's own, rather than moving to
-- UNIQUE (user_id, slug). The global constraint then makes a collision with a
-- seeded slug impossible at the database, which also closes this: the seed
-- migrations are INSERT ... ON CONFLICT (slug) DO UPDATE, and their SET lists do
-- NOT include user_id, so a user row holding a seeded slug would have its
-- content overwritten by the next seed run and stay owned by the user — their
-- meal, someone else's food. It cannot happen, because the slug cannot exist.
--
-- The namespace is pinned by a CHECK, not by a convention the client remembers:
-- an own meal's slug must begin with 'u' + its owner's uuid hex + '~'. The full
-- 32 hex digits, not a prefix, so two athletes can never contend for a slug.
-- Nobody ever sees a slug, so it costs nothing to be ugly.
--
-- RETIRE, NOT DELETE: there is no DELETE policy. Retiring flips `active`, and
-- PlanBuilder already drops a retired meal from a rebuilt plan and names it, so
-- stored plans and lists never break.
--
-- PRO, like every other Fuel write path (Andrew's ruling). The trigger carries a
-- WHEN clause: enforce_fuel_pro() raises when auth.uid() IS NULL, and the seed
-- migrations insert as the migration owner with no auth.uid(). Without the WHEN,
-- replaying the seeds would fail — which npm run proof:db now does on every run.
--
-- Additive: one nullable column, one CHECK, one index, three policies replacing
-- one, one trigger. No existing column, function or row changes. In its own
-- migration, NOT folded into 20260914: scripts/fuel-seed-sql.mjs renders that
-- file in full, CREATE TABLE included, so editing it there desyncs the generator
-- and breaks `node scripts/fuel-seed-sql.mjs --check` immediately.

-- ── The column ───────────────────────────────────────────────────────────────
ALTER TABLE public.fuel_meals
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.fuel_meals.user_id IS
  'NULL = the seeded library, readable by everyone and writable by nobody. A value = that athlete''s own meal (FOR-242).';

-- ── The slug namespace, enforced rather than remembered ──────────────────────
-- Existing rows are all seeded (user_id IS NULL), so this validates immediately.
ALTER TABLE public.fuel_meals DROP CONSTRAINT IF EXISTS fuel_meals_own_slug_namespaced;
ALTER TABLE public.fuel_meals ADD CONSTRAINT fuel_meals_own_slug_namespaced
  CHECK (user_id IS NULL OR left(slug, 34) = 'u' || replace(user_id::text, '-', '') || '~');

-- Own meals are read on every library load, under the RLS predicate below.
CREATE INDEX IF NOT EXISTS fuel_meals_own ON public.fuel_meals (user_id) WHERE user_id IS NOT NULL;

-- ── Read the library plus your own, and nobody else's ────────────────────────
-- Replaces "fuel_meals: authenticated read", which was USING (true).
DROP POLICY IF EXISTS "fuel_meals: authenticated read" ON public.fuel_meals;
DROP POLICY IF EXISTS "fuel_meals: library and own reads" ON public.fuel_meals;
CREATE POLICY "fuel_meals: library and own reads" ON public.fuel_meals
  FOR SELECT TO authenticated USING (user_id IS NULL OR user_id = auth.uid());

-- ── Write only your own ──────────────────────────────────────────────────────
-- user_id = auth.uid() is NOT NULL-safe by construction: a row with user_id NULL
-- gives NULL, which is not true, so no athlete can write a library row. And an
-- UPDATE cannot see a seeded row at all, so one cannot be edited into an own
-- meal or out of the library.
DROP POLICY IF EXISTS "fuel_meals: owner adds own" ON public.fuel_meals;
CREATE POLICY "fuel_meals: owner adds own" ON public.fuel_meals
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "fuel_meals: owner edits own" ON public.fuel_meals;
CREATE POLICY "fuel_meals: owner edits own" ON public.fuel_meals
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- No DELETE policy: retiring flips `active`, so stored plans and lists keep
-- resolving the slug they reference.

-- ── The Pro gate, as on fuel_household, fuel_plans, fuel_lists, fuel_staples ──
-- WHEN (NEW.user_id IS NOT NULL): the seeded library is inserted by the seed
-- migrations with no auth.uid(), and enforce_fuel_pro() raises on that.
DROP TRIGGER IF EXISTS fuel_meals_pro_gate ON public.fuel_meals;
CREATE TRIGGER fuel_meals_pro_gate BEFORE INSERT OR UPDATE ON public.fuel_meals
  FOR EACH ROW WHEN (NEW.user_id IS NOT NULL) EXECUTE FUNCTION public.enforce_fuel_pro();
