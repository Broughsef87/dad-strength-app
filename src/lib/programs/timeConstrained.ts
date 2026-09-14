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
      kept.push({ ...item, sets: Math.min(item.sets, TIME_CONSTRAINED_MAX_SETS) })
    } else if (item.kind === 'plyo' && lifts === 0) {
      kept.push({ ...item, sets: Math.min(item.sets, TIME_CONSTRAINED_MAX_SETS) })
    } else if (lifts >= TIME_CONSTRAINED_LIFTS) {
      break
    }
    // anything else before the second lift (a metcon, an outside part) is dropped
  }
  // What was dropped must leave no trace on what was kept. A kept item's
  // superset partner is gone, so the link goes (a dangling id renders as a
  // pair with nothing beside it) — and so does its NOTE, because a paired
  // item's note is the pairing: "Contrast: trap bar jumps ~30s after each set"
  // on a front squat whose trap bar jumps were just removed would send the
  // athlete to do omitted work (Codex, round 1). Likewise any kept item whose
  // note names a dropped item.
  const keptSlots = new Set(kept.map((i) => i.slot))
  const dropped = plan.items.filter((i) => !keptSlots.has(i.slot))
  const droppedNames = dropped.map((i) => ('name' in i ? i.name : i.title).toLowerCase())
  const items = kept.map((item) => {
    if (item.kind !== 'lift' && item.kind !== 'plyo') return item
    const partnerKept = item.superset != null && kept.some((k) => k !== item && 'superset' in k && k.superset === item.superset)
    const orphanedPair = item.superset != null && !partnerKept
    const namesDropped = item.note != null && droppedNames.some((n) => n.length > 2 && item.note!.toLowerCase().includes(n))
    if (!orphanedPair && !namesDropped) return item
    // An orphaned pair loses its link and its note. A note that merely names
    // dropped work loses the note; the link, if any, still has its partner.
    const rest = { ...item }
    delete rest.superset
    delete rest.note
    return orphanedPair ? rest : { ...rest, ...(item.superset != null ? { superset: item.superset } : {}) }
  })
  return {
    ...plan,
    dayName: `${plan.dayName} · short`,
    sessionIntent: `Time-constrained: the primaries only. ${plan.sessionIntent}`,
    items,
  }
}
