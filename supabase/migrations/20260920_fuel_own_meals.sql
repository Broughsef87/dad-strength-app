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
-- one, and two triggers — the Pro gate, and the one that freezes a slug once a
-- row exists. No existing column, function or row changes. In its own
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

-- ── What history is counted on cannot be edited ──────────────────────────────
-- Two rules, one guard, because a POLICY CANNOT SEE OLD.
--
-- 1. A SLUG NEVER MOVES. The UPDATE policy and the namespace CHECK both accept a
--    change from one slug in the owner's namespace to another, and PostgREST
--    will happily send one. But fuel_plans.meal_ids and stored fuel_lists rows
--    carry the slug as written and nothing rewrites them, so a rename orphans
--    every plan already shopped — the harm the no-DELETE rule exists to prevent.
--    CLAUDE.md: renaming a slug is a migration, not an edit (Codex r1).
--
-- 2. A CUT A PLAN HAS ALREADY COUNTED NEVER CHANGES. steakWindowWarnings decides
--    whether a PAST night was a steak by looking its slug up in the library as it
--    stands now (solve.ts:243). So editing an own meal from ribeye to chicken
--    retroactively removes that night from the monthly allowance, and the reverse
--    edit can block a plan that was fine. The form disables the control, but a
--    second tab holding a stale plan list, or a direct API call, goes straight
--    past it — a guard that lives only in the UI is not a guard (Codex r5, r7).
--
-- Rule 2 applies to OWN meals only. The seeded library is corrected BY MIGRATION,
-- which is the sanctioned path for exactly this, and the seed migrations are
-- INSERT ... ON CONFLICT DO UPDATE — scoping this to user_id IS NOT NULL is what
-- keeps replaying them from failing once a seeded meal has been planned.
CREATE OR REPLACE FUNCTION public.fuel_meals_history_is_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF NEW.slug IS DISTINCT FROM OLD.slug THEN
    RAISE EXCEPTION 'a meal slug cannot be changed — it is referenced by plans and lists already built'
      USING ERRCODE = '23514';
  END IF;
  IF OLD.user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.fuel_plans p, jsonb_array_elements(p.meal_ids) AS e
     WHERE p.user_id = OLD.user_id AND e->>'slug' = OLD.slug
  ) THEN
    IF NEW.protein_cut IS DISTINCT FROM OLD.protein_cut THEN
      RAISE EXCEPTION 'what this meal is cannot be changed once you have planned it — a night already counted on it'
        USING ERRCODE = '23514';
    END IF;
    -- 3. AND IT CANNOT BE RETIRED. loadMeals reads active rows only, and
    --    steakWindowWarnings resolves a past night's cut in that same library —
    --    so retiring a planned ribeye deletes that night from the monthly
    --    allowance just as surely as editing its cut would, and one steak last
    --    week plus one this week would then pass a one-a-month rule. Keeping the
    --    ROW is not enough when the READ drops it (Codex r8).
    --
    --    So retirement is refused here rather than allowed to miscount quietly.
    --    That is a real limitation, and it is the honest half of the pair: a loud
    --    refusal over a silent wrong number. Lifting it means history resolving
    --    from something that does not change — a wider library through
    --    PlanContext, or the cut snapshotted onto the plan — which is a change to
    --    the cross-cycle counting rules and is filed, not smuggled in here.
    IF OLD.active AND NOT NEW.active THEN
      RAISE EXCEPTION 'this meal is on a plan you have already built, so it cannot be retired yet — a night is still counted on it'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END
$$;
REVOKE EXECUTE ON FUNCTION public.fuel_meals_history_is_immutable() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS fuel_meals_slug_immutable ON public.fuel_meals;
DROP TRIGGER IF EXISTS fuel_meals_history_immutable ON public.fuel_meals;
CREATE TRIGGER fuel_meals_history_immutable BEFORE UPDATE ON public.fuel_meals
  FOR EACH ROW EXECUTE FUNCTION public.fuel_meals_history_is_immutable();

-- ── The Pro gate, as on fuel_household, fuel_plans, fuel_lists, fuel_staples ──
-- WHEN (NEW.user_id IS NOT NULL): the seeded library is inserted by the seed
-- migrations with no auth.uid(), and enforce_fuel_pro() raises on that.
DROP TRIGGER IF EXISTS fuel_meals_pro_gate ON public.fuel_meals;
CREATE TRIGGER fuel_meals_pro_gate BEFORE INSERT OR UPDATE ON public.fuel_meals
  FOR EACH ROW WHEN (NEW.user_id IS NOT NULL) EXECUTE FUNCTION public.enforce_fuel_pro();
