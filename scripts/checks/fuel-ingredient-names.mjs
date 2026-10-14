// ── Fuel ingredient names (FOR-280) — the standing invariant, its own file ──
//
// THE SHOPPING LIST MAKES ONE LINE PER INGREDIENT NAME AND UNIT. The name is
// the key (solve.ts: `section:item:unit`), and it is also how stock on hand is
// matched to a line. So two names for one thing are two lines on the list, and
// stock saved under one name takes nothing off the other. The seeded library
// had four of those — "onion" and "yellow onion", "cumin" and "ground cumin",
// "corn tortilla" and "corn tortillas", "chicken breast" and "chicken breast,
// boneless skinless" — and one ingredient seeded in two units.
//
// Nothing in the solver can tell that two names are one thing; only the data
// can be right. This judges the data — the fixtures every seed migration is
// generated from:
//   1. no two ingredient names in the library are near-duplicates, unless they
//      are written down in DISTINCT as different things, with the reason
//   2. an ingredient is seeded in ONE unit and ONE store section, unless it is
//      written down in TWO_UNITS, and never two inside one menu
//   3. the list the app builds from every menu has one line per ingredient
//   4. the rows-only migration that moved the already-seeded database writes
//      exactly what the fixtures hold
//
// Its own file, so a revert of the rename cannot take the check with it.
//
//   node --import tsx scripts/checks/fuel-ingredient-names.mjs   (run-all does this)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { INGREDIENT_NAMES_FIXTURE, PAIRS, renderIngredientNames, renderPair } from '../fuel-seed-sql.mjs'
import { buildShoppingList } from '../../src/lib/fuel/solve.ts'
import { rotationEntries } from '../../src/lib/fuel/rotation.ts'

let failures = 0, passes = 0
const assert = (cond, msg) => { if (cond) passes++; else { failures++; console.log('  ✗ ' + msg) } }
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const readLF = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')
const read = (rel) => JSON.parse(readLF(rel))

// The library, read off the PAIRS: a new seed fixture is judged without this
// file being touched.
const library = PAIRS.flatMap((p) => p.meals(read(p.fixture)))
const rotB = read('fixtures/fuel-seed-rotation-b.json')
const rotC = read('fixtures/fuel-seed-rotation-c.json')
const rotations = [...rotB.fuel_rotations, ...rotC.fuel_rotations]
const members = [...rotB.fuel_rotation_meals, ...rotC.fuel_rotation_meals]

// ── The rule: when are two names "near"? ─────────────────────────────────────
// Deliberately wide. Two names are near when one's words are all in the other
// ("onion" / "yellow onion", "corn tortilla" / "corn tortillas"), or when they
// end on the same noun before any comma ("green cabbage" / "shredded
// cabbage"). That also catches pairs that really are different things —
// "red onion" and "yellow onion" — and those are written down below, once,
// with the reason. A new name near an old one fails until somebody decides.
const singular = (w) => (w.endsWith('oes') ? w.slice(0, -2) : w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)
const words = (s) => s.toLowerCase().replace(/[^a-z0-9/ -]/g, ' ').split(/\s+/).filter(Boolean).map(singular)
const head = (s) => { const w = words(s.split(',')[0]); return w[w.length - 1] }
const within = (a, b) => a.every((x) => b.includes(x))
export const near = (a, b) => a !== b && (within(words(a), words(b)) || within(words(b), words(a)) || head(a) === head(b))

// Names that are near and are DIFFERENT THINGS. A pair is excused only when
// both names stand in the same group.
const DISTINCT = [
  { why: 'different potatoes, cooked differently', names: ['baby potatoes', 'russet potato', 'sweet potato'] },
  { why: 'different stocks', names: ['beef stock', 'chicken stock'] },
  { why: 'different peppers', names: ['bell pepper', 'mini sweet peppers', 'poblano pepper'] },
  { why: 'different beans; green beans are a vegetable', names: ['black beans', 'cannellini beans', 'green beans', 'kidney beans'] },
  { why: 'different spice blends', names: ['blackening seasoning', 'italian seasoning', 'jerk seasoning', 'tandoori seasoning'] },
  { why: 'fresh tomatoes, two canned tomatoes and a paste: four different things to buy', names: ['cherry tomato', 'crushed tomatoes', 'fire-roasted diced tomatoes', 'tomato', 'tomato paste'] },
  { why: 'different pastes', names: ['tomato paste', 'white miso paste'] },
  { why: 'different powders', names: ['chili powder', 'chipotle powder', 'garlic powder', 'unsweetened cocoa powder'] },
  { why: 'fresh garlic and the dried spice', names: ['garlic', 'garlic powder'] },
  { why: 'the vegetable and two different tortillas', names: ['corn', 'corn tortilla', 'flour tortilla'] },
  { why: 'a dried herb and a fresh one', names: ['dried parsley', 'flat-leaf parsley'] },
  { why: 'different peas', names: ['frozen peas', 'sugar snap peas'] },
  { why: 'different oils', names: ['olive oil', 'toasted sesame oil'] },
  { why: 'different onions: the red one is pickled raw', names: ['red onion', 'yellow onion'] },
  // LEFT APART, NOT RULED. Each of these may be one thing in the kitchen, and
  // may not: merging them changes what a recipe asks for. No seeded menu holds
  // both names of any pair (section 3 proves it), so no menu's list is split
  // by them today. Reported on FOR-280 for Blaine to rule.
  { why: 'NOT RULED: the original eight say "rice", the expansion says "jasmine rice"', names: ['jasmine rice', 'rice'] },
  { why: 'NOT RULED: low-sodium is a different bottle, and it may be the only one in the house', names: ['low-sodium soy sauce', 'soy sauce'] },
  { why: 'NOT RULED: nonfat is a different tub', names: ['greek yogurt', 'nonfat greek yogurt'] },
  { why: 'NOT RULED: an English cucumber is a different cucumber, and may be the one bought anyway', names: ['cucumber', 'english cucumber'] },
  { why: 'NOT RULED: a head of cabbage against a bag of shredded', names: ['green cabbage', 'shredded cabbage'] },
]
const excused = (a, b) => DISTINCT.some((g) => g.names.includes(a) && g.names.includes(b))

/** Every unexcused near pair among the ingredient names of these meals. */
const splits = (meals) => {
  const names = [...new Set(meals.flatMap((m) => m.ingredients.map((i) => i.item)))].sort()
  const out = []
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    if (near(names[i], names[j]) && !excused(names[i], names[j])) out.push(`"${names[i]}" / "${names[j]}"`)
  }
  return out
}

// ── 1. no two names for one thing, anywhere in the library ───────────────────
assert(library.length === 37, `the seeded library is 37 meals — it is ${library.length}`)
{
  const found = splits(library)
  assert(found.length === 0, `no two ingredient names in the library are near-duplicates — found ${found.join(', ') || 'none'}. Use one name, or add the pair to DISTINCT with the reason they are different things.`)

  // The names are stored as written, and the list key lower-cases and trims
  // them: a name that differs only by case or a stray space is one line on the
  // list and two rows in the settings picker.
  const byKey = new Map()
  for (const m of library) for (const i of m.ingredients) byKey.set(i.item.trim().toLowerCase(), (byKey.get(i.item.trim().toLowerCase()) ?? new Set()).add(i.item))
  const cased = [...byKey.values()].filter((s) => s.size > 1).map((s) => [...s].join(' / '))
  assert(cased.length === 0, `no ingredient is written two ways that differ only by case or spacing — found ${cased.join(', ') || 'none'}`)

  // DISTINCT is not a place to park a name that no longer exists: every name
  // in it is an ingredient today, so a group cannot outlive the pair it excused.
  const all = new Set(library.flatMap((m) => m.ingredients.map((i) => i.item)))
  const stale = DISTINCT.flatMap((g) => g.names).filter((n) => !all.has(n))
  assert(stale.length === 0, `every name in DISTINCT is an ingredient in the library — not found: ${stale.join(', ') || 'none'}`)
  // And every group still excuses something: its names are near each other.
  for (const g of DISTINCT) assert(g.names.some((a) => g.names.some((b) => near(a, b))), `DISTINCT group [${g.names.join(', ')}] still holds a near pair`)
}

// ── the rule BITES, so section 1 is not vacuous ──────────────────────────────
{
  assert(near('onion', 'yellow onion') && near('cumin', 'ground cumin') && near('corn tortilla', 'corn tortillas') && near('chicken breast', 'chicken breast, boneless skinless'), 'the four pairs FOR-280 fixed all read as near')
  assert(near('green cabbage', 'shredded cabbage') && near('rice', 'jasmine rice'), 'a shared last noun reads as near')
  assert(!near('lime', 'lemon') && !near('kale', 'carrot') && !near('salmon', 'haddock'), 'unrelated names do not')
  // Each old name, put back into the meal it came from, is caught.
  const OLD = [['soy-ginger-stirfry', 'yellow onion', 'onion'], ['chili-lime-thighs', 'ground cumin', 'cumin'], ['chipotle-cod-tacos', 'corn tortilla', 'corn tortillas'], ['chicken-piccata', 'chicken breast, boneless skinless', 'chicken breast']]
  for (const [slug, now, was] of OLD) {
    const meal = library.find((m) => m.slug === slug)
    assert(!!meal && meal.ingredients.some((i) => i.item === now), `${slug} is seeded with "${now}"`)
    const reverted = library.map((m) => (m.slug !== slug ? m : { ...m, ingredients: m.ingredients.map((i) => (i.item === now ? { ...i, item: was } : i)) }))
    assert(splits(reverted).some((s) => s.includes(`"${was}"`)), `putting "${was}" back into ${slug} is caught`)
  }
  // A brand-new near name is caught too, without being listed anywhere.
  const planted = [...library, { slug: 'planted', ingredients: [{ item: 'white onion', qty_per_person: 1, unit: 'each', store_section: 'Produce', inferred: true }] }]
  assert(splits(planted).some((s) => s.includes('"white onion"')), 'a new name near an old one is caught until it is ruled on')
}

// ── 2. one unit and one section per ingredient ───────────────────────────────
// The key holds the unit and the section too, so one name in two units is two
// lines just as surely as two names are.
const TWO_UNITS = {
  // Both are teaspoons against tablespoons, and no seeded menu holds both
  // meals (section 3). Reported on FOR-280: the fix is the solver adding
  // tsp to tbsp, not a recipe asking for 0.17 tbsp of oil.
  'olive oil': ['tbsp', 'tsp'],
  'low-sodium soy sauce': ['tbsp', 'tsp'],
}
{
  const units = new Map(), sections = new Map()
  for (const m of library) for (const i of m.ingredients) {
    units.set(i.item, (units.get(i.item) ?? new Set()).add(i.unit))
    sections.set(i.item, (sections.get(i.item) ?? new Set()).add(i.store_section))
  }
  const twoUnits = [...units].filter(([, u]) => u.size > 1).map(([item, u]) => [item, [...u].sort()])
  const unruled = twoUnits.filter(([item, u]) => JSON.stringify(TWO_UNITS[item]) !== JSON.stringify(u))
  assert(unruled.length === 0, `every ingredient is seeded in one unit — in two: ${unruled.map(([i, u]) => `${i} (${u.join(', ')})`).join(', ') || 'none'}`)
  assert(Object.keys(TWO_UNITS).every((item) => twoUnits.some(([i]) => i === item)), 'every TWO_UNITS entry is still an ingredient seeded in two units')
  const twoSections = [...sections].filter(([, s]) => s.size > 1).map(([item, s]) => `${item} (${[...s].join(', ')})`)
  assert(twoSections.length === 0, `every ingredient is in one store section — in two: ${twoSections.join(', ') || 'none'}`)
  assert(units.get('crushed tomatoes')?.size === 1 && units.get('crushed tomatoes').has('oz'), 'crushed tomatoes are seeded in oz in both meals that use them')
}

// ── 3. the list the app builds from every menu: one line per ingredient ──────
// The ticket's done-when, asked of the solver itself. A fortnight shop for
// two, cook cap wide enough that no dinner is left out, nothing on hand.
{
  const base = read('fixtures/fuel-seed.json')
  const household = {
    people_count: 2, nights_per_week: 4, cook_cap_minutes: 180, shop_cadence_days: 14, prep_diversion_pct: 0,
    dietary_rules: { protein_floor_g_per_person: 40, fish_per_week: 1, ground_turkey_per_week: 1, steak_per_month: 2, no_tilapia: true, vegetable_every_night: true, minimal_added_fat: true, frugal_reuse: true },
    inventory: [], store_section_order: base.store_section_order,
  }
  assert(rotations.length === 6, `six menus are judged — got ${rotations.map((r) => r.slug).join(', ')}`)
  for (const r of rotations) {
    const entries = rotationEntries(r.slug, members, library, household)
    assert(entries.length === 8, `${r.slug}: all eight dinners are on the plan — got ${entries.length}`)
    const lines = buildShoppingList(household, library, { entries }).items
    // The second trip is its own trip: week 2's produce and fresh fish are
    // bought then, so the same name on both trips is two real purchases.
    for (const trip of [false, true]) {
      const names = lines.filter((l) => l.second_trip === trip).map((l) => l.item)
      const twice = names.filter((n, i) => names.indexOf(n) !== i)
      assert(twice.length === 0, `${r.slug}, ${trip ? 'second trip' : 'main shop'}: every ingredient is one line — twice: ${[...new Set(twice)].join(', ') || 'none'}`)
    }
    // Across both trips, no two different names for one thing.
    const all = [...new Set(lines.map((l) => l.item))]
    const split = []
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const ruled = DISTINCT.some((g) => !g.why.startsWith('NOT RULED') && g.names.includes(all[i]) && g.names.includes(all[j]))
      if (near(all[i], all[j]) && !ruled) split.push(`"${all[i]}" / "${all[j]}"`)
    }
    assert(split.length === 0, `${r.slug}: the list holds one name per real ingredient, and no pair left unruled — found ${split.join(', ') || 'none'}`)
  }
}

// ── 4. the migration writes what the fixtures hold ───────────────────────────
// The rows-only migration is what moved the database that was already seeded.
// It is generated (fuel-solve pins every pair to its fixture), so what is
// judged here is its SHAPE and that the generator refuses a rename the meal
// fixtures do not carry.
{
  const pair = PAIRS.find((p) => p.fixture === INGREDIENT_NAMES_FIXTURE)
  assert(!!pair, 'the ingredient-names migration is a generated pair, not a hand-written write to fuel_meals')
  const seed = read(INGREDIENT_NAMES_FIXTURE)
  const sql = pair ? renderPair(pair) : ''
  assert(!!pair && readLF(pair.migration) === sql, 'the migration on disk is exactly what the fixtures generate')
  const live = sql.split('\n').filter((l) => !/^\s*--/.test(l)).map((l) => l.trim()).filter(Boolean)
  const q = (t) => `'${t.replace(/'/g, "''")}'`
  const statement = (m) => `UPDATE public.fuel_meals SET ingredients = ${q(JSON.stringify(m.ingredients))}::jsonb WHERE slug = ${q(m.slug)} AND user_id IS NULL;`
  const moved = [...new Set(seed.fuel_ingredient_renames.map((r) => r.slug))]
  assert(moved.length === 7, `seven meals moved — the fixture names ${moved.length}`)
  for (const slug of moved) {
    const meal = library.find((m) => m.slug === slug)
    assert(!!meal && live.includes(statement(meal)), `the migration sets ${slug}'s ingredients to exactly what its fixture holds`)
  }
  assert(live.length === moved.length && live.every((l) => /^UPDATE public\.fuel_meals SET ingredients = '(?:[^']|'')*'::jsonb WHERE slug = '[a-z0-9-]+' AND user_id IS NULL;$/.test(l)),
    `the migration is ${moved.length} row updates of ingredients, each by slug and only where user_id IS NULL — no slug moves, nothing is deleted, no schema changes, no athlete's own meal`)
  // The revert is rendered from what each ingredient WAS: applied to the list
  // the fixture holds, it gives back the old names and the old unit.
  const reverts = sql.split('\n').filter((l) => /^--   UPDATE public\.fuel_meals SET ingredients = /.test(l))
  assert(reverts.length === moved.length, 'the migration carries its own revert, one statement a meal')
  for (const r of seed.fuel_ingredient_renames) {
    const line = reverts.find((l) => l.endsWith(`WHERE slug = ${q(r.slug)} AND user_id IS NULL;`)) ?? ''
    const was = JSON.parse((line.match(/ingredients = '(.*)'::jsonb/)?.[1] ?? '[]').replace(/''/g, "'"))
    assert(was.some((i) => Object.keys(r.was).every((k) => i[k] === r.was[k])), `the revert gives ${r.slug} its "${r.was.item}" back as it was`)
    assert(!live.some((l) => l.includes(JSON.stringify(r.was).slice(1, -1)) && l.includes(q(r.slug))), `and the migration itself no longer writes it`)
  }
  // The connector that applies SQL to production hangs on a semicolon inside
  // a string literal, so a statement has exactly one: its last character.
  assert(live.every((l) => l.indexOf(';') === l.length - 1), 'no statement holds a semicolon inside its literal')

  // The generator refuses what would render a harmless-looking no-op or a lie.
  const refuses = (mutate, why) => {
    const bad = JSON.parse(JSON.stringify(seed))
    mutate(bad)
    let threw = null
    try { renderIngredientNames(bad, pair) } catch (e) { threw = e }
    assert(threw !== null, `the generator refuses ${why}`)
  }
  refuses((s) => { s.fuel_ingredient_renames[0].slug = 'no-such-meal' }, 'a rename for a meal that is not seeded')
  refuses((s) => { s.fuel_ingredient_renames[0].now.item = 'cumin seed' }, 'a rename the meal fixture does not carry')
  refuses((s) => { s.fuel_ingredient_renames[0].was.item = 'garlic powder' }, 'a rename whose old name is still in the meal')
  refuses((s) => { s.fuel_ingredient_renames = [] }, 'an empty list of renames')
  refuses((s) => { s.fuel_meals_new = [] }, 'a meal arriving in this fixture')
}

if (failures) { console.log(`\nfuel-ingredient-names: ${failures} of ${failures + passes} checks FAILED`); process.exit(1) }
console.log(`fuel-ingredient-names: ${passes} checks passed — one name and one unit per ingredient, and every menu's list has one line for each`)
