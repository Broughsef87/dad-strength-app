// ── Fuel: rotations (FOR-238) ────────────────────────────────────────────────
// A rotation is a named fortnight: eight meals, each with the week it USUALLY
// falls in. It is where the builder STARTS a version of the selected cycle —
// never a second thing the page shows. The plan's own PlanEntry.week stays the
// athlete's and overrides the rotation's default. Which rotation a plan ran is
// read back from the plan's own picks and never stored beside them, so the
// two cannot disagree. Pure: rows in, no I/O, no clock.
import type { Household, MealRow, PlanEntry, RotationMealRow, RotationRow } from './types'
import { cycleWeeks, defaultServings } from './solve'

/** Rotations in their order: sort_order, then slug, so a tie still has one answer. */
export function sortedRotations(rotations: RotationRow[]): RotationRow[] {
  return [...rotations].sort((a, b) => a.sort_order - b.sort_order || a.slug.localeCompare(b.slug))
}

/**
 * Where the builder starts from a rotation, for this household: each meal at
 * the rotation's DEFAULT week, in the rotation's order. A week-2 night only on
 * a fortnight shop; a meal over the cook cap, or gone from the library, left
 * out; never more nights a week than the household cooks. Servings are the
 * household's default for the meal. The athlete moves any night from here.
 */
export function rotationEntries(slug: string, members: RotationMealRow[], meals: MealRow[], household: Household): PlanEntry[] {
  const bySlug = new Map(meals.map((m) => [m.slug, m]))
  const out: PlanEntry[] = []
  for (let w = 1; w <= cycleWeeks(household); w++) {
    const nights = members
      .filter((x) => x.rotation_slug === slug && x.week === w)
      .sort((a, b) => a.sort_order - b.sort_order || a.meal_slug.localeCompare(b.meal_slug))
      .map((x) => bySlug.get(x.meal_slug))
      .filter((m): m is MealRow => !!m && m.active_cook_minutes <= household.cook_cap_minutes)
      .slice(0, household.nights_per_week)
    for (const m of nights) out.push({ slug: m.slug, week: w as 1 | 2, servings: defaultServings(m, household) })
  }
  return out
}

/**
 * The rotation a set of picks ran, read from the picks: the rotation with the
 * most picked meals that belong to it ALONE. A meal in more than one rotation
 * says nothing about which was run. Null when no such meal is picked, or when
 * two rotations tie — never a guess.
 */
export function rotationOf(entries: Pick<PlanEntry, 'slug'>[], rotations: RotationRow[], members: RotationMealRow[]): string | null {
  const homes = new Map<string, Set<string>>()
  for (const x of members) homes.set(x.meal_slug, (homes.get(x.meal_slug) ?? new Set<string>()).add(x.rotation_slug))
  const picked = new Set(entries.map((e) => e.slug))
  let best: string | null = null
  let bestCount = 0
  let tied = false
  for (const r of sortedRotations(rotations)) {
    let count = 0
    for (const s of picked) { const h = homes.get(s); if (h && h.size === 1 && h.has(r.slug)) count++ }
    if (count > bestCount) { best = r.slug; bestCount = count; tied = false }
    else if (count > 0 && count === bestCount) tied = true
  }
  return bestCount > 0 && !tied ? best : null
}

/** The rotation the cycle before `targetStart` ran: that cycle's newest version, read through rotationOf. Null with no cycle before it. */
export function rotationJustRun(history: Array<{ week_start: string; version: number; meal_ids: Pick<PlanEntry, 'slug'>[] }>, targetStart: string, rotations: RotationRow[], members: RotationMealRow[]): string | null {
  let prev: { week_start: string; version: number; meal_ids: Pick<PlanEntry, 'slug'>[] } | null = null
  for (const r of history) {
    if (r.week_start >= targetStart) continue
    if (!prev || r.week_start > prev.week_start || (r.week_start === prev.week_start && r.version > prev.version)) prev = r
  }
  return prev ? rotationOf(prev.meal_ids, rotations, members) : null
}

/** The rotation a new cycle starts from: the lowest sort_order the household has not just run. With nothing run, or only one rotation, the lowest. */
export function defaultRotation(rotations: RotationRow[], justRun: string | null): string | null {
  const sorted = sortedRotations(rotations)
  return (sorted.find((r) => r.slug !== justRun) ?? sorted[0])?.slug ?? null
}
