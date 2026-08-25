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
    // Bodyweight sets log weight_lbs as NULL, not 0 — the column is nullable and
    // the logger writes nothing when the field is blank. The old guard dropped
    // those rows entirely, so pull-ups and dips never entered progression at all
    // and reported "first time through" forever. A set with real reps and no
    // weight is a bodyweight set; that is load 0, not missing data.
    const load = num(r.weight_lbs) ?? 0
    const reps = int(r.reps)
    if (week == null) continue
    if (opts.sinceWeek != null && week < opts.sinceWeek) continue
    if (load < 0 || reps == null || reps <= 0) continue
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

    // The working load is the one carrying the MOST sets, not the heaviest.
    //
    // Taking the max was wrong in a way only real data showed: logged 65x12,
    // 55x12, 55x12, it read 65 as the working weight and re-prescribed three
    // sets of it. But dropping to 55 for the rest IS the athlete saying 65 was
    // too heavy to repeat. Warm-up ramps and drop sets both still resolve
    // correctly, because in every one of those the working weight is simply the
    // one done most: 50/55/55 -> 55, 143/165/165 -> 165, 17.5/20/20/20 -> 20.
    //
    // Ties break to the HEAVIEST — Andrew's call, and the live data backs it.
    // Session 1 logged incline 50x12 then 55x12, with a third set at 55 left
    // incomplete. Dropping the incomplete set leaves one rep at each weight, a
    // genuine tie. Breaking it downward reads an abandoned third set as failure
    // at 55, when he had in fact completed 55 for a full set and was mid-ramp.
    // A tie means the top weight was reached but not yet repeated, which is the
    // definition of the working weight you are trying to accumulate sets at.
    const byLoad = new Map<number, number>()
    for (const x of s.sets) byLoad.set(x.load, (byLoad.get(x.load) ?? 0) + 1)
    let lastLoad = s.sets[0].load
    let bestCount = -1
    for (const [load, count] of byLoad) {
      if (count > bestCount || (count === bestCount && load > lastLoad)) {
        lastLoad = load
        bestCount = count
      }
    }
    const working = s.sets.filter(x => x.load === lastLoad)
    const reps = working.map(x => x.reps)
    const minReps = Math.min(...reps)

    // Bodyweight work (pull-ups, dips) has no load to move, so the load-based
    // branches below are meaningless for it — backing off 5 lb from 0 is not a
    // thing you can do. Reps are the only lever until the top of the range is
    // held, and only then does added weight enter the picture.
    if (lastLoad === 0) {
      out[slot] = {
        slot, lastLoad, lastReps: reps, lastWeek: s.week,
        suggested: minReps >= hi ? step : 0,
        action: minReps >= hi ? 'add-load' : 'hold',
        reason: minReps >= hi
          ? `Bodyweight is done — every set held ${hi}. Add ${step} lb and work back to ${hi}.`
          : minReps < lo
            ? `A set fell to ${minReps}, under the ${lo}-rep floor — use a band or the assisted machine so every set clears ${lo}.`
            : `Bodyweight — chase ${hi} on every set before you hang weight on it.`,
      }
      continue
    }

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
