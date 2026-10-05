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
import { readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { PAIRS, seededSlugs, renderLibraryExpansion, renderPair, EXPANSION_FIXTURE } from '../fuel-seed-sql.mjs'
import { FRESH_ONLY_CUTS } from '../../src/lib/fuel/solve.ts'
import { STEAK_CUT } from '../../src/lib/fuel/record.ts'

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
// EXACTLY the 24, and nothing beside them. Naming each slug once left room for
// a 25th tuple and for an appended statement: both passed every check (Codex
// r1 P3). So the tuples are counted, the statements are counted, and the
// revert's slug list is compared as a SET rather than searched for members.
{
  const expected = expansion.fuel_meals_new.map((m) => m.slug)
  const tuples = (body.match(/^  \('/gm) ?? []).length
  assert(tuples === expected.length, `the migration holds exactly ${expected.length} meal tuples — it holds ${tuples}`)
  const statements = (mig.match(/\bINSERT INTO\b/gi) ?? []).length
  assert(statements === 1, `and exactly one INSERT statement — it has ${statements}`)
  // Counted in the SQL BODY, never in the header: the header legitimately
  // holds semicolons, in prose and in the revert it quotes.
  const terminators = (body.match(/;/g) ?? []).length
  assert(terminators === 1, `and the body ends in exactly one statement terminator — it has ${terminators}`)
  // Every slug quoted in the INSERT, as a set: an extra one fails here even
  // though every expected slug is still present.
  const inserted = [...body.matchAll(/^  \('([^']+)'/gm)].map((m) => m[1])
  assert(inserted.join('|') === expected.join('|'),
    `the inserted slugs are exactly the fixture's, in order — extra: ${inserted.filter((x) => !expected.includes(x)).join(', ') || 'none'}; missing: ${expected.filter((x) => !inserted.includes(x)).join(', ') || 'none'}`)
  // The revert too. An extra slug there is worse than a missing one: adding
  // `cast-iron-ribeye` makes the DELETE fail on its membership foreign key, so
  // the revert does nothing at all and the expansion stays installed.
  const header = mig.slice(0, mig.indexOf('INSERT INTO public.fuel_meals'))
  const reverted = [...header.matchAll(/^--\s+'([^']+)',?$/gm)].map((m) => m[1])
  assert(reverted.join('|') === expected.join('|'),
    `the revert names exactly the 24 — extra: ${reverted.filter((x) => !expected.includes(x)).join(', ') || 'none'}; missing: ${expected.filter((x) => !reverted.includes(x)).join(', ') || 'none'}`)
}
assert(/INSERT INTO public\.fuel_rotation/.test(mig) === false, 'and it writes no rotation or membership row')
assert(/DELETE FROM public\.fuel_meals WHERE slug IN \(/.test(mig), 'its header carries the exact revert')
// (the revert is compared as a set above — a per-slug `includes` could not see
// an EXTRA slug, which is the shape that breaks the DELETE)

// ── 7. no migration other than this pair's writes fuel_meals rows ─────────
// A second file inserting the same slugs would make the fixture stop being the
// source: --check would pass while the database held something else.
{
  const dir = join(ROOT, 'supabase', 'migrations')
  const generated = new Set(PAIRS.map((p) => p.migration.split('/').pop()))
  // ANY statement that writes the table, however it is spelled. The search
  // was the exact text `INSERT INTO public.fuel_meals`, so an UPDATE, a
  // DELETE, an unqualified name or a lowercase keyword all slipped past it
  // (Codex r1 P3) — and a stray UPDATE is the worst of them, because it
  // rewrites a meal while --check stays green.
  const WRITES = /\b(insert\s+into|update|delete\s+from)\s+(public\s*\.\s*)?fuel_meals\b/i
  const strays = readdirSync(dir)
    .filter((n) => n.endsWith('.sql') && !generated.has(n))
    .filter((n) => WRITES.test(readLF(`supabase/migrations/${n}`)))
  assert(strays.length === 0, `only a pair's own migration writes fuel_meals rows — also written by ${strays.join(', ')}`)
  // And the search BITES, so the loop above is not vacuous: the pair's own
  // migration is the one file it would have named.
  assert(WRITES.test(mig), 'and the search recognises a write when it sees one')
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

  // EVERY seeded slug, not the first one. Deleting rotation B from the
  // generator's inventory left all 375 checks green, because the probe only
  // ever tried a phase-1 slug (Codex r1 P2).
  for (const taken of seededSlugs(EXPANSION_FIXTURE)) {
    refuses(`a slug already seeded as "${taken}"`, (j) => { j.fuel_meals_new[0].slug = taken }, /already a seeded meal/)
  }
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

// ── 9. a macro that is estimated rather than null is REFUSED, and that is run ─
// FOR-234 §4: no seed migration carries macros yet, so a macro has to be
// present and null until it is measured. The section used to assert only that
// the fixture as authored satisfies that, which is a different claim: deleting
// the non-null rejection from guardMacros left all 375 checks green (Codex r1
// P3). The guard is called here instead.
{
  const pair = PAIRS.find((p) => p.fixture === EXPANSION_FIXTURE)
  assert(!!pair, 'the expansion has a pair in the generator')
  const expansion9 = read(EXPANSION_FIXTURE)
  for (const m of expansion9.fuel_meals_new) {
    for (const k of ['carbs_g_per_person', 'fat_g_per_person', 'calories_per_person']) {
      assert(k in m, `${m.slug} carries ${k}`)
      assert(m[k] === null, `${m.slug}: ${k} is null until it is measured — it is ${JSON.stringify(m[k])}`)
    }
  }
  // RUN: renderPair reads the fixture from disk, so the guard is reached
  // through a temporary copy of the pair pointed at a written fixture.
  const probe = 'fixtures/.for257-macro-probe.json'
  const probePath = join(ROOT, probe)
  const runGuard = (label, mutate, expect) => {
    const j = JSON.parse(JSON.stringify(expansion9))
    mutate(j)
    writeFileSync(probePath, JSON.stringify(j, null, 2))
    let threw = null
    try { renderPair({ ...pair, fixture: probe }) } catch (e) { threw = e }
    rmSync(probePath, { force: true })
    assert(threw !== null, `the generator REFUSES ${label}`)
    assert(threw === null || expect.test(threw.message), `and says why — ${label}: ${threw?.message?.slice(0, 90) ?? ''}`)
  }
  runGuard('an estimated calorie figure', (j) => { j.fuel_meals_new[0].calories_per_person = 999 }, /no seed migration carries macros/)
  runGuard('an estimated carb figure', (j) => { j.fuel_meals_new[1].carbs_g_per_person = 40 }, /no seed migration carries macros/)
  runGuard('a macro key that is missing entirely', (j) => { delete j.fuel_meals_new[2].fat_g_per_person }, /missing fat_g_per_person/)
  // And it accepts the fixture as authored, through the same route.
  writeFileSync(probePath, JSON.stringify(expansion9, null, 2))
  let ok9 = null
  try { renderPair({ ...pair, fixture: probe }) } catch (e) { ok9 = e }
  rmSync(probePath, { force: true })
  assert(ok9 === null, `and renders the fixture as authored — ${ok9?.message ?? ''}`)
}

// ── 9b. the protein quantities say they are estimates ─────────────────────
// _provenance.SOURCED: "Nothing here is measured... Every quantity, time and
// protein figure is Blaine's estimate... PLAUSIBLE, NOT MEASURED." Every
// Meat & Seafood line carried `inferred: false`, which the checklist renders
// as exact under a legend reading "The proteins are exact" (Codex r1 P2). In
// the seeded 13 that flag is CORRECT — phase 1's protein figures are Andrew's
// own portions. This is about these 24.
{
  const expansion9b = read(EXPANSION_FIXTURE)
  for (const m of expansion9b.fuel_meals_new) {
    for (const i of m.ingredients) {
      if (i.store_section === 'Meat & Seafood') {
        assert(i.inferred === true, `${m.slug}: "${i.item}" is marked an estimate — the fixture says nothing in it is measured`)
      }
      // And an ingredient whose NAME says frozen is bought in Frozen: in
      // Produce it goes to the second trip, which is the wrong aisle and a
      // later trip for something that keeps (Codex r1 P3).
      if (/frozen/i.test(i.item)) {
        assert(i.store_section === 'Frozen', `${m.slug}: "${i.item}" is bought in Frozen — it is in ${i.store_section}`)
      }
    }
  }
}

// ── 10. EVERY CUT IN THE LIBRARY IS CLASSIFIED FOR ITS TRIP ───────────────
// `isSecondTrip` sends a week-2 Meat & Seafood line to the second trip only
// when the meal's cut is in FRESH_ONLY_CUTS — a hand-written list. FOR-257
// added shrimp, mahi and haddock, and until the list was widened a week-2
// night cooking any of them bought its fish on the FIRST trip: bought day one,
// cooked day eight or later.
//
// A list nobody is forced to maintain goes stale on the next fish. So every
// cut in the library has to be in exactly one of the two sets below, and a new
// one that is in neither FAILS here rather than defaulting into the wrong
// trip. FREEZES is the complement, declared so the classification is
// exhaustive; the app only needs the fresh half.
{
  const FREEZES = [
    'ribeye', 'chuck', 'flank', 'ground_beef',
    'chicken_thigh', 'chicken_breast', 'chicken_sausage',
    'ground_turkey',
    'pork_shoulder', 'pork_tenderloin', 'pork_chop',
  ]
  const fresh = [...FRESH_ONLY_CUTS]
  const cuts = [...new Set(PAIRS.flatMap((p) => p.meals(read(p.fixture)).map((m) => m.protein_cut)))].sort()
  for (const c of cuts) {
    const inFresh = fresh.includes(c)
    const inFreezes = FREEZES.includes(c)
    assert(inFresh || inFreezes, `"${c}" is classified — bought fresh (FRESH_ONLY_CUTS) or frozen (this file); an unclassified cut buys week 2 on the first trip`)
    assert(!(inFresh && inFreezes), `"${c}" is in one set, not both`)
  }
  // The four the expansion added, named rather than left to the loop: this is
  // the defect, and it should fail by name if anyone narrows the list again.
  for (const c of ['shrimp', 'mahi', 'haddock']) {
    assert(fresh.includes(c), `"${c}" is bought fresh — a week-2 night would otherwise buy it on the first trip, eight days early`)
  }
  // And the rule still BITES where it did before, so widening it changed
  // nothing for the seeded 13.
  for (const c of ['salmon', 'cod_halibut']) assert(fresh.includes(c), `"${c}" is still bought fresh`)
  for (const c of ['chicken_thigh', 'ground_turkey']) {
    assert(!fresh.includes(c), `"${c}" still freezes — the fixture marks it MORE perishable than salmon, so a shelf-life threshold would have moved it`)
  }
}

// ── 11. the steak cap knows which cuts it counts, and says so ─────────────
// STEAK_CUT is a single cut, 'ribeye'. FOR-257 adds flank, which the ticket's
// own §7 says "counts against the monthly steak cap with the ribeye" — and the
// code does not count it. Adding flank to the rule would also count
// beef-and-broccoli, which is flank in a stir-fry and nobody's steak night, so
// the cut alone cannot decide it. REPORTED, not guessed: this asserts the
// current behaviour so the gap is visible rather than assumed either way.
{
  const byCut = (cut) => PAIRS.flatMap((p) => p.meals(read(p.fixture))).filter((m) => m.protein_cut === cut).map((m) => m.slug)
  assert(STEAK_CUT === 'ribeye', `the steak cap counts exactly one cut — it counts ${STEAK_CUT}`)
  assert(byCut('ribeye').length === 1, `and one meal has it — ${byCut('ribeye').join(', ')}`)
  const flank = byCut('flank')
  assert(flank.length === 2 && flank.includes('flank-chimichurri') && flank.includes('beef-and-broccoli'),
    `flank is two meals, one a steak night and one a stir-fry — ${flank.join(', ')}; that is why the cap cannot be fixed by naming the cut`)
}

// ── verdict ─────────────────────────────────────────────────────────────────
if (fails.length) {
  console.log(`\nfuel library slugs: ${fails.length} of ${checks} checks FAILED`)
  for (const f of fails) console.log('  ✗ ' + f)
  process.exit(1)
}
console.log(`fuel library slugs: ${checks} checks passed — 37 seeded slugs, each once, none in the own-meal namespace`)
