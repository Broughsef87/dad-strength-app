// ── Fuel rotations (FOR-238) — the standing invariant, its own file ─────────
// Kept apart from fuel-solve.mjs on purpose: a revert of the rotations feature
// must not delete the check that would catch the revert. It judges the DATA —
// the fixtures the seed migrations are generated from, whose parity with
// those migrations fuel-solve pins. FRESH_ONLY_CUTS is phase 1's rule for what
// a fish night is, the same rule the app enforces.
//   1. every rotation membership row resolves to a meal that exists
//   2. every rotation has exactly one fish night and one turkey night in each
//      week
//   3. every rotation has eight meals, four a week, and a meal that is in two
//      rotations is ONE meal row, never a duplicate
//   4. the soup fortnights (FOR-250): eight soups, one a week, in the ruled
//      order, each in one fortnight only — and adding them leaves rotations A
//      and B recognisable from a plan's picks
// If rotations are reverted, the rotation fixture is gone and this file fails
// loudly on reading it — that is the revert being caught.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { FRESH_ONLY_CUTS } from '../../src/lib/fuel/solve.ts'
// Section 4 has to ask the app's own question — "which rotation did this plan
// run?" — so it imports the functions that answer it. Sections 1-3 still
// import nothing from the feature.
import { defaultRotation, rotationEntries, rotationOf } from '../../src/lib/fuel/rotation.ts'

let failures = 0, passes = 0
const assert = (cond, msg) => { if (cond) passes++; else { failures++; console.log('  ✗ ' + msg) } }
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const read = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'))

const base = read('fixtures/fuel-seed.json')
const rot = read('fixtures/fuel-seed-rotation-b.json')
const expansion = read('fixtures/fuel-seed-library-expansion.json')
const rotC = read('fixtures/fuel-seed-rotation-c.json')
const library = [...base.fuel_meals, ...rot.fuel_meals_new, ...expansion.fuel_meals_new]
const bySlug = new Map(library.map((m) => [m.slug, m]))
const rotations = [...rot.fuel_rotations, ...rotC.fuel_rotations]
const members = [...rot.fuel_rotation_meals, ...rotC.fuel_rotation_meals]
const WEEKS = [1, 2]
const SOUP_FORTNIGHTS = ['rotation-c1', 'rotation-c2', 'rotation-c3', 'rotation-c4']

// ── 3. the shape: every rotation, eight meals each, four a week, one row per meal
assert(['rotation-a', 'rotation-b', ...SOUP_FORTNIGHTS].every((s) => rotations.some((r) => r.slug === s)), `rotation-a, rotation-b and the four soup fortnights all exist — got ${rotations.map((r) => r.slug).join(', ') || 'none'}`)
assert(rotations.length === 6 && new Set(rotations.map((r) => r.slug)).size === 6, `six rotations, each slug once — got ${rotations.map((r) => r.slug).join(', ')}`)
assert(new Set(rotations.map((r) => r.sort_order)).size === rotations.length, `every rotation has its own sort_order — got ${rotations.map((r) => r.sort_order).join(', ')}`)
assert(new Set(library.map((m) => m.slug)).size === library.length, 'every meal slug is one meal row — a meal in two rotations is never duplicated')
for (const r of rotations) {
  const mine = members.filter((x) => x.rotation_slug === r.slug)
  assert(mine.length === 8, `${r.slug} has 8 meals — got ${mine.length}`)
  assert(new Set(mine.map((x) => x.meal_slug)).size === mine.length, `${r.slug} lists each meal once`)
  for (const w of WEEKS) assert(mine.filter((x) => x.week === w).length === 4, `${r.slug} week ${w} has 4 nights — got ${mine.filter((x) => x.week === w).length}`)
}
for (const x of members) assert(rotations.some((r) => r.slug === x.rotation_slug), `${x.meal_slug}: its rotation ${x.rotation_slug} exists`)
assert(members.every((x) => WEEKS.includes(x.week)), 'every membership falls in week 1 or week 2')

// ── 1. every membership resolves to a meal
for (const x of members) assert(bySlug.has(x.meal_slug), `${x.rotation_slug}: ${x.meal_slug} resolves to a meal`)

// ── 2. one fish and one turkey, every week of every rotation
const isFish = (m) => FRESH_ONLY_CUTS.includes(m.protein_cut)
const isTurkey = (m) => m.protein_cut === 'ground_turkey'
const nightsOf = (slug, w) => members.filter((x) => x.rotation_slug === slug && x.week === w).map((x) => bySlug.get(x.meal_slug)).filter(Boolean)
for (const r of rotations) for (const w of WEEKS) {
  const nights = nightsOf(r.slug, w)
  const fish = nights.filter(isFish).map((m) => m.slug)
  const turkey = nights.filter(isTurkey).map((m) => m.slug)
  assert(fish.length === 1, `${r.slug} week ${w}: exactly 1 fish night — got ${fish.length} (${fish.join(', ') || 'none'})`)
  assert(turkey.length === 1, `${r.slug} week ${w}: exactly 1 turkey night — got ${turkey.length} (${turkey.join(', ') || 'none'})`)
}

// ── 4. the soup fortnights (FOR-250) ───────────────────────────────────────
// Andrew, 2026-10-09: all eight soups, one a week, in this order. 2026-10-10:
// as four fortnights, because fuel_rotation_meals holds weeks 1 and 2 only.
const SOUP_ORDER = [
  'beef-barley-stew', 'chicken-tortilla-soup', 'white-chicken-chili', 'italian-wedding-soup',
  'pork-green-chili', 'lentil-sausage-soup', 'turkey-chili', 'zuppa-toscana',
]
assert(!('fuel_meals_new' in rotC) && !('fuel_meals' in rotC), 'the soup-fortnight fixture adds no meal — rows only')
assert(rotC.fuel_rotations.map((r) => r.slug).join() === SOUP_FORTNIGHTS.join(), `the fixture seeds the four soup fortnights and nothing else — got ${rotC.fuel_rotations.map((r) => r.slug).join(', ')}`)
assert(rotC.fuel_rotation_meals.every((x) => SOUP_FORTNIGHTS.includes(x.rotation_slug)), 'the fixture adds no row to rotation A or rotation B')
assert(SOUP_ORDER.every((s) => bySlug.has(s)) && SOUP_ORDER.every((s) => expansion.fuel_meals_new.some((m) => m.slug === s)), 'all eight soups are library-expansion meals')
const soupOf = (slug, w) => nightsOf(slug, w).filter((m) => SOUP_ORDER.includes(m.slug)).map((m) => m.slug)
const served = SOUP_FORTNIGHTS.flatMap((slug) => WEEKS.map((w) => soupOf(slug, w)))
assert(served.every((s) => s.length === 1), `every week of every soup fortnight has exactly one soup — got ${JSON.stringify(served)}`)
assert(served.flat().join() === SOUP_ORDER.join(), `the soups run in the ruled order, one a week — got ${served.flat().join(', ')}`)
for (const s of SOUP_ORDER) {
  const homes = members.filter((x) => x.meal_slug === s).map((x) => x.rotation_slug)
  assert(homes.length === 1, `${s} is in exactly one rotation — got ${homes.join(', ') || 'none'}`)
}
// Each week is one of rotation A's or rotation B's own weeks with ONE dinner
// swapped for the soup: never the same week number from both, so a fortnight
// cannot repeat a dinner, and never a week assembled from loose meals.
const weekSlugs = (slug, w) => nightsOf(slug, w).map((m) => m.slug)
for (const slug of SOUP_FORTNIGHTS) {
  const sources = WEEKS.map((w) => {
    const mine = weekSlugs(slug, w).filter((s) => !SOUP_ORDER.includes(s))
    return ['rotation-a', 'rotation-b'].filter((src) => mine.length === 3 && mine.every((s) => weekSlugs(src, w).includes(s)))
  })
  assert(sources.every((s) => s.length >= 1), `${slug}: each week is three dinners of one existing rotation's same week, plus the soup — got ${JSON.stringify(sources)}`)
  // Steak is capped at two a month. One ribeye a fortnight at most means any
  // two fortnights back to back hold two at most.
  const ribeye = WEEKS.flatMap((w) => nightsOf(slug, w)).filter((m) => m.protein_cut === 'ribeye').length
  assert(ribeye <= 1, `${slug}: at most one ribeye a fortnight — got ${ribeye}`)
  // A soup over the cook cap would be dropped by rotationEntries without a word.
  const cap = base.fuel_household.cook_cap_minutes
  const over = WEEKS.flatMap((w) => nightsOf(slug, w)).filter((m) => m.active_cook_minutes > cap).map((m) => m.slug)
  assert(over.length === 0, `${slug}: every dinner is inside the ${cap}-minute active cook cap — over: ${over.join(', ')}`)
}

// ADDING ROTATIONS MUST NOT BLIND THE APP TO A AND B. rotationOf reads which
// rotation a plan ran from the picks that belong to ONE rotation alone, and
// defaultRotation starts the next cycle from the rotation not just run. Every
// A or B dinner a soup fortnight borrows stops being A's or B's alone. Borrow
// the wrong ones and a finished rotation A reads as "no rotation", so the next
// cycle starts from A again — the family eats the same eight twice, which is
// the complaint rotation B exists to answer. This is the app's own question,
// asked of the app's own functions, with every seeded rotation in play.
{
  const household = { ...base.fuel_household, cook_cap_minutes: base.fuel_household.cook_cap_minutes, nights_per_week: base.fuel_household.nights_per_week, shop_cadence_days: 14 }
  const plan = (slug) => rotationEntries(slug, members, library, household)
  for (const r of rotations) {
    const entries = plan(r.slug)
    assert(entries.length === 8, `${r.slug}: a fortnight plan started from it holds all 8 dinners — got ${entries.length}`)
    assert(rotationOf(entries, rotations, members) === r.slug, `a plan started from ${r.slug} reads back as ${r.slug} — got ${rotationOf(entries, rotations, members)}`)
  }
  assert(defaultRotation(rotations, rotationOf(plan('rotation-a'), rotations, members)) === 'rotation-b', 'after rotation A the next cycle still starts from rotation B')
  assert(defaultRotation(rotations, rotationOf(plan('rotation-b'), rotations, members)) === 'rotation-a', 'after rotation B the next cycle still starts from rotation A')
  // Nothing advances INTO a soup fortnight on its own: Andrew picks it.
  for (const slug of SOUP_FORTNIGHTS) {
    const next = defaultRotation(rotations, rotationOf(plan(slug), rotations, members))
    assert(next === 'rotation-a', `after ${slug} the next cycle starts from rotation A, not another soup fortnight — got ${next}`)
  }
  // The margin, measured: how many of its own dinners each of A and B keeps.
  // Rotation A is the one that matters — misreading B still lands on A next.
  const alone = (slug) => members.filter((x) => x.rotation_slug === slug && members.filter((y) => y.meal_slug === x.meal_slug).length === 1).map((x) => x.meal_slug)
  assert(alone('rotation-a').length >= 4, `rotation A keeps at least four dinners that are its alone — got ${alone('rotation-a').join(', ') || 'none'}`)
  assert(alone('rotation-b').length >= 1, `rotation B keeps at least one dinner that is its alone — got ${alone('rotation-b').join(', ') || 'none'}`)
  // One swapped night must not lose rotation A: any single dinner replaced by
  // a soup still reads as A.
  const a = plan('rotation-a')
  for (let i = 0; i < a.length; i++) {
    const swappedOne = a.map((e, n) => (n === i ? { ...e, slug: 'beef-barley-stew' } : e))
    assert(rotationOf(swappedOne, rotations, members) === 'rotation-a',
      `rotation A with ${a[i].slug} swapped for a soup still reads as rotation A — got ${rotationOf(swappedOne, rotations, members)}`)
  }
}

if (failures) { console.log(`\nfuel-rotations: ${failures} of ${failures + passes} checks FAILED`); process.exit(1) }
console.log(`fuel-rotations: ${passes} checks passed — every member resolves, one fish and one turkey a week, six rotations each read back as themselves`)
