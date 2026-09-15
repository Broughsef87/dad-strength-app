// ── Fuel inventory vocabulary (FOR-239) — the standing invariant, its own file ──
// What is on hand is picked from the ingredients the meals use, grouped by the
// aisle they are bought in. This judges that grouping against the whole seeded
// library — both fixtures — and against a library holding a section the
// household's store order does not name, so a new section can never orphan
// its ingredients:
//   1. every distinct store_section in the library is a group in the picker
//   2. every ingredient in the library is in the picker exactly once, and the
//      picker holds nothing else
//   3. ordered sections follow the household's store order; a section the
//      order does not name comes after them — appended, never dropped
// Kept apart from fuel-solve.mjs and fuel-rotations.mjs on purpose: it is a
// property of the library and the picker together, whatever feature changes.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { libraryItems, libraryVocabulary } from '../../src/lib/fuel/solve.ts'

let failures = 0, passes = 0
const assert = (cond, msg) => { if (cond) passes++; else { failures++; console.log('  ✗ ' + msg) } }
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const read = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'))

const base = read('fixtures/fuel-seed.json')
const rot = read('fixtures/fuel-seed-rotation-b.json')
const library = [...base.fuel_meals, ...rot.fuel_meals_new]
const order = base.store_section_order

function judge(label, meals, sectionOrder) {
  const groups = libraryVocabulary(meals, sectionOrder)
  const sections = [...new Set(meals.flatMap((m) => m.ingredients.map((i) => i.store_section)))]
  const items = [...new Set(meals.flatMap((m) => m.ingredients.map((i) => i.item)))]
  const grouped = groups.flatMap((g) => g.items)

  // 1. every section is a group
  for (const s of sections) assert(groups.some((g) => g.section === s), `${label}: the ${s} section is a group in the picker`)
  assert(groups.every((g) => sections.includes(g.section) && g.items.length > 0), `${label}: every group is a section the library buys in, and none is empty`)

  // 2. every ingredient exactly once, and nothing else
  for (const i of items) assert(grouped.filter((x) => x === i).length === 1, `${label}: "${i}" is in the picker exactly once — got ${grouped.filter((x) => x === i).length}`)
  assert(grouped.length === items.length && JSON.stringify([...grouped].sort((a, b) => a.localeCompare(b))) === JSON.stringify(libraryItems(meals)),
    `${label}: the picker holds the library's ingredients and nothing else — ${grouped.length} grouped, ${items.length} in the library`)

  // 3. store order, then the sections it does not name
  const names = groups.map((g) => g.section)
  const ordered = names.filter((s) => sectionOrder.includes(s))
  assert(JSON.stringify(ordered) === JSON.stringify(sectionOrder.filter((s) => sections.includes(s))), `${label}: ordered sections follow the household's store order — got ${ordered.join(', ')}`)
  const firstUnordered = names.findIndex((s) => !sectionOrder.includes(s))
  assert(firstUnordered === -1 || names.slice(firstUnordered).every((s) => !sectionOrder.includes(s)), `${label}: a section the store order does not name comes after the ordered ones — got ${names.join(', ')}`)
}

judge('the seeded library', library, order)
assert(libraryItems(library).length === new Set(library.flatMap((m) => m.ingredients.map((i) => i.item))).size && libraryItems(library).length > 0, 'the seeded library has an ingredient vocabulary to pick from')

const bakery = { ingredients: [{ item: 'sourdough loaf', qty_per_person: 1, unit: 'each', store_section: 'Bakery', inferred: true }] }
judge('a library with a section the store order does not name', [...library, bakery], order)
assert(libraryVocabulary([...library, bakery], order).some((g) => g.section === 'Bakery' && g.items.includes('sourdough loaf')), 'a new section brings its ingredients into the picker, not into nowhere')

if (failures) { console.log(`\nfuel-vocabulary: ${failures} of ${failures + passes} checks FAILED`); process.exit(1) }
console.log(`fuel-vocabulary: ${passes} checks passed — every aisle in the library is in the picker, every ingredient once`)
