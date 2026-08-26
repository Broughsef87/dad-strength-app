# Fuel slot — copy harvested from /systems before deletion

**Source:** `src/app/systems/page.tsx` on `launch-prep` (4e012d1)
**Harvested:** 2026-08-24, per Blaine's dispatch §5, before the Piece A delete commit
**Why:** the meal-plan + shopping-list feature's seed copy lives here as static text.
Product thinking already done; it should outlive the route.

---

## Block 1 — "Batch Cook Protocol" (category: Fuel) — the primary seed

> **Batch Cook Protocol** · Fuel · 2 hrs / week
> One Sunday session feeds you clean all week. No daily decisions, no bad choices
> at 7 PM when you're exhausted.

Steps:
- Sunday 7 PM: 3 proteins (ground beef, chicken thighs, eggs) + 2 carb sources (rice, oats)
- Portion into containers: 5 lunches, 5 dinners. Done.
- Breakfast is always the same — 3 eggs + oats. Zero decision fatigue.
- Keep a protein bar in the gym bag, car, and desk. Never be caught off guard.

Tag: `Save 45 min/day`

## Block 2 — "Decision Batch" (category: Mental Load) — the meal-planning line

> Every micro-decision you make costs energy. Batch the recurring ones once and
> stop making them daily.

Relevant step:
- **Sunday: pick 5 meals for the week. No daily "what should I eat" loops.**

## Block 3 — "Evening Handoff" (category: Partnership) — the shopping-list line

> Two parents, one baby, no coordination = constant friction.

Relevant step:
- **One shared grocery list. Never duplicate-buy, never run out.**

---

## What this implies for the Fuel feature

Three requirements are already specified by the copy above:

1. **Weekly batch, not daily logging.** The unit is a Sunday planning session
   producing 5 lunches + 5 dinners — not a per-meal tracker.
2. **Decision elimination is the value.** "No daily 'what should I eat' loops",
   "zero decision fatigue". The feature succeeds by removing choices, not by
   presenting more of them.
3. **The grocery list is shared and deduplicated.** Two adults, one list —
   which makes it a multi-user surface, unlike everything else in the app.

## Explicitly NOT a starting point

`src/components/FuelStation.tsx` (77 lines) is being deleted in the same sweep.
It is local `useState` with a hardcoded 200 g protein target, no persistence and
no Supabase. Per §5 the meal-plan feature starts fresh; do not resurrect it as a
foundation.

## Nav

Fuel is a **reserved slot, not a build**. BottomNav becomes a config array with
three entries (Today / Train / Profile); Fuel becomes a fourth entry when there
is a Fuel surface to point at — a one-line change, per §4.
