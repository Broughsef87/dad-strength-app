// ── The prep sequence and the jump ramp (FOR-244) ───────────────────────────
// Andrew has a lower-abdominal strain he attributes to broad jumps in Power
// Dad. Power Dad opened Monday with 4×3 maximal broad jumps as the FIRST thing
// in the session, in a cold garage, in every meso from week one. Two separate
// faults, one injury:
//
//   1. NO WARM-UP on Mon/Wed/Fri/Sat. Only the Tuesday sprint day had one.
//      "First in the session" and "warmed up" were treated as the same thing,
//      and they are opposites. Jumps first is CORRECT — max-intent power should
//      never be fatigued — jumps first while cold is the bug. So the fix is a
//      prep sequence before them, not moving them later.
//   2. NO RAMP. A dad on day one did maximal horizontal jumps with no prior
//      exposure, because Monday's slot ignored meso entirely.
//
// THE PREP IS A SLOT, NOT A NOTE (Andrew's ruling). Grey text under a title
// gets skipped, and a skipped warm-up is no warm-up. It occupies the day the
// way the first exercise does, and the ballistic check asserts every ballistic
// or sprint day renders one.
//
// ITS CONTENT INVENTS NOTHING. These are exactly the drills SPRINT_WARMUP
// already prescribed on the sprint day — the one day that had a warm-up, and a
// good one. What changes is that they now run on every ballistic day and carry
// rep counts, so the load they add can be COUNTED. Andrew's standing rule holds:
// no jogging in any warm-up, drills only.
import type { PrepPrescription, RampStage } from './types'

/** Where the prep's minutes are shown. Free of the six-block budget (Andrew's ruling row 8). */
export const PREP_MINUTES = 6

/**
 * The sequence, in order. Hops last: the ankles are warm by then, and they are
 * the one part of this that is itself a jump.
 *
 * Only the pogo hops count as landings. A skip, a high knee and a butt kick are
 * locomotor drills, not jumps — NSCA's own warm-up table 18.5 lists marching,
 * jogging, skipping, footwork and lunging as warm-up rather than as plyometric
 * drills. The ankle hop is a Low PLYOMETRIC drill (p. 484), so it is counted.
 * That is the definition of the unit, not a carve-out inside it: "every landing,
 * prep included" means every landing from a JUMP, and a running step is not one.
 */
export const PREP_SEQUENCE: ReadonlyArray<{ name: string; sets: number; reps: number; note: string }> = [
  { name: 'Leg Swings', sets: 2, reps: 10, note: 'Front-to-back then side-to-side, each leg — open the hip and the adductor before anything asks them to snap' },
  { name: 'A-Skips', sets: 2, reps: 12, note: 'Tall, quick ground contact, knee up and down — not forward' },
  { name: 'B-Skips', sets: 2, reps: 12, note: 'A-skip plus the paw-back — this is the one that wakes the hamstring' },
  { name: 'High Knees', sets: 2, reps: 20, note: 'Short, fast steps, ribs down' },
  { name: 'Butt Kicks', sets: 2, reps: 20, note: 'Heel to glute, cycling — do not lean back' },
  { name: 'Pogo Hops', sets: 2, reps: 10, note: 'Ankles only, stiff and springy, knees quiet — the last thing before you jump for real' },
]

/**
 * The prep as prescribed lines. One item per drill so each carries its own rep
 * count and the ballistic check can add them up; all sharing one superset id so
 * the day renders them as a single block rather than six loose rows.
 */
export function prepSlots(): PrepPrescription[] {
  return PREP_SEQUENCE.map((d, i) => ({
    kind: 'prep',
    slot: `prep_${i + 1}`,
    name: d.name,
    sets: d.sets,
    reps: d.reps,
    superset: 'prep',
    note: d.note,
    ...(i === 0 ? { minutes: PREP_MINUTES } : {}),
  }))
}

// ── The ramp ────────────────────────────────────────────────────────────────
// Keyed on WEEKS OF EXPOSURE, not on meso — because Monday's broad jumps
// ignored meso entirely, and that is the bug. A returning athlete taps "restart
// jump ramp" and their exposure starts again from that week; there is no
// backfill (Andrew's ruling).
//
// The exit is GRADED, not a cliff (ruling row 4): max vertical at weeks 5–6,
// low-box depth drops at 7–8, full at 9. Weeks 1–4 are the entry Andrew did not
// have — low amplitude, then submaximal, before anything maximal or horizontal.

/** The first week at which each stage begins, by weeks of exposure (1-based). */
export const RAMP_STAGES: ReadonlyArray<{ from: number; stage: RampStage }> = [
  { from: 1, stage: 'low' },
  { from: 3, stage: 'submax' },
  { from: 5, stage: 'max_vertical' },
  { from: 7, stage: 'low_depth' },
  { from: 9, stage: 'full' },
]

/** Weeks of exposure this absolute week represents. `from` is the week the ramp last (re)started. */
export const exposureWeek = (weekNumber: number, from = 1): number => Math.max(1, weekNumber - Math.max(1, from) + 1)

export function rampStage(weekNumber: number, from = 1): RampStage {
  const wk = exposureWeek(weekNumber, from)
  let stage: RampStage = 'low'
  for (const s of RAMP_STAGES) if (wk >= s.from) stage = s.stage
  return stage
}

/**
 * The ENTRY phase of the ramp — weeks 1-4, before any maximal expression.
 *
 * Contrast (complex) training is for athletes who have ALREADY done
 * high-intensity plyometric work (Essentials 4th ed. p. 480). A dad in his first
 * month has by definition not, so pairing his front squat with trap bar jumps is
 * the one thing NSCA says not to do with him — and Power Dad did it from week
 * one. During these weeks the jumps run on their own instead (FOR-244 ruling 7).
 */
export const lowRamp = (weekNumber: number, from = 1): boolean => {
  const stage = rampStage(weekNumber, from)
  return stage === 'low' || stage === 'submax'
}

/** Is the athlete still inside the ramp — anything short of full exposure? */
export const ramping = (weekNumber: number, from = 1): boolean => rampStage(weekNumber, from) !== 'full'

/**
 * Is a MAXIMAL HORIZONTAL OR DEPTH jump allowed yet? This is AC2 stated as a
 * predicate, so the ramp cannot be satisfied by a note that says "go easy".
 */
export const maximalJumpsAllowed = (weekNumber: number, from = 1): boolean => rampStage(weekNumber, from) === 'full'
