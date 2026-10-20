// Does an adjustment survive a week where the athlete did exactly as told?
// Week 6 back squat showed +3%, he lifted every set as shown at RPE 6-8, and
// week 7 dropped back to the bare table: lighter than the week he had beaten.
// The weight-follow and RPE read are CHANGES to what was shown, so the shown
// adjustment has to carry.
import { hybridPower } from '../../src/lib/programs/hybridPower.ts'
import { computeAdjustments, MAX_ADJ } from '../../src/lib/programs/autoreg.ts'
// RUN_EPOCH: these fixtures are built by hand and are not exercising run
// scoping, so they ask for every row.
import { RUN_EPOCH } from '../../src/lib/programs/run.ts'

const MAXES = { snatch: 205, clean_jerk: 265, back_squat: 415, front_squat: 330, bench: 255, deadlift: 405, ohp: 175 }
const db = (logs, storedAdj = {}) => ({
  from: () => {
    const o = {
      select: () => o, eq: () => o, gte: () => o, order: () => o,
      limit: () => Promise.resolve({ data: [{ id: 'w', workout_data: { adjustments: storedAdj } }] }),
      not: () => Promise.resolve({ data: logs }),
    }
    return o
  },
})

let fails = 0
const check = (label, ok, got) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(got)}`)
  if (!ok) fails++
}
const SLOT = 'back_squat_heavy'
const loads = (wk, adj) => hybridPower.buildDay(wk, 1, MAXES, adj).items.find(i => i.slot === SLOT).setPlan.map(s => s.targetWeightLbs)

// 1. Followed the card exactly, RPE inside ±1 of target → keeps the +3.
{
  const shown = loads(6, { [SLOT]: 3 })
  const rpes = [6, 7, 8, 7, 7, 8]
  const logs = shown.map((lbs, i) => ({ slot: SLOT, set_number: i + 1, weight_lbs: lbs, rpe: rpes[i] }))
  const adj = await computeAdjustments(db(logs, { [SLOT]: 3 }), 'u', hybridPower, 7, 1, RUN_EPOCH, MAXES)
  check('obeyed +3 card at target RPE → still +3', adj[SLOT] === 3, adj)
  const w7 = loads(7, adj), w6 = shown
  check('week 7 top single is above week 6 top single', w7[5] > w6[5], { w6: w6[5], w7: w7[5] })
}

// 2. Skipped the slot last week → the adjustment waits, it is not erased.
{
  const adj = await computeAdjustments(db([{ slot: 'bench_heavy', set_number: 1, weight_lbs: 200, rpe: 8 }], { [SLOT]: 3 }),
    'u', hybridPower, 7, 1, RUN_EPOCH, MAXES)
  check('no squat logs → +3 carried', adj[SLOT] === 3, adj)
}

// 3. Carry plus a light RPE never banks past the clamp.
{
  const shown = loads(6, { [SLOT]: MAX_ADJ })
  const logs = shown.map((lbs, i) => ({ slot: SLOT, set_number: i + 1, weight_lbs: lbs, rpe: 5 }))
  const adj = await computeAdjustments(db(logs, { [SLOT]: MAX_ADJ }), 'u', hybridPower, 7, 1, RUN_EPOCH, MAXES)
  check(`stored value clamps at ${MAX_ADJ}`, adj[SLOT] === MAX_ADJ, adj)
}

// 4. Heavy RPE on an obeyed +3 card still pulls it down.
{
  const shown = loads(6, { [SLOT]: 3 })
  const logs = shown.map((lbs, i) => ({ slot: SLOT, set_number: i + 1, weight_lbs: lbs, rpe: 10 }))
  const adj = await computeAdjustments(db(logs, { [SLOT]: 3 }), 'u', hybridPower, 7, 1, RUN_EPOCH, MAXES)
  check('obeyed +3 at RPE 10 → comes down', (adj[SLOT] ?? 0) < 3, adj)
}

if (fails) { console.error(`\n${fails} failing`); process.exit(1) }
