// ── The time-constrained mode ────────────────────────────────────────────────
// A dad with twenty-five minutes still trains the program he is on. This
// takes any program's DayPlan and returns the day he can actually finish:
// the primaries, trimmed, and nothing else. It is a MODE on buildDay
// (opts.timeConstrained), never a program — no row, no slug, no selection UI
// (FOR-225 §2, ruled 2026-09-11).
//
// Deterministic, like everything in the prescription path: same plan in,
// same reduced plan out.
import type { DayPlan, Prescription } from './types'

/** Lifts kept on a reduced gym day — the primaries, which every program lists first. */
export const TIME_CONSTRAINED_LIFTS = 2
/** Sets per kept lift, at most. */
export const TIME_CONSTRAINED_MAX_SETS = 3

/**
 * The reduced day.
 *
 * Gym days: keep the first two lifts — every program in the registry lists
 * its primaries first — plus any jump primer that precedes them (it is short
 * and it is the warm-up), cap each kept lift at three sets, and drop the
 * rest: accessories, supersets, metcons. Test, rest and outside days come
 * back untouched: a test is the test, a rest is a rest, and an outside
 * session is already one thing.
 */
export function reduceForTime(plan: DayPlan): DayPlan {
  if (plan.dayType !== 'gym') return plan
  const kept: Prescription[] = []
  let lifts = 0
  for (const item of plan.items) {
    if (item.kind === 'lift') {
      if (lifts >= TIME_CONSTRAINED_LIFTS) break
      lifts++
      // A kept lift's superset partner is gone, so the link must go too — a
      // dangling superset id would render as a pair with nothing beside it.
      const { superset: _superset, ...rest } = item
      kept.push({ ...rest, sets: Math.min(item.sets, TIME_CONSTRAINED_MAX_SETS) })
    } else if (item.kind === 'plyo' && lifts === 0) {
      kept.push({ ...item, sets: Math.min(item.sets, TIME_CONSTRAINED_MAX_SETS) })
    } else if (lifts >= TIME_CONSTRAINED_LIFTS) {
      break
    }
    // anything else before the second lift (a metcon, an outside part) is dropped
  }
  return {
    ...plan,
    dayName: `${plan.dayName} · short`,
    sessionIntent: `Time-constrained: the primaries only. ${plan.sessionIntent}`,
    items: kept,
  }
}
