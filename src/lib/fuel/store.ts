// ── Fuel: the I/O edge ───────────────────────────────────────────────────────
// Everything that touches Supabase for Fuel lives here, thin, so the solver
// and the tick model stay pure. The ROW is authoritative for check state
// (ticks.ts): the only write to items[].checked goes through the database
// function fuel_set_item_checked, which returns the whole row's items. A
// new version is ONE database call, fuel_create_version, which inserts the
// plan and its list in the same transaction and picks the version number
// under the unique constraint — no orphan plan, no client-side race.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Household, ListItem, MealRow, Plan } from './types'
import { buildShoppingList } from './solve'
import { snapshot, type RulesSnapshot } from './version'
import { activeCycle, upcomingCycle, type CycleRow } from './cycle'

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
  return err.code === '42P01' || err.code === 'PGRST205' || err.code === 'PGRST202' || /relation .* does not exist|Could not find the (table|function)/i.test(err.message ?? '')
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

/**
 * The live cycle's newest plan and its list. A fortnight plan stays live for
 * fourteen days from its start (cycle.ts), so the second week — and the
 * second trip — is still on the page.
 */
export async function loadActive(db: Db, userId: string, today: Date): Promise<{ plan: PlanRow | null; list: ListRow | null; upcoming: PlanRow | null; error: { code?: string; message?: string } | null }> {
  // The last few starts are enough: anything older than a cycle is not live.
  const { data: rows, error } = await db.from('fuel_plans').select('id, week_start, version, meal_ids, rules_snapshot')
    .eq('user_id', userId).order('week_start', { ascending: false }).order('version', { ascending: false }).limit(20)
  if (error || !rows?.length) return { plan: null, list: null, upcoming: null, error }
  const candidates = (rows as PlanRow[]).map((r) => ({ ...r, shop_cadence_days: Number(r.rules_snapshot?.shop_cadence_days ?? 7) }))
  // A cycle planned ahead is loadable before it is live (Codex, round 4).
  const upcoming = upcomingCycle<PlanRow & CycleRow>(candidates, today)
  const plan = activeCycle<PlanRow & CycleRow>(candidates, today) ?? upcoming
  if (!plan) return { plan: null, list: null, upcoming: null, error: null }
  const { data: list, error: lerr } = await db.from('fuel_lists').select('id, plan_id, version, items, updated_at')
    .eq('plan_id', plan.id).order('version', { ascending: false }).limit(1).maybeSingle()
  return { plan, list: (list as ListRow | null) ?? null, upcoming: upcoming && upcoming.id !== plan.id ? upcoming : null, error: lerr }
}

/** The newest list for a plan — used to resume a cycle the athlete chose. */
export async function loadListFor(db: Db, planId: string): Promise<ListRow | null> {
  const { data } = await db.from('fuel_lists').select('id, plan_id, version, items, updated_at')
    .eq('plan_id', planId).order('version', { ascending: false }).limit(1).maybeSingle()
  return (data as ListRow | null) ?? null
}

/** Every version of a cycle, oldest first — proof that regeneration keeps history. */
export async function loadVersions(db: Db, userId: string, weekStart: string): Promise<Array<{ version: number; created_at: string; id: string }>> {
  const { data } = await db.from('fuel_plans').select('id, version, created_at').eq('user_id', userId).eq('week_start', weekStart).order('version', { ascending: true })
  return (data ?? []) as Array<{ version: number; created_at: string; id: string }>
}

/**
 * Solve, then write version + 1 in ONE transaction: plan row and list row
 * together, the version number chosen inside the database under the unique
 * constraint. Old versions are never touched (L7).
 */
export async function createVersion(db: Db, weekStart: string, household: Household, meals: MealRow[], plan: Plan): Promise<{ plan: PlanRow | null; list: ListRow | null; error: { code?: string; message?: string } | null }> {
  if (typeof db.rpc !== 'function') return { plan: null, list: null, error: { message: 'no client' } }
  const list = buildShoppingList(household, meals, plan)
  const { data, error } = await db.rpc('fuel_create_version', {
    p_week_start: weekStart, p_meal_ids: plan.entries, p_rules_snapshot: snapshot(household, plan), p_items: list.items,
  })
  if (error || !data) return { plan: null, list: null, error }
  const row = data as { plan_id: string; list_id: string; version: number; updated_at: string }
  return {
    plan: { id: row.plan_id, week_start: weekStart, version: row.version, meal_ids: plan.entries, rules_snapshot: snapshot(household, plan) },
    list: { id: row.list_id, plan_id: row.plan_id, version: row.version, items: list.items, updated_at: row.updated_at },
    error: null,
  }
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
