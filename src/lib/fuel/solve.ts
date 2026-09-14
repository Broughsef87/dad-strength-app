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
import { daysBetween } from './cycle'

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
  tsp: { base: 'tsp', factor: 1 },
  tbsp: { base: 'tsp', factor: 3 },
}

/** The bulk units a pantry is bought in, offered at intake whatever the library says. */
export const BASE_UNITS = ['lb', 'oz', 'each', 'cup dry', 'bag'] as const

/**
 * Units the intake can record inventory in: the bulk units plus every unit
 * the library measures an ingredient in, so nothing on hand is impossible to
 * subtract — cloves, teaspoons and tablespoons included (Codex, round 7).
 */
export function libraryUnits(meals: Pick<MealRow, 'ingredients'>[]): string[] {
  const units = new Set<string>(BASE_UNITS)
  for (const m of meals) for (const ing of m.ingredients) units.add(ing.unit)
  return [...units]
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

/**
 * Cooked servings a night defaults to. The seed's `servings` is written for
 * a household of two: 3 on a night that reheats (a leftover night comes
 * free), 2 on a night that does not. For any household: everyone eats, and
 * a reheating night cooks half again (Codex, round 2 — a household of four
 * was defaulting to the seed's three).
 */
export function defaultServings(meal: Pick<MealRow, 'servings'>, household: Pick<Household, 'people_count'>): number {
  const people = Math.max(1, household.people_count)
  const reheats = meal.servings > 2
  return reheats ? Math.ceil(people * 1.5) : people
}

/** Steak nights allowed in one cycle from a per-month rule. Zero stays zero. */
export function steakNightsPerCycle(steakPerMonth: number, household: Pick<Household, 'shop_cadence_days'>): number {
  if (steakPerMonth <= 0) return 0
  return Math.ceil(steakPerMonth * (cycleWeeks(household) * 7) / 30)
}

/** A month, for the steak rule: four weeks. The cadence is weekly or fortnightly, so four weeks is the window a monthly allowance is judged over. */
export const MONTH_DAYS = 28

/** A cycle already planned, as the store holds it: its start, its version and its nights. */
export interface PlanHistory {
  week_start: string
  version: number
  meal_ids: PlanEntry[]
}

/**
 * Steak nights already planned in OTHER cycles that fall inside the four
 * weeks ending where the target cycle ends. Rounding the monthly allowance
 * up per cycle let a weekly household eat steak every week (Codex, round
 * 10); the rule is monthly, so it is judged across cycles. Only a start's
 * highest version speaks; a night is placed on its week's Monday; the
 * target cycle's own nights are the plan being judged, not history.
 */
export function steakNightsElsewhere(history: PlanHistory[], meals: MealRow[], targetStart: string, cadenceDays: number): number {
  const bySlug = new Map(meals.map((m) => [m.slug, m]))
  const latest = new Map<string, PlanHistory>()
  for (const r of history) {
    if (r.week_start === targetStart) continue
    const cur = latest.get(r.week_start)
    if (!cur || r.version > cur.version) latest.set(r.week_start, r)
  }
  const end = Math.max(7, cadenceDays)
  let n = 0
  for (const r of latest.values()) {
    const offset = daysBetween(targetStart, r.week_start)
    for (const e of r.meal_ids) {
      if (bySlug.get(e.slug)?.protein_cut !== 'ribeye') continue
      const night = offset + (e.week - 1) * 7
      if (night >= end - MONTH_DAYS && night < end) n++
    }
  }
  return n
}

/** Frequency rules the picker should have enforced; reported, never silently fixed. */
export function validatePlan(plan: Plan, meals: MealRow[], household: Household, context: { steakNightsElsewhere?: number } = {}): string[] {
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
    for (const e of plan.entries.filter((x) => x.week === w)) {
      if (e.servings > 0 && e.servings < household.people_count) warnings.push(`${e.slug}: cooks ${e.servings} for ${household.people_count} people`)
    }
  }
  const outOfCycle = plan.entries.filter((e) => e.week > weeks).length
  if (outOfCycle) warnings.push(`${outOfCycle} night${outOfCycle === 1 ? '' : 's'} planned for week 2 on a weekly shop`)
  const steak = plan.entries.map((e) => bySlug.get(e.slug)).filter((m) => m?.protein_cut === 'ribeye').length
  const steakCap = steakNightsPerCycle(rules.steak_per_month, household)
  if (steak > steakCap) warnings.push(`${steak} steak night${steak === 1 ? '' : 's'} in the cycle, rule is ${rules.steak_per_month} a month`)
  // The monthly allowance is judged over four weeks ACROSS cycles (Codex, round 10).
  const elsewhere = context.steakNightsElsewhere ?? 0
  if (steak > 0 && steak <= steakCap && steak + elsewhere > rules.steak_per_month) warnings.push(`${steak + elsewhere} steak nights in the four weeks to this cycle's end, rule is ${rules.steak_per_month} a month`)
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
  //
  // What is on hand goes to the MAIN shop first, then the second trip, in
  // store order — never in the order the nights were tapped (Codex, round
  // 4): the same plan must produce the same trips whichever meal was picked
  // first, and produce already in the fridge is used this week, not next.
  const inventory = household.inventory.map((i) => ({ ...i, left: i.qty }))
  const stocked: ListItem[] = []
  const lines: ListItem[] = []
  const order = new Map(household.store_section_order.map((s, i) => [s, i]))
  const rank = (s: string) => order.get(s) ?? household.store_section_order.length
  const allocation = [...buckets.entries()].sort(([, a], [, b]) =>
    Number(a.second_trip) - Number(b.second_trip) || rank(a.section) - rank(b.section) || a.section.localeCompare(b.section) || a.item.localeCompare(b.item))
  for (const [key, b] of allocation) {
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
      // The reason states the fraction that actually counted — half at 50%,
      // three quarters at 25% — and says nothing about meal prep when
      // nothing was diverted (Codex, round 8).
      reason = b.diverted && usable < 1
        ? `${inv.qty} ${inv.unit} on hand, ${Math.round(usable * 100)}% counts after meal prep`
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
