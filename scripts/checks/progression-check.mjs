// Double progression — the rules that make a hypertrophy program advance.
import { doubleProgression, loadTargets } from '../../src/lib/programs/progression.ts'

let fails = 0, checks = 0
const ok = (label, cond, got) => {
  checks++
  if (!cond) { fails++; console.log(`FAIL  ${label}  → got ${JSON.stringify(got)}`) }
  else console.log(`PASS  ${label}`)
}
const RANGES = { acc_row: [8, 12], acc_curl: [10, 15], acc_legpress: [10, 15] }
const OPTS = { ranges: RANGES, steps: { acc_legpress: 10 }, defaultStep: 5 }
const row = (slot, w, reps, week = 5, day = 2) =>
  ({ slot, block_name: slot, weight_lbs: w, reps, completed: true, week_number: week, day_number: day, log_type: 'strength_set' })

// 1. Cleared the top of the range on every set → add load
{
  const p = doubleProgression([row('acc_row', 100, 12), row('acc_row', 100, 12), row('acc_row', 100, 12)], OPTS)
  ok('all sets at top of range → add load', p.acc_row.action === 'add-load' && p.acc_row.suggested === 105, p.acc_row)
}
// 2. One set short of the top → hold, chase reps
{
  const p = doubleProgression([row('acc_row', 100, 12), row('acc_row', 100, 10), row('acc_row', 100, 12)], OPTS)
  ok('one set short → hold the load', p.acc_row.action === 'hold' && p.acc_row.suggested === 100, p.acc_row)
}
// 3. Fell under the floor → back off
{
  const p = doubleProgression([row('acc_row', 100, 12), row('acc_row', 100, 6)], OPTS)
  ok('a set under the floor → back off', p.acc_row.action === 'back-off' && p.acc_row.suggested === 95, p.acc_row)
}
// 4. Per-slot step size beats the default
{
  const p = doubleProgression([row('acc_legpress', 200, 15), row('acc_legpress', 200, 15)], OPTS)
  ok('per-slot step used (10 not 5)', p.acc_legpress.suggested === 210, p.acc_legpress)
}
// 5. No history → no invented number
{
  const p = doubleProgression([], OPTS)
  ok('no history → suggests nothing', p.acc_row.suggested === null && p.acc_row.action === 'no-history', p.acc_row)
}
// 6. ONLY the most recent session decides. A great week 5 must not keep
//    pushing load after a bad week 7.
{
  const p = doubleProgression([
    row('acc_row', 100, 12, 5), row('acc_row', 100, 12, 5),   // great
    row('acc_row', 105, 7, 7), row('acc_row', 105, 7, 7),     // bad, later
  ], OPTS)
  ok('latest session governs, not the best one', p.acc_row.action === 'back-off' && p.acc_row.lastWeek === 7, p.acc_row)
}
// 7. Warm-ups must not decide the prescription
{
  const p = doubleProgression([row('acc_row', 45, 15), row('acc_row', 100, 12), row('acc_row', 100, 12)], OPTS)
  ok('warm-up set ignored, top load governs', p.acc_row.action === 'add-load' && p.acc_row.lastLoad === 100, p.acc_row)
}
// 8. Uncompleted and junk rows rejected
{
  const p = doubleProgression([
    { ...row('acc_row', 999, 12), completed: false },
    { ...row('acc_row', 100, 12) }, { ...row('acc_row', 100, 12) },
    { ...row('acc_row', 1e9, 12) }, { ...row('acc_row', 100, null) },
  ], OPTS)
  ok('uncompleted + absurd + null-rep rows rejected', p.acc_row.lastLoad === 100, p.acc_row)
}
// 9. Bodyweight accessory (load 0) is legitimate, not junk
{
  const p = doubleProgression([row('acc_curl', 0, 15), row('acc_curl', 0, 15)], OPTS)
  ok('bodyweight (0 lb) still progresses', p.acc_curl.action === 'add-load' && p.acc_curl.suggested === 5, p.acc_curl)
}
// 10. Never suggest a negative load
{
  const p = doubleProgression([row('acc_curl', 0, 4), row('acc_curl', 0, 4)], OPTS)
  ok('back-off floors at 0, never negative', p.acc_curl.suggested === 0, p.acc_curl)
}
// 11. Slot with no configured range is not progressed at all
{
  const p = doubleProgression([row('sn_top', 200, 2)], OPTS)
  ok('unranged slot absent from output', p.sn_top === undefined, Object.keys(p))
}
// 12. loadTargets drops the nulls
{
  const p = doubleProgression([row('acc_row', 100, 12), row('acc_row', 100, 12)], OPTS)
  const t = loadTargets(p)
  ok('loadTargets omits no-history slots', t.acc_row === 105 && !('acc_curl' in t), t)
}
// 13. Purity — input untouched, repeatable
{
  const rows = Object.freeze([row('acc_row', 100, 12), row('acc_row', 100, 12)])
  const a = JSON.stringify(doubleProgression(rows, OPTS))
  const b = JSON.stringify(doubleProgression(rows, OPTS))
  ok('pure: same input, same output, no mutation', a === b, null)
}

// ── 14. THE WIRING. ────────────────────────────────────────────────────────
// Codex found double progression fully built, fully tested, and never
// connected: the day page called buildDay without loadTargets, so every
// accessory would render blank forever. Every check above still passed,
// because they all drive buildDay directly. These close that hole — one proves
// the chain end to end, two assert the live call site still wires it.
{
  const { readFileSync } = await import('node:fs')
  const { dadBuilt } = await import('../../src/lib/programs/dadBuilt.ts')

  const MAXES = { back_squat: 315, bench: 225, deadlift: 405, ohp: 135 }
  const acc = dadBuilt.buildDay(1, 1, MAXES).items.find(i => i.kind === 'lift' && i.repRange)
  const top = acc.repRange[1]
  const logs = [1, 2].map(() => ({
    slot: acc.slot, block_name: acc.name, weight_lbs: 100, reps: top,
    completed: true, week_number: 1, day_number: 1, log_type: 'strength_set',
  }))
  const lt = loadTargets(doubleProgression(logs, { ranges: { [acc.slot]: acc.repRange }, defaultStep: 5 }))
  const after = dadBuilt.buildDay(2, 1, MAXES, {}, { loadTargets: lt }).items.find(i => i.slot === acc.slot)
  ok('chain: logged sets become a prescribed accessory weight', after.targetWeightLbs === 105, after.targetWeightLbs)

  // Codex [P2], 2026-08-24: the history query fed the CURRENT session's own
  // rows back into progression, so reopening a day mid-workout moved the
  // prescribed load out from under the athlete. Progression applies to the
  // next exposure, never the one in progress.
  {
    const current = { week_number: 3, day_number: 1 }
    const rows = [
      // last week's session — the one that should drive the target
      { slot: acc.slot, block_name: acc.name, weight_lbs: 100, reps: top,
        completed: true, week_number: 2, day_number: 1, log_type: 'strength_set' },
      // THIS session, already logged at the top of the range
      { slot: acc.slot, block_name: acc.name, weight_lbs: 105, reps: top,
        completed: true, ...current, log_type: 'strength_set' },
    ]
    const withCurrent = loadTargets(doubleProgression(rows, { ranges: { [acc.slot]: acc.repRange }, defaultStep: 5 }))
    const priorOnly = loadTargets(doubleProgression(
      rows.filter(r => !(r.week_number === current.week_number && r.day_number === current.day_number)),
      { ranges: { [acc.slot]: acc.repRange }, defaultStep: 5 },
    ))
    ok('current session is excluded from its own progression',
      withCurrent[acc.slot] !== priorOnly[acc.slot], `${withCurrent[acc.slot]} vs ${priorOnly[acc.slot]}`)
  }

  const page = readFileSync(new URL('../../src/app/train/[program]/[day]/page.tsx', import.meta.url), 'utf8')
  ok('day page computes double progression', page.includes('doubleProgression('), null)
  ok('day page passes loadTargets into buildDay', /buildDay\([^)]*loadTargets/s.test(page), null)
  ok('day page filters out the current session before progressing',
    /week_number\)\s*===\s*weekNumber\s*&&\s*Number\(r\.day_number\)\s*===\s*dayNumber/.test(page), null)
}

// ══ 15. POWER DAD's DB bench — the FOR-175 regression test for a NEW slot ═══
// FOR-195 item 4 turned Wednesday's barbell bench into dumbbells, and with it
// the first range-based slot outside Dad Built. The machinery was already
// built and already tested — against dadBuilt. hybridPower.buildDay did not
// read opts.loadTargets at all, so the slot would have printed with no weight
// forever while every check in this file stayed green: check 14 proves the
// chain for ONE program, and 'the chain works' is not the same claim as 'this
// program is plugged into it'.
{
  const { hybridPower } = await import('../../src/lib/programs/hybridPower.ts')
  const MAXES = {
    snatch: 205, clean_jerk: 260,
    back_squat: 365, front_squat: 315, bench: 250, deadlift: 465, ohp: 155,
  }
  const wed = wk => hybridPower.buildDay(wk, 3, MAXES).items.find(i => i.slot === 'db_bench')

  const w1 = wed(1)
  ok('power dad: Wednesday press is a range slot',
    w1?.name === 'DB Bench Press' && Array.isArray(w1?.repRange) && w1?.percent == null,
    { name: w1?.name, repRange: w1?.repRange, percent: w1?.percent })
  ok('power dad: no history → no invented weight', w1?.targetWeightLbs === undefined, w1?.targetWeightLbs)

  // Every set at the TOP of the window → the next build must show +5 lb.
  const [lo, hi] = w1.repRange
  const logs = Array.from({ length: w1.sets }, () => ({
    slot: 'db_bench', block_name: 'DB Bench Press', weight_lbs: 60, reps: hi,
    completed: true, week_number: 1, day_number: 3, log_type: 'strength_set',
  }))
  const lt = loadTargets(doubleProgression(logs, {
    ranges: { db_bench: w1.repRange }, steps: { db_bench: w1.loadStepLbs }, defaultStep: 5,
  }))
  ok('power dad: a topped-out session suggests +5 lb/hand', lt.db_bench === 65, lt)

  const next = hybridPower.buildDay(2, 3, MAXES, {}, { loadTargets: lt })
    .items.find(i => i.slot === 'db_bench')
  ok('power dad: buildDay reads opts.loadTargets and prints 65 lb',
    next?.targetWeightLbs === 65, next?.targetWeightLbs)

  // ...and it HOLDS when a set falls short, rather than climbing on partial work.
  const short = [
    { slot: 'db_bench', block_name: 'DB Bench Press', weight_lbs: 60, reps: hi,
      completed: true, week_number: 1, day_number: 3, log_type: 'strength_set' },
    { slot: 'db_bench', block_name: 'DB Bench Press', weight_lbs: 60, reps: lo,
      completed: true, week_number: 1, day_number: 3, log_type: 'strength_set' },
  ]
  const held = loadTargets(doubleProgression(short, {
    ranges: { db_bench: w1.repRange }, steps: { db_bench: w1.loadStepLbs }, defaultStep: 5,
  }))
  ok('power dad: one set short of the top holds the load', held.db_bench === 60, held)

  // The windows tighten across the macro the way the percentages used to.
  ok('power dad: the window narrows and climbs meso to meso',
    JSON.stringify([wed(1).repRange, wed(5).repRange, wed(9).repRange])
      === JSON.stringify([[8, 10], [6, 8], [5, 6]]),
    [wed(1)?.repRange, wed(5)?.repRange, wed(9)?.repRange])

  // The day page discovers ranges by PROBING buildDay with no loadTargets, so a
  // slot that only reveals its repRange once it already has a load would never
  // be discovered at all. Probe-shaped call, deliberately.
  const probe = hybridPower.buildDay(1, 3, MAXES, {}, { forceDeload: false })
  ok('power dad: the probe build still advertises the range',
    probe.items.some(i => i.slot === 'db_bench' && i.repRange), null)
}

// ── Regressions found against Andrew's real session 1, 2026-08-25 ───────────
// Both of these passed every synthetic test in this file and still produced a
// wrong prescription on live data. They stay pinned to the actual logged rows.
{
  const S = (slot, w, reps, completed = true) =>
    ({ slot, block_name: slot, weight_lbs: w, reps, completed,
       week_number: 1, day_number: 1, log_type: 'strength_set' })

  // A failed top set followed by the real working weight must NOT become the
  // prescription. Logged 65x12, 55x12, 55x12 -> the working weight is 55.
  const curl = doubleProgression(
    [S('pb_curl_a', 65, 12), S('pb_curl_a', 55, 12), S('pb_curl_a', 55, 12)],
    { ranges: { pb_curl_a: [12, 15] }, defaultStep: 5 })
  ok('a dropped-to weight beats a one-off heavy single',
    curl.pb_curl_a.suggested === 55, `got ${curl.pb_curl_a.suggested}, want 55`)

  // A warm-up ramp must still resolve to the top, or this fix would have
  // traded one wrong answer for another.
  const row = doubleProgression(
    [S('pb_row_a', 143, 12), S('pb_row_a', 165, 12), S('pb_row_a', 165, 12)],
    { ranges: { pb_row_a: [12, 15] }, defaultStep: 5 })
  ok('a warm-up ramp still resolves to the working top set',
    row.pb_row_a.suggested === 165, `got ${row.pb_row_a.suggested}, want 165`)

  // A tie breaks UPWARD. Incline logged 50x12, 55x12, and an incomplete 55 —
  // the incomplete set drops out, leaving one rep at each weight. 55 is the
  // weight reached but not yet repeated, so it is what you accumulate sets at.
  const incline = doubleProgression(
    [S('pb_incline', 50, 12), S('pb_incline', 55, 12), S('pb_incline', 55, 12, false)],
    { ranges: { pb_incline: [12, 15] }, defaultStep: 5 })
  ok('a tied session resolves to the heavier weight',
    incline.pb_incline.suggested === 55, `got ${incline.pb_incline.suggested}, want 55`)

  // Bodyweight logs weight_lbs as NULL. Those rows must enter progression
  // rather than being dropped as missing data.
  const pull = doubleProgression(
    [S('pb_pullup', null, 6), S('pb_pullup', null, 6), S('pb_pullup', null, 5)],
    { ranges: { pb_pullup: [8, 12] }, defaultStep: 5 })
  ok('bodyweight sets are not treated as no-history',
    pull.pb_pullup.action !== 'no-history', `action was ${pull.pb_pullup.action}`)
  ok('bodyweight under the floor advises assistance, not less load',
    /band|assisted/i.test(pull.pb_pullup.reason) && !/back down/i.test(pull.pb_pullup.reason),
    pull.pb_pullup.reason)

  // Holding the top of the range on bodyweight is when load finally enters.
  const pullTop = doubleProgression(
    [S('pb_pullup', null, 12), S('pb_pullup', null, 12), S('pb_pullup', null, 12)],
    { ranges: { pb_pullup: [8, 12] }, defaultStep: 5 })
  ok('bodyweight at the top of the range starts adding weight',
    pullTop.pb_pullup.action === 'add-load' && pullTop.pb_pullup.suggested === 5,
    `${pullTop.pb_pullup.action} / ${pullTop.pb_pullup.suggested}`)
}

console.log('\n' + '='.repeat(58))
console.log(fails ? `✗ ${fails} FAILED of ${checks}` : `✓ ALL GREEN — ${checks} checks`)
process.exit(fails ? 1 : 0)
