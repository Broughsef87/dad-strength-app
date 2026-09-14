// ── Fuel: the solver ─────────────────────────────────────────────────────────
// A deterministic function from rows to a shopping list, the program engine's
// shape again: (household, meals, plan) → list. No I/O, no AI, no clock.
//
// The eight learnings this encodes (FOR-177):
//   L1  inventory-first — the subtraction is the feature, and a covered item
//       is LISTED with its reason, never silently dropped.
//   L2  prep diversion — half of all meat bought or on hand is cooked off for
//       meal prep, so only half of meat inventory counts and any meat purchase
//       must DOUBLE. Division by (1 − pct), never a fudge factor.
//   L3  perishability drives trip structure — the fortnight's second-week fresh
//       fish and produce come from a second trip, kept as its own section.
//   L4  portions are raw weight per cut — the seed rows carry each cut's raw
//       weight for its own protein figure; a higher floor scales the cut UP.
//   L5  variety is spice profile and format over the same ingredients — the
//       library's job; the solver just aggregates the same items across nights.
//   L6/L7 rules compose and every change re-solves — the caller re-runs this
//       and writes version + 1 (see version.ts).
//   L8  the deliverable is a checklist — the output is sections of items in
//       store order, ready to tick.
import type { Household, ListItem, ListSection, MealIngredient, MealRow, Plan, PlanEntry, ShoppingList } from './types'

/** Cuts the household buys fresh, close to the night they are cooked; everything else freezes. Sourced: "week-1 fresh fish at Costco, week-2 fish and produce elsewhere". */
export const FRESH_ONLY_CUTS = ['salmon', 'cod_halibut', 'cod', 'halibut'] as const
export const MEAT_SECTION = 'Meat & Seafood'
export const PRODUCE_SECTION = 'Produce'
export const SECOND_TRIP_SECTION = 'Second trip'
export const STOCKED_SECTION = 'Stocked'

/** Unit conversions the inventory subtraction understands. Everything else must match units exactly. */
const TO_BASE: Record<string, { base: string; factor: number }> = {
  oz: { base: 'lb', factor: 1 / 16 },
  lb: { base: 'lb', factor: 1 },
  'cup dry': { base: 'lb', factor: 0.44 }, // dry rice: one cup ≈ 0.44 lb
  cup_dry: { base: 'lb', factor: 0.44 },
}

const norm = (s: string) => s.trim().toLowerCase()
const round = (n: number) => Math.round(n * 100) / 100

/** How many weeks a cycle spans: a fortnight shop is two, anything shorter is one. */
export function cycleWeeks(household: Pick<Household, 'shop_cadence_days'>): 1 | 2 {
  return household.shop_cadence_days >= 14 ? 2 : 1
}

/** Is this line diverted to meal prep — meat or seafood? */
export function isDiverted(ing: Pick<MealIngredient, 'store_section'>): boolean {
  return ing.store_section === MEAT_SECTION
}

/**
 * L2 as arithmetic. At 50% diversion, need ÷ (1 − 0.5) = need × 2: what is
 * bought must double, because half of it leaves for meal prep. (1 + pct)
 * would give ×1.5, and that is the fudge factor that ran a real plan out in
 * week 2.
 */
export function purchaseMultiplier(prepDiversionPct: number): number {
  const pct = Math.min(Math.max(prepDiversionPct, 0), 90) / 100
  return 1 / (1 - pct)
}

/** L2 on inventory: only (1 − pct) of meat on hand counts toward dinners. */
export function usableInventoryFraction(prepDiversionPct: number): number {
  const pct = Math.min(Math.max(prepDiversionPct, 0), 90) / 100
  return 1 - pct
}

/**
 * L4: the seed's raw weight per cut is for the meal's own protein figure. A
 * household floor above it scales the cut up, pro rata; a floor below it
 * leaves the recipe's portion alone — a plan never serves less than the
 * meal was written for.
 */
export function proteinScale(meal: Pick<MealRow, 'protein_g_per_person'>, floorG: number): number {
  if (!meal.protein_g_per_person || meal.protein_g_per_person <= 0 || !floorG) return 1
  return Math.max(1, floorG / meal.protein_g_per_person)
}

/** L3: does this ingredient, cooked in this week of the cycle, come from the second trip? */
export function isSecondTrip(ing: MealIngredient, meal: MealRow, entry: PlanEntry, household: Household): boolean {
  if (cycleWeeks(household) < 2 || entry.week !== 2) return false
  if (ing.store_section === PRODUCE_SECTION) return true
  if (ing.store_section === MEAT_SECTION && (FRESH_ONLY_CUTS as readonly string[]).includes(meal.protein_cut)) return true
  return false
}

/** Steak nights allowed in one cycle from a per-month rule. Zero stays zero. */
export function steakNightsPerCycle(steakPerMonth: number, household: Pick<Household, 'shop_cadence_days'>): number {
  if (steakPerMonth <= 0) return 0
  return Math.ceil(steakPerMonth * (cycleWeeks(household) * 7) / 30)
}

/** Frequency rules the picker should have enforced; reported, never silently fixed. */
export function validatePlan(plan: Plan, meals: MealRow[], household: Household): string[] {
  const bySlug = new Map(meals.map((m) => [m.slug, m]))
  const rules = household.dietary_rules
  const warnings: string[] = []
  const weeks = cycleWeeks(household)
  for (let w = 1; w <= weeks; w++) {
    const week = plan.entries.filter((e) => e.week === w).map((e) => bySlug.get(e.slug)).filter((m): m is MealRow => !!m)
    const fish = week.filter((m) => (FRESH_ONLY_CUTS as readonly string[]).includes(m.protein_cut)).length
    const turkey = week.filter((m) => m.protein_cut === 'ground_turkey').length
    if (fish > rules.fish_per_week) warnings.push(`week ${w}: ${fish} fish nights, rule is ${rules.fish_per_week}`)
    if (turkey > rules.ground_turkey_per_week) warnings.push(`week ${w}: ${turkey} turkey nights, rule is ${rules.ground_turkey_per_week}`)
    if (week.length > household.nights_per_week) warnings.push(`week ${w}: ${week.length} nights planned, household cooks ${household.nights_per_week}`)
    for (const m of week) {
      if (m.active_cook_minutes > household.cook_cap_minutes) warnings.push(`${m.slug}: ${m.active_cook_minutes} active minutes, cap is ${household.cook_cap_minutes}`)
      if (!m.protein_g_per_person) warnings.push(`${m.slug}: no protein figure, so the ${rules.protein_floor_g_per_person} g floor cannot be applied to it`)
    }
  }
  const outOfCycle = plan.entries.filter((e) => e.week > weeks).length
  if (outOfCycle) warnings.push(`${outOfCycle} night${outOfCycle === 1 ? '' : 's'} planned for week 2 on a weekly shop`)
  const steak = plan.entries.map((e) => bySlug.get(e.slug)).filter((m) => m?.protein_cut === 'ribeye').length
  const steakCap = steakNightsPerCycle(rules.steak_per_month, household)
  if (steak > steakCap) warnings.push(`${steak} steak night${steak === 1 ? '' : 's'} in the cycle, rule is ${rules.steak_per_month} a month`)
  for (const e of plan.entries) if (!bySlug.has(e.slug)) warnings.push(`${e.slug}: not in the library`)
  return warnings
}

interface Bucket {
  item: string
  unit: string
  section: string
  second_trip: boolean
  /** Dinner need, UNSCALED — what the table eats. */
  need: number
  inferred: boolean
  from: Set<string>
  diverted: boolean
}

/**
 * The shopping list for a plan. Pure: same rows in, same list out.
 *
 * Per ingredient per night: qty_per_person × servings cooked that night,
 * the protein line scaled up to the household's floor (L4). Summed per
 * item, unit and trip as DINNER NEED. Inventory then comes off that need —
 * meat on hand at (1 − diversion), because half of it leaves too — to zero,
 * never below; a covered item is listed under Stocked with the reason. What
 * is still needed is what must reach the table, so meat and seafood are
 * divided by (1 − diversion) LAST: the purchase covers dinner after meal
 * prep takes its half. Grouped by store section in the household's walk
 * order; the second trip is its own section at the end.
 */
export function buildShoppingList(household: Household, meals: MealRow[], plan: Plan): ShoppingList {
  const bySlug = new Map(meals.map((m) => [m.slug, m]))
  const mult = purchaseMultiplier(household.prep_diversion_pct)
  const usable = usableInventoryFraction(household.prep_diversion_pct)
  const floor = household.dietary_rules.protein_floor_g_per_person
  const buckets = new Map<string, Bucket>()

  for (const entry of plan.entries) {
    const meal = bySlug.get(entry.slug)
    if (!meal) continue
    const servings = entry.servings > 0 ? entry.servings : meal.servings
    const scale = proteinScale(meal, floor)
    for (const ing of meal.ingredients) {
      const trip2 = isSecondTrip(ing, meal, entry, household)
      const diverted = isDiverted(ing)
      const key = `${ing.store_section}:${norm(ing.item)}:${norm(ing.unit)}${trip2 ? ':trip2' : ''}`
      const b = buckets.get(key) ?? {
        item: ing.item, unit: ing.unit, section: ing.store_section, second_trip: trip2,
        need: 0, inferred: false, from: new Set<string>(), diverted,
      }
      b.need += ing.qty_per_person * servings * (diverted ? scale : 1)
      b.inferred = b.inferred || ing.inferred
      b.from.add(meal.slug)
      buckets.set(key, b)
    }
  }

  // L1: subtract what is on hand from the dinner need. Inventory is matched
  // by item name; units convert where the table knows how, otherwise they
  // must match exactly. Meat on hand counts at (1 − diversion).
  const inventory = household.inventory.map((i) => ({ ...i, left: i.qty }))
  const stocked: ListItem[] = []
  const lines: ListItem[] = []
  for (const [key, b] of buckets) {
    let need = b.need
    let reason: string | undefined
    for (const inv of inventory) {
      if (norm(inv.item) !== norm(b.item) || inv.left <= 0) continue
      const a = TO_BASE[norm(b.unit)], c = TO_BASE[norm(inv.unit)]
      let available: number
      let toInvUnits: number
      if (norm(inv.unit) === norm(b.unit)) { available = inv.left; toInvUnits = 1 }
      else if (a && c && a.base === c.base) { available = inv.left * c.factor / a.factor; toInvUnits = a.factor / c.factor }
      else continue
      const countable = available * (b.diverted ? usable : 1)
      const used = Math.min(need, countable)
      need -= used
      inv.left -= (used / (b.diverted ? usable : 1)) * toInvUnits
      reason = b.diverted
        ? `${inv.qty} ${inv.unit} on hand, half counts after meal prep`
        : `${inv.qty} ${inv.unit} on hand`
      if (need <= 0) break
    }
    // What still has to reach the table, scaled to what must be bought.
    const qty = need <= 0 ? 0 : need * (b.diverted ? mult : 1)
    const line: ListItem = {
      key, item: b.item, qty: round(Math.max(0, qty)), unit: b.unit, section: b.section,
      from: [...b.from].sort(), second_trip: b.second_trip, inferred: b.inferred,
      stocked: qty <= 0, stocked_reason: qty <= 0 ? reason : undefined, checked: false,
    }
    if (line.stocked) stocked.push(line); else lines.push(line)
  }

  // Store order: the household's walk, unknown sections after it, alphabetical.
  const order = new Map(household.store_section_order.map((s, i) => [s, i]))
  const rank = (s: string) => order.get(s) ?? household.store_section_order.length
  const byPlace = (a: ListItem, b: ListItem) => rank(a.section) - rank(b.section) || a.section.localeCompare(b.section) || a.item.localeCompare(b.item)
  const main = lines.filter((l) => !l.second_trip).sort(byPlace)
  const second_trip = lines.filter((l) => l.second_trip).sort(byPlace)
  stocked.sort(byPlace)

  const sections: ListSection[] = []
  for (const l of main) {
    const s = sections[sections.length - 1]
    if (s && s.section === l.section) s.items.push(l); else sections.push({ section: l.section, items: [l] })
  }
  return {
    sections, second_trip, stocked,
    warnings: validatePlan(plan, meals, household),
    items: [...main, ...second_trip, ...stocked],
  }
}

/** Sum of a list's purchasable lines — for the progress counter. */
export function purchasable(list: Pick<ShoppingList, 'items'>): ListItem[] {
  return list.items.filter((i) => !i.stocked)
}
