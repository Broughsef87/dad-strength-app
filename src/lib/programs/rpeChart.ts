// ── Target RPE from the load and the reps (FOR-344) ──────────────────────────
// Andrew, 2026-11-10: "5 reps @60% isn't gonna be an rpe 7." Platform Dad gave
// every percent lift the meso's flat target (7, 8, 9), whatever the load and
// the reps. Autoreg measures his reported RPE against that target, so an
// honest RPE 5 on light work read as "too easy" and pushed the next week up.
//
// The target is now read off a standard %1RM-by-reps chart: how many reps the
// load allows, minus the reps prescribed, is the reps in reserve, and
// RPE = 10 - reps in reserve. Pure arithmetic, no AI.

/** %1RM that allows exactly this many reps (RPE 10). Index = reps. */
const PCT_AT_MAX_REPS = [100, 100, 95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68.0]
/** Past twelve reps the chart thins out; each extra rep is about this much lighter. */
const PCT_PER_REP_PAST_CHART = 2.7

/** The lowest target the app asks for: "5+ reps left". Below it RPE is noise. */
export const RPE_FLOOR = 5

/** How many reps a load at `pct` percent of the max allows. Fractional. */
export function maxRepsAt(pct: number): number {
  if (pct >= 100) return 1
  for (let r = 2; r < PCT_AT_MAX_REPS.length; r++) {
    const hi = PCT_AT_MAX_REPS[r - 1], lo = PCT_AT_MAX_REPS[r]
    if (pct >= lo) return r - 1 + (hi - pct) / (hi - lo)
  }
  const last = PCT_AT_MAX_REPS.length - 1
  return last + (PCT_AT_MAX_REPS[last] - pct) / PCT_PER_REP_PAST_CHART
}

/** Target RPE for `reps` at `pct` percent of the max, rounded to a whole number. */
export function targetRpeFor(pct: number, reps: number): number {
  const rir = Math.max(0, maxRepsAt(pct) - reps)
  return Math.max(RPE_FLOOR, Math.min(10, Math.round(10 - rir)))
}
