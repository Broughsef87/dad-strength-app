// ── Fuel: the menu a plan was built from (FOR-279) — a standing check, its own file ──
//
// Which menu a plan ran decides where the NEXT plan starts: the menu not just
// run. It used to be read back from the plan's nights — the menu with the most
// picked dinners that belong to it alone (rotationOf). The four soup menus
// share all but two of their dinners with the everyday ones, so that reading
// fails as soon as a plan is not the menu's full eight: a cook cap that leaves
// the soups out, three cook-nights a week, one swapped night.
//
// The menu is now RECORDED on the plan when it is built, and read from there.
// What this holds:
//   1. a plan built from each of the six menus records that menu and reports
//      it, for every household shape — and reading the nights alone does NOT,
//      which is the failure this exists for
//   2. the record is what the builder STARTED from only while the nights are
//      still mostly that menu's: a hand-rebuilt plan is not held to its start
//   3. the old reading is the fallback: a plan with no record, or a record
//      naming a menu that is gone, is read from its nights as before
//   4. the next plan starts from the menu not just run, read from the record
//   5. the record travels: the builder sends it, the one write stores it, the
//      read asks for it and survives a database that does not have it yet
//   6. recording the menu does not make any stored plan read as changed
//   7. the migration is one generated column and nothing else
//
// Kept apart from fuel-rotations.mjs (the data) and fuel-solve.mjs (the
// solver): a revert of the record must not take the check that would catch it.
//
//   node --import tsx scripts/checks/fuel-plan-rotation.mjs   (run-all does this)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { builderStart, builderStartRotation, chosenRotation, defaultRotation, planRotation, rotationEntries, rotationJustRun, rotationOf } from '../../src/lib/fuel/rotation.ts'
import { changed, snapshot, snapshotKey } from '../../src/lib/fuel/version.ts'
import { createVersion, loadActive } from '../../src/lib/fuel/store.ts'
import * as planBuilderModule from '../../src/components/fuel/PlanBuilder.tsx'

let failures = 0, passes = 0
const assert = (cond, msg) => { if (cond) passes++; else { failures++; console.log('  ✗ ' + msg) } }
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const readLF = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')
const read = (rel) => JSON.parse(readLF(rel))
// A .tsx component imported from this .mjs arrives CommonJS-wrapped under tsx.
const unwrap = (mod) => { const e = mod.default && typeof mod.default === 'object' ? mod.default : mod; return typeof e.default === 'function' ? e.default : mod.default }
const PlanBuilder = unwrap(planBuilderModule)

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
// A weekly shop with a 20-minute cook cap: the household the old reading fails worst for.
const TIGHT = { ...andrew, cook_cap_minutes: 20, shop_cadence_days: 7 }
const SLUGS = ['rotation-a', 'rotation-b', 'rotation-c1', 'rotation-c2', 'rotation-c3', 'rotation-c4']
assert(rotations.length === 6 && SLUGS.every((s) => rotations.some((r) => r.slug === s)), `all six menus are judged — got ${rotations.map((r) => r.slug).join(', ')}`)

// A plan as the page builds it: the builder's picks and the menu they are,
// through the same function the builder calls.
const built = (slug, household, edit = (e) => e) => {
  const entries = edit(rotationEntries(slug, members, meals, household))
  return { entries, rotation: chosenRotation(slug, entries, rotations, members) }
}
// …and as it comes back from the database: the nights, and the column the
// database generates from the snapshot's key.
const stored = (plan, household, at = {}) => ({ week_start: '2026-10-12', version: 1, meal_ids: plan.entries, rotation_slug: snapshot(household, plan).rotation_slug ?? null, ...at })

// ── 1. every menu, every household shape: built from it, reports it ──────────
{
  // The ticket's own sentence.
  const c3 = built('rotation-c3', andrew)
  assert(c3.entries.length === 8 && snapshot(andrew, c3).rotation_slug === 'rotation-c3', `a plan built from rotation-c3 carries rotation-c3 in what is stored — got ${snapshot(andrew, c3).rotation_slug}`)
  assert(planRotation(stored(c3, andrew), rotations, members) === 'rotation-c3', 'and a plan built from rotation-c3 reports c3')

  let shapes = 0, misread = 0
  const misreadAt = []
  for (const cap of [15, 20, 25, 30, 45]) for (const nights of [1, 2, 3, 4]) for (const cadence of [7, 14]) {
    const household = { ...andrew, cook_cap_minutes: cap, nights_per_week: nights, shop_cadence_days: cadence }
    for (const slug of SLUGS) {
      const plan = built(slug, household)
      if (plan.entries.length === 0) continue
      shapes++
      const row = stored(plan, household)
      assert(row.rotation_slug === slug, `${slug}, cap ${cap}, ${nights} nights, ${cadence}-day shop: the build records ${slug} — got ${row.rotation_slug}`)
      assert(planRotation(row, rotations, members) === slug, `${slug}, cap ${cap}, ${nights} nights, ${cadence}-day shop: the plan reports ${slug} — got ${planRotation(row, rotations, members)}`)
      if (rotationOf(plan.entries, rotations, members) !== slug) { misread++; if (misreadAt.length < 3) misreadAt.push(`${slug} at cap ${cap}, ${nights} nights, ${cadence}-day reads as ${rotationOf(plan.entries, rotations, members)}`) }
    }
  }
  assert(shapes > 150, `the household shapes are real plans, not empty ones — ${shapes} judged`)
  // NOT VACUOUS: the nights alone get some of these wrong. If this ever
  // reads zero, the record has stopped being what makes section 1 pass.
  assert(misread > 0, `reading the nights alone misreads some of those plans — the failure the record is for (${misread} of ${shapes}; e.g. ${misreadAt.join('; ') || 'none'})`)

  // Two of them by name. A weekly shop cooks week one only: soup menu 3's
  // week-one soup is 25 active minutes, so a 20-minute cap leaves it out and
  // what is left is three dinners every other menu has too.
  const c3tight = built('rotation-c3', TIGHT)
  assert(c3tight.entries.length === 3 && !c3tight.entries.some((e) => e.slug === 'pork-green-chili'), `a weekly shop at a 20-minute cap leaves soup menu 3 its three shared dinners — got ${c3tight.entries.map((e) => e.slug).join(', ')}`)
  assert(rotationOf(c3tight.entries, rotations, members) === null, 'the nights alone say no menu at all')
  assert(planRotation(stored(c3tight, TIGHT), rotations, members) === 'rotation-c3', 'the plan still reports c3')
  // And the everyday one, with no cap in the way: menu 1's week one is four
  // dinners the other menus borrow, so every weekly plan of it read as nothing.
  const weekly = { ...andrew, shop_cadence_days: 7 }
  const aWeekly = built('rotation-a', weekly)
  assert(aWeekly.entries.length === 4 && rotationOf(aWeekly.entries, rotations, members) === null, 'a weekly plan of menu 1 is four dinners that say nothing on their own')
  assert(planRotation(stored(aWeekly, weekly), rotations, members) === 'rotation-a', 'and the plan reports menu 1')
}

// ── 2. the start holds while the nights are mostly its own ───────────────────
{
  const outside = meals.filter((m) => !members.some((x) => x.meal_slug === m.slug)).map((m) => m.slug)
  assert(outside.length >= 2, 'there are meals in no menu to swap in')
  for (const slug of SLUGS) {
    const entries = rotationEntries(slug, members, meals, andrew)
    for (let i = 0; i < entries.length; i++) {
      const swapped = entries.map((e, k) => (k === i ? { ...e, slug: outside[0] } : e))
      assert(chosenRotation(slug, swapped, rotations, members) === slug, `${slug} with ${entries[i].slug} swapped out is still ${slug} — got ${chosenRotation(slug, swapped, rotations, members)}`)
    }
  }
  // Rebuilt by hand into another menu: the start no longer describes it.
  const b = rotationEntries('rotation-b', members, meals, andrew)
  assert(chosenRotation('rotation-a', b, rotations, members) === 'rotation-b', `started from menu A and rebuilt into menu B's eight is menu B — got ${chosenRotation('rotation-a', b, rotations, members)}`)
  const own = outside.slice(0, 2).map((slug) => ({ slug, week: 1, servings: 2 }))
  assert(chosenRotation('rotation-a', own, rotations, members) === null, 'started from menu A and replaced with meals from no menu is no menu')
  assert(chosenRotation('rotation-a', [], rotations, members) === null, 'no nights, no menu')
  assert(chosenRotation('no-such-menu', rotationEntries('rotation-a', members, meals, andrew), rotations, members) === 'rotation-a', 'a start that names no menu is ignored, and the nights are read')
  assert(chosenRotation(null, rotationEntries('rotation-a', members, meals, andrew), rotations, members) === 'rotation-a', 'with no start the nights are read, as they always were')
}

// ── 3. the old reading is the fallback ───────────────────────────────────────
{
  const a = rotationEntries('rotation-a', members, meals, andrew)
  assert(planRotation({ meal_ids: a }, rotations, members) === 'rotation-a' && planRotation({ meal_ids: a, rotation_slug: null }, rotations, members) === 'rotation-a', 'a plan built before the record is read from its nights')
  assert(planRotation({ meal_ids: a, rotation_slug: 'rotation-retired' }, rotations, members) === 'rotation-a', 'a record naming a menu that is gone is not an answer — the nights are read')
  assert(planRotation({ meal_ids: a, rotation_slug: 'rotation-c2' }, rotations, members) === 'rotation-c2', 'a record that names a real menu is believed over the nights')
  assert(planRotation({ meal_ids: [], rotation_slug: null }, rotations, members) === null, 'no record and no nights is no menu')
}

// ── 4. the next plan starts from the menu not just run ───────────────────────
{
  // Three cook-nights a week: menu A's plan keeps two dinners that are its
  // alone at best, and at a 20-minute cap fewer. Whatever the nights say, the
  // record says A, so the next plan is B — not A again.
  for (const household of [andrew, { ...andrew, cook_cap_minutes: 20 }, { ...andrew, nights_per_week: 2 }, { ...andrew, nights_per_week: 1, shop_cadence_days: 7 }]) {
    const a = stored(built('rotation-a', household), household, { week_start: '2026-10-05' })
    assert(rotationJustRun([a], '2026-10-19', rotations, members) === 'rotation-a', `the menu just run is read from the record — got ${rotationJustRun([a], '2026-10-19', rotations, members)}`)
    assert(defaultRotation(rotations, rotationJustRun([a], '2026-10-19', rotations, members)) === 'rotation-b', 'after menu A the next plan starts from menu B')
    const b = stored(built('rotation-b', household), household, { week_start: '2026-10-05' })
    assert(defaultRotation(rotations, rotationJustRun([b], '2026-10-19', rotations, members)) === 'rotation-a', 'after menu B the next plan starts from menu A')
  }
  // The newest version of the cycle before is the one that ran.
  const v1 = stored(built('rotation-a', andrew), andrew, { week_start: '2026-10-05', version: 1 })
  const v2 = stored(built('rotation-c3', andrew), andrew, { week_start: '2026-10-05', version: 2 })
  assert(rotationJustRun([v1, v2], '2026-10-19', rotations, members) === 'rotation-c3', 'a cycle rebuilt from another menu ran the menu of its newest version')
  // builderStartRotation: the saved plan's own menu on a rebuild, the default on a new cycle.
  assert(builderStartRotation('2026-10-05', [v1, v2], rotations, members) === 'rotation-c3', 'reopening a saved plan starts from the menu recorded on it')
  assert(builderStartRotation('2026-10-19', [v1, v2], rotations, members) === 'rotation-a', 'a new cycle after a soup menu starts from menu A')
  assert(builderStartRotation('2026-10-19', [v1], rotations, members) === 'rotation-b', 'a new cycle after menu A starts from menu B')
  assert(builderStartRotation('2026-10-19', [], [], []) === null, 'with no menus there is none to start from')
  // It names the menu builderStart's picks are.
  assert(JSON.stringify(builderStart('2026-10-19', [v1], rotations, members, meals, andrew, null)) === JSON.stringify(rotationEntries(builderStartRotation('2026-10-19', [v1], rotations, members), members, meals, andrew)), 'and it is the menu the builder\'s starting picks come from')
}

// ── 5. the record travels: builder -> write -> read ─────────────────────────
{
  // The builder, RENDERED on a weekly shop at a 20-minute cap from soup menu
  // 3: it is headed by the menu it started from, not "your own menu".
  const entries = rotationEntries('rotation-c3', members, meals, TIGHT)
  const html = (initial) => renderToStaticMarkup(createElement(PlanBuilder, { household: TIGHT, meals, initial, building: false, onBuild: () => {}, rotations, members }))
  const name = rotations.find((r) => r.slug === 'rotation-c3').name.toLowerCase()
  assert(html({ entries, rotation: 'rotation-c3' }).includes(`>${name}<`), `the builder started from soup menu 3 is headed "${name}"`)
  assert(!html({ entries, rotation: 'rotation-c3' }).includes('>your own menu<'), 'and not "your own menu"')
  assert(html({ entries }).includes('>your own menu<') && !html({ entries }).includes(`>${name}<`), 'without the start, the same nights are headed "your own menu" — what the page showed before')
  const pb = readLF('src/components/fuel/PlanBuilder.tsx')
  assert(/onClick=\{\(\) => onBuild\(\{ entries, rotation: current \}\)\}/.test(pb), 'the build hands over the menu with the nights')
  assert(/const startFrom = \(slug: string\) => \{ setStarted\(slug\); setEntries\(rotationEntries\(slug, members, meals, household\)\)/.test(pb), 'picking a menu is what sets the start')

  // The write: one rpc, the menu inside the snapshot it already sends.
  const calls = []
  const db = {
    rpc: async (fn, args) => { calls.push({ fn, args }); return { data: { plan_id: 'p1', list_id: 'l1', version: 1, updated_at: '2026-10-13T00:00:00Z' }, error: null } },
    from: () => { throw new Error('no table reads in this fake') },
  }
  const plan = built('rotation-c3', andrew)
  const res = await createVersion(db, '2026-10-12', andrew, meals, plan)
  assert(calls.length === 1 && calls[0].fn === 'fuel_create_version_with_staples', 'a build is still one call to the one write')
  assert(calls[0].args.p_rules_snapshot.rotation_slug === 'rotation-c3', `the write carries the menu — got ${calls[0].args.p_rules_snapshot.rotation_slug}`)
  assert(Object.keys(calls[0].args).sort().join() === 'p_items,p_meal_ids,p_rules_snapshot,p_week_start', 'and takes the same four arguments it always did — no function changes')
  assert(res.plan?.rotation_slug === 'rotation-c3', 'the plan the page holds after the build reports the menu too')
  calls.length = 0
  await createVersion(db, '2026-10-12', andrew, meals, { entries: plan.entries })
  assert(!('rotation_slug' in calls[0].args.p_rules_snapshot), 'a plan built from no menu sends no key at all, so the column is NULL')

  // The read asks for the column, and falls back when it is not there yet.
  const selects = []
  const reader = (answer) => ({
    from: () => ({
      select: (columns) => {
        selects.push(columns)
        const q = { eq: () => q, gte: () => q, order: () => q, limit: () => q, maybeSingle: async () => ({ data: null, error: null }), then: (ok) => ok(answer(columns)) }
        return q
      },
    }),
  })
  await loadActive(reader((columns) => (columns.includes('rotation_slug') ? { data: null, error: { code: '42703', message: 'column fuel_plans.rotation_slug does not exist' } } : { data: [], error: null })), 'u1', new Date(2026, 9, 13))
  const planReads = selects.filter((c) => c.includes('meal_ids'))
  assert(planReads.length === 2 && planReads[0].includes('rotation_slug') && !planReads[1].includes('rotation_slug'), `the plans are read with the menu, and again without it where the column is missing — reads: ${planReads.join(' | ')}`)
  selects.length = 0
  const r2 = await loadActive(reader(() => ({ data: null, error: { code: '42501', message: 'permission denied' } })), 'u1', new Date(2026, 9, 13))
  assert(selects.filter((c) => c.includes('meal_ids')).length === 1 && r2.error?.code === '42501', 'any other failure is reported, never retried around')
}

// ── 6. recording the menu changes nothing a plan is compared on ──────────────
{
  const plan = built('rotation-c3', andrew)
  const snap = snapshot(andrew, plan)
  // The page rebuilds the comparison from the stored nights, which name no menu.
  assert(changed(snap, andrew, { entries: plan.entries }) === false, 'a plan that recorded its menu does not read as changed against its own nights')
  assert(changed(snapshot(andrew, { entries: plan.entries }), andrew, plan) === false, 'and a plan built before the record does not read as changed when rebuilt with one')
  assert(snapshotKey(snap) === snapshotKey(snapshot(andrew, { entries: plan.entries })), 'the menu is not part of what two plans are compared on')
  assert(changed(snap, { ...andrew, people_count: 3 }, plan) === true, 'a real change is still a change')
  assert(snapshot(andrew, { entries: plan.entries, rotation: null }).rotation_slug === undefined, 'no menu is no key, not a null')
}

// ── 7. the migration is one generated column ─────────────────────────────────
{
  const sql = readLF('supabase/migrations/20261015_fuel_plan_rotation.sql')
  const live = sql.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n')
  assert(/ALTER TABLE public\.fuel_plans\s+ADD COLUMN IF NOT EXISTS rotation_slug text\s+GENERATED ALWAYS AS \(rules_snapshot ->> 'rotation_slug'\) STORED;/.test(live), 'it adds fuel_plans.rotation_slug, generated from the snapshot key the app sends')
  assert(!/\b(DROP|DELETE|UPDATE|INSERT|TRUNCATE|CREATE\s+(OR\s+REPLACE\s+)?FUNCTION|CREATE\s+TRIGGER|NOT NULL)\b/i.test(live), 'and nothing else: no drop, no row written, no function or trigger, and the column is nullable')
  assert(/^--   ALTER TABLE public\.fuel_plans DROP COLUMN rotation_slug;$/m.test(sql), 'it carries its own exact revert')
}

if (failures) { console.log(`\nfuel-plan-rotation: ${failures} of ${failures + passes} checks FAILED`); process.exit(1) }
console.log(`fuel-plan-rotation: ${passes} checks passed — a plan reports the menu it was built from, whatever its nights say`)
