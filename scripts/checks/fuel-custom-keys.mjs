// ── Fuel custom-item keys (FOR-240) — a standing invariant, its own file ────
// A custom item's key can never equal a key the solver mints — for ANY library
// and ANY section, not one example. The solver is run for real over generated
// libraries, hostile names included: sections that start with `custom~`, items
// and units made of colons and tildes, empty strings, unicode. Every key it
// produces is checked against custom keys minted from generated ids, and from
// the solver's own keys used as ids, the most hostile id there is. A fixed
// seed, so a failure reproduces.
//
// Alongside the key invariant, the properties the stored list rests on:
//   · the regeneration shortcut sees a list with custom lines as the same list
//   · aisle order holds: every line once, one section each, sections in the
//     household's walk, the athlete's lines after the solver's within a section
// The list is built here the way the database stores it — the solver's lines,
// then one line per staple still on, keyed on the staple — because the
// database is the only source of staple lines (Andrew's ruling A). What the
// database merges is proven against Postgres, not modelled as a client merge.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { buildShoppingList } from '../../src/lib/fuel/solve.ts'
import { customKey, isCustom, isCustomKey, sectionsInOrder, stapleIdFromKey } from '../../src/lib/fuel/custom.ts'
import { listUnchanged } from '../../src/lib/fuel/version.ts'

let failures = 0, passes = 0
const assert = (cond, msg) => { if (cond) passes++; else { failures++; console.log('  ✗ ' + msg) } }
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const seed = JSON.parse(readFileSync(join(ROOT, 'fixtures/fuel-seed.json'), 'utf8'))

// mulberry32: small, deterministic
function rng(s) {
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const R = rng(240)
const int = (n) => Math.floor(R() * n)
const pick = (xs) => xs[int(xs.length)]
const shuffle = (xs) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = int(i + 1); [a[i], a[j]] = [a[j], a[i]] } return a }
const HOSTILE = ['custom~', 'custom~abc', 'Custom~1', 'custom', '~', ':', '::', 'a:b', ':trip2', 'trip2', '', ' ', 'Pantry', 'Snacks', 'Meat & Seafood', 'Produce', 'tröt', '🥫', 'custom~' + 'f'.repeat(32)]
const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789 -~:&/'.split('')
const text = () => (R() < 0.35 ? pick(HOSTILE) : Array.from({ length: 1 + int(14) }, () => pick(CHARS)).join(''))
const hex = (n) => Array.from({ length: n }, () => '0123456789abcdef'[int(16)]).join('')
const uuid = () => `${hex(8)}-${hex(4)}-4${hex(3)}-8${hex(3)}-${hex(12)}`
const UNITS = ['oz', 'lb', 'each', 'tsp', 'tbsp', 'cup dry', 'clove', 'g']
const RULES = { protein_floor_g_per_person: 40, fish_per_week: 1, ground_turkey_per_week: 1, steak_per_month: 2, no_tilapia: true, vegetable_every_night: true, minimal_added_fat: true, frugal_reuse: true }

function library() {
  const sections = Array.from({ length: 1 + int(6) }, text)
  const meals = Array.from({ length: 1 + int(6) }, (_, k) => ({
    ...pick(seed.fuel_meals),
    slug: `m${k}`,
    ingredients: Array.from({ length: 1 + int(6) }, () => ({
      item: text(), qty_per_person: 0.5 + int(8), unit: R() < 0.2 ? text() : pick(UNITS),
      store_section: R() < 0.2 ? 'Meat & Seafood' : pick(sections), inferred: R() < 0.5,
    })),
  }))
  const first = meals[0].ingredients[0]
  const cadence = pick([7, 14])
  const household = {
    people_count: 1 + int(4), nights_per_week: 7, cook_cap_minutes: 180, shop_cadence_days: cadence, prep_diversion_pct: pick([0, 25, 50]),
    dietary_rules: RULES,
    inventory: R() < 0.5 ? [{ item: first.item, qty: 5 + int(50), unit: first.unit }] : [],
    store_section_order: shuffle([...new Set([...sections, ...seed.store_section_order])]).slice(0, 2 + int(8)),
  }
  const plan = { entries: Array.from({ length: 1 + int(8) }, () => ({ slug: pick(meals).slug, week: cadence === 14 ? pick([1, 2]) : 1, servings: 1 + int(6) })) }
  return { meals, household, plan }
}

// The list as the database stores it: the solver's lines, then one line per staple, keyed on the staple.
const storedList = (solverItems, staples) => {
  const seen = new Set()
  const lines = []
  for (const st of staples) {
    const key = customKey(st.id)
    if (seen.has(key)) continue
    seen.add(key)
    lines.push({ key, item: st.item.trim(), qty: 0, unit: '', section: st.store_section, from: [], second_trip: false, inferred: false, stocked: false, checked: false, custom: 'staple' })
  }
  return [...solverItems, ...lines]
}

const CASES = 400
let examined = 0, solverKeysSeen = 0, customKeysSeen = 0
let keyClash = null, solverReadsCustom = null, customReadsSolver = null, uuidShape = null, roundTrip = null
let unchangedBroken = null, orderBroken = null
for (let c = 0; c < CASES; c++) {
  const { meals, household, plan } = library()
  const list = buildShoppingList(household, meals, plan)
  const solverKeys = new Set(list.items.map((i) => i.key))
  solverKeysSeen += solverKeys.size
  const ids = [...Array.from({ length: 1 + int(8) }, () => (R() < 0.8 ? uuid() : text())), ...[...solverKeys].slice(0, 3)]
  for (const x of ids) {
    const k = customKey(x)
    customKeysSeen++
    if (!keyClash && solverKeys.has(k)) keyClash = { id: x, key: k }
    if (!customReadsSolver && !isCustomKey(k)) customReadsSolver = { id: x, key: k }
    if (!uuidShape && /^[0-9a-f-]{36}$/.test(x) && !/^custom~[0-9a-f]{32}$/.test(k)) uuidShape = { id: x, key: k }
    if (!roundTrip && /^[0-9a-f-]{36}$/.test(x) && stapleIdFromKey(k) !== x) roundTrip = { id: x, key: k, back: stapleIdFromKey(k) }
    if (!roundTrip && solverKeys.has(x) && stapleIdFromKey(x) !== null) roundTrip = { solverKey: x, back: stapleIdFromKey(x) }
  }
  for (const k of solverKeys) if (!solverReadsCustom && isCustomKey(k)) solverReadsCustom = k

  const staples = ids.map((x) => ({ id: x, item: text(), store_section: R() < 0.7 ? pick(household.store_section_order) : text() }))
  const merged = storedList(list.items, staples)
  if (unchangedBroken === null && !listUnchanged(list.items, merged)) unchangedBroken = c

  // Shuffled: a row is not promised to hold the athlete's lines last, so the
  // aisle order must come from sectionsInOrder, never from its input.
  const main = shuffle(merged.filter((l) => !l.second_trip && !l.stocked))
  const secs = sectionsInOrder(main, household.store_section_order)
  const flat = secs.flatMap((s) => s.items)
  const rank = (s) => { const i = household.store_section_order.indexOf(s); return i < 0 ? household.store_section_order.length : i }
  const customLast = (items) => { const f = items.findIndex(isCustom); return f === -1 || items.slice(f).every(isCustom) }
  const inInputOrder = (items) => items.every((l, i) => i === 0 || main.indexOf(items[i - 1]) < main.indexOf(l))
  const ordered = flat.length === main.length && main.every((l) => flat.includes(l))
    && new Set(secs.map((s) => s.section)).size === secs.length
    && secs.every((s, i) => i === 0 || rank(secs[i - 1].section) <= rank(s.section))
    && secs.every((s) => s.items.every((l) => l.section === s.section) && customLast(s.items) && inInputOrder(s.items.filter((l) => !isCustom(l))))
  if (orderBroken === null && !ordered) orderBroken = c
  examined++
}

assert(examined === CASES && solverKeysSeen > CASES && customKeysSeen > CASES, `${examined} generated libraries examined — ${solverKeysSeen} solver keys minted, ${customKeysSeen} custom keys`)
assert(!keyClash, `no custom key equals a key the solver minted, for any library and any section — ${keyClash ? `id ${JSON.stringify(keyClash.id)} gave ${JSON.stringify(keyClash.key)}` : `none in ${CASES} libraries`}`)
assert(!solverReadsCustom, `no solver key reads as a custom key, whatever its section is called — ${solverReadsCustom ? JSON.stringify(solverReadsCustom) : 'none'}`)
assert(!customReadsSolver, `every custom key reads as custom, whatever its id — ${customReadsSolver ? JSON.stringify(customReadsSolver) : 'all'}`)
assert(!uuidShape, `a row id mints the key the database mints: 'custom~' and the uuid's 32 hex digits — ${uuidShape ? JSON.stringify(uuidShape) : 'all'}`)
assert(!roundTrip, `a staple line's key leads back to exactly its staple, and no solver key leads to one — ${roundTrip ? JSON.stringify(roundTrip) : 'held'}`)
assert(unchangedBroken === null, `the regeneration shortcut sees a list with custom lines as the same list — ${unchangedBroken === null ? 'held' : `case ${unchangedBroken}`}`)
assert(orderBroken === null, `aisle order holds: every line once, one section each, sections in the household's walk, the athlete's lines after the solver's — ${orderBroken === null ? 'held' : `case ${orderBroken}`}`)

if (failures) { console.log(`\nfuel-custom-keys: ${failures} of ${failures + passes} checks FAILED`); process.exit(1) }
console.log(`fuel-custom-keys: ${passes} checks passed — ${CASES} generated libraries, no custom key is ever a solver key`)
