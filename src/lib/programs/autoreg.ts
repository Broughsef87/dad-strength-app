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

export async function computeAdjustments(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  program: ProgramConfig,
  weekNumber: number,
  dayNumber: number,
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

  // Completed sets with reported RPE, grouped by slot.
  const { data: rows } = await supabase
    .from('ares_session_logs')
    .select('slot, rpe')
    .eq('generated_workout_id', workoutId)
    .eq('log_type', 'strength_set')
    .not('rpe', 'is', null)
    .not('slot', 'is', null)
  if (!rows?.length) return {}

  const bySlot: Record<string, number[]> = {}
  for (const r of rows as Array<{ slot: string; rpe: number }>) {
    (bySlot[r.slot] ??= []).push(r.rpe)
  }

  // Targets come from last week's deterministic plan (no maxes needed).
  const prevPlan = program.buildDay(prevWeek, dayNumber, {})
  const targets: Record<string, number> = {}
  for (const item of prevPlan.items) {
    if (item.kind === 'lift' && item.targetRpe != null && item.percent != null) {
      targets[item.slot] = item.targetRpe
    }
  }

  const adjustments: Record<string, number> = {}
  for (const [slot, rpes] of Object.entries(bySlot)) {
    const target = targets[slot]
    if (target == null) continue
    const avg = rpes.reduce((a, b) => a + b, 0) / rpes.length
    const d = deltaFor(avg - target)
    if (d !== 0) adjustments[slot] = d
  }
  return adjustments
}
