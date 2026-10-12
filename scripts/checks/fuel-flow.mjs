// ── Fuel: one guided flow (FOR-281) — a standing check, its own file ────────
// Kept apart from fuel-solve.mjs on purpose: a revert of the flow must not take
// the check that would catch the revert with it. What it holds:
//   1. a "have it" tick is a row on hand that covers ONE line, by its key, and
//      the solver — unchanged for every row that is not a tick — is still the
//      only thing that makes a list
//   2. step 2's edits, as rows: a tap covers, a second tap puts the line back
//      exactly, "have some" is real stock in the line's unit, and saved stock
//      opens ticked only when it counts without asking (inventory_counted's
//      rule, FOR-177 rounds 15 to 18)
//   3. the guards still read the one inventory: the snapshot carries the rows,
//      a changed row is a changed household, and a tick is never an "issue"
//   4. the three screens, RENDERED: the menu is a card with its dinners and one
//      volt control; step 2 is the draft list with a tap per line, a quantity
//      box up front on meat and seafood, and no search and no picker
//   5. no string a person reads says fortnight, rotation or cycle — on every
//      screen rendered, in every rule sentence, and in the page's own literals
//   6. the menus carry the plain names, in the fixtures and in the migration
//      that renames them, and the two agree
// The honest limit: none of this measures whether the flow is easier. Andrew
// opening it on a Sunday is that test.
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildShoppingList, householdFor, inventoryIssues, validatePlan, HAVE_IT_REASON, MEAT_SECTION } from '../../src/lib/fuel/solve.ts'
import { changed, listUnchanged, snapshot } from '../../src/lib/fuel/version.ts'
import { rotationEntries, sortedRotations } from '../../src/lib/fuel/rotation.ts'
import { planIssueSentences } from '../../src/lib/fuel/planner.ts'
import { customKey } from '../../src/lib/fuel/custom.ts'
import { clearLine, draftList, draftSignature, haveUnit, lastTime, lineStates, listWith, markHave, putBack, setSome, someQty, startRows, stapleLines } from '../../src/lib/fuel/onhand.ts'
import * as planBuilderModule from '../../src/components/fuel/PlanBuilder.tsx'
import * as haveStepModule from '../../src/components/fuel/HaveStep.tsx'
import * as intakeModule from '../../src/components/fuel/IntakeForm.tsx'
import * as checklistModule from '../../src/components/fuel/Checklist.tsx'

let failures = 0, passes = 0
const assert = (cond, msg) => { if (cond) passes++; else { failures++; console.log('  ✗ ' + msg) } }
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const readLF = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')
const read = (rel) => JSON.parse(readLF(rel))
// A .tsx component imported from this .mjs arrives CommonJS-wrapped under tsx.
const unwrap = (mod) => { const e = mod.default && typeof mod.default === 'object' ? mod.default : mod; return typeof e.default === 'function' ? e.default : mod.default }
const PlanBuilder = unwrap(planBuilderModule), HaveStep = unwrap(haveStepModule), IntakeForm = unwrap(intakeModule), Checklist = unwrap(checklistModule)

const base = read('fixtures/fuel-seed.json')
const rotB = read('fixtures/fuel-seed-rotation-b.json')
const rotC = read('fixtures/fuel-seed-rotation-c.json')
const expansion = read('fixtures/fuel-seed-library-expansion.json')
const meals = [...base.fuel_meals, ...rotB.fuel_meals_new, ...expansion.fuel_meals_new]
const rotations = [...rotB.fuel_rotations, ...rotC.fuel_rotations]
const members = [...rotB.fuel_rotation_meals, ...rotC.fuel_rotation_meals]
const andrew = {
  people_count: 2, nights_per_week: 4, cook_cap_minutes: 30, shop_cadence_days: 14, prep_diversion_pct: 50,
  dietary_rules: { protein_floor_g_per_person: 40, fish_per_week: 1, ground_turkey_per_week: 1, steak_per_month: 2, no_tilapia: true, vegetable_every_night: true, minimal_added_fat: true, frugal_reuse: true },
  inventory: [], store_section_order: base.store_section_order,
}
const plan = { entries: rotationEntries('rotation-a', members, meals, andrew) }
const draft = draftList(andrew, meals, plan)
const solve = (rows) => listWith(andrew, meals, plan, rows)
const line = (pred) => draft.items.find(pred)
const BANNED = /fortnight|rotation|cycle/i

// ── 1. a tick covers one line, and the solver is otherwise what it was ───────
{
  assert(draft.items.length > 10 && draft.stocked.length === 0 && draft.items.every((l) => !l.stocked), 'the draft is the solver with nothing on hand: every line is bought')
  assert(JSON.stringify(draft) === JSON.stringify(buildShoppingList(householdFor({ ...andrew, inventory: [{ item: 'rice', qty: 25, unit: 'lb' }] }, false), meals, plan)), 'the draft ignores what the household has saved — it is the list BEFORE anything comes off')
  const rice = line((l) => l.item === 'rice')
  const ticked = solve(markHave([], rice))
  const gone = ticked.items.find((l) => l.key === rice.key)
  assert(gone.stocked && gone.qty === 0 && gone.stocked_reason === HAVE_IT_REASON, `a ticked line needs no purchase and says why — got ${JSON.stringify(gone)}`)
  assert(ticked.items.filter((l) => l.key !== rice.key).every((l) => { const d = draft.items.find((x) => x.key === l.key); return d && d.qty === l.qty && !l.stocked }), 'a tick changes its own line and no other')
  assert(ticked.items.length === draft.items.length, 'a ticked line is still LISTED, as stocked — never silently dropped (L1)')
  const everything = solve(draft.items.reduce((rows, l) => markHave(rows, l), []))
  assert(everything.items.every((l) => l.stocked && l.qty === 0) && everything.sections.length === 0 && everything.second_trip.length === 0, 'every line ticked leaves nothing to buy — no rounding leaves a sliver of a line behind')
  // the same ingredient on two trips: a tick on the second trip's line does not take the main shop's
  const twice = draft.items.filter((l) => draft.items.some((o) => o !== l && o.item === l.item && o.unit === l.unit && o.second_trip !== l.second_trip))
  assert(twice.length >= 2, `the menu buys something on both trips, so the tick's reach can be judged — ${twice.map((l) => l.key).join(', ')}`)
  const late = twice.find((l) => l.second_trip), early = twice.find((l) => !l.second_trip && l.item === late.item)
  const onlyLate = solve(markHave([], late))
  assert(onlyLate.items.find((l) => l.key === late.key).stocked && !onlyLate.items.find((l) => l.key === early.key).stocked && onlyLate.items.find((l) => l.key === early.key).qty === early.qty,
    'a tick on the second-trip line covers that line, and the main shop still buys its own — a tick is by key, never by name')
  // Codex r7: "have it" includes the stock already counted for that line — it is spent there first, and never comes off the next line too
  const partStock = [{ item: early.item, qty: early.qty / 2, unit: early.unit }]
  const stockAndTick = solve([...markHave([], early), ...partStock])
  assert(stockAndTick.items.find((l) => l.key === early.key).stocked && stockAndTick.items.find((l) => l.key === late.key).qty === late.qty,
    'a ticked line uses up the stock on hand for it first: the half already in the kitchen is not counted again against the second trip')
  assert(solve(partStock).items.find((l) => l.key === late.key).qty === late.qty && solve([...markHave([], early), { item: early.item, qty: early.qty + late.qty, unit: early.unit }]).items.find((l) => l.key === late.key).stocked,
    'and stock beyond what the ticked line needs still goes on to the next line')
  // rows that are not ticks solve exactly as they did before the field existed
  const stock = [{ item: 'rice', qty: 1, unit: 'lb' }, { item: 'broccoli', qty: 10, unit: 'oz' }, { item: 'chicken thigh, boneless skinless', qty: 4, unit: 'lb' }]
  const src = readLF('src/lib/fuel/solve.ts')
  assert(/const tick = inventory\.find\(\(inv\) => inv\.covers === key\)/.test(src) &&/for \(const inv of inventory\) \{\n\s+if \(inv\.covers !== undefined\) continue\n\s+if \(norm\(inv\.item\) !== norm\(b\.item\) \|\| inv\.left <= 0\) continue/.test(src) && /qty = round\(qty\) <= tick\.qty \? 0 : qty - tick\.qty/.test(src),
    'the subtraction loop is the one it was, run on every line, and a tick covers only what the stock left')
  assert(solve(stock).items.some((l) => l.item === 'rice' && l.qty < rice.qty && !l.stocked), 'plain stock still subtracts by quantity')
}

// ── 2. step 2's edits, as rows ──────────────────────────────────────────────
{
  const thigh = line((l) => l.section === MEAT_SECTION && /thigh/.test(l.item))
  const onion = line((l) => l.section !== MEAT_SECTION && !l.second_trip)
  // tap, tap: the second tap is an undo
  const tapped = markHave([], onion)
  assert(tapped.length === 1 && tapped[0].covers === onion.key && tapped[0].item === onion.item && tapped[0].qty === onion.qty && tapped[0].unit === onion.unit, 'a tap is one row on hand, covering that line, in the line\'s own quantity and unit')
  assert(markHave(tapped, onion).length === 1, 'tapping a covered line twice through markHave never doubles its row')
  assert(JSON.stringify(solve(putBack(tapped, onion))) === JSON.stringify(draft), 'a second tap puts the line back: the list is the draft again')
  // Codex r13: a tick made over stock records only THE REST, so the stock is not counted twice the day the line grows
  {
    const pound = setSome([], thigh, 1)
    const left = lineStates(draft.items, solve(pound)).get(thigh.key).buying
    const both = markHave(pound, thigh, left)
    const big = { entries: plan.entries.map((e) => ({ ...e, servings: e.servings * 2 })) }
    const bigThigh = draftList(andrew, meals, big).items.find((l) => l.key === thigh.key)
    const grown = listWith(andrew, meals, big, both).items.find((l) => l.key === thigh.key)
    assert(left > 0 && left < thigh.qty && both.find((r) => r.covers === thigh.key).qty === left && solve(both).items.find((l) => l.key === thigh.key).stocked && Math.abs(grown.qty - (bigThigh.qty - thigh.qty)) < 0.02,
      `a pound typed and then ticked covers the line once: when the line doubles, exactly the extra is bought — ${grown.qty} of ${bigThigh.qty}, having covered ${thigh.qty}`)
    assert(/markHave\(r, l, states\.get\(l\.key\)\?\.buying\)/.test(readLF('src/components/fuel/HaveStep.tsx')), 'the screen ticks a line for what it still buys, not for its whole amount')
  }
  // Codex r14: "have it" on a line that already carries a part-tick adds the rest to it — it does not replace it
  {
    const part = [{ item: thigh.item, qty: thigh.qty - 8, unit: thigh.unit, covers: thigh.key }]
    const left = lineStates(draft.items, solve(part)).get(thigh.key).buying
    const whole = markHave(part, thigh, left)
    assert(Math.abs(left - 8) < 0.011 && whole.length === 1 && Math.abs(whole[0].qty - thigh.qty) < 0.011 && solve(whole).items.find((l) => l.key === thigh.key).stocked,
      `a line buying its last 8 after a part-tick is covered whole by one more tap — the tick becomes ${whole[0].qty} of ${thigh.qty}, not 8`)
  }
  // Codex r4: undoing a tick is not a statement about the pound typed before it
  const someThenTick = markHave(setSome([], thigh, 1), thigh), undone = putBack(someThenTick, thigh)
  assert(someQty(undone, thigh) === 1 && !undone.some((r) => r.covers !== undefined) && lineStates(draft.items, solve(undone)).get(thigh.key).buying < thigh.qty,
    'a tick undone leaves the "have some" quantity under it: the pound in the freezer is still counted')
  assert(draftSignature(draft.items) === draftSignature(draftList(andrew, meals, plan).items) && draftSignature(draft.items) !== draftSignature(draftList(andrew, meals.map((m) => (m.slug === plan.entries[0].slug ? { ...m, ingredients: [...m.ingredients, { item: 'rice', qty_per_person: 9, unit: 'cup dry', store_section: 'Pantry', inferred: true }] } : m)), plan).items),
    'a meal edited between two visits is a different draft under the same nights — what was held for the old one is not given back to it')
  // a line covered by saved stock is put back by one tap too
  const fromStock = [{ item: onion.item, qty: 9999, unit: onion.unit }]
  assert(lineStates(draft.items, solve(fromStock)).get(onion.key).have && !lineStates(draft.items, solve(putBack(fromStock, onion))).get(onion.key).have, 'a line covered by stock is put back by one tap: the stock for it is taken as gone')
  // Codex r8: stock covering the same ingredient on both trips — putting ONE line back leaves the other had
  {
    const both = draft.items.filter((l) => draft.items.some((o) => o !== l && o.item === l.item && o.unit === l.unit && o.second_trip !== l.second_trip))
    const second = both.find((l) => l.second_trip), first = both.find((l) => !l.second_trip && l.item === second.item)
    const plenty = [{ item: first.item, qty: 9999, unit: first.unit }]
    const before = lineStates(draft.items, solve(plenty))
    const withStates = (states) => draft.items.map((l) => ({ line: l, state: states.get(l.key) }))
    const after = lineStates(draft.items, solve(putBack(plenty, second, withStates(before))))
    // Codex r10: stock that covered the other line only in part stays on hand, in that amount — nothing nobody said was gone is bought back
    const short = [{ item: first.item, qty: first.unit === 'oz' ? (first.qty + second.qty / 2) / 16 : first.qty + second.qty / 2, unit: haveUnit(first) }]
    const b2 = lineStates(draft.items, solve(short))
    const a2 = lineStates(draft.items, solve(putBack(short, first, withStates(b2))))
    assert(b2.get(first.key).have && !b2.get(second.key).have && Math.abs(b2.get(second.key).buying - second.qty / 2) < 0.02 && !a2.get(first.key).have && a2.get(first.key).buying === first.qty && Math.abs(a2.get(second.key).buying - b2.get(second.key).buying) < 0.02,
      `a line put back when the stock ran part-way into the next is bought in full, and the next line buys exactly what it did — first ${a2.get(first.key).buying} of ${first.qty}, second ${b2.get(second.key).buying} then ${a2.get(second.key).buying}`)
    assert(before.get(first.key).have && before.get(second.key).have && after.get(first.key).have && !after.get(second.key).have && after.get(second.key).buying === second.qty,
      'a line the stock covers is put back alone: the same ingredient on the other trip stays had')
  }
  // have some: real stock, in the line's unit; meat counts at (1 − diversion)
  const some = setSome([], thigh, 2)
  const st = lineStates(draft.items, solve(some)).get(thigh.key)
  assert(thigh.unit === 'oz' && haveUnit(thigh) === 'lb' && draft.items.filter((l) => l.unit !== 'oz').every((l) => haveUnit(l) === l.unit), 'a line in ounces is counted in pounds, the way a freezer is; every other line in its own unit')
  assert(some.length === 1 && some[0].covers === undefined && some[0].unit === 'lb' && someQty(some, thigh) === 2, '"have some" is a row of real stock, in pounds for a meat line')
  assert(!st.have && Math.abs((thigh.qty - st.buying) - 32) < 0.011, `2 lb of thighs on hand takes 32 oz off the purchase at 50% diversion (1 lb counts, and what is bought doubles) — buying ${st.buying} of ${thigh.qty} oz`)
  assert(setSome(some, thigh, 3).length === 1 && someQty(setSome(some, thigh, 3), thigh) === 3, 'a new number replaces the old one — it is the number in the freezer, not an addition')
  assert(setSome(some, thigh, 0).length === 0 && setSome(some, thigh, Number('')).length === 0 && setSome(some, thigh, Number('x')).length === 0, 'an empty box, a zero or a non-number clears it')
  assert(lineStates(draft.items, solve(setSome([], thigh, 9999))).get(thigh.key).have, 'enough on hand covers the line, and it shows as had')
  // what step 2 opens with
  const saved = [{ item: thigh.item, qty: 3, unit: 'lb' }, { item: 'venison', qty: 5, unit: 'lb' }, { item: onion.item, qty: onion.qty, unit: onion.unit, covers: onion.key }, { item: 'x', qty: 1, unit: 'each', covers: 'Pantry:not on this list:each' }]
  // a rebuild: the plan being rebuilt cooked the thighs and was built with the onion ticked
  const prior = { items: [{ item: thigh.item }, { item: onion.item }], inventory: [saved[2]] }
  const counted = startRows(saved, draft.items, true, prior), asked = startRows(saved, draft.items, false)
  assert(counted.length === 3 && counted.some((r) => r.covers === onion.key) && someQty(counted, thigh) === 3, 'on a rebuild, what that build was shown and let stand opens as it was saved — the lines it covers open ticked')
  assert(asked.length === 1 && asked[0].item === 'venison', 'when a week has been eating it, nothing about this menu opens ticked — and stock for something the menu does not cook is kept, not lost')
  assert(!counted.some((r) => r.covers === 'Pantry:not on this list:each') && !asked.some((r) => r.covers !== undefined), 'a tick whose line is not on this list is dropped: it was about another list')
  const freshStock = startRows(saved, draft.items, true)
  // Codex r2: stock the rebuilt plan never cooked was carried along unseen — it does not count now that the menu cooks it
  const unseen = startRows(saved, draft.items, true, { items: [{ item: onion.item }], inventory: [saved[2]] })
  assert(someQty(unseen, thigh) === null && unseen.some((r) => r.item === 'venison') && unseen.some((r) => r.covers === onion.key) && lastTime(saved, thigh) === 3,
    'on a rebuild, stock for an ingredient the rebuilt plan never cooked does not count unasked — it was never shown, so it is offered back instead')
  // Codex r2: a tick made for another list — next week's, built ahead — is not this build's, however alike the key
  const othersTick = startRows(saved, draft.items, true, { items: [{ item: thigh.item }, { item: onion.item }], inventory: [] })
  assert(!othersTick.some((r) => r.covers !== undefined) && someQty(othersTick, thigh) === 3, 'a tick is kept only if the plan being rebuilt was itself built with it — a tick from another week never covers this one')
  // Codex r4: the amount that counts is the prior build's own — the household's row re-ticked bigger for another list does not carry
  const reticked = [{ ...saved[2], qty: onion.qty * 2 }]
  assert(startRows(reticked, draft.items, true, { items: [{ item: onion.item }], inventory: [{ ...saved[2], qty: onion.qty }] }).length === 0, 'a tick re-made at another amount for another list is not the tick the rebuilt plan was built with')
  // Codex r6: stock saved in settings since that build was put there on purpose — it counts, shown by that build or not
  const savedSince = startRows(saved, draft.items, true, { items: null, inventory: [saved[2]] })
  assert(someQty(savedSince, thigh) === 3 && savedSince.some((r) => r.covers === onion.key), 'on a rebuild after the stock was counted afresh in settings, all of it counts — the ticks are still only that build\'s own')
  assert(freshStock.length === 2 && !freshStock.some((r) => r.covers !== undefined) && someQty(freshStock, thigh) === 3, 'stock counted afresh in settings counts for a new week — a tick from the last list never rides along with it')
  const st2 = readLF('src/lib/fuel/store.ts')
  const saveFn = st2.slice(st2.indexOf('export async function saveOnHand'), st2.indexOf('export async function loadActive'))
  assert(/\.update\(\{ inventory: rows \}\)\.eq\('user_id', userId\)\.eq\('inventory', JSON\.stringify\(loaded\)\)/.test(saveFn) && /if \(!data\) return \{ error: \{ message: 'what you have on hand was changed somewhere else/.test(saveFn) && /await saveOnHand\(supabase, userId, opts\.onHand, household\.inventory\)/.test(readLF('src/app/fuel/page.tsx')),
    'the build-time save lands only on the inventory this page loaded: stock saved in another tab since — from settings or from its step 2 — is never overwritten, and the build stops (Codex r1, r2)')
  assert(/\.update\(\{ inventory: rows \}\)\.eq\('user_id', userId\)/.test(saveFn) && !/updated_at:/.test(saveFn.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*\*)/.test(l)).join('\n')),
    'the build-time save writes the rows on hand and nothing else — it never moves the stamp that says the stock was counted afresh')
  assert(lastTime(saved, thigh) === 3 && lastTime(saved, onion) === null, 'what was saved is offered back by quantity — a tick from another week is not stock and is never offered')
  // Codex r3: a tick covers the amount it was made on, or less — never a bigger one under the same key
  {
    const big = { entries: plan.entries.map((e) => ({ ...e, servings: e.servings * 2 })) }
    const bigDraft = draftList(andrew, meals, big)
    const bigOnion = bigDraft.items.find((l) => l.key === onion.key)
    const tick = markHave([], onion)
    const bigBuilt = listWith(andrew, meals, big, tick).items.find((l) => l.key === onion.key)
    assert(bigOnion && bigOnion.qty > onion.qty && !bigBuilt.stocked && Math.abs(bigBuilt.qty - (bigOnion.qty - onion.qty)) < 0.011 && solve(tick).items.find((l) => l.key === onion.key).stocked,
      `servings doubled on a rebuild double the line under the same key, and the old tick covers only the amount it was made on: the solver buys the rest — ${bigBuilt.qty} of ${bigOnion.qty}`)
    const reopened = startRows(tick, bigDraft.items, true, { items: bigDraft.items, inventory: tick })
    const reState = lineStates(bigDraft.items, listWith(andrew, meals, big, reopened)).get(onion.key)
    assert(reopened.length === 1 && !reState.have && Math.abs(reState.buying - (bigOnion.qty - onion.qty)) < 0.011 && startRows(tick, draft.items, true, { items: draft.items, inventory: tick }).length === 1,
      'and step 2 opens that line showing the rest still to buy — the tick rides at its own amount, a part-tick included, so an unchanged rebuild buys what it did (Codex r12)')
    // Codex r12: a number typed into "have some" is everything on hand of that ingredient — a tick on its other line does not come off on top
    const partTick = [{ item: thigh.item, qty: 4, unit: thigh.unit, covers: 'Meat & Seafood:another line of it:oz' }, { item: onion.item, qty: 1, unit: onion.unit, covers: onion.key }]
    const typedTotal = setSome(partTick, thigh, 1)
    assert(typedTotal.length === 2 && someQty(typedTotal, thigh) === 1 && typedTotal.some((r) => r.covers === onion.key) && !typedTotal.some((r) => r.covers !== undefined && r.item === thigh.item),
      'typing the amount on hand replaces every row for that ingredient, ticks on its other lines included — and touches no other ingredient')
    const smaller = { entries: plan.entries.map((e) => ({ ...e, servings: Math.max(1, e.servings - 1) })) }
    assert(listWith(andrew, meals, smaller, tick).items.find((l) => l.key === onion.key)?.stocked !== false, 'a tick still covers the same line at a smaller amount')
  }
  // Codex r3: the save is the check that the stock this page loaded is still the household's — so it runs every time, tapped or not
  assert(/if \(opts\.onHand\) \{\n\s+const \{ error: e \} = await saveOnHand\(/.test(readLF('src/app/fuel/page.tsx')) && !/sameRows/.test(readLF('src/app/fuel/page.tsx')),
    'the on-hand save, and with it the check against another tab, runs on every build from step 2 — rows left as they opened are checked like rows that were tapped')
  assert(stapleLines([{ id: '6f1c2d3e-0000-4000-8000-00000000c0ff', item: 'coffee', store_section: 'Pantry' }])[0].key === customKey('6f1c2d3e-0000-4000-8000-00000000c0ff'), 'a staple on the draft is keyed exactly as the database keys its line, so a tick can take that line off the built list')
}

// ── 3. the guards read the one inventory ────────────────────────────────────
{
  const onion = line((l) => l.section !== MEAT_SECTION && !l.second_trip)
  const rows = markHave([{ item: 'rice', qty: 1, unit: 'lb' }], onion)
  const h = { ...andrew, inventory: rows }
  const snap = JSON.parse(JSON.stringify(snapshot(h, plan, true)))
  assert(snap.inventory.length === 2 && snap.inventory.some((r) => r.covers === onion.key) && snap.inventory_counted === true, 'the plan\'s snapshot carries this build\'s rows on hand, ticks included, and that they were counted')
  assert(!changed(snap, h, plan) && changed(snap, { ...andrew, inventory: clearLine(rows, onion) }, plan) && changed(snap, andrew, plan), 'the list is current while the household holds those rows, and out of date the moment a tick or a row changes')
  const stored = JSON.parse(JSON.stringify(buildShoppingList(householdFor(h, true), meals, plan).items))
  assert(listUnchanged(buildShoppingList(householdFor(h, true), meals, plan).items, stored) && !listUnchanged(draft.items, stored), 'the unchanged-list shortcut compares against a solve of the same rows — a ticked list is not the draft')
  assert(inventoryIssues([{ item: 'no such thing', qty: 1, unit: 'lb', covers: 'k' }], meals).length === 0 && inventoryIssues([{ item: 'no such thing', qty: 1, unit: 'lb' }], meals).length === 1, 'a tick is never reported as a row to fix — real stock that matches nothing still is')
  const pg = readLF('src/app/fuel/page.tsx')
  assert(/const askNow = household\.inventory\.length > 0 && !rebuildOfCounted\(weekStart\)/.test(pg) && /const inventoryCounted = askNow \? opts\.countInventory : true/.test(pg) && /if \(askNow !== askInventory\) \{ setError\(/.test(pg),
    'the page still judges, at build time, whether what is on hand needed asking about — on the household as it was drawn')
  const saveAt = pg.indexOf('await saveOnHand(supabase, userId, opts.onHand, household.inventory)'), buildAt = pg.indexOf('await createVersion(supabase, weekStart, h, meals, p, inventoryCounted)')
  assert(saveAt > 0 && buildAt > saveAt && /if \(e\) \{ setBusy\(false\); setError\(e\.message \?\? 'could not save what you have'\); return \}/.test(pg.slice(saveAt, buildAt)),
    'what step 2 gathered is saved as the household\'s inventory BEFORE the build, and a save that fails builds nothing')
  assert(/const carriesKept = !!list && \(opts\.keepKeys \?\? \[\]\)\.every\(\(k\) => list\.items\.some\(\(i\) => i\.key === k\)\)/.test(pg) && /if \(carriesKept && !startingNext && plan && list/.test(pg),
    'the stored list is reused only while it carries every own line left unticked — one taken off last time and wanted now gets a new version (Codex r1)')
  assert(/const haveKey = household && drafted \? `\$\{builderKey\}-\$\{target\}-\$\{JSON\.stringify\(drafted\.entries\)\}` : ''/.test(pg) && /const target = buildTarget\(new Date\(\)\)/.test(pg) && /<HaveStep key=\{haveKey\}/.test(pg) && /resume=\{had && had\.for === haveKey \? had : undefined\}/.test(pg) && /onHold=\{\(rows, skipped, draft\) => setHad\(\{ for: haveKey, rows, skipped, draft \}\)\}/.test(pg) && /const resumed = resume && resume\.draft === signature \? resume : undefined/.test(readLF('src/components/fuel/HaveStep.tsx')),
    'step 2 is keyed on the menu and the week the build lands on, and on nothing its own save can move — a page left open across a boundary opens a new step 2, and a build that failed after its save finds step 2 as it was left (Codex r1, r3)')
  assert(/if \(opts\.drawnFor !== undefined && opts\.drawnFor !== weekStart\) \{ setError\(/.test(pg) && /drawnFor: target \}\)/.test(pg) && pg.indexOf('opts.drawnFor !== weekStart') < pg.indexOf('await saveOnHand('),
    'rows gathered for one week are never built into another: the build is refused, before anything is saved, when the week it lands on is not the week step 2 was drawn for (Codex r2)')
  assert(/const priorItems = list\?\.items\n/.test(pg) && /plan && rebuildOfCounted\(target\) \? \{ items: savedSince \? null : solverLines\(priorItems \?\? \[\]\), inventory: priorRows \?\? \[\] \} : null/.test(pg) && /const savedSince = inventoryFresh\(householdSavedAt, newestPlanAt, newestPlanKnown\)/.test(pg) && /prior=\{prior\}/.test(pg) && !/draftList\([^)]*prior/.test(readLF('src/components/fuel/HaveStep.tsx')),
    'what a rebuild lets stand at step 2 is judged against the build being rebuilt — the lines its list was STORED with, never a fresh solve of a library edited since, and its own snapshot of what was on hand (Codex r2, r5)')
  assert(/disabled=\{busy \|\| \(s === 'plan' && !household\)/.test(pg) && /aria-label="settings" aria-pressed=\{at === 'intake'\} disabled=\{busy\}/.test(pg), 'the steps and the gear do nothing while a build or a save is in flight (Codex r10)')
  assert(/\(s === 'have' && at !== 'have'\)/.test(pg), 'step 2 is reached only through "use this menu", never by a tap that would open a menu since changed (Codex r2)')
  {
    const short = pg.slice(pg.indexOf('if (carriesKept && !startingNext'), pg.indexOf('const res = await createVersion('))
    const tail = pg.slice(pg.indexOf('const res = await createVersion('), pg.indexOf('const openUpcoming = async'))
    assert(short.indexOf('await takeOff(') > 0 && short.indexOf('await takeOff(') < short.indexOf('setBusy(false)') && tail.indexOf('await takeOff(') < tail.lastIndexOf('setBusy(false)'),
      'the page stays busy until the lines ticked "have it" are off the list — a second build cannot start on a list a removal is still on its way to (Codex r2)')
  }
  {
    const tail = pg.slice(pg.indexOf('const res = await createVersion('), pg.indexOf('const openUpcoming = async'))
    assert(tail.indexOf("setDraft(null); setHad(null); setNextCycle(false); setStep('list')") > 0 && tail.indexOf("setDraft(null); setHad(null); setNextCycle(false); setStep('list')") < tail.indexOf('await loadVersions(') && !/setNextCycle/.test(tail.slice(tail.indexOf('await loadVersions('))),
      'a built list is on screen in the same breath as its plan — the page never falls back to an editable menu while the build\'s last reads are on their way (Codex r8)')
  }
  assert(/setStep\(active\.list && !persistedStale \? 'list' : h\.household \? 'plan' : 'intake'\)/.test(pg), 'a returning athlete lands on the list when there is a current one, otherwise on the menu; a first visit starts in settings')
}

// ── 4. the screens, rendered ────────────────────────────────────────────────
const decode = (s) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const paint = (el) => {
  const html = renderToStaticMarkup(el)
  const text = decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
  const attrs = [...html.matchAll(/(?:aria-label|title|placeholder|alt)="([^"]*)"/g)].map((m) => decode(m[1]))
  return { html, text, attrs }
}
const screens = []
const show = (name, el) => { const s = { name, ...paint(el) }; screens.push(s); return s }
{
  const menu = (props) => createElement(PlanBuilder, { household: andrew, meals, initial: plan, building: false, onBuild: () => {}, rotations, members, ...props })
  const card = show('step 1 — the menu', menu())
  assert(/everyday menu 1/.test(card.text) && card.text.includes(rotations.find((r) => r.slug === 'rotation-a').note), 'the suggested menu is a card: its plain name and its one-line description')
  const names = plan.entries.map((e) => meals.find((m) => m.slug === e.slug).name)
  assert(names.length === 8 && names.every((n) => card.text.includes(n)), 'the card lists every dinner on the menu')
  assert((card.html.match(/pill-volt/g) || []).length === 1 && /use this menu/.test(card.text), 'one volt control: use this menu')
  assert(/choose a different menu/.test(card.text) && /change a night/.test(card.text) && !/aria-label="remove /.test(card.html) && !/aria-label="week 1"/.test(card.html), 'another menu and "change a night" are secondary, and the nights are behind the tap')
  const editing = show('step 1 — changing a night', menu({ startEditing: true }))
  assert((editing.html.match(/aria-label="remove /g) || []).length === 8 && /done changing nights/.test(editing.text), '"change a night" opens every night with its swap and remove')
  const broken = show('step 1 — a night to fix', menu({ initial: { entries: plan.entries.slice(1) } }))
  assert(/aria-label="week 1"/.test(broken.html) && /add 1 more night to use this menu/.test(broken.text), 'a menu that cannot be used as it stands opens on its nights, and the button says why')
  for (const r of sortedRotations(rotations)) {
    const weekly = { ...andrew, shop_cadence_days: 7 }
    show(`step 1 — ${r.slug}`, menu({ initial: { entries: rotationEntries(r.slug, members, meals, andrew) } }))
    show(`step 1 — ${r.slug}, weekly`, menu({ household: weekly, initial: { entries: rotationEntries(r.slug, members, meals, weekly) } }))
  }
  show('step 1 — own picks', menu({ rotations: [], members: [], startEditing: true }))

  const staples = [{ id: '6f1c2d3e-0000-4000-8000-00000000c0ff', item: 'coffee', store_section: 'Pantry' }]
  const have = (props) => createElement(HaveStep, { household: andrew, meals, plan, staples, building: false, onBack: () => {}, onBuild: () => {}, ...props })
  const step2 = show('step 2 — what do you already have', have())
  assert(/what do you already have\?/.test(step2.text) && draft.items.every((l) => step2.text.includes(l.item)) && /coffee/.test(step2.text), 'step 2 is the draft list: every line the menu needs, and the staples')
  const order = [...step2.html.matchAll(/<section[^>]*aria-label="([^"]+)"/g)].map((m) => decode(m[1]))
  const walk = andrew.store_section_order.map((s) => s.toLowerCase()).filter((s) => order.includes(s))
  assert(JSON.stringify(order.filter((s) => walk.includes(s))) === JSON.stringify(walk) && order[order.length - 1] === 'second trip', `the draft is in store order, the second shop last — got ${order.join(' > ')}`)
  const meat = draft.items.filter((l) => l.section === MEAT_SECTION), other = draft.items.filter((l) => l.section !== MEAT_SECTION)
  assert(meat.length > 0 && meat.every((l) => step2.attrs.includes(`how much ${l.item} you have, in ${haveUnit(l)}`)) && meat.some((l) => haveUnit(l) === 'lb'), 'every meat and seafood line carries its "have some" box up front, in pounds')
  assert(other.every((l) => !step2.attrs.includes(`how much ${l.item} you have, in ${haveUnit(l)}`) && step2.attrs.includes(`you have some ${l.item}`)), 'every other line is a plain tap, with "some" one tap away')
  assert(!/<select|type="text"|type="search"/.test(step2.html) && (step2.html.match(/pill-volt/g) || []).length === 1 && /build my list/.test(step2.text), 'no search box and no picker — and one volt control: build my list')
  assert((step2.html.match(/aria-pressed="true"/g) || []).length === 0 && new RegExp(`${draft.items.length + 1} to buy · 0 you have`).test(step2.text), 'with nothing saved, nothing opens ticked')
  const savedStock = [{ item: 'rice', qty: 25, unit: 'lb' }, { item: meat[0].item, qty: 1, unit: haveUnit(meat[0]) }]
  const building = paint(have({ building: true }))
  assert(!/<(button|input)(?![^>]*disabled)[^>]*>/.test(building.html) && /building the list/.test(building.text), 'nothing on step 2 can be changed while a build is in flight — the build took the rows as they stood (Codex r3)')
  const preticked = show('step 2 — saved stock counts', have({ household: { ...andrew, inventory: savedStock } }))
  assert((preticked.html.match(/aria-pressed="true"/g) || []).length === draft.items.filter((l) => l.item === 'rice').length && /buying /.test(preticked.text), 'what the saved stock covers opens ticked, and what it part-covers says what is still bought')
  // FOR-281, Andrew 2026-10-12: saved stock opens ticked on every build — step 2 no longer hears whether a plan is newer than the save
  assert(!/still have/.test(preticked.text) && !/not counted yet/.test(preticked.text), 'saved stock is never offered back on a new build — it is already counted')
  {
    const hs = readLF('src/components/fuel/HaveStep.tsx'), page = readLF('src/app/fuel/page.tsx')
    assert(!/countByDefault|askInventory/.test(hs) && !/countByDefault/.test(page) && !/<HaveStep[^>]*askInventory/.test(page), 'whether a plan is newer than the save is not passed to step 2 at all: there is nothing there for it to switch off')
    // a new week after an old plan: no prior build, the stock saved before that plan was built
    const newWeek = startRows(savedStock, draft.items, true, null)
    assert(newWeek.length === savedStock.length && lineStates(draft.items, listWith(andrew, meals, plan, newWeek)).get(draft.items.find((l) => l.item === 'rice').key).have, 'on a new week every saved row stands, and the line it covers is had')
  }
  // a rebuild still judges stock against the build being rebuilt: an ingredient that build never cooked is offered back, counted once and only on a tap
  const rebuilt = show('step 2 — a rebuild whose plan never cooked it', have({ household: { ...andrew, inventory: savedStock }, prior: { items: [{ item: 'rice' }], inventory: [] } }))
  assert((rebuilt.html.match(/aria-pressed="true"/g) || []).length === draft.items.filter((l) => l.item === 'rice').length && rebuilt.text.includes(`still have 1 ${haveUnit(meat[0])}`) && /not counted yet/.test(rebuilt.text), 'on a rebuild, stock the rebuilt plan never showed is offered back by one tap — and what it did show opens ticked')

  show('settings', createElement(IntakeForm, { initial: { ...andrew, inventory: [...savedStock, { item: 'onion', qty: 2, unit: 'each', covers: 'Produce:onion:each' }] }, meals, saving: false, onSave: () => {} }))
  const settings = screens[screens.length - 1]
  assert(/two weeks/.test(settings.text) && !settings.attrs.includes('remove onion') && settings.attrs.includes('remove rice'), 'settings shows the stock that lasts, and never a tick from one week\'s list')
  const built = buildShoppingList({ ...andrew, inventory: markHave(savedStock, other[0]) }, meals, plan)
  const step3 = show('step 3 — your list', createElement(Checklist, { listId: 'l1', version: 1, versions: [1], items: built.items, sectionOrder: andrew.store_section_order, onRowItems: () => {}, send: async () => null, refetch: async () => null, onRegenerate: () => {} }))
  assert(step3.text.includes(HAVE_IT_REASON) && /change the menu/.test(step3.text), 'the list shows what was ticked at step 2 as stocked, with the reason')
}

// ── 5. nobody reads "fortnight", "rotation" or "cycle" ──────────────────────
{
  for (const s of screens) {
    const bad = [s.text, ...s.attrs].filter((x) => BANNED.test(x)).map((x) => (x.match(new RegExp(`.{0,30}(?:${BANNED.source}).{0,30}`, 'i')) || [''])[0])
    assert(bad.length === 0, `${s.name}: no rendered string says fortnight, rotation or cycle — found "${bad.join('" / "')}"`)
  }
  assert(screens.length >= 20, `the screens were rendered — ${screens.length}`)
  // every rule sentence the planner speaks, driven into being
  const p = rotationEntries('rotation-b', members, meals, andrew)
  const battery = [
    { plan: { entries: [...p, { slug: 'cast-iron-ribeye', week: 2, servings: 2 }] }, household: andrew },
    { plan: { entries: p }, household: andrew, cycles: { history: [{ week_start: '2026-09-07', version: 1, meal_ids: [{ slug: 'cast-iron-ribeye', week: 1, servings: 2 }, { slug: 'cast-iron-ribeye', week: 2, servings: 2 }], rules_snapshot: { shop_cadence_days: 14 } }], targetStart: '2026-09-21', cadenceDays: 14 } },
    { plan: { entries: p }, household: andrew, cycles: { history: [{ week_start: '2026-09-28', version: 1, meal_ids: [], rules_snapshot: { shop_cadence_days: 7 } }], targetStart: '2026-09-21', cadenceDays: 14 } },
    { plan: { entries: p }, household: andrew, cycles: { history: [{ week_start: '2026-10-05', version: 1, meal_ids: [{ slug: 'cast-iron-ribeye', week: 1, servings: 2 }, { slug: 'cast-iron-ribeye', week: 2, servings: 2 }], rules_snapshot: { shop_cadence_days: 14 } }], targetStart: '2026-09-21', cadenceDays: 14 } },
    { plan: { entries: p }, household: { ...andrew, shop_cadence_days: 7 } },
  ]
  let spoken = 0, solverSaid = 0
  for (const b of battery) {
    const ws = validatePlan(b.plan, meals, b.household, b.cycles ? { cycles: b.cycles } : {})
    solverSaid += ws.filter((w) => BANNED.test(w)).length
    for (const s of planIssueSentences(ws, b.plan.entries, meals)) { spoken++; assert(!BANNED.test(s), `no rule sentence says fortnight, rotation or cycle — "${s}"`) }
  }
  assert(spoken >= 4 && solverSaid >= 3, `the battery drove the solver's own cycle and fortnight wordings through the planner — ${solverSaid} of them, ${spoken} sentences shown`)

  // the literals a person can be shown, in the page and every Fuel component: quoted strings and JSX text, comments and code aside
  const files = ['src/app/fuel/page.tsx', ...readdirSync(join(ROOT, 'src/components/fuel')).filter((f) => f.endsWith('.tsx')).map((f) => `src/components/fuel/${f}`)]
  assert(files.length >= 8, `the page and every Fuel component are read — ${files.length} files`)
  for (const f of files) {
    const code = readLF(f).replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n').filter((l) => !/^\s*\/\//.test(l) && !/^\s*import /.test(l)).map((l) => l.replace(/\s\/\/ .*$/, '')).join('\n')
    const literals = [
      ...[...code.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)].map((m) => m[1]),
      ...[...code.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)].map((m) => m[1]),
      ...[...code.matchAll(/`((?:[^`\\]|\\.)*)`/g)].map((m) => m[1].replace(/\$\{[^}]*\}/g, ' ')),
      ...[...code.matchAll(/>([^<>{}=;()]+)</g)].map((m) => m[1]),
    ]
    const bad = literals.filter((x) => BANNED.test(x))
    assert(bad.length === 0, `${f}: no literal a person could be shown says fortnight, rotation or cycle — found "${bad.join('" / "')}"`)
  }
}

// ── 6. the menus carry the plain names, in one voice ────────────────────────
{
  const want = { 'rotation-a': 'Everyday menu 1', 'rotation-b': 'Everyday menu 2', 'rotation-c1': 'Soup season 1', 'rotation-c2': 'Soup season 2', 'rotation-c3': 'Soup season 3', 'rotation-c4': 'Soup season 4' }
  assert(rotations.length === 6 && rotations.every((r) => want[r.slug] === r.name), `the six menus carry the names the ticket gives — got ${rotations.map((r) => `${r.slug}=${r.name}`).join(', ')}`)
  assert(rotations.every((r) => r.note && r.note.length <= 140 && !BANNED.test(r.note) && !BANNED.test(r.name)), 'every menu has a one-line description, and neither it nor the name says fortnight, rotation or cycle')
  const sql = readLF('supabase/migrations/20261013_fuel_menu_names.sql')
  const live = sql.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n')
  const q = (t) => `'${t.replace(/'/g, "''")}'`
  for (const r of rotations) assert(live.includes(`UPDATE public.fuel_rotations SET name = ${q(r.name)}, note = ${q(r.note)} WHERE slug = ${q(r.slug)};`), `the rename migration sets ${r.slug} to exactly what the fixture holds`)
  const statements = live.split('\n').map((l) => l.trim()).filter(Boolean)
  assert(statements.length === 6 && statements.every((l) => /^UPDATE public\.fuel_rotations SET name = '(?:[^']|'')*', note = '(?:[^']|'')*' WHERE slug = '[a-z0-9-]+';$/.test(l)), 'the rename is six row updates of name and note, each by slug — no slug moves, nothing is deleted, no schema changes')
  assert((sql.match(/^--   UPDATE public\.fuel_rotations SET name = /gm) || []).length === 6, 'the migration carries its own exact revert')
}

if (failures) { console.log(`\nfuel-flow: ${failures} of ${failures + passes} checks FAILED`); process.exit(1) }
console.log(`fuel-flow: ${passes} checks passed — menu, what you have, list: one flow, and the solver still makes the list`)
