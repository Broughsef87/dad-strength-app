// Does the weight-follow double-count its own prior adjustment?
// Simulate an athlete who follows the app EXACTLY, week after week.
import { hybridPower } from '../../src/lib/programs/hybridPower.ts'
import { computeAdjustments } from '../../src/lib/programs/autoreg.ts'

const MAXES = { snatch: 205, clean_jerk: 260, back_squat: 365, front_squat: 315, bench: 250, deadlift: 465, ohp: 155 }

// Fake DB: returns the logs we hand it for the previous week.
const db = (logs, storedAdj) => ({
  from: t => {
    const o = {
      select: () => o, eq: () => o, order: () => o,
      limit: () => Promise.resolve({ data: [{ id: 'w', workout_data: { adjustments: storedAdj } }] }),
      not: () => Promise.resolve({ data: logs }),
    }
    return o
  },
})

const SLOT = 'speed_squat'
const DAY = 5

console.log('Simulating: athlete lifts EXACTLY what the app shows him, every week.\n')
console.log('wk | table% | adj  | SHOWN% | he lifts | rpe | next adj')
console.log('---+--------+------+--------+----------+-----+---------')

let adj = {}
for (let wk = 1; wk <= 8; wk++) {
  const plan = hybridPower.buildDay(wk, DAY, MAXES, adj)
  const item = plan.items.find(i => i.slot === SLOT)
  const tablePlan = hybridPower.buildDay(wk, DAY, MAXES)
  const tablePct = tablePlan.items.find(i => i.slot === SLOT)?.percent
  const shown = item?.percent
  const lifted = item?.targetWeightLbs           // he loads exactly what it says
  const carried = adj[SLOT] ?? 0

  // He rates a 55-70% speed double honestly: RPE 4. Target on this slot is 6.
  const logs = [
    { slot: SLOT, rpe: 4, weight_lbs: lifted },
    { slot: SLOT, rpe: 4, weight_lbs: lifted },
  ]
  const next = await computeAdjustments(db(logs, adj), 'u', hybridPower, wk + 1, DAY, MAXES)

  console.log(
    String(wk).padStart(2) + ' | ' +
    String(tablePct).padStart(6) + ' | ' +
    String(carried > 0 ? '+' + carried : carried).padStart(4) + ' | ' +
    String(shown).padStart(6) + ' | ' +
    String(lifted).padStart(8) + ' | ' +
    String(4).padStart(3) + ' | ' +
    String((next[SLOT] ?? 0) > 0 ? '+' + next[SLOT] : (next[SLOT] ?? 0)).padStart(7),
  )
  adj = next
}

console.log('\nIf the SHOWN% column climbs away from table%, the engine is')
console.log('double-counting its own advice: "you lifted more than the table')
console.log('said" — when in fact he lifted exactly what the app told him to.')
