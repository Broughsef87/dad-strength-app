// ── Fuel: types ──────────────────────────────────────────────────────────────
// The shapes of the four tables (migration 20260914_fuel_phase_1.sql) and of
// the solver's output. Rows in, list out. Nothing here does I/O.

/** One ingredient line on a meal, per person, as seeded from Andrew's docs. */
export interface MealIngredient {
  item: string
  qty_per_person: number
  unit: string
  store_section: string
  /**
   * True when the quantity is Blaine's estimate, not Andrew's number. The
   * docs give protein weights per person and NAME every side, but never
   * quantify one. An inferred quantity is never presented as fact.
   */
  inferred: boolean
}

/** A fuel_meals row — the curated library, read-only to users. */
export interface MealRow {
  slug: string
  name: string
  protein_cut: string
  spice_profile: string
  format: string
  active_cook_minutes: number
  total_minutes: number | null
  /** Servings this meal is COOKED at — 3 for a chicken night so a leftover night comes free; 2 for steak, which does not reheat. */
  servings: number
  protein_g_per_person: number | null
  perishable_within_days: number | null
  rotation_note: string | null
  ingredients: MealIngredient[]
}

/** A fuel_rotations row — a named fortnight, read-only to users (FOR-238). */
export interface RotationRow {
  slug: string
  name: string
  sort_order: number
  note: string | null
}

/**
 * A fuel_rotation_meals row: one meal's place in a rotation, at the week it
 * USUALLY falls in. That week is where the builder starts; the plan's own
 * PlanEntry.week is the athlete's and overrides it (FOR-238).
 */
export interface RotationMealRow {
  rotation_slug: string
  meal_slug: string
  week: number
  sort_order: number
}

/** Dietary rules as intake captures them — taps and numbers, never prose. */
export interface DietaryRules {
  protein_floor_g_per_person: number
  fish_per_week: number
  ground_turkey_per_week: number
  steak_per_month: number
  no_tilapia: boolean
  vegetable_every_night: boolean
  minimal_added_fat: boolean
  frugal_reuse: boolean
}

export interface InventoryItem {
  item: string
  qty: number
  unit: string
}

/** A fuel_household row — one per user. */
export interface Household {
  people_count: number
  nights_per_week: number
  cook_cap_minutes: number
  shop_cadence_days: number
  /** L2. Percent of meat bought or on hand that is cooked off for meal prep. */
  prep_diversion_pct: number
  dietary_rules: DietaryRules
  inventory: InventoryItem[]
  store_section_order: string[]
}

/** One night on the plan: which meal, which week of the cycle, cooked at how many servings. */
export interface PlanEntry {
  slug: string
  /** 1 or 2 — the second week of a fortnight cycle is what the second trip serves. */
  week: 1 | 2
  /** Defaults to the meal's own servings; the planner may override per night. */
  servings: number
}

export interface Plan {
  entries: PlanEntry[]
}

/** One line on the shopping list. */
export interface ListItem {
  /** Stable identity for check state — section, item and unit, plus the trip. */
  key: string
  item: string
  qty: number
  unit: string
  section: string
  /** Meals this line serves, by slug. */
  from: string[]
  /** L3: bought on the mid-cycle top-up trip, not the main shop. */
  second_trip: boolean
  /** Any contributing quantity was inferred, so this total is an estimate. */
  inferred: boolean
  /** L1: inventory covers it — listed with the reason, never silently omitted. */
  stocked: boolean
  stocked_reason?: string
  checked: boolean
}

export interface ListSection {
  section: string
  items: ListItem[]
}

export interface ShoppingList {
  /** Main-shop sections, in the household's store order. */
  sections: ListSection[]
  /** The mid-cycle top-up, kept apart (L3). Empty when nothing is perishable past the cycle. */
  second_trip: ListItem[]
  /** Inventory verdicts (L1): needed, covered, no purchase. */
  stocked: ListItem[]
  /** Frequency-rule violations the picker let through — the solver reports, it does not fix. */
  warnings: string[]
  /** Everything, flat, in render order — what fuel_lists.items stores. */
  items: ListItem[]
}
