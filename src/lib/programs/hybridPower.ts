import { targetRpeFor } from './rpeChart'
import { MAX_ADJ } from './autoreg'
import {
  BuildDayOpts,
  DayPlan,
  LiftPrescription,
  OutsideSession,
  ProgramConfig,
  Prescription,
  resolveWeight,
} from './types'
import { exposureWeek } from './prep'
import { withoutSetPlan } from './setPlan'

// ═══════════════════════════════════════════════════════════════════════════════
// POWER DAD — knees first, athlete first (FOR-358, Andrew 2026-11-23)
//
// The old Power Dad was a strong lifter's program: three squat days, four to
// five jump exposures a week, sprints on Tuesday, a heavy deadlift on Saturday.
// It tore his knees up. The goal now is a faster, leaner, more powerful athlete
// (rugby or hockey next year, 235 lb cutting to 205-210), so the week trades
// grinding for positions, speed and variety:
//
//   · 5 days: Mon / Wed / Fri / Sat gym, Thu sprint-return + engine.
//     Tue and Sun off. "6 is just too much to reliably get done."
//   · One back squat day and one front squat day, both MODERATE: 66-76%, and
//     the 76% ceiling holds after autoreg (pctCeiling), so no run of easy weeks
//     can walk a squat back into the range that hurt him.
//   · Snatch is plain snatch: power it if it goes, catch it low if it doesn't
//     (Andrew: "I don't really care if it's a power or not"). Cleans are hang
//     power and power cleans. Both key off the FULL-lift maxes and keep the
//     classic floors. No separate pulls, no separate jerks.
//   · Bench twice (heavy Mon, close-grip Sat). Overhead stays a priority:
//     push press Wed, strict press Sat.
//   · No box, depth, broad or trap-bar jumps on the gym days, no speed box
//     squats, no split squats or lunges. Jumping and sprinting come back on
//     THURSDAY, on a four-level ladder that runs over about nine months of
//     exposure and carries across macros (see thursdaySession).
//   · EVERY LIFT VARIES WEEK TO WEEK. Each slot's four names are a rotation
//     (pause, tempo, 1¼, deficit, hang positions, DB variants). Week 4 of a
//     block returns to the base lift; block 3 runs the base lifts into the
//     test. A variation's weight discount is its `offsets` entry, so the
//     percent on the card is honest for the movement on the card.
//   · Variations share a FAMILY (the slot id), so autoreg follows the lift
//     across its weekly variations instead of resetting every week.
//
// 13-week macro: Build W1-4 · Strength W5-8 · Peak W9-11 · deload W12 · test
// W13 (power clean, bench, strict press; squats to a 3RM, optional). Every gym
// day caps at 6 blocks. All loads are computed here — deterministic, never AI.
// ═══════════════════════════════════════════════════════════════════════════════

interface MacroPos {
  weekInMacro: number // 1-13
  meso: number        // 1-3 (week 13 reports meso 3)
  weekInMeso: number  // 1-4
  isDeload: boolean   // week 12
  isTest: boolean     // week 13
}

function macroPos(weekNumber: number): MacroPos {
  const weekInMacro = ((weekNumber - 1) % 13) + 1
  const isTest = weekInMacro === 13
  const meso = isTest ? 3 : Math.ceil(weekInMacro / 4)
  const weekInMeso = isTest ? 4 : ((weekInMacro - 1) % 4) + 1
  return { weekInMacro, meso, weekInMeso, isDeload: weekInMacro === 12, isTest }
}

type Four<T> = [T, T, T, T]

// A slot definition: per-week variation names (indexed by weekInMeso), the
// variation's discount, and a percent ramp:
//   pct(week) = pctStart + pctStep * (weekInMeso - 1) + offsets[week] + autoreg
interface SlotMeso {
  names: Four<string>
  sets: number
  reps: number
  pctStart: number
  pctStep: number
  /**
   * The variation's discount, per week, in percent of the max. A pause squat
   * is not a back squat: the same 72% that is honest on week 1 grinds on a
   * 2-second pause. Zero (or absent) is the base lift.
   */
  offsets?: Four<number>
  /** One entry per set when the sets differ (a climb). `sets` must equal its length. */
  sequence?: Array<{ reps: number; pctStart: number; pctStep: number }>
  /** Lights lifts only. Strength slots read their target off the chart (`chart` below). */
  targetRpe?: number
  note?: string
}

/**
 * Strength work reads its target RPE off the %-by-reps chart (rpeChart.ts,
 * FOR-344), exactly as Platform Dad does: `share` is the lift's own max as a
 * share of the max its percent is written against (1 when it IS that max),
 * `repScale` the calibration for a lift that runs out of reps sooner (the
 * press, FOR-351). The classic lifts are rated by lights and keep the meso
 * number.
 */
interface ChartRpe { share: number; repScale?: number }

/**
 * THE MODERATE CEILING (Andrew's knees). Applied after autoreg, so feedback can
 * lower a squat but never lift it past this.
 */
const SQUAT_CEILING = 76

const CHART: ChartRpe = { share: 1 }
// FOR-351: the strict press runs out of reps sooner than the chart (Platform Dad's calibration).
const PRESS_CHART: ChartRpe = { share: 1, repScale: 0.85 }
// A push press max runs about 90% of the clean & jerk (Platform Dad, FOR-344).
const PUSH_PRESS_CHART: ChartRpe = { share: 0.9 }

const MESO_TARGET_RPE: Record<number, number> = { 1: 7, 2: 8, 3: 8 }

// Classic-lift percent floors. A light single or double of a snatch or clean
// trains nothing, so:
//   • the full lift ("Snatch", "Clean", anything from blocks): singles 85%, doubles 80%
//   • any other variation at ≤2 reps: 75%
//   • power / hang triples: 65%
// A backstop: the tables are authored above it, and it stops autoreg ever
// dropping a classic set below its floor.
function classicFloor(name: string, reps: number): number {
  const n = name.trim().toLowerCase()
  const isFullLift = n === 'snatch' || n === 'clean' || n === 'clean & jerk' || /block/.test(n)
  // Andrew's rule (FOR-335): no single on a full classic lift below 85%.
  // Power singles off the full max (Friday's Power Clean) are exempt, as on
  // Platform Dad: 85% of the clean is over a power clean max.
  if (isFullLift && reps === 1) return 85
  if (isFullLift && reps <= 2) return 80
  if (reps <= 2) return 75
  if (/power|hang/.test(n)) return 65
  return 70
}

const OLY_MAX_KEYS = new Set(['snatch', 'clean_jerk'])

function isClassicLiftSlot(slot: string, maxKey: string): boolean {
  if (!OLY_MAX_KEYS.has(maxKey)) return false
  return !slot.includes('pull') && !slot.includes('press')
}

function liftFromSlot(
  slot: string,
  def: SlotMeso,
  weekInMeso: number,
  maxKey: string,
  maxes: Record<string, number>,
  meso: number,
  adjustments: Record<string, number>,
  opts: { ceiling?: number; chart?: ChartRpe; overrides?: Partial<LiftPrescription> } = {},
): LiftPrescription {
  if (def.sequence && def.sequence.length !== def.sets) {
    throw new Error(`${slot}: sets is ${def.sets} and the sequence holds ${def.sequence.length} — a sequence's set count is its own length`)
  }
  const rawAdj = adjustments[slot] ?? 0
  const adj = Math.max(-MAX_ADJ, Math.min(MAX_ADJ, rawAdj))
  const name = def.names[weekInMeso - 1]
  const offset = def.offsets?.[weekInMeso - 1] ?? 0
  const atWeek = (pctStart: number, pctStep: number, reps: number, a = adj) => {
    let pct = Math.round((pctStart + pctStep * (weekInMeso - 1) + offset + a) * 2) / 2
    if (pct > 0 && isClassicLiftSlot(slot, maxKey)) {
      const floor = classicFloor(name, reps)
      if (pct < floor) pct = floor
    }
    if (opts.ceiling != null && pct > opts.ceiling) pct = opts.ceiling
    return pct
  }
  const percent = atWeek(def.pctStart, def.pctStep, def.reps)
  const setPlan = def.sequence?.map((step) => {
    const stepPct = atWeek(step.pctStart, step.pctStep, step.reps)
    return { reps: step.reps, percent: stepPct, targetWeightLbs: resolveWeight(stepPct, maxKey, maxes) }
  })
  const headReps = setPlan ? setPlan[0].reps : def.reps
  const headPct = setPlan ? setPlan[0].percent : percent
  // The badge says what autoreg actually moved the card by. With a ceiling or a
  // floor in the way that is less than the stored number, and the badge must
  // not claim a change the card does not show.
  const shownAdj = adj !== 0 ? headPct - atWeek(def.sequence?.[0].pctStart ?? def.pctStart, def.sequence?.[0].pctStep ?? def.pctStep, headReps, 0) : 0
  return {
    kind: 'lift',
    slot,
    // Same lift across the block's weekly variations; a new block is a new
    // lift (different reps, different table), so the carry resets there as it
    // always has.
    family: `${slot}:m${meso}`,
    name,
    sets: def.sets,
    reps: headReps,
    percent: headPct,
    maxKey,
    targetWeightLbs: resolveWeight(headPct, maxKey, maxes),
    setPlan,
    targetRpe: opts.chart
      ? targetRpeFor(headPct / opts.chart.share, headReps, opts.chart.repScale)
      : def.targetRpe ?? MESO_TARGET_RPE[meso] ?? 8,
    appliedAdjustmentPct: shownAdj !== 0 ? shownAdj : undefined,
    note: def.note,
    ...opts.overrides,
  }
}

/** RPE accessory. Rotating ones take the week's name from a four-name rotation. */
function accessory(slot: string, name: string, sets: number, reps: number, note?: string): LiftPrescription {
  return { kind: 'lift', slot, name, sets, reps, rpe: 7, note }
}

/**
 * Double-progression slot (FOR-175): no 1RM, so the load comes from
 * opts.loadTargets — hold until every set clears the top of the window, then
 * add a step. The name stays fixed, because the progression is the variation.
 */
function rangeSlot(
  slot: string, name: string, sets: number, window: [number, number],
  loadTargets: Record<string, number>, note?: string,
): LiftPrescription {
  const suggested = loadTargets[slot]
  return {
    kind: 'lift', slot, name, sets,
    reps: window[0], repRange: window, targetRir: 2, loadStepLbs: 5,
    targetWeightLbs: suggested != null && suggested > 0 ? suggested : undefined,
    note,
  }
}

function rotating(slot: string, names: Four<string>, weekInMeso: number, sets: number, reps: number, note?: string): LiftPrescription {
  return accessory(slot, names[weekInMeso - 1], sets, reps, note)
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLOT TABLES — [Build W1-4, Strength W5-8, Peak W9-11 (+W12 deload)]
// ═══════════════════════════════════════════════════════════════════════════════

const OLY_NOTE = 'Lights, not RPE: rate every set. Fast and crisp. If it slows down, it is heavy enough.'

// Monday — Snatch. Plain snatch, any catch height. Off the full snatch max.
//   Build 4×2 hang positions → full snatch on week 4 (floor 80)
//   Strength 5×2 · Peak: climb to a heavy single
const SN: SlotMeso[] = [
  { names: ['Hang Snatch, Above Knee', 'Hang Snatch, Below Knee', 'Hang Snatch, High Hang', 'Snatch'], sets: 4, reps: 2, pctStart: 75, pctStep: 1.5, targetRpe: 7, note: `Power it if it goes, ride it down if it doesn't. ${OLY_NOTE}` },
  { names: ['Snatch', 'Hang Snatch, Below Knee', 'Hang Snatch, High Hang', 'Snatch'], sets: 4, reps: 2, pctStart: 78, pctStep: 1.5, targetRpe: 8, note: `Doubles, same weight across. ${OLY_NOTE}` },
  {
    names: ['Snatch', 'Snatch', 'Snatch', 'Snatch'], sets: 3, reps: 1, pctStart: 85, pctStep: 1.5, targetRpe: 8,
    sequence: [
      { reps: 1, pctStart: 85, pctStep: 1.5 },
      { reps: 1, pctStart: 88, pctStep: 1.5 },
      { reps: 1, pctStart: 91, pctStep: 1.5 },
    ],
    note: `Climb to a heavy single. It shouldn't feel light, and it shouldn't be close to a miss. ${OLY_NOTE}`,
  },
]

// Monday — Back squat, MODERATE (ceiling 76).
const BS: SlotMeso[] = [
  { names: ['Back Squat', 'Pause Back Squat (2s)', 'Tempo Back Squat (3s down)', 'Back Squat'], offsets: [0, -5, -10, 0], sets: 4, reps: 5, pctStart: 68, pctStep: 2, note: 'Moderate on purpose: smooth reps, nothing grinds. Knee above 3/10 today: take 10% off.' },
  { names: ['Back Squat', 'Box Squat (box at parallel)', 'Pause Back Squat (2s)', 'Back Squat'], offsets: [0, 0, -5, 0], sets: 4, reps: 4, pctStart: 70, pctStep: 2, note: 'Moderate on purpose: smooth reps, nothing grinds. Box squat: sit, stay tight, stand. Knee above 3/10: take 10% off.' },
  { names: ['Back Squat', 'Back Squat', 'Back Squat', 'Back Squat'], sets: 4, reps: 3, pctStart: 72, pctStep: 2, note: 'Capped at 76%. Crisp triples, nothing grinds.' },
]

// Monday — Bench, heavy.
const BENCH: SlotMeso[] = [
  { names: ['Bench Press', '1¼ Bench Press', 'Pause Bench Press (2s)', 'Bench Press'], offsets: [0, -10, -5, 0], sets: 4, reps: 5, pctStart: 72, pctStep: 2, note: '1¼: down, a quarter up, back down, press. That whole thing is one rep.' },
  { names: ['Bench Press', 'Spoto Press', '1¼ Bench Press', 'Bench Press'], offsets: [0, -5, -10, 0], sets: 4, reps: 4, pctStart: 78, pctStep: 2, note: 'Spoto: stop an inch off the chest, hold, press.' },
  { names: ['Bench Press', 'Bench Press', 'Bench Press', 'Bench Press'], sets: 4, reps: 2, pctStart: 84, pctStep: 2 },
]

// Wednesday — Push press, off the clean (press strength, as it always was).
const PP: SlotMeso[] = [
  { names: ['Push Press', 'Pause Push Press (in the dip)', 'Behind-the-Neck Push Press', 'Push Press'], offsets: [0, -5, -5, 0], sets: 4, reps: 5, pctStart: 65, pctStep: 2 },
  // Week 8 at 81, not 83 (Andrew 2026-11-23): 83% of the C&J is ~92% of a push-press max, an RPE-10 triple.
  { names: ['Push Press', 'Behind-the-Neck Push Press', 'Pause Push Press (in the dip)', 'Push Press'], offsets: [0, -5, -5, -2], sets: 4, reps: 3, pctStart: 77, pctStep: 2 },
  { names: ['Push Press', 'Push Press', 'Push Press', 'Push Press'], sets: 4, reps: 2, pctStart: 78, pctStep: 2 },
]

// Friday — Clean. Hang power and power cleans off the FULL clean max (Andrew's
// ruling: a % of the power max under-loads him).
const CL: SlotMeso[] = [
  { names: ['Hang Power Clean, Above Knee', 'Hang Power Clean, Below Knee', 'Hang Power Clean, High Hang', 'Power Clean'], sets: 4, reps: 3, pctStart: 68, pctStep: 1.5, targetRpe: 7, note: `Catch it above parallel and stand it up. ${OLY_NOTE}` },
  { names: ['Power Clean', 'Hang Power Clean, Below Knee', 'Hang Power Clean, Mid-Thigh', 'Power Clean'], sets: 4, reps: 2, pctStart: 75, pctStep: 1, targetRpe: 8, note: `Doubles, same weight across. ${OLY_NOTE}` },
  {
    names: ['Power Clean', 'Power Clean', 'Power Clean', 'Power Clean'], sets: 3, reps: 1, pctStart: 82, pctStep: 0.5, targetRpe: 8,
    sequence: [
      { reps: 1, pctStart: 82, pctStep: 0.5 },
      { reps: 1, pctStart: 85, pctStep: 0.5 },
      { reps: 1, pctStart: 88, pctStep: 0.5 },
    ],
    note: `Climb to a heavy single. If it rides down, ride it down and stand up. ${OLY_NOTE}`,
  },
]

// Friday — Front squat, MODERATE (ceiling 76). Front squats help his knee.
const FS: SlotMeso[] = [
  { names: ['Front Squat', 'Pause Front Squat (2s)', 'Tempo Front Squat (3s down)', 'Front Squat'], offsets: [0, -5, -10, 0], sets: 4, reps: 4, pctStart: 66, pctStep: 2, note: 'Moderate on purpose: elbows high, smooth reps. Knee above 3/10 today: take 10% off.' },
  { names: ['Front Squat', 'Tempo Front Squat (3s down)', 'Pause Front Squat (2s)', 'Front Squat'], offsets: [0, -10, -5, 0], sets: 4, reps: 3, pctStart: 70, pctStep: 2, note: 'Moderate on purpose: elbows high, smooth reps. Knee above 3/10 today: take 10% off.' },
  { names: ['Front Squat', 'Front Squat', 'Front Squat', 'Front Squat'], sets: 3, reps: 3, pctStart: 72, pctStep: 2, note: 'Capped at 76%. Crisp triples.' },
]

// Saturday — Strict press, the overhead priority.
const OHP: SlotMeso[] = [
  { names: ['Overhead Press', 'Pause Overhead Press (at the chin)', 'Z-Press', 'Overhead Press'], offsets: [0, -5, -10, 0], sets: 4, reps: 6, pctStart: 67, pctStep: 2, note: 'Strict, no leg drive, glutes tight. Z-press: seated on the floor, legs straight.' },
  { names: ['Overhead Press', 'Z-Press', 'Pause Overhead Press (at the chin)', 'Overhead Press'], offsets: [0, -10, -5, 0], sets: 4, reps: 4, pctStart: 75, pctStep: 2, note: 'Strict, no leg drive, glutes tight.' },
  { names: ['Overhead Press', 'Overhead Press', 'Overhead Press', 'Overhead Press'], sets: 4, reps: 2, pctStart: 83, pctStep: 1.5, note: 'Strict, no leg drive, glutes tight.' },
]

// Saturday — Close-grip bench, the second bench day.
const CG: SlotMeso[] = [
  { names: ['Close-Grip Bench Press', 'Close-Grip Floor Press', 'Close-Grip 1¼ Bench Press', 'Close-Grip Bench Press'], offsets: [0, 0, -10, 0], sets: 3, reps: 8, pctStart: 63, pctStep: 2 },
  { names: ['Close-Grip Bench Press', 'Close-Grip Pause Bench (2s)', 'Close-Grip Floor Press', 'Close-Grip Bench Press'], offsets: [0, -5, 0, 0], sets: 3, reps: 6, pctStart: 70, pctStep: 1.5 },
  { names: ['Close-Grip Bench Press', 'Close-Grip Bench Press', 'Close-Grip Bench Press', 'Close-Grip Bench Press'], sets: 3, reps: 5, pctStart: 75, pctStep: 1 },
]

// Saturday — Trap-bar deadlift, moderate. Replaces the heavy conventional and
// deficit deadlifts. Off the deadlift max.
const TB: SlotMeso[] = [
  { names: ['Trap-Bar Deadlift', 'Deficit Trap-Bar Deadlift', 'Trap-Bar Deadlift, Pause Below Knee', 'Trap-Bar Deadlift'], offsets: [0, -5, -5, 0], sets: 4, reps: 5, pctStart: 65, pctStep: 2.5, note: 'Moderate: fast off the floor, nothing grinds. Deficit: stand on a 1-2" plate.' },
  { names: ['Trap-Bar Deadlift', 'Trap-Bar Deadlift, Pause Below Knee', 'Deficit Trap-Bar Deadlift', 'Trap-Bar Deadlift'], offsets: [0, -5, -5, 0], sets: 4, reps: 4, pctStart: 70, pctStep: 2.5, note: 'Moderate: fast off the floor, nothing grinds.' },
  { names: ['Trap-Bar Deadlift', 'Trap-Bar Deadlift', 'Trap-Bar Deadlift', 'Trap-Bar Deadlift'], sets: 3, reps: 3, pctStart: 75, pctStep: 2.5, note: 'Moderate: fast off the floor, nothing grinds.' },
]

// Rotating accessories — one rotation per block (Build, Strength, Peak).
const HINGE: Four<string>[] = [
  ['Romanian Deadlift', 'Deficit Romanian Deadlift', 'Single-Leg DB Romanian Deadlift', 'Romanian Deadlift'],
  ['Snatch-Grip Romanian Deadlift', 'Romanian Deadlift', 'Single-Leg DB Romanian Deadlift', 'Romanian Deadlift'],
  ['Romanian Deadlift', 'Romanian Deadlift', 'Romanian Deadlift', 'Romanian Deadlift'],
]
const HAM: Four<string> = ['Lying Leg Curl', 'Nordic Curl (slow lower)', 'Seated Leg Curl', 'Swiss-Ball Leg Curl']
const LATERAL: Four<string> = ['DB Lateral Raise', 'Cable Lateral Raise', 'Lean-Away Lateral Raise', 'Y-Raise']
const PULLUP: Four<string> = ['Weighted Pull-Up', 'Chin-Up', 'Neutral-Grip Pull-Up', 'Weighted Pull-Up']
// The incline window tightens block to block the way the percentages climb.
const INCLINE_WINDOW: Array<[number, number]> = [[10, 12], [8, 10], [6, 8]]
const ROW: Four<string> = ['Chest-Supported Row', 'Seal Row', 'Meadows Row', 'Chest-Supported Row']
const SHOULDER_W: Four<string> = ['Face Pull', 'Band Pull-Apart', 'Face Pull', 'Y-Raise']
const ARMS: Four<string> = ['Overhead Triceps Extension', 'Hammer Curl', 'Skull Crusher', 'Incline DB Curl']
const HIP: Four<string> = ['Hip Thrust', 'Single-Leg Hip Thrust', 'B-Stance Hip Thrust', 'KB Swing']
const LOW_BACK: Four<string> = ['45° Back Extension', 'Reverse Hyper', 'Banded Good Morning', '45° Back Extension']
const TRUNK: Four<string> = ['Pallof Press', 'Landmine Rotation', 'Copenhagen Plank', 'Half-Kneeling Cable Chop']
const MEDBALL: Four<string> = ['Med-Ball Scoop Toss', 'Med-Ball Overhead Backward Throw', 'Med-Ball Rotational Side Throw', 'Med-Ball Chest Pass']
const DB_ROW: Four<string> = ['One-Arm DB Row', 'Kroc Row', 'Pendlay Row', 'One-Arm DB Row']
const REAR_DELT: Four<string> = ['Rear Delt Fly', 'Face Pull', 'Band Pull-Apart', 'Reverse Pec Deck']

// ═══════════════════════════════════════════════════════════════════════════════
// THURSDAY — sprint-return ladder + engine
//
// Andrew: "sprinting is the goal though … I want to jump and sprint but I
// really want to take 6-9 months to condition my body to do it regularly."
// Every week, not every other week: tendons adapt to small frequent doses. The
// level is set by WEEKS OF EXPOSURE, not the macro, so it carries across cycles
// — and it counts from the jump-ramp origin, so "restart jump ramp" after a
// flare drops him back to level 1 (the existing FOR-244 control).
//
//   L1  exposure  1-8   no impact: sled, marches, tendon isometrics
//   L2  exposure  9-17  low impact: tempo runs, low hops, step-down box jumps
//   L3  exposure 18-26  strides, short accelerations, broad jumps to a stick
//   L4  exposure 27+    flying sprints, low depth drops
// ═══════════════════════════════════════════════════════════════════════════════

export const SPRINT_LEVELS: ReadonlyArray<{ from: number; level: 1 | 2 | 3 | 4 }> = [
  { from: 1, level: 1 },
  { from: 9, level: 2 },
  { from: 18, level: 3 },
  { from: 27, level: 4 },
]

export function sprintLevel(weekNumber: number, from = 1): 1 | 2 | 3 | 4 {
  const wk = exposureWeek(weekNumber, from)
  let level: 1 | 2 | 3 | 4 = 1
  for (const s of SPRINT_LEVELS) if (wk >= s.from) level = s.level
  return level
}

const LEVEL_COPY: Record<1 | 2 | 3 | 4, string> = {
  1: 'level 1 of 4 — no impact: sled, marches, tendon holds',
  2: 'level 2 of 4 — low impact: tempo runs, low hops, step-down box jumps',
  3: 'level 3 of 4 — strides, short accelerations, broad jumps to a stick',
  4: 'level 4 of 4 — flying sprints and low depth drops',
}

const NECK = 'Neck: hand-resisted isometrics, 2 × 10s each direction (front, back, sides)'
const KNEE_RULE = 'Knee above 3/10 during this or the next morning: do next Thursday on the bike only, and tap "restart jump ramp" if it keeps happening.'

const ENGINE: Four<string> = [
  '15 min bike intervals: 6 × 1 min hard, 1 min easy, then easy to finish',
  '15 min row, zone 2: conversational pace the whole way',
  'Sled intervals: 8 × 20 m push, walk back; then easy bike to 15 min',
  '15 min mixed tempo: alternate 3 min bike and 3 min row, no rest at the change',
]

function thursdaySession(weekNumber: number, pos: MacroPos, from: number): DayPlan {
  if (pos.isDeload || pos.isTest) {
    return {
      dayNumber: 4, dayName: 'Easy Spin', dayType: 'outside',
      sessionIntent: 'Flush the legs. Nothing hard this week.',
      items: [{ kind: 'outside', slot: 'cond_engine', title: 'Easy Spin (recovery)', parts: ['20-25 min very easy bike, conversational pace'] }],
    }
  }
  const level = sprintLevel(weekNumber, from)
  const engine: OutsideSession = { kind: 'outside', slot: 'cond_engine', title: 'Engine', parts: [ENGINE[pos.weekInMeso - 1]], note: 'Low impact only: bike, rower or sled. No running here.' }
  const items: Prescription[] = []
  if (level === 1) {
    items.push({
      kind: 'outside', slot: 'speed_ladder', title: 'Return to Sprint — Level 1 (no impact)',
      parts: [
        NECK,
        'Sled push 6 × 15 m: drive the shins at an angle. Acceleration mechanics with no landing',
        'Backward sled drag 4 × 20 m',
        'A-march 3 × 15 m, then wall drill 3 × 10 per leg',
        'Spanish squat or wall-sit hold 4 × 30-45s',
        'Slow leg extensions 3 × 12, 3 seconds down',
        'Calf raise hold 3 × 30s',
      ],
      note: `Building the tendons that sprinting needs. ${KNEE_RULE}`,
    })
  } else if (level === 2) {
    items.push(
      {
        kind: 'outside', slot: 'speed_ladder', title: 'Return to Sprint — Level 2 (low impact)',
        parts: [NECK, 'Tempo runs on grass: 6-8 × 100 m at 60-70%, walk back', 'A-march 2 × 20 m to finish'],
        note: KNEE_RULE,
      },
      { kind: 'plyo', slot: 'ladder_hops', name: 'Line Hops', sets: 2, reps: 10, intent: 'LOW AMPLITUDE', note: 'Ankles only, quiet landings.' },
      { kind: 'plyo', slot: 'ladder_jump', name: 'Box Jump (high box, step down)', sets: 3, reps: 3, intent: 'LOW AMPLITUDE', note: 'A high box keeps the landing small. Step down, never jump down.' },
    )
  } else if (level === 3) {
    items.push(
      {
        kind: 'outside', slot: 'sprint', title: 'Return to Sprint — Level 3',
        parts: [NECK, 'Build-ups 3 × 40 m, finishing at 80-90%', '4-6 × 10-20 m accelerations, full recovery (2 min)'],
        note: KNEE_RULE,
      },
      { kind: 'plyo', slot: 'ladder_jump', name: 'Broad Jump (stick it)', sets: 3, reps: 3, intent: 'SUBMAXIMAL — ~3/4', note: 'Stick every landing. The landing is the point, not the distance.' },
    )
  } else {
    items.push(
      {
        kind: 'outside', slot: 'sprint', title: 'Return to Sprint — Level 4',
        parts: [NECK, '2 build-up strides', '3-5 × flying 20s (20 m build + 20 m fly) at 90-95%, full recovery (3 min)'],
        note: KNEE_RULE,
      },
      { kind: 'plyo', slot: 'ladder_jump', name: 'Broad Jump', sets: 3, reps: 3, note: 'Max intent, stick the landing, full reset.' },
      { kind: 'plyo', slot: 'plyo_2', name: 'Depth Drop (low box, ~12")', sets: 2, reps: 3, intent: 'LOW BOX', note: 'Step off, absorb quietly, hold the bottom.' },
    )
  }
  items.push(engine)
  return {
    dayNumber: 4, dayName: `Sprint Return L${level} + Engine`, dayType: 'outside',
    sessionIntent: 'Return-to-sprint work at your level, then 15 minutes of low-impact engine.',
    items,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Deload, test, build
// ═══════════════════════════════════════════════════════════════════════════════

const DELOAD_NOTE = 'Deload — bar speed crisp, leave feeling fresh'

function deloadItem(p: Prescription, maxes: Record<string, number>): Prescription {
  if (p.kind !== 'lift') return p
  if (p.percent == null) return { ...p, sets: 2, note: DELOAD_NOTE }
  const pct = p.maxKey && isClassicLiftSlot(p.slot, p.maxKey) ? 65 : 60
  const d: LiftPrescription = {
    ...withoutSetPlan(p),
    sets: 2,
    percent: pct,
    appliedAdjustmentPct: undefined,
    targetRpe: p.targetRpe != null ? 6 : undefined,
    note: DELOAD_NOTE,
  }
  d.targetWeightLbs = resolveWeight(d.percent, d.maxKey, maxes)
  return d
}

function testDay(dayNumber: number): DayPlan {
  switch (dayNumber) {
    case 1:
      return {
        dayNumber, dayName: 'TEST — Power Clean + Bench', dayType: 'test',
        sessionIntent: 'Work to a new power clean, then a bench max between rests.',
        items: [
          { kind: 'lift', slot: 'test_power_clean', name: 'Power Clean — work to 1RM', sets: 6, reps: 1, maxKey: 'clean_jerk', note: 'Climb 60/70/78/84/88%+ of your clean, then PR attempts. Catch it above parallel. Log the top single. Your cleans keep running off your full clean max, so update that only if you also hit a new full clean.' },
          { kind: 'lift', slot: 'test_bench', name: 'Bench Press — work to 1RM', sets: 6, reps: 1, note: 'Climb 60/70/80/88/94%+ then max attempts. Update your bench max after.' },
        ],
      }
    case 3:
      return {
        dayNumber, dayName: 'TEST — Strict Press', dayType: 'test',
        sessionIntent: 'Work to a new strict press max.',
        items: [
          { kind: 'lift', slot: 'test_ohp', name: 'Overhead Press — work to 1RM', sets: 5, reps: 1, note: 'Strict, no leg drive. Climb 60/72/82/90%+ then max attempts. Update your OHP max after.' },
        ],
      }
    case 4:
      return {
        dayNumber, dayName: 'Easy Spin', dayType: 'outside',
        sessionIntent: 'Flush the legs between test days.',
        items: [{ kind: 'outside', slot: 'cond_engine', title: 'Easy Spin (recovery)', parts: ['20-25 min very easy bike, conversational pace'] }],
      }
    case 5:
      return {
        dayNumber, dayName: 'TEST — Squat 3RM (optional)', dayType: 'test',
        sessionIntent: 'A 3-rep max on the back or front squat, only if the knee says yes.',
        items: [
          { kind: 'lift', slot: 'test_squat_3rm', name: 'Back or Front Squat — work to a 3RM (optional)', sets: 5, reps: 3, note: 'Knee at 2/10 or less today, or skip it. Stop at RPE 9: a 3RM, not a grinder.' },
        ],
      }
    case 6:
      return {
        dayNumber, dayName: 'Move + Update Maxes', dayType: 'outside',
        sessionIntent: 'The macro is done. Move easy and update your maxes.',
        items: [{ kind: 'outside', slot: 'move', title: 'Celebrate & Move', parts: ['15-20 min easy walk or spin', 'Update your bench and OHP maxes in the app (and your clean, if you hit a new full clean). Next macro computes from them'] }],
      }
    default:
      return { dayNumber, dayName: 'Rest', dayType: 'rest', sessionIntent: 'Rest.', items: [] }
  }
}

function buildDay(weekNumber: number, dayNumber: number, maxes: Record<string, number>, adjustments: Record<string, number> = {}, opts?: BuildDayOpts): DayPlan {
  const pos = macroPos(weekNumber)
  if (opts?.forceDeload && !pos.isTest) pos.isDeload = true
  if (pos.isTest) return testDay(dayNumber)

  const m = pos.meso - 1
  const w = pos.weekInMeso
  const lift = (slot: string, def: SlotMeso, maxKey: string, ceiling?: number, overrides?: Partial<LiftPrescription>, chart?: ChartRpe) =>
    liftFromSlot(slot, def, w, maxKey, maxes, pos.meso, adjustments, { ceiling, chart, overrides })
  const deload = (items: Prescription[]) => (pos.isDeload ? items.map((i) => deloadItem(i, maxes)) : items)

  switch (dayNumber) {
    case 1:
      return {
        dayNumber, dayName: 'Snatch + Back Squat + Bench', dayType: 'gym',
        sessionIntent: pos.isDeload ? 'Deload — light, fast, out feeling fresh.' : 'Snatch first while fresh, then a moderate squat, heavy bench and hamstrings.',
        items: deload([
          lift('sn_top', SN[m], 'snatch'),
          lift('back_squat_heavy', BS[m], 'back_squat', SQUAT_CEILING, undefined, CHART),
          lift('bench_heavy', BENCH[m], 'bench', undefined, undefined, CHART),
          rotating('acc_hinge', HINGE[m], w, 3, 8, 'RPE 7. Hips back, flat back, feel the hamstrings.'),
          rotating('acc_ham', HAM, w, 3, 10, 'Nordic week: lower slowly, push yourself back up.'),
          rotating('acc_lateral', LATERAL, w, 3, 12),
        ]),
      }
    case 3:
      return {
        dayNumber, dayName: 'Push Press + Upper', dayType: 'gym',
        sessionIntent: pos.isDeload ? 'Deload — light presses, out quick.' : 'Push press, then a full upper day: pull, incline, row, shoulders, arms.',
        items: deload([
          lift('push_press', PP[m], 'clean_jerk', undefined, undefined, PUSH_PRESS_CHART),
          rotating('acc_wpu', PULLUP, w, 4, 6, 'Add load when every rep is crisp. Log added lbs as the weight.'),
          rangeSlot('db_incline', 'Incline DB Press', 3, INCLINE_WINDOW[m], opts?.loadTargets ?? {}, 'Every set to the top of the range with 2 in the tank: add 5 lb a hand next week.'),
          rotating('acc_row', ROW, w, 3, 10, 'Strict, no bounce.'),
          rotating('acc_shoulder', SHOULDER_W, w, 3, 15),
          rotating('acc_arms', ARMS, w, 3, 10),
        ]),
      }
    case 4:
      return thursdaySession(weekNumber, pos, opts?.jumpRampFromWeek ?? 1)
    case 5:
      return {
        dayNumber, dayName: 'Clean + Front Squat', dayType: 'gym',
        sessionIntent: pos.isDeload ? 'Deload — a few crisp cleans, nothing else heavy.' : 'Cleans first, then a moderate front squat, hips, low back and trunk.',
        items: deload([
          lift('cl_top', CL[m], 'clean_jerk'),
          lift('front_squat', FS[m], 'front_squat', SQUAT_CEILING, undefined, CHART),
          rotating('acc_hip', HIP, w, 3, 8),
          rotating('acc_lowback', LOW_BACK, w, 3, 12),
          rotating('acc_trunk', TRUNK, w, 3, 10, 'Per side where it is one-sided. Rotation and anti-rotation are what rugby and hockey ask for.'),
        ]),
      }
    case 6:
      return {
        dayNumber, dayName: 'Strict Press + Close-Grip + Hinge', dayType: 'gym',
        sessionIntent: pos.isDeload ? 'Deload — move, don\'t grind.' : 'Throws to wake up, strict press, close-grip bench, a moderate trap-bar pull, back and rear delts.',
        items: deload([
          rotating('acc_medball', MEDBALL, w, 4, 3, 'Explosive, no landing. Full reset between throws.'),
          // A short Saturday keeps the press and the pull, not the warm-up throws.
          lift('ohp_press', OHP[m], 'ohp', undefined, { shortDay: true }, PRESS_CHART),
          lift('cg_bench', CG[m], 'bench', undefined, undefined, CHART),
          lift('sat_dl', TB[m], 'deadlift', undefined, { shortDay: true }, CHART),
          rotating('acc_db_row', DB_ROW, w, 3, 10),
          rotating('acc_rear_delt', REAR_DELT, w, 3, 15),
        ]),
      }
    case 2:
    case 7:
    default:
      return { dayNumber, dayName: 'Rest', dayType: 'rest', sessionIntent: 'Rest. Five days a week is the plan.', items: [] }
  }
}

export const hybridPower: ProgramConfig = {
  // Slug stays 'hybrid-power': it keys user_programs, generated_workouts and
  // user_exercise_subs. The display name is what anyone reads.
  slug: 'hybrid-power',
  name: 'Power Dad',
  tagline: 'Athletic power · sprint return · knees first',
  description:
    'Built to make you a faster, leaner, more powerful athlete without wrecking your knees. Four gym days: snatch, moderate back squat and heavy bench on Monday; push press and upper on Wednesday; cleans and a moderate front squat on Friday; strict press, close-grip bench and a trap-bar pull on Saturday. Thursday brings sprinting and jumping back on a slow, level-by-level ramp, then 15 minutes of low-impact engine. Every lift rotates through weekly variations: pauses, tempos, 1¼ reps, deficits, hang positions. Five days a week, 6 blocks max per gym day. 13-week macro: build, strength, peak, deload week 12, test week 13.',
  daysPerWeek: 5,
  gymDayNumbers: [1, 3, 5, 6],
  macroWeeks: 13,
  requiredMaxes: [
    { key: 'snatch', label: 'Snatch', hint: 'Best full-lift single — all snatch work keys off this' },
    { key: 'clean_jerk', label: 'Clean', hint: 'Best clean single — the cleans and push press key off this' },
    { key: 'back_squat', label: 'Back Squat', hint: 'Best recent single (lbs)' },
    { key: 'front_squat', label: 'Front Squat', hint: 'Best recent single (lbs)' },
    { key: 'bench', label: 'Bench Press', hint: 'Best recent single (lbs)' },
    { key: 'deadlift', label: 'Deadlift', hint: 'Best recent single — the trap-bar pull keys off this' },
    { key: 'ohp', label: 'Overhead Press', hint: 'Strict press single — estimate: best 5×5 × 1.15' },
  ],
  rampLabel: (weekNumber, from) => `Thursday sprint return: ${LEVEL_COPY[sprintLevel(weekNumber, from)]}`,
  buildDay,
}
