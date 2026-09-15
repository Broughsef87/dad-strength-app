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
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { buildShoppingList, purchaseMultiplier, usableInventoryFraction, isSecondTrip, validatePlan, proteinScale, steakNightsPerCycle, steakWindowWarnings, overlapWarnings, householdFor, defaultServings, libraryUnits, libraryItems, libraryVocabulary, inventoryIssues, SECOND_TRIP_SECTION } from '../../src/lib/fuel/solve.ts'
import { changed, inventoryFresh, listUnchanged, nextVersion, snapshot } from '../../src/lib/fuel/version.ts'
import { activeCycle, cycleKeyFor, cycleStartFor, daysBetween, daysInto, expired, historyFloor, mondayOf, newestVersion, nextCycleKey, nextCycleStart, planningMode, rebuildKey, upcomingCycle } from '../../src/lib/fuel/cycle.ts'
import { acknowledge, adopt, drop, enqueue, hold, nextExpiry, orphans, outboxKey, outboxPrefix, ORPHAN_AFTER_MS, outstanding, progress, reconcile, released, render } from '../../src/lib/fuel/ticks.ts'
import { builderStart, defaultRotation, rotationEntries, rotationJustRun, rotationOf, sortedRotations } from '../../src/lib/fuel/rotation.ts'
import { addNight, isKnownWarning, planIssues, planIssueSentences, removeNight, setServings, swapNight } from '../../src/lib/fuel/planner.ts'
import * as planBuilderModule from '../../src/components/fuel/PlanBuilder.tsx'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PAIRS, renderPair, onDisk as migrationOnDisk, drifted } from '../fuel-seed-sql.mjs'
import { createVersion } from '../../src/lib/fuel/store.ts'
import { customKey, customLine, defaultSection, isCustom, sectionsInOrder, solverLines, stapleIdFromKey, withStaples } from '../../src/lib/fuel/custom.ts'
import * as checklistModule from '../../src/components/fuel/Checklist.tsx'
import * as addItemModule from '../../src/components/fuel/AddItem.tsx'

let failures = 0, passes = 0
// A .tsx component imported from this .mjs arrives CommonJS-wrapped under tsx: the
// component is on `default`, or on `default.default`. Unwrapped once, here (FOR-241).
const planBuilderExports = planBuilderModule.default && typeof planBuilderModule.default === 'object' ? planBuilderModule.default : planBuilderModule
const PlanBuilder = typeof planBuilderExports.default === 'function' ? planBuilderExports.default : planBuilderModule.default
const LibraryDrawer = planBuilderExports.LibraryDrawer ?? planBuilderModule.LibraryDrawer
const maxServings = planBuilderExports.maxServings ?? planBuilderModule.maxServings
const unwrapDefault = (mod) => { const e = mod.default && typeof mod.default === 'object' ? mod.default : mod; return typeof e.default === 'function' ? e.default : mod.default }
const Checklist = unwrapDefault(checklistModule)
const checklistExports = checklistModule.default && typeof checklistModule.default === 'object' ? checklistModule.default : checklistModule
const AddItem = unwrapDefault(addItemModule)
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
  const phase1 = PAIRS.find((p) => p.migration === 'supabase/migrations/20260914_fuel_phase_1.sql')
  const onDisk = migrationOnDisk(phase1) ?? ''
  assert(onDisk === renderPair(phase1), 'the migration is exactly what the fixture generates — no drift between seed and SQL')
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
  assert(/export const removeNight = \(entries: PlanEntry\[\], index: number\): PlanEntry\[\] => entries\.filter\(\(_, i\) => i !== index\)/.test(readLF('src/lib/fuel/planner.ts')) && /aria-label=\{`remove \$\{name\}`\} onClick=\{\(\) => \{ setEntries\(removeNight\(entries, i\)\); setDrawer\(null\) \}\}>remove<\/button>/.test(pb), 'a selected meal that fell outside the cap can still be removed')
  assert(/\.filter\(\(e\) => e\.week <= weeks/.test(pb), 'a saved fortnight plan is cut to the cycle when the shop becomes weekly')
  // round 7: a retired meal is dropped from a saved plan and named — never held as a night that cannot be removed
  assert(/\.filter\(\(e\) => e\.week <= weeks && bySlug\.has\(e\.slug\)\)/.test(pb) && /no longer in the library/.test(pb) && /retired\.length > 0 &&/.test(pb),
    'a saved night whose meal left the library is dropped and named, so the builder is never blocked by a night that cannot be removed')
  const inf = readLF('src/components/fuel/IntakeForm.tsx')
  assert(/libraryUnits\(meals\)/.test(inf) && /\{units\.map\(\(u\) => <option/.test(inf) && !/const UNITS = \[/.test(inf), 'the inventory unit picker is built from the library, not a fixed list')
  assert(/<IntakeForm initial=\{household \?\? DEFAULT_HOUSEHOLD\} meals=\{meals\}/.test(pg), 'the page hands the library to the intake')
  assert(/export const maxServings = \(household: Pick<Household, 'people_count'>\) => Math\.max\(8, household\.people_count \* 3\)/.test(pb) && /Math\.min\(cap, e\.servings \+ 1\)/.test(pb), 'cooked servings can reach three per person for the largest household intake allows')
  assert(/Math\.min\(defaultServings\(meal, household\), cap\)/.test(readLF('src/lib/fuel/planner.ts')) && /m && e\.servings < household\.people_count \? \{ \.\.\.e, servings: defaultServings\(m, household\) \} : e/.test(pb),
    'a new night defaults to what the household needs; a saved night is raised only if it no longer feeds everyone, otherwise kept as chosen (Codex r2, r3)')
  assert(/const startingNext = !!\(liveCycle && nextCycle\)/.test(pg) && /if \(!startingNext && plan && list && plan\.week_start === weekStart && !changed\(/.test(pg) && /planningMode\(/.test(pg),
    'the page can plan the NEXT cycle — keyed to where the live one ends (or the cycle already planned ahead), defaulting to it on the final day, never short-circuited by the unchanged-plan shortcut')
  assert(/rebuildKey\(liveCycle, household\.shop_cadence_days, now\)/.test(pg) && /const buildTarget = \(now: Date\): string =>/.test(pg), 'a rebuild keys through rebuildKey, so a shortened cadence cannot snapshot an expired cycle')
  // round 10: the builder is told the steak nights already planned in other cycles, for the target the build would land on
  assert(/cycles=\{\{ history: recent, targetStart: buildTarget\(new Date\(\)\), cadenceDays: household\.shop_cadence_days \}\}/.test(pg) && /setRecent\(active\.recent\)/.test(pg) && /setRecent\(\(r\) => \[\.\.\.r, built\]\)/.test(pg),
    'the builder is told the steak nights already planned in other cycles — loaded with the page, and kept current after a build')
  assert(/validatePlan\(\{ entries \}, meals, household, \{ cycles \}\)/.test(pb), 'the builder judges the monthly steak rule across cycles')
  // round 14: validated again at build time, against the target the build lands on
  assert(/const late = validatePlan\(p, meals, household, \{ cycles: \{ history: recent, targetStart: weekStart, cadenceDays: household\.shop_cadence_days \} \}\)/.test(pg) && /if \(late\.length\) \{ setError\(planIssueSentences\(late, p\.entries, meals\)\.join\(' · '\)\); return \}/.test(pg)
    && pg.indexOf('const weekStart = buildTarget(new Date())') < pg.indexOf('const late = validatePlan(') && pg.indexOf('const late = validatePlan(') < pg.indexOf('plan.week_start === weekStart && !changed('),
    'the plan is validated again at build time against the target the build lands on — before the shortcut, before any write')
  const st10 = readLF('src/lib/fuel/store.ts')
  assert(/recent: PlanRow\[\]/.test(st10) && /const recent = rows as PlanRow\[\]/.test(st10), 'loadActive hands back every recent cycle, all versions')
  // round 9: the next-cycle target is checked against today, and a cycle planned ahead that the build passed is let go
  assert(/nextCycleKey\(liveCycle, upcoming\?\.week_start \?\? null, household\.shop_cadence_days, now\)/.test(pg) && /if \(upcoming && \(upcoming\.week_start === weekStart \|\| weekStart > upcoming\.week_start\)\) setUpcoming\(null\)/.test(pg), 'a next-cycle build keys through nextCycleKey — checked against today — and drops an upcoming cycle it has passed')
  // round 11: the shortcut stands only when a fresh solve comes out identical — the library can have been corrected
  assert(/&& listUnchanged\(buildShoppingList\(householdFor\(household, inventoryCounted\), meals, p\)\.items, list\.items\)\) \{ setStep\('list'\); return \}/.test(pg), 'the unchanged-plan shortcut re-solves before it stands — the way the stored plan was built — so a library correction is never skipped')
  // round 15: what is on hand counts against a next cycle only on say-so, recorded in the snapshot
  assert(/const inventoryCounted = askNow \? opts\.countInventory : true/.test(pg) && /createVersion\(supabase, weekStart, household, meals, p, inventoryCounted, st\.staples\)/.test(pg) && /askInventory=\{askInventory\}/.test(pg),
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
  // round 17's wake refresh is DELETED (FOR-233, Codex r3): the page re-reads only when the database refuses a tick, and on the retry of a failed re-read.
  // Pinned by how many times the code NAMES `refresh`, not by trigger names: a trigger re-added in any form has to name it to call it (FOR-233, review of ad68a14).
  const code17 = pg.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')
  assert(/const refresh = useCallback\(async \(\) => \{/.test(pg) && !/visibilitychange/.test(pg) && !/pageshow/.test(pg) && !/addEventListener\(['"]online['"]/.test(pg)
    && (code17.match(/\brefresh\b/g) || []).length === 4 && /if \(superseded && listIdRef\.current === listId\) void refresh\(\)\n/.test(code17) && /\}, \[supabase, listId, refresh\]\)/.test(code17) && /onClick=\{\(\) => void refresh\(\)\}>retry</.test(code17)
    && /setStep\(\(s\) => \(s === 'list' && \(!nextList \|\| persistedStale\) \? 'plan' : s\)\)/.test(pg) && /paused=\{refreshing \|\| refreshFailed\}/.test(pg) && /if \(!userId \|\| busyRef\.current\) return/.test(pg),
    'the page does NOT re-read on waking or reconnecting — the wake refresh is deleted; `refresh` is named in exactly four places in code — its definition, the refused-tick answer and its dependency list, the retry — so no trigger can come back in any form; never mid-build, leaves a superseded list, and pauses the checklist meanwhile')
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
  const pl7 = readLF('src/lib/fuel/planner.ts')
  assert(/export const setServings = \(entries: PlanEntry\[\], slug: string, week: number, servings: number\): PlanEntry\[\] => entries\.map\(\(e\) => \(e\.slug === slug && e\.week === week \? \{ \.\.\.e, servings \} : e\)\)/.test(pl7) && /return existing \? existing\.servings : Math\.min\(defaultServings\(meal, household\), cap\)/.test(pl7) && /nights, each/.test(pb),
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
  assert(/return \[\.\.\.entries, \{ slug: meal\.slug, week, servings: servingsFor\(entries, meal, week, household, cap\) \}\]/.test(pl7) && /export const removeNight = /.test(pl7),
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
  assert(/THE CYCLE MODEL \(FOR-233\): the page shows ONE cycle at a time/.test(pg9) && /the page does NOT re-read on waking or\n\/\/ reconnecting/.test(pg9) && /a re-read that fails is shown and keeps the\n\/\/ checklist paused until a retry succeeds/.test(pg9) && /the database refuses a tick on\n\/\/ a superseded list/.test(pg9) && /Why no wake refresh/.test(pg9),
    'the page states its cycle model in one sentence: one cycle at a time, NO wake refresh — the row is the only truth — a refused tick answered by a re-read that never changes the selection unless it expired, a failed re-read shown and pausing')
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
  const readers = ['src/lib/fuel/solve.ts', 'src/lib/fuel/store.ts', 'src/lib/fuel/types.ts', 'src/lib/fuel/version.ts', 'src/lib/fuel/cycle.ts', 'src/lib/fuel/ticks.ts', 'src/lib/fuel/rotation.ts', 'src/components/fuel/Checklist.tsx', 'src/components/fuel/PlanBuilder.tsx', 'src/components/fuel/IntakeForm.tsx', 'src/app/fuel/page.tsx']
  for (const f of readers) assert(!/carbs_g_per_person|fat_g_per_person|calories_per_person/.test(readLF(f)), `${f} does not read the macro columns — schema only`)
}

// ── 10. rotations (FOR-238): the generator over pairs, and an additive migration ──
// Rotation B renders its own migration through the ONE generator, generalised
// over (fixture -> migration) pairs rather than copied; every pair is checked
// for drift and passes the macro guard. The rotations migration is additive
// only: two tables with RLS, read-only to users, the five new meals and both
// rotations' membership — no rotation-A meal row, no prose parsed. The
// standing data invariants live in fuel-rotations.mjs, not here.
{
  const rot = JSON.parse(readLF('fixtures/fuel-seed-rotation-b.json'))
  const pairs = PAIRS.map((p) => `${p.fixture} -> ${p.migration}`)
  assert(pairs.length === 2 && pairs.includes('fixtures/fuel-seed.json -> supabase/migrations/20260914_fuel_phase_1.sql') && pairs.includes('fixtures/fuel-seed-rotation-b.json -> supabase/migrations/20260917_fuel_rotations.sql'),
    `the generator renders exactly two (fixture -> migration) pairs, phase 1 and rotations — got ${pairs.join('; ')}`)
  const rotPair = PAIRS.find((p) => p.fixture === 'fixtures/fuel-seed-rotation-b.json')
  assert(readdirSync(join(ROOT, 'scripts')).filter((f) => /seed/i.test(f)).length === 1, 'there is one seed generator — rotation B got a pair, not a second copy of the script')
  const bad = drifted().map((p) => p.migration)
  assert(bad.length === 0, `every migration is exactly what its fixture generates — drifted: ${bad.join(', ') || 'none'}`)
  const cli = spawnSync(process.execPath, [join(ROOT, 'scripts/fuel-seed-sql.mjs'), '--check'], { cwd: ROOT, encoding: 'utf8' })
  assert(cli.status === 0 && /every migration matches its fixture \(2 pairs\)/.test(cli.stdout), `node scripts/fuel-seed-sql.mjs --check passes for both fixtures — exit ${cli.status}: ${(cli.stderr || cli.stdout || '').trim().slice(0, 160)}`)
  const gen10 = readLF('scripts/fuel-seed-sql.mjs')
  assert((gen10.match(/guardMacros\(/g) || []).length === 2 && /\n  guardMacros\(pair\.meals\(seed\)\)\n  return pair\.render\(seed\)\n\}/.test(gen10), "the macro guard runs on every pair's meals, before anything renders — rotation B's five new meals included")
  assert(/export function drifted\(\) \{\n  return PAIRS\.filter\(\(p\) => onDisk\(p\) !== renderPair\(p\)\)\n\}/.test(gen10) && /if \(process\.argv\.includes\('--check'\)\) \{\n    const bad = drifted\(\)/.test(gen10), 'drift and --check cover every pair — no pair is left unchecked')
  let unkeyed = ''
  try { renderPair({ ...rotPair, meals: () => [{ slug: 'no-macro-keys' }] }) } catch (e) { unkeyed = String(e.message) }
  assert(/no-macro-keys: fixture is missing carbs_g_per_person/.test(unkeyed), 'a rotation meal without the macro keys is refused')
  let collide = ''
  try { rotPair.render({ ...rot, fuel_meals_new: [...rot.fuel_meals_new, { ...rot.fuel_meals_new[0], slug: 'cast-iron-ribeye' }] }) } catch (e) { collide = String(e.message) }
  assert(/cast-iron-ribeye: already a meal in fixtures\/fuel-seed\.json/.test(collide), 'the generator refuses a new meal whose slug is a rotation-A meal — the upsert would rewrite that row')
  let dangling = ''
  try { rotPair.render({ ...rot, fuel_rotation_meals: [...rot.fuel_rotation_meals, { rotation_slug: 'rotation-b', meal_slug: 'no-such-meal', week: 1, sort_order: 9 }] }) } catch (e) { dangling = String(e.message) }
  assert(/no-such-meal is not a meal in either fixture/.test(dangling), 'the generator refuses a membership row that names no meal')

  const rmig = migrationOnDisk(rotPair) ?? ''
  for (const t of ['fuel_rotations', 'fuel_rotation_meals']) {
    assert(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${t} \\(`).test(rmig) && new RegExp(`ALTER TABLE public\\.${t} ENABLE ROW LEVEL SECURITY`).test(rmig)
      && new RegExp(`ON public\\.${t}\\n  FOR SELECT TO authenticated USING \\(true\\)`).test(rmig) && !new RegExp(`ON public\\.${t}\\s+FOR (ALL|INSERT|UPDATE|DELETE)`).test(rmig),
      `${t} is created with row level security, read-only to users, in the same migration`)
  }
  assert(/rotation_slug text NOT NULL REFERENCES public\.fuel_rotations\(slug\)/.test(rmig) && /meal_slug     text NOT NULL REFERENCES public\.fuel_meals\(slug\)/.test(rmig)
    && /PRIMARY KEY \(rotation_slug, meal_slug\)/.test(rmig) && /week          int  NOT NULL CHECK \(week IN \(1, 2\)\)/.test(rmig),
    'membership is a join keyed on (rotation, meal), both slugs foreign keys, the default week 1 or 2 — not a column on fuel_meals')
  assert(!/ALTER TABLE public\.fuel_(meals|household|plans|lists)|DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE|\bUPDATE public\./.test(rmig),
    'the rotations migration is additive only — no column on fuel_meals changes, nothing dropped, deleted or updated outside an upsert')
  const mealInsert10 = (rmig.match(/INSERT INTO public\.fuel_meals[\s\S]*?ON CONFLICT \(slug\)/) || [])[0] || ''
  assert((mealInsert10.match(/^  \('/gm) || []).length === 5 && rot.fuel_meals_new.every((m) => mealInsert10.includes(`('${m.slug}', `)) && meals.every((m) => !mealInsert10.includes(`('${m.slug}', `)),
    'the migration inserts the five new meals and not one rotation-A meal row')
  assert(!/rotation_note\s*(~|LIKE|ILIKE|SIMILAR)|regexp_|substring\(/i.test(rmig), 'the migration parses no prose — rotation_note is colour, never read for meaning')
  assert((rmig.match(/^  \('rotation-[ab]', '[a-z-]+', [12], \d+\)/gm) || []).length === 16 && /ON CONFLICT \(rotation_slug, meal_slug\) DO UPDATE SET/.test(rmig),
    'all sixteen membership rows are in the migration, each with its default week and order')
  const names10 = readdirSync(join(ROOT, 'supabase/migrations')).sort()
  assert(names10.indexOf('20260917_fuel_rotations.sql') > names10.indexOf('20260916_fuel_tick_superseded_guard.sql'), 'the rotations migration sorts after everything it references')
  const runAll = readLF('scripts/checks/run-all.mjs')
  assert(/\['fuel rotations \(FOR-238\)', 'fuel-rotations\.mjs'\]/.test(runAll) && existsSync(join(ROOT, 'scripts/checks/fuel-rotations.mjs')),
    'the standing rotation invariants are registered as their own suite')
}

// ── 11. rotations (FOR-238): where the builder starts, on the cycle sentence ──
// A rotation is where the builder STARTS a version of the selected cycle —
// each meal at its default week, the plan's own week the athlete's — and
// which rotation a plan ran is read from its picks, never stored beside them.
// Switching rotation builds the next version, so the list regenerates and
// changes; the page holds no rotation selection for a re-read to keep or lose.
{
  const rot = JSON.parse(readLF('fixtures/fuel-seed-rotation-b.json'))
  const library = [...meals, ...rot.fuel_meals_new]
  const lib = (s) => library.find((m) => m.slug === s)
  const rotations = rot.fuel_rotations
  const members = rot.fuel_rotation_meals
  const rotationPlan = (slug, household = andrew) => ({ entries: rotationEntries(slug, members, library, household) })
  const defaultWeek = (rotation, slug) => members.find((x) => x.rotation_slug === rotation && x.meal_slug === slug)?.week

  // acceptance 4: the default week comes from the rotation; the athlete's week wins
  const b = rotationPlan('rotation-b')
  assert(b.entries.length === 8 && b.entries.every((e) => e.week === defaultWeek('rotation-b', e.slug)),
    "a plan started from a rotation takes each meal's DEFAULT week from fuel_rotation_meals.week")
  const swapped = { entries: b.entries.map((e) => (e.slug === 'jerk-thighs' ? { ...e, week: 1 } : e.slug === 'chili-lime-thighs' ? { ...e, week: 2 } : e)) }
  assert(snapshot(andrew, swapped).entries.find((e) => e.slug === 'jerk-thighs')?.week === 1 && rotationOf(swapped.entries, rotations, members) === 'rotation-b' && changed(snapshot(andrew, b), andrew, swapped),
    "the plan's own week is the athlete's: a night moved off its default week stays moved, is still rotation B, and is a new version")

  // where the builder starts, for this household
  const weekly = rotationPlan('rotation-b', { ...andrew, shop_cadence_days: 7 }).entries
  assert(weekly.length === 4 && weekly.every((e) => e.week === 1), "a weekly shop starts from the rotation's week-1 nights only")
  const three = rotationPlan('rotation-b', { ...andrew, nights_per_week: 3 }).entries.map((e) => `${e.week}:${e.slug}`)
  assert(JSON.stringify(three) === JSON.stringify(['1:cast-iron-ribeye', '1:chili-lime-thighs', '1:miso-ginger-salmon', '2:jerk-thighs', '2:turkey-meatballs', '2:tandoori-breast']),
    `never more nights a week than the household cooks, in the rotation's order — got ${three.join(' ')}`)
  const capped = rotationPlan('rotation-b', { ...andrew, cook_cap_minutes: 15 }).entries
  assert(capped.length > 0 && capped.every((e) => lib(e.slug).active_cook_minutes <= 15), 'a meal over the cook cap is left out of where the builder starts')
  const four = rotationPlan('rotation-b', { ...andrew, people_count: 4 }).entries
  assert(four.every((e) => e.servings === defaultServings(lib(e.slug), { people_count: 4 })), "servings start at the household's default, not the seed's")

  // acceptance 3 and section 6: switching rotation regenerates the list, and it changes
  const la = buildShoppingList(andrew, library, rotationPlan('rotation-a'))
  const lb = buildShoppingList(andrew, library, b)
  assert(JSON.stringify(la.items) !== JSON.stringify(lb.items), 'switching rotation changes the list')
  const meatLines = (l) => JSON.stringify(l.items.filter((i) => i.section === 'Meat & Seafood').map((i) => [i.item, i.qty, i.unit, i.second_trip]).sort())
  assert(meatLines(la) === meatLines(lb), 'both rotations buy the same meat, cut for cut and ounce for ounce — the Costco shop is the same shape')
  const rest = (l) => new Set(l.items.filter((i) => i.section !== 'Meat & Seafood').map((i) => `${i.key}=${i.qty}`))
  const ra = rest(la), rb = rest(lb)
  assert([...rb].some((k) => !ra.has(k)) && [...ra].some((k) => !rb.has(k)), 'produce and pantry lines differ between the rotations')

  // acceptance 5: the doubled number on a list generated from rotation B, not the per-person one
  const qty = (item) => find(lb, item)?.qty
  assert(qty('chicken thigh, boneless skinless') === 96 && qty('ground turkey 93/7') === 102 && qty('chicken breast, boneless skinless') === 26,
    `rotation B's meat is doubled for the 50% prep diversion — thighs 96, turkey 102, breast 26 oz, not 48 / 51 / 13 — got ${qty('chicken thigh, boneless skinless')} / ${qty('ground turkey 93/7')} / ${qty('chicken breast, boneless skinless')}`)
  assert(find(lb, 'cod or halibut', true)?.qty === 34 && !find(lb, 'cod or halibut', false) && find(lb, 'salmon', false)?.qty === 30,
    'rotation B keeps L3: the week-2 cod tacos are the second trip, the week-1 salmon the main shop')
  assert(validatePlan(rotationPlan('rotation-a'), library, andrew).length === 0 && validatePlan(b, library, andrew).length === 0, 'both rotations, started as they stand, break no household rule')

  // which rotation a plan ran is read from its picks
  assert(rotationOf(rotationPlan('rotation-a').entries, rotations, members) === 'rotation-a' && rotationOf(b.entries, rotations, members) === 'rotation-b', "a plan's rotation is read from its picks")
  assert(rotationOf(['cast-iron-ribeye', 'chili-lime-thighs', 'greek-turkey-bowl'].map((slug) => ({ slug })), rotations, members) === null, 'meals in both rotations say nothing — the keepers alone are no rotation')
  const uneven = [{ slug: 'r1', name: 'One', sort_order: 1, note: null }, { slug: 'r2', name: 'Two', sort_order: 2, note: null }, { slug: 'r3', name: 'Three', sort_order: 3, note: null }]
  const unevenMembers = [['r1', 'm1'], ['r2', 'm1'], ['r1', 'm2'], ['r3', 'm2']].map(([rotation_slug, meal_slug], i) => ({ rotation_slug, meal_slug, week: 1, sort_order: i + 1 }))
  assert(rotationOf([{ slug: 'm1' }, { slug: 'm2' }], uneven, unevenMembers) === null, 'a meal in more than one rotation says nothing about which was run — even where rotations overlap unevenly')
  assert(rotationOf([{ slug: 'miso-ginger-salmon' }, { slug: 'lemon-garlic-salmon' }], rotations, members) === null, 'a tie is no rotation — never a guess')
  assert(rotationOf([...b.entries.slice(0, 7), { slug: 'blackened-cod' }], rotations, members) === 'rotation-b', 'a rotation with one night swapped is still that rotation')

  // a new cycle starts from the lowest rotation not just run
  assert(defaultRotation(rotations, null) === 'rotation-a' && defaultRotation(rotations, 'rotation-a') === 'rotation-b' && defaultRotation(rotations, 'rotation-b') === 'rotation-a',
    'a new cycle starts from the lowest rotation not just run')
  assert(defaultRotation([...rotations].reverse(), null) === 'rotation-a' && sortedRotations([...rotations].reverse())[0].slug === 'rotation-a', 'rotation order is sort_order, whatever order the rows arrive in')
  assert(defaultRotation([], null) === null, 'no rotations, no default — the builder starts as it always did')
  const hist = [
    { week_start: '2026-08-24', version: 1, meal_ids: rotationPlan('rotation-a').entries },
    { week_start: '2026-09-07', version: 1, meal_ids: b.entries },
    { week_start: '2026-09-07', version: 2, meal_ids: rotationPlan('rotation-a').entries },
  ]
  assert(rotationJustRun(hist, '2026-09-21', rotations, members) === 'rotation-a', 'the cycle just run is the newest version of the latest cycle before the target')
  assert(rotationJustRun(hist, '2026-09-07', rotations, members) === 'rotation-a' && rotationJustRun(hist, '2026-08-24', rotations, members) === null,
    'the target cycle itself is not history; with nothing before it, nothing was just run')

  // the page: on the sentence, no selection, loaded once, degrading before the migration
  const pg11 = readLF('src/app/fuel/page.tsx')
  assert(/ROTATIONS \(FOR-238\), on that sentence and not beside it: a rotation is not a\n\/\/ second thing the page shows/.test(pg11)
    && pg11.indexOf('ROTATIONS (FOR-238)') > pg11.indexOf('THE CYCLE MODEL (FOR-233)') && pg11.indexOf('ROTATIONS (FOR-238)') < pg11.indexOf('Why no wake refresh'),
    'the page states rotations on the cycle sentence, directly under it: where the builder starts, read from the picks, never a second thing shown')
  assert(!/const \[\w*[Rr]otation\w*, set\w*\] = useState<string/.test(pg11) && !/rotation_slug/.test(pg11) && !/localStorage/.test(pg11),
    'the page holds no rotation selection — nothing for a re-read to keep or lose')
  assert(/const entries = builderStart\(targetStart, recent, rotations, members, meals, h, plan \? plan\.meal_ids : null\)/.test(pg11) && /initial=\{startEntries\(buildTarget\(new Date\(\)\), household\)\} rotations=\{rotations\} members=\{members\}/.test(pg11) && !/if \(plan && !nextCycle\) return/.test(pg11),
    'the page starts the builder through builderStart, on the start the build lands on — never on which toggle is set')
  // builderStart: the picks saved for the target start, else the rotation not just run, else the selected picks (Codex, FOR-238 r1)
  const sep7 = { week_start: '2026-09-07', version: 1, meal_ids: rotationPlan('rotation-a').entries }
  const sep7v2 = { week_start: '2026-09-07', version: 2, meal_ids: rotationPlan('rotation-a').entries.slice(1) }
  const sep21 = { week_start: '2026-09-21', version: 1, meal_ids: b.entries }
  assert(JSON.stringify(builderStart('2026-09-07', [sep7, sep7v2, sep21], rotations, members, library, andrew, null)) === JSON.stringify(sep7v2.meal_ids) && JSON.stringify(builderStart('2026-09-21', [sep7, sep7v2, sep21], rotations, members, library, andrew, null)) === JSON.stringify(sep21.meal_ids),
    'a rebuild starts from the picks saved for its own start, at their newest version — the selected cycle, or the cycle planned ahead')
  const shortened = rebuildKey({ week_start: '2026-09-07', version: 1, shop_cadence_days: 14 }, 7, new Date('2026-09-15T12:00:00'))
  const weeklyAndrew = { ...andrew, shop_cadence_days: 7 }
  assert(shortened === '2026-09-14' && JSON.stringify(builderStart(shortened, [sep7], rotations, members, library, weeklyAndrew, sep7.meal_ids)) === JSON.stringify(rotationEntries('rotation-b', members, library, weeklyAndrew)),
    `a cadence shortened into a new week starts from the rotation not just run, not from the cycle it left — Codex r1: the September 7 fortnight shortened on September 15 targets ${shortened}`)
  assert(JSON.stringify(builderStart('2026-09-21', [sep7], rotations, members, library, andrew, sep7.meal_ids)) === JSON.stringify(b.entries), 'the next cycle starts from the rotation the cycle before it did not run')
  assert(builderStart('2026-09-21', [sep7], [], [], library, andrew, sep7.meal_ids) === sep7.meal_ids && builderStart('2026-09-21', [], [], [], library, andrew, null) === null,
    'with no rotations, the builder starts from the selected picks, as it did before rotations')
  const refreshBody = pg11.slice(pg11.indexOf('const refresh = useCallback'), pg11.indexOf('const onSaveHousehold'))
  assert(/loadRotations\(supabase\)\]\)/.test(pg11) && /const err = m\.error \?\? h\.error \?\? active\.error \?\? rot\.error/.test(pg11) && /setRotations\(rot\.rotations\); setMembers\(rot\.members\)/.test(pg11) && refreshBody.length > 0 && !/Rotations/.test(refreshBody),
    'the rotations are loaded once with the library, never by the re-read')
  const st11 = readLF('src/lib/fuel/store.ts')
  assert(/if \(error\) return \{ rotations: \[\], members: \[\], error: isMissingTable\(error\) \? null : error \}/.test(st11) && /from\('fuel_rotations'\)\.select\('slug, name, sort_order, note'\)/.test(st11) && /from\('fuel_rotation_meals'\)\.select\('rotation_slug, meal_slug, week, sort_order'\)/.test(st11),
    'before the rotations migration is applied, Fuel runs as it did: no rotations, and never "not ready"')
  const pb11 = readLF('src/components/fuel/PlanBuilder.tsx')
  assert(/const startFrom = \(slug: string\) => \{ setEntries\(rotationEntries\(slug, members, meals, household\)\); setDrawer\(null\) \}/.test(pb11) && /onClick=\{\(\) => startFrom\(r\.slug\)\}/.test(pb11),
    'the switcher starts the picks over from a rotation')
  assert(/const current = useMemo\(\(\) => rotationOf\(entries, rotations, members\), \[entries, rotations, members\]\)/.test(pb11) && /\{rotationName \? `started from \$\{rotationName\}` : 'your own picks'\}/.test(pb11) && /\.filter\(\(r\) => r\.slug !== current\)/.test(pb11) && /\{rotations\.length > 1 && \(/.test(pb11) && !/useState<string/.test(pb11),
    'the switcher shows which rotation the picks are, read from the picks, with no rotation state beside them')
  // acceptance 6: ticks persist on reload exactly as FOR-177 shipped them
  for (const f of ['src/components/fuel/Checklist.tsx', 'src/lib/fuel/ticks.ts', 'supabase/migrations/20260916_fuel_tick_superseded_guard.sql']) {
    assert(!/rotation/i.test(readLF(f)), `${f} is untouched by rotations — ticks persist on reload as they shipped`)
  }
}

// ── 12. inventory speaks the library's vocabulary (FOR-239) ─────────────────
// L1 never worked in production: inventory was a write-in matched by exact
// string, so Andrew's rows deducted nothing and nothing said so. Reproduced
// here FIRST, as he typed them on the live site on 2026-09-15.
{
  const typed = [{ item: 'chicken thighs', qty: 8, unit: 'lb' }, { item: 'chicken breast', qty: 5, unit: 'lb' }, { item: 'ground beef', qty: 4, unit: 'lb' }]
  const asTyped = buildShoppingList({ ...andrew, inventory: typed }, meals, fortnight)
  assert(find(asTyped, 'chicken thigh, boneless skinless')?.qty === 96 && find(asTyped, 'chicken breast, boneless skinless')?.qty === 26,
    `a row that names no library item deducts nothing — no guessing — got thighs ${find(asTyped, 'chicken thigh, boneless skinless')?.qty}, breast ${find(asTyped, 'chicken breast, boneless skinless')?.qty}`)
  for (const r of typed) {
    assert(asTyped.warnings.some((w) => w.includes(`"${r.item}"`)), `"${r.item}" on hand matches nothing the meals use — the list must say so, not stay silent — warnings were ${JSON.stringify(asTyped.warnings)}`)
  }

  // acceptance 3: the warning names the row and says what to do, and never blocks a build
  const beef = asTyped.warnings.find((w) => w.includes('"ground beef"')) ?? ''
  assert(/no meal uses an ingredient by that name, so nothing comes off the list for it\. In the household, pick the ingredient you mean, or remove it\./.test(beef),
    `the warning tells a person what is wrong and what to do — got "${beef}"`)
  assert(!validatePlan(fortnight, meals, { ...andrew, inventory: typed }).some((w) => /on hand/.test(w)), 'a row on hand that comes off nothing is warned about on the list, never in the plan rules that stop a build')
  const wrongUnit = buildShoppingList({ ...andrew, inventory: [{ item: 'chicken thigh, boneless skinless', qty: 3, unit: 'each' }] }, meals, fortnight)
  assert(find(wrongUnit, 'chicken thigh, boneless skinless')?.qty === 96 && wrongUnit.warnings.some((w) => /"chicken thigh, boneless skinless" is on hand in each, but the meals measure it in oz/.test(w)),
    'an ingredient on hand in a unit the meals never measure it in comes off nothing, and the list says so')
  assert(buildShoppingList(andrew, meals, fortnight).warnings.length === 0 && inventoryIssues([{ item: 'rice', qty: 25, unit: 'lb' }], meals).length === 0,
    'a row that does come off the list raises nothing — 25 lb of rice converts to the cup dry the meals use')
  assert(inventoryIssues(typed, []).length === 0, 'with no library loaded there is nothing to judge a row against, and nothing is reported')

  // acceptance 2: picked from the library, 8 lb of thighs comes off the list
  const picked = buildShoppingList({ ...andrew, inventory: [{ item: 'chicken thigh, boneless skinless', qty: 8, unit: 'lb' }] }, meals, fortnight)
  const thigh = picked.stocked.find((i) => i.item === 'chicken thigh, boneless skinless')
  assert(!!thigh && thigh.qty === 0 && thigh.stocked_reason === '8 lb on hand, 50% counts after meal prep' && !picked.sections.some((s) => s.items.some((i) => i.item === 'chicken thigh, boneless skinless')) && picked.warnings.length === 0,
    `8 lb of chicken thigh, boneless skinless removes the thigh line: stocked, "8 lb on hand, 50% counts after meal prep" — got ${JSON.stringify(thigh)}`)
  // judged on the solver's code, not its comments — which say, correctly, that there is no plural or fuzzy guess
  const solve12 = readLF('src/lib/fuel/solve.ts').split('\n').filter((l) => !/^\s*(\/\/|\/\*\*|\*)/.test(l)).join('\n')
  assert(/if \(norm\(inv\.item\) !== norm\(b\.item\) \|\| inv\.left <= 0\) continue/.test(solve12) && !/singular|plural|levenshtein|startsWith\(norm|includes\(norm\(inv/i.test(solve12),
    'inventory still matches the library EXACTLY — no plural or fuzzy guess that could remove the wrong food')

  // acceptance 1: the picker is the library's vocabulary, grouped by aisle
  const vocab = libraryVocabulary(meals, andrew.store_section_order)
  const everyItem = [...new Set(meals.flatMap((m) => m.ingredients.map((i) => i.item)))].sort((a, b) => a.localeCompare(b))
  assert(JSON.stringify(libraryItems(meals)) === JSON.stringify(everyItem) && JSON.stringify(vocab.flatMap((g) => g.items).sort((a, b) => a.localeCompare(b))) === JSON.stringify(everyItem),
    'the picker offers exactly the ingredients the meals use, every one of them')
  assert(JSON.stringify(vocab.map((g) => g.section)) === JSON.stringify(andrew.store_section_order.filter((s) => vocab.some((g) => g.section === s)))
    && vocab.every((g) => g.items.every((i) => meals.some((m) => m.ingredients.some((x) => x.item === i && x.store_section === g.section)))),
    'the picker is grouped by aisle, in the store order, each ingredient under the aisle it is bought in')
  assert(!libraryItems(meals).includes('chicken thighs') && !libraryItems(meals).includes('ground beef'), "Andrew's typed names are not in the vocabulary — the picker cannot produce them")
  const intake = readLF('src/components/fuel/IntakeForm.tsx')
  assert(!/<input value=\{newItem\.item\}/.test(intake) && /<IngredientSelect vocabulary=\{vocabulary\} value=\{newItem\.item\} label="inventory item" onPick=/.test(intake)
    && /onChange=\{\(e\) => \{ if \(e\.target\.value\) onPick\(e\.target\.value\) \}\}/.test(intake) && /<option value="" disabled>pick an ingredient<\/option>/.test(intake),
    'the item on hand is picked from the vocabulary — there is no free-text item')
  assert(/disabled=\{!known\.has\(newItem\.item\) \|\| newItem\.qty <= 0\}/.test(intake), 'nothing outside the vocabulary can be added')
  assert(/const vocabulary = useMemo\(\(\) => libraryVocabulary\(meals, h\.store_section_order\), \[meals, h\.store_section_order\]\)/.test(intake) && /<optgroup key=\{g\.section\} label=\{g\.section\.toLowerCase\(\)\}>/.test(intake),
    'the intake picker is the library vocabulary, grouped by aisle')
  assert(/>only ingredients your meals use can come off the list\{/.test(intake), 'the intake says why an item is missing from the picker')

  // acceptance 4: rows that match nothing render unresolved, with a one-tap re-pick — never dropped, never re-mapped
  assert(/const issues = useMemo\(\(\) => new Map\(inventoryIssues\(h\.inventory, meals\)\.map/.test(intake) && /\$\{issue \? 'line-through text-muted-foreground' : ''\}/.test(intake)
    && /not an ingredient your meals use, so this comes off nothing/.test(intake),
    'a stored row that matches nothing renders unresolved, not as working')
  assert(/onPick=\{\(item\) => repick\(i, item\)\}/.test(intake) && /j === index \? \{ \.\.\.inv, item \} : inv/.test(intake), 'an unresolved row has a one-tap re-pick of the ingredient')
  const pg12 = readLF('src/app/fuel/page.tsx')
  assert(/const onHandWarnings = household \? inventoryWarnings\(household\.inventory, meals\) : \[\]/.test(pg12) && /\{step !== 'intake' && onHandWarnings\.length > 0 && \(/.test(pg12) && /fix what is on hand/.test(pg12),
    'a row on hand that comes off nothing is seen on the nights and the list, with the way to fix it')
  const runAll12 = readLF('scripts/checks/run-all.mjs')
  assert(/\['fuel vocabulary \(FOR-239\)', 'fuel-vocabulary\.mjs'\]/.test(runAll12) && existsSync(join(ROOT, 'scripts/checks/fuel-vocabulary.mjs')), 'the picker grouping invariant is registered as its own suite')
}

// ── 13. the nights planner (FOR-241): the rotation fills the fortnight, the athlete reviews it ──
// Presentation plus prefill. The planner is RENDERED here — the real component,
// to static markup — so "both weeks visible", "eight nights already filled" and
// "no underscore or solver identifier on screen" are asserted on what it
// renders, not only on its source. The honest limit, stated where the checks
// are: none of this measures whether a person understands the screen. The
// acceptance test is Andrew opening it and understanding it unaided.
{
  const rot = JSON.parse(readLF('fixtures/fuel-seed-rotation-b.json'))
  const library = [...meals, ...rot.fuel_meals_new]
  const lib = (s) => library.find((m) => m.slug === s)
  const rotations = rot.fuel_rotations
  const members = rot.fuel_rotation_meals
  const decode = (s) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  const paint = (el) => {
    const html = renderToStaticMarkup(el)
    const text = decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
    const attrs = [...html.matchAll(/(?:aria-label|title|placeholder|alt)="([^"]*)"/g)].map((m) => decode(m[1]))
    return { html, text, attrs }
  }
  const builder = (props) => paint(createElement(PlanBuilder, { household: andrew, meals: library, initial: null, building: false, onBuild: () => {}, rotations, members, ...props }))
  const section = (html, label) => { const at = html.indexOf(`aria-label="${label}"`); return at < 0 ? '' : html.slice(at, html.indexOf('</section>', at)) }
  const nightsOf = (html) => [...html.matchAll(/aria-label="remove ([^"]+)"/g)].map((m) => decode(m[1]))
  const rowFor = (html, name) => { const at = html.indexOf(`aria-label="remove ${name}"`); return at < 0 ? '' : decode(html.slice(html.lastIndexOf('<li', at), html.indexOf('</li>', at))) }
  const nameOf = (slug) => lib(slug).name.toLowerCase()

  // acceptance 1: an empty plan for rotation B opens with eight nights already filled, four a week, exactly the rotation
  const sep7 = { week_start: '2026-09-07', version: 1, meal_ids: rotationEntries('rotation-a', members, library, andrew) }
  const prefill = builderStart('2026-09-21', [sep7], rotations, members, library, andrew, null)
  const bPairs = members.filter((x) => x.rotation_slug === 'rotation-b').map((x) => `${x.week}:${x.meal_slug}`).sort()
  assert(JSON.stringify(prefill.map((e) => `${e.week}:${e.slug}`).sort()) === JSON.stringify(bPairs),
    `an empty plan after rotation A is prefilled with exactly rotation B's eight (slug, week) pairs — got ${prefill.map((e) => `${e.week}:${e.slug}`).join(' ')}`)
  const filled = builder({ initial: { entries: prefill } })
  for (const w of [1, 2]) {
    const expected = members.filter((x) => x.rotation_slug === 'rotation-b' && x.week === w).sort((a, b) => a.sort_order - b.sort_order).map((x) => nameOf(x.meal_slug))
    const shown = nightsOf(section(filled.html, `week ${w}`))
    assert(JSON.stringify(shown) === JSON.stringify(expected), `week ${w} renders its four rotation-B nights, in the rotation's order, on first render — got ${shown.join(' | ')}`)
  }

  // acceptance 2: both weeks are visible without interaction
  const pb13 = readLF('src/components/fuel/PlanBuilder.tsx')
  assert(section(filled.html, 'week 1').length > 0 && section(filled.html, 'week 2').length > 0 && !/setWeek|aria-pressed=\{week === w\}/.test(pb13),
    'both weeks render at once, on first render — there is no week toggle')
  const weeklyHousehold = { ...andrew, shop_cadence_days: 7 }
  const weekly = builder({ household: weeklyHousehold, initial: { entries: rotationEntries('rotation-b', members, library, weeklyHousehold) } })
  assert(section(weekly.html, 'this week').length > 0 && section(weekly.html, 'week 2') === '', 'a weekly shop renders its one week')

  // what the screen is, in plain words
  assert(/your dinners for the next two weeks/.test(filled.text) && /goes on your shopping list/.test(filled.text), 'the planner says what it is and what it produces, in plain words')

  // a night the rotation chose and a night the athlete picked are told apart
  const swappedIn = swapNight(prefill, prefill.findIndex((e) => e.slug === 'jerk-thighs'), lib('garlic-herb-thighs'), andrew, maxServings(andrew))
  const mixed = builder({ initial: { entries: swappedIn } })
  assert(/from fortnight two/.test(rowFor(mixed.html, nameOf('miso-ginger-salmon'))) && !/your pick/.test(rowFor(mixed.html, nameOf('miso-ginger-salmon'))) && /your pick/.test(rowFor(mixed.html, nameOf('garlic-herb-thighs'))),
    'a night the rotation chose says so, and a night the athlete picked says so — the screen never implies he decided what he did not')

  // acceptance 3: every night carries swap and remove; the library opens only to swap or add
  const every = nightsOf(filled.html)
  assert(every.length === 8 && every.every((n) => filled.attrs.includes(`swap ${n}`)) && !/aria-label="the library"/.test(filled.html),
    'every night carries its own swap and remove, and the library is closed until one is used')
  assert(/onClick=\{\(\) => setDrawer\(\{ swap: i \}\)\}/.test(pb13) && /onClick=\{\(\) => \{ setEntries\(removeNight\(entries, i\)\); setDrawer\(null\) \}\}/.test(pb13) && /onClick=\{\(\) => setDrawer\(\{ add: w \}\)\}/.test(pb13) && /\{drawer && \(/.test(pb13),
    'swap and add open the library for that night or that week; remove acts in one tap')
  const swapAt = prefill.findIndex((e) => e.slug === 'tandoori-breast')
  const swapped = swapNight(prefill, swapAt, lib('soy-ginger-stirfry'), andrew, maxServings(andrew))
  assert(swapped.length === 8 && swapped[swapAt].slug === 'soy-ginger-stirfry' && swapped[swapAt].week === 2 && swapped.every((e, i) => i === swapAt || e === prefill[i]),
    'a swap replaces that one night with the new meal, in the same week, and touches no other night')
  assert(removeNight(prefill, 0).length === 7 && removeNight(prefill, 0)[0] === prefill[1], 'a remove takes that one night out')
  const tightCap = { ...andrew, cook_cap_minutes: 12 }
  const overCap = [{ slug: 'turkey-meatballs', week: 2, servings: 3 }]
  assert(removeNight(overCap, 0).length === 0 && swapNight(prefill, 0, lib('turkey-meatballs'), tightCap, 8) === prefill && addNight([], lib('turkey-meatballs'), 1, tightCap, 8).length === 0,
    'a night over the cook cap can still be removed, and a meal over the cap cannot be swapped or added in')

  // servings semantics, unchanged
  const twoNights = addNight([{ slug: 'chili-lime-thighs', week: 1, servings: 5 }], lib('chili-lime-thighs'), 1, andrew, maxServings(andrew))
  assert(twoNights.length === 2 && twoNights[1].servings === 5, 'another night of a recipe copies the servings it already has that week')
  const threeNights = [...twoNights, { slug: 'chili-lime-thighs', week: 2, servings: 3 }]
  assert(setServings(threeNights, 'chili-lime-thighs', 1, 6).map((e) => e.servings).join(',') === '6,6,3', 'every night of a repeated recipe in a week shares one servings figure — the control moves them together, and no other week')
  assert(addNight(prefill, lib('lemon-garlic-salmon'), 1, andrew, maxServings(andrew)) === prefill, 'a full week takes no more nights')
  assert(addNight([], lib('chili-lime-thighs'), 1, { ...andrew, people_count: 4 }, maxServings({ people_count: 4 }))[0].servings === defaultServings(lib('chili-lime-thighs'), { people_count: 4 }),
    'a new night starts at what the household needs')
  assert(/Math\.min\(cap, e\.servings \+ 1\)/.test(pb13) && /setEntries\(setServings\(entries, e\.slug, w, Math\.max\(1, e\.servings - 1\)\)\)/.test(pb13), 'the servings control steps between one and the household cap')

  // acceptance 4: rebuilding a saved plan keeps its choices — a non-default servings figure included
  const saved = { week_start: '2026-09-21', version: 2, meal_ids: prefill.map((e, i) => (i === 0 ? { ...e, servings: 5 } : e)) }
  const reopened = builderStart('2026-09-21', [sep7, saved], rotations, members, library, andrew, null)
  const rebuilt = builder({ initial: { entries: reopened } })
  assert(JSON.stringify(reopened) === JSON.stringify(saved.meal_ids) && /<span class="stat-num[^"]*">5<\/span>/.test(rowFor(rebuilt.html, nameOf(saved.meal_ids[0].slug))),
    'rebuilding a saved plan starts from its own nights, and a saved servings figure of 5 is still 5 on screen — never the rotation default')

  // acceptance 5: a rule violation names the night causing it
  const fishTwice = { entries: [...prefill.filter((e) => e.week === 1 && e.slug !== 'greek-turkey-bowl'), { slug: 'lemon-garlic-salmon', week: 1, servings: 2 }, ...prefill.filter((e) => e.week === 2)] }
  const fishWarnings = validatePlan(fishTwice, library, andrew)
  const fishIssues = planIssues(fishWarnings, fishTwice.entries, library)
  const fishAt = fishTwice.entries.flatMap((e, i) => (['miso-ginger-salmon', 'lemon-garlic-salmon'].includes(e.slug) ? [i] : []))
  assert(fishWarnings.some((w) => /fish nights/.test(w)) && fishIssues.nights.size === 2 && fishAt.every((i) => (fishIssues.nights.get(i) ?? []).some((x) => /^2 fish nights in week 1 — the rule is 1 a week$/.test(x))),
    'two fish nights in one week flag both fish nights, and only them')
  const fishScreen = builder({ initial: fishTwice })
  assert(/2 fish nights in week 1/.test(rowFor(fishScreen.html, nameOf('lemon-garlic-salmon'))) && !/fish nights/.test(rowFor(fishScreen.html, nameOf('cast-iron-ribeye'))),
    'the rule renders on the night at fault, not in a block above a dead button')
  assert(/fix the flagged nights to build the list/.test(fishScreen.text) && /add 1 more night to build the list/.test(builder({ initial: { entries: prefill.slice(1) } }).text), 'a blocked build says why in its own label')

  // every warning validatePlan speaks is placed, and none leaks an id
  const noProtein = library.map((m) => (m.slug === 'jerk-thighs' ? { ...m, protein_g_per_person: null } : m))
  const week1 = fishTwice.entries.filter((e) => e.week === 1)
  const week2 = fishTwice.entries.filter((e) => e.week === 2)
  const battery = [
    { plan: fishTwice, household: andrew, meals: library },
    { plan: { entries: [...week1.slice(0, 3), { slug: 'turkey-burgers', week: 1, servings: 3 }, { slug: 'greek-turkey-bowl', week: 1, servings: 3 }, ...week2] }, household: andrew, meals: library },
    { plan: { entries: [{ slug: 'chili-lime-thighs', week: 1, servings: 1 }] }, household: andrew, meals: library },
    { plan: { entries: prefill }, household: tightCap, meals: library },
    { plan: { entries: prefill }, household: weeklyHousehold, meals: library },
    { plan: { entries: [...prefill, { slug: 'cast-iron-ribeye', week: 2, servings: 2 }] }, household: andrew, meals: library },
    { plan: { entries: prefill }, household: andrew, meals: library, cycles: { history: [{ week_start: '2026-09-07', version: 1, meal_ids: [{ slug: 'cast-iron-ribeye', week: 1, servings: 2 }, { slug: 'cast-iron-ribeye', week: 2, servings: 2 }], rules_snapshot: { shop_cadence_days: 14 } }], targetStart: '2026-09-21', cadenceDays: 14 } },
    { plan: { entries: prefill }, household: andrew, meals: library, cycles: { history: [{ week_start: '2026-09-28', version: 1, meal_ids: [], rules_snapshot: { shop_cadence_days: 7 } }], targetStart: '2026-09-21', cadenceDays: 14 } },
    { plan: { entries: prefill }, household: andrew, meals: noProtein },
    { plan: { entries: [...prefill.slice(0, 7), { slug: 'no-such-meal', week: 2, servings: 2 }] }, household: andrew, meals: library },
  ]
  const wordings = new Set()
  for (const b of battery) {
    const ws = validatePlan(b.plan, b.meals, b.household, b.cycles ? { cycles: b.cycles } : {})
    for (const w of ws) {
      wordings.add(w.replace(/^[a-z0-9-]+: /, 'id: ').replace(/\d+/g, '#'))
      assert(isKnownWarning(w), `the planner places every warning validatePlan speaks — this one it does not know: "${w}"`)
    }
    const iss = planIssues(ws, b.plan.entries, b.meals)
    const shown = [...[...iss.nights.values()].flat(), ...[...iss.weeks.values()].flat(), ...iss.plan]
    assert(ws.length === 0 || shown.length >= ws.length, `every warning is placed somewhere — ${ws.length} warnings, ${shown.length} placed`)
    for (const s of [...shown, ...planIssueSentences(ws, b.plan.entries, b.meals)]) {
      assert(!/_/.test(s) && !b.meals.some((m) => s.includes(m.slug)) && !s.includes('no-such-meal'), `no issue shown to a person carries an underscore or a meal id — "${s}"`)
    }
  }
  assert(wordings.size >= 11, `the battery drives every rule wording validatePlan has — ${wordings.size} distinct: ${[...wordings].join(' / ')}`)
  const unknown = planIssues(['greek-turkey-bowl: something the solver has not said before'], [{ slug: 'greek-turkey-bowl', week: 1, servings: 3 }], library)
  assert(unknown.plan.length === 1 && !/greek-turkey-bowl/.test(unknown.plan[0]) && /greek turkey rice bowl/.test(unknown.plan[0]),
    `a warning in a wording the planner does not know is still shown, with the meal named, not its id — got "${unknown.plan[0]}"`)

  // acceptance 6: no rendered string — text or label — carries an underscore or a solver identifier
  const library13 = paint(createElement(LibraryDrawer, { meals: library, household: tightCap, heading: 'swap this night for', onPick: () => {}, onClose: () => {} }))
  const screens = [filled, mixed, rebuilt, fishScreen, weekly, library13, builder({ initial: { entries: prefill }, household: tightCap }), builder({ initial: { entries: [...prefill.slice(0, 7), { slug: 'no-such-meal', week: 2, servings: 2 }] } })]
  const ids = [...library.map((m) => m.slug), ...rotations.map((r) => r.slug), 'no-such-meal']
  screens.forEach((s, n) => {
    const bad = [s.text, ...s.attrs].flatMap((x) => [...(/_/.test(x) ? ['an underscore'] : []), ...ids.filter((id) => x.includes(id))])
    assert(bad.length === 0, `screen ${n + 1}: no rendered string carries an underscore or a solver identifier — found ${[...new Set(bad)].join(', ')}`)
  })

  // one volt control: the build button
  const withRoom = builder({ initial: { entries: prefill.slice(1) } })
  assert(/add a night to week 1/.test(withRoom.text) && [filled, fishScreen, withRoom].every((s) => (s.html.match(/pill-volt/g) || []).length === 1) && !/pill-volt/.test(library13.html) && /build the shopping list/.test(filled.text),
    'the build button is the one volt control on the planner — with a week full, with a week that has room, and in the library')
  const pg13 = readLF('src/app/fuel/page.tsx')
  assert(!/step === s \? 'pill-volt'/.test(pg13) && /aria-current=\{step === s \? 'step' : undefined\}/.test(pg13), "the page's step nav is quiet, so the planner's one volt control is the build")
  assert(/if \(late\.length\) \{ setError\(planIssueSentences\(late, p\.entries, meals\)\.join\(' · '\)\); return \}/.test(pg13), 'a plan refused at build time is explained in words that name the night, not in rule ids')
}

// ── 14. the athlete's own items (FOR-240): merged when a version is created, so regeneration cannot delete them ──
// THE failure the ticket exists to prevent, as a check that can see it: a
// staple on the list, the plan regenerated, the staple still there. Written
// and run RED against the shipped createVersion — which wrote solver output
// only, so anything else on the list was deleted by the next version — before
// the merge existed. What a regeneration writes is captured at the one call
// that writes it: fuel_create_version's p_items.
const regenerate = async (staples) => {
  const calls = []
  const db = { rpc: async (fn, args) => { calls.push({ fn, args }); return { data: { plan_id: 'plan-v2', list_id: 'list-v2', version: 2, updated_at: '2026-09-21T12:00:00Z' }, error: null } } }
  const res = await createVersion(db, '2026-09-21', andrew, meals, fortnight, true, staples)
  return { items: calls.find((c) => /^fuel_create_version/.test(c.fn))?.args?.p_items ?? [], list: res.list }
}
const customLines = (items) => items.filter((i) => typeof i.key === 'string' && i.key.startsWith('custom~'))
{
  const coffee = { id: '6f1c2d3e-0000-4000-8000-00000000c0ff', item: 'coffee', store_section: 'Pantry' }
  const riceStaple = { id: '6f1c2d3e-0000-4000-8000-0000000071ce', item: 'rice', store_section: 'Pantry' }
  const first = await regenerate([coffee, riceStaple])
  // acceptance 1, the half that shipped broken: a staple survives regeneration
  assert(customLines(first.items).map((i) => i.item).sort().join() === 'coffee,rice',
    `a staple survives regeneration — the list a new version writes carries every staple; got ${customLines(first.items).map((i) => i.item).join() || 'no custom line at all'}`)
  assert(!!first.list && customLines(first.list.items).length === 2, 'the list the page holds after a build is the list the database was given — staples included')
  // acceptance 5: a second regeneration does not duplicate a staple
  const again = await regenerate([coffee, riceStaple])
  assert(customLines(again.items).filter((i) => i.item === 'coffee').length === 1 && customLines(again.items).length === 2,
    `regenerating a second time does not duplicate a staple — got ${customLines(again.items).length} custom lines`)
  // acceptance 4: a custom item named like a solver line is its own line
  const rices = first.items.filter((i) => i.item === 'rice')
  assert(rices.length === 2 && new Set(rices.map((i) => i.key)).size === 2 && rices.some((i) => !i.key.startsWith('custom~')),
    `a custom item named like a solver line is a second line, never merged into it — got ${rices.length} rice line(s)`)
  // acceptance 1, the other half: a one-off belonged to the list it was added to — nothing carries it into a new version
  assert(customLines(first.items).every((i) => i.custom === 'staple'), 'a one-off is not carried into a new version — only staples are merged')
}

// the merge, the aisles, the tick, the shortcut — and the rest of the acceptance criteria, as behaviour
{
  const solver = buildShoppingList(andrew, meals, fortnight).items
  const coffee = { id: 'c0ffee00-0000-4000-8000-000000000001', item: 'coffee', store_section: 'Snacks' }
  const coffeeKey = customKey(coffee.id)
  const candles = customLine('0ff0ff00-0000-4000-8000-000000000002', 'birthday candles', 'Pantry', 'one-off')
  const merged = withStaples(solver, [coffee])
  assert(customLines(withStaples(merged, [coffee])).length === 1 && withStaples(merged, [coffee]).length === merged.length,
    "a list that already carries its staples, merged again, carries each once — the merge starts from the solver's lines, never from a stored list")
  assert(!withStaples([...merged, candles], [coffee]).some((l) => l.key === candles.key), 'a one-off on the old list is not carried into the new one')
  assert(withStaples(solver, [coffee, coffee]).filter((l) => l.key === coffeeKey).length === 1, 'the same staple twice is one line')
  // acceptance 3: in its aisle, in aisle order with everything else
  const secs14 = sectionsInOrder([...merged.filter((l) => !l.second_trip && !l.stocked), candles], andrew.store_section_order)
  const names14s = secs14.map((s) => s.section)
  const rank14 = (s) => { const i = andrew.store_section_order.indexOf(s); return i < 0 ? 99 : i }
  assert(new Set(names14s).size === names14s.length && names14s.every((s, i) => i === 0 || rank14(names14s[i - 1]) <= rank14(s)),
    `the aisles are walked once each, in the household's order — got ${names14s.join(' → ')}`)
  const snacks14 = secs14.find((s) => s.section === 'Snacks'), pantry14 = secs14.find((s) => s.section === 'Pantry')
  assert(!!snacks14 && snacks14.items.some((l) => l.key === coffeeKey) && !!pantry14 && pantry14.items[pantry14.items.length - 1].key === candles.key && pantry14.items.slice(0, -1).every((l) => !isCustom(l)),
    "coffee lands in Snacks and the candles in Pantry — each in its aisle, after the solver's lines there")
  // acceptance 2: a tick on a custom line is a tick like any other
  const ticked14 = merged.map((l) => (l.key === coffeeKey ? { ...l, checked: true } : l))
  const shown14 = render(ticked14, [], new Set()).find((l) => l.key === coffeeKey)
  assert(shown14?.shown === true && shown14.save === 'saved' && reconcile(ticked14, [{ key: coffeeKey, checked: true, at: 1 }]).outbox.length === 0,
    'a custom line re-read from the row shows its tick saved, and the re-read settles its intent — the reload path, unchanged')
  assert(progress(ticked14).total === progress(solver).total + 1 && progress(ticked14).done === 1, 'a custom line counts toward the list like any line to buy')
  // the shortcut compares the solver's lines
  assert(listUnchanged(solver, merged) && listUnchanged(solver, [...merged, candles]) && !listUnchanged(solver.slice(1), merged) && solverLines(merged).length === solver.length,
    "a list with the athlete's lines on it is the same list to the regeneration shortcut — and a changed solve is still a changed list")
  assert(defaultSection(andrew.store_section_order) === 'Pantry' && defaultSection(['Produce', 'Frozen']) === 'Frozen', 'a new item defaults to Pantry, or to the last aisle when there is none — never guessed from its name')

  // the checklist, rendered
  const listProps = { listId: 'list-v2', version: 2, versions: [1, 2], items: [...merged, candles], sectionOrder: andrew.store_section_order, onRowItems: () => {}, send: async () => null, refetch: async () => null, onRegenerate: () => {} }
  const listHtml = renderToStaticMarkup(createElement(Checklist, { ...listProps, onRemoveCustom: () => {}, onStopStaple: () => {} }))
  const rowOf = (html, item) => (html.match(new RegExp(`<li[^>]*>(?:(?!<li[ >]).)*?>${item}<(?:(?!<li[ >]).)*?</li>`, 's')) || [])[0] || ''
  assert((listHtml.match(/eyebrow-mono px-1 mb-1">pantry · /g) || []).length === 1 && (listHtml.match(/eyebrow-mono px-1 mb-1">snacks · /g) || []).length === 1,
    'the rendered list has one Pantry and one Snacks — a custom line never opens a second aisle')
  const coffeeRow = rowOf(listHtml, 'coffee'), candlesRow = rowOf(listHtml, 'birthday candles'), broccoliRow = rowOf(listHtml, 'broccoli')
  assert(!!coffeeRow && !/data-mono/.test(coffeeRow) && /every list/.test(coffeeRow) && /aria-label="stop coffee — off this list and every new list"[^>]*>stop</.test(coffeeRow) && !/take coffee off this list/.test(coffeeRow),
    'a staple is drawn as a line to tick, marked every list, with no quantity — and stopped in one tap from its line')
  assert(!!candlesRow && /this list/.test(candlesRow) && !/data-mono/.test(candlesRow) && /aria-label="take birthday candles off this list"/.test(candlesRow) && !/>stop</.test(candlesRow), 'a one-off is marked this list, with no quantity, and removed — not stopped — from its line')
  assert(!!broccoliRow && /data-mono/.test(broccoliRow) && !/off this list/.test(broccoliRow), "a solver line keeps its quantity and has no remove — the solver decides those")
  const bareList = renderToStaticMarkup(createElement(Checklist, listProps))
  assert(!/off this list/.test(bareList) && !/>stop</.test(bareList), 'no remove control until the custom-items migration is applied — and no stop')

  // the add form, rendered
  const addHtml = renderToStaticMarkup(createElement(AddItem, { sectionOrder: andrew.store_section_order, staples: [coffee], busy: false, onAdd: async () => null, onStopStaple: () => {} }))
  assert(/<input[^>]*aria-label="what to buy"/.test(addHtml) && !/<select[^>]*aria-label="what to buy"/.test(addHtml), 'the item is free text — the solver has never heard of it, so nothing tries to match it')
  assert(/<option value="Pantry" selected="">/.test(addHtml) && (addHtml.match(/<option /g) || []).length === andrew.store_section_order.length, "the aisle is picked from the household's walk, defaulting to Pantry")
  assert(/aria-pressed="false"[^>]*>every list</.test(addHtml) && /on this list only/.test(addHtml), 'a new item is a one-off unless the athlete says every list')
  assert(/aria-label="stop coffee — off this list and every new list"/.test(addHtml) && /stopping takes it off this list and every new list — lists already built for other weeks keep it/.test(addHtml), 'a staple can be stopped from the list of staples too, and the page says what stopping does')
  assert(!/pill-volt/.test(addHtml) && !/pill-volt/.test(listHtml), 'adding your own is quiet — no volt control on the list screen')

  // wired where it counts
  const pg14 = readLF('src/app/fuel/page.tsx')
  const st14 = readLF('src/lib/fuel/store.ts')
  assert(/const items = withStaples\(list\.items, staples\)\n/.test(st14) && /p_items: items \}\n/.test(st14) && /version: row\.version, items: stored, updated_at/.test(st14) && /THE MERGE \(FOR-240\), stated where it happens/.test(st14),
    'the merge happens in createVersion, stated there, and the list the page holds is the items the database was given')
  assert(/const st = await loadStaples\(supabase, userId\)\n\s+if \(st\.error\) \{ setBusy\(false\); setError\(/.test(pg14) && /createVersion\(supabase, weekStart, household, meals, p, inventoryCounted, st\.staples\)/.test(pg14)
    && pg14.indexOf('const st = await loadStaples(supabase, userId)') < pg14.indexOf('const res = await createVersion('),
    'a build reads the staples at build time, and builds nothing when that read fails — a staple silently missing is the deletion this exists to stop')
  assert(/if \(error\) return \{ staples: \[\], available: false, error: isMissingTable\(error\) \? null : error \}/.test(st14), 'before the migration is applied: no staples, no add form, and never "not ready"')
  assert(/db\.rpc\('fuel_add_custom_item'/.test(st14) && /db\.rpc\('fuel_remove_custom_item'/.test(st14) && (st14.match(/superseded: error\?\.code === SUPERSEDED/g) || []).length === 3,
    'an add and a remove go through guarded database functions and name the refusal, as a tick does')
  assert(/canonical\(solverLines\(items\)\.map/.test(readLF('src/lib/fuel/version.ts')), "the unchanged-plan shortcut compares the solver's lines")
  assert(/\{customReady && \(\n\s+<AddItem /.test(pg14) && /onRemoveCustom=\{customReady \? /.test(pg14) && /sectionOrder=\{sectionOrder\}/.test(pg14),
    'the add form and the remove control appear only once the migration is applied, and the list is walked in its own aisle order')

  // the migration: one table, two functions, the same guard
  const cmig = readLF('supabase/migrations/20260918_fuel_custom_items.sql')
  assert(/CREATE TABLE IF NOT EXISTS public\.fuel_staples \(/.test(cmig) && /ALTER TABLE public\.fuel_staples ENABLE ROW LEVEL SECURITY/.test(cmig)
    && /CREATE TRIGGER fuel_staples_pro_gate BEFORE INSERT OR UPDATE ON public\.fuel_staples\s+FOR EACH ROW EXECUTE FUNCTION public\.enforce_fuel_pro\(\);/.test(cmig),
    'fuel_staples is created with row level security and the Pro gate, in the same migration')
  assert(!/FOR DELETE|FOR ALL/.test(cmig) && /removed_at\s+timestamptz/.test(cmig) && /WHERE removed_at IS NULL/.test(cmig),
    'a staple is stopped with a stamp and never deleted through the app — no delete policy — with one active staple per item per aisle')
  for (const fn of ['fuel_add_custom_item', 'fuel_remove_custom_item']) {
    const body = (cmig.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\([\\s\\S]*?\\$\\$;`)) || [])[0] || ''
    assert(/SECURITY INVOKER/.test(body) && /PERFORM pg_advisory_xact_lock\(hashtext\(auth\.uid\(\)::text \|\| ':' \|\| v_week_start::text\)\)/.test(body) && /newer\.version > p\.version/.test(body)
      && body.indexOf("ERRCODE = 'FU001'") > body.indexOf('PERFORM pg_advisory_xact_lock') && body.lastIndexOf("ERRCODE = 'FU001'") < body.indexOf('UPDATE public.fuel_lists') && /WHERE id = p_list_id AND user_id = auth\.uid\(\)/.test(body),
      `${fn} takes the per-cycle lock, refuses a superseded list with FU001 before it writes, and keeps the owner test`)
    assert(new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${fn}\\([a-z, ]+\\) FROM PUBLIC, anon;`).test(cmig), `anon cannot call ${fn}`)
  }
  assert(/'custom~' \|\| replace\(p_staple_id::text, '-', ''\)/.test(cmig) && /'custom~' \|\| replace\(gen_random_uuid\(\)::text, '-', ''\)/.test(cmig) && customKey('6f1c2d3e-0000-4000-8000-00000000c0ff') === 'custom~6f1c2d3e00004000800000000000c0ff',
    "the database mints custom keys in customKey's shape — the prefix and the uuid's hex, never a colon")
  assert(/p_key !~ '\^custom~\[A-Za-z0-9\]\+\$'/.test(cmig), 'the remove function refuses any key that is not a custom key — a solver line is never removed this way')
  assert(/WHEN EXISTS \(SELECT 1 FROM jsonb_array_elements\(items\) AS e WHERE e->>'key' = v_key\) THEN items/.test(cmig), "a staple's line added twice is one line")
  const names14 = readdirSync(join(ROOT, 'supabase/migrations')).sort()
  assert(names14.indexOf('20260918_fuel_custom_items.sql') > names14.indexOf('20260917_fuel_rotations.sql'), 'the custom-items migration sorts after everything it references')
  assert(!/ALTER TABLE public\.fuel_(meals|household|plans|lists)|DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE|FUNCTION public\.fuel_(set_item_checked|create_version)\(/.test(cmig), 'the migration is additive: nothing existing is altered, dropped or replaced')
  assert(/\['fuel custom keys \(FOR-240\)', 'fuel-custom-keys\.mjs'\]/.test(readLF('scripts/checks/run-all.mjs')) && existsSync(join(ROOT, 'scripts/checks/fuel-custom-keys.mjs')), 'the key invariant is registered as its own suite')
}

// Codex r1 (FOR-240) and Andrew's ruling — answers in order, staples read under the lock, duplicates from the database, one tap to stop
{
  // 1. the athlete's writes wait their turn in the list's queue
  const sendQueuedFn = checklistExports.sendQueued ?? checklistModule.sendQueued
  const published = []
  const slow = sendQueuedFn('list-order', () => new Promise((r) => setTimeout(() => r('tick answered before the add'), 30))).then((v) => published.push(v))
  const quick = sendQueuedFn('list-order', async () => 'the add').then((v) => published.push(v))
  await Promise.all([slow, quick])
  assert(typeof sendQueuedFn === 'function' && published.join(' → ') === 'tick answered before the add → the add',
    `answers on one list are published in the order they were sent, however long each takes — got ${published.join(' → ')}`)
  const pgR1 = readLF('src/app/fuel/page.tsx')
  assert(/import Checklist, \{ sendQueued \} from '\.\.\/\.\.\/components\/fuel\/Checklist'/.test(pgR1) && /await sendQueued\(id, \(\) => addCustomItem\(supabase, id, item, section, stapleId\)\)/.test(pgR1)
    && (pgR1.match(/await sendQueued\(id, \(\) => removeCustomItem\(supabase, id, /g) || []).length === 2 && !/await (addCustomItem|removeCustomItem)\(/.test(pgR1),
    "custom writes wait their turn in the checklist's queue, behind any tick or re-read — an older answer never lands over a newer one")
  // 2. a duplicate staple is found in the database, not in the page's copy
  assert(/if \(s\.duplicate\) \{[\s\S]{0,400}?const fresh = await loadStaples\(supabase, userId\)[\s\S]{0,300}?setStaples\(fresh\.staples\)\n\s+saved = fresh\.staples\.find\(/.test(pgR1) && !/\bstaples\.find\(/.test(pgR1.replace(/fresh\.staples\.find\(/g, '')),
    "a duplicate staple is resolved from the database — one another tab saved is found — never from the page's copy")
  // 3. the version is written through the function that reads the staples under the version lock
  const answered = async (answer) => { const calls = []; const db = { rpc: async (fn, args) => { calls.push(fn); return answer(fn, args) } }; const res = await createVersion(db, '2026-09-21', andrew, meals, fortnight, true, []); return { calls, res } }
  const diapers = customLine('d1a9e700-0000-4000-8000-000000000003', 'diapers', 'Pantry', 'staple')
  const withDb = await answered((fn, args) => ({ data: { plan_id: 'p', list_id: 'l', version: 3, updated_at: 'now', items: [...args.p_items, diapers] }, error: null }))
  assert(withDb.calls.join() === 'fuel_create_version_with_staples' && withDb.res.list?.items[withDb.res.list.items.length - 1]?.key === diapers.key,
    'a version is written through the function that reads the staples under the version lock, and the list the page holds is the one the database stored — a staple saved since the page read is on it')
  const beforeMigration = await answered((fn) => (fn === 'fuel_create_version_with_staples'
    ? { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.fuel_create_version_with_staples' } }
    : { data: { plan_id: 'p', list_id: 'l', version: 3, updated_at: 'now' }, error: null }))
  assert(beforeMigration.calls.join() === 'fuel_create_version_with_staples,fuel_create_version' && !!beforeMigration.res.list && beforeMigration.res.list.items.length === buildShoppingList(andrew, meals, fortnight).items.length,
    'before the migration is applied the version is written as it always was')
  const otherFailure = await answered(() => ({ data: null, error: { code: '40001', message: 'could not serialize access' } }))
  assert(otherFailure.calls.join() === 'fuel_create_version_with_staples' && otherFailure.res.list === null && otherFailure.res.error?.code === '40001',
    'any other failure is reported — never retried around the lock through the function that does not read staples')
  const cmigR1 = readLF('supabase/migrations/20260918_fuel_custom_items.sql')
  const ws = (cmigR1.match(/CREATE OR REPLACE FUNCTION public\.fuel_create_version_with_staples\([\s\S]*?\$\$;/) || [])[0] || ''
  assert(/SECURITY INVOKER/.test(ws) && /PERFORM pg_advisory_xact_lock\(hashtext\(auth\.uid\(\)::text \|\| ':' \|\| p_week_start::text\)\)/.test(ws) && ws.indexOf('PERFORM pg_advisory_xact_lock') > -1 && ws.indexOf('PERFORM pg_advisory_xact_lock') < ws.indexOf('FROM public.fuel_staples'),
    'fuel_create_version_with_staples reads the staples under the version lock — taken before the read, not after')
  assert(/  WHERE s\.user_id = auth\.uid\(\) AND s\.removed_at IS NULL\n/.test(ws), "it merges only the staples still on, and only the athlete's own")
  assert(/AND NOT EXISTS \(SELECT 1 FROM jsonb_array_elements\(COALESCE\(p_items, '\[\]'::jsonb\)\) AS e WHERE e->>'key' = 'custom~' \|\| replace\(s\.id::text, '-', ''\)\)/.test(ws), 'it appends only the staples whose line the client did not send — each staple once')
  assert(/RETURN public\.fuel_create_version\(p_week_start, p_meal_ids, p_rules_snapshot, v_items\) \|\| jsonb_build_object\('items', v_items\)/.test(ws) && /REVOKE EXECUTE ON FUNCTION public\.fuel_create_version_with_staples\(date, jsonb, jsonb, jsonb\) FROM PUBLIC, anon;/.test(cmigR1),
    'it writes through fuel_create_version unchanged, answers the items it stored, and anon cannot call it')
  // 4. Andrew's ruling: a staple is stoppable in ONE tap, from the list, where it can be seen
  const idR1 = '6f1c2d3e-0000-4000-8000-00000000c0ff'
  assert(stapleIdFromKey(customKey(idR1)) === idR1 && stapleIdFromKey('Pantry:rice:cup dry') === null && stapleIdFromKey('custom~abc') === null, "a staple line's key leads back to its staple, and nothing else does")
  const clR1 = readLF('src/components/fuel/Checklist.tsx')
  assert(/\{i\.custom === 'staple' && onStopStaple && \(\n\s+<button type="button" onClick=\{\(\) => onStopStaple\(i\.key\)\}/.test(clR1), 'the stop on a staple line is one button, one tap, on the line itself')
  assert(/const onStopStaple = async \(stapleId: string\) => \{/.test(pgR1) && pgR1.indexOf('await stopStaple(supabase, userId, stapleId)') > -1
    && pgR1.indexOf('await stopStaple(supabase, userId, stapleId)') < pgR1.indexOf('await sendQueued(id, () => removeCustomItem(supabase, id, customKey(stapleId)))') && /onStopStaple=\{customReady \? onStopStapleLine : undefined\}/.test(pgR1),
    'one tap stops the staple for every new list and then takes its line off this list, through the queue; before the migration there is no stop')
}

if (failures) { console.log(`\nfuel-solve: ${failures} of ${failures + passes} checks FAILED`); process.exit(1) }
console.log(`fuel-solve: ${passes} checks passed — rows in, list out, the row owns the ticks`)
