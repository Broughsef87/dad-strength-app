// ── Fuel history record (FOR-247) — a standing invariant, its own file ───────
// A past night is counted on what it WAS, not on what its meal is now.
//
// steakWindowWarnings used to decide whether a past night was a steak by
// looking its slug up in the library as it stands now, so editing a meal's cut
// moved last month and retiring it made its nights vanish from the count. A
// stored night now carries `as_planned`, the database's record of its meal at
// the write, and history is read from that.
//
// What this file holds, and why each is a standing check rather than a test of
// the feature:
//   1. The record NEVER enters a comparison. Stored rules snapshots have never
//      carried one, so a snapshot that copied it would call every plan already
//      built stale the day the database starts writing records.
//   2. A past night is counted on its record: an edited cut, an edited-TO
//      ribeye, and a retired meal all leave the count where it was.
//   3. The client never writes a record. The database is its only writer; a
//      client that sent one would be asserting history.
//   4. What the form freezes is exactly what the database refuses on — nights
//      WITHOUT a record — so the control and the refusal cannot disagree.
//   5. Retiring an own meal writes one field, and a retired meal's drafted
//      nights are dropped by name instead of hiding behind a warning.
//
// This file is deliberately NOT record.ts and NOT the components: a revert of
// the feature must not take the check that would catch the revert with it.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { STEAK_CUT, isRecorded, pastCut, unrecordedSlugs, withoutRecord } from '../../src/lib/fuel/record.ts'
import { steakWindowWarnings } from '../../src/lib/fuel/solve.ts'
import { reconcileDraft } from '../../src/lib/fuel/planner.ts'
import { changed, snapshot, snapshotKey } from '../../src/lib/fuel/version.ts'
import { createVersion, retireOwnMeal } from '../../src/lib/fuel/store.ts'
import * as planBuilderModule from '../../src/components/fuel/PlanBuilder.tsx'
import * as mealFormModule from '../../src/components/fuel/MealForm.tsx'

let failures = 0, passes = 0
const assert = (cond, msg) => { if (cond) passes++; else { failures++; console.log('  ✗ ' + msg) } }
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const readLF = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')

// A .tsx component imported from this .mjs arrives CommonJS-wrapped under tsx
// (the FOR-241 note in fuel-solve.mjs). Unwrapped once, here.
const exportsOf = (mod) => (mod.default && typeof mod.default === 'object' ? mod.default : mod)
const componentOf = (mod) => { const e = exportsOf(mod); return typeof e.default === 'function' ? e.default : mod.default }
const PlanBuilder = componentOf(planBuilderModule)
const MealForm = componentOf(mealFormModule)
const droppedMessage = exportsOf(planBuilderModule).droppedMessage ?? planBuilderModule.droppedMessage

const decode = (s) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
const paint = (el) => { const html = renderToStaticMarkup(el); return { html, text: decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() } }

const seed = JSON.parse(readLF('fixtures/fuel-seed.json'))
const seeded = seed.fuel_meals
const ribeye = seeded.find((m) => m.slug === 'cast-iron-ribeye')
const OWNER = '0f0e0d0c-0b0a-4908-8706-050403020100'
const OWN_SLUG = 'u0f0e0d0c0b0a49088706050403020100~sunday-steak'
const own = (patch = {}) => ({ ...ribeye, slug: OWN_SLUG, name: 'Sunday Steak', user_id: OWNER, ...patch })

const household = {
  people_count: 2, nights_per_week: 4, cook_cap_minutes: 30, shop_cadence_days: 7, prep_diversion_pct: 50,
  dietary_rules: { protein_floor_g_per_person: 40, fish_per_week: 1, ground_turkey_per_week: 1, steak_per_month: 2, no_tilapia: true, vegetable_every_night: true, minimal_added_fat: true, frugal_reuse: true },
  inventory: [], store_section_order: seed.store_section_order,
}
const night = (slug, week = 1, record) => ({ slug, week, servings: 2, ...(record ? { as_planned: record } : {}) })
const REC_STEAK = { protein_cut: STEAK_CUT, name: 'Sunday Steak' }
const REC_CHICKEN = { protein_cut: 'chicken_thigh', name: 'Sunday Steak' }

// ── 1. the record never enters a comparison ────────────────────────────────
{
  const bare = { entries: [night(OWN_SLUG), night('chili-lime-thighs')] }
  const recorded = { entries: [night(OWN_SLUG, 1, REC_STEAK), night('chili-lime-thighs', 1, { protein_cut: 'chicken_thigh', name: 'Chili-Lime Thighs' })] }
  const stored = snapshot(household, bare)
  assert(snapshot(household, recorded).entries.every((e) => !('as_planned' in e)),
    'a rules snapshot never carries a record — it is what a plan is compared on, and no stored snapshot ever had one')
  assert(snapshotKey(snapshot(household, recorded)) === snapshotKey(stored),
    'a plan whose stored nights gained records snapshots identically to the same plan without them')
  assert(!changed(stored, household, { entries: recorded.entries }),
    'the page\'s staleness test — stored snapshot against the stored nights — does not call a plan stale because the database recorded its nights')
  assert(changed(stored, household, { entries: [night(OWN_SLUG, 1, REC_STEAK)] }),
    'and it still sees a real change: a night removed is a different plan (the strip removes the record, not the comparison)')
  const e = withoutRecord(night(OWN_SLUG, 2, REC_STEAK))
  assert(JSON.stringify(e) === JSON.stringify({ slug: OWN_SLUG, week: 2, servings: 2 }), `withoutRecord removes the record and nothing else — got ${JSON.stringify(e)}`)
}

// ── 2. a past night is counted on what it was ──────────────────────────────
// Target 2026-09-21, weekly, two a month. This cycle has one steak night; two
// more in the window make three against two, and the rule reports it.
{
  const ctx = (history) => ({ history, targetStart: '2026-09-21', cadenceDays: 7 })
  const cycle = (start, entries) => ({ week_start: start, version: 1, meal_ids: entries, rules_snapshot: { shop_cadence_days: 7 } })
  const thisPlan = { entries: [night('cast-iron-ribeye')] }
  const warn = (library, history) => steakWindowWarnings(thisPlan, library, ctx(history), 2)
  const library = [...seeded, own()]
  const two = (rec) => [cycle('2026-09-07', [night(OWN_SLUG, 1, rec)]), cycle('2026-09-14', [night(OWN_SLUG, 1, rec)])]

  assert(warn(library, two(REC_STEAK)).length === 1, 'baseline: two recorded steak nights plus this one are three against two — reported')
  assert(warn([...seeded, own({ protein_cut: 'chicken_thigh' })], two(REC_STEAK)).length === 1,
    'EDITED FROM ribeye: the meal is chicken now, but those nights were steaks when they were planned — still three, still reported')
  assert(warn(library, two(REC_CHICKEN)).length === 0,
    'EDITED TO ribeye: the meal is a steak now, but those nights were chicken when they were planned — the plan that was fine stays fine')
  assert(warn(seeded, two(REC_STEAK)).length === 1,
    'RETIRED: the meal has left the library read entirely, and its recorded steak nights still count')
  // The fallback, and why a night without a record must stay frozen: it IS read
  // against the library as it stands, so an edit moves it.
  assert(warn(library, two(null)).length === 1 && warn([...seeded, own({ protein_cut: 'chicken_thigh' })], two(null)).length === 0,
    'a night with NO record is read against the live library — which is exactly why the database freezes its meal')
  assert(pastCut(night(OWN_SLUG, 1, REC_CHICKEN), library) === 'chicken_thigh' && pastCut(night('nowhere'), library) === null,
    'pastCut takes the record over the library, and an unknown night counts as nothing')
  // THIS plan is judged against the library: it is being built from it now.
  assert(steakWindowWarnings({ entries: [night(OWN_SLUG, 1, REC_CHICKEN)] }, library, ctx(two(REC_STEAK)), 2).length === 1,
    'the plan being built is judged on the library as it stands — a stale record carried into a rebuild does not excuse its steak')
}

// ── 3. the client never writes a record ────────────────────────────────────
{
  const calls = []
  const mock = (readBack) => ({
    rpc: async (fn, args) => { calls.push({ fn, args }); return { data: { plan_id: 'p1', list_id: 'l1', version: 3, updated_at: '2026-09-22T10:00:00Z', items: [] }, error: null } },
    from: (table) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => { calls.push({ read: table }); return readBack() } }) }) }),
  })
  const carried = { entries: [night(OWN_SLUG, 1, REC_CHICKEN), night('chili-lime-thighs')] }
  const stamped = [night(OWN_SLUG, 1, REC_STEAK), night('chili-lime-thighs', 1, { protein_cut: 'chicken_thigh', name: 'Chili-Lime Thighs' })]
  const res = await createVersion(mock(() => ({ data: { meal_ids: stamped }, error: null })), '2026-09-21', household, [...seeded, own()], carried)
  const sent = calls.find((c) => c.fn)?.args
  assert(sent && sent.p_meal_ids.every((e) => !('as_planned' in e)),
    'a night carried over from a stored plan arrives holding that build\'s record — and it is NOT sent: the database writes the record')
  assert(sent && sent.p_rules_snapshot.entries.every((e) => !('as_planned' in e)), 'nor does the snapshot sent with it carry one')
  assert(res.error == null && JSON.stringify(res.plan?.meal_ids) === JSON.stringify(stamped),
    'the row the page keeps is the database\'s, records included — read back, never rebuilt from what was sent')
  const failed = await createVersion(mock(() => ({ data: null, error: { message: 'network' } })), '2026-09-21', household, [...seeded, own()], carried)
  assert(failed.error == null && failed.plan?.meal_ids.every((e) => !isRecorded(e)),
    'a read-back that fails does not fail the build — the write has landed — and the nights sent stand in, unrecorded: they lock more, never less')
  // Caught HERE, so a throw is reported as this check failing, by name,
  // rather than as the whole suite dying on the line.
  const settle = async (p) => { try { return await p } catch (e) { return { threw: String(e) } } }
  const thrown = await settle(createVersion({ rpc: mock(() => ({})).rpc, from: () => { throw new Error('boom') } }, '2026-09-21', household, [...seeded, own()], carried))
  assert(!thrown.threw && thrown.error == null && thrown.plan != null, `a read-back that THROWS does not fail the build either${thrown.threw ? ` — it threw: ${thrown.threw}` : ''}`)
  const noFrom = await settle(createVersion({ rpc: mock(() => ({})).rpc }, '2026-09-21', household, [...seeded, own()], carried))
  assert(!noFrom.threw && noFrom.error == null && noFrom.plan != null, `and a client that cannot read does not fail it${noFrom.threw ? ` — it threw: ${noFrom.threw}` : ''}`)

  // No file in the app constructs a record: the type declares it, and only
  // the database fills it in. A VALUE after the key — an object literal or a
  // lowercase expression — is a write; a PascalCase name is a type annotation,
  // which is how record.ts's own type guard spells it.
  const writers = ['src/lib/fuel/store.ts', 'src/lib/fuel/solve.ts', 'src/lib/fuel/version.ts', 'src/lib/fuel/planner.ts', 'src/lib/fuel/rotation.ts', 'src/lib/fuel/ownMeal.ts', 'src/lib/fuel/record.ts',
    'src/components/fuel/PlanBuilder.tsx', 'src/components/fuel/MealForm.tsx', 'src/app/fuel/page.tsx']
    .filter((f) => /\bas_planned\s*:\s*(\{|[a-z_$])/.test(readLF(f).split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n')))
  assert(writers.length === 0, `no app file writes an as_planned record — found one in ${writers.join(', ')}`)
}

// ── 4. what the form freezes is what the database refuses on ───────────────
{
  const hist = [
    { meal_ids: [night(OWN_SLUG, 1, REC_STEAK), night('u0f0e0d0c0b0a49088706050403020100~old-chili')] },
    { meal_ids: [night('chili-lime-thighs', 1, { protein_cut: 'chicken_thigh', name: 'Chili-Lime Thighs' })] },
  ]
  const frozen = unrecordedSlugs(hist)
  assert(!frozen.has(OWN_SLUG) && frozen.has('u0f0e0d0c0b0a49088706050403020100~old-chili') && frozen.size === 1,
    `only a meal a night WITHOUT a record stands on is frozen — got ${[...frozen].join(', ')}`)
  assert(unrecordedSlugs([{ meal_ids: [night(OWN_SLUG), night(OWN_SLUG, 2, REC_STEAK)] }]).has(OWN_SLUG),
    'one unrecorded night is enough — a recorded night beside it does not thaw the meal')
  const pb = readLF('src/components/fuel/PlanBuilder.tsx')
  assert(/const frozenSlugs = useMemo\(\(\) => unrecordedSlugs\(cycles\?\.history \?\? \[\]\), \[cycles\]\)/.test(pb)
    && /cutLocked=\{!!mealForm\.meal && frozenSlugs\.has\(mealForm\.meal\.slug\)\}/.test(pb),
    'the builder locks the meal form on unrecordedSlugs — the same predicate, not a second copy of it')
  const own20 = readLF('supabase/migrations/20260920_fuel_own_meals.sql')
  assert(/IF OLD\.active AND NOT NEW\.active THEN/.test(own20) && /NEW\.protein_cut IS DISTINCT FROM OLD\.protein_cut/.test(own20),
    'the database still refuses both the cut edit and the retirement of a meal a stored night stands on — the unfinished half fails CLOSED until the record migration relaxes it')
}

// ── 5. retiring, and what a retired meal leaves behind ─────────────────────
{
  const seen = []
  const db = (result) => ({ from: (t) => ({ update: (payload) => ({ eq: (col, val) => ({ select: () => ({ maybeSingle: async () => { seen.push({ t, payload, col, val }); return result } }) }) }) }) })
  assert((await retireOwnMeal(db({ data: { slug: OWN_SLUG }, error: null }), OWN_SLUG)).error === null, 'a retire that lands reports nothing')
  assert(seen[0]?.t === 'fuel_meals' && JSON.stringify(seen[0]?.payload) === JSON.stringify({ active: false }) && seen[0]?.col === 'slug' && seen[0]?.val === OWN_SLUG,
    `a retire writes ONE field on ONE slug — no stale copy of the rest of the meal rides along — got ${JSON.stringify(seen[0])}`)
  const nobody = await retireOwnMeal(db({ data: null, error: null }), 'cast-iron-ribeye')
  assert(/not one of yours/.test(nobody.error?.message ?? ''), 'a seeded meal, invisible to the update, is refused in words rather than reported as retired')
  const refused = await retireOwnMeal(db({ data: null, error: { code: '23514', message: 'this meal is on a plan you have already built, so it cannot be retired yet' } }), OWN_SLUG)
  assert(refused.error?.code === '23514' && /cannot be retired yet/.test(refused.error.message), 'the database\'s refusal comes back in its own words')

  const form = (props) => paint(createElement(MealForm, { meal: own(), meals: seeded, sectionOrder: seed.store_section_order, busy: false, onSave: async () => null, onCancel: () => {}, onRetire: async () => null, ...props }))
  assert(/retire this meal/.test(form({}).text), 'editing your own meal offers to retire it')
  assert(!/retire/.test(form({ meal: null }).text), 'adding a meal offers no retire')
  assert(!/retire this meal/.test(form({ onRetire: undefined }).text), 'no retire control where the page cannot retire')
  const locked = form({ cutLocked: true })
  assert(!/retire this meal/.test(locked.text) && /cannot be retired yet/.test(locked.text) && /<select[^>]*disabled=""[^>]*aria-label="what the protein is"/.test(locked.html),
    'a frozen meal shows no retire button, says why, and its cut control is disabled — the form agrees with the database')

  assert(droppedMessage(['Sunday Steak']) === 'sunday steak is no longer in your library, so its night was dropped — pick again', `one named: ${droppedMessage(['Sunday Steak'])}`)
  assert(droppedMessage(['A', 'B', 'C']) === 'a, b and c are no longer in your library, so their nights were dropped — pick again', `several named: ${droppedMessage(['A', 'B', 'C'])}`)
  assert(droppedMessage([null]) === 'a night whose meal is no longer in the library was dropped — pick again', 'a night with no record is counted in the words it always had')
  assert(droppedMessage(['A', null, null]) === 'a is no longer in your library, so its night was dropped; 2 nights whose meals are no longer in the library were dropped — pick again', `mixed: ${droppedMessage(['A', null, null])}`)

  const builder = (initial) => paint(createElement(PlanBuilder, { household, meals: seeded, initial, building: false, onBuild: () => {} }))
  assert(/sunday steak is no longer in your library/.test(builder({ entries: [night(OWN_SLUG, 1, REC_STEAK), night('chili-lime-thighs')] }).text),
    'a saved night whose meal was retired is dropped and NAMED — from its record, because the library no longer has the name')
  assert(/a night whose meal is no longer in the library was dropped/.test(builder({ entries: [night(OWN_SLUG), night('chili-lime-thighs')] }).text),
    'a saved night with no record is dropped and counted')
  // A meal leaving the library under a draft — retired here, or in another
  // tab and picked up by any later re-read (Codex r2). The rule is behaviour,
  // asserted as behaviour on the function that holds it.
  const lib = (...slugs) => new Map(slugs.map((s) => [s, { name: s === OWN_SLUG ? 'Sunday Steak' : s }]))
  const draft = [night(OWN_SLUG, 1), night('chili-lime-thighs', 1), night(OWN_SLUG, 2)]
  const lost = reconcileDraft(draft, lib(OWN_SLUG, 'chili-lime-thighs'), lib('chili-lime-thighs'))
  assert(lost.entries.length === 1 && lost.entries[0].slug === 'chili-lime-thighs',
    'a re-read that loses a meal takes its drafted nights out of the draft — a night whose meal is not drawn could never be removed (Codex r7)')
  assert(JSON.stringify(lost.dropped) === JSON.stringify([{ slug: OWN_SLUG, name: 'Sunday Steak' }]),
    `each meal lost is named ONCE, from the library it left — got ${JSON.stringify(lost.dropped)}`)
  assert(reconcileDraft(draft, new Map(), lib('chili-lime-thighs')).dropped[0]?.name === null, 'a meal the previous library did not know is dropped unnamed, never guessed')
  const same = reconcileDraft(draft, lib(OWN_SLUG, 'chili-lime-thighs'), lib(OWN_SLUG, 'chili-lime-thighs', 'extra'))
  assert(same.entries === draft && same.dropped.length === 0, 'a re-read that loses nothing hands the SAME draft back, so nothing is set')
  // And the builder runs it wherever the library changes — not in the one
  // callback that retires.
  const pb = readLF('src/components/fuel/PlanBuilder.tsx')
  assert(/if \(reconciledFor !== bySlug\) \{\s*setReconciledFor\(bySlug\)\s*const r = reconcileDraft\(entries, reconciledFor, bySlug\)/.test(pb),
    'the builder reconciles its draft against EVERY new library — a retire in another tab is caught by the next re-read (Codex r2)')
  const reconcileBlock = (() => { const at = pb.indexOf('if (r.dropped.length) {'); return at < 0 ? '' : pb.slice(at, pb.indexOf('\n    }', at)) })()
  assert(/setEntries\(r\.entries\)/.test(reconcileBlock) && /setDroppedNow\(\(d\) => \[\.\.\.d, \.\.\.r\.dropped\]\)/.test(reconcileBlock),
    'what it drops leaves the draft and is named in the banner')
  assert(/setDrawer\(null\)/.test(reconcileBlock),
    'and dropping closes the drawer — it may be open to swap a night by index, and a pick would land on the wrong one (Codex r1)')
  assert(/for \(const d of droppedNow\) names\.set\(d\.slug, names\.get\(d\.slug\) \?\? d\.name\)/.test(pb),
    'a meal retired while a saved night stands on it is named once — one meal, whatever the sources')
  const pg = readLF('src/app/fuel/page.tsx')
  assert(/const res = await retireOwnMeal\(supabase, slug\)[\s\S]{0,400}const m = await loadMeals\(supabase\)/.test(pg) && /onRetireMeal=\{onRetireMeal\}/.test(pg),
    'the page retires, then RE-READS the library — the meal is never spliced out by hand')
}

if (failures) { console.log(`\nfuel-history-record: ${failures} of ${failures + passes} checks FAILED`); process.exit(1) }
console.log(`fuel-history-record: ${passes} checks passed — a past night is counted on what it was, and only the database writes that down`)
