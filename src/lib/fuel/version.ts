// ── Fuel: versioned regeneration ─────────────────────────────────────────────
// L6 and L7: a rule change re-solves the whole rotation, and every change
// writes version + 1 with the old version kept. The rules that matter are
// snapshotted onto the plan, so two plans can be compared without the
// household row that has since changed.
import type { DietaryRules, Household, Plan } from './types'

export interface RulesSnapshot {
  people_count: number
  nights_per_week: number
  cook_cap_minutes: number
  shop_cadence_days: number
  prep_diversion_pct: number
  dietary_rules: DietaryRules
  inventory: Household['inventory']
  store_section_order: string[]
  entries: Plan['entries']
}

export function snapshot(household: Household, plan: Plan): RulesSnapshot {
  return {
    people_count: household.people_count,
    nights_per_week: household.nights_per_week,
    cook_cap_minutes: household.cook_cap_minutes,
    shop_cadence_days: household.shop_cadence_days,
    prep_diversion_pct: household.prep_diversion_pct,
    dietary_rules: { ...household.dietary_rules },
    inventory: household.inventory.map((i) => ({ ...i })),
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

function canonical(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']'
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return '{' + Object.keys(o).sort().map((k) => JSON.stringify(k) + ':' + canonical(o[k])).join(',') + '}'
  }
  return JSON.stringify(v)
}

/** Does this household + plan differ from the version already stored? */
export function changed(previous: RulesSnapshot | null | undefined, household: Household, plan: Plan): boolean {
  if (!previous) return true
  return snapshotKey(previous) !== snapshotKey(snapshot(household, plan))
}

/** The version the next write gets: one more than the latest, never a rewrite. */
export function nextVersion(latest: number | null | undefined): number {
  return (latest ?? 0) + 1
}
