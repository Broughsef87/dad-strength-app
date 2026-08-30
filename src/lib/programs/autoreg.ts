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
  // When the CURRENT run of this program began. Passed in rather than looked
  // up here: this is an engine function, and giving it its own database
  // round-trip made it untestable against a fake db — which is exactly how
  // three suites started failing the moment it did.
  runStart: string,
  maxes: Record<string, number> = {},
): Promise<Record<string, number>> {
  const weekInMacro = ((weekNumber - 1) % program.macroWeeks) + 1
  // Week 1 has no in-macro history; deload + test weeks run as written.
  if (weekInMacro <= 1 || weekInMacro >= program.macroWeeks - 1) return {}

  const prevWeek = weekNumber - 1

  // Last week's workout row for the same day. workout_data carries the
  // adjustments that shaped what the athlete was actually SHOWN — without them
  // the weight-follow compares his loads against the raw table and re-counts
  // its own advice as if he'd freelanced heavier (see prevPlan below).
  const { data: workouts } = await supabase
    .from('generated_workouts')
    .select('id, workout_data')
    .eq('user_id', userId).eq('program_slug', program.slug)
    .eq('week_number', prevWeek).eq('day_number', dayNumber)
    // Same RUN, not merely the same program. Without this the engine reads a
    // previous attempt's week and tunes today against loads lifted months ago,
    // off different maxes.
    .gte('created_at', runStart)
    .order('created_at', { ascending: true }).limit(1)
  const workoutId: string | undefined = workouts?.[0]?.id
  if (!workoutId) return {}
  const prevAdj = ((workouts?.[0]?.workout_data as { adjustments?: unknown } | null)?.adjustments
    ?? {}) as Record<string, number>

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

  // Last week's prescription per slot — rebuilt WITH last week's adjustments,
  // so `percent` is the number the athlete actually saw on the card. Building
  // it bare (the old behaviour) made the weight-follow ratchet: the app says
  // 60%, he loads 60%, and the engine reads that against the table's 57% as
  // "+3% heavier than planned" and adds another +3 — every week, until the
  // MAX_ADJ clamp stopped it 8 points above the wave. A speed squat designed
  // for 55-70% drifted to 74% on nothing but obedience.
  const prevPlan = program.buildDay(prevWeek, dayNumber, maxes, prevAdj)
  const prescribed: Record<string, { percent: number; targetRpe?: number; maxKey?: string; name: string; velocity?: boolean }> = {}
  for (const item of prevPlan.items) {
    if (item.kind === 'lift' && item.percent != null) {
      prescribed[item.slot] = {
        percent: item.percent, targetRpe: item.targetRpe, maxKey: item.maxKey,
        name: item.name, velocity: item.velocity,
      }
    }
  }

  // Mesos rotate exercises through STABLE slot ids, so at a meso boundary a
  // slot can mean a different lift than it did last week — Clean Pull becomes
  // Snatch Pull (and re-keys to the snatch max), Bench becomes 1¼ Bench, Front
  // Squat becomes Pause Front Squat. Feedback about the old movement doesn't
  // describe the new one: carrying it forward would open the new exercise up
  // to 8 points heavy or light. When the lift or its reference max changes,
  // drop the adjustment and let the new table's number stand.
  const current: Record<string, { name: string; maxKey?: string }> = {}
  for (const item of program.buildDay(weekNumber, dayNumber, {}).items) {
    if (item.kind === 'lift') current[item.slot] = { name: item.name, maxKey: item.maxKey }
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
    // Rotated slot — last week was a different lift. Start this one clean.
    const now = current[slot]
    if (!now || now.name !== p.name || now.maxKey !== p.maxKey) continue

    let weightDelta = 0
    const max = p.maxKey ? maxes[p.maxKey] : undefined
    if (s.weights.length && max && max > 0) {
      const actualPct = (s.weights.reduce((a, b) => a + b, 0) / s.weights.length / max) * 100
      const d = actualPct - p.percent
      if (Math.abs(d) >= WEIGHT_DEADBAND_PCT) weightDelta = d
      // On a speed slot, going heavier than prescribed isn't a data point to
      // build on — it's the failure mode of the slot. Following it up would
      // reward the exact mistake it should flag. Only back off, never chase.
      if (p.velocity && weightDelta > 0) weightDelta = 0
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
