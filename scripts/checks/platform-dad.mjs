// ── Platform Dad rules (2026-10-31) ─────────────────────────────────────────
// Andrew's rules for his weightlifting + bodybuilding program, asserted against
// what the registry actually prescribes (buildDay output, every week of the
// macro, with and without a forced deload):
//
//   1. a classic lift (snatch or clean & jerk, any variation) EVERY session
//   2. squats exactly twice a week, one back and one front (meet week aside)
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
    let back = 0, front = 0, overheadDays = 0
    const wim = ((wk - 1) % 13) + 1
    for (const d of days) {
      const plan = p.buildDay(wk, d, MAXES, {}, { forceDeload })
      const tag = `W${wk} D${d}${forceDeload ? ' (deload)' : ''}`
      assert(plan.items.some(isClassic), `${tag}: a classic lift every session`)
      assert(!plan.items.some((i) => i.kind === 'plyo' || i.kind === 'prep' || i.kind === 'outside' && i.slot !== 'pd_wrap'),
        `${tag}: no jumps, sprints or prep`)
      assert(!plan.items.some((i) => /jump|bound|sprint|box|lunge/i.test(i.name ?? i.title ?? '')), `${tag}: nothing named like a jump, sprint or lunge`)
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
      assert(overheadDays >= 3, `W${wk}${forceDeload ? ' (deload)' : ''}: overhead work three days a week — got ${overheadDays}`)
    } else {
      assert(back === 0 && front === 0, `W${wk}: meet week carries no squats`)
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

// The mock meet: three snatch and three clean & jerk attempts at 90/95/100.
{
  const meet = p.buildDay(13, 6, MAXES, {}, {})
  assert(meet.dayType === 'test', 'week 13 Saturday is the mock meet')
  const sn = meet.items.find((i) => i.slot === 'test_snatch')
  const cj = meet.items.find((i) => i.slot === 'test_cj')
  assert(sn?.setPlan?.map((s) => s.targetWeightLbs).join() === '195,205,215', `snatch attempts 195/205/215 — got ${sn?.setPlan?.map((s) => s.targetWeightLbs)}`)
  assert(cj?.setPlan?.map((s) => s.targetWeightLbs).join() === '240,250,265', `C&J attempts 240/250/265 — got ${cj?.setPlan?.map((s) => s.targetWeightLbs)}`)
}

// The percentages climb across the blocks: build < heavy < peak.
{
  const top = (wk) => p.buildDay(wk, 6, MAXES, {}, {}).items.find((i) => i.slot === 'pd_snatch_heavy').setPlan.at(-1).percent
  assert(top(1) < top(5) && top(5) < top(9) && top(11) >= 93, `Saturday snatch climbs build < heavy < peak to 93%+ — got ${top(1)}, ${top(5)}, ${top(9)}, ${top(11)}`)
}

if (fails.length) {
  console.error(fails.map((f) => '  ✗ ' + f).join('\n'))
  console.error(`platform-dad: ${fails.length} of ${checks} FAILED`)
  process.exit(1)
}
console.log(`platform-dad: ${checks} checks passed — a classic lift every session, two squats a week, no jumps, six blocks, four sets`)
