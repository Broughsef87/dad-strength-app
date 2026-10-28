import { MAX_ADJ } from './autoreg'
import {
  BuildDayOpts,
  DayPlan,
  LiftPrescription,
  OutsideSession,
  PlyoPrescription,
  ProgramConfig,
  Prescription,
  resolveWeight,
} from './types'

// ═══════════════════════════════════════════════════════════════════════════════
// DAD BUILT — size on top of strength
//
// The sibling to Power Dad. Same deterministic engine, opposite emphasis:
// Power Dad spends its week buying rate of force development, this one
// spends it buying tissue. Four gym days: push, legs, pull, then shoulders
// with the posterior chain. One leg day on purpose (athlete's call,
// 2026-10-28: legs are already his strongest group, the arms get the room).
//
// TWO PROGRESSION SYSTEMS, ON PURPOSE. This is the thing that makes the file
// look different from hybridPower.ts:
//
//   · The compound that opens push, legs and shoulders is PERCENT-based off a
//     tested 1RM, waved across the macro exactly like the other programs.
//     Squat, bench and press have a 1RM, so a percentage means something.
//     Pull day has no 1RM lift (deadlifts came out 2026-10-28), so it opens
//     with weighted pull-ups on double progression instead.
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
// SESSION BUDGET: 7 blocks. It was 8 on the upper/lower split; push/legs/
// pull/shoulders needs fewer per day (athlete, 2026-10-28). Seven is a
// CEILING, not a quota.
//
// 13-week macro, matching every other path so the deload flag, the fatigue
// check, the test week and the autoreg meso-boundary guard all work unchanged.
//   M1 (W1-4)  volume:        compounds 4x6 @70-76, ranges wide (12-20)
//   M2 (W5-8)  intensification: compounds 4x4 @78-84, ranges tighter (10-12)
//   M3 (W9-12) realization:   compounds 4x3 @85-88, ranges heaviest (8-10)
//   W12 deload · W13 TEST = rep-max AMRAPs at 85%, capped at 8 (bench,
//   squat, press); pull day runs its deload session that week
// ═══════════════════════════════════════════════════════════════════════════════

const MACRO_WEEKS = 13
const BLOCK_BUDGET = 7

/**
 * Which session each gym day runs. Push / legs / pull / shoulders + posterior
 * chain — athlete's call, 2026-10-28 (it was upper/lower/upper/lower; he
 * wanted more triceps on bench day, more biceps on back day, one leg day, and
 * no deadlifts).
 *
 * This is a declared table rather than case labels on the day number so the
 * split is one line to change and impossible to get half-right. Anything keyed
 * to a SESSION — the test-week AMRAP and its rep cap, the wrap card — must be
 * looked up through here too, or reordering the week silently hands one
 * lift's cap to another.
 *
 * Day numbers are Mon=1 … Sun=7; 2 and 4 are dad miles, 7 is off.
 */
type Session = 'push' | 'legs' | 'pull' | 'shoulders'
const SESSION_BY_DAY: Record<number, Session> = {
  1: 'push',       // Mon — Bench, chest, triceps
  3: 'legs',       // Wed — Squat, the one leg day
  5: 'pull',       // Fri — Pull-ups, back, biceps
  6: 'shoulders',  // Sat — Press, delts, hamstrings and glutes; the macro closes here
}

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
  // Push
  pb_bench: { primary: ['chest'], secondary: ['triceps', 'delts'] },
  pb_incline: { primary: ['chest'], secondary: ['triceps'] },
  pb_dip: { primary: ['chest'], secondary: ['triceps'] },
  pb_fly: { primary: ['chest'] },
  pb_skull: { primary: ['triceps'] },
  pb_triceps_a: { primary: ['triceps'] },
  pb_triceps_b: { primary: ['triceps'] },

  // Legs
  pb_squat: { primary: ['quads'], secondary: ['glutes'] },
  pb_split_squat: { primary: ['quads', 'glutes'] },
  pb_legpress: { primary: ['quads'], secondary: ['glutes'] },
  pb_legcurl_a: { primary: ['hamstrings'] },
  pb_calf_a: { primary: ['calves'] },
  pb_calf_b: { primary: ['calves'] },
  pb_core_a: { primary: ['core'] },

  // Pull
  pb_pullup: { primary: ['back'], secondary: ['biceps'] },
  pb_row_b: { primary: ['back'], secondary: ['biceps'] },
  pb_row_a: { primary: ['back'], secondary: ['biceps'] },
  pb_pulldown: { primary: ['back'], secondary: ['biceps'] },
  pb_curl_a: { primary: ['biceps'] },
  pb_curl_c: { primary: ['biceps'] },
  pb_curl_b: { primary: ['biceps'] },

  // Shoulders + posterior chain
  pb_ohp: { primary: ['delts'], secondary: ['triceps'] },
  pb_lateral_a: { primary: ['delts'] },
  pb_reardelt: { primary: ['delts'] },
  pb_rdl: { primary: ['hamstrings'], secondary: ['glutes'] },
  pb_legcurl_b: { primary: ['hamstrings'] },
  pb_hipthrust: { primary: ['glutes'] },
  // The carry IS trunk work — anti-lateral-flexion under load — so it earns
  // credit.
  pb_carry: { primary: ['core'], secondary: ['back'] },
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
  const adj = Math.max(-MAX_ADJ, Math.min(MAX_ADJ, raw))
  const percent = Math.round((def.pctStart + def.pctStep * (pos.weekInMeso - 1) + adj) * 2) / 2
  return {
    kind: 'lift', slot, name, maxKey, percent,
    sets: def.sets, reps: def.reps,
    targetWeightLbs: resolveWeight(percent, maxKey, maxes),
    targetRpe: def.targetRpe,
    appliedAdjustmentPct: adj !== 0 ? adj : undefined,
    note,
    // The opener is always one of a short day's two lifts.
    shortDay: true,
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
  loadTargets: Record<string, number>, opts?: { rir?: number; step?: number; note?: string; superset?: string; shortDay?: boolean },
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
    shortDay: opts?.shortDay,
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

function dadMiles(pos: MacroPos): OutsideSession {
  // Dad Strong's card verbatim, on purpose. Two of these a week alongside four
  // lifting days only works if they stay genuinely easy — an interval finisher
  // here would quietly eat the recovery the volume depends on.
  if (pos.isDeload || pos.isTest) {
    return {
      kind: 'outside', slot: 'dad_miles', title: 'Dad Miles (easy)',
      parts: ['25-30 min easy walk — headphones optional, phone in pocket'],
    }
  }
  return {
    kind: 'outside', slot: 'dad_miles', title: 'Dad Miles',
    parts: ['30-40 min walk, ruck, or easy bike', 'Conversational the whole way'],
    note: 'The cheapest longevity work there is. Stroller counts. Kid on shoulders counts double.',
  }
}

const E1RM_NOTE = 'e1RM = weight × (1 + reps/30). Put the result in your maxes — next macro computes off it.'

/**
 * Test week is rep-max AMRAPs at 85%, not singles.
 *
 * The caps are load-bearing twice over. After eleven weeks of accumulated
 * volume a true max single is the worst-timed rep of the macro; and the
 * analytics e1RM (Epley) refuses anything past 10 reps, so an uncapped set
 * that ran to 14 would produce a number the app then declines to use.
 * Deadlift caps lower because heavy pulls get ugly past six.
 */
function testDay(
  dayNumber: number, maxes: Record<string, number>,
  adjustments: Record<string, number>, lt: Record<string, number>,
): DayPlan {
  const amrap = (slot: string, name: string, maxKey: string, cap: number): LiftPrescription => ({
    kind: 'lift', slot, name: name + ' — AMRAP @ 85%', maxKey, percent: 85,
    sets: 1, reps: cap,
    // Without this the card reads "AMRAP @ 85%" with no weight on it, which is
    // the one number the whole test depends on.
    targetWeightLbs: resolveWeight(85, maxKey, maxes),
    note: 'Stop at ' + cap + ' even if you have more in the tank. ' + E1RM_NOTE,
  })

  // Keyed by SESSION, not day number: each lift keeps its own rep cap when the
  // week is reordered.
  const wrapCard = {
    kind: 'outside' as const, slot: 'pb_wrap', title: 'Update your maxes',
    parts: [
      'Convert each AMRAP: weight × (1 + reps/30)',
      'Enter all three — squat, bench, press',
      'Next macro recomputes the moment you do',
    ],
  }
  // The wrap closes the macro, so it belongs to whichever session runs last.
  const lastSession = SESSION_BY_DAY[Math.max(...Object.keys(SESSION_BY_DAY).map(Number))]

  // Pull day has no 1RM lift to test, so test week runs its deload session:
  // keeps the back and biceps ticking over between the AMRAP days.
  const pullPos: MacroPos = { weekInMacro: 13, meso: 3, weekInMeso: 4, isDeload: true, isTest: true }
  const pull = session('pull', pullPos, maxes, adjustments, lt)
  const bySession: Record<Session, DayPlan> = {
    push: {
      dayNumber, dayName: 'TEST — Bench AMRAP', dayType: 'test',
      sessionIntent: 'One all-out set at 85%, capped at 8. Get a spot.',
      items: [amrap('test_bench', 'Bench Press', 'bench', 8)],
    },
    legs: {
      dayNumber, dayName: 'TEST — Squat AMRAP', dayType: 'test',
      sessionIntent: 'One all-out set at 85%. Warm up properly, then send it — capped at 8.',
      items: [amrap('test_squat', 'Back Squat', 'back_squat', 8)],
    },
    pull: {
      dayNumber, dayName: pull.dayName + ' (easy)', dayType: 'gym',
      sessionIntent: 'Test week — no max to chase on pull day. Two easy sets each, then go home.',
      items: deloadify(pull.items, maxes),
    },
    shoulders: {
      dayNumber, dayName: 'TEST — Press AMRAP', dayType: 'test',
      sessionIntent: 'Strict press at 85%, capped at 8.',
      items: [amrap('test_ohp', 'Overhead Press', 'ohp', 8)],
    },
  }
  for (const key of Object.keys(bySession) as Session[]) {
    if (key === lastSession) {
      bySession[key] = {
        ...bySession[key],
        sessionIntent: bySession[key].sessionIntent + ' Last one — then close the macro.',
        items: [...bySession[key].items, wrapCard],
      }
    }
  }
  const plans: Record<number, DayPlan> = Object.fromEntries(
    Object.entries(SESSION_BY_DAY).map(([day, sess]) => [Number(day), bySession[sess]]),
  )
  if (plans[dayNumber]) return plans[dayNumber]
  const pos: MacroPos = { weekInMacro: 13, meso: 3, weekInMeso: 4, isDeload: false, isTest: true }
  return {
    dayNumber, dayName: 'Dad Miles (easy)', dayType: 'outside',
    sessionIntent: 'Easy between test days.', items: [dadMiles(pos)],
  }
}

// Jump primers (Box Jump / Broad Jump) were removed 2026-08-24 at the athlete's
// request — he moved onto this program to train around an injury, and max-intent
// landings are the wrong thing to prescribe in that situation. They carried no
// MUSCLE_MAP credit, so weekly hard sets per muscle are unchanged. The Farmer
// Carry stays: it is loaded carrying, not jumping.

/**
 * One session's lifts, before any deload treatment.
 *
 * ORDER RULE (athlete, 2026-10-28): a muscle's exercises run back to back.
 * The only thing allowed to split a muscle's run is a superset partner.
 * scripts/checks/dadbuilt-grouping.mjs holds every day to this.
 */
function session(
  sess: Session, pos: MacroPos, maxes: Record<string, number>,
  adjustments: Record<string, number>, lt: Record<string, number>,
): { dayName: string; intent: string; items: Prescription[] } {
  const r = RANGE_BY_MESO[pos.meso]
  switch (sess) {
    case 'push':
      return {
        dayName: 'Push — Bench',
        intent: 'Press heavy, finish the chest, then give the triceps a real day.',
        items: [
          compound('pb_bench', 'Bench Press', 'bench', pos, maxes, adjustments),
          range('pb_incline', 'Incline DB Press', 3, r.mid, lt),
          range('pb_dip', 'Dips', 3, r.heavy, lt, { shortDay: true, note: 'Add load when bodyweight gets easy.' }),
          range('pb_fly', 'Cable Fly', 3, r.wide, lt),
          range('pb_skull', 'EZ-Bar Skull Crusher', 3, r.heavy, lt, { note: 'Bar to the forehead, elbows stay pointed up.' }),
          range('pb_triceps_a', 'Rope Pushdown', 3, r.mid, lt, { superset: 'pb_ss_c', rir: 1 }),
          range('pb_triceps_b', 'Overhead Triceps Extension', 3, r.mid, lt, { superset: 'pb_ss_c', rir: 1, note: 'Long head — the stretch overhead is the point.' }),
        ],
      }

    case 'legs':
      return {
        dayName: 'Legs — Squat',
        intent: 'The one leg day. Squat heavy, then everything that makes legs bigger.',
        items: [
          compound('pb_squat', 'Back Squat', 'back_squat', pos, maxes, adjustments, 'The strength anchor — everything after this is volume.'),
          range('pb_split_squat', 'Bulgarian Split Squat', 3, r.heavy, lt, { shortDay: true, note: 'Per leg. DBs in hand.' }),
          range('pb_legpress', 'Leg Press', 3, r.mid, lt, { step: 10 }),
          range('pb_legcurl_a', 'Seated Leg Curl', 3, r.mid, lt, { superset: 'pb_ss_a' }),
          range('pb_calf_a', 'Standing Calf Raise', 4, r.wide, lt, { superset: 'pb_ss_a', step: 10, note: 'Pause at the bottom. Calves answer to stretch, not bounce.' }),
          range('pb_calf_b', 'Seated Calf Raise', 4, r.wide, lt, { step: 10, note: 'Knees bent hits soleus — the half of the calf the standing raise misses.' }),
          range('pb_core_a', 'Hanging Leg Raise', 3, r.wide, lt, { rir: 1 }),
        ],
      }

    case 'pull':
      // No 1RM lift opens this day: the heavy pull-up is the anchor, on double
      // progression like everything else here.
      return {
        dayName: 'Pull — Back',
        intent: 'Pull heavy, row hard, then give the biceps a real day.',
        items: [
          range('pb_pullup', 'Weighted Pull-Up', 4, r.heavy, lt, { shortDay: true, note: 'The anchor today. Add load when the top of the range is easy. Dead hang to chin over.' }),
          range('pb_row_b', 'Barbell Row', 3, r.heavy, lt, { shortDay: true, step: 10, note: 'Flat back, pull to the sternum.' }),
          range('pb_row_a', 'Chest-Supported Row', 3, r.mid, lt, { note: 'Chest stays down. No body english.' }),
          range('pb_pulldown', 'Lat Pulldown', 3, r.mid, lt, { note: 'Wider grip than the rows — different job.' }),
          range('pb_curl_a', 'EZ-Bar Curl', 3, r.mid, lt),
          range('pb_curl_c', 'Incline DB Curl', 3, r.wide, lt, { superset: 'pb_ss_g', note: 'Arms hang behind you — the stretch is the point.' }),
          range('pb_curl_b', 'Hammer Curl', 3, r.mid, lt, { superset: 'pb_ss_g' }),
        ],
      }

    case 'shoulders':
      return {
        dayName: 'Shoulders + Hinge',
        intent: 'Press overhead, build the delts, then hamstrings and glutes — and finish with the carry.',
        items: [
          compound('pb_ohp', 'Overhead Press', 'ohp', pos, maxes, adjustments, 'Strict. Glutes tight, no leg drive.'),
          range('pb_lateral_a', 'Lateral Raise', 4, r.wide, lt, { rir: 1, superset: 'pb_ss_f', note: 'Light. Delts do not care what the number is — 2.5s if the rack has them.' }),
          range('pb_reardelt', 'Face Pull', 4, r.wide, lt, { rir: 1, superset: 'pb_ss_f', note: 'Rear delts and the bit of your back that holds posture together.' }),
          range('pb_rdl', 'Romanian Deadlift', 4, r.heavy, lt, { shortDay: true, step: 10, note: 'Hinge, do not squat it. Stretch is the point.' }),
          range('pb_legcurl_b', 'Lying Leg Curl', 3, r.mid, lt),
          range('pb_hipthrust', 'Hip Thrust', 3, r.mid, lt, { step: 10, note: 'Chin tucked, ribs down, pause at the top.' }),
          { kind: 'plyo', slot: 'pb_carry', name: 'Farmer Carry', sets: 3, reps: 1,
            note: '40yd per trip, heavy. Grip is the event — walk tall, ribs down, no leaning.' },
        ],
      }
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
  if (pos.isTest) return testDay(dayNumber, maxes, adjustments, opts?.loadTargets ?? {})

  const lt = opts?.loadTargets ?? {}

  // Tue and Thu are the easy days, and stay easy. Sunday is not rendered at
  // all (daysPerWeek 6) — the week genuinely ends on Saturday.
  if (dayNumber === 2 || dayNumber === 4) {
    return {
      dayNumber, dayName: 'Dad Miles', dayType: 'outside',
      sessionIntent: 'Easy aerobic work between lifting days. Keep it conversational.',
      items: [dadMiles(pos)],
    }
  }

  const sess = SESSION_BY_DAY[dayNumber]
  if (!sess) return { dayNumber, dayName: 'Rest', dayType: 'rest', sessionIntent: 'Off. Growth happens here.', items: [] }
  const built = session(sess, pos, maxes, adjustments, lt)
  let items = built.items
  let intent = built.intent
  const dayName = built.dayName

  if (pos.isDeload) {
    // Primers and the carry come out entirely — a deload is not the week to
    // jump or to walk 120 yards under heavy dumbbells.
    items = deloadify(items.filter(i => i.kind !== 'plyo'), maxes)
    intent = 'Deload — same movements, half the work. Leave feeling better than you arrived.'
  }

  return { dayNumber, dayName, dayType: 'gym', sessionIntent: intent, items }
}

export const dadBuilt: ProgramConfig = {
  slug: 'dad-built',
  name: 'Dad Built',
  tagline: 'powerbuilding · athletic hypertrophy',
  description:
    'Built for the dad who wants to look like he lifts and still move like an athlete. Four gym days: push Monday, legs Wednesday, pull Friday, shoulders and hinge Saturday, with easy dad miles on Tuesday and Thursday and Sunday fully off. Bench, squat and press days open with one heavy top-set wave off a tested 1RM; pull day opens with heavy weighted pull-ups. Then volume in rep ranges that actually progresses week to week: hold the weight until every set clears the top of the range, then add load. 13-week macro, deload week 12, rep-max test week 13.',
  daysPerWeek: 6,
  gymDayNumbers: [1, 3, 5, 6],
  macroWeeks: MACRO_WEEKS,
  requiredMaxes: [
    { key: 'back_squat', label: 'Back Squat', hint: 'Best recent single (lbs)' },
    { key: 'bench', label: 'Bench Press', hint: 'Best recent single (lbs)' },
    { key: 'ohp', label: 'Overhead Press', hint: 'Strict press single — estimate: best 5×5 × 1.15' },
  ],
  buildDay,
}

export const DAD_BUILT_BLOCK_BUDGET = BLOCK_BUDGET
