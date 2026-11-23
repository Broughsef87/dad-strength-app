import { MAX_ADJ } from './autoreg'
import { targetRpeFor } from './rpeChart'
import {
  BuildDayOpts,
  DayPlan,
  LiftPrescription,
  MetconPrescription,
  OutsideSession,
  ProgramConfig,
  Prescription,
  resolveWeight,
} from './types'

// ═══════════════════════════════════════════════════════════════════════════════
// PLATFORM DAD — weightlifting plus bodybuilding, built around cranky knees
//
// Andrew, 2026-10-31: jumping and sprinting are too rough on his knees for a
// while. He wants four days a week of snatch, clean & jerk and bodybuilding,
// with a possible meet after about three months. His rules:
//
//   · (FOR-354, 2026-11-23, replacing his 10-31 rules for the lifts and squats:)
//     the Olympic lifts on two days a week, power versions caught above parallel
//   · squat twice a week, one back and one front, both moderate
//   · sessions no longer than Power Dad's (6 blocks)
//   · bodybuilding leans toward the shoulders: overhead strength is the weak
//     point (strict press well behind the squat)
//   · Mon / Wed / Fri / Sat by default, but the week moves. The days are a
//     sequence; skip and move-day already work on any day number.
//
// NO jumps, bounds, sprints or box work anywhere in this file, so the registry
// never adds the ballistic prep (index.ts withPrep).
//
// 13-week macro, the same shape every program uses (deload = week 12, test =
// week 13), because the week screen, the block bar and autoreg all key off it:
//   M1 (W1-4)   build:  triples, doubles at 75%+, heavy singles 85-92%
//   M2 (W5-8)   heavy:  doubles and singles at 85-95%. Meet decision after W8.
//   M3 (W9-11)  peak:   singles climbing to 95-97%
//
// Andrew's rule (FOR-335): on the full classic lifts, no single below 85% and
// no double below 75%. Power and positional singles keyed off the full max
// (Friday's M3 Power Snatch) are exempt: 85% of the snatch is over a power
// snatch max.
//   W12         taper:  same movements, light, openers on Saturday
//   W13         test: three power clean attempts (FOR-356)
//
// Two progression systems, as in Dad Built: the classic lifts, squats and the
// strict press and the push press are PERCENT-based off tested maxes; the bodybuilding work is
// RANGE-based and climbs by double progression from what was logged.
//
// Never more than 4 sets of anything (Andrew, 2026-08-27; set-ceiling.mjs).
// ═══════════════════════════════════════════════════════════════════════════════

const MACRO_WEEKS = 13
export const PLATFORM_DAD_BLOCK_BUDGET = 6

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

const MESO_TARGET_RPE: Record<number, number> = { 1: 7, 2: 8, 3: 9 }

// ── Percent slots ───────────────────────────────────────────────────────────
// One entry per meso. `names` is indexed by week in meso, so a meso can rotate
// a variation without a second table. pct = pctStart + pctStep * (week - 1).
interface PctMeso {
  names: [string, string, string, string]
  sets: number
  reps: number
  pctStart: number
  pctStep: number
  /** One entry per set when the sets differ (a climb to a heavy single). */
  sequence?: Array<{ reps: number; pctStart: number; pctStep: number }>
  note?: string
  /**
   * Per week, points off the meso's percent. A variation that runs lighter than
   * the full lift (no jump, segment, three positions) takes 5 off, so a week
   * that swaps movement does not swap difficulty too (FOR-349).
   */
  pctOffset?: [number, number, number, number]
  /**
   * Two movements, two weeks each (FOR-349). Andrew, 2026-11-15: "if we change
   * exercises every two weeks we just need to probably start at a bit higher
   * intensity". A rotating meso does not climb from pctStart by pctStep; it
   * starts 5 points higher, climbs 2.5 a week, and the second movement starts
   * where the first one finished instead of back at the bottom:
   *   start +5, +7.5 | +7.5, +10
   * pctOffset (the variation's own discount) still applies on top.
   */
  rotation?: boolean
  /** Per week, a light primer named on the first lift's card, in place of warm-up sets. */
  primer?: [string, string, string, string]
}
type PctSlot = {
  maxKey: string; mesos: Record<1 | 2 | 3, PctMeso>; shortDay?: boolean
  /**
   * Strength work: the target RPE is read off the %-by-reps chart (rpeChart.ts)
   * instead of the meso's flat number. The value is this lift's own max as a
   * share of `maxKey` (1 when the max IS the lift's). The classic lifts are
   * rated by lights and the pulls run past 100%, so they keep the meso number.
   */
  rpeByChart?: number
  /** Chart calibration for a lift that runs out of reps sooner (rpeChart.ts `repScale`). */
  rpeRepScale?: number
  /** A hard top, applied AFTER autoreg: no adjustment can push the lift past it (FOR-356). */
  pctCeiling?: number
}

const same = (n: string): [string, string, string, string] => [n, n, n, n]
/** Two movements, two weeks each: technique rotates every fortnight (FOR-349). */
const ROTATION_CLIMB = [5, 7.5, 7.5, 10] as const
const pairs = (a: string, b: string): [string, string, string, string] => [a, a, b, b]

const POWER_NOTE = 'Catch it above parallel and stand it up. A lift that drops into a full squat is a miss. Knee above 3/10 today: take 10% off.'
const SQUAT_NOTE = 'Moderate on purpose: smooth reps, nothing grinds. Knee above 3/10 today: take 10% off or squat to a box at parallel.'

const SLOTS: Record<string, PctSlot> = {
  // Monday — the power snatch (FOR-354). Caught above parallel: no full squat
  // catch anywhere in the week. Two-week rotations as before (FOR-349).
  pd_hang_power_snatch: {
    maxKey: 'snatch', shortDay: true,
    mesos: {
      1: { rotation: true, names: pairs('Hang Power Snatch, Above Knee', 'Hang Power Snatch, Below Knee'), sets: 4, reps: 2, pctStart: 57, pctStep: 2,
        note: POWER_NOTE, primer: pairs('Snatch High Pull', 'Muscle Snatch') },
      2: { rotation: true, names: pairs('Power Snatch', 'Pause Power Snatch, At Knee'), sets: 4, reps: 2, pctStart: 63, pctStep: 2,
        note: POWER_NOTE, primer: pairs('Muscle Snatch', 'Snatch High Pull') },
      3: { names: same('Power Snatch'), sets: 4, reps: 1, pctStart: 74, pctStep: 2, note: POWER_NOTE },
    },
  },
  // The two squats (FOR-356). Andrew, 2026-11-23: "one back squat and one front
  // squat day. Let's just have both be fairly moderate. Front squats actually
  // help my knee a bit." Same slot ids as before, so last week's logs still
  // carry; a ceiling applied after autoreg keeps both moderate.
  pd_back_squat: {
    maxKey: 'back_squat', shortDay: true, rpeByChart: 1, pctCeiling: 76,
    mesos: {
      1: { names: same('Back Squat'), sets: 4, reps: 5, pctStart: 66, pctStep: 2, note: SQUAT_NOTE },
      2: { names: same('Back Squat'), sets: 4, reps: 4, pctStart: 70, pctStep: 2, note: SQUAT_NOTE },
      3: { names: same('Back Squat'), sets: 4, reps: 3, pctStart: 72, pctStep: 2, note: SQUAT_NOTE },
    },
  },
  pd_front_squat: {
    maxKey: 'front_squat', shortDay: true, rpeByChart: 1, pctCeiling: 76,
    mesos: {
      1: { names: same('Front Squat'), sets: 4, reps: 4, pctStart: 66, pctStep: 2, note: SQUAT_NOTE },
      2: { names: same('Front Squat'), sets: 4, reps: 3, pctStart: 70, pctStep: 2, note: SQUAT_NOTE },
      3: { names: same('Front Squat'), sets: 4, reps: 3, pctStart: 72, pctStep: 2, note: SQUAT_NOTE },
    },
  },

  // Wednesday — the strict press
  pd_ohp: {
    maxKey: 'ohp', shortDay: true, rpeByChart: 1, rpeRepScale: 0.85,
    mesos: {
      1: { names: same('Strict Press'), sets: 4, reps: 6, pctStart: 70, pctStep: 2,
        note: 'The priority lift of the program. Glutes tight, no leg drive.' },
      2: { names: same('Strict Press'), sets: 4, reps: 4, pctStart: 78, pctStep: 2,
        note: 'The priority lift of the program. Glutes tight, no leg drive.' },
      3: { names: same('Strict Press'), sets: 4, reps: 3, pctStart: 84, pctStep: 2,
        note: 'The priority lift of the program. Glutes tight, no leg drive.' },
    },
  },

  // Saturday — the power clean & jerk, climbing to a heavy single, and the jerk
  pd_power_cj: {
    maxKey: 'clean_jerk', shortDay: true,
    mesos: {
      1: { names: same('Power Clean & Jerk — Heavy Single'), sets: 3, reps: 1, pctStart: 70, pctStep: 0.5,
        sequence: [{ reps: 1, pctStart: 70, pctStep: 0.5 }, { reps: 1, pctStart: 73, pctStep: 0.5 }, { reps: 1, pctStart: 76, pctStep: 0.5 }],
        note: 'Climb to the day\'s heavy single. ' + POWER_NOTE },
      2: { names: same('Power Clean & Jerk — Heavy Single'), sets: 3, reps: 1, pctStart: 74, pctStep: 1,
        sequence: [{ reps: 1, pctStart: 74, pctStep: 1 }, { reps: 1, pctStart: 77, pctStep: 1 }, { reps: 1, pctStart: 80, pctStep: 1 }],
        note: 'Climb to the day\'s heavy single. ' + POWER_NOTE },
      3: { names: same('Power Clean & Jerk — Heavy Single'), sets: 3, reps: 1, pctStart: 77, pctStep: 1,
        sequence: [{ reps: 1, pctStart: 77, pctStep: 1 }, { reps: 1, pctStart: 80, pctStep: 1 }, { reps: 1, pctStart: 83, pctStep: 1 }],
        note: 'Climb to the day\'s heavy single. ' + POWER_NOTE },
    },
  },
  // Andrew, 2026-11-04: push press is strength work, so it goes with the
  // squat, early in the session, as percent work off the clean & jerk (the
  // same max Hybrid Power keys it to). Lower reps than the old 6-12 range.
  // A NEW slot id, not the old range slot's: autoreg matches last week's logs
  // to last week's plan by slot, and the old id would read a logged 3x8 at
  // 115 against this table's 60% as "17% light" and cut the next week by the
  // full 8 points (Codex r1, PR #87). A new id starts the percent work clean.
  // rpeByChart 0.9: a push press max runs about 90% of the clean & jerk, so
  // 60% of the C&J is about 67% of what he can push press (FOR-344).
  pd_push_press_pct: {
    maxKey: 'clean_jerk', rpeByChart: 0.9,
    mesos: {
      1: { names: same('Push Press'), sets: 4, reps: 5, pctStart: 60, pctStep: 2,
        note: 'Out of the front rack. Short dip, drive with the legs, finish with the arms.' },
      2: { names: same('Push Press'), sets: 4, reps: 4, pctStart: 66, pctStep: 2,
        note: 'Out of the front rack. Short dip, drive with the legs, finish with the arms.' },
      3: { names: same('Push Press'), sets: 4, reps: 3, pctStart: 72, pctStep: 2,
        note: 'Out of the front rack. Short dip, drive with the legs, finish with the arms.' },
    },
  },
}

function pct(
  slot: string, pos: MacroPos, maxes: Record<string, number>, adjustments: Record<string, number>,
): LiftPrescription {
  const s = SLOTS[slot]
  const def = s.mesos[pos.meso as 1 | 2 | 3]
  if (def.sequence && def.sequence.length !== def.sets) {
    throw new Error(`${slot}: sets is ${def.sets} and the sequence holds ${def.sequence.length}`)
  }
  const adj = Math.max(-MAX_ADJ, Math.min(MAX_ADJ, adjustments[slot] ?? 0))
  const off = def.pctOffset?.[pos.weekInMeso - 1] ?? 0
  const climb = (step: number) => def.rotation ? ROTATION_CLIMB[pos.weekInMeso - 1] : step * (pos.weekInMeso - 1)
  const at = (start: number, step: number) => {
    const raw = Math.round((start + climb(step) + off + adj) * 2) / 2
    return s.pctCeiling != null ? Math.min(s.pctCeiling, raw) : raw
  }
  const setPlan = def.sequence?.map((st) => {
    const p = at(st.pctStart, st.pctStep)
    return { reps: st.reps, percent: p, targetWeightLbs: resolveWeight(p, s.maxKey, maxes) }
  })
  const percent = setPlan ? setPlan[0].percent : at(def.pctStart, def.pctStep)
  return {
    kind: 'lift', slot,
    name: def.names[pos.weekInMeso - 1],
    sets: def.sets,
    reps: setPlan ? setPlan[0].reps : def.reps,
    percent,
    maxKey: s.maxKey,
    targetWeightLbs: resolveWeight(percent, s.maxKey, maxes),
    setPlan,
    targetRpe: s.rpeByChart
      ? targetRpeFor(percent / s.rpeByChart, setPlan ? setPlan[0].reps : def.reps, s.rpeRepScale)
      : MESO_TARGET_RPE[pos.meso] ?? 8,
    appliedAdjustmentPct: adj !== 0 ? adj : undefined,
    note: [def.primer ? `Primer: ${def.primer[pos.weekInMeso - 1]} (3x3, bar or light, in place of warm-up sets).` : '', def.note ?? '']
      .filter(Boolean).join(' ') || undefined,
    shortDay: s.shortDay,
  }
}

// ── Range slots (bodybuilding) ──────────────────────────────────────────────
const RANGE_BY_MESO: Record<number, { wide: [number, number]; mid: [number, number]; heavy: [number, number] }> = {
  1: { wide: [12, 20], mid: [10, 15], heavy: [8, 12] },
  2: { wide: [12, 18], mid: [10, 12], heavy: [6, 10] },
  3: { wide: [10, 15], mid: [8, 12], heavy: [6, 8] },
}

function range(
  slot: string, name: string, sets: number, window: [number, number],
  lt: Record<string, number>, opts?: { rir?: number; step?: number; note?: string; superset?: string },
): LiftPrescription {
  const suggested = lt[slot]
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

/**
 * Which session each gym day runs. A declared table so the week is one line to
 * change (FOR-354, Andrew 2026-11-23: "less emphasis on heavy squatting/olympic
 * lifts ... I just can't do it all at 40"). The balanced mix he picked:
 *   · the Olympic lifts on TWO days, power versions only (caught above parallel)
 *   · one back squat and one front squat day, both moderate (capped at 76%)
 *   · bench twice: heavy Monday, volume Saturday
 *   · no separate pulls or jerks: the time went to bench (FOR-356)
 *   · legs otherwise from the hips: RDL, hip thrust, back extension, sled
 *   · a full upper day, and two low-impact conditioning pieces
 */
type Session = 'power_snatch' | 'upper' | 'legs' | 'power_cj'
const SESSION_BY_DAY: Record<number, Session> = {
  1: 'power_snatch', // Mon — power snatch, back squat, heavy bench, hamstrings
  3: 'upper',        // Wed — strict press, upper body
  5: 'legs',         // Fri — front squat, push press, hips, sled
  6: 'power_cj',     // Sat — power clean & jerk, volume bench, shoulders, engine
}

/**
 * Low-impact conditioning: bike, rower and sled only. No burpees, step-overs
 * or anything that lands. Indexed by week so the piece rotates.
 */
const SLED_POOL: Array<Omit<MetconPrescription, 'kind' | 'slot'>> = [
  { name: 'Sled Push + Drag', format: 'for_time', timeCapMinutes: 10, description: '5 rounds:\n30yd sled push (heavy, walking)\n30yd backward sled drag\nrest 60s between rounds' },
  { name: 'Sled + Row', format: 'for_time', timeCapMinutes: 12, description: '4 rounds:\n30yd sled push (moderate)\n250m row\nrest 60s between rounds' },
  { name: 'Sled Drag Intervals', format: 'emom', timeCapMinutes: 10, description: 'EMOM 10\nodd: 20yd backward sled drag\neven: 20yd forward sled drag' },
]
const ENGINE_POOL: Array<Omit<MetconPrescription, 'kind' | 'slot'>> = [
  { name: 'Bike Intervals', format: 'emom', timeCapMinutes: 12, description: 'EMOM 12 (alternating)\nmin 1: 30s hard on the bike\nmin 2: easy spin' },
  { name: 'Row Pieces', format: 'for_time', timeCapMinutes: 12, description: '4 rounds:\n300m row, hard but even\nrest 90s between rounds' },
  { name: 'Bike + Row Ladder', format: 'amrap', timeCapMinutes: 10, description: 'AMRAP 10\n10 cal bike\n10 cal row' },
]

function session(
  sess: Session, pos: MacroPos, weekNumber: number, maxes: Record<string, number>,
  adj: Record<string, number>, lt: Record<string, number>,
): { dayName: string; intent: string; items: Prescription[] } {
  const r = RANGE_BY_MESO[pos.meso]
  const pick = <T,>(pool: T[]) => pool[(weekNumber - 1) % pool.length]
  switch (sess) {
    case 'power_snatch':
      return {
        dayName: 'Power Snatch + Back Squat',
        intent: 'Power snatch while you are fresh, a moderate back squat, the week\'s heavy bench, then hamstrings and delts.',
        items: [
          pct('pd_hang_power_snatch', pos, maxes, adj),
          pct('pd_back_squat', pos, maxes, adj),
          range('pd_bench', 'Bench Press', 4, r.heavy, lt, { step: 5, note: 'The week\'s heavy bench. Pause each rep on the chest. Add 5 lb once every set clears the top of the range.' }),
          range('pd_rdl', 'Romanian Deadlift', 3, r.heavy, lt, { step: 10, note: 'Hinge, do not squat it. Easy on the knees, hard on the hamstrings.' }),
          range('pd_legcurl', 'Lying Leg Curl', 3, r.mid, lt, { note: 'Hamstrings protect the knee. Slow on the way down.' }),
          range('pd_lateral_a', 'Lateral Raise', 4, r.wide, lt, { rir: 1, note: 'Light and strict. Shoulders are the priority this block.' }),
        ],
      }
    case 'upper':
      return {
        dayName: 'Press + Upper',
        intent: 'The strict press first: the lift this program exists to bring up. Then a full upper-body day.',
        items: [
          pct('pd_ohp', pos, maxes, adj),
          range('pd_pullup', 'Weighted Pull-Up', 4, r.heavy, lt, { note: 'Dead hang to chin over. Add load when the top of the range is easy.' }),
          range('pd_incline', 'Incline DB Press', 3, r.mid, lt),
          range('pd_facepull', 'Face Pull', 3, r.wide, lt, { rir: 1, note: 'Rear delts and the upper back that holds a jerk overhead.' }),
          range('pd_oh_triceps', 'Overhead Triceps Extension', 3, r.mid, lt, { rir: 1, superset: 'pd_ss_arms', note: 'Triceps lock out the jerk. The stretch overhead is the point.' }),
          range('pd_curl', 'EZ-Bar Curl', 3, r.mid, lt, { superset: 'pd_ss_arms' }),
        ],
      }
    case 'legs':
      return {
        dayName: 'Front Squat + Sled',
        intent: 'A moderate front squat, the push press, hips and back, then the sled.',
        items: [
          pct('pd_front_squat', pos, maxes, adj),
          pct('pd_push_press_pct', pos, maxes, adj),
          range('pd_hip_thrust', 'Barbell Hip Thrust', 3, r.heavy, lt, { step: 10, note: 'Shoulders on a bench, chin tucked, drive through the heels and pause a beat at the top.' }),
          range('pd_row', 'Chest-Supported Row', 3, r.mid, lt, { note: 'Chest stays down. No body english.' }),
          range('pd_back_ext', 'Back Extension', 3, r.mid, lt, { note: 'Hips on the pad, round down and squeeze the glutes to come up. Hold a plate once the top of the range is easy.' }),
          { kind: 'metcon', slot: 'pd_sled', ...pick(SLED_POOL) },
        ],
      }
    case 'power_cj':
      return {
        dayName: 'Power Clean & Jerk + Bench',
        intent: 'Climb to a heavy power clean & jerk, the week\'s volume bench, shoulders, then a short piece on the bike or rower.',
        items: [
          pct('pd_power_cj', pos, maxes, adj),
          range('pd_bench_vol', 'Close-Grip Bench Press', 3, r.mid, lt, { step: 5, note: 'Hands just inside shoulder width. Volume day: smooth reps, two in the tank.' }),
          range('pd_zpress', 'Z-Press', 3, r.heavy, lt, { note: 'Seated on the floor, no back support. Strict overhead strength, nothing to cheat with.' }),
          range('pd_lateral_c', 'Cable Lateral Raise', 3, r.wide, lt, { rir: 1, superset: 'pd_ss_sat' }),
          range('pd_triceps', 'Rope Pushdown', 3, r.mid, lt, { rir: 1, superset: 'pd_ss_sat' }),
          { kind: 'metcon', slot: 'pd_engine', ...pick(ENGINE_POOL) },
        ],
      }
  }
}

// Taper (week 12, or a fatigue deload): same movements, light. Classic lifts
// and squats drop to 75% for two or three crisp sets; range work to two sets.
// No full-lift openers in the taper (FOR-356, Codex r1): the power clean & jerk
// tapers like everything else, so week 12 has no full catch in it.
function taper(items: Prescription[], maxes: Record<string, number>): Prescription[] {
  // Conditioning comes out of a taper week entirely: leave fresh.
  return items.filter((i) => i.kind !== 'metcon').map((i) => {
    if (i.kind !== 'lift') return i
    if (i.percent != null) {
      const { setPlan: _drop, ...rest } = i
      // A pull lives above the lift's max; 75% of a snatch is not a pull.
      // Never heavier than the slot's own load this week (FOR-331): a light
      // M1 slot at 70% must not climb to the taper's 75.
      // A climb is as heavy as its top set, so its taper comes off that (FOR-354):
      // a power climb opening at 70% would otherwise 'taper' to the same 70%.
      const top = i.setPlan ? Math.max(...i.setPlan.map((st) => st.percent ?? 0)) - 10 : i.percent
      const tp = Math.min(/pull/.test(i.slot) ? 90 : 75, top)
      return {
        ...rest, percent: tp, sets: Math.min(3, i.sets), reps: Math.min(2, i.reps), targetRpe: 6,
        targetWeightLbs: resolveWeight(tp, i.maxKey, maxes), appliedAdjustmentPct: undefined,
        note: 'Taper — crisp and fast, leave fresh.',
      }
    }
    // Well short of failure means it: 4 in reserve (Codex r1).
    return { ...i, sets: 2, targetRir: 4, note: 'Taper — two easy sets, well short of failure.' }
  })
}

const WRAP: OutsideSession = {
  kind: 'outside', slot: 'pd_wrap', title: 'Update your maxes',
  parts: [
    'Log your best power clean: it is the number this test is for',
    'Enter any squat, press or clean & jerk you tested in your maxes',
    'The next block computes from them the moment you do',
  ],
}

/**
 * Week 13: a power clean test on the last session, light work before it.
 * Andrew, 2026-11-23: "test power clean, we don't need to test snatch."
 * Attempts are a percent of the clean & jerk max, 80 / 85 / 90: a power clean
 * runs well under the full lift, so the third is a PR attempt for most lifters.
 */
function testDay(dayNumber: number, maxes: Record<string, number>): DayPlan {
  const lastDay = Math.max(...Object.keys(SESSION_BY_DAY).map(Number))
  if (dayNumber === lastDay) {
    const setPlan = [80, 85, 90].map((p) => ({ reps: 1, percent: p, targetWeightLbs: resolveWeight(p, 'clean_jerk', maxes) }))
    return {
      dayNumber, dayName: 'POWER CLEAN TEST', dayType: 'test',
      sessionIntent: 'Warm up properly, then three power clean attempts. Catch above parallel or it does not count.',
      items: [
        {
          kind: 'lift', slot: 'test_power_clean', name: 'Power Clean — Attempts', maxKey: 'clean_jerk',
          sets: 3, reps: 1, percent: 80, setPlan, targetWeightLbs: setPlan[0].targetWeightLbs,
          note: 'Three attempts, two to three minutes apart. Third attempt: take a PR if the second moved fast, or repeat it. A catch below parallel is a miss.',
        },
        WRAP,
      ],
    }
  }
  const sess = SESSION_BY_DAY[dayNumber]
  if (!sess) return { dayNumber, dayName: 'Rest', dayType: 'rest', sessionIntent: 'Off.', items: [] }
  // The other days of meet week: one classic lift, light, and go home.
  const light = (slot: string, name: string, maxKey: string): LiftPrescription => ({
    kind: 'lift', slot, name, maxKey, sets: 3, reps: 1, percent: 60,
    targetWeightLbs: resolveWeight(60, maxKey, maxes), targetRpe: 5,
    note: 'Test week. Fast singles, nothing heavy.',
  })
  const byDay: Record<Session, LiftPrescription[]> = {
    power_snatch: [light('test_sn_light', 'Power Snatch', 'snatch')],
    upper: [light('test_ohp_light', 'Strict Press', 'ohp')],
    legs: [light('test_cj_light', 'Power Clean & Jerk', 'clean_jerk')],
    power_cj: [],
  }
  // A session with nothing in it is a rest day, so the week never asks for a
  // completion that has no work behind it (FOR-356, Codex r1).
  if (byDay[sess].length === 0) {
    return { dayNumber, dayName: 'Rest', dayType: 'rest', sessionIntent: 'Off. Fresh for the test.', items: [] }
  }
  return {
    dayNumber, dayName: 'Test Week — Light', dayType: 'gym',
    sessionIntent: 'Stay sharp for Saturday. Three fast singles and leave.',
    items: byDay[sess],
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
  if (pos.isTest) return testDay(dayNumber, maxes)

  const sess = SESSION_BY_DAY[dayNumber]
  if (!sess) {
    return { dayNumber, dayName: 'Rest', dayType: 'rest', sessionIntent: 'Off. Knees and shoulders recover here.', items: [] }
  }
  const built = session(sess, pos, weekNumber, maxes, adjustments, opts?.loadTargets ?? {})
  if (pos.isDeload) {
    return {
      dayNumber, dayName: built.dayName, dayType: 'gym',
      sessionIntent: 'Taper — same movements, light. Leave feeling better than you arrived.',
      items: taper(built.items, maxes),
    }
  }
  return { dayNumber, dayName: built.dayName, dayType: 'gym', sessionIntent: built.intent, items: built.items }
}

export const platformDad: ProgramConfig = {
  slug: 'platform-dad',
  name: 'Platform Dad',
  tagline: 'weightlifting · bodybuilding',
  description:
    'Power snatch and power clean & jerk, a moderate back squat and front squat day, bench twice, and bodybuilding that leans on the shoulders, built for cranky knees. Monday power snatch, back squat and heavy bench, Wednesday strict press and upper body, Friday front squat, hips and sled, Saturday power clean & jerk, volume bench and a short bike or row piece. No jumps or sprints. Build, heavy and peak blocks, a taper week, then a power clean test in week 13.',
  daysPerWeek: 4,
  gymDayNumbers: [1, 3, 5, 6],
  macroWeeks: MACRO_WEEKS,
  // Andrew's own program, 2026-10-31: in the app, off the public site.
  listed: false,
  requiredMaxes: [
    { key: 'snatch', label: 'Snatch', hint: 'Best full snatch single' },
    { key: 'clean_jerk', label: 'Clean & Jerk', hint: 'Best clean & jerk single' },
    { key: 'back_squat', label: 'Back Squat', hint: 'Best recent single (lbs)' },
    { key: 'front_squat', label: 'Front Squat', hint: 'Best recent single (lbs)' },
    { key: 'ohp', label: 'Overhead Press', hint: 'Strict press single' },
  ],
  buildDay,
}
