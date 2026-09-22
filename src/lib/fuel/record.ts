// ── Fuel: what a night WAS, not what its meal is now (FOR-247) ───────────────
// The cross-cycle rules count past nights. They used to decide whether a past
// night was a steak by looking its slug up in the library AS IT STANDS NOW, so a
// plan's history was not a record of what was cooked — it was a list of slugs
// re-read against today's library. Edit a meal's cut and last month changed;
// retire it and its nights vanished from the count. While only a migration
// could change the library that was harmless. FOR-242 let an athlete change it.
//
// So a stored plan entry carries `as_planned`: the cut and the name its meal had
// when the plan was written. THE DATABASE WRITES IT, at the write, from its own
// read of fuel_meals — one writer for every path that inserts a plan, the same
// rule FOR-240 settled for staple lines. This client never asserts it: it is
// stripped from what is sent, and read back from what was stored.
//
// A night with no record was built before the record existed. It is still read
// against the library, exactly as before — and the database still refuses to
// change the cut of, or retire, a meal such a night stands on, because for that
// night the library IS its history. The lock the form shows is keyed on the same
// predicate the database checks, so the control and the refusal cannot disagree
// about which meals are frozen.
import type { AsPlanned, MealRow, PlanEntry } from './types'

/** The one cut the monthly allowance counts. */
export const STEAK_CUT = 'ribeye'

/** Does this night carry the database's record of what it was? */
export function isRecorded(e: PlanEntry): e is PlanEntry & { as_planned: AsPlanned } {
  return !!e.as_planned && typeof e.as_planned === 'object'
}

/**
 * The entry with its record removed. Everything the client SENDS goes through
 * this, and so does everything it COMPARES: a stored plan's rules snapshot
 * never carried a record, so a comparison that saw one would call every stored
 * plan stale the moment the database started writing them.
 */
export function withoutRecord(e: PlanEntry): PlanEntry {
  const { as_planned, ...rest } = e
  void as_planned
  return rest
}

/**
 * What a PAST night counted as. Its record when it has one; otherwise the
 * library as it stands, which is only safe because the database will not let
 * that meal's cut change, or the meal retire, while such a night exists.
 */
export function pastCut(e: PlanEntry, meals: MealRow[]): string | null {
  if (isRecorded(e)) return e.as_planned.protein_cut
  return meals.find((m) => m.slug === e.slug)?.protein_cut ?? null
}

/**
 * The meals whose cut and retirement are frozen: every slug a stored night
 * stands on WITHOUT a record. The database's refusal checks exactly this, so a
 * meal the form lets you retire is one the database lets you retire.
 */
export function unrecordedSlugs(history: Array<{ meal_ids: PlanEntry[] }>): Set<string> {
  return new Set(history.flatMap((h) => h.meal_ids.filter((e) => !isRecorded(e)).map((e) => e.slug)))
}
