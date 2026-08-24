// ── Double progression ────────────────────────────────────────────────────────
// The percent engine progresses the big lifts: a wave off a tested 1RM, with
// autoreg re-anchoring to what actually got loaded. That works because a squat
// HAS a 1RM.
//
// A lateral raise does not. Nobody tests a single on a cable fly, and a
// percentage of a curl max is a number about nothing. Hypertrophy work
// progresses the other way — DOUBLE progression:
//
//   prescribe a REP RANGE, not a rep count. Hold the load until every working
//   set clears the top of the range at the target effort, then add the
//   smallest useful jump and start again at the bottom.
//
// That is the whole mechanism, and it is why this file exists: without it the
// engine can prescribe accessory work but can never advance it, so a
// hypertrophy program would print "3 x 10" forever and quietly stop working
// around week three.
//
// Pure functions. Rows in, load suggestions out. No I/O, no Supabase, no React.

export interface ProgressionSetRow {
  slot?: string | null
  block_name: string
  weight_lbs?: number | string | null
  reps?: number | string | null
  completed?: boolean | null
  week_number?: number | string | null
  day_number?: number | string | null
  log_type?: string | null
}

export type ProgressionAction = 'add-load' | 'hold' | 'back-off' | 'no-history'

export interface SlotProgress {
  slot: string
  /** Load carried in the most recent session that has usable sets. */
  lastLoad: number | null
  lastReps: number[]
  lastWeek: number | null
  /** What to put on the bar next time. null when there is no history yet. */
  suggested: number | null
  action: ProgressionAction
  /** Plain-language why — this is shown to the athlete, so no jargon. */
  reason: string
}

export interface DoubleProgressionOpts {
  /** slot → [minReps, maxReps]. A slot with no range is not progressed. */
  ranges: Record<string, [number, number]>
  /** slot → lb jump once the top of the range is cleared on every set. */
  steps?: Record<string, number>
  /** Fallback jump. 5 lb suits most upper-body and machine work. */
  defaultStep?: number
  /** Ignore sessions before this week (e.g. the current macro only). */
  sinceWeek?: number
}

const num = (v: unknown): number | null => {
  if (v == null) return null
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : null
}
const int = (v: unknown): number | null => {
  const n = num(v)
  return n == null ? null : Math.round(n)
}

/**
 * Next load per slot, from what was actually logged.
 *
 * Reads ONLY the most recent session that produced usable sets for a slot —
 * double progression is a comparison against last time, not a trend. Averaging
 * across weeks would let a good session three weeks ago keep pushing load up
 * after two bad ones.
 */
export function doubleProgression(
  rows: ProgressionSetRow[],
  opts: DoubleProgressionOpts,
): Record<string, SlotProgress> {
  const defaultStep = opts.defaultStep ?? 5
  const out: Record<string, SlotProgress> = {}

  // slot → most recent (week, day) with usable sets, and that session's sets
  const latest: Record<string, { week: number; day: number; sets: { load: number; reps: number }[] }> = {}

  for (const r of rows) {
    if (r.log_type != null && r.log_type !== 'strength_set') continue
    if (r.completed === false) continue
    const slot = (r.slot ?? '').trim() || r.block_name
    if (!slot || !opts.ranges[slot]) continue

    const week = int(r.week_number)
    const day = int(r.day_number) ?? 0
    const load = num(r.weight_lbs)
    const reps = int(r.reps)
    if (week == null) continue
    if (opts.sinceWeek != null && week < opts.sinceWeek) continue
    // A bodyweight accessory logs load 0 legitimately, so 0 is allowed —
    // but reps must be real or the set says nothing.
    if (load == null || load < 0 || reps == null || reps <= 0) continue
    if (!Number.isFinite(load) || load > 5000 || reps > 100) continue

    const cur = latest[slot]
    if (!cur || week > cur.week || (week === cur.week && day > cur.day)) {
      latest[slot] = { week, day, sets: [{ load, reps }] }
    } else if (week === cur.week && day === cur.day) {
      cur.sets.push({ load, reps })
    }
  }

  for (const [slot, [lo, hi]] of Object.entries(opts.ranges)) {
    const step = opts.steps?.[slot] ?? defaultStep
    const s = latest[slot]

    if (!s || !s.sets.length) {
      out[slot] = {
        slot, lastLoad: null, lastReps: [], lastWeek: null, suggested: null,
        action: 'no-history',
        reason: 'First time through — pick a weight you could stop ' + (hi - lo >= 4 ? '2-3' : '1-2') + ' reps short of, and log it.',
      }
      continue
    }

    // The working load is the heaviest thing moved that session; warm-ups and
    // a dropped last set shouldn't decide the next prescription.
    const lastLoad = Math.max(...s.sets.map(x => x.load))
    const working = s.sets.filter(x => x.load >= lastLoad)
    const reps = working.map(x => x.reps)
    const minReps = Math.min(...reps)

    let action: ProgressionAction
    let suggested: number
    let reason: string

    if (minReps >= hi) {
      action = 'add-load'
      suggested = lastLoad + step
      reason = `Every set hit ${hi} last time — up ${step} lb and work back to ${hi}.`
    } else if (minReps < lo) {
      action = 'back-off'
      suggested = Math.max(0, lastLoad - step)
      reason = `A set dropped to ${minReps}, under the ${lo}-rep floor — back down ${step} lb and rebuild.`
    } else {
      action = 'hold'
      suggested = lastLoad
      reason = `Same weight — chase ${hi} on every set before it goes up.`
    }

    out[slot] = { slot, lastLoad, lastReps: reps, lastWeek: s.week, suggested, action, reason }
  }

  return out
}

/** Just the loads, for handing to buildDay via BuildDayOpts.loadTargets. */
export function loadTargets(
  progress: Record<string, SlotProgress>,
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [slot, p] of Object.entries(progress)) {
    if (p.suggested != null) out[slot] = p.suggested
  }
  return out
}
