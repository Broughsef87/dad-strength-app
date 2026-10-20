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

// 5. Nothing logged at all last session → still carries (Codex r1 P2-3).
{
  const adj = await computeAdjustments(db([], { [SLOT]: 3 }), 'u', hybridPower, 7, 1, RUN_EPOCH, MAXES)
  check('empty session → +3 carried', adj[SLOT] === 3, adj)
}

// 6. A legacy stored value past the clamp carries as what was SHOWN (+8),
//    so a hard session pulls it down at once (Codex r1 P2-2).
{
  const shown = loads(6, { [SLOT]: 12 })
  const logs = shown.map((lbs, i) => ({ slot: SLOT, set_number: i + 1, weight_lbs: lbs, rpe: 10 }))
  const adj = await computeAdjustments(db(logs, { [SLOT]: 12 }), 'u', hybridPower, 7, 1, RUN_EPOCH, MAXES)
  check('stored +12, shown +8, RPE 10 → +4', adj[SLOT] === 4, adj)
  const skip = await computeAdjustments(db([], { [SLOT]: 12 }), 'u', hybridPower, 7, 1, RUN_EPOCH, MAXES)
  check('stored +12, skipped → carries the shown +8', skip[SLOT] === MAX_ADJ, skip)
}

// 7. Part of a stored adjustment hidden by a floor is not carried
//    (Codex r1 P2-1): the carry is what the card moved, not what was stored.
{
  let found = null
  for (let day = 1; day <= 7 && !found; day++) {
    const items = hybridPower.buildDay(6, day, MAXES).items
    for (const it of items) {
      if (it.kind !== 'lift' || it.percent == null || it.setPlan?.length) continue
      const low = hybridPower.buildDay(6, day, MAXES, { [it.slot]: -MAX_ADJ }).items.find(i => i.slot === it.slot)
      const moved = low.percent - it.percent
      if (moved > -MAX_ADJ) { found = { day, slot: it.slot, moved, lbs: low.targetWeightLbs }; break }
    }
  }
  check('a floored slot exists to test against', !!found, found)
  if (found) {
    const logs = [{ slot: found.slot, set_number: 1, weight_lbs: found.lbs, rpe: null }]
    const adj = await computeAdjustments(db(logs, { [found.slot]: -MAX_ADJ }), 'u', hybridPower, 7, found.day, RUN_EPOCH, MAXES)
    check(`stored -${MAX_ADJ}, card moved ${found.moved} → carries ${found.moved}`, (adj[found.slot] ?? 0) === found.moved, adj)
  }
}

// 8. A wave the floor caught on some sets only carries the move the
//    untouched sets showed, so the rebuilt wave matches (Codex r2 P2-1).
{
  let found = null
  for (let wk = 2; wk <= 10 && !found; wk++) for (let day = 1; day <= 7 && !found; day++) {
    for (const it of hybridPower.buildDay(wk, day, MAXES).items) {
      if (it.kind !== 'lift' || !(it.setPlan?.length > 1)) continue
      const low = hybridPower.buildDay(wk, day, MAXES, { [it.slot]: -MAX_ADJ }).items.find(i => i.slot === it.slot)
      const moves = low.setPlan.map((x, i) => x.percent - it.setPlan[i].percent)
      if (new Set(moves).size > 1) { found = { wk, day, slot: it.slot, moves, shown: low.setPlan.map(x => x.percent) }; break }
    }
  }
  check('a partly floored wave exists to test against', !!found, found && { wk: found.wk, slot: found.slot, moves: found.moves })
  if (found) {
    const adj = await computeAdjustments(db([], { [found.slot]: -MAX_ADJ }), 'u', hybridPower, found.wk + 1, found.day, RUN_EPOCH, MAXES)
    const furthest = found.moves.reduce((a, m) => (Math.abs(m) > Math.abs(a) ? m : a), 0)
    check(`carries the furthest move (${furthest}), not the mean`, adj[found.slot] === furthest, adj)
  }
}

// 9. Plate rounding is not a signal (Codex r2 P2-2): a light OHP whose
//    shown loads round under the percent, obeyed at target RPE, carries 0
//    for four straight weeks.
{
  const LIGHT = { ...MAXES, ohp: 100 }
  let worst = 0
  for (let day = 1; day <= 7; day++) {
    let adj = {}
    for (let wk = 1; wk <= 5; wk++) {
      const items = hybridPower.buildDay(wk, day, LIGHT, adj).items.filter(i => i.kind === 'lift' && i.maxKey === 'ohp' && i.targetWeightLbs)
      if (!items.length) break
      const logs = items.flatMap(it => (it.setPlan?.length ? it.setPlan : [{ targetWeightLbs: it.targetWeightLbs }])
        .map((x, i) => ({ slot: it.slot, set_number: i + 1, weight_lbs: x.targetWeightLbs, rpe: it.targetRpe ?? null })))
      adj = await computeAdjustments(db(logs, adj), 'u', hybridPower, wk + 1, day, RUN_EPOCH, LIGHT)
      for (const it of items) worst = Math.min(worst, adj[it.slot] ?? 0)
    }
  }
  check('100 lb OHP obeyed for weeks → no drift', worst === 0, { worst })
}

if (fails) { console.error(`\n${fails} failing`); process.exit(1) }
