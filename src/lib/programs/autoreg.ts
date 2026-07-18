// ── Deterministic autoregulation ───────────────────────────────────────────────
// Compares last week's reported per-set RPE (same slot, same day) against the
// slot's target RPE and returns bounded percentage deltas for this week's
// build. Pure rules — no AI touches loads.
//
//   avg actual − target   →  adjustment
//        ≥ +2             →  −4%
//        ≥ +1             →  −2%
//        within ±1        →   0
//        ≤ −1             →  +1.5%
//        ≤ −2             →  +3%
//
// Guards: no adjustments on macro week 1 (no prior week in-macro), the
// deload week, or the test week. Deltas are additionally clamped in config.

import { ProgramConfig } from './types'

export const RPE_HINTS: Record<number, string> = {
  1: 'Barely effort',
  2: 'Very easy',
  3: 'Easy',
  4: 'Light work',
  5: '5+ reps left',
  6: '~4 reps left',
  7: '~3 reps left',
  8: '2 reps left',
  9: '1 rep left',
  10: 'Nothing left',
}

function deltaFor(diff: number): number {
  if (diff >= 2) return -4
  if (diff >= 1) return -2
  if (diff <= -2) return 3
  if (diff <= -1) return 1.5
  return 0
}

// Weight deviations under this are treated as noise (5-lb plate rounding on a
// heavy lift is ~1%). Above it, the prescription re-anchors to what was lifted.
const WEIGHT_DEADBAND_PCT = 1.5

export async function computeAdjustments(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  program: ProgramConfig,
  weekNumber: number,
  dayNumber: number,
  maxes: Record<string, number> = {},
): Promise<Record<string, number>> {
  const weekInMacro = ((weekNumber - 1) % program.macroWeeks) + 1
  // Week 1 has no in-macro history; deload + test weeks run as written.
  if (weekInMacro <= 1 || weekInMacro >= program.macroWeeks - 1) return {}

  const prevWeek = weekNumber - 1

  // Last week's workout row for the same day.
  const { data: workouts } = await supabase
    .from('generated_workouts')
    .select('id')
    .eq('user_id', userId).eq('program_slug', program.slug)
    .eq('week_number', prevWeek).eq('day_number', dayNumber)
    .order('id', { ascending: true }).limit(1)
  const workoutId: string | undefined = workouts?.[0]?.id
  if (!workoutId) return {}

  // Completed sets, grouped by slot. `completed = true` so a set that was
  // rated or typed but not actually finished can't skew anything.
  const { data: rows } = await supabase
    .from('ares_session_logs')
    .select('slot, rpe, weight_lbs')
    .eq('generated_workout_id', workoutId)
    .eq('log_type', 'strength_set')
    .eq('completed', true)
    .not('slot', 'is', null)
  if (!rows?.length) return {}

  const bySlot: Record<string, { rpes: number[]; weights: number[] }> = {}
  for (const r of rows as Array<{ slot: string; rpe: number | null; weight_lbs: number | null }>) {
    const s = (bySlot[r.slot] ??= { rpes: [], weights: [] })
    if (r.rpe != null) s.rpes.push(r.rpe)
    if (r.weight_lbs != null && r.weight_lbs > 0) s.weights.push(Number(r.weight_lbs))
  }

  // Last week's prescription per slot (floors bake in even with empty maxes).
  const prevPlan = program.buildDay(prevWeek, dayNumber, {})
  const prescribed: Record<string, { percent: number; targetRpe?: number; maxKey?: string }> = {}
  for (const item of prevPlan.items) {
    if (item.kind === 'lift' && item.percent != null) {
      prescribed[item.slot] = { percent: item.percent, targetRpe: item.targetRpe, maxKey: item.maxKey }
    }
  }

  // The app follows the lifter, two signals per slot:
  //  1. WEIGHT — if the loads actually lifted deviate from last week's
  //     prescription, re-anchor: delta = avg(actual as % of max) − prescribed%.
  //     This carries forward through the wave (the weekly step still applies on
  //     top in the config tables), so lifting heavier moves next week up, and
  //     backing off moves it down.
  //  2. RPE — the existing difficulty correction, applied on top.
  // Clamping (MAX_ADJ) and percent floors live in the program config.
  const adjustments: Record<string, number> = {}
  for (const [slot, s] of Object.entries(bySlot)) {
    const p = prescribed[slot]
    if (!p) continue

    let weightDelta = 0
    const max = p.maxKey ? maxes[p.maxKey] : undefined
    if (s.weights.length && max && max > 0) {
      const actualPct = (s.weights.reduce((a, b) => a + b, 0) / s.weights.length / max) * 100
      const d = actualPct - p.percent
      if (Math.abs(d) >= WEIGHT_DEADBAND_PCT) weightDelta = d
    }

    let rpeDelta = 0
    if (s.rpes.length && p.targetRpe != null) {
      const avg = s.rpes.reduce((a, b) => a + b, 0) / s.rpes.length
      rpeDelta = deltaFor(avg - p.targetRpe)
    }

    const total = Math.round((weightDelta + rpeDelta) * 2) / 2
    if (total !== 0) adjustments[slot] = total
  }
  return adjustments
}
