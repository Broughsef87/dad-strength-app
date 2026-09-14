// ── Fuel: the I/O edge ───────────────────────────────────────────────────────
// Everything that touches Supabase for Fuel lives here, thin, so the solver
// and the tick model stay pure. The ROW is authoritative for check state
// (ticks.ts): the only write to items[].checked goes through the database
// function fuel_set_item_checked, which returns the whole row's items.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Household, ListItem, MealRow, Plan } from './types'
import { buildShoppingList } from './solve'
import { nextVersion, snapshot, type RulesSnapshot } from './version'

// The client util returns a stub when env is missing (build time); this is
// the loosest shape both satisfy.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = SupabaseClient<any, any, any> | any

export const DEFAULT_SECTION_ORDER = ['Produce', 'Meat & Seafood', 'Snacks', 'Dairy', 'Pantry', 'Frozen']

export const DEFAULT_HOUSEHOLD: Household = {
  people_count: 2,
  nights_per_week: 4,
  cook_cap_minutes: 30,
  shop_cadence_days: 14,
  prep_diversion_pct: 0,
  dietary_rules: {
    protein_floor_g_per_person: 40,
    fish_per_week: 1,
    ground_turkey_per_week: 1,
    steak_per_month: 2,
    no_tilapia: false,
    vegetable_every_night: true,
    minimal_added_fat: false,
    frugal_reuse: true,
  },
  inventory: [],
  store_section_order: DEFAULT_SECTION_ORDER,
}

/** Postgres/PostgREST codes that mean "the migration is not applied here". */
export function isMissingTable(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  return err.code === '42P01' || err.code === 'PGRST205' || /relation .* does not exist|Could not find the table/i.test(err.message ?? '')
}

export interface PlanRow {
  id: string
  week_start: string
  version: number
  meal_ids: Plan['entries']
  rules_snapshot: RulesSnapshot
}

export interface ListRow {
  id: string
  plan_id: string
  version: number
  items: ListItem[]
  updated_at: string
}

export async function loadMeals(db: Db): Promise<{ meals: MealRow[]; error: { code?: string; message?: string } | null }> {
  const { data, error } = await db.from('fuel_meals').select('slug, name, protein_cut, spice_profile, format, active_cook_minutes, total_minutes, servings, protein_g_per_person, perishable_within_days, rotation_note, ingredients').eq('active', true).order('slug')
  return { meals: (data ?? []) as MealRow[], error }
}

export async function loadHousehold(db: Db, userId: string): Promise<{ household: Household | null; error: { code?: string; message?: string } | null }> {
  const { data, error } = await db.from('fuel_household').select('*').eq('user_id', userId).maybeSingle()
  if (!data) return { household: null, error }
  return {
    household: {
      people_count: data.people_count,
      nights_per_week: data.nights_per_week,
      cook_cap_minutes: data.cook_cap_minutes,
      shop_cadence_days: data.shop_cadence_days,
      prep_diversion_pct: data.prep_diversion_pct,
      dietary_rules: { ...DEFAULT_HOUSEHOLD.dietary_rules, ...(data.dietary_rules ?? {}) },
      inventory: Array.isArray(data.inventory) ? data.inventory : [],
      store_section_order: Array.isArray(data.store_section_order) && data.store_section_order.length ? data.store_section_order : DEFAULT_SECTION_ORDER,
    },
    error,
  }
}

export async function saveHousehold(db: Db, userId: string, h: Household) {
  return db.from('fuel_household').upsert({
    user_id: userId,
    people_count: h.people_count,
    nights_per_week: h.nights_per_week,
    cook_cap_minutes: h.cook_cap_minutes,
    shop_cadence_days: h.shop_cadence_days,
    prep_diversion_pct: h.prep_diversion_pct,
    dietary_rules: h.dietary_rules,
    inventory: h.inventory,
    store_section_order: h.store_section_order,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
}

/** The newest plan version for this week, and its list. */
export async function loadLatest(db: Db, userId: string, weekStart: string): Promise<{ plan: PlanRow | null; list: ListRow | null; error: { code?: string; message?: string } | null }> {
  const { data: plan, error } = await db.from('fuel_plans').select('id, week_start, version, meal_ids, rules_snapshot')
    .eq('user_id', userId).eq('week_start', weekStart).order('version', { ascending: false }).limit(1).maybeSingle()
  if (error || !plan) return { plan: null, list: null, error }
  const { data: list, error: lerr } = await db.from('fuel_lists').select('id, plan_id, version, items, updated_at')
    .eq('plan_id', plan.id).order('version', { ascending: false }).limit(1).maybeSingle()
  return { plan: plan as PlanRow, list: (list as ListRow | null) ?? null, error: lerr }
}

/** Every version this week, oldest first — proof that regeneration keeps history. */
export async function loadVersions(db: Db, userId: string, weekStart: string): Promise<Array<{ version: number; created_at: string; id: string }>> {
  const { data } = await db.from('fuel_plans').select('id, version, created_at').eq('user_id', userId).eq('week_start', weekStart).order('version', { ascending: true })
  return (data ?? []) as Array<{ version: number; created_at: string; id: string }>
}

/**
 * Solve and write version + 1: a new plan row AND a new list row. Old
 * versions are never touched (L7). Pure solve, then two inserts.
 */
export async function createVersion(db: Db, userId: string, weekStart: string, household: Household, meals: MealRow[], plan: Plan, latestVersion: number | null) {
  const version = nextVersion(latestVersion)
  const list = buildShoppingList(household, meals, plan)
  const { data: planRow, error: perr } = await db.from('fuel_plans').insert({
    user_id: userId, week_start: weekStart, version, meal_ids: plan.entries, rules_snapshot: snapshot(household, plan),
  }).select('id, week_start, version, meal_ids, rules_snapshot').single()
  if (perr || !planRow) return { plan: null, list: null, error: perr }
  const { data: listRow, error: lerr } = await db.from('fuel_lists').insert({
    plan_id: planRow.id, user_id: userId, version, items: list.items,
  }).select('id, plan_id, version, items, updated_at').single()
  return { plan: planRow as PlanRow, list: (listRow as ListRow | null) ?? null, error: lerr }
}

/** The one write to checked. Returns the row's items as the row now holds them. */
export async function setItemChecked(db: Db, listId: string, key: string, checked: boolean): Promise<{ items: ListItem[] | null; error: { code?: string; message?: string } | null }> {
  if (typeof db.rpc !== 'function') return { items: null, error: { message: 'no client' } }
  const { data, error } = await db.rpc('fuel_set_item_checked', { p_list_id: listId, p_key: key, p_checked: checked })
  return { items: (data as ListItem[] | null) ?? null, error }
}

/** Re-read the row's items — the truth, for reconciliation after a reload or a reconnect. */
export async function readItems(db: Db, listId: string): Promise<ListItem[] | null> {
  const { data } = await db.from('fuel_lists').select('items').eq('id', listId).maybeSingle()
  return (data?.items as ListItem[] | undefined) ?? null
}

/** Monday of the current week, local — the plan's week_start key. */
export function weekStartKey(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = d.getDay() // 0 Sun .. 6 Sat
  d.setDate(d.getDate() - ((day + 6) % 7))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
