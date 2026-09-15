// ── Fuel Phase 1 (FOR-177) — standing check, its own file ───────────────────
// DoD artifact 2, plus the amendment's source-of-truth rule, plus the seams:
//   1. aggregation math — qty × servings cooked; meat and seafood ÷ (1 − diversion)
//      (at 50% that DOUBLES — L2 — never × 1.5)
//   2. inventory subtraction to zero, never negative; meat inventory counts at
//      (1 − diversion); a covered item is LISTED as stocked with its reason (L1)
//   3. section grouping in the household's store order
//   4. perishability split — week-2 fresh fish and produce go to the second
//      trip as their own section, week-1 fish stays on the main shop, meat that
//      freezes never moves (L3); blackened-cod is THE second-trip meal
//   5. version increments on a rule change, old version kept (L6, L7)
//   6. the row is authoritative for checked (ticks.ts): the outbox holds
//      intents, an acknowledgement replaces the render with the row, a fresh
//      read drops satisfied intents, nothing merges
//   7. the seams — migration generated from the fixture (parity), RLS on all
//      four tables in the SAME migration, the one write path exists, the
//      solver has no I/O and no AI, inferred quantities are marked, the nav
//      entry exists, the page is behind PremiumGate, PRO_FEATURES carries
//      the meal-planner line now that Fuel ships
// Every assertion verified by reintroducing the bug it catches and confirming
// it fires, then restoring the tree byte-identical.
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { buildShoppingList, purchaseMultiplier, usableInventoryFraction, isSecondTrip, validatePlan, proteinScale, steakNightsPerCycle, steakWindowWarnings, overlapWarnings, householdFor, defaultServings, libraryUnits, SECOND_TRIP_SECTION } from '../../src/lib/fuel/solve.ts'
import { changed, inventoryFresh, listUnchanged, nextVersion, snapshot } from '../../src/lib/fuel/version.ts'
import { activeCycle, cycleKeyFor, cycleStartFor, daysBetween, daysInto, expired, historyFloor, mondayOf, newestVersion, nextCycleKey, nextCycleStart, planningMode, rebuildKey, upcomingCycle } from '../../src/lib/fuel/cycle.ts'
import { acknowledge, adopt, drop, enqueue, hold, nextExpiry, orphans, outboxKey, outboxPrefix, ORPHAN_AFTER_MS, outstanding, progress, reconcile, released, render } from '../../src/lib/fuel/ticks.ts'
import { render as renderMigration, MIGRATION } from '../fuel-seed-sql.mjs'

let failures = 0, passes = 0
const assert = (cond, msg) => { if (cond) passes++; else { failures++; console.log('  ✗ ' + msg) } }
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const readLF = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')
const seed = JSON.parse(readLF('fixtures/fuel-seed.json'))
const meals = seed.fuel_meals
const byslug = (s) => meals.find((m) => m.slug === s)

// Andrew's household, from the fixture — every value sourced.
const andrew = {
  people_count: 2, nights_per_week: 4, cook_cap_minutes: 30, shop_cadence_days: 14, prep_diversion_pct: 50,
  dietary_rules: { protein_floor_g_per_person: 40, fish_per_week: 1, ground_turkey_per_week: 1, steak_per_month: 2, no_tilapia: true, vegetable_every_night: true, minimal_added_fat: true, frugal_reuse: true },
  inventory: [{ item: 'rice', qty: 25, unit: 'lb' }],
  store_section_order: seed.store_section_order,
}
const W1 = ['cast-iron-ribeye', 'chili-lime-thighs', 'lemon-garlic-salmon', 'greek-turkey-bowl']
const W2 = ['garlic-herb-thighs', 'turkey-burgers', 'blackened-cod', 'soy-ginger-stirfry']
const entry = (slug, week) => ({ slug, week, servings: byslug(slug).servings })
const fortnight = { entries: [...W1.map((s) => entry(s, 1)), ...W2.map((s) => entry(s, 2))] }
const find = (list, item, trip2 = false) => list.items.find((i) => i.item === item && i.second_trip === trip2)

// ── 1. aggregation ──────────────────────────────────────────────────────────
assert(purchaseMultiplier(50) === 2, `at 50% diversion a meat purchase DOUBLES — got ×${purchaseMultiplier(50)}`)
assert(purchaseMultiplier(0) === 1 && Math.abs(purchaseMultiplier(25) - 4 / 3) < 1e-9, 'diversion is ÷(1 − pct), not (1 + pct)')
assert(usableInventoryFraction(50) === 0.5, 'at 50% only half of meat on hand counts')
{
  const list = buildShoppingList(andrew, meals, fortnight)
  // thighs: 8 oz × 3 servings × 2 nights = 48, doubled → 96
  assert(find(list, 'chicken thigh, boneless skinless')?.qty === 96, `thighs across both weeks = 8 × 3 × 2 nights × 2 = 96 oz — got ${find(list, 'chicken thigh, boneless skinless')?.qty}`)
  assert(find(list, 'ground turkey 93/7')?.qty === 102, `turkey = 8.5 × 3 × 2 × 2 = 102 oz — got ${find(list, 'ground turkey 93/7')?.qty}`)
  assert(find(list, 'ribeye')?.qty === 32, `ribeye = 8 × 2 servings × 2 = 32 oz — got ${find(list, 'ribeye')?.qty}`)
  // sides are NOT diverted: broccoli week 1 = 6 oz × (2 + 3 servings) = 30
  assert(find(list, 'broccoli')?.qty === 30, `week-1 broccoli = 6 × (2 + 3) = 30 oz, no diversion on produce — got ${find(list, 'broccoli')?.qty}`)
  // servings cooked drive quantity, not people_count (the spec gap Blaine flagged)
  const two = buildShoppingList({ ...andrew, prep_diversion_pct: 0 }, meals, { entries: [{ slug: 'chili-lime-thighs', week: 1, servings: 3 }] })
  const three = buildShoppingList({ ...andrew, people_count: 3, prep_diversion_pct: 0 }, meals, { entries: [{ slug: 'chili-lime-thighs', week: 1, servings: 3 }] })
  assert(find(two, 'chicken thigh, boneless skinless')?.qty === 24 && find(three, 'chicken thigh, boneless skinless')?.qty === 24,
    'quantity is qty × servings COOKED — people_count does not multiply again')
  const same = buildShoppingList(andrew, meals, fortnight)
  assert(JSON.stringify(same) === JSON.stringify(list), 'the solve is deterministic')
  assert(find(list, 'ribeye')?.inferred === false && find(list, 'broccoli')?.inferred === true,
    'protein totals are exact; a side total is marked inferred because its inputs were')
  assert(find(list, 'garlic')?.from.join(',') === 'greek-turkey-bowl,lemon-garlic-salmon', 'the same item across nights aggregates to one line and names its meals')
  // L4: the floor drives raw weight. A 60 g floor scales the ribeye's 8 oz
  // (written for 48 g) to 10 oz; a 40 g floor leaves it at 8; sides untouched.
  assert(Math.abs(proteinScale(byslug('cast-iron-ribeye'), 60) - 1.25) < 1e-9 && proteinScale(byslug('cast-iron-ribeye'), 40) === 1, 'the protein floor scales a cut up, never down')
  const hungry = buildShoppingList({ ...andrew, prep_diversion_pct: 0, dietary_rules: { ...andrew.dietary_rules, protein_floor_g_per_person: 60 } }, meals, { entries: [{ slug: 'cast-iron-ribeye', week: 1, servings: 2 }] })
  assert(find(hungry, 'ribeye')?.qty === 20 && find(hungry, 'broccoli')?.qty === 12, `a 60 g floor buys 10 oz ribeye a serving (20 for two) and leaves the broccoli at 12 — got ${find(hungry, 'ribeye')?.qty} / ${find(hungry, 'broccoli')?.qty}`)
  assert(steakNightsPerCycle(0, andrew) === 0 && steakNightsPerCycle(2, andrew) === 1 && steakNightsPerCycle(2, { shop_cadence_days: 7 }) === 1, 'steak nights per cycle: two a month is one a fortnight, and zero stays zero')
  const noSteak = validatePlan(twoRibeye(), meals, { ...andrew, dietary_rules: { ...andrew.dietary_rules, steak_per_month: 0 } })
  assert(noSteak.some((w) => /steak night/.test(w)), 'a zero-steak household is warned about a ribeye night')
  // the monthly steak rule is judged over FOUR WEEKS ACROSS CYCLES (Codex r10), in EVERY window a planned cycle ends (r13).
  // Target 2026-09-21, weekly: this cycle's window is nights from the 31st of August to the 27th
  const weekly = { ...andrew, shop_cadence_days: 7 }
  const steakWeek = (start, week = 1, version = 1) => ({ week_start: start, version, meal_ids: [{ slug: 'cast-iron-ribeye', week, servings: 2 }], rules_snapshot: { shop_cadence_days: 7 } })
  const ctx = (history, targetStart = '2026-09-21', cadenceDays = 7) => ({ history, targetStart, cadenceDays })
  const steakW = (history, targetStart, cadenceDays) => steakWindowWarnings(twoRibeye(), meals, ctx(history, targetStart, cadenceDays), 2)
  const four = steakW([steakWeek('2026-08-31'), steakWeek('2026-09-07'), steakWeek('2026-09-14')])
  assert(four.length === 1 && /4 steak nights in the four weeks ending in this cycle, rule is 2 a month/.test(four[0]), `three weekly steak nights inside the window plus this one are four against two — got ${JSON.stringify(four)}`)
  assert(steakW([steakWeek('2026-08-24'), steakWeek('2026-09-21')]).length === 0, 'a night before the window, and the target start\'s own history, do not count')
  assert(steakW([steakWeek('2026-09-07'), steakWeek('2026-09-14'), { ...steakWeek('2026-09-14', 1, 2), meal_ids: [] }]).length === 0 && steakW([steakWeek('2026-09-07'), steakWeek('2026-09-14')]).length === 1,
    'only the highest version of a start counts — the 14th\'s v2 dropped its steak')
  const w2 = { ...steakWeek('2026-08-24', 2), rules_snapshot: { shop_cadence_days: 14 } }
  assert(steakW([w2]).length === 0 && steakW([w2, steakWeek('2026-09-07')]).length === 1, 'a fortnight\'s week-two night is placed on its own Monday — the 31st, inside the window')
  // a fortnight rebuilt as weekly in its second week does not keep counting the week it lost (r15): a fortnight from the 7th with steak in
  // week two, rebuilt on the 15th as a weekly cycle from the 14th with that same dinner, is ONE steak night against a one-a-month rule
  const fortnightSteakW2 = { week_start: '2026-09-07', version: 1, meal_ids: [{ slug: 'cast-iron-ribeye', week: 2, servings: 2 }], rules_snapshot: { shop_cadence_days: 14 } }
  assert(steakWindowWarnings(twoRibeye(), meals, ctx([fortnightSteakW2], '2026-09-14', 7), 1).length === 0 && steakWindowWarnings(twoRibeye(), meals, ctx([fortnightSteakW2], '2026-09-21', 7), 1).length === 1,
    'history is cut short where a later planned start takes over — the lost week\'s steak does not count against its replacement, but does against a cycle after it')
  // a rebuilt EARLIER cycle must not push a cycle planned ahead over ITS window (r13): steak in weeks one and three, then week two rebuilt with steak
  const ahead = steakW([steakWeek('2026-09-07'), steakWeek('2026-09-21')], '2026-09-14')
  assert(ahead.length === 1 && /3 steak nights in the four weeks ending in the cycle starting 2026-09-21, rule is 2 a month/.test(ahead[0]), `the window of the cycle planned ahead is judged too — got ${JSON.stringify(ahead)}`)
  // every WEEK boundary is a window end (r16): steak on the 31st and the 7th, then a fortnight from the 21st with steak in week one — three in the
  // four weeks to the 27th, a window that ends INSIDE the fortnight; with the steak in week two instead, two in any four weeks
  const mixed = ctx([steakWeek('2026-08-31'), steakWeek('2026-09-07')], '2026-09-21', 14)
  assert(steakWindowWarnings(twoRibeye(), meals, mixed, 2).length === 1 && steakWindowWarnings({ entries: [entry('cast-iron-ribeye', 2)] }, meals, mixed, 2).length === 0,
    'a four-week window ending inside a fortnight is judged — mixed cadences cannot slip a third steak past the rule')
  assert(validatePlan(twoRibeye(), meals, weekly, { cycles: ctx([steakWeek('2026-09-07'), steakWeek('2026-09-14')]) }).some((w) => /3 steak nights in the four weeks/.test(w))
    && validatePlan(twoRibeye(), meals, weekly, { cycles: ctx([steakWeek('2026-09-14')]) }).every((w) => !/four weeks/.test(w)) && validatePlan(twoRibeye(), meals, weekly).every((w) => !/four weeks/.test(w)),
    'a third steak in four weeks is reported against a two-a-month rule; a second is not; no history, no report')
  // a cadence cannot swallow a cycle planned ahead (Codex r14): weekly cycles on the 7th and the 14th, the 7th rebuilt as a fortnight
  const swallowed = overlapWarnings(ctx([steakWeek('2026-09-14')], '2026-09-07', 14))
  assert(swallowed.length === 1 && /the cycle starting 2026-09-14 is already planned and sits inside this fortnight/.test(swallowed[0]) && /keep this cycle weekly/.test(swallowed[0]),
    `a fortnight rebuilt over a weekly cycle planned inside it is refused, with the way out — got ${JSON.stringify(swallowed)}`)
  assert(overlapWarnings(ctx([steakWeek('2026-09-14')], '2026-09-07', 7)).length === 0 && overlapWarnings(ctx([steakWeek('2026-09-21')], '2026-09-07', 14)).length === 0 && overlapWarnings(ctx([steakWeek('2026-09-07')], '2026-09-07', 14)).length === 0 && overlapWarnings(ctx([steakWeek('2026-08-31')], '2026-09-07', 14)).length === 0,
    'a weekly rebuild, a cycle starting where the fortnight ends, the target start itself, and a cycle before it are not overlaps')
  assert(validatePlan(fortnight, meals, andrew, { cycles: ctx([steakWeek('2026-09-14')], '2026-09-07', 14) }).some((w) => /sits inside this fortnight/.test(w)), 'validatePlan reports the overlap, so the build is refused')
  function twoRibeye() { return { entries: [entry('cast-iron-ribeye', 1)] } }
  // servings default from the household (Codex r2): the seed's 3-for-2 is "everyone eats, plus half again for a leftover night"
  assert(defaultServings(byslug('chili-lime-thighs'), { people_count: 2 }) === 3 && defaultServings(byslug('cast-iron-ribeye'), { people_count: 2 }) === 2,
    'for two, the defaults are the seed\'s own: 3 on a reheating night, 2 on the steak night')
  assert(defaultServings(byslug('chili-lime-thighs'), { people_count: 4 }) === 6 && defaultServings(byslug('cast-iron-ribeye'), { people_count: 4 }) === 4 && defaultServings(byslug('chili-lime-thighs'), { people_count: 1 }) === 2,
    'for four, a reheating night cooks 6 and a steak night 4; for one, 2 and 1')
  const underfed = validatePlan({ entries: [{ slug: 'cast-iron-ribeye', week: 1, servings: 2 }] }, meals, { ...andrew, people_count: 4 })
  assert(underfed.some((w) => /cooks 2 for 4 people/.test(w)), 'a night that cooks fewer servings than people is reported')
}

// ── 2. inventory ────────────────────────────────────────────────────────────
{
  const list = buildShoppingList(andrew, meals, fortnight)
  const rice = list.stocked.find((i) => i.item === 'rice')
  assert(!!rice && rice.qty === 0 && /25 lb on hand/.test(rice.stocked_reason ?? ''), 'a 25 lb bag of rice covers the fortnight — listed as stocked with the reason, not dropped')
  assert(!list.sections.some((s) => s.items.some((i) => i.item === 'rice')), 'a stocked item is not also on the shop')
  // exact-unit subtraction to zero, never negative
  const l2 = buildShoppingList({ ...andrew, inventory: [{ item: 'broccoli', qty: 500, unit: 'oz' }] }, meals, fortnight)
  assert(l2.stocked.some((i) => i.item === 'broccoli') && l2.items.every((i) => i.qty >= 0), 'over-stock subtracts to zero, never negative')
  // partial subtraction
  const l3 = buildShoppingList({ ...andrew, inventory: [{ item: 'broccoli', qty: 10, unit: 'oz' }] }, meals, fortnight)
  assert(find(l3, 'broccoli')?.qty === 20, `10 oz on hand leaves 20 of the week-1 30 — got ${find(l3, 'broccoli')?.qty}`)
  // meat on hand counts at half (L2), and it comes off the DINNER need before
  // the purchase is scaled — never off the already-doubled figure (Codex r1)
  const l4 = buildShoppingList({ ...andrew, inventory: [{ item: 'chicken thigh, boneless skinless', qty: 4, unit: 'lb' }] }, meals, fortnight)
  assert(find(l4, 'chicken thigh, boneless skinless')?.qty === 32, `4 lb thighs on hand: 32 oz counts against a 48 oz dinner need, 16 left, doubled → 32 — got ${find(l4, 'chicken thigh, boneless skinless')?.qty}`)
  const twoSteaks = { entries: [{ slug: 'cast-iron-ribeye', week: 1, servings: 2 }] }
  const l4b = buildShoppingList({ ...andrew, inventory: [{ item: 'ribeye', qty: 32, unit: 'oz' }] }, meals, twoSteaks)
  assert(l4b.stocked.some((i) => i.item === 'ribeye') && find(l4b, 'ribeye')?.qty === 0 && !l4b.sections.some((s) => s.items.some((i) => i.item === 'ribeye')),
    '32 oz of ribeye on hand at 50% covers a 16 oz dinner need — nothing to buy, not another 16 oz')
  assert(/50% counts after meal prep/.test(l4b.stocked.find((i) => i.item === 'ribeye')?.stocked_reason ?? ''), 'the meat verdict says why only half counted')
  // the reason states the fraction that actually counted (Codex r8): 75% at a quarter diverted, and no meal-prep talk at zero
  const quarter = buildShoppingList({ ...andrew, prep_diversion_pct: 25, inventory: [{ item: 'ribeye', qty: 32, unit: 'oz' }] }, meals, twoSteaks)
  assert(/32 oz on hand, 75% counts after meal prep/.test(quarter.stocked.find((i) => i.item === 'ribeye')?.stocked_reason ?? ''), `at 25% diversion the verdict says 75% counts — got "${quarter.stocked.find((i) => i.item === 'ribeye')?.stocked_reason}"`)
  const none = buildShoppingList({ ...andrew, prep_diversion_pct: 0, inventory: [{ item: 'ribeye', qty: 32, unit: 'oz' }] }, meals, twoSteaks)
  assert(none.stocked.find((i) => i.item === 'ribeye')?.stocked_reason === '32 oz on hand', `with no diversion, no meal-prep explanation — got "${none.stocked.find((i) => i.item === 'ribeye')?.stocked_reason}"`)
  // mismatched units are not subtracted
  const l5 = buildShoppingList({ ...andrew, inventory: [{ item: 'lemon', qty: 3, unit: 'lb' }] }, meals, fortnight)
  assert(find(l5, 'lemon')?.qty === 2.5, 'inventory in a unit the item is not measured in is not subtracted')
  // inventory goes to the MAIN trip first, whichever night was tapped first (Codex r4)
  const hh = { ...andrew, inventory: [{ item: 'broccoli', qty: 12, unit: 'oz' }] }
  const codFirst = buildShoppingList(hh, meals, { entries: [entry('blackened-cod', 2), entry('cast-iron-ribeye', 1)] })
  const ribeyeFirst = buildShoppingList(hh, meals, { entries: [entry('cast-iron-ribeye', 1), entry('blackened-cod', 2)] })
  assert(JSON.stringify(codFirst.items) === JSON.stringify(ribeyeFirst.items), 'the same nights make the same trips whichever was picked first')
  assert(codFirst.stocked.some((i) => i.item === 'broccoli' && !i.second_trip) && find(codFirst, 'broccoli', true)?.qty === 12,
    '12 oz of broccoli on hand covers the main-trip broccoli; the second trip still buys its own')
  // the library's own units subtract (Codex r7): garlic in cloves; garlic
  // powder is 0.5 + 1 + 0.5 tsp × 3 servings = 6 tsp across the fortnight,
  // and a tablespoon on hand is three of them
  const offered = libraryUnits(meals)
  const used = [...new Set(meals.flatMap((m) => m.ingredients.map((i) => i.unit)))]
  assert(used.every((u) => offered.includes(u)) && ['lb', 'oz', 'each', 'bag'].every((u) => offered.includes(u)),
    `the intake offers every unit the library measures in, plus the bulk units — missing ${used.filter((u) => !offered.includes(u)).join(', ') || 'none'}`)
  const l6 = buildShoppingList({ ...andrew, inventory: [{ item: 'garlic', qty: 50, unit: 'clove' }, { item: 'garlic powder', qty: 1, unit: 'tbsp' }] }, meals, fortnight)
  assert(l6.stocked.some((i) => i.item === 'garlic') && !l6.sections.some((s) => s.items.some((i) => i.item === 'garlic')), 'garlic on hand in cloves comes off the list')
  assert(find(l6, 'garlic powder')?.qty === 3, `a tablespoon of garlic powder on hand counts as three teaspoons against six — got ${find(l6, 'garlic powder')?.qty}`)
}

// ── 3. sections ─────────────────────────────────────────────────────────────
{
  const list = buildShoppingList(andrew, meals, fortnight)
  const order = list.sections.map((s) => s.section)
  const expected = seed.store_section_order.filter((s) => order.includes(s))
  assert(order.join('|') === expected.join('|'), `sections follow the store walk — got ${order.join(' → ')}`)
  assert(list.sections.every((s) => s.items.every((i) => i.section === s.section)), 'every item sits in its own section')
  const walked = buildShoppingList({ ...andrew, store_section_order: ['Pantry', 'Produce', 'Meat & Seafood'] }, meals, fortnight)
  assert(walked.sections[0].section === 'Pantry', 'a household with a different walk gets its own order')
}

// ── 4. perishability / the second trip ──────────────────────────────────────
{
  const list = buildShoppingList(andrew, meals, fortnight)
  assert(list.second_trip.length > 0, 'a fortnight cycle produces a second-trip section')
  assert(find(list, 'cod or halibut', true)?.qty === 34 && !find(list, 'cod or halibut', false), 'blackened-cod is bought on the SECOND trip, not the main shop (L3)')
  assert(find(list, 'salmon', false)?.qty === 30 && !find(list, 'salmon', true), 'week-1 salmon is on the main shop')
  assert(!!find(list, 'chicken thigh, boneless skinless', false) && !find(list, 'chicken thigh, boneless skinless', true), 'week-2 thighs freeze — never on the second trip')
  assert(find(list, 'baby potatoes', true) && find(list, 'bell pepper', true), 'week-2 produce is on the second trip')
  assert(!list.sections.some((s) => s.section === SECOND_TRIP_SECTION) && list.items.filter((i) => i.second_trip).every((i) => list.second_trip.includes(i)),
    'the second trip is kept apart, not merged into the main sections')
  const weekly = buildShoppingList({ ...andrew, shop_cadence_days: 7 }, meals, { entries: W1.map((s) => entry(s, 1)) })
  assert(weekly.second_trip.length === 0, 'a weekly shop has no second trip')
  const strayWeek2 = validatePlan({ entries: [...W1.map((s) => entry(s, 1)), entry('blackened-cod', 2)] }, meals, { ...andrew, shop_cadence_days: 7 })
  assert(strayWeek2.some((w) => /week 2 on a weekly shop/.test(w)), 'a week-2 night on a weekly shop is reported, not folded into the main shop')
  assert(isSecondTrip({ item: 'x', qty_per_person: 1, unit: 'oz', store_section: 'Pantry', inferred: false }, byslug('blackened-cod'), entry('blackened-cod', 2), andrew) === false, 'pantry never goes on the second trip')
  // the fixture says so, in its own words
  assert(/SECOND TRIP/.test(byslug('blackened-cod').rotation_note) && /week 1/i.test(byslug('lemon-garlic-salmon').rotation_note), 'the fixture names cod as the second-trip meal and salmon as week 1')
}

// ── 5. versioning ───────────────────────────────────────────────────────────
{
  assert(nextVersion(null) === 1 && nextVersion(3) === 4, 'the next version is one more than the latest')
  const s1 = snapshot(andrew, fortnight)
  assert(changed(null, andrew, fortnight) && !changed(s1, andrew, fortnight), 'an unchanged household and plan do not need a new version')
  assert(changed(s1, { ...andrew, dietary_rules: { ...andrew.dietary_rules, fish_per_week: 2 } }, fortnight), 'a dietary rule change invalidates the list (L7)')
  assert(changed(s1, { ...andrew, prep_diversion_pct: 25 }, fortnight), 'a diversion change invalidates the list')
  assert(changed(s1, { ...andrew, inventory: [] }, fortnight), 'an inventory change invalidates the list')
  assert(changed(s1, andrew, { entries: fortnight.entries.slice(0, 7) }), 'a plan change invalidates the list')
  // what is on hand is counted against a next cycle only on say-so, and the snapshot says which way it was built (Codex r15)
  const uncounted = snapshot(andrew, fortnight, false)
  assert(uncounted.inventory.length === 0 && uncounted.inventory_counted === false && s1.inventory_counted === true && s1.inventory.length === 1,
    'a snapshot built without what is on hand records that, and carries no inventory')
  assert(!changed(uncounted, andrew, fortnight) && !changed(uncounted, { ...andrew, inventory: [] }, fortnight) && changed(s1, { ...andrew, inventory: [] }, fortnight),
    'a plan built without what is on hand is compared that way — an inventory change does not invalidate it, while it still invalidates a plan that counted it')
  assert(householdFor(andrew, true) === andrew && householdFor(andrew, false).inventory.length === 0 && householdFor(andrew, false).people_count === andrew.people_count, 'householdFor: as is, or with nothing on hand')
  // the ask defaults to the inventory's freshness (Codex r17): saved after the newest plan was built, it is fresh
  assert(!inventoryFresh(null, null, false) && !inventoryFresh('2026-09-14T10:00:00Z', null, false) && inventoryFresh(null, null, true), 'an unknown newest plan is never fresh — a failed lookup is not "never planned" (FOR-233, finding 3)')
  assert(inventoryFresh(null, null) && inventoryFresh('2026-09-14T10:00:00Z', '2026-09-14T09:00:00Z') && !inventoryFresh('2026-09-14T08:00:00Z', '2026-09-14T09:00:00Z') && !inventoryFresh(null, '2026-09-14T09:00:00Z') && !inventoryFresh('2026-09-14T10:00:00Z', '2026-09-14T11:00:00Z'),
    'what is on hand is fresh when saved after the NEWEST plan was built, or when nothing was ever planned — never when a plan is newer, or the save time is unknown')
  assert(buildShoppingList(householdFor(andrew, false), meals, fortnight).stocked.length === 0 && buildShoppingList(andrew, meals, fortnight).stocked.some((i) => i.item === 'rice'),
    'a next cycle built without say-so buys its rice — the live cycle is eating the bag')
  const v1 = buildShoppingList(andrew, meals, fortnight)
  // 4 lb of ribeye on hand: half counts (32 oz), which covers the 32 needed
  const v2 = buildShoppingList({ ...andrew, inventory: [...andrew.inventory, { item: 'ribeye', qty: 4, unit: 'lb' }] }, meals, fortnight)
  assert(find(v1, 'ribeye')?.qty === 32 && v2.stocked.some((i) => i.item === 'ribeye') && find(v1, 'ribeye')?.qty === 32,
    'regeneration re-solves the whole rotation and leaves version 1 as it was')
  // key order does not make a version: jsonb reorders keys on the way back
  const reordered = JSON.parse(JSON.stringify(s1, Object.keys(s1).sort().reverse()))
  const rules = Object.fromEntries(Object.entries(s1.dietary_rules).reverse())
  assert(!changed({ ...reordered, dietary_rules: rules, inventory: s1.inventory, entries: s1.entries, store_section_order: s1.store_section_order }, andrew, fortnight),
    'a snapshot read back with reordered keys compares equal — no phantom version')
}

// ── 5b. the live cycle (Codex r1: a fortnight plan vanished in its second week) ──
{
  const mon = '2026-09-14'
  const rows = [{ week_start: mon, version: 1, shop_cadence_days: 14 }, { week_start: mon, version: 2, shop_cadence_days: 14 }]
  assert(mondayOf(new Date(2026, 8, 17)) === mon && mondayOf(new Date(2026, 8, 14)) === mon && mondayOf(new Date(2026, 8, 20)) === mon, 'mondayOf keys a week to its Monday')
  assert(daysInto(mon, new Date(2026, 8, 23)) === 9, 'daysInto counts whole days from the start')
  assert(activeCycle(rows, new Date(2026, 8, 23))?.version === 2, 'on day 9 of a fortnight the plan is still live, and its highest version wins')
  assert(activeCycle(rows, new Date(2026, 8, 27))?.version === 2 && activeCycle(rows, new Date(2026, 8, 28)) === null, 'a fortnight cycle is live for fourteen days and gone on the fifteenth')
  assert(activeCycle(rows, new Date(2026, 8, 13))?.version === 2, 'a plan built on the Sunday before its Monday is live that Sunday')
  assert(activeCycle([{ week_start: mon, version: 1, shop_cadence_days: 7 }], new Date(2026, 8, 21)) === null, 'a weekly cycle is gone on day 7')
  assert(activeCycle([...rows, { week_start: '2026-09-28', version: 1, shop_cadence_days: 14 }], new Date(2026, 8, 29))?.week_start === '2026-09-28', 'the newest live start wins')
  assert(cycleKeyFor(rows[1], new Date(2026, 8, 23)) === mon && cycleKeyFor(null, new Date(2026, 8, 23)) === '2026-09-21', 'a regeneration stays in the live cycle; a fresh start keys on this Monday')
  // Sunday is planning day: a plan made on Sunday the 13th is for the week starting Monday the 14th (Codex r2)
  assert(cycleStartFor(new Date(2026, 8, 13)) === '2026-09-14' && cycleKeyFor(null, new Date(2026, 8, 13)) === '2026-09-14' && cycleStartFor(new Date(2026, 8, 12)) === '2026-09-07',
    'a cycle planned on Sunday starts on the coming Monday, not the one that just passed')
  assert(activeCycle([{ week_start: '2026-09-14', version: 1, shop_cadence_days: 14 }], new Date(2026, 8, 13))?.version === 1, 'that Sunday plan is live on the Sunday it was made')
  // a superseded version cannot resurrect: fortnight v1, regenerated weekly as v2, on day 9 (Codex r2)
  assert(activeCycle([{ week_start: mon, version: 1, shop_cadence_days: 14 }, { week_start: mon, version: 2, shop_cadence_days: 7 }], new Date(2026, 8, 23)) === null,
    'only the highest version of a start speaks — an older fortnight version does not come back after the weekly one expires')
  // the next cycle (Codex r3): on the final Sunday of a fortnight, planning means the cycle that starts tomorrow
  const fortnight14 = { week_start: mon, version: 2, shop_cadence_days: 14 }
  assert(nextCycleStart(fortnight14) === '2026-09-28' && nextCycleStart({ week_start: mon, version: 1, shop_cadence_days: 7 }) === '2026-09-21', 'the next cycle starts where the live one ends')
  assert(planningMode(fortnight14, new Date(2026, 8, 27)) === 'next' && planningMode(fortnight14, new Date(2026, 8, 26)) === 'regenerate' && planningMode(fortnight14, new Date(2026, 8, 15)) === 'regenerate' && planningMode(null, new Date(2026, 8, 27)) === 'next',
    'on a cycle\'s final day the default is the next cycle; before that, a rebuild')
  assert(activeCycle([fortnight14, { week_start: '2026-09-28', version: 1, shop_cadence_days: 14 }], new Date(2026, 8, 28))?.week_start === '2026-09-28', 'the next cycle is live on its Monday')
  // cadence shortened mid-cycle (Codex r4): a fortnight rebuilt as weekly on day 9 is a fresh cycle keyed on this week, not a version already expired
  assert(rebuildKey(fortnight14, 7, new Date(2026, 8, 23)) === '2026-09-21' && rebuildKey(fortnight14, 14, new Date(2026, 8, 23)) === mon && rebuildKey(fortnight14, 7, new Date(2026, 8, 16)) === mon,
    'a rebuild that shortens the cadence past today starts a fresh cycle; otherwise it stays in the live one')
  // planned ahead (Codex r4): a next-cycle plan built on Saturday is loadable before Sunday
  const ahead = [{ week_start: mon, version: 1, shop_cadence_days: 7 }, { week_start: '2026-09-21', version: 1, shop_cadence_days: 7 }, { week_start: '2026-09-21', version: 2, shop_cadence_days: 7 }]
  assert(upcomingCycle(ahead, new Date(2026, 8, 19))?.version === 2 && upcomingCycle(ahead, new Date(2026, 8, 19))?.week_start === '2026-09-21', 'the cycle planned ahead is found on Saturday, highest version')
  assert(upcomingCycle(ahead, new Date(2026, 8, 20)) === null && activeCycle(ahead, new Date(2026, 8, 20))?.week_start === '2026-09-21', 'on Sunday it is no longer upcoming — it is live')
  assert(upcomingCycle([ahead[0]], new Date(2026, 8, 19)) === null, 'nothing planned ahead, nothing upcoming')
  // the next-cycle target is checked against today at build time (Codex r9): a weekly plan from the 14th, opened
  // on its Sunday the 20th and built on the 28th, keys to the 28th — not the expired 21st; still live or ahead, kept
  const weekly14 = { week_start: '2026-09-14', version: 1, shop_cadence_days: 7 }
  assert(nextCycleKey(weekly14, null, 7, new Date(2026, 8, 20)) === '2026-09-21' && nextCycleKey(weekly14, null, 7, new Date(2026, 8, 22)) === '2026-09-21' && nextCycleKey(weekly14, null, 7, new Date(2026, 8, 28)) === '2026-09-28',
    'an expired next-cycle target advances to the cycle that covers today; one still live or still ahead is kept')
  assert(nextCycleKey(weekly14, '2026-09-21', 7, new Date(2026, 9, 5)) === '2026-10-05' && nextCycleKey(fortnight14, null, 14, new Date(2026, 8, 27)) === '2026-09-28',
    'the same guard covers a cycle planned ahead; a fortnight on its final Sunday still keys to the coming Monday')
  // the query is bounded by start, not by row count (Codex r5): eight weeks back covers a live fortnight being rebuilt, the four-week
  // steak window before each of its week boundaries, and the fortnight that may hold a night that far back (r10, r18)
  assert(historyFloor(new Date(2026, 8, 26)) === '2026-08-01' && daysInto(historyFloor(new Date(2026, 8, 28)), new Date(2026, 8, 28)) === 56, 'the history floor is eight weeks back — on the 26th of September it reaches the fortnight of the 17th of August')
  // the selected cycle survives a refresh at its newest version while it is still live or ahead (r18)
  const versions3 = [{ week_start: mon, version: 1 }, { week_start: mon, version: 3 }, { week_start: mon, version: 2 }, { week_start: '2026-09-21', version: 1 }]
  assert(newestVersion(versions3, mon)?.version === 3 && newestVersion(versions3, '2026-09-21')?.version === 1 && newestVersion(versions3, '2026-09-28') === null, 'the newest version of a start, or null')
  assert(!expired(fortnight14, new Date(2026, 8, 27)) && expired(fortnight14, new Date(2026, 8, 28)) && !expired({ week_start: '2026-09-28', version: 1, shop_cadence_days: 7 }, new Date(2026, 8, 20)), 'a cycle is expired past its span — not while live, not while ahead')
  assert(daysBetween('2026-09-21', '2026-09-28') === 7 && daysBetween('2026-09-21', '2026-09-14') === -7, 'days between two cycle keys, signed')
  const twentyVersions = Array.from({ length: 20 }, (_, i) => ({ week_start: '2026-09-28', version: i + 1, shop_cadence_days: 14 }))
  assert(activeCycle([...twentyVersions, fortnight14], new Date(2026, 8, 23))?.week_start === mon, 'twenty versions of a future cycle do not hide the live one')
  const st5 = readLF('src/lib/fuel/store.ts')
  assert(/\.gte\('week_start', historyFloor\(today\)\)/.test(st5) && !/\.limit\(20\)/.test(st5), 'loadActive bounds by start date, not by twenty rows')
  const st = readLF('src/lib/fuel/store.ts')
  const la = (st.match(/export async function loadActive[\s\S]*?\n\}/) || [])[0] || ''
  assert(/activeCycle</.test(la) && !/eq\('week_start'/.test(la) && /order\('week_start', \{ ascending: false \}\)/.test(la), 'the store loads the live cycle, not only the current calendar week')
}

// ── 6. the row is authoritative ─────────────────────────────────────────────
{
  const row = [
    { key: 'a', item: 'a', qty: 1, unit: 'oz', section: 'Produce', from: [], second_trip: false, inferred: false, stocked: false, checked: false },
    { key: 'b', item: 'b', qty: 1, unit: 'oz', section: 'Produce', from: [], second_trip: false, inferred: false, stocked: false, checked: true },
    { key: 'c', item: 'c', qty: 0, unit: 'oz', section: 'Pantry', from: [], second_trip: false, inferred: false, stocked: true, checked: false },
  ]
  let outbox = enqueue([], { key: 'a', checked: true, at: 1 })
  outbox = enqueue(outbox, { key: 'a', checked: false, at: 2 })
  assert(outbox.length === 1 && outbox[0].at === 2, 'a second tap on the same item replaces the first intent')
  const r = render(row, outbox)
  assert(r[0].shown === false && r[0].save === 'pending' && r[1].save === 'saved', 'a pending intent renders as PENDING on top of the row, and the untouched row renders as saved')
  assert(progress(row).done === 1 && progress(row).total === 2, 'progress counts the ROW — a pending tick does not count, a stocked item is not in the total')
  // the row answers, and disagrees: the row wins
  const rowSaysChecked = row.map((i) => (i.key === 'a' ? { ...i, checked: true } : i))
  const ack = acknowledge(rowSaysChecked, outbox, outbox[0])
  assert(ack.items === rowSaysChecked && ack.outbox.length === 0 && ack.items[0].checked === true, 'an acknowledgement replaces the render with the row and drops the intent, even when the row disagrees')
  // a fresh read while intents are pending
  const pending = enqueue(enqueue([], { key: 'a', checked: true, at: 3 }), { key: 'b', checked: false, at: 4 })
  const fresh = row.map((i) => (i.key === 'a' ? { ...i, checked: true } : i))
  const rec = reconcile(fresh, pending)
  assert(rec.items === fresh && rec.outbox.length === 1 && rec.outbox[0].key === 'b', 'a fresh read drops intents the row already satisfies and keeps the rest pending')
  const gone = reconcile(row.filter((i) => i.key !== 'b'), pending)
  assert(gone.outbox.every((i) => i.key !== 'b'), 'an intent for an item the row no longer has is dropped, not merged in')
  // a write in flight (Codex r3): check then uncheck 'a'; the check is in flight; a read from before it says unchecked
  const uncheckA = enqueue([], { key: 'a', checked: false, at: 9 })
  const stale = reconcile(row, uncheckA, new Set(['a']))
  assert(stale.outbox.length === 1 && stale.outbox[0].key === 'a', 'an intent whose item has a write in flight survives a read that predates the write')
  assert(reconcile(row, uncheckA).outbox.length === 0, 'with nothing in flight the same read settles the intent')
  // one outbox per tab (Codex r9): a stored outbox is a tab's own until it hides or falls silent; a mount adopts what is left behind
  assert(outboxKey('L', 't1') === 'dad-strength-fuel-outbox:L:t1' && outboxKey('L', 't1').startsWith(outboxPrefix('L')) && outboxKey('L', 't1') !== outboxKey('L', 't2'),
    'two tabs on the same list write different keys — neither can erase the other\'s pending ticks')
  const t1 = { tab: 't1', alive: 1_000_000, intents: [{ key: 'broccoli', checked: true, at: 5 }] }
  const t2 = { tab: 't2', alive: 0, intents: [{ key: 'rice', checked: true, at: 7 }, { key: 'broccoli', checked: true, at: 6 }] }
  const t3 = { tab: 't3', alive: 1_000_000 - ORPHAN_AFTER_MS - 1, intents: [{ key: 'broccoli', checked: false, at: 9 }, { key: 'lemon', checked: true, at: 2 }] }
  assert(orphans([t1, t2, t3], 'me', 1_000_000).map((s) => s.tab).join() === 't2,t3', 'a tab that hid or fell silent past the window is an orphan; one still stamping is not')
  assert(orphans([t1], 't1', 1_000_000 + ORPHAN_AFTER_MS * 2).length === 0, 'a tab never adopts its own outbox')
  const own = [{ key: 'rice', checked: false, at: 20 }]
  const merged = adopt(own, [...t2.intents, ...t3.intents])
  assert(merged.map((i) => `${i.key}:${i.checked}`).join() === 'rice:false,lemon:true,broccoli:false',
    'adopted intents queue behind this tab\'s own, oldest first, this tab\'s own winning its keys and the newest adopted winning a key two orphans held')
  assert(adopt(own, []) === own && adopt(own, own) === own, 'nothing to adopt, same outbox back')
  const cl9 = readLF('src/components/fuel/Checklist.tsx')
  assert(/parseStored\(localStorage\.getItem\(outboxKey\(listId, tabId\(\)\)\)\)\?\.intents \?\? \[\]/.test(cl9) && /JSON\.stringify\(\{ tab: tabId\(\), alive: rel \? 0 : Date\.now\(\), intents: outbox \} satisfies StoredOutbox\)/.test(cl9),
    'the checklist writes its own tab\'s key, stamped alive, and a mount adopts the outboxes tabs left behind')
  // round 10: the tab id is per document; a released outbox is never recreated; hidden means no heartbeat, no flush, no adoption; a release is taken at once
  assert(/function tabId\(\): string \{ return tab \?\? \(tab = Math\.random\(\)/.test(cl9) && !/sessionStorage\./.test(cl9),
    'the tab id is minted once per document — a remount keeps its outbox, a reload adopts the released one, a duplicated tab has its own')
  assert(/const rel = released\(leaving \|\| document\.visibilityState === 'hidden', outstanding\(inFlightFor\(listId\)\)\)/.test(cl9) && /if \(rel && localStorage\.getItem\(k\) === null\) return true/.test(cl9),
    'a released outbox is re-written only while still ours — never recreated after another tab took it')
  assert(/const stamp = \(\) => \{ if \(document\.visibilityState === 'visible' \|\| outstanding\(inFlight\.current\)\) writeOutbox\(listId, outboxRef\.current\) \}/.test(cl9), 'the heartbeat stops while hidden — but keeps stamping while a write is in flight')
  // round 12: outstanding writes are a count, not a set; a lapsing foreign claim is looked at again; undefined is not a difference
  {
    const c = new Map()
    hold(c, 'a'); hold(c, 'a'); drop(c, 'a')
    assert(c.has('a') && outstanding(c) === 1, 'two requests for one key: the first to land does not clear the second\'s protection — a count, not a set')
    drop(c, 'a')
    assert(!c.has('a') && outstanding(c) === 0, 'the second landing clears it')
    const live = { tab: 't1', alive: 1_000_000, intents: [] }, lapsed = { tab: 't3', alive: 1_000_000 - ORPHAN_AFTER_MS - 1, intents: [] }, let_go = { tab: 't2', alive: 0, intents: [] }
    assert(nextExpiry([live], 'me', 1_000_000) === ORPHAN_AFTER_MS && nextExpiry([live, lapsed], 'me', 1_000_000) === 0 && nextExpiry([let_go], 'me', 1_000_000) === null && nextExpiry([live], 't1', 1_000_000) === null,
      'the next look is scheduled for when the soonest foreign claim lapses — now for one already lapsed, never for a released one or this tab\'s own')
    assert(/const schedule = \(\) => \{/.test(cl9) && /nextExpiry\(foreignOutboxes\(listId\)\.map\(\(o\) => o\.stored\), tabId\(\), Date\.now\(\)\)/.test(cl9) && /if \(document\.visibilityState === 'visible'\) void wakeUp\(false\) \}, wait \+ 250\)/.test(cl9) && /if \(reread \|\| took\) setWake\(\(n\) => n \+ 1\)\n\s+schedule\(\)/.test(cl9) && /\n\s+schedule\(\)\n\s+void wakeUp\(false\)\n\s+const onVisibility/.test(cl9),
      'the checklist looks again when a foreign claim lapses — scheduled on mount and after every wake, taken only while visible')
    const items = buildShoppingList(andrew, meals, fortnight).items
    assert(items.some((i) => 'stocked_reason' in i && i.stocked_reason === undefined) && listUnchanged(items, JSON.parse(JSON.stringify(items))), 'a JSON round-trip — jsonb drops undefined — is not a different list')
  }
  // round 13: an acknowledged intent is retired even after unmount; a foreign claim that appears is looked at when it lapses
  assert(/if \(items && !mounted\.current\) retireStored\(listId, intent\)/.test(cl9) && /function retireStored\(listId: string, acked: TickIntent\)/.test(cl9) && /acknowledge\(\[\], stored\.intents, acked\)\.outbox/.test(cl9),
    'an acknowledged intent is retired from the persisted outbox even after unmount — never replayed over what another tab has since saved')
  assert(/if \(stored\?\.alive === 0\) void wakeUp\(false\); else schedule\(\)/.test(cl9), 'a foreign claim that appears or renews re-schedules the next look for when it lapses')
  // round 14: adoption is serialised across documents, and what is taken is claimed before the lock is let go
  assert(/function withAdoptionLock</.test(cl9) && /locks\.request\(`dad-strength-fuel-adopt:\$\{listId\}`, \(\) => fn\(\)\)/.test(cl9) && /return withAdoptionLock\(listId, \(\) => \{/.test(cl9),
    'adoption runs under a lock shared across documents — two visible tabs cannot both take one released outbox')
  assert(/if \(taken\.length\) writeOutbox\(listId, adopt\(own\(\), taken\)\)/.test(cl9), 'what is taken is persisted under this tab\'s key before the lock is let go')
  // round 11: the claim holds while a write is in flight; a refusal lets it go
  assert(released(true, 0) && !released(true, 1) && !released(false, 0) && !released(false, 2), 'a hidden tab\'s outbox is released — not while a write is in flight, never while visible')
  assert(/if \(!items\) \{ setFailed\(\(f\) => new Set\(f\)\.add\(intent\.key\)\); writeOutbox\(listId, outboxRef\.current\); break \}/.test(cl9), 'a refused write lets the claim go, so another tab can retry it')
  assert(/while \(outboxRef\.current\.length > 0 && navigator\.onLine && mounted\.current && document\.visibilityState !== 'hidden' && !pausedRef\.current\)/.test(cl9), 'a hidden tab does not flush — its intents are released for a visible tab')
  assert(/if \(document\.visibilityState === 'hidden'\) return \[\]/.test(cl9), 'a hidden tab adopts nothing')
  assert(/const onStorage = \(e: StorageEvent\)/.test(cl9) && /if \(stored\?\.alive === 0\) void wakeUp\(false\)/.test(cl9) && /if \(reread \|\| took\) setWake/.test(cl9),
    'a visible tab takes a released outbox the moment it is released, and re-reads the row only when it took something')
  assert(/if \(document\.visibilityState === 'hidden'\) writeOutbox\(listId, outboxRef\.current\); else void wakeUp\(true\)/.test(cl9) && /window\.addEventListener\('pagehide', hide\)/.test(cl9) && /const hide = \(\) => writeOutbox\(listId, outboxRef\.current, true\)/.test(cl9),
    'a tab that hides or closes lets its outbox go, so the next tab can take the ticks at once')
  assert(/if \(outboxRef\.current\.length && persisted\.current && !ownKeyPresent\(listId\)\) \{ outboxRef\.current = \[\]; setOutbox\(\[\]\) \}/.test(cl9) && /const taken = await adoptOrphans\(listId, \(\) => outboxRef\.current\)/.test(cl9) && /const next = adopt\(outboxRef\.current, taken\)/.test(cl9) && /\[online, listId, refetch, onRowItems, flush, wake, paused\]/.test(cl9),
    'a tab that wakes to find its outbox adopted drops those intents rather than sending them twice, adopts what others left, and re-reads the row')
  const cl6 = readLF('src/components/fuel/Checklist.tsx')
  assert(/hold\(inFlight\.current, intent\.key\)/.test(cl6) && /finally \{ drop\(inFlight\.current, intent\.key\) \}/.test(cl6) && /reconcile\(fresh, outboxRef\.current, new Set\(inFlight\.current\.keys\(\)\)\)/.test(cl6),
    'the checklist tracks in-flight writes and hands them to reconcile')
  const ticks = readLF('src/lib/fuel/ticks.ts')
  assert(/THE ROW IS AUTHORITATIVE/.test(ticks) && !/merge\(/.test(ticks), 'ticks.ts states the authority and has no merge')
  const cl = readLF('src/components/fuel/Checklist.tsx')
  assert(/useEffect\(\(\) => \{ persisted\.current = writeOutbox\(listId, outbox\) \}, \[listId, outbox\]\)/.test(cl) && /useState<TickIntent\[\]>\(\(\) => \(typeof window === 'undefined' \? \[\] : readOutbox\(listId\)\)\)/.test(cl),
    'the outbox persists across a reload — written on every change, read back on mount')
}

// ── 7. the seams ────────────────────────────────────────────────────────────
{
  const onDisk = readFileSync(MIGRATION, 'utf8').replace(/\r\n/g, '\n')
  assert(onDisk === renderMigration(), 'the migration is exactly what the fixture generates — no drift between seed and SQL')
  for (const t of ['fuel_meals', 'fuel_household', 'fuel_plans', 'fuel_lists']) {
    assert(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${t} \\(`).test(onDisk) && new RegExp(`ALTER TABLE public\\.${t} ENABLE ROW LEVEL SECURITY`).test(onDisk),
      `${t} is created WITH row level security in the same migration`)
  }
  assert(/FOR SELECT TO authenticated USING \(true\)/.test(onDisk) && !/ON public\.fuel_meals\s+FOR (ALL|INSERT|UPDATE|DELETE)/.test(onDisk), 'fuel_meals is read-only to users')
  for (const t of ['fuel_household', 'fuel_plans', 'fuel_lists']) {
    assert(new RegExp(`ON public\\.${t}\\s+FOR ALL TO authenticated USING \\(auth\\.uid\\(\\) = user_id\\) WITH CHECK \\(auth\\.uid\\(\\) = user_id\\)`).test(onDisk), `${t} is owner-only, USING and WITH CHECK`)
  }
  assert(/CREATE OR REPLACE FUNCTION public\.fuel_set_item_checked\(p_list_id uuid, p_key text, p_checked boolean\)/.test(onDisk) && /SECURITY INVOKER/.test(onDisk) && /WHERE id = p_list_id AND user_id = auth\.uid\(\)/.test(onDisk),
    'the one write path for checked is a SECURITY INVOKER function scoped to the owner')
  assert(/REVOKE EXECUTE ON FUNCTION public\.fuel_set_item_checked\(uuid, text, boolean\) FROM PUBLIC, anon/.test(onDisk), 'anon cannot call it')
  // Pro is enforced at the database (Codex r6): a SECURITY DEFINER trigger
  // function asks is_premium and refuses every insert or update otherwise,
  // on all three user tables — which the two functions write through.
  const gate = (onDisk.match(/CREATE OR REPLACE FUNCTION public\.enforce_fuel_pro\(\)[\s\S]*?\$\$;/) || [])[0] || ''
  assert(/SECURITY DEFINER/.test(gate) && /NOT public\.is_premium\(auth\.uid\(\)\)/.test(gate) && /ERRCODE = '42501'/.test(gate), 'enforce_fuel_pro is SECURITY DEFINER, asks is_premium, and refuses with 42501')
  assert(/REVOKE EXECUTE ON FUNCTION public\.enforce_fuel_pro\(\) FROM PUBLIC, anon, authenticated;/.test(onDisk), 'clients cannot call the gate function directly')
  for (const t of ['fuel_household', 'fuel_plans', 'fuel_lists']) {
    assert(new RegExp(`CREATE TRIGGER ${t}_pro_gate BEFORE INSERT OR UPDATE ON public\\.${t}\\s+FOR EACH ROW EXECUTE FUNCTION public\\.enforce_fuel_pro\\(\\);`).test(onDisk), `${t} refuses a free user's insert or update at the database`)
  }
  assert(onDisk.indexOf('CREATE TRIGGER fuel_plans_pro_gate') < onDisk.indexOf('CREATE OR REPLACE FUNCTION public.fuel_create_version'), 'the gate is in place before the version function that writes through it')
  // a new version is one transaction (Codex r1: an orphan plan held the number)
  const cv = (onDisk.match(/CREATE OR REPLACE FUNCTION public\.fuel_create_version[\s\S]*?\$\$;/) || [])[0] || ''
  assert(/SECURITY INVOKER/.test(cv) && /INSERT INTO public\.fuel_plans/.test(cv) && /INSERT INTO public\.fuel_lists/.test(cv) && /COALESCE\(MAX\(version\), 0\) \+ 1/.test(cv) && /auth\.uid\(\)/.test(cv),
    'fuel_create_version inserts plan and list in one transaction, picks the version inside the database, as the signed-in user')
  assert(/REVOKE EXECUTE ON FUNCTION public\.fuel_create_version\(date, jsonb, jsonb, jsonb\) FROM PUBLIC, anon/.test(onDisk), 'anon cannot create a version')
  assert(/db\.rpc\('fuel_create_version'/.test(readLF('src/lib/fuel/store.ts')) && !/from\('fuel_plans'\)\.insert/.test(readLF('src/lib/fuel/store.ts')), 'the store creates a version through the function, never two client inserts')
  // the checklist's callbacks are keyed on the list id, not the list object (Codex r1: a refetch loop)
  const pg = readLF('src/app/fuel/page.tsx')
  assert(/const listId = list\?\.id \?\? null/.test(pg) && /\}, \[supabase, listId, refresh\]\)/.test(pg) && /\), \[supabase, listId\]\)/.test(pg) && !/\[supabase, list\]\)/.test(pg), 'send and refetch depend on the list id — a row update cannot re-trigger reconciliation')
  // the builder (Codex r1): deselect is always allowed, saved entries are cut to the cycle, servings scale with the household
  const pb = readLF('src/components/fuel/PlanBuilder.tsx')
  assert(/disabled=\{!ok && !entry\}/.test(pb) && /if \(existing\) \{ setEntries\(entries\.filter/.test(pb), 'a selected meal that fell outside the cap can still be removed')
  assert(/\.filter\(\(e\) => e\.week <= weeks/.test(pb), 'a saved fortnight plan is cut to the cycle when the shop becomes weekly')
  // round 7: a retired meal is dropped from a saved plan and named — never held as a night that cannot be removed
  assert(/\.filter\(\(e\) => e\.week <= weeks && bySlug\.has\(e\.slug\)\)/.test(pb) && /no longer in the library/.test(pb) && /retired\.length > 0 &&/.test(pb),
    'a saved night whose meal left the library is dropped and named, so the builder is never blocked by a night that cannot be removed')
  const inf = readLF('src/components/fuel/IntakeForm.tsx')
  assert(/libraryUnits\(meals\)/.test(inf) && /\{units\.map\(\(u\) => <option/.test(inf) && !/const UNITS = \[/.test(inf), 'the inventory unit picker is built from the library, not a fixed list')
  assert(/<IntakeForm initial=\{household \?\? DEFAULT_HOUSEHOLD\} meals=\{meals\}/.test(pg), 'the page hands the library to the intake')
  assert(/export const maxServings = \(household: Pick<Household, 'people_count'>\) => Math\.max\(8, household\.people_count \* 3\)/.test(pb) && /Math\.min\(cap, entry\.servings \+ 1\)/.test(pb), 'cooked servings can reach three per person for the largest household intake allows')
  assert(/Math\.min\(defaultServings\(m, household\), cap\)/.test(pb) && /m && e\.servings < household\.people_count \? \{ \.\.\.e, servings: defaultServings\(m, household\) \} : e/.test(pb),
    'a new night defaults to what the household needs; a saved night is raised only if it no longer feeds everyone, otherwise kept as chosen (Codex r2, r3)')
  assert(/const startingNext = !!\(liveCycle && nextCycle\)/.test(pg) && /if \(!startingNext && plan && list && plan\.week_start === weekStart && !changed\(/.test(pg) && /planningMode\(/.test(pg),
    'the page can plan the NEXT cycle — keyed to where the live one ends (or the cycle already planned ahead), defaulting to it on the final day, never short-circuited by the unchanged-plan shortcut')
  assert(/rebuildKey\(liveCycle, household\.shop_cadence_days, now\)/.test(pg) && /const buildTarget = \(now: Date\): string =>/.test(pg), 'a rebuild keys through rebuildKey, so a shortened cadence cannot snapshot an expired cycle')
  // round 10: the builder is told the steak nights already planned in other cycles, for the target the build would land on
  assert(/cycles=\{\{ history: recent, targetStart: buildTarget\(new Date\(\)\), cadenceDays: household\.shop_cadence_days \}\}/.test(pg) && /setRecent\(active\.recent\)/.test(pg) && /setRecent\(\(r\) => \[\.\.\.r, built\]\)/.test(pg),
    'the builder is told the steak nights already planned in other cycles — loaded with the page, and kept current after a build')
  assert(/validatePlan\(\{ entries \}, meals, household, \{ cycles \}\)/.test(pb), 'the builder judges the monthly steak rule across cycles')
  // round 14: validated again at build time, against the target the build lands on
  assert(/const late = validatePlan\(p, meals, household, \{ cycles: \{ history: recent, targetStart: weekStart, cadenceDays: household\.shop_cadence_days \} \}\)/.test(pg) && /if \(late\.length\) \{ setError\(late\.join\(' · '\)\); return \}/.test(pg)
    && pg.indexOf('const weekStart = buildTarget(new Date())') < pg.indexOf('const late = validatePlan(') && pg.indexOf('const late = validatePlan(') < pg.indexOf('plan.week_start === weekStart && !changed('),
    'the plan is validated again at build time against the target the build lands on — before the shortcut, before any write')
  const st10 = readLF('src/lib/fuel/store.ts')
  assert(/recent: PlanRow\[\]/.test(st10) && /const recent = rows as PlanRow\[\]/.test(st10), 'loadActive hands back every recent cycle, all versions')
  // round 9: the next-cycle target is checked against today, and a cycle planned ahead that the build passed is let go
  assert(/nextCycleKey\(liveCycle, upcoming\?\.week_start \?\? null, household\.shop_cadence_days, now\)/.test(pg) && /if \(upcoming && \(upcoming\.week_start === weekStart \|\| weekStart > upcoming\.week_start\)\) setUpcoming\(null\)/.test(pg), 'a next-cycle build keys through nextCycleKey — checked against today — and drops an upcoming cycle it has passed')
  // round 11: the shortcut stands only when a fresh solve comes out identical — the library can have been corrected
  assert(/&& listUnchanged\(buildShoppingList\(householdFor\(household, inventoryCounted\), meals, p\)\.items, list\.items\)\) \{ setStep\('list'\); return \}/.test(pg), 'the unchanged-plan shortcut re-solves before it stands — the way the stored plan was built — so a library correction is never skipped')
  // round 15: what is on hand counts against a next cycle only on say-so, recorded in the snapshot
  assert(/const inventoryCounted = askNow \? opts\.countInventory : true/.test(pg) && /createVersion\(supabase, weekStart, household, meals, p, inventoryCounted\)/.test(pg) && /askInventory=\{askInventory\}/.test(pg),
    'a next cycle counts what is on hand only on say-so; a rebuild always; the say-so goes into the version')
  assert(/onBuild\(\{ entries \}, \{ countInventory: askInventory \? countInventory : true \}\)/.test(pb) && /count what\\'s on hand again/.test(pb) && /askInventory && household\.inventory\.length > 0 &&/.test(pb),
    'the builder asks, for a next cycle with something on hand, whether to count it again — off by default')
  // round 16: the saved choice stands on a rebuild unless changed, and a changed choice is never short-cut
  // round 17: the ask is shown for anything but a rebuild of a plan that already counted it — a fresh start after an expired cycle asks too — and defaults to freshness
  assert(/const rebuildOfCounted = \(start: string\) => !!plan && !startingNextNow && start === plan\.week_start && \(plan\.rules_snapshot\?\.inventory_counted \?\? true\)/.test(pg) && /const askInventory = \(household\?\.inventory\.length \?\? 0\) > 0 && !rebuildOfCounted\(buildTarget\(new Date\(\)\)\)/.test(pg),
    'a rebuild of a plan built without counting what is on hand asks again — the saved choice stands unless changed — and a fresh start asks too')
  // round 18: the ask is judged on the start the build would land on, and judged again at build time
  assert(/const askNow = household\.inventory\.length > 0 && !rebuildOfCounted\(weekStart\)/.test(pg) && /if \(askNow !== askInventory\) \{ setError\(/.test(pg) && /const inventoryCounted = askNow \? opts\.countInventory : true/.test(pg),
    'the ask is based on the target the build would land on — a shortened fortnight is a new start — and rechecked at build time')
  assert(/countByDefault=\{inventoryFresh\(householdSavedAt, newestPlanAt, newestPlanKnown\)\}/.test(pg) && /setHousehold\(h\.household\); setHouseholdSavedAt\(h\.updatedAt\)/.test(pg) && /setHousehold\(h\); setHouseholdSavedAt\(new Date\(\)\.toISOString\(\)\)/.test(pg) && /useState\(countByDefault\)/.test(pb),
    'the ask defaults to whether what is on hand was saved after the newest plan was built')
  const st18 = readLF('src/lib/fuel/store.ts')
  assert(/select\('created_at'\)\.eq\('user_id', userId\)\.order\('created_at', \{ ascending: false \}\)\.limit\(1\)\.maybeSingle\(\)/.test(st18) && /newestPlanAt: string \| null/.test(st18) && (pg.match(/setNewestPlanAt\(active\.newestPlanAt\)/g) || []).length === 2 && /setNewestPlanAt\(built\.created_at \?\? new Date\(\)\.toISOString\(\)\)/.test(pg),
    'the newest plan is looked up on its own, unbounded — a long break does not read as never planned')
  // round 18: a refresh keeps the selected cycle while it is still live or ahead, and yields to a write that completed meanwhile
  assert(/const kept = start \? newestVersion\(active\.recent, start\) : null/.test(pg) && /const nextPlan = kept && !expired\(asCycle\(kept\), now\) \? kept : active\.plan/.test(pg) && /await loadListFor\(supabase, nextPlan\.id\)/.test(pg),
    'a refresh keeps the cycle the athlete selected, at its newest version, while it is still live or ahead')
  assert(/genRef\.current \+= 1\n\s+const gen = genRef\.current\n/.test(pg) && (pg.match(/if \(gen !== genRef\.current\) return/g) || []).length === 3 && /const built = res\.plan\n\s+moved\(built\)\n/.test(pg) && /moved\(\)\n\s+setHousehold\(h\); setHouseholdSavedAt/.test(pg) && !/writesRef/.test(pg),
    'a refresh that started before a save or a build completed applies nothing — the generation moved as the write applied (the writes epoch, subsumed)')
  const inf18 = readLF('src/components/fuel/IntakeForm.tsx')
  assert(/if \(incomingKey !== seenKey\) \{\n\s+setSeenKey\(incomingKey\)\n\s+if \(!dirty \|\| incomingKey === JSON\.stringify\(h\)\) \{ setH\(initial\); setDirty\(false\); setConflict\(false\) \} else setConflict\(true\)/.test(inf18) && /disabled=\{saving \|\| conflict\}/.test(inf18) && /reload what was saved/.test(inf18) && /setH\(\{ \.\.\.h, \.\.\.patch \}\); setDirty\(true\)/.test(inf18),
    'an untouched intake draft follows a household changed elsewhere; a touched one shows the conflict and cannot save over it until reloaded')
  const st17 = readLF('src/lib/fuel/store.ts')
  assert(/updated_at: new Date\(\)\.toISOString\(\),/.test(st17) && /updatedAt: typeof data\.updated_at === 'string' \? data\.updated_at : null/.test(st17) && /select\('id, week_start, version, meal_ids, rules_snapshot, created_at'\)/.test(st17) && /created_at: row\.updated_at \}/.test(st17),
    'the household save is stamped, and both stamps are read back, so freshness can be judged')
  // round 17: the page re-reads the household and the plan on waking and on reconnect, and the checklist is paused until it has
  assert(/const refresh = useCallback\(async \(\) => \{/.test(pg) && /if \(document\.visibilityState === 'visible'\) void refresh\(\)/.test(pg) && /window\.addEventListener\('online', onOnline\)/.test(pg) && /if \(e\.persisted\) void refresh\(\)/.test(pg)
    && /setStep\(\(s\) => \(s === 'list' && \(!nextList \|\| persistedStale\) \? 'plan' : s\)\)/.test(pg) && /paused=\{refreshing \|\| refreshFailed\}/.test(pg) && /if \(!userId \|\| busyRef\.current\) return/.test(pg),
    'the page re-reads the household and the plan when it wakes or reconnects — never mid-build — leaves a superseded list, and pauses the checklist meanwhile')
  const cl17 = readLF('src/components/fuel/Checklist.tsx')
  assert(/const pausedRef = useRef\(paused\)/.test(cl17) && /&& !pausedRef\.current\) \{/.test(cl17) && /\[online, listId, refetch, onRowItems, flush, wake, paused\]/.test(cl17),
    'a paused checklist sends nothing, and flushes when the pause lifts')
  assert(/!changed\(plan\.rules_snapshot, household, p\) && \(plan\.rules_snapshot\?\.inventory_counted \?\? true\) === inventoryCounted && listUnchanged\(/.test(pg) && /listUnchanged\(buildShoppingList\(householdFor\(household, inventoryCounted\), meals, p\)\.items, list\.items\)\) \{ setStep\('list'\); return \}/.test(pg),
    'a changed inventory choice is never short-cut to the stored list')
  const st15 = readLF('src/lib/fuel/store.ts')
  assert(/buildShoppingList\(householdFor\(household, inventoryCounted\), meals, plan\)/.test(st15) && (st15.match(/snapshot\(household, plan, inventoryCounted\)/g) || []).length === 2, 'the version is solved and snapshotted the way it was asked for')
  {
    const items = buildShoppingList(andrew, meals, fortnight).items
    const ticked = items.map((i) => ({ ...i, checked: true }))
    const shuffled = ticked.map((i) => Object.fromEntries(Object.entries(i).reverse()))
    const corrected = items.map((i, n) => (n === 0 ? { ...i, qty: i.qty + 1 } : i))
    assert(listUnchanged(items, ticked) && listUnchanged(items, shuffled) && !listUnchanged(items, corrected) && !listUnchanged(items, items.slice(1)),
      'the same list, ticks and key order aside; a corrected quantity or a missing line is a different list')
  }
  // round 8: the key is decided before the shortcut, and the list is reused only while the plan's start is still the start a rebuild would get
  assert(pg.indexOf('const weekStart = buildTarget(new Date())') < pg.indexOf('plan.week_start === weekStart && !changed(') && pg.indexOf('const weekStart = buildTarget(new Date())') > 0,
    'the unchanged-plan shortcut cannot hand back an expired cycle\'s list — it runs after the target key is known and only while the plan\'s start is still the start a rebuild would get')
  assert(/const setServings = \(slug: string, servings: number\) => setEntries\(entries\.map\(\(e\) => \(e\.slug === slug && e\.week === week \? \{ \.\.\.e, servings \} : e\)\)\)/.test(pb) && /setServings\(m\.slug, Math\.max\(1, entry\.servings - 1\)\)/.test(pb) && /nights, each/.test(pb) && /servings: existing \? existing\.servings : Math\.min\(defaultServings\(m, household\), cap\)/.test(pb),
    'every night of a repeated recipe shares the one servings figure the card shows — the control moves them together and another night copies it')
  assert(/setUpcoming\(active\.upcoming\)/.test(pg) && /const openUpcoming = async/.test(pg) && /loadListFor\(supabase, upcoming\.id\)/.test(pg) && /open it/.test(pg), 'a cycle planned ahead is loaded and can be opened')
  const st4 = readLF('src/lib/fuel/store.ts')
  assert(/const upcoming = upcomingCycle</.test(st4) && /const plan = activeCycle<PlanRow & CycleRow>\(candidates, today\)\n/.test(st4) && !/\?\? upcoming/.test(st4) && /return \{ plan: null, list: null, upcoming, recent, newestPlanAt, newestPlanKnown, error: newestError \}/.test(st4),
    'the store surfaces the upcoming cycle, and it never stands in for a live one — with nothing live, the current week can be planned')
  const cl4 = readLF('src/components/fuel/Checklist.tsx')
  assert(/const inFlightByList = new Map<string, Map<string, number>>\(\)/.test(cl4) && /useRef<Map<string, number>>\(inFlightFor\(listId\)\)/.test(cl4), 'in-flight keys are shared across remounts of the same list')
  assert(/const mounted = useRef\(true\)/.test(cl4) && /if \(!mounted\.current\) break/.test(cl4) && /navigator\.onLine && mounted\.current && /.test(cl4), 'an unmounted checklist publishes nothing')
  assert(/const failedIntent = failed\.has\(item\.key\) \? pendingFor\(outboxRef\.current, item\.key\) : undefined/.test(cl4) && /checked: failedIntent \? failedIntent\.checked : !shown/.test(cl4),
    'tapping a failed row retries the intent as asked, never flips it')
  // round 5: the checklist is keyed by list; writes are serialised per list across mounts
  assert(/<Checklist key=\{listId\} listId=\{listId\}/.test(pg), 'the checklist remounts when the list changes — no outbox or ref ever straddles two lists')
  assert(/const sendQueues = new Map<string, Promise<unknown>>\(\)/.test(cl4) && /function sendQueued</.test(cl4) && /await sendQueued\(listId, \(\) => send\(intent\.key, intent\.checked\)\)/.test(cl4) && !/items = await send\(intent\.key/.test(cl4),
    'every write goes through the list\'s shared queue, so a remounted instance waits for the outstanding request')
  // round 6: the reconcile read is serialised with the writes; a recipe can fill more than one night
  assert(/const fresh = await sendQueued\(listId, refetch\)/.test(cl4) && !/const fresh = await refetch\(\)/.test(cl4),
    'the reconciliation read goes through the same per-list queue as the writes — it cannot overlap one from any instance')
  assert(/const nightsOf = \(slug: string\) => entries\.filter/.test(pb) && /aria-label=\{`another night of \$\{m\.name\}`\}[^>]*onClick=\{\(\) => add\(m\)\}/.test(pb) && /− night/.test(pb) && /const removeOne = /.test(pb),
    'a recipe can fill more than one night, and a night can be taken back')
  const twice = buildShoppingList({ ...andrew, prep_diversion_pct: 0 }, meals, { entries: [entry('chili-lime-thighs', 1), entry('chili-lime-thighs', 1)] })
  assert(find(twice, 'chicken thigh, boneless skinless')?.qty === 48 && validatePlan({ entries: [entry('chili-lime-thighs', 1), entry('chili-lime-thighs', 1)] }, meals, andrew).length === 0,
    'two nights of the same recipe double its ingredients and break no rule')
  // round 2: stale reads, cross-list answers, stale lists, version allocation
  const cl7 = readLF('src/components/fuel/Checklist.tsx')
  assert(/const seen = writes\.current/.test(cl7) && /if \(fresh && writes\.current === seen\)/.test(cl7) && /writes\.current \+= 1/.test(cl7),
    'a reconciliation read that overlapped an acknowledgement is discarded, not applied over it')
  assert(/onRowItems\(listId, next\.items\)/.test(cl7) && /onRowItems\(listId, r\.items\)/.test(cl7), 'every answer names the list it belongs to')
  assert(/setList\(\(l\) => \(l && l\.id === forListId \? \{ \.\.\.l, items \} : l\)\)/.test(pg), 'the page rejects an answer for a list that is no longer current')
  assert(/const stale = !!\(plan && household && changed\(plan\.rules_snapshot, household, \{ entries: plan\.meal_ids \}\)\)/.test(pg) && /stale && \(/.test(pg) && /!stale && \(/.test(pg) && /persistedStale/.test(pg),
    'a list whose household has changed is stale — on load as on save — and is rebuilt, not ticked from')
  assert(/PERFORM pg_advisory_xact_lock\(hashtext\(auth\.uid\(\)::text \|\| ':' \|\| p_week_start::text\)\);/.test(onDisk) && onDisk.indexOf('pg_advisory_xact_lock') < onDisk.indexOf('COALESCE(MAX(version), 0) + 1'),
    'version allocation takes a per-user, per-cycle lock before reading MAX')
  assert((onDisk.match(/^  \('/gm) || []).length === meals.length && meals.length === 8, `the seed carries the fortnight rotation — ${meals.length} meals`)
  assert(/"inferred":true/.test(onDisk) && /"inferred":false/.test(onDisk), 'the seed keeps the inferred flag on every ingredient')
  const solve = readLF('src/lib/fuel/solve.ts')
  assert(!/import .* from ['"](\.\.\/)*utils\/supabase|@supabase|openai|anthropic|fetch\(/.test(solve + readLF('src/lib/fuel/version.ts') + readLF('src/lib/fuel/ticks.ts')), 'the solver has no I/O and no AI')
  assert(!/Date\.now|new Date\(|Math\.random/.test(solve), 'the solver has no clock and no randomness')
  const nav = readLF('src/components/BottomNav.tsx')
  assert(/\{ id: 'fuel', label: 'fuel', path: '\/fuel', icon: Utensils \}/.test(nav) && (nav.match(/\{ id: '/g) || []).length === 4, 'Fuel is the fourth BottomNav config entry')
  const page = readLF('src/app/fuel/page.tsx')
  assert(/<PremiumGate feature=/.test(page) && page.indexOf('<PremiumGate') < page.indexOf('<IntakeForm'), 'the Fuel page sits behind PremiumGate')
  const mw = readLF('middleware.ts')
  const protectedList = (mw.match(/const protectedPaths = \[([\s\S]*?)\]/) || [])[1] || ''
  assert(/'\/fuel'/.test(protectedList), '/fuel is a protected path in the middleware — signed-out visitors are redirected server-side, not by the page alone')
  const modal = readLF('src/components/UpgradeModal.tsx')
  assert(/^\s*'Meal planner \+ shopping list — Fuel, built from what is on hand',/m.test(modal) && !/held out until FOR-177 ships/.test(modal), 'PRO_FEATURES carries the meal-planner line now that Fuel ships — the modal promises what the app has')
  const checklist = readLF('src/components/fuel/Checklist.tsx')
  assert(/\{i\.inferred && <span[^>]*>est\.<\/span>\}/.test(checklist), 'an inferred quantity is shown as an estimate on its own line, never as fact')
  assert(/save === 'pending'/.test(checklist) && /save === 'failed'/.test(checklist) && /queued/.test(checklist), 'every tick shows whether it saved: pending, queued offline, or failed')
  assert(/'online'/.test(checklist) && /'offline'/.test(checklist), 'the checklist listens for the network coming back')
  assert(!existsSync(join(ROOT, 'src/components/FuelStation.tsx')), 'FuelStation.tsx is not resurrected')
  const w = validatePlan({ entries: [...W1.map((s) => entry(s, 1)), entry('blackened-cod', 1)] }, meals, andrew)
  assert(w.some((x) => /fish nights/.test(x)) && w.some((x) => /5 nights planned/.test(x)), 'the frequency and night-count rules are reported, not silently fixed')
}

// ── 9. the cycle model (FOR-233): one cycle at a time, and the write-side guard ──
// The page states its model in one sentence; the three round-19 findings are
// closed under it — a failed refresh keeps the checklist paused and shows a
// retry; the live cycle is held apart from the selection and is always one
// tap away; an unknown newest plan is never fresh — and the database refuses
// a tick on a superseded list, which the page answers by re-reading.
{
  const pg9 = readLF('src/app/fuel/page.tsx')
  assert(/THE CYCLE MODEL \(FOR-233\): the page shows ONE cycle at a time/.test(pg9) && /a refresh that fails is shown and keeps the\n\/\/ checklist paused until a retry succeeds/.test(pg9) && /the database refuses a tick on\n\/\/ a superseded list/.test(pg9),
    'the page states its cycle model in one sentence: one cycle at a time, a refresh that never changes the selection unless it expired, a failed refresh shown and pausing, the database refusing a superseded tick')
  assert(/The transition: a page loaded before this change/.test(pg9), 'the transition is stated — what a page open across the change sees')
  // finding 1
  assert(/if \(h\.error \|\| active\.error\) \{ setRefreshFailed\(true\); return \}/.test(pg9) && pg9.indexOf('if (gen !== genRef.current) return') < pg9.indexOf('if (h.error || active.error) { setRefreshFailed(true); return }'),
    'a failed re-read is a state of its own, and anything that moved meanwhile — a write, a navigation, a newer refresh — is not a failure — it is judged first')
  assert(/paused=\{refreshing \|\| refreshFailed\}/.test(pg9) && /onClick=\{\(\) => void refresh\(\)\}>retry</.test(pg9) && /ticks are held until it succeeds/.test(pg9) && /setRefreshFailed\(false\)/.test(pg9),
    'a failed refresh is shown with a retry and keeps the checklist paused; a refresh that lands clears it')
  // finding 2
  assert(/const \[live, setLive\] = useState<PlanRow \| null>\(null\)/.test(pg9) && (pg9.match(/setLive\(active\.plan\)/g) || []).length === 2 && /setLive\(activeCycle\(\[\.\.\.recent, built\]\.map\(\(r\) => \(\{ \.\.\.r, \.\.\.asCycle\(r\) \}\)\), new Date\(\)\)\)/.test(pg9) && !/setLive\(built\)/.test(pg9),
    'the live cycle is held apart from the selection — set on load, on every refresh, and after a build BY DATE from the updated history, never as whatever was just built')
  assert(/const openLive = async/.test(pg9) && /live && plan && plan\.id !== live\.id && \(/.test(pg9) && /onClick=\{\(\) => void openLive\(\)\}>back to this week</.test(pg9) && /setUpcoming\(upcomingCycle\(recent\.map\(\(r\) => \(\{ \.\.\.r, \.\.\.asCycle\(r\) \}\)\), new Date\(\)\)\)/.test(pg9),
    'from any selection ahead of it, this week is one tap away, and the cycle just left is offered ahead again')
  // finding 3
  const st9 = readLF('src/lib/fuel/store.ts')
  assert(/const \{ data: newest, error: newestError \} = await db\.from\('fuel_plans'\)\.select\('created_at'\)/.test(st9) && /const newestPlanKnown = !newestError/.test(st9) && (st9.match(/newestPlanKnown,/g) || []).length === 3 && /error: lerr \?\? newestError/.test(st9),
    'the newest-plan lookup reports whether it succeeded, and its error is surfaced, not swallowed')
  assert(/setNewestPlanKnown\(active\.newestPlanKnown\)/.test(pg9) && (pg9.match(/setNewestPlanKnown\(active\.newestPlanKnown\)/g) || []).length === 2 && /setNewestPlanKnown\(true\)/.test(pg9), 'the page carries whether the newest plan is known — on load, on refresh, and after its own build')
  // the write-side guard
  const guard = readLF('supabase/migrations/20260916_fuel_tick_superseded_guard.sql')
  assert(/CREATE OR REPLACE FUNCTION public\.fuel_set_item_checked\(p_list_id uuid, p_key text, p_checked boolean\)/.test(guard) && /SECURITY INVOKER/.test(guard) && /REVOKE EXECUTE ON FUNCTION public\.fuel_set_item_checked\(uuid, text, boolean\) FROM PUBLIC, anon/.test(guard),
    'the guard replaces the tick function with the same signature, invoker security and revoke')
  assert(/ON newer\.user_id = p\.user_id AND newer\.week_start = p\.week_start AND newer\.version > p\.version\n/.test(guard) && /USING ERRCODE = 'FU001'/.test(guard) && /WHERE id = p_list_id AND user_id = auth\.uid\(\)/.test(guard),
    'a list whose cycle has a newer version refuses the tick with FU001, and the owner test stays')
  assert(guard.lastIndexOf("ERRCODE = 'FU001'") < guard.indexOf('UPDATE public.fuel_lists'), 'the refusal comes before the write — nothing is written to a superseded list')
  const names9 = readdirSync(join(ROOT, 'supabase/migrations')).sort()
  assert(names9.indexOf('20260916_fuel_tick_superseded_guard.sql') > names9.indexOf('20260915_fuel_macro_columns.sql'), 'the guard migration sorts after everything it replaces')
  assert(/export const SUPERSEDED = 'FU001'/.test(st9) && /superseded: error\?\.code === SUPERSEDED/.test(st9), 'the store names the refusal')
  assert(/if \(superseded && listIdRef\.current === listId\) void refresh\(\)/.test(pg9) && /\}, \[supabase, listId, refresh\]\)/.test(pg9), 'the page answers a refused tick by re-reading — and moves to the newer list — only while that list is still the one selected; a refusal from a list no longer selected steers nothing')
  assert(/const gen = genRef\.current\n\s+const start = selectedStartRef\.current\n\s+setRefreshing\(true\)/.test(pg9) && /const kept = start \? newestVersion\(active\.recent, start\) : null/.test(pg9) && /selectedStartRef\.current = plan\?\.week_start \?\? null/.test(pg9) && /\}, \[supabase, userId\]\)/.test(pg9),
    'a refresh reads the selection through a ref as it starts, under its generation — never as captured when the refresh was made, and never applied once a navigation has moved it')
  assert(/PERFORM pg_advisory_xact_lock\(hashtext\(auth\.uid\(\)::text \|\| ':' \|\| v_week_start::text\)\)/.test(guard) && guard.indexOf('PERFORM pg_advisory_xact_lock') < guard.indexOf('IF EXISTS (') && guard.indexOf('IF EXISTS (') < guard.indexOf('UPDATE public.fuel_lists'),
    'the guard takes the same per-cycle lock fuel_create_version takes, before its check, and holds it through the write')
  // Codex round 2: the refresh is serialised — against itself and against navigation — by one generation
  assert(/const genRef = useRef\(0\)/.test(pg9) && /genRef\.current \+= 1\n\s+const gen = genRef\.current\n\s+const start = selectedStartRef\.current/.test(pg9) && (pg9.match(/if \(gen !== genRef\.current\) return/g) || []).length === 3
    && pg9.indexOf('if (gen !== genRef.current) return') < pg9.indexOf('if (h.error || active.error) { setRefreshFailed(true); return }')
    && /await loadListFor\(supabase, nextPlan\.id\)\) : null\n\s+if \(gen !== genRef\.current\) return\n\s+setHousehold\(h\.household\)/.test(pg9)
    && /const vs = await loadVersions\(supabase, userId, nextPlan\.week_start\)\n\s+if \(gen !== genRef\.current\) return\n\s+setVersions\(vs\.map\(\(v\) => v\.version\)\)/.test(pg9),
    'the refresh takes a generation as it starts and, after every await, applies nothing if it has moved — not its data, not its failure state; only the newest refresh speaks')
  assert(/\} finally \{ if \(gen === genRef\.current\) setRefreshing\(false\) \}/.test(pg9),
    'a refresh whose generation moved does not lift the pause — the newest refresh, or the navigation that voided it, owns that')
  assert(/const moved = \(selected\?: PlanRow \| null\) => \{\n\s+genRef\.current \+= 1\n\s+if \(selected !== undefined\) selectedStartRef\.current = selected\?\.week_start \?\? null\n\s+setRefreshing\(false\)\n\s+\}/.test(pg9)
    && /await loadListFor\(supabase, live\.id\)\n\s+moved\(live\)\n\s+setPlan\(live\)/.test(pg9) && /await loadListFor\(supabase, upcoming\.id\)\n\s+moved\(upcoming\)\n\s+setPlan\(upcoming\)/.test(pg9) && /moved\(built\)\n\s+setPlan\(built\)/.test(pg9) && /moved\(\)\n\s+setHousehold\(h\)/.test(pg9),
    'every navigation, build and save moves the generation AS IT APPLIES — a refresh in flight applies nothing after it, its pause is lifted, and the selection landed on is what the next refresh reads')
}

// ── 8. macro columns (FOR-234 §4) — schema only ─────────────────────────────
// carbs, fat and calories per person alongside protein, so the library can
// grow against its final shape. Nothing reads them; nothing estimates them.
{
  const MACROS = ['carbs_g_per_person', 'fat_g_per_person', 'calories_per_person']
  const mig = readLF('supabase/migrations/20260915_fuel_macro_columns.sql')
  assert(/ALTER TABLE public\.fuel_meals\n/.test(mig), 'the macro migration alters fuel_meals')
  for (const c of MACROS) {
    assert(new RegExp(`ADD COLUMN IF NOT EXISTS ${c}\\s+int CHECK \\(${c} IS NULL OR ${c} >= 0\\)`).test(mig), `${c}: an int column like protein, nullable, never negative, idempotent`)
    assert(new RegExp(`COMMENT ON COLUMN public\\.fuel_meals\\.${c}\\s+IS '[^']*never estimated`).test(mig), `${c} says on the column that it is never estimated`)
  }
  assert(!/NOT NULL/.test(mig) && !/\bUPDATE\b|\bINSERT\b/.test(mig), 'the migration populates nothing and forces nothing — NULL until sourced')
  const names = readdirSync(join(ROOT, 'supabase/migrations')).sort()
  assert(names.indexOf('20260915_fuel_macro_columns.sql') > names.indexOf('20260914_fuel_phase_1.sql'), 'the macro migration sorts after phase 1, which creates the table it alters')
  for (const m of meals) for (const c of MACROS) assert(c in m && m[c] === null, `${m.slug}.${c} is present and null — supplied or computed later, never estimated`)
  assert(/never estimated/.test(seed._provenance.macros ?? ''), 'the provenance says the macros are null and never estimated')
  const gen = readLF('scripts/fuel-seed-sql.mjs')
  assert(/const MACROS = \['carbs_g_per_person', 'fat_g_per_person', 'calories_per_person'\]/.test(gen) && /if \(m\[k\] != null\) throw new Error/.test(gen) && /if \(!\(k in m\)\) throw new Error/.test(gen),
    'the generator refuses a fixture with macro values the phase-1 seed would drop, and one without the keys')
  const readers = ['src/lib/fuel/solve.ts', 'src/lib/fuel/store.ts', 'src/lib/fuel/types.ts', 'src/lib/fuel/version.ts', 'src/lib/fuel/cycle.ts', 'src/lib/fuel/ticks.ts', 'src/components/fuel/Checklist.tsx', 'src/components/fuel/PlanBuilder.tsx', 'src/components/fuel/IntakeForm.tsx', 'src/app/fuel/page.tsx']
  for (const f of readers) assert(!/carbs_g_per_person|fat_g_per_person|calories_per_person/.test(readLF(f)), `${f} does not read the macro columns — schema only`)
}

if (failures) { console.log(`\nfuel-solve: ${failures} of ${failures + passes} checks FAILED`); process.exit(1) }
console.log(`fuel-solve: ${passes} checks passed — rows in, list out, the row owns the ticks`)
