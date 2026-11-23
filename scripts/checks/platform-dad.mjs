// ── Platform Dad rules (2026-10-31) ─────────────────────────────────────────
// Andrew's rules for his weightlifting + bodybuilding program, asserted against
// what the registry actually prescribes (buildDay output, every week of the
// macro, with and without a forced deload):
//
//   1. the Olympic lifts on exactly two days a week, power versions only: no
//      full squat catch outside the taper and the meet (FOR-354, 2026-11-23)
//   2. squats twice a week, one back and one front, both moderate (FOR-356)
//   3. no jumps, sprints or prep sequence anywhere — his knees
//   4. no day over the 6-block budget (Power Dad's length, no longer)
//   5. never more than 4 sets of anything
//   6. every percent lift carries a weight, every wave set its own
//   7. overhead work three days a week (the weak point)
//   8. off the public site, selectable in the app
//
// Its own file, so a revert of the program cannot take the check with it.
import { PROGRAMS, LISTED_PROGRAMS } from '../../src/lib/programs/index.ts'
import { blockCount, scheduledDayNumbers } from '../../src/lib/programs/schedule.ts'
import { MAX_ADJ } from '../../src/lib/programs/autoreg.ts'

let checks = 0
const fails = []
const assert = (cond, msg) => { checks++; if (!cond) fails.push(msg) }

const p = PROGRAMS['platform-dad']
assert(!!p, 'platform-dad is in the registry')
if (!p) { console.error(fails.join('\n')); process.exit(1) }
assert(p.listed === false && !LISTED_PROGRAMS['platform-dad'], 'platform-dad is off the public site')

const MAXES = { snatch: 215, clean_jerk: 265, back_squat: 425, front_squat: 355, ohp: 180 }
const CLASSIC = /snatch|clean/i
const isClassic = (i) => i.kind === 'lift' && (i.maxKey === 'snatch' || i.maxKey === 'clean_jerk') && CLASSIC.test(i.name) && !/pull/i.test(i.name)
const OVERHEAD = /press|jerk/i

for (const forceDeload of [false, true]) {
  for (let wk = 1; wk <= 26; wk++) {
    const days = scheduledDayNumbers(p, wk)
    let back = 0, front = 0, olyDays = 0, overheadDays = 0
    const wim = ((wk - 1) % 13) + 1
    for (const d of days) {
      const plan = p.buildDay(wk, d, MAXES, {}, { forceDeload })
      const tag = `W${wk} D${d}${forceDeload ? ' (deload)' : ''}`
      const classics = plan.items.filter(isClassic)
      if (classics.length) olyDays++
      // Power versions only (FOR-354). The taper's openers and the meet are the
      // two places a full lift is allowed; neither is in weeks 1-11.
      if (wim <= 11 && !forceDeload) {
        for (const c of classics) assert(/power/i.test(c.name), `${tag} ${c.slot}: Olympic work is a power version, got ${c.name}`)
      }
      assert(!plan.items.some((i) => i.kind === 'plyo' || i.kind === 'prep' || i.kind === 'outside' && i.slot !== 'pd_wrap'),
        `${tag}: no jumps, sprints or prep`)
      // "With No Jump" is the opposite of a jump: feet stay flat (FOR-349). It is
      // stripped before the test so it cannot hide a real jump in the same name.
      assert(!plan.items.some((i) => /jump|bound|sprint|box|lunge|burpee|step-over/i.test(
        `${i.name ?? i.title ?? ''} ${i.description ?? ''}`.replace(/\bwith no jump\b/ig, ''))),
        `${tag}: nothing named like a jump, sprint, lunge or burpee`)
      assert(blockCount(plan) <= 6, `${tag}: ${blockCount(plan)} blocks, over the 6-block budget`)
      for (const i of plan.items) {
        if (!('sets' in i)) continue
        assert(i.sets <= 4, `${tag} ${i.slot}: ${i.sets} sets, over the 4-set ceiling`)
        if (i.kind === 'lift' && i.percent != null) {
          assert(i.targetWeightLbs > 0, `${tag} ${i.slot}: percent lift with no weight`)
          if (i.setPlan) {
            assert(i.setPlan.length === i.sets, `${tag} ${i.slot}: setPlan length ${i.setPlan.length} vs ${i.sets} sets`)
            assert(i.setPlan.every((s) => s.targetWeightLbs > 0), `${tag} ${i.slot}: a wave set with no weight`)
          }
        }
      }
      if (plan.items.some((i) => i.kind === 'lift' && /^back squat/i.test(i.name))) back++
      if (plan.items.some((i) => i.kind === 'lift' && /^front squat/i.test(i.name))) front++
      if (plan.items.some((i) => i.kind === 'lift' && OVERHEAD.test(i.name) && !/incline|db press/i.test(i.name))) overheadDays++
    }
    if (wim !== 13) {
      assert(days.length === 4, `W${wk}: four sessions, got ${days.length}`)
      assert(back === 1 && front === 1, `W${wk}${forceDeload ? ' (deload)' : ''}: one back and one front squat day — got ${back} back, ${front} front`)
      assert(olyDays === 2, `W${wk}${forceDeload ? ' (deload)' : ''}: the Olympic lifts on two days — got ${olyDays}`)
      assert(overheadDays >= 3, `W${wk}${forceDeload ? ' (deload)' : ''}: overhead work three days a week — got ${overheadDays}`)
    } else {
      assert(back === 0 && front === 0, `W${wk}: test week carries no squats`)
    }
  }
}

// A forced deload actually deloads: every percent lift lighter or fewer sets,
// every range slot two easy sets with 4 in reserve (Codex r1).
for (const wk of [2, 6, 10]) {
  for (const d of [1, 3, 5, 6]) {
    const full = p.buildDay(wk, d, MAXES, {}, {})
    const light = p.buildDay(wk, d, MAXES, {}, { forceDeload: true })
    for (const i of light.items) {
      if (i.kind !== 'lift') continue
      const f = full.items.find((x) => x.slot === i.slot)
      if (i.percent != null) {
        assert(i.sets < f.sets || i.percent < f.percent, `W${wk} D${d} ${i.slot}: forced deload is lighter (${f.sets}@${f.percent} -> ${i.sets}@${i.percent})`)
      } else {
        assert(i.sets === 2 && i.targetRir >= 4, `W${wk} D${d} ${i.slot}: forced deload range work is 2 sets at 4+ in reserve — got ${i.sets} at RIR ${i.targetRir}`)
      }
    }
  }
}

// A deload never raises a load, with or without the short-day mode (FOR-331).
for (let wk = 1; wk <= 11; wk++) {
  for (const d of [1, 3, 5, 6]) {
    for (const timeConstrained of [false, true]) {
      const full = p.buildDay(wk, d, MAXES, {}, { timeConstrained })
      const light = p.buildDay(wk, d, MAXES, {}, { forceDeload: true, timeConstrained })
      for (const i of light.items) {
        if (i.kind !== 'lift' || i.percent == null) continue
        const f = full.items.find((x) => x.slot === i.slot)
        if (!f) continue
        const heaviest = (x) => Math.max(x.targetWeightLbs ?? 0, ...(x.setPlan ?? []).map((s) => s.targetWeightLbs ?? 0))
        assert(heaviest(i) <= heaviest(f), `W${wk} D${d}${timeConstrained ? ' short' : ''} ${i.slot}: deload raised the load ${heaviest(f)} -> ${heaviest(i)}`)
      }
    }
  }
}

// The test (FOR-356): "test power clean, we don't need to test snatch."
// Three power clean attempts at 80/85/90 of the clean & jerk max, nothing else.
{
  const test = p.buildDay(13, 6, MAXES, {}, {})
  assert(test.dayType === 'test', 'week 13 Saturday is the test')
  const pc = test.items.find((i) => i.slot === 'test_power_clean')
  assert(pc?.setPlan?.map((s) => s.targetWeightLbs).join() === '210,225,240', `power clean attempts 210/225/240 — got ${pc?.setPlan?.map((s) => s.targetWeightLbs)}`)
  assert(!test.items.some((i) => i.kind === 'lift' && /snatch/i.test(i.name)), 'no snatch test')
  const olyDays13 = scheduledDayNumbers(p, 13).filter((d) => p.buildDay(13, d, MAXES, {}).items.some((i) => i.kind === 'lift' && /snatch|clean/i.test(i.name))).length
  assert(olyDays13 === 2, `test week: two Olympic days, got ${olyDays13}`)
}

// The percentages climb across the blocks: build < heavy < peak.
{
  const top = (wk) => p.buildDay(wk, 6, MAXES, {}, {}).items.find((i) => i.slot === 'pd_power_cj').setPlan.at(-1).percent
  // A power clean & jerk tops out well under the full lift's max (FOR-354).
  assert(top(1) < top(5) && top(5) < top(9) && top(11) <= 86, `Saturday power C&J climbs build < heavy < peak and stays at or under 86% — got ${top(1)}, ${top(5)}, ${top(9)}, ${top(11)}`)
}

// 9. The target RPE matches the load (FOR-344). Andrew, 2026-11-10: "5 reps
//    @60% isn't gonna be an rpe 7." Strength work reads its target off the
//    %-by-reps chart; light volume asks for an honest 5, the heavy end still 7-9.
{
  const lift = (wk, d, slot) => p.buildDay(wk, d, MAXES, {}).items.find((i) => i.slot === slot)
  const want = [
    ['W1 push press 4x5 @60%', 1, 5, 'pd_push_press_pct', 5],
    ['W1 back squat 4x5 @66%', 1, 1, 'pd_back_squat', 5],
    ['W1 front squat 4x4 @66%', 1, 5, 'pd_front_squat', 5],
    // FOR-351: the press runs out of reps sooner. Andrew logged 125-130 x 6
    // off a 180 press at RPE 6-8, so 70% x 6 asks for 6 and 72% x 6 for 7.
    ['W1 strict press 4x6 @70%', 1, 3, 'pd_ohp', 6],
    ['W2 strict press 4x6 @72%', 2, 3, 'pd_ohp', 7],
    ['W8 back squat 4x4 @76%', 8, 1, 'pd_back_squat', 5],
    ['W11 strict press 4x3 @88%', 11, 3, 'pd_ohp', 9],
  ]
  for (const [tag, wk, d, slot, rpe] of want) {
    const i = lift(wk, d, slot)
    assert(i?.targetRpe === rpe, `${tag}: target RPE ${rpe}, got ${i?.targetRpe}`)
  }
  // The lights lifts keep the meso number; the chart is for strength work only.
  assert(lift(1, 1, 'pd_hang_power_snatch')?.targetRpe === 7, 'W1 power snatch keeps the meso target (lights rate it)')
}

// 10. Technique variety (FOR-349), kept through FOR-356: the Monday power
//     snatch rotates every two weeks in phases 1-2;
//     phase 3, the taper and the meet carry no primers.
{
  const at = (wk, d, slot) => p.buildDay(wk, d, MAXES, {}).items.find((i) => i.slot === slot)
  for (const slot of [['pd_hang_power_snatch', 1]]) {
    const names = [1, 3, 5, 7].map((wk) => at(wk, slot[1], slot[0])?.name)
    assert(new Set(names).size === 4, `${slot[0]}: four movements across weeks 1-8, got ${names.join(' / ')}`)
    for (const wk of [1, 3, 5, 7]) {
      assert(at(wk, slot[1], slot[0])?.name === at(wk + 1, slot[1], slot[0])?.name, `${slot[0]}: W${wk} and W${wk + 1} share a movement (two-week rotation)`)
    }
  }
  for (let wk = 9; wk <= 13; wk++) {
    for (const d of scheduledDayNumbers(p, wk)) {
      for (const i of p.buildDay(wk, d, MAXES, {}).items) {
        assert(!/Primer:/.test(i.note ?? ''), `W${wk} D${d} ${i.name}: no primer in phase 3, the taper or the meet`)
      }
    }
  }
}

// 11. Knees first (FOR-354). Andrew, 2026-11-23: "The heavy squatting and the
//     plyo frequency has really torn my knees up." Both squats stay moderate,
//     nothing single-leg or deep, and conditioning lands nothing.
{
  for (let wk = 1; wk <= 11; wk++) {
    for (const [d, slot] of [[1, 'pd_back_squat'], [5, 'pd_front_squat']]) {
      const sq = p.buildDay(wk, d, MAXES, {}).items.find((i) => i.slot === slot)
      assert(sq && sq.percent <= 76, `W${wk} ${slot}: at or under 76%, got ${sq?.percent}`)
      const up = p.buildDay(wk, d, MAXES, { [slot]: MAX_ADJ }).items.find((i) => i.slot === slot)
      assert(up && up.percent <= 76, `W${wk} ${slot}: with +${MAX_ADJ} autoreg still at or under 76%, got ${up?.percent}`)
      // The AUTO badge shows what the ceiling let through, not the raw push.
      assert((up.appliedAdjustmentPct ?? 0) === up.percent - sq.percent, `W${wk} ${slot}: AUTO shows ${up.appliedAdjustmentPct}, moved ${up.percent - sq.percent}`)
    }
    for (const d of scheduledDayNumbers(p, wk)) {
      for (const i of p.buildDay(wk, d, MAXES, {}).items) {
        assert(!/split squat|bulgarian|pistol|step-up|overhead squat|snatch balance/i.test(i.name ?? ''), `W${wk} D${d}: no deep or single-leg knee work, got ${i.name}`)
      }
    }
  }
  // No full catch before the meet: the taper week's Olympic work is power too.
  for (const d of scheduledDayNumbers(p, 12)) {
    for (const c of p.buildDay(12, d, MAXES, {}).items.filter(isClassic)) {
      assert(/power/i.test(c.name), `W12 D${d} ${c.slot}: taper Olympic work is a power version, got ${c.name}`)
    }
  }
  // Every scheduled day has work in it (Codex r1: an empty meet-week day).
  for (const wk of [12, 13]) {
    for (const d of scheduledDayNumbers(p, wk)) {
      const plan = p.buildDay(wk, d, MAXES, {})
      assert(plan.dayType === 'rest' || plan.items.length > 0, `W${wk} D${d}: a scheduled session with nothing in it`)
    }
  }
  // Bench twice, and no separate pulls or jerks (FOR-356).
  for (let wk = 1; wk <= 11; wk++) {
    const names = scheduledDayNumbers(p, wk).flatMap((d) => p.buildDay(wk, d, MAXES, {}).items.map((i) => i.name ?? ''))
    assert(names.filter((n) => /bench press/i.test(n) && !/db/i.test(n)).length === 2, `W${wk}: bench twice a week, got ${names.filter((n) => /bench/i.test(n)).join(', ')}`)
    const stray = names.filter((n) => /(snatch|clean|segment) pull|halting|^jerk|split jerk/i.test(n))
    assert(stray.length === 0, `W${wk}: no separate pulls or jerks, got ${stray.join(', ')}`)
  }
  const conditioning = [1, 2, 3].flatMap((wk) => [5, 6].map((d) => p.buildDay(wk, d, MAXES, {}).items.filter((i) => i.kind === 'metcon'))).flat()
  assert(conditioning.length === 6, `two conditioning pieces a week, got ${conditioning.length} over three weeks`)
  assert(conditioning.every((m) => /bike|row|sled/i.test(m.description)), 'conditioning is bike, rower or sled only')
}

if (fails.length) {
  console.error(fails.map((f) => '  ✗ ' + f).join('\n'))
  console.error(`platform-dad: ${fails.length} of ${checks} FAILED`)
  process.exit(1)
}
console.log(`platform-dad: ${checks} checks passed — Olympic lifts on two days, two moderate squats, bench twice, no jumps, six blocks, four sets`)
