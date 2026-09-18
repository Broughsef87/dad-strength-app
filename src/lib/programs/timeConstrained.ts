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
 * and it is the warm-up), keep the whole prep sequence, cap each kept lift at
 * three sets, and drop the
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
    } else if (item.kind === 'prep') {
      // The warm-up is never the thing you cut. A dad with twenty-five minutes
      // is exactly the dad who jumps cold, and the reduced day keeps the jump
      // primer below — so dropping the prep would leave the cold jump and take
      // away the thing that makes it safe (FOR-244).
      kept.push(item)
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
  const keptNames = new Set(kept.map((i) => ('name' in i ? i.name : i.title).toLowerCase()))
  const dropped = plan.items.filter((i) => !keptSlots.has(i.slot))
  // A name that is also kept is not "dropped work": a snatch day keeps one
  // Snatch line and drops a second, and a note that says "snatch" is fine.
  const droppedNames = dropped.map((i) => ('name' in i ? i.name : i.title).toLowerCase()).filter((n) => !keptNames.has(n))
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
  // The intent is REWRITTEN from what was kept, never the full session's
  // intent with a prefix: the training page renders it verbatim, and "then
  // heavy deadlift, dips, core, jumps, and the week's metcon" on a day that
  // keeps two lifts is an instruction to do removed work (Codex, round 2).
  const named = items.map((i) => ('name' in i ? i.name : i.title))
  const sessionIntent = `Time-constrained: ${named.join(', then ')} — the primaries only, ${TIME_CONSTRAINED_MAX_SETS} working sets each at most. Everything else waits for a fuller day.`
  return {
    ...plan,
    dayName: `${plan.dayName} · short`,
    sessionIntent,
    items,
  }
}
