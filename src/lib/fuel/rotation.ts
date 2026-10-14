// ── Fuel: rotations (FOR-238) ────────────────────────────────────────────────
// A rotation is a named fortnight: eight meals, each with the week it USUALLY
// falls in. It is where the builder STARTS a version of the selected cycle —
// never a second thing the page shows. The plan's own PlanEntry.week stays the
// athlete's and overrides the rotation's default. Which rotation a plan ran is
// RECORDED on the plan when it is built (FOR-279): the soup fortnights share
// most of their dinners with A and B, so the picks alone stopped being able to
// say. Reading it back from the picks is the fallback, for plans built before
// the record. Pure: rows in, no I/O, no clock.
import type { Household, MealRow, PlanEntry, RotationMealRow, RotationRow } from './types'
import { cycleWeeks, defaultServings } from './solve'
import { newestVersion } from './cycle'

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

/** A stored plan, as far as a rotation is concerned: its nights, and the rotation recorded on it when it was built (FOR-279). */
export interface RanPlan {
  meal_ids: Pick<PlanEntry, 'slug'>[]
  rotation_slug?: string | null
}

/**
 * The rotation a stored plan ran (FOR-279): the one RECORDED on it when it was
 * built. rotationOf can only read a rotation from the dinners that are its
 * alone, and the soup fortnights share all but two of theirs with A and B —
 * a household whose cook cap leaves the soups out, or one swapped night, and
 * the picks say nothing or say the wrong thing. The record does not depend on
 * what the picks happen to be.
 *
 * rotationOf stays as the fallback, for the plans built before the record
 * existed, and for a record that names a rotation no longer in the library —
 * a slug nothing resolves is not an answer.
 */
export function planRotation(plan: RanPlan, rotations: RotationRow[], members: RotationMealRow[]): string | null {
  const recorded = plan.rotation_slug
  if (recorded && rotations.some((r) => r.slug === recorded)) return recorded
  return rotationOf(plan.meal_ids, rotations, members)
}

/**
 * The rotation the picks in the builder are (FOR-279): the one they were
 * STARTED from, for as long as it still describes them; otherwise what
 * rotationOf reads from them. This is what a build records on the plan.
 *
 * It still describes them while at least half the picks are its dinners AND
 * no other rotation holds more of them. The first half is a rotation with a
 * night changed, which is still that rotation — on a two-night week too, where
 * one swap is half the plan (Codex r1). The second is picks rebuilt by hand
 * into another rotation: A and B share three dinners, so rotation B's eight
 * are three of A's, and B's own week one is three of A's four — neither is
 * rotation A any more, and both are more B's than A's. A tie stays with the
 * start: three dinners every rotation shares are the start's as much as
 * anyone's, and the start is the one thing known about them.
 *
 * With no start, or a start that has stopped describing the picks, the picks
 * are read as they always were.
 */
export function chosenRotation(started: string | null | undefined, entries: Pick<PlanEntry, 'slug'>[], rotations: RotationRow[], members: RotationMealRow[]): string | null {
  if (started && rotations.some((r) => r.slug === started) && entries.length > 0) {
    const held = (slug: string) => {
      const its = new Set(members.filter((x) => x.rotation_slug === slug).map((x) => x.meal_slug))
      return entries.filter((e) => its.has(e.slug)).length
    }
    const kept = held(started)
    if (kept * 2 >= entries.length && rotations.every((r) => held(r.slug) <= kept)) return started
  }
  return rotationOf(entries, rotations, members)
}

/** The rotation the cycle before `targetStart` ran: that cycle's newest version, read through planRotation. Null with no cycle before it. */
export function rotationJustRun(history: Array<{ week_start: string; version: number } & RanPlan>, targetStart: string, rotations: RotationRow[], members: RotationMealRow[]): string | null {
  let prev: ({ week_start: string; version: number } & RanPlan) | null = null
  for (const r of history) {
    if (r.week_start >= targetStart) continue
    if (!prev || r.week_start > prev.week_start || (r.week_start === prev.week_start && r.version > prev.version)) prev = r
  }
  return prev ? planRotation(prev, rotations, members) : null
}

/** The rotation a new cycle starts from: the lowest sort_order the household has not just run. With nothing run, or only one rotation, the lowest. */
export function defaultRotation(rotations: RotationRow[], justRun: string | null): string | null {
  const sorted = sortedRotations(rotations)
  return (sorted.find((r) => r.slug !== justRun) ?? sorted[0])?.slug ?? null
}

/**
 * Where the builder STARTS for a build landing on `targetStart`, decided on
 * that start alone. Picks already saved for it — the selected cycle rebuilt,
 * or the cycle planned ahead — are where it starts, at their newest version.
 * Any other start is a new cycle, whatever led to it: the next cycle, a fresh
 * start, or a fortnight shortened to weekly in its second week, which lands on
 * a new week (Codex, FOR-238 r1). A new cycle starts from the rotation the
 * cycle before it did not run. With no rotations, `fallback`: the selected
 * cycle's picks, as the builder started before rotations existed.
 */
export function builderStart(targetStart: string, history: Array<{ week_start: string; version: number; meal_ids: PlanEntry[]; rotation_slug?: string | null }>, rotations: RotationRow[], members: RotationMealRow[], meals: MealRow[], household: Household, fallback: PlanEntry[] | null): PlanEntry[] | null {
  const saved = newestVersion(history, targetStart)
  if (saved) return saved.meal_ids
  const slug = defaultRotation(rotations, rotationJustRun(history, targetStart, rotations, members))
  if (slug) return rotationEntries(slug, members, meals, household)
  return fallback
}

/**
 * The rotation builderStart's picks are (FOR-279), decided on the same start
 * by the same two questions: picks already saved for it are the rotation that
 * plan ran, and a new cycle is the rotation it was started from. Null with no
 * rotations — the fallback picks belong to none.
 */
export function builderStartRotation(targetStart: string, history: Array<{ week_start: string; version: number; meal_ids: PlanEntry[]; rotation_slug?: string | null }>, rotations: RotationRow[], members: RotationMealRow[]): string | null {
  const saved = newestVersion(history, targetStart)
  if (saved) return planRotation(saved, rotations, members)
  return defaultRotation(rotations, rotationJustRun(history, targetStart, rotations, members))
}
