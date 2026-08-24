import {
  BuildDayOpts,
  DayPlan,
  LiftPrescription,
  OutsideSession,
  ProgramConfig,
  Prescription,
  resolveWeight,
} from './types'

// ═══════════════════════════════════════════════════════════════════════════════
// DAD BUILT — size on top of strength
//
// The sibling to Power Dad. Same deterministic engine, opposite emphasis:
// Power Dad spends its week buying rate of force development, this one
// spends it buying tissue. Four gym days, upper/lower twice each, Mon-Fri with
// the weekend genuinely off.
//
// TWO PROGRESSION SYSTEMS, ON PURPOSE. This is the thing that makes the file
// look different from hybridPower.ts:
//
//   · The compound that opens each day is PERCENT-based off a tested 1RM,
//     waved across the macro exactly like the other programs. Squat, bench,
//     deadlift and press have a 1RM, so a percentage means something.
//
//   · Everything after it is RANGE-based and progresses by DOUBLE PROGRESSION
//     (see progression.ts). A cable fly has no 1RM; a percentage of one would
//     be a number about nothing. So the prescription is a rep window, the load
//     holds until every set clears the top of it, and then it steps up.
//
// Percent work is the floor under the program; range work is the volume that
// actually drives growth. Mixing them is the whole point of "powerbuilding",
// and keeping them in separate progression systems is what stops the program
// from lying about one of them.
//
// WEEKLY VOLUME IS THE CURRENCY. Hypertrophy is bought in hard sets per muscle
// per week (the useful band is roughly 10-20), not in tonnage and not in
// percentages. MUSCLE_MAP below tags every slot so the sweep can count it —
// that count is this program's equivalent of Power Dad's percentage floors,
// and it is the thing to check when editing.
//
// SESSION BUDGET: 8 blocks (raised from the 6 that governs Power Dad —
// athlete's call for this program specifically). Eight is a CEILING, not a
// quota: the lower days run seven because stuffing an eighth would add junk.
//
// 13-week macro, matching every other path so the deload flag, the fatigue
// check, the test week and the autoreg meso-boundary guard all work unchanged.
//   M1 (W1-4)  volume:        compounds 4x6 @70-76, ranges wide (12-15)
//   M2 (W5-8)  intensification: compounds 4x4 @78-84, ranges tighter (10-12)
//   M3 (W9-12) realization:   compounds 4x3 @85-88, ranges heaviest (8-10)
//   W12 deload · W13 test
// ═══════════════════════════════════════════════════════════════════════════════

const MACRO_WEEKS = 13
const BLOCK_BUDGET = 8

interface MacroPos {
  weekInMacro: number
  meso: number
  weekInMeso: number
  isDeload: boolean
  isTest: boolean
}

function macroPos(weekNumber: number): MacroPos {
  const weekInMacro = ((weekNumber - 1) % MACRO_WEEKS) + 1
  const isTest = weekInMacro === MACRO_WEEKS
  const meso = isTest ? 3 : Math.ceil(weekInMacro / 4)
  const weekInMeso = isTest ? 4 : ((weekInMacro - 1) % 4) + 1
  return { weekInMacro, meso, weekInMeso, isDeload: weekInMacro === MACRO_WEEKS - 1, isTest }
}

// ── The percent-based openers ─────────────────────────────────────────────────
// One per day. Sets/reps/percent by meso; the wave climbs 2%/week inside a meso.
interface CompoundMeso {
  sets: number
  reps: number
  pctStart: number
  pctStep: number
  targetRpe: number
}
const COMPOUND: Record<number, CompoundMeso> = {
  1: { sets: 4, reps: 6, pctStart: 70, pctStep: 2, targetRpe: 7 },
  2: { sets: 4, reps: 4, pctStart: 78, pctStep: 2, targetRpe: 8 },
  3: { sets: 4, reps: 3, pctStart: 85, pctStep: 1, targetRpe: 9 },
}

// Range work tightens and gets heavier as the macro progresses. The load
// carries over via double progression; narrowing the window is what forces it
// upward at the meso boundary.
const RANGE_BY_MESO: Record<number, { wide: [number, number]; mid: [number, number]; heavy: [number, number] }> = {
  1: { wide: [12, 20], mid: [12, 15], heavy: [8, 12] },
  2: { wide: [12, 18], mid: [10, 12], heavy: [6, 10] },
  3: { wide: [10, 15], mid: [8, 12], heavy: [6, 8] },
}

/**
 * Which muscles a slot trains, and how much of the credit it earns.
 *
 * A bench set is NOT a triceps set. Counting it as one is how a program
 * convinces itself the arms are covered while prescribing almost no direct
 * work — so secondary movers count as HALF, the standard fractional
 * convention. Without this the audit reported 20 triceps sets a week when the
 * honest number was 13, and the difference is exactly the amount of direct
 * work you would then wrongly decide to cut.
 */
export interface MuscleShare { primary: string[]; secondary?: string[] }

export const MUSCLE_MAP: Record<string, MuscleShare> = {
  pb_squat: { primary: ['quads'], secondary: ['glutes'] },
  pb_rdl: { primary: ['hamstrings'], secondary: ['glutes'] },
  pb_legpress: { primary: ['quads'], secondary: ['glutes'] },
  pb_legcurl_a: { primary: ['hamstrings'] },
  pb_calf_a: { primary: ['calves'] },
  pb_split_squat: { primary: ['quads', 'glutes'] },
  pb_core_a: { primary: ['core'] },

  pb_bench: { primary: ['chest'], secondary: ['triceps', 'delts'] },
  pb_pullup: { primary: ['back'], secondary: ['biceps'] },
  pb_incline: { primary: ['chest'], secondary: ['triceps'] },
  pb_row_a: { primary: ['back'], secondary: ['biceps'] },
  pb_lateral_a: { primary: ['delts'] },
  pb_fly: { primary: ['chest'] },
  pb_curl_a: { primary: ['biceps'] },
  pb_triceps_a: { primary: ['triceps'] },

  pb_deadlift: { primary: ['hamstrings'], secondary: ['glutes', 'back'] },
  pb_frontsquat: { primary: ['quads'] },
  pb_hipthrust: { primary: ['glutes'] },
  pb_legext: { primary: ['quads'] },
  pb_legcurl_b: { primary: ['hamstrings'] },
  pb_calf_b: { primary: ['calves'] },
  pb_core_b: { primary: ['core'] },

  pb_ohp: { primary: ['delts'], secondary: ['triceps'] },
  pb_row_b: { primary: ['back'], secondary: ['biceps'] },
  pb_dip: { primary: ['chest'], secondary: ['triceps'] },
  pb_pulldown: { primary: ['back'], secondary: ['biceps'] },
  pb_reardelt: { primary: ['delts'] },
  pb_lateral_b: { primary: ['delts'] },
  pb_curl_b: { primary: ['biceps'] },
  pb_triceps_b: { primary: ['triceps'] },
}

/** Fractional weekly set credit for one prescribed block. */
export function setCredit(slot: string, sets: number): Record<string, number> {
  const m = MUSCLE_MAP[slot]
  const out: Record<string, number> = {}
  if (!m) return out
  for (const p of m.primary) out[p] = (out[p] ?? 0) + sets
  for (const sec of m.secondary ?? []) out[sec] = (out[sec] ?? 0) + sets * 0.5
  return out
}

function compound(
  slot: string, name: string, maxKey: string, pos: MacroPos,
  maxes: Record<string, number>, adjustments: Record<string, number>, note?: string,
): LiftPrescription {
  const def = COMPOUND[pos.meso]
  const raw = adjustments[slot] ?? 0
  const adj = Math.max(-8, Math.min(8, raw))
  const percent = Math.round((def.pctStart + def.pctStep * (pos.weekInMeso - 1) + adj) * 2) / 2
  return {
    kind: 'lift', slot, name, maxKey, percent,
    sets: def.sets, reps: def.reps,
    targetWeightLbs: resolveWeight(percent, maxKey, maxes),
    targetRpe: def.targetRpe,
    appliedAdjustmentPct: adj !== 0 ? adj : undefined,
    note,
  }
}

/**
 * A range-based accessory. `reps` carries the BOTTOM of the window so any
 * consumer reading a plain number still shows something true, and repRange
 * carries the window the athlete actually chases.
 *
 * targetWeightLbs comes from double progression over logged history, never
 * from a percentage — that is the whole distinction this program rests on.
 */
function range(
  slot: string, name: string, sets: number, window: [number, number],
  loadTargets: Record<string, number>, opts?: { rir?: number; step?: number; note?: string; superset?: string },
): LiftPrescription {
  const suggested = loadTargets[slot]
  return {
    kind: 'lift', slot, name, sets,
    reps: window[0],
    repRange: window,
    targetRir: opts?.rir ?? 2,
    loadStepLbs: opts?.step ?? 5,
    targetWeightLbs: suggested != null && suggested > 0 ? suggested : undefined,
    note: opts?.note,
    superset: opts?.superset,
  }
}

// Deload: keep the movements, cut the work. Compounds to 60%, range work to
// two sets at the bottom of the window. The point is to show up and leave.
function deloadify(items: Prescription[], maxes: Record<string, number>): Prescription[] {
  return items.map(i => {
    if (i.kind !== 'lift') return i
    if (i.percent != null) {
      return {
        ...i, percent: 60, sets: Math.max(2, Math.ceil(i.sets / 2)), targetRpe: 6,
        targetWeightLbs: resolveWeight(60, i.maxKey, maxes),
        note: 'Deload — crisp and easy, leave feeling fresh',
      }
    }
    return { ...i, sets: 2, note: 'Deload — two easy sets, well short of failure' }
  })
}

function easyDay(pos: MacroPos): OutsideSession {
  if (pos.isDeload || pos.isTest) {
    return {
      kind: 'outside', slot: 'pb_cond',
      title: 'Easy Movement',
      parts: ['20-25 min easy walk, bike or row — conversational the whole way'],
      note: 'Blood flow between the hard days. Nothing that needs recovering from.',
    }
  }
  return {
    kind: 'outside', slot: 'pb_cond',
    title: 'Midweek Engine',
    parts: [
      '25-35 min steady Z2 — bike, row, ruck or incline walk, your pick',
      'Optional finisher: 3 × 30s hard / 90s easy, only if the legs feel good',
      'Then 10 min of whatever is stiff — hips and t-spine earn their keep here',
    ],
    note: 'Deliberately light. Hard conditioning midweek would tax the same legs Thursday needs.',
  }
}

function testDay(dayNumber: number): DayPlan {
  const plans: Record<number, DayPlan> = {
    1: {
      dayNumber, dayName: 'TEST — Squat 1RM', dayType: 'test',
      sessionIntent: 'Work to a new back squat single. Take your time between attempts.',
      items: [{
        kind: 'lift', slot: 'test_squat', name: 'Back Squat — work to 1RM', sets: 6, reps: 1,
        note: 'Climb 60/70/80/88/94%+ then max attempts. Log the top single and update your max.',
      }],
    },
    2: {
      dayNumber, dayName: 'TEST — Bench 1RM', dayType: 'test',
      sessionIntent: 'Bench single, then press if the day still has something in it.',
      items: [
        { kind: 'lift', slot: 'test_bench', name: 'Bench Press — work to 1RM', sets: 6, reps: 1, note: 'Climb 60/70/80/88/94%+ then max attempts. Get a spot.' },
        { kind: 'lift', slot: 'test_ohp', name: 'Overhead Press — work to 1RM (optional)', sets: 4, reps: 1, note: 'Only if bench felt strong — this one can wait a day.' },
      ],
    },
    4: {
      dayNumber, dayName: 'TEST — Deadlift 1RM', dayType: 'test',
      sessionIntent: 'Pull a single, then the macro is done. Update every max in the app.',
      items: [
        { kind: 'lift', slot: 'test_dl', name: 'Deadlift — work to 1RM', sets: 6, reps: 1, note: 'Climb 60/70/80/88/94%+ then max attempts. Belt up.' },
      ],
    },
  }
  if (plans[dayNumber]) return plans[dayNumber]
  const pos: MacroPos = { weekInMacro: 13, meso: 3, weekInMeso: 4, isDeload: false, isTest: true }
  if (dayNumber === 3) return { dayNumber, dayName: 'Easy Movement', dayType: 'outside', sessionIntent: 'Flush between test days.', items: [easyDay(pos)] }
  return {
    dayNumber, dayName: 'Update Your Maxes', dayType: 'test',
    sessionIntent: 'No lifting. Enter the new numbers — next macro computes off them.',
    items: [{
      kind: 'outside', slot: 'pb_wrap', title: 'Close the macro',
      parts: ['Enter every 1RM you hit this week', 'Next macro recomputes from the new numbers the moment you do'],
    }],
  }
}

function buildDay(
  weekNumber: number, dayNumber: number,
  maxes: Record<string, number>,
  adjustments: Record<string, number> = {},
  opts?: BuildDayOpts,
): DayPlan {
  const pos = macroPos(weekNumber)
  if (opts?.forceDeload && !pos.isTest) pos.isDeload = true
  if (pos.isTest) return testDay(dayNumber)

  const lt = opts?.loadTargets ?? {}
  const r = RANGE_BY_MESO[pos.meso]

  let items: Prescription[]
  let dayName: string
  let intent: string

  switch (dayNumber) {
    case 1:
      dayName = 'Lower A — Squat'
      intent = 'Squat heavy, then everything that makes legs bigger.'
      items = [
        compound('pb_squat', 'Back Squat', 'back_squat', pos, maxes, adjustments, 'The strength anchor — everything after this is volume.'),
        range('pb_rdl', 'Romanian Deadlift', 3, r.heavy, lt, { step: 10, note: 'Hinge, do not squat it. Stretch is the point.' }),
        range('pb_legpress', 'Leg Press', 3, r.mid, lt, { step: 10 }),
        range('pb_legcurl_a', 'Seated Leg Curl', 3, r.mid, lt, { superset: 'pb_ss_a' }),
        range('pb_calf_a', 'Standing Calf Raise', 4, r.wide, lt, { superset: 'pb_ss_a', note: 'Pause at the bottom. Calves answer to stretch, not bounce.' }),
        range('pb_split_squat', 'Bulgarian Split Squat', 3, r.heavy, lt, { note: 'Per leg. DBs in hand.' }),
        range('pb_core_a', 'Hanging Leg Raise', 3, r.wide, lt, { rir: 1 }),
      ]
      break

    case 2:
      dayName = 'Upper A — Bench'
      intent = 'Press heavy, row hard, then chase the pump.'
      items = [
        compound('pb_bench', 'Bench Press', 'bench', pos, maxes, adjustments),
        range('pb_pullup', 'Weighted Pull-Up', 3, r.heavy, lt, { note: 'Add load when the top of the range is easy. Dead hang to chin over.' }),
        range('pb_incline', 'Incline DB Press', 3, r.mid, lt, { superset: 'pb_ss_b' }),
        range('pb_row_a', 'Chest-Supported Row', 3, r.mid, lt, { superset: 'pb_ss_b', note: 'Chest stays down. No body english.' }),
        range('pb_lateral_a', 'Lateral Raise', 4, r.wide, lt, { rir: 1, step: 5, note: 'Light. Delts do not care what the number is.' }),
        range('pb_fly', 'Cable Fly', 3, r.wide, lt),
        range('pb_curl_a', 'EZ-Bar Curl', 3, r.mid, lt, { superset: 'pb_ss_c' }),
        range('pb_triceps_a', 'Rope Pushdown', 3, r.mid, lt, { superset: 'pb_ss_c', rir: 1 }),
      ]
      break

    case 3:
      return {
        dayNumber, dayName: 'Midweek Engine', dayType: 'outside',
        sessionIntent: 'Stay athletic without spending the legs Thursday needs.',
        items: [easyDay(pos)],
      }

    case 4:
      dayName = 'Lower B — Hinge'
      intent = 'Pull heavy, then quads and glutes from every other angle.'
      items = [
        compound('pb_deadlift', 'Deadlift', 'deadlift', pos, maxes, adjustments, 'Reset every rep. No touch-and-go on the heavy sets.'),
        range('pb_frontsquat', 'Front Squat', 3, r.heavy, lt, { step: 10, note: 'Upright torso — this is the quad answer to Monday.' }),
        range('pb_hipthrust', 'Hip Thrust', 3, r.mid, lt, { step: 10, note: 'Chin tucked, ribs down, pause at the top.' }),
        range('pb_legext', 'Leg Extension', 3, r.wide, lt, { rir: 1, superset: 'pb_ss_d' }),
        range('pb_legcurl_b', 'Lying Leg Curl', 3, r.mid, lt, { superset: 'pb_ss_d' }),
        range('pb_calf_b', 'Seated Calf Raise', 4, r.wide, lt),
        range('pb_core_b', 'Ab Wheel Rollout', 3, r.mid, lt, { rir: 1 }),
      ]
      break

    case 5:
      dayName = 'Upper B — Press'
      intent = 'Overhead first, then back thickness and the arms that show.'
      items = [
        compound('pb_ohp', 'Overhead Press', 'ohp', pos, maxes, adjustments, 'Strict. Glutes tight, no leg drive.'),
        range('pb_row_b', 'Barbell Row', 3, r.heavy, lt, { step: 10, note: 'Flat back, pull to the sternum.' }),
        range('pb_dip', 'Dips', 3, r.heavy, lt, { superset: 'pb_ss_e', note: 'Add load when bodyweight gets easy.' }),
        range('pb_pulldown', 'Lat Pulldown', 3, r.mid, lt, { superset: 'pb_ss_e', note: 'Wider grip than the row — different job.' }),
        range('pb_reardelt', 'Rear Delt Fly', 4, r.wide, lt, { rir: 1, superset: 'pb_ss_f' }),
        range('pb_lateral_b', 'Cable Lateral Raise', 3, r.wide, lt, { rir: 1, superset: 'pb_ss_f' }),
        range('pb_curl_b', 'Hammer Curl', 3, r.mid, lt, { superset: 'pb_ss_g' }),
        range('pb_triceps_b', 'Overhead Triceps Extension', 3, r.mid, lt, { superset: 'pb_ss_g', rir: 1 }),
      ]
      break

    default:
      return { dayNumber, dayName: 'Rest', dayType: 'rest', sessionIntent: 'Weekend is off. Growth happens here.', items: [] }
  }

  if (pos.isDeload) {
    items = deloadify(items, maxes)
    intent = 'Deload — same movements, half the work. Leave feeling better than you arrived.'
  }

  return { dayNumber, dayName, dayType: 'gym', sessionIntent: intent, items }
}

export const dadBuilt: ProgramConfig = {
  slug: 'dad-built',
  name: 'Dad Built',
  tagline: 'Size on top of strength · 4 days',
  description:
    'Four gym days, upper/lower twice each, Monday to Friday with the weekend off. Every day opens with a percentage-based main lift off a tested 1RM, then range-based accessory work that progresses by double progression — hold the load until every set clears the top of the rep range, then add weight. Strength stays on a wave; size comes from the volume behind it. 13-week macro, deload week 12, test week 13.',
  daysPerWeek: 5,
  gymDayNumbers: [1, 2, 4, 5],
  macroWeeks: MACRO_WEEKS,
  requiredMaxes: [
    { key: 'back_squat', label: 'Back Squat', hint: 'Best recent single (lbs)' },
    { key: 'bench', label: 'Bench Press', hint: 'Best recent single (lbs)' },
    { key: 'deadlift', label: 'Deadlift', hint: 'Best recent single (lbs)' },
    { key: 'ohp', label: 'Overhead Press', hint: 'Strict press single — estimate: best 5×5 × 1.15' },
  ],
  buildDay,
}

export const DAD_BUILT_BLOCK_BUDGET = BLOCK_BUDGET
