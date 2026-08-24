// Runnable check for src/lib/analytics/training.ts
//   npx tsx "<this file>"   (run from the repo root)
//
// Asserts the non-negotiable domain rules against synthetic rows. No DB, no
// network — the analytics layer is pure, so this is the whole test surface.

const MODULE_URL =
  '../../src/lib/analytics/training.ts'

const A = await import(MODULE_URL)
const { e1rm, liftTrends, projections, adherence, isDeloadWeek, canonicalLiftName, maxKeyForLift } = A

// ── tiny harness ─────────────────────────────────────────────────────────────
let pass = 0
const fails = []
let group = ''
const describe = (n) => { group = n; console.log(`\n── ${n}`) }
function ok(label, cond, detail) {
  if (cond) { pass++; console.log(`   PASS  ${label}`) }
  else { fails.push(`${group} :: ${label}${detail ? ` — ${detail}` : ''}`); console.log(`   FAIL  ${label}${detail ? ` — ${detail}` : ''}`) }
}
const eq = (label, actual, expected) =>
  ok(label, Object.is(actual, expected), `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`)

// ── row factory ──────────────────────────────────────────────────────────────
let n = 0
const set = (o) => ({
  log_type: 'strength_set',
  completed: true,
  slot: null,
  rpe: null,
  user_id: 'u1',
  day_number: 1,
  completed_at: `2026-0${1 + (n++ % 8)}-01T12:00:00Z`,
  ...o,
})

const OPTS = { deloadWeeks: [], velocitySlots: ['speed_squat', 'hang_psn'] }

// ═══ 1. EPLEY ════════════════════════════════════════════════════════════════
describe('e1rm — Epley, with a rep ceiling')
eq('a single returns the weight exactly', e1rm(315, 1), 315)
eq('225 x 5 = 262.5', e1rm(225, 5), 262.5)
eq('200 x 2 = 213.3', e1rm(200, 2), 213.3)
eq('11 reps refuses (rule 1)', e1rm(135, 11), null)
eq('10 reps still computes', e1rm(135, 10), 180)
eq('zero weight refuses', e1rm(0, 3), null)
eq('zero reps refuses', e1rm(315, 0), null)
eq('null input refuses', e1rm(null, null), null)
eq('numeric-as-string coerces', e1rm('225', '1'), 225)

// ═══ 2. DELOAD WEEKS ═════════════════════════════════════════════════════════
describe('isDeloadWeek — week 12 of every macro, plus flagged weeks')
eq('week 12 is the built-in deload', isDeloadWeek(12, []), true)
eq('week 13 (TEST) is not a deload', isDeloadWeek(13, []), false)
eq('week 25 = week 12 of macro 2', isDeloadWeek(25, []), true)
eq('week 5 is normal', isDeloadWeek(5, []), false)
eq('week 5 flagged is a deload', isDeloadWeek(5, [5]), true)

describe('liftTrends — a deload must not move a trend')
// Back squat climbing w9 -> w11, an athlete-flagged deload at w10, and the
// built-in deload at w12. Both light weeks must be invisible.
const squatRows = [
  set({ block_name: 'Back Squat', slot: 'back_squat_heavy', weight_lbs: 300, reps: 3, week_number: 9 }),
  set({ block_name: 'Back Squat', slot: 'back_squat_heavy', weight_lbs: 185, reps: 3, week_number: 10 }), // FLAGGED deload
  set({ block_name: 'Back Squat', slot: 'back_squat_heavy', weight_lbs: 315, reps: 3, week_number: 11 }),
  set({ block_name: 'Back Squat', slot: 'back_squat_heavy', weight_lbs: 195, reps: 5, week_number: 12 }), // BUILT-IN deload
]
const withDeloads = liftTrends(squatRows, { ...OPTS, deloadWeeks: [10] })
const bs = withDeloads['Back Squat']
ok('Back Squat trend exists', !!bs)
eq('flagged + built-in deloads dropped (2 points, not 4)', bs.points.length, 2)
eq('point weeks are 9 and 11', bs.points.map(p => p.week).join(','), '9,11')
eq('current is week 11, not the week-12 deload', bs.current, e1rm(315, 3))
eq('startingPoint is week 9', bs.startingPoint, e1rm(300, 3))
ok('deltaPct is positive — the deload did not fake a crash', bs.deltaPct > 0, `deltaPct=${bs.deltaPct}`)
// The lie this rule prevents, demonstrated:
const noExclusion = liftTrends(squatRows, { ...OPTS, deloadWeeks: [], macroWeeks: 999 })
ok('control: without exclusion the same rows DO fake a crash',
  noExclusion['Back Squat'].deltaPct < 0,
  `control deltaPct=${noExclusion['Back Squat'].deltaPct}`)

// ═══ 3. VELOCITY SLOTS ═══════════════════════════════════════════════════════
describe('liftTrends — a velocity slot never produces an e1RM')
const velRows = [
  ...squatRows.slice(0, 1),
  set({ block_name: 'Back Squat', slot: 'back_squat_heavy', weight_lbs: 315, reps: 3, week_number: 11 }),
  // 55-64% speed box squats — meaningless e1RM, must not touch the squat trend.
  set({ block_name: 'Speed Box Squat', slot: 'speed_squat', weight_lbs: 200, reps: 2, week_number: 9 }),
  set({ block_name: 'Speed Box Squat', slot: 'speed_squat', weight_lbs: 205, reps: 2, week_number: 11 }),
  // Legacy row: slot is NULL, so identity is block_name — exclusion must still hold.
  set({ block_name: 'Speed Box Squat', slot: null, weight_lbs: 210, reps: 2, week_number: 11 }),
  set({ block_name: 'Hang Power Snatch', slot: 'hang_psn', weight_lbs: 135, reps: 3, week_number: 11 }),
]
const velT = liftTrends(velRows, OPTS)
eq('no Speed Box Squat trend at all', velT['Speed Box Squat'], undefined)
eq('no Hang Power Snatch trend at all', velT['Hang Power Snatch'], undefined)
eq('squat trend untouched by the speed slot', velT['Back Squat'].points.length, 2)
eq('squat best is the real 315x3', velT['Back Squat'].best, e1rm(315, 3))
ok('only the Back Squat survived', Object.keys(velT).join(',') === 'Back Squat', Object.keys(velT).join(','))

// ═══ 4. REP CEILING INSIDE A TREND ═══════════════════════════════════════════
describe('liftTrends — an 11-rep set produces no point')
const repRows = [
  set({ block_name: 'Deadlift', slot: 'sat_dl', weight_lbs: 405, reps: 3, week_number: 9 }),
  // 11 reps at a big weight would post the highest "e1RM" in the file. Refused.
  set({ block_name: 'Deadlift', slot: 'sat_dl', weight_lbs: 400, reps: 11, week_number: 10 }),
  set({ block_name: 'Deadlift', slot: 'sat_dl', weight_lbs: 415, reps: 3, week_number: 11 }),
]
const repT = liftTrends(repRows, OPTS)
eq('the 11-rep week yields no point', repT['Deadlift'].points.length, 2)
eq('weeks are 9 and 11', repT['Deadlift'].points.map(p => p.week).join(','), '9,11')
ok('best is not the 11-rep set', repT['Deadlift'].best === e1rm(415, 3),
  `best=${repT['Deadlift'].best}, 11-rep would have been ${400 * (1 + 11 / 30)}`)

// ═══ 5. NULL SLOT FALLS BACK TO block_name ═══════════════════════════════════
describe('liftTrends — a NULL-slot row is still attributed via block_name')
const nullSlotRows = [
  set({ block_name: 'Bench Press', slot: null, weight_lbs: 225, reps: 3, week_number: 9 }),
  set({ block_name: 'Bench Press', slot: 'bench_heavy', weight_lbs: 235, reps: 3, week_number: 10 }),
]
const nsT = liftTrends(nullSlotRows, OPTS)
ok('Bench Press trend exists', !!nsT['Bench Press'])
eq('both rows landed on the same lift', nsT['Bench Press'].points.length, 2)
eq('the NULL-slot row is the starting point', nsT['Bench Press'].startingPoint, e1rm(225, 3))
eq('slot is carried from the row that had one', nsT['Bench Press'].slot, 'bench_heavy')

// ═══ 6. RULE 4 — completed / weight / reps ═══════════════════════════════════
describe('liftTrends — only completed sets with real weight and reps')
const dirty = [
  set({ block_name: 'Front Squat', weight_lbs: 275, reps: 3, week_number: 9 }),
  set({ block_name: 'Front Squat', weight_lbs: 999, reps: 1, week_number: 9, completed: false }),
  set({ block_name: 'Front Squat', weight_lbs: 0, reps: 5, week_number: 10 }),
  set({ block_name: 'Front Squat', weight_lbs: 300, reps: null, week_number: 10 }),
  set({ block_name: 'Front Squat', weight_lbs: 285, reps: 3, week_number: 10, log_type: 'skill_work' }),
]
const dirtyT = liftTrends(dirty, OPTS)
eq('one usable point survives', dirtyT['Front Squat'].points.length, 1)
eq('the uncompleted 999 never appears', dirtyT['Front Squat'].best, e1rm(275, 3))
eq('single point is marked sparse', dirtyT['Front Squat'].sparse, true)
eq('single point has null deltaPct (no trend from one dot)', dirtyT['Front Squat'].deltaPct, null)

// ═══ 7. RULE 5 — best of week, not average ═══════════════════════════════════
describe('liftTrends — the week point is the BEST set, not the average')
const topSet = liftTrends([
  set({ block_name: 'Power Clean', slot: 'cl_top', weight_lbs: 245, reps: 2, week_number: 9 }),
  set({ block_name: 'Power Clean', slot: 'cl_back', weight_lbs: 225, reps: 2, week_number: 9 }),
  set({ block_name: 'Power Clean', slot: 'cl_back', weight_lbs: 225, reps: 2, week_number: 9 }),
], OPTS)
eq('one point for the week', topSet['Power Clean'].points.length, 1)
eq('it is the top set', topSet['Power Clean'].current, e1rm(245, 2))
eq('sessionCount counts sessions, not sets', topSet['Power Clean'].sessionCount, 1)
eq('setCount counts all three', topSet['Power Clean'].setCount, 3)

// ═══ 8. TEST-WEEK NAMES FOLD IN ══════════════════════════════════════════════
describe('canonical naming — the test single joins the lift it belongs to')
eq('strips the test suffix', canonicalLiftName('Back Squat — work to 1RM'), 'Back Squat')
eq('strips a trailing parenthetical', canonicalLiftName('Clean — work to 1RM (no jerk)'), 'Clean')
eq('leaves hyphenated names alone', canonicalLiftName('Close-Grip Bench Press'), 'Close-Grip Bench Press')
const testWeek = liftTrends([
  set({ block_name: 'Back Squat', slot: 'back_squat_heavy', weight_lbs: 315, reps: 3, week_number: 11 }),
  set({ block_name: 'Back Squat — work to 1RM', slot: 'test_bs', weight_lbs: 375, reps: 1, week_number: 13 }),
], OPTS)
eq('the test single lands on the Back Squat trend', testWeek['Back Squat'].points.length, 2)
eq('test week is NOT excluded (it is the truest data)', testWeek['Back Squat'].current, 375)
eq('no orphan trend for the test block name', testWeek['Back Squat — work to 1RM'], undefined)

// ═══ 9. NAME -> MAX KEY MAPPING ══════════════════════════════════════════════
describe('maxKeyForLift — lift names map to requiredMaxes keys')
eq('Back Squat', maxKeyForLift('Back Squat'), 'back_squat')
eq('Power Clean -> clean_jerk', maxKeyForLift('Power Clean'), 'clean_jerk')
eq('Snatch', maxKeyForLift('Snatch'), 'snatch')
eq('Overhead Press -> ohp', maxKeyForLift('Overhead Press'), 'ohp')
eq('test-week name still maps', maxKeyForLift('Deadlift — work to 1RM'), 'deadlift')
eq('1 1/4 Bench is a different exercise, not the bench', maxKeyForLift('1\u00bc Bench Press'), null)
eq('Close-Grip Bench is a different exercise', maxKeyForLift('Close-Grip Bench Press'), null)

// ═══ 10. PROJECTIONS ═════════════════════════════════════════════════════════
describe('projections — honest, or null')
const projRows = []
// Back squat: 4 weeks of real work, most recent = week 11.
for (const [w, lb] of [[8, 300], [9, 305], [10, 310], [11, 315]]) {
  projRows.push(set({ block_name: 'Back Squat', slot: 'back_squat_heavy', weight_lbs: lb, reps: 3, week_number: w, day_number: 1 }))
  projRows.push(set({ block_name: 'Back Squat', slot: 'back_squat_heavy', weight_lbs: lb - 20, reps: 3, week_number: w, day_number: 1 }))
}
// Speed squats at 60% — must not enter the back_squat projection.
projRows.push(set({ block_name: 'Speed Box Squat', slot: 'speed_squat', weight_lbs: 190, reps: 2, week_number: 11, day_number: 5 }))
// Snatch: two weeks, both recent.
projRows.push(set({ block_name: 'Snatch', slot: 'sn_top', weight_lbs: 185, reps: 2, week_number: 10, day_number: 1 }))
projRows.push(set({ block_name: 'Snatch', slot: 'sn_top', weight_lbs: 190, reps: 1, week_number: 11, day_number: 1 }))
// Bench: one stale week, far behind week 11.
projRows.push(set({ block_name: 'Bench Press', slot: 'bench_heavy', weight_lbs: 225, reps: 4, week_number: 2, day_number: 1 }))
// Deadlift: nothing logged at all.

const pTrends = liftTrends(projRows, OPTS)
const maxes = { snatch: 205, clean_jerk: 275, back_squat: 355, front_squat: 285, bench: 250, deadlift: 455, ohp: 155 }
// latestWeek = the athlete's user_programs.current_week. Passing it is what
// lets the module speak about recency at all — see section 13.
const proj = projections(pTrends, maxes, { latestWeek: 11 })

const squatP = proj.back_squat
eq('back_squat projects from the top set', squatP.projected, Math.round(e1rm(315, 3)))
ok('projection is NOT dragged by the 60% speed squat',
  squatP.sourceLifts.join(',') === 'Back Squat', squatP.sourceLifts.join(','))
eq('back_squat confidence is high (4 weeks, 8 sets, current)', squatP.confidence, 'high')
eq('entered max is carried through', squatP.entered, 355)
ok('deltaPct compares projection to entered',
  Math.abs(squatP.deltaPct - ((squatP.projected - 355) / 355) * 100) < 0.05, `deltaPct=${squatP.deltaPct}`)
ok('basis names the set behind the number', /315 . 3 Back Squat \(wk 11\)/.test(squatP.basis), squatP.basis)

const snatchP = proj.snatch
eq('snatch projects', snatchP.projected, 197) // best of 185x2 (197.3) and 190x1
eq('snatch confidence is medium (2 weeks)', snatchP.confidence, 'medium')

const benchP = proj.bench
eq('stale bench refuses to project', benchP.projected, null)
eq('stale bench is flagged stale', benchP.stale, true)
eq('stale bench deltaPct is null', benchP.deltaPct, null)
eq('stale bench confidence is low', benchP.confidence, 'low')
ok('stale basis says why', /too stale/.test(benchP.basis), benchP.basis)

const dlP = proj.deadlift
eq('no deadlift data -> projected null, not a made-up number', dlP.projected, null)
eq('no deadlift data -> deltaPct null', dlP.deltaPct, null)
eq('no deadlift data -> confidence low', dlP.confidence, 'low')
ok('empty basis says nothing is logged', /No completed/.test(dlP.basis), dlP.basis)
eq('a row is still returned for every requiredMax key', Object.keys(proj).length, 7)
ok('all seven requiredMaxes keys present',
  ['snatch', 'clean_jerk', 'back_squat', 'front_squat', 'bench', 'deadlift', 'ohp'].every(k => k in proj))

// Deload rows must not be able to lower a projection either.
const projWithDeload = projections(
  liftTrends([...projRows, set({ block_name: 'Back Squat', slot: 'back_squat_heavy', weight_lbs: 190, reps: 5, week_number: 12, day_number: 1 })], OPTS),
  maxes, { latestWeek: 11 },
)
eq('a week-12 deload cannot lower the projection', projWithDeload.back_squat.projected, squatP.projected)

// Missing entered max: report the projection, refuse the delta.
const noMax = projections(pTrends, {}, { latestWeek: 11 })
eq('no entered max -> entered null', noMax.back_squat.entered, null)
eq('no entered max -> deltaPct null', noMax.back_squat.deltaPct, null)
ok('no entered max -> projection still stands', noMax.back_squat.projected > 0)

// ═══ 13. REGRESSIONS — found by adversarial probing ══════════════════════════
describe('projections — recency cannot be claimed without being told "now"')
// Weeks 1-4, then the athlete vanished. Deriving "now" from his own last
// session made that read as 'high' confidence and "current" forever.
const staleRows = []
for (const [w, lb] of [[1, 300], [2, 305], [3, 310], [4, 315]]) {
  staleRows.push(set({ block_name: 'Back Squat', slot: 'back_squat_heavy', weight_lbs: lb, reps: 3, week_number: w }))
  staleRows.push(set({ block_name: 'Back Squat', slot: 'back_squat_heavy', weight_lbs: lb - 20, reps: 3, week_number: w }))
}
const staleT = liftTrends(staleRows, OPTS)
const blind = projections(staleT, { back_squat: 355 })
eq('without latestWeek, confidence is capped at medium', blind.back_squat.confidence, 'medium')
ok('without latestWeek the basis never says "current"',
  !/current/.test(blind.back_squat.basis) && /as of wk 4/.test(blind.back_squat.basis), blind.back_squat.basis)
const told = projections(staleT, { back_squat: 355 }, { latestWeek: 30 })
eq('told it is week 30, it refuses to project', told.back_squat.projected, null)
eq('told it is week 30, it flags stale', told.back_squat.stale, true)
const toldNow = projections(staleT, { back_squat: 355 }, { latestWeek: 4 })
eq('told it really is week 4, high confidence is allowed', toldNow.back_squat.confidence, 'high')
ok('and only then does it say current', /current/.test(toldNow.back_squat.basis), toldNow.back_squat.basis)

describe('no NaN and no Infinity can reach the screen')
eq('an overflowing weight yields no e1RM at all', e1rm(1e308, 5), null)
eq('MAX_VALUE overflows to null, not Infinity', e1rm(Number.MAX_VALUE, 2), null)
function nonFinite(o, path = '', out = []) {
  if (o == null) return out
  if (typeof o === 'number') { if (!Number.isFinite(o)) out.push(path); return out }
  if (Array.isArray(o)) { o.forEach((v, i) => nonFinite(v, `${path}[${i}]`, out)); return out }
  if (typeof o === 'object') { for (const [k, v] of Object.entries(o)) nonFinite(v, `${path}.${k}`, out) }
  return out
}
const overflowT = liftTrends([
  set({ block_name: 'Back Squat', slot: 'bs', weight_lbs: 1e308, reps: 5, week_number: 9 }),
  set({ block_name: 'Back Squat', slot: 'bs', weight_lbs: '3e307', reps: 2, week_number: 10 }),
  set({ block_name: 'Deadlift', slot: 'dl', weight_lbs: 405, reps: 3, week_number: 9 }),
], OPTS)
ok('liftTrends output is all finite', nonFinite(overflowT).length === 0, nonFinite(overflowT).join(','))
const overflowP = projections(overflowT, { back_squat: 1e-12, deadlift: 0 }, { latestWeek: 10 })
ok('projections output is all finite', nonFinite(overflowP).length === 0, nonFinite(overflowP).join(','))

describe('a corrupt week_number cannot hang the page or zero out adherence')
const t0 = Date.now()
const wild = adherence([
  set({ block_name: 'Back Squat', weight_lbs: 300, reps: 3, week_number: 1, day_number: 1 }),
  set({ block_name: 'Back Squat', weight_lbs: 300, reps: 3, week_number: 2, day_number: 1 }),
  set({ block_name: 'Back Squat', weight_lbs: 300, reps: 3, week_number: 200000, day_number: 1 }),
], { daysPerWeek: 4 })
eq('the out-of-range week is dropped, not filled up to', wild.weeksTracked, 2)
eq('the two real sessions still count', wild.totalSessions, 2)
ok('overall rate is the real one, not 0', wild.overallRate > 0, `overallRate=${wild.overallRate}`)
ok('and it returns immediately', Date.now() - t0 < 500, `${Date.now() - t0}ms`)
eq('week 0 produces no lift point', liftTrends(
  [set({ block_name: 'Back Squat', weight_lbs: 300, reps: 3, week_number: 0 })], OPTS)['Back Squat'], undefined)

describe('adherence — one sentinel must not erase set-logged history')
const legacy = []
for (let w = 1; w <= 10; w++) for (const d of [1, 3, 5, 6]) {
  legacy.push(set({ block_name: 'Back Squat', weight_lbs: 300, reps: 3, week_number: w, day_number: d }))
}
eq('40 set-logged sessions, no sentinel anywhere', adherence(legacy, { daysPerWeek: 4 }).totalSessions, 40)
legacy.push({
  log_type: 'session_complete', block_name: '__session_complete__', completed: true,
  week_number: 10, day_number: 6, completed_at: '2026-04-01T18:00:00Z',
})
const mixedAd = adherence(legacy, { daysPerWeek: 4 })
eq('one sentinel in wk10 keeps wks 1-9 (36) + the wk10 sentinel (1)', mixedAd.totalSessions, 37)
eq('weeks 1-10 are all still tracked', mixedAd.weeksTracked, 10)
ok('adherence is not crushed from 100% to 25%', mixedAd.overallRate > 0.9, `overallRate=${mixedAd.overallRate}`)
eq('inside the sentinel range an unfinished session still does not count',
  mixedAd.byWeek.find(w => w.week === 10).sessions, 1)

// ═══ 11. ADHERENCE ═══════════════════════════════════════════════════════════
describe('adherence — sentinel rows when present')
const sentinelRows = []
for (const [w, days] of [[9, [1, 3, 5, 6]], [10, [1, 3]], [11, [1, 3, 5, 6, 2]]]) {
  for (const d of days) {
    sentinelRows.push({
      log_type: 'session_complete', block_name: '__session_complete__', completed: true,
      week_number: w, day_number: d, completed_at: `2026-03-0${d}T18:00:00Z`,
      weight_lbs: null, reps: null, slot: null, rpe: null, user_id: 'u1',
    })
  }
}
// Noise: completed sets in a week with no sentinel must not add sessions.
sentinelRows.push(set({ block_name: 'Back Squat', weight_lbs: 300, reps: 3, week_number: 12, day_number: 1 }))
const ad = adherence(sentinelRows, { daysPerWeek: 7, deloadWeeks: [] })
eq('source is the sentinel', ad.source, 'session_complete')
eq('total sessions', ad.totalSessions, 11)
eq('weeks tracked 9-11', ad.weeksTracked, 3)
eq('week 10 counted 2', ad.byWeek.find(w => w.week === 10).sessions, 2)
eq('byWeek covers 1-7 buckets', ad.byWeekday.length, 7)
eq('Monday (day 1) hit every week', ad.byWeekday.find(d => d.day === 1).sessions, 3)
eq('Sunday (day 7) never hit', ad.byWeekday.find(d => d.day === 7).sessions, 0)
eq('Monday rate is 1', ad.byWeekday.find(d => d.day === 1).rate, 1)
eq('avg per week', ad.averagePerWeek, round2(11 / 3))
function round2(x) { return Math.round(x * 100) / 100 }

describe('adherence — derived from completed sets when no sentinel exists')
const derivedRows = [
  set({ block_name: 'Back Squat', weight_lbs: 300, reps: 3, week_number: 9, day_number: 1 }),
  set({ block_name: 'Snatch', weight_lbs: 185, reps: 2, week_number: 9, day_number: 1 }),
  set({ block_name: 'Deadlift', weight_lbs: 405, reps: 3, week_number: 9, day_number: 6 }),
  set({ block_name: 'Bench Press', weight_lbs: 225, reps: 3, week_number: 11, day_number: 1, completed: false }),
  set({ block_name: 'Bench Press', weight_lbs: 225, reps: 3, week_number: 11, day_number: 3 }),
]
const ad2 = adherence(derivedRows, { daysPerWeek: 4 })
eq('source is derived', ad2.source, 'derived')
eq('two sets on the same day = one session', ad2.totalSessions, 2 + 1)
eq('the uncompleted set does not create a session', ad2.byWeek.find(w => w.week === 11).sessions, 1)
eq('week 10 is filled in at zero, not dropped', ad2.byWeek.find(w => w.week === 10).sessions, 0)
eq('weeks 9-11 all present', ad2.byWeek.map(w => w.week).join(','), '9,10,11')
eq('expected comes from opts', ad2.byWeek[0].expected, 4)
eq('week 12 flag would label a deload', adherence(
  [set({ block_name: 'X', weight_lbs: 100, reps: 1, week_number: 12, day_number: 1 })], {},
).byWeek[0].isDeload, true)

describe('adherence — empty input')
const ad3 = adherence([], {})
eq('source none', ad3.source, 'none')
eq('no sessions', ad3.totalSessions, 0)
eq('still returns 7 weekday buckets', ad3.byWeekday.length, 7)

// ═══ 12. PURITY ══════════════════════════════════════════════════════════════
describe('purity — the caller owns the data, the module owns nothing')
const frozen = Object.freeze([Object.freeze(set({ block_name: 'Back Squat', weight_lbs: 300, reps: 3, week_number: 9 }))])
const before = JSON.stringify(frozen)
liftTrends(frozen, OPTS)
adherence(frozen, {})
eq('input rows are not mutated', JSON.stringify(frozen), before)
const t1 = liftTrends(squatRows, { ...OPTS, deloadWeeks: [10] })
const t2 = liftTrends(squatRows, { ...OPTS, deloadWeeks: [10] })
eq('same input -> same output', JSON.stringify(t1), JSON.stringify(t2))

// ── report ───────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(70)}`)
if (fails.length) {
  console.log(`FAILED — ${pass} passed, ${fails.length} failed\n`)
  for (const f of fails) console.log(`  x ${f}`)
  process.exit(1)
}
console.log(`ALL GREEN — ${pass} assertions passed`)
