// ── Fuel: the I/O edge ───────────────────────────────────────────────────────
// Everything that touches Supabase for Fuel lives here, thin, so the solver
// and the tick model stay pure. The ROW is authoritative for check state
// (ticks.ts): the only write to items[].checked goes through the database
// function fuel_set_item_checked, which returns the whole row's items. A
// new version is ONE database call, fuel_create_version, which inserts the
// plan and its list in the same transaction and picks the version number
// under the unique constraint — no orphan plan, no client-side race.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Household, ListItem, MealRow, Plan, RotationMealRow, RotationRow } from './types'
import { buildShoppingList, householdFor } from './solve'
import { ownMealFields, ownMealRow, type OwnMealDraft } from './ownMeal'
import { snapshot, type RulesSnapshot } from './version'
import type { StapleRow } from './custom'
import { activeCycle, historyFloor, upcomingCycle, type CycleRow } from './cycle'

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
  /** When this version was built — the inventory's freshness is judged against it (Codex, round 17). */
  created_at?: string
}

export interface ListRow {
  id: string
  plan_id: string
  version: number
  items: ListItem[]
  updated_at: string
}

const MEAL_COLUMNS = 'slug, name, protein_cut, spice_profile, format, active_cook_minutes, total_minutes, servings, protein_g_per_person, perishable_within_days, rotation_note, ingredients'

/** PostgREST codes that mean "this column is not there yet" — the own-meals migration is not applied (FOR-242). */
export function isMissingColumn(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  return err.code === '42703' || err.code === 'PGRST204' || /column .* does not exist|Could not find the .* column/i.test(err.message ?? '')
}

/**
 * The library: the seeded meals plus this athlete's own, in ONE read (FOR-242).
 * Row security decides which rows come back — user_id IS NULL is the seeded
 * library and a value is the athlete's own — so nothing here filters by owner
 * and nothing downstream branches on where a meal came from.
 *
 * Before the own-meals migration is applied there is no user_id column and
 * there are no own meals, so the library reads exactly as it always did. That
 * is never "not ready"; any other failure is reported.
 */
export async function loadMeals(db: Db): Promise<{ meals: MealRow[]; error: { code?: string; message?: string } | null }> {
  let { data, error } = await db.from('fuel_meals').select(`${MEAL_COLUMNS}, user_id`).eq('active', true).order('slug')
  if (error && isMissingColumn(error)) ({ data, error } = await db.from('fuel_meals').select(MEAL_COLUMNS).eq('active', true).order('slug'))
  return { meals: (data ?? []) as MealRow[], error }
}

/**
 * Add a meal of the athlete's own. The slug is minted from the name ONCE, here,
 * and the database's CHECK refuses it if it is not in the owner's namespace.
 * The same name twice mints the same slug and the UNIQUE constraint refuses the
 * second — reported as words rather than as a constraint name.
 */
export async function createOwnMeal(db: Db, userId: string, draft: OwnMealDraft): Promise<{ meal: MealRow | null; error: { code?: string; message?: string } | null }> {
  const row = ownMealRow(userId, draft)
  if (!row) return { meal: null, error: { message: 'that name leaves nothing to build a slug from — give it a letter or a number' } }
  const { data, error } = await db.from('fuel_meals').insert(row).select(`${MEAL_COLUMNS}, user_id`).single()
  if (error?.code === '23505') return { meal: null, error: { code: error.code, message: `you already have a meal called "${draft.name.trim()}"` } }
  return { meal: (data as MealRow) ?? null, error }
}

/**
 * Edit one of the athlete's own meals. The SLUG IS NEVER TOUCHED, however the
 * name changes: fuel_rotation_meals.meal_slug references it, and fuel_plans and
 * stored lists carry it, so a rename that moved the slug would orphan a plan
 * the athlete has already shopped. Row security does the ownership check — a
 * seeded row is not visible to an UPDATE at all.
 */
export async function updateOwnMeal(db: Db, slug: string, draft: OwnMealDraft): Promise<{ meal: MealRow | null; error: { code?: string; message?: string } | null }> {
  const { data, error } = await db.from('fuel_meals').update(ownMealFields(draft)).eq('slug', slug).select(`${MEAL_COLUMNS}, user_id`).single()
  return { meal: (data as MealRow) ?? null, error }
}

/**
 * The rotations and their membership (FOR-238) — library data, like the
 * meals, read once. Before the rotations migration is applied the tables do
 * not exist: Fuel runs exactly as it did, with no rotations and no switcher,
 * and that is never "not ready". Any other failure is reported.
 */
export async function loadRotations(db: Db): Promise<{ rotations: RotationRow[]; members: RotationMealRow[]; error: { code?: string; message?: string } | null }> {
  const [r, m] = await Promise.all([
    db.from('fuel_rotations').select('slug, name, sort_order, note').order('sort_order').order('slug'),
    db.from('fuel_rotation_meals').select('rotation_slug, meal_slug, week, sort_order').order('rotation_slug').order('sort_order'),
  ])
  const error = r.error ?? m.error
  if (error) return { rotations: [], members: [], error: isMissingTable(error) ? null : error }
  return { rotations: (r.data ?? []) as RotationRow[], members: (m.data ?? []) as RotationMealRow[], error: null }
}

export async function loadHousehold(db: Db, userId: string): Promise<{ household: Household | null; updatedAt: string | null; error: { code?: string; message?: string } | null }> {
  const { data, error } = await db.from('fuel_household').select('*').eq('user_id', userId).maybeSingle()
  if (!data) return { household: null, updatedAt: null, error }
  return {
    updatedAt: typeof data.updated_at === 'string' ? data.updated_at : null,
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
export async function loadActive(db: Db, userId: string, today: Date): Promise<{ plan: PlanRow | null; list: ListRow | null; upcoming: PlanRow | null; recent: PlanRow[]; newestPlanAt: string | null; newestPlanKnown: boolean; error: { code?: string; message?: string } | null }> {
  // When was ANY plan last built? Unbounded, so a break longer than the
  // history window cannot pass off eaten stock as never counted (Codex, round
  // 18). A lookup that FAILS is reported as unknown, never as "none": unknown
  // is not fresh (FOR-233, finding 3).
  const { data: newest, error: newestError } = await db.from('fuel_plans').select('created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  const newestPlanAt = typeof newest?.created_at === 'string' ? newest.created_at : null
  const newestPlanKnown = !newestError
  // Bounded by START, not by row count: every start from five weeks back
  // (any live fortnight, and the four weeks the steak rule is judged over)
  // forward (anything planned ahead), all versions, so a busy cycle's
  // history cannot crowd the live cycle out (Codex, round 5). The rows come
  // back as `recent` for the rules that look across cycles (Codex, round 10).
  const { data: rows, error } = await db.from('fuel_plans').select('id, week_start, version, meal_ids, rules_snapshot, created_at')
    .eq('user_id', userId).gte('week_start', historyFloor(today)).order('week_start', { ascending: false }).order('version', { ascending: false }).limit(500)
  if (error || !rows?.length) return { plan: null, list: null, upcoming: null, recent: [], newestPlanAt, newestPlanKnown, error: error ?? newestError }
  const candidates = (rows as PlanRow[]).map((r) => ({ ...r, shop_cadence_days: Number(r.rules_snapshot?.shop_cadence_days ?? 7) }))
  // A cycle planned ahead is loadable before it is live (Codex, round 4) —
  // but it never STANDS IN for a live one: with nothing live, the page must
  // be able to plan the current week, not only rebuild the cycle ahead
  // (Codex, round 17).
  const upcoming = upcomingCycle<PlanRow & CycleRow>(candidates, today)
  const plan = activeCycle<PlanRow & CycleRow>(candidates, today)
  const recent = rows as PlanRow[]
  if (!plan) return { plan: null, list: null, upcoming, recent, newestPlanAt, newestPlanKnown, error: newestError }
  const { data: list, error: lerr } = await db.from('fuel_lists').select('id, plan_id, version, items, updated_at')
    .eq('plan_id', plan.id).order('version', { ascending: false }).limit(1).maybeSingle()
  return { plan, list: (list as ListRow | null) ?? null, upcoming, recent, newestPlanAt, newestPlanKnown, error: lerr ?? newestError }
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
 *
 * THE MERGE (FOR-240): the athlete's staples are merged into the items when
 * the version is created. One items array, so a custom line ticks through the
 * same function and inherits the same superseded-list guard (FU001). The
 * DATABASE is the only source of staple lines (Andrew's ruling A): the client
 * sends the solver's lines only, and fuel_create_version_with_staples drops
 * anything custom it is sent and rebuilds the staples from its own read under
 * the version's per-cycle lock, then writes through fuel_create_version. No
 * client read races the write in either direction: a staple saved in the gap
 * is on the new version and one stopped in the gap is not (Codex r1, r2).
 * One-offs are not carried. The list the page holds is the one the database
 * stored. Before the custom-items migration is applied that function does not
 * exist and there are no staples, so the version is written as it always was;
 * any other failure is reported, never retried around the lock.
 */
export async function createVersion(db: Db, weekStart: string, household: Household, meals: MealRow[], plan: Plan, inventoryCounted = true): Promise<{ plan: PlanRow | null; list: ListRow | null; error: { code?: string; message?: string } | null }> {
  if (typeof db.rpc !== 'function') return { plan: null, list: null, error: { message: 'no client' } }
  const list = buildShoppingList(householdFor(household, inventoryCounted), meals, plan)
  const args = { p_week_start: weekStart, p_meal_ids: plan.entries, p_rules_snapshot: snapshot(household, plan, inventoryCounted), p_items: list.items }
  let { data, error } = await db.rpc('fuel_create_version_with_staples', args)
  if (error && isMissingTable(error)) ({ data, error } = await db.rpc('fuel_create_version', args))
  if (error || !data) return { plan: null, list: null, error }
  const row = data as { plan_id: string; list_id: string; version: number; updated_at: string; items?: ListItem[] }
  const stored = Array.isArray(row.items) ? row.items : list.items
  return {
    plan: { id: row.plan_id, week_start: weekStart, version: row.version, meal_ids: plan.entries, rules_snapshot: snapshot(household, plan, inventoryCounted), created_at: row.updated_at },
    list: { id: row.list_id, plan_id: row.plan_id, version: row.version, items: stored, updated_at: row.updated_at },
    error: null,
  }
}

/** The one write to checked. Returns the row's items as the row now holds them. */
/** The SQLSTATE the tick function raises for a list whose cycle has a newer version (FOR-233, the write-side guard). */
export const SUPERSEDED = 'FU001'

export async function setItemChecked(db: Db, listId: string, key: string, checked: boolean): Promise<{ items: ListItem[] | null; error: { code?: string; message?: string } | null; superseded: boolean }> {
  if (typeof db.rpc !== 'function') return { items: null, error: { message: 'no client' }, superseded: false }
  const { data, error } = await db.rpc('fuel_set_item_checked', { p_list_id: listId, p_key: key, p_checked: checked })
  return { items: (data as ListItem[] | null) ?? null, error, superseded: error?.code === SUPERSEDED }
}

/** Re-read the row's items — the truth, for reconciliation after a reload or a reconnect. */
export async function readItems(db: Db, listId: string): Promise<ListItem[] | null> {
  const { data } = await db.from('fuel_lists').select('items').eq('id', listId).maybeSingle()
  return (data?.items as ListItem[] | undefined) ?? null
}

// ── The athlete's own items (FOR-240) ───────────────────────────────────────
/**
 * The staples still on: what every list built from now on carries. Before the
 * custom-items migration is applied the table does not exist — no staples, the
 * feature stays hidden, and Fuel runs as it did; that is never "not ready".
 */
export async function loadStaples(db: Db, userId: string): Promise<{ staples: StapleRow[]; available: boolean; error: { code?: string; message?: string } | null }> {
  const { data, error } = await db.from('fuel_staples').select('id, item, store_section').eq('user_id', userId).is('removed_at', null).order('created_at')
  if (error) return { staples: [], available: false, error: isMissingTable(error) ? null : error }
  return { staples: (data ?? []) as StapleRow[], available: true, error: null }
}

/** A new staple. The same item in the same aisle twice is refused by the unique index (23505) and reported as a duplicate. */
export async function addStaple(db: Db, userId: string, item: string, section: string): Promise<{ staple: StapleRow | null; duplicate: boolean; error: { code?: string; message?: string } | null }> {
  const { data, error } = await db.from('fuel_staples').insert({ user_id: userId, item: item.trim(), store_section: section }).select('id, item, store_section').single()
  return { staple: (data as StapleRow | null) ?? null, duplicate: error?.code === '23505', error }
}

/** Stop a staple on lists built from now on. The row is stamped, never deleted, and lists already built keep their copy. */
export async function stopStaple(db: Db, userId: string, id: string): Promise<{ error: { code?: string; message?: string } | null }> {
  const { error } = await db.from('fuel_staples').update({ removed_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId)
  return { error }
}

/**
 * Put a line on ONE list: a one-off, or a staple's own line — keyed on the
 * staple, so it is the very line every later version merges. Guarded like a
 * tick: refused on a superseded list (FU001), and it returns the row's items.
 */
export async function addCustomItem(db: Db, listId: string, item: string, section: string, stapleId: string | null = null): Promise<{ items: ListItem[] | null; error: { code?: string; message?: string } | null; superseded: boolean }> {
  if (typeof db.rpc !== 'function') return { items: null, error: { message: 'no client' }, superseded: false }
  const { data, error } = await db.rpc('fuel_add_custom_item', { p_list_id: listId, p_item: item, p_section: section, p_staple_id: stapleId })
  return { items: (data as ListItem[] | null) ?? null, error, superseded: error?.code === SUPERSEDED }
}

/** Take one of the athlete's lines off ONE list. The database refuses a solver line. */
export async function removeCustomItem(db: Db, listId: string, key: string): Promise<{ items: ListItem[] | null; error: { code?: string; message?: string } | null; superseded: boolean }> {
  if (typeof db.rpc !== 'function') return { items: null, error: { message: 'no client' }, superseded: false }
  const { data, error } = await db.rpc('fuel_remove_custom_item', { p_list_id: listId, p_key: key })
  return { items: (data as ListItem[] | null) ?? null, error, superseded: error?.code === SUPERSEDED }
}
