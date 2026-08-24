// The ratchet fix must not break the weight-follow the athlete demanded:
// "the next week still just follows your percentage rule instead of adjusting
// to the weights I used." Verify it still tracks real deviation, and that the
// speed-slot guard is asymmetric (backs off, never chases).
import { hybridPower } from '../../src/lib/programs/hybridPower.ts'
import { computeAdjustments } from '../../src/lib/programs/autoreg.ts'

const MAXES = { snatch: 205, clean_jerk: 260, back_squat: 365, front_squat: 315, bench: 250, deadlift: 465, ohp: 155 }
const db = (logs, storedAdj = {}) => ({
  from: () => {
    const o = {
      select: () => o, eq: () => o, order: () => o,
      limit: () => Promise.resolve({ data: [{ id: 'w', workout_data: { adjustments: storedAdj } }] }),
      not: () => Promise.resolve({ data: logs }),
    }
    return o
  },
})

let fails = 0
const check = (label, got, want) => {
  const ok = want(got)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${got ?? 0}`)
  if (!ok) fails++
}

// Helper: what was SHOWN for a slot in week wk with no carried adjustment.
const shown = (wk, day, slot) =>
  hybridPower.buildDay(wk, day, MAXES).items.find(i => i.slot === slot)

// ── 1. NORMAL slot, athlete goes genuinely heavier than the card ──────────────
{
  const s = shown(2, 5, 'cl_top')                    // Power Clean, has targetRpe
  const heavier = Math.round(s.targetWeightLbs * 1.05 / 5) * 5
  const adj = await computeAdjustments(
    db([{ slot: 'cl_top', rpe: 8, weight_lbs: heavier }, { slot: 'cl_top', rpe: 8, weight_lbs: heavier }]),
    'u', hybridPower, 3, 5, MAXES)
  check('normal slot, lifted ~5% heavy → follows UP', adj.cl_top, v => v > 1)
}

// ── 2. NORMAL slot, athlete backs off ────────────────────────────────────────
{
  const s = shown(2, 5, 'cl_top')
  const lighter = Math.round(s.targetWeightLbs * 0.93 / 5) * 5
  const adj = await computeAdjustments(
    db([{ slot: 'cl_top', rpe: 9, weight_lbs: lighter }, { slot: 'cl_top', rpe: 9, weight_lbs: lighter }]),
    'u', hybridPower, 3, 5, MAXES)
  check('normal slot, backed off ~7%      → follows DOWN', adj.cl_top, v => v < -1)
}

// ── 3. SPEED slot, athlete loads ABOVE the window → must NOT chase ───────────
{
  const s = shown(2, 5, 'speed_squat')
  const heavier = Math.round(s.targetWeightLbs * 1.12 / 5) * 5
  const adj = await computeAdjustments(
    db([{ slot: 'speed_squat', rpe: 7, weight_lbs: heavier }, { slot: 'speed_squat', rpe: 7, weight_lbs: heavier }]),
    'u', hybridPower, 3, 5, MAXES)
  check('speed slot, loaded 12% ABOVE    → refuses to chase', adj.speed_squat, v => (v ?? 0) <= 0)
}

// ── 4. SPEED slot, athlete backs off (bar was slow) → must follow down ───────
{
  const s = shown(2, 5, 'speed_squat')
  const lighter = Math.round(s.targetWeightLbs * 0.90 / 5) * 5
  const adj = await computeAdjustments(
    db([{ slot: 'speed_squat', rpe: 7, weight_lbs: lighter }, { slot: 'speed_squat', rpe: 7, weight_lbs: lighter }]),
    'u', hybridPower, 3, 5, MAXES)
  check('speed slot, backed off 10%      → follows DOWN', adj.speed_squat, v => v < -1)
}

// ── 5. SPEED slot carries no RPE anchor at all ───────────────────────────────
{
  const sq = shown(2, 5, 'speed_squat')
  const hp = shown(2, 5, 'hang_psn')
  check('speed squat targetRpe is unset', sq.targetRpe === undefined ? 'undefined' : sq.targetRpe, v => v === 'undefined')
  check('speed-oly targetRpe is unset   ', hp.targetRpe === undefined ? 'undefined' : hp.targetRpe, v => v === 'undefined')
  check('speed squat flagged velocity   ', String(sq.velocity), v => v === 'true')
}

// ── 6. RPE alone can no longer move a speed slot ─────────────────────────────
{
  const s = shown(2, 5, 'speed_squat')
  const adj = await computeAdjustments(
    db([{ slot: 'speed_squat', rpe: 3, weight_lbs: s.targetWeightLbs },
        { slot: 'speed_squat', rpe: 3, weight_lbs: s.targetWeightLbs }]),
    'u', hybridPower, 3, 5, MAXES)
  check('speed slot, on-weight + RPE 3   → no RPE-driven bump', adj.speed_squat, v => (v ?? 0) === 0)
}

console.log('\n' + (fails ? `✗ ${fails} FAILED` : '✓ all behaviour preserved'))
process.exit(fails ? 1 : 0)
