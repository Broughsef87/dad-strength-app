// ── Fuel rotations (FOR-238) — the standing invariant, its own file ─────────
// Kept apart from fuel-solve.mjs on purpose: a revert of the rotations feature
// must not delete the check that would catch the revert. It judges the DATA —
// the two fixtures the seed migrations are generated from, whose parity with
// those migrations fuel-solve pins — and imports nothing from the feature's
// code. The one import, FRESH_ONLY_CUTS, is phase 1's rule for what a fish
// night is, the same rule the app enforces.
//   1. every rotation membership row resolves to a meal that exists
//   2. every rotation has exactly one fish night and one turkey night in each
//      week
//   3. both rotations exist with eight meals, four a week, and a meal that is
//      in two rotations is ONE meal row, never a duplicate
// If rotations are reverted, the rotation fixture is gone and this file fails
// loudly on reading it — that is the revert being caught.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { FRESH_ONLY_CUTS } from '../../src/lib/fuel/solve.ts'

let failures = 0, passes = 0
const assert = (cond, msg) => { if (cond) passes++; else { failures++; console.log('  ✗ ' + msg) } }
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const read = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'))

const base = read('fixtures/fuel-seed.json')
const rot = read('fixtures/fuel-seed-rotation-b.json')
const library = [...base.fuel_meals, ...rot.fuel_meals_new]
const bySlug = new Map(library.map((m) => [m.slug, m]))
const rotations = rot.fuel_rotations
const members = rot.fuel_rotation_meals
const WEEKS = [1, 2]

// ── 3. the shape: both rotations, eight meals each, four a week, one row per meal
assert(['rotation-a', 'rotation-b'].every((s) => rotations.some((r) => r.slug === s)), `rotation-a and rotation-b both exist — got ${rotations.map((r) => r.slug).join(', ') || 'none'}`)
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
for (const r of rotations) for (const w of WEEKS) {
  const nights = members.filter((x) => x.rotation_slug === r.slug && x.week === w).map((x) => bySlug.get(x.meal_slug)).filter(Boolean)
  const fish = nights.filter(isFish).map((m) => m.slug)
  const turkey = nights.filter(isTurkey).map((m) => m.slug)
  assert(fish.length === 1, `${r.slug} week ${w}: exactly 1 fish night — got ${fish.length} (${fish.join(', ') || 'none'})`)
  assert(turkey.length === 1, `${r.slug} week ${w}: exactly 1 turkey night — got ${turkey.length} (${turkey.join(', ') || 'none'})`)
}

if (failures) { console.log(`\nfuel-rotations: ${failures} of ${failures + passes} checks FAILED`); process.exit(1) }
console.log(`fuel-rotations: ${passes} checks passed — every member resolves, one fish and one turkey a week`)
