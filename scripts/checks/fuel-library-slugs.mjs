// ── Fuel library slugs (FOR-257) — the standing invariant, its own file ─────
//
// A MEAL SLUG IS A FOREIGN KEY. It is held in fuel_rotation_meals, in
// fuel_plans.meal_ids and in every stored shopping list, and every seed
// migration upserts ON CONFLICT (slug) DO UPDATE. So a slug that collides does
// not fail — it silently REWRITES a meal the family already eats, and a
// rotation that pointed at the old dish now points at a different dinner.
//
// Two namespaces must never meet. The seeded library is authored in fixtures;
// an own meal is minted by a user at runtime under `u<32hex>~` (FOR-242). A
// seeded slug landing in that namespace would make a library meal look like
// somebody's private one, and the reverse would let a user's meal be
// overwritten by a migration.
//
// Its own file, so a revert of the expansion cannot take the check with it.
// Separate from fuel-solve.mjs (the solver), fuel-rotations.mjs (membership)
// and fuel-vocabulary.mjs (the picker): this is a property of the slug space
// alone, whatever feature changes next.
//
//   node --import tsx scripts/checks/fuel-library-slugs.mjs   (run-all does this)
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { PAIRS, seededSlugs, renderLibraryExpansion } from '../fuel-seed-sql.mjs'

let checks = 0
const fails = []
const assert = (cond, msg) => { checks++; if (!cond) fails.push(msg) }

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const read = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'))
const readLF = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')

// The namespace rule, imported for its BEHAVIOUR from the module the app uses.
// A tree where it is not exported is a tree this check must FAIL on, with a
// message, rather than crash on before a single assertion has run.
let isOwnSlug = null
let ownError = null
try {
  isOwnSlug = (await import('../../src/lib/fuel/ownMeal.ts')).isOwnSlug
} catch (e) {
  ownError = e
}

// ── 1. every slug in every fixture, counted once ───────────────────────────
// Read off the PAIRS rather than a list written here: a fourth fixture added
// without touching this file is still judged, and a pair whose meals move to a
// different key cannot quietly drop out of the count.
const perFixture = PAIRS.map((p) => {
  const seed = read(p.fixture)
  return { fixture: p.fixture, slugs: p.meals(seed).map((m) => m.slug) }
})
assert(perFixture.length >= 3, `every seed fixture is judged — found ${perFixture.length} pairs`)
const all = perFixture.flatMap((f) => f.slugs)
assert(all.length === 37, `the seeded library is 37 meals — it is ${all.length}`)

const seen = new Map()
for (const f of perFixture) {
  for (const s of f.slugs) {
    const where = seen.get(s)
    assert(where === undefined, `"${s}" is seeded twice — in ${where} and again in ${f.fixture}; an upsert on (slug) would rewrite the first`)
    seen.set(s, f.fixture)
  }
}

// ── 2. nothing seeded is in the own-meal namespace ─────────────────────────
assert(ownError === null, `src/lib/fuel/ownMeal.ts exports isOwnSlug — ${ownError?.message ?? ''}`)
if (isOwnSlug) {
  for (const s of all) assert(!isOwnSlug(s), `"${s}" is in the own-meal namespace FOR-242 reserved`)
  // And the rule BITES, so the loop above is not vacuous: a minted slug is
  // recognised, a seeded one is not.
  assert(isOwnSlug('u00000000000000000000000000000000~anything'), 'a minted own-meal slug is recognised as one')
  assert(!isOwnSlug('beef-barley-stew'), 'and a seeded slug is not')
}

// ── 3. the generator's COPY of that rule has not drifted from it ───────────
// scripts/fuel-seed-sql.mjs runs under plain `node` for `--check`, so it
// cannot import the .ts module and holds its own regex. One fact, written
// twice, and this is what keeps the second copy honest.
const genSrc = readLF('scripts/fuel-seed-sql.mjs')
const ownSrc = readLF('src/lib/fuel/ownMeal.ts')
const genRe = /const OWN_SLUG = (\/.+\/)\n/.exec(genSrc)?.[1]
const appRe = /isOwnSlug = \(slug: string\): boolean => (\/.+\/)\.test/.exec(ownSrc)?.[1]
assert(!!genRe, 'the generator names its own-meal namespace regex as OWN_SLUG')
assert(!!appRe, 'and src/lib/fuel/ownMeal.ts names its own')
assert(!!genRe && genRe === appRe, `the two copies are the same pattern — generator ${genRe} vs app ${appRe}`)

// ── 4. a slug is a lowercase kebab token, so it reads as an identifier ─────
// Not cosmetic: these appear in SQL the generator quotes, in URLs and in
// stored list keys. A slug with a quote, a space or an upper-case letter is
// the kind of thing that works until the one place that does not quote it.
for (const s of all) {
  assert(/^[a-z][a-z0-9-]*[a-z0-9]$/.test(s), `"${s}" is a lowercase kebab token`)
  assert(!s.includes('--'), `"${s}" has no doubled hyphen`)
}

// ── 5. the expansion is LIBRARY ONLY, and its fixture cannot carry rotations ─
// FOR-257 §3: all 37 become pickable night by night and the rotations get
// assembled later from what the family keeps. The generator refuses rotation
// rows in this fixture; this says the fixture has not grown them.
const expansion = read('fixtures/fuel-seed-library-expansion.json')
for (const key of ['fuel_rotations', 'fuel_rotation_meals']) {
  assert(!(key in expansion), `the expansion fixture carries no ${key} — a rotation gets its own fixture and pair`)
}
assert(expansion.fuel_meals_new.length === 24, `the expansion is 24 meals — it is ${expansion.fuel_meals_new.length}`)

// ── 6. and the migration on disk inserts exactly those slugs, once each ────
// The pair's --check proves the file matches the fixture. This proves the file
// says what the fixture MEANS: every slug present, nothing else inserted, and
// no table touched.
const mig = readLF('supabase/migrations/20261005_fuel_library_expansion.sql')
const body = mig.slice(mig.indexOf('INSERT INTO public.fuel_meals'))
for (const s of expansion.fuel_meals_new.map((m) => m.slug)) {
  assert((body.match(new RegExp(`'${s}'`, 'g')) ?? []).length === 1,
    `the migration inserts "${s}" exactly once`)
}
assert(!/CREATE TABLE|ALTER TABLE|CREATE POLICY|CREATE INDEX|DROP |CREATE OR REPLACE/.test(mig),
  'the expansion migration creates, alters and drops nothing — it is meal rows only')
assert(/INSERT INTO public\.fuel_rotation/.test(mig) === false, 'and it writes no rotation or membership row')
assert(/DELETE FROM public\.fuel_meals WHERE slug IN \(/.test(mig), 'its header carries the exact revert')
for (const s of expansion.fuel_meals_new.map((m) => m.slug)) {
  assert(mig.slice(0, mig.indexOf('INSERT INTO public.fuel_meals')).includes(`'${s}'`),
    `and the revert names "${s}" — a revert that misses a slug leaves a meal behind`)
}

// ── 7. no migration other than this pair's writes fuel_meals rows ─────────
// A second file inserting the same slugs would make the fixture stop being the
// source: --check would pass while the database held something else.
{
  const dir = join(ROOT, 'supabase', 'migrations')
  const generated = new Set(PAIRS.map((p) => p.migration.split('/').pop()))
  const strays = readdirSync(dir)
    .filter((n) => n.endsWith('.sql') && !generated.has(n))
    .filter((n) => /INSERT INTO public\.fuel_meals/.test(readLF(`supabase/migrations/${n}`)))
  assert(strays.length === 0, `only a pair's own migration seeds fuel_meals — also written by ${strays.join(', ')}`)
}

// ── 8. THE GENERATOR'S GUARDS, RUN RATHER THAN READ ───────────────────────
// Every assertion above judges the fixture as it stands. None of them notices
// a guard being deleted, because a valid fixture never reaches one — found by
// mutation: removing each guard in turn left every suite green (FOR-257).
// So the renderer is called here with deliberately broken seeds, and each one
// has to come back refused. This is the difference between a guard that exists
// and a guard that fires.
{
  const good = read('fixtures/fuel-seed-library-expansion.json')
  const clone = () => JSON.parse(JSON.stringify(good))
  const refuses = (label, mutate, expect) => {
    const seed = clone()
    mutate(seed)
    let threw = null
    try { renderLibraryExpansion(seed) } catch (e) { threw = e }
    assert(threw !== null, `the generator REFUSES ${label}`)
    assert(threw === null || expect.test(threw.message), `and says why — ${label}: ${threw?.message?.slice(0, 90) ?? ''}`)
  }

  refuses('a slug that is already seeded', (j) => { j.fuel_meals_new[0].slug = seededSlugs()[0] }, /already a seeded meal/)
  refuses('a slug in the own-meal namespace', (j) => { j.fuel_meals_new[0].slug = 'u00000000000000000000000000000000~mine' }, /own-meal namespace/)
  refuses('a slug duplicated inside the fixture', (j) => { j.fuel_meals_new[0].slug = j.fuel_meals_new[1].slug }, /appears twice/)
  refuses('a slug that is not a kebab token', (j) => { j.fuel_meals_new[0].slug = 'Beef Stew!' }, /kebab token/)
  refuses('a slug with a leading hyphen', (j) => { j.fuel_meals_new[0].slug = '-beef-stew' }, /kebab token/)
  refuses('a slug with a doubled hyphen', (j) => { j.fuel_meals_new[0].slug = 'beef--stew' }, /kebab token/)
  refuses('a slug holding a quote', (j) => { j.fuel_meals_new[0].slug = "beef'stew" }, /kebab token/)
  refuses('rotation membership in this fixture', (j) => { j.fuel_rotation_meals = [] }, /LIBRARY only/)
  refuses('a rotation in this fixture', (j) => { j.fuel_rotations = [] }, /LIBRARY only/)

  // And it ACCEPTS the fixture as authored, so the probes above are refusals
  // of the defect rather than of everything.
  let ok = null
  try { renderLibraryExpansion(clone()) } catch (e) { ok = e }
  assert(ok === null, `and it renders the fixture as authored — ${ok?.message ?? ''}`)
}

// ── 9. a macro that is estimated rather than null is refused, with words ───
// FOR-234 §4: no seed migration carries macros yet. The guard lives in
// renderPair, and until FOR-257 it surfaced as an unhandled stack trace.
{
  const pair = PAIRS.find((p) => p.fixture === 'fixtures/fuel-seed-library-expansion.json')
  assert(!!pair, 'the expansion has a pair in the generator')
  const expansion = read('fixtures/fuel-seed-library-expansion.json')
  for (const m of expansion.fuel_meals_new) {
    for (const k of ['carbs_g_per_person', 'fat_g_per_person', 'calories_per_person']) {
      assert(k in m, `${m.slug} carries ${k}`)
      assert(m[k] === null, `${m.slug}: ${k} is null until it is measured — it is ${JSON.stringify(m[k])}`)
    }
  }
}

// ── verdict ─────────────────────────────────────────────────────────────────
if (fails.length) {
  console.log(`\nfuel library slugs: ${fails.length} of ${checks} checks FAILED`)
  for (const f of fails) console.log('  ✗ ' + f)
  process.exit(1)
}
console.log(`fuel library slugs: ${checks} checks passed — 37 seeded slugs, each once, none in the own-meal namespace`)
