// ── `sets` and `setPlan` are ONE fact (FOR-263, Codex r1) ────────────────────
//
// A wave carries a load and a rep count per set, so a lift can hold a `setPlan`
// alongside its scalar `sets`. Two numbers describing one thing drift, and they
// drifted the moment the feature landed: three call sites changed `sets` without
// touching the plan.
//
//   reduceForTime        3 sets, 6 planned entries  — time-constrained mode
//   applyOverrides       7 sets, 6 planned entries  — "Add set"
//   applyDeload          3 sets at 60%, rows prefilled 275/290/310 lb
//
// The last one is the reason this lives in its own module rather than in each
// caller: a forced deload inside meso 2 put a heavy wave's loads under a
// deload's header, so the card said 220 lb and the rows said 310.
//
// THE CONTRACT, in one place:
//   setPlan is never LONGER than sets.
//   It may be shorter — a set the athlete added by hand has no prescription,
//   and inventing one for it would be a number nobody chose.
//
// `scripts/checks/meso2-monday.mjs` asserts the contract over every program,
// every mode and every week, so a fourth call site fails rather than drifts.
import type { LiftPrescription, PlyoPrescription } from './types'

/** Set the set count and carry the per-set plan with it. */
export function withSetCount<T extends LiftPrescription | PlyoPrescription>(item: T, n: number): T {
  const sets = Math.max(1, n)
  if (item.kind !== 'lift' || !item.setPlan) return { ...item, sets }
  return { ...item, sets, setPlan: item.setPlan.slice(0, sets) }
}

/**
 * Drop the per-set plan. For a prescription that is no longer a wave — a
 * deload is straight sets at one percentage, which is exactly the scalar shape.
 */
export function withoutSetPlan(item: LiftPrescription): LiftPrescription {
  if (!item.setPlan) return item
  const { setPlan: _dropped, ...rest } = item
  return rest
}
