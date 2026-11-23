// ── The per-set plan contract (FOR-263, kept through FOR-358) ─────────────
//
// FOR-263 gave Power Dad's Monday an EMOM and squat waves, and this suite was
// written to pin them. The knees-first rebuild (FOR-358) retired that Monday,
// so the Monday-specific pins went with it; the two contracts that guard every
// program stay, in their own file:
//
//   · `sets` and `setPlan` are one fact: a plan is never longer than its sets,
//     over every program, every mode and every week.
//   · Obedience is not a signal: lifting a per-set plan as written, or any
//     prefix of it, moves next week nowhere.
//
// ITS OWN FILE, so a revert of a program cannot take the check with it.
import { hybridPower } from '../../src/lib/programs/hybridPower.ts'
import { computeAdjustments } from '../../src/lib/programs/autoreg.ts'
import { PROGRAMS } from '../../src/lib/programs/index.ts'

const MAXES = { snatch: 220, clean_jerk: 275, back_squat: 435, front_squat: 355, bench: 255, deadlift: 435, ohp: 185 }

let failed = 0
let passed = 0
const assert = (cond, msg) => {
  if (cond) { passed++; return }
  failed++
  console.log(`  \u2717 ${msg}`)
}
const at = (w, slot) => hybridPower.buildDay(w, 1, MAXES).items.find((i) => i.slot === slot)

// ── 4c. `sets` AND `setPlan` ARE ONE FACT, everywhere (Codex r1 P2) ───────
//
// Three call sites changed `sets` and left the plan behind. The contract is
// that a plan is never LONGER than the set count it describes, and it is
// asserted over every program, both modes and every week — so a fourth call
// site fails here rather than drifting.
{
  let planned = 0
  const breaches = []
  for (const [slug, program] of Object.entries(PROGRAMS)) {
    const days = Array.isArray(program.gymDayNumbers) && program.gymDayNumbers.length
      ? program.gymDayNumbers : [1, 2, 3, 4, 5, 6, 7]
    for (const opts of [{}, { timeConstrained: true }, { forceDeload: true },
                        { timeConstrained: true, forceDeload: true }]) {
      for (let week = 1; week <= 13; week++) {
        for (const day of days) {
          for (const i of program.buildDay(week, day, MAXES, {}, opts)?.items ?? []) {
            if (i.kind !== 'lift' || !i.setPlan) continue
            planned++
            if (i.setPlan.length > i.sets) {
              breaches.push(`${slug} W${week}D${day} ${i.slot} ${JSON.stringify(opts)}`
                + ` — ${i.sets} sets, ${i.setPlan.length} planned`)
            }
          }
        }
      }
    }
  }
  assert(breaches.length === 0,
    `no prescription plans more sets than it asks for — ${breaches.length ? breaches[0] : `${planned} plans checked`}`)
  // The sweep has to actually REACH a per-set plan, or it proves nothing about
  // a contract it never saw (this is the `every([])` trap, Codex r1).
  assert(planned > 0, 'the contract sweep found at least one per-set plan to check')
  // And the time-constrained mode is the site that was broken, so prove the
  // mode reaches a per-set plan and keeps it whole with its set count.
  const tc = PROGRAMS['hybrid-power'].buildDay(9, 1, MAXES, {}, { timeConstrained: true })
  const tcSn = tc.items.find((i) => i.slot === 'sn_top')
  assert(tcSn?.setPlan != null && tcSn.setPlan.length === tcSn.sets,
    `a time-constrained Peak Monday keeps the snatch climb and its set count together, got ${tcSn?.sets} sets and ${tcSn?.setPlan?.length} planned`)
}

// ── 5. OBEDIENCE IS NOT A SIGNAL. Lift the wave as written, drift nothing ──
//
// The weight-follow averages every load logged in the day and measures it
// against the prescription. A wave's `percent` is its first set (75), while
// its average is 81, so reading the first set as the prescription turns doing
// exactly as told into "+6% heavy" and walks the whole wave up a week at a
// time. This is the assertion that catches that.
// THE STUB HONOURS `.select()`, projecting each row to the columns the engine
// actually asked for. A stub that ignores the column list cannot tell that the
// engine stopped asking for `set_number` — and without that column every
// logged load falls back to the wave's mean, which is the P1 this round fixed.
// Dropping it from the query left the whole suite green (Codex r1, my own
// mutation run), so the instrument was the thing at fault.
const chain = (data) => {
  let cols = null
  const project = () => (cols === null ? data : data.map((r) => {
    const out = {}
    for (const c of cols) if (c in r) out[c] = r[c]
    return out
  }))
  const o = {
    select: (list) => {
      cols = typeof list === 'string' && list.trim() !== '*'
        ? list.split(',').map((c) => c.trim())
        : null
      return o
    },
    eq: () => o, gte: () => o, order: () => o,
    limit: () => Promise.resolve({ data: project() }),
    not: () => Promise.resolve({ data: project() }),
  }
  return o
}
const fakeDbOf = (logs) => ({ from: (t) => chain(t === 'generated_workouts' ? [{ id: 'w5' }] : logs) })

{
  // Power Dad's Peak block climbs to a heavy single: three singles, three
  // loads. Lifting the climb exactly as written must move next week nowhere,
  // every prefix of it too, and a climb lifted heavy must still read heavy.
  const sn = at(9, 'sn_top')
  const logs = (sn?.setPlan ?? []).map((x, i) => ({ slot: 'sn_top', set_number: i + 1, rpe: sn.targetRpe, weight_lbs: x.targetWeightLbs }))
  assert(logs.length === 3, `the W9 snatch is a three-single climb, got ${logs.length} sets`)
  const adj = await computeAdjustments(fakeDbOf(logs), 'u1', hybridPower, 10, 1, Date.now(), MAXES)
  assert((adj.sn_top ?? 0) === 0, `lifting the W9 climb exactly as prescribed must move W10 nowhere, got ${adj.sn_top}`)
  for (const n of [1, 2]) {
    const a = await computeAdjustments(fakeDbOf(logs.filter((r) => r.set_number <= n)), 'u1', hybridPower, 10, 1, Date.now(), MAXES)
    assert((a.sn_top ?? 0) === 0, `finishing ${n} of 3 climb singles as prescribed must move W10 nowhere, got ${a.sn_top}`)
  }
  const heavy = logs.map((r) => ({ ...r, weight_lbs: r.weight_lbs + 15 }))
  const aHeavy = await computeAdjustments(fakeDbOf(heavy), 'u1', hybridPower, 10, 1, Date.now(), MAXES)
  assert((aHeavy.sn_top ?? 0) > 0, `15 lb a single above the climb must still read as heavier, got ${aHeavy.sn_top}`)
}


if (failed) {
  console.log(`\u2717 ${failed} of ${passed + failed} assertions failed`)
  process.exit(1)
}
console.log(`\u2713 ${passed} assertions: a per-set plan is one fact with its set count, and obeying it is not a signal`)
