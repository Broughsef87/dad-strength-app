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
//      entry exists, the page is behind PremiumGate, PRO_FEATURES still holds
//      the meal-planner line out
// Every assertion verified by reintroducing the bug it catches and confirming
// it fires, then restoring the tree byte-identical.
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { buildShoppingList, purchaseMultiplier, usableInventoryFraction, isSecondTrip, validatePlan, proteinScale, steakNightsPerCycle, steakNightsElsewhere, defaultServings, libraryUnits, SECOND_TRIP_SECTION } from '../../src/lib/fuel/solve.ts'
import { changed, listUnchanged, nextVersion, snapshot } from '../../src/lib/fuel/version.ts'
import { activeCycle, cycleKeyFor, cycleStartFor, daysBetween, daysInto, historyFloor, mondayOf, nextCycleKey, nextCycleStart, planningMode, rebuildKey, upcomingCycle } from '../../src/lib/fuel/cycle.ts'
import { acknowledge, adopt, enqueue, orphans, outboxKey, outboxPrefix, ORPHAN_AFTER_MS, progress, reconcile, released, render } from '../../src/lib/fuel/ticks.ts'
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
  // the monthly steak rule is judged over FOUR WEEKS ACROSS CYCLES (Codex r10): rounding up per cycle let a weekly
  // household eat steak every week. Target 2026-09-21, weekly: the window is nights from the 31st of August to the 27th
  const weekly = { ...andrew, shop_cadence_days: 7 }
  const steakWeek = (start, week = 1) => ({ week_start: start, version: 1, meal_ids: [{ slug: 'cast-iron-ribeye', week, servings: 2 }] })
  assert(steakNightsElsewhere([steakWeek('2026-08-31'), steakWeek('2026-09-07'), steakWeek('2026-09-14')], meals, '2026-09-21', 7) === 3
    && steakNightsElsewhere([steakWeek('2026-08-24'), steakWeek('2026-09-21')], meals, '2026-09-21', 7) === 0,
    'three weekly steak nights inside the four-week window count; a night before the window, and the target cycle\'s own nights, do not')
  assert(steakNightsElsewhere([steakWeek('2026-09-07'), steakWeek('2026-09-14'), { week_start: '2026-09-14', version: 2, meal_ids: [] }], meals, '2026-09-21', 7) === 1,
    'only the highest version of a start counts — the 14th\'s v2 dropped its steak')
  assert(steakNightsElsewhere([steakWeek('2026-08-24', 2)], meals, '2026-09-21', 7) === 1, 'a week-two night is placed on its own Monday — the 31st, inside the window')
  assert(validatePlan(twoRibeye(), meals, weekly, { steakNightsElsewhere: 2 }).some((w) => /3 steak nights in the four weeks/.test(w))
    && validatePlan(twoRibeye(), meals, weekly, { steakNightsElsewhere: 1 }).every((w) => !/four weeks/.test(w)) && validatePlan(twoRibeye(), meals, weekly).every((w) => !/four weeks/.test(w)),
    'a third steak in four weeks is reported against a two-a-month rule; a second is not; no history, no report')
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
  // the query is bounded by start, not by row count (Codex r5): five weeks back covers any live fortnight and the four-week steak window (r10)
  assert(historyFloor(new Date(2026, 8, 23)) === '2026-08-19' && daysInto(historyFloor(new Date(2026, 8, 28)), new Date(2026, 8, 28)) === 35, 'the history floor is five weeks back — a live fortnight plus the four weeks a monthly rule is judged over')
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
  assert(/return adopt\(mine\?\.intents \?\? \[\], adoptOrphans\(listId\)\)/.test(cl9) && /JSON\.stringify\(\{ tab: tabId\(\), alive: rel \? 0 : Date\.now\(\), intents: outbox \} satisfies StoredOutbox\)/.test(cl9),
    'the checklist writes its own tab\'s key, stamped alive, and a mount adopts the outboxes tabs left behind')
  // round 10: the tab id is per document; a released outbox is never recreated; hidden means no heartbeat, no flush, no adoption; a release is taken at once
  assert(/function tabId\(\): string \{ return tab \?\? \(tab = Math\.random\(\)/.test(cl9) && !/sessionStorage\./.test(cl9),
    'the tab id is minted once per document — a remount keeps its outbox, a reload adopts the released one, a duplicated tab has its own')
  assert(/const rel = released\(leaving \|\| document\.visibilityState === 'hidden', inFlightFor\(listId\)\.size\)/.test(cl9) && /if \(rel && localStorage\.getItem\(k\) === null\) return true/.test(cl9),
    'a released outbox is re-written only while still ours — never recreated after another tab took it')
  assert(/const stamp = \(\) => \{ if \(document\.visibilityState === 'visible' \|\| inFlight\.current\.size\) writeOutbox\(listId, outboxRef\.current\) \}/.test(cl9), 'the heartbeat stops while hidden — but keeps stamping while a write is in flight')
  // round 11: the claim holds while a write is in flight; a refusal lets it go
  assert(released(true, 0) && !released(true, 1) && !released(false, 0) && !released(false, 2), 'a hidden tab\'s outbox is released — not while a write is in flight, never while visible')
  assert(/if \(!items\) \{ setFailed\(\(f\) => new Set\(f\)\.add\(intent\.key\)\); writeOutbox\(listId, outboxRef\.current\); break \}/.test(cl9), 'a refused write lets the claim go, so another tab can retry it')
  assert(/while \(outboxRef\.current\.length > 0 && navigator\.onLine && mounted\.current && document\.visibilityState !== 'hidden'\)/.test(cl9), 'a hidden tab does not flush — its intents are released for a visible tab')
  assert(/if \(document\.visibilityState === 'hidden'\) return \[\]/.test(cl9), 'a hidden tab adopts nothing')
  assert(/const onStorage = \(e: StorageEvent\)/.test(cl9) && /if \(stored\?\.alive === 0\) wakeUp\(false\)/.test(cl9) && /if \(reread \|\| took\) setWake/.test(cl9),
    'a visible tab takes a released outbox the moment it is released, and re-reads the row only when it took something')
  assert(/if \(document\.visibilityState === 'hidden'\) writeOutbox\(listId, outboxRef\.current\); else wakeUp\(true\)/.test(cl9) && /window\.addEventListener\('pagehide', hide\)/.test(cl9) && /const hide = \(\) => writeOutbox\(listId, outboxRef\.current, true\)/.test(cl9),
    'a tab that hides or closes lets its outbox go, so the next tab can take the ticks at once')
  assert(/if \(next\.length && persisted\.current && !ownKeyPresent\(listId\)\) next = \[\]/.test(cl9) && /next = adopt\(next, adoptOrphans\(listId\)\)/.test(cl9) && /\[online, listId, refetch, onRowItems, flush, wake\]/.test(cl9),
    'a tab that wakes to find its outbox adopted drops those intents rather than sending them twice, adopts what others left, and re-reads the row')
  const cl6 = readLF('src/components/fuel/Checklist.tsx')
  assert(/inFlight\.current\.add\(intent\.key\)/.test(cl6) && /finally \{ inFlight\.current\.delete\(intent\.key\) \}/.test(cl6) && /reconcile\(fresh, outboxRef\.current, inFlight\.current\)/.test(cl6),
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
  assert(/const listId = list\?\.id \?\? null/.test(pg) && /\}, \[supabase, listId\]\)/.test(pg) && !/\}, \[supabase, list\]\)/.test(pg), 'send and refetch depend on the list id — a row update cannot re-trigger reconciliation')
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
  assert(/steakNightsElsewhere=\{steakNightsElsewhere\(recent, meals, buildTarget\(new Date\(\)\), household\.shop_cadence_days\)\}/.test(pg) && /setRecent\(active\.recent\)/.test(pg) && /setRecent\(\(r\) => \[\.\.\.r, built\]\)/.test(pg),
    'the builder is told the steak nights already planned in other cycles — loaded with the page, and kept current after a build')
  assert(/validatePlan\(\{ entries \}, meals, household, \{ steakNightsElsewhere \}\)/.test(pb), 'the builder judges the monthly steak rule across cycles')
  const st10 = readLF('src/lib/fuel/store.ts')
  assert(/recent: PlanRow\[\]/.test(st10) && /const recent = rows as PlanRow\[\]/.test(st10), 'loadActive hands back every recent cycle, all versions')
  // round 9: the next-cycle target is checked against today, and a cycle planned ahead that the build passed is let go
  assert(/nextCycleKey\(liveCycle, upcoming\?\.week_start \?\? null, household\.shop_cadence_days, now\)/.test(pg) && /if \(upcoming && \(upcoming\.week_start === weekStart \|\| weekStart > upcoming\.week_start\)\) setUpcoming\(null\)/.test(pg), 'a next-cycle build keys through nextCycleKey — checked against today — and drops an upcoming cycle it has passed')
  // round 11: the shortcut stands only when a fresh solve comes out identical — the library can have been corrected
  assert(/&& listUnchanged\(buildShoppingList\(household, meals, p\)\.items, list\.items\)\) \{ setStep\('list'\); return \}/.test(pg), 'the unchanged-plan shortcut re-solves before it stands, so a library correction is never skipped')
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
  assert(/const upcoming = upcomingCycle</.test(st4) && /activeCycle<PlanRow & CycleRow>\(candidates, today\) \?\? upcoming/.test(st4), 'the store surfaces the upcoming cycle, and falls back to it when nothing is live')
  const cl4 = readLF('src/components/fuel/Checklist.tsx')
  assert(/const inFlightByList = new Map<string, Set<string>>\(\)/.test(cl4) && /useRef<Set<string>>\(inFlightFor\(listId\)\)/.test(cl4), 'in-flight keys are shared across remounts of the same list')
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
  assert(/\/\/ Meal planner \+ shopping list: held out until FOR-177 ships/.test(modal) && !/^\s*'Meal planner/m.test(modal), 'PRO_FEATURES still holds the meal-planner line out until this ships')
  const checklist = readLF('src/components/fuel/Checklist.tsx')
  assert(/\{i\.inferred && <span[^>]*>est\.<\/span>\}/.test(checklist), 'an inferred quantity is shown as an estimate on its own line, never as fact')
  assert(/save === 'pending'/.test(checklist) && /save === 'failed'/.test(checklist) && /queued/.test(checklist), 'every tick shows whether it saved: pending, queued offline, or failed')
  assert(/'online'/.test(checklist) && /'offline'/.test(checklist), 'the checklist listens for the network coming back')
  assert(!existsSync(join(ROOT, 'src/components/FuelStation.tsx')), 'FuelStation.tsx is not resurrected')
  const w = validatePlan({ entries: [...W1.map((s) => entry(s, 1)), entry('blackened-cod', 1)] }, meals, andrew)
  assert(w.some((x) => /fish nights/.test(x)) && w.some((x) => /5 nights planned/.test(x)), 'the frequency and night-count rules are reported, not silently fixed')
}

if (failures) { console.log(`\nfuel-solve: ${failures} of ${failures + passes} checks FAILED`); process.exit(1) }
console.log(`fuel-solve: ${passes} checks passed — rows in, list out, the row owns the ticks`)
