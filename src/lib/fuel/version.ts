// ── Fuel: versioned regeneration ─────────────────────────────────────────────
// L6 and L7: a rule change re-solves the whole rotation, and every change
// writes version + 1 with the old version kept. The rules that matter are
// snapshotted onto the plan, so two plans can be compared without the
// household row that has since changed.
import type { DietaryRules, Household, ListItem, Plan } from './types'

export interface RulesSnapshot {
  people_count: number
  nights_per_week: number
  cook_cap_minutes: number
  shop_cadence_days: number
  prep_diversion_pct: number
  dietary_rules: DietaryRules
  inventory: Household['inventory']
  /** Was what is on hand counted against this plan? A next cycle built early counts it only on say-so — the live cycle is eating it (Codex, round 15). Absent on older rows: counted. */
  inventory_counted?: boolean
  store_section_order: string[]
  entries: Plan['entries']
}

export function snapshot(household: Household, plan: Plan, inventoryCounted = true): RulesSnapshot {
  return {
    people_count: household.people_count,
    nights_per_week: household.nights_per_week,
    cook_cap_minutes: household.cook_cap_minutes,
    shop_cadence_days: household.shop_cadence_days,
    prep_diversion_pct: household.prep_diversion_pct,
    dietary_rules: { ...household.dietary_rules },
    inventory: inventoryCounted ? household.inventory.map((i) => ({ ...i })) : [],
    inventory_counted: inventoryCounted,
    store_section_order: [...household.store_section_order],
    entries: plan.entries.map((e) => ({ ...e })),
  }
}

/**
 * Deterministic: the same inputs produce the same text, whatever order the
 * keys arrived in. Postgres jsonb reorders object keys, so a snapshot read
 * back from fuel_plans must compare equal to one built fresh — and every
 * level is sorted, not just the top (a replacer array would drop nested keys
 * and make a dietary-rule change invisible).
 */
export function snapshotKey(s: RulesSnapshot): string {
  return canonical(s)
}

// A key whose value is undefined is omitted, as JSON omits it: a list or a
// snapshot read back from jsonb must compare equal to one built fresh, or
// every rebuild after a reload would be "different" and reset its ticks
// (Codex, round 12).
function canonical(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']'
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return '{' + Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + canonical(o[k])).join(',') + '}'
  }
  return JSON.stringify(v)
}

/** Does this household + plan differ from the version already stored? Compared the way that version was built: with what is on hand counted, or not. */
export function changed(previous: RulesSnapshot | null | undefined, household: Household, plan: Plan): boolean {
  if (!previous) return true
  return snapshotKey(previous) !== snapshotKey(snapshot(household, plan, previous.inventory_counted ?? true))
}

/**
 * The same list, ticks aside. A rebuild with the household and the nights
 * unchanged may still differ — the LIBRARY can have been corrected — so the
 * stored list stands only when a fresh solve comes out identical (Codex,
 * round 11).
 */
export function listUnchanged(built: ListItem[], stored: ListItem[]): boolean {
  const strip = (items: ListItem[]) => canonical(items.map((i) => ({ ...i, checked: false })))
  return strip(built) === strip(stored)
}

/**
 * Is what is on hand newer than every plan that could have eaten it? The
 * household saved after the newest plan was built — Sunday's intake done
 * before Sunday's plan — is fresh; otherwise a cycle has been eating it,
 * and a new cycle should not count it without being asked (Codex, round
 * 17). The newest plan is looked up on its own, unbounded: a break longer
 * than the cycle-history window must not read as "never planned" (round
 * 18). Nothing planned yet: fresh.
 */
export function inventoryFresh(householdSavedAt: string | null | undefined, newestPlanAt: string | null | undefined): boolean {
  if (!newestPlanAt) return true
  return !!householdSavedAt && Date.parse(householdSavedAt) > Date.parse(newestPlanAt)
}

/** The version the next write gets: one more than the latest, never a rewrite. */
export function nextVersion(latest: number | null | undefined): number {
  return (latest ?? 0) + 1
}
