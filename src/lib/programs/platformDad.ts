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
//   · squat exactly once a week, to a box, moderate
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
//   W13         mock meet: three snatch and three clean & jerk attempts
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
}

const same = (n: string): [string, string, string, string] => [n, n, n, n]
/** Two movements, two weeks each: technique rotates every fortnight (FOR-349). */
const ROTATION_CLIMB = [5, 7.5, 7.5, 10] as const
const pairs = (a: string, b: string): [string, string, string, string] => [a, a, b, b]

const POWER_NOTE = 'Catch it above parallel and stand it up. A lift that drops into a full squat is a miss. Knee above 3/10 today: take 10% off.'
const BOX_NOTE = 'Box at parallel or a touch above. Sit back, pause a beat without relaxing, stand up. Knee above 3/10 today: take 10% off or swap for a belt squat.'

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
  pd_snatch_pull: {
    maxKey: 'snatch',
    mesos: {
      1: { names: same('Halting Snatch Deadlift + Snatch Pull'), sets: 4, reps: 2, pctStart: 85, pctStep: 2,
        note: 'Deadlift to the knee, stop two seconds with the shoulders over the bar, then finish the pull. Then one full snatch pull. One rep is both.' },
      2: { rotation: true, names: pairs('Snatch Segment Pull', 'Snatch Pull, Slowly Lowered'), sets: 4, reps: 2, pctStart: 98, pctStep: 2,
        pctOffset: [-5, -5, 0, 0],
        note: 'Segment pull: pause one second just off the floor, at the knee and at mid-thigh, then finish. Slowly lowered: three seconds back to the floor.' },
      3: { names: same('Snatch Pull'), sets: 3, reps: 2, pctStart: 100, pctStep: 2 },
    },
  },
  // Friday — the week's only squat, to a box (FOR-354). Moderate on purpose.
  // A new slot id: the old back squat logs must not carry into a box squat.
  pd_box_squat: {
    maxKey: 'back_squat', shortDay: true, rpeByChart: 1,
    mesos: {
      1: { names: same('Box Squat'), sets: 4, reps: 5, pctStart: 62, pctStep: 2, note: BOX_NOTE },
      2: { names: same('Box Squat'), sets: 4, reps: 4, pctStart: 68, pctStep: 2, note: BOX_NOTE },
      3: { names: same('Box Squat'), sets: 4, reps: 3, pctStart: 72, pctStep: 2, note: BOX_NOTE },
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
  pd_jerk: {
    maxKey: 'clean_jerk',
    mesos: {
      1: { rotation: true, names: pairs('Pause Split Jerk', 'Split Jerk Behind the Neck'), sets: 4, reps: 2, pctStart: 75, pctStep: 2,
        note: 'Weeks 1-2: off the rack, pause two seconds at the bottom of the dip, then drive and split. Weeks 3-4: from behind the neck, straight dip, punch under.' },
      2: { rotation: true, names: pairs('Jerk with Paused Dip', 'Jerk from Rack'), sets: 4, reps: 2, pctStart: 78, pctStep: 2,
        note: 'Weeks 5-6: off the rack, hold the bottom of the dip for two seconds, then drive. Hold the last rep overhead for three seconds. Weeks 7-8: off the rack, straight dip, punch under.' },
      3: { names: same('Jerk from Rack'), sets: 3, reps: 1, pctStart: 85, pctStep: 2,
        note: 'Off the rack, straight dip, punch under.' },
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
  const at = (start: number, step: number) => Math.round((start + climb(step) + off + adj) * 2) / 2
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
 *   · ONE squat day, to a box, moderate
 *   · legs otherwise from the hips: pulls, RDL, hip thrust, sled
 *   · a full upper day, and two low-impact conditioning pieces
 */
type Session = 'power_snatch' | 'upper' | 'legs' | 'power_cj'
const SESSION_BY_DAY: Record<number, Session> = {
  1: 'power_snatch', // Mon — power snatch, snatch pull, hinge, delts
  3: 'upper',        // Wed — strict press, upper body
  5: 'legs',         // Fri — box squat, push press, hips, sled
  6: 'power_cj',     // Sat — power clean & jerk, jerk, shoulders, engine
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
        dayName: 'Power Snatch + Hinge',
        intent: 'Power snatch while you are fresh, pull heavy, then hamstrings, low back and delts. No squatting today.',
        items: [
          pct('pd_hang_power_snatch', pos, maxes, adj),
          pct('pd_snatch_pull', pos, maxes, adj),
          range('pd_rdl', 'Romanian Deadlift', 3, r.heavy, lt, { step: 10, note: 'Hinge, do not squat it. Easy on the knees, hard on the hamstrings.' }),
          range('pd_legcurl', 'Lying Leg Curl', 3, r.mid, lt, { note: 'Hamstrings protect the knee. Slow on the way down.' }),
          range('pd_back_ext', 'Back Extension', 3, r.mid, lt, { note: 'Hips on the pad, round down and squeeze the glutes to come up. Hold a plate once the top of the range is easy.' }),
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
        dayName: 'Box Squat + Sled',
        intent: 'The week\'s one squat, to a box and moderate. Push press, hips and back, then the sled.',
        items: [
          pct('pd_box_squat', pos, maxes, adj),
          pct('pd_push_press_pct', pos, maxes, adj),
          range('pd_hip_thrust', 'Barbell Hip Thrust', 3, r.heavy, lt, { step: 10, note: 'Shoulders on a bench, chin tucked, drive through the heels and pause a beat at the top.' }),
          range('pd_row', 'Chest-Supported Row', 3, r.mid, lt, { note: 'Chest stays down. No body english.' }),
          { kind: 'metcon', slot: 'pd_sled', ...pick(SLED_POOL) },
        ],
      }
    case 'power_cj':
      return {
        dayName: 'Power Clean & Jerk + Engine',
        intent: 'Climb to a heavy power clean & jerk, jerk from the rack, build the shoulders, then a short piece on the bike or rower.',
        items: [
          pct('pd_power_cj', pos, maxes, adj),
          pct('pd_jerk', pos, maxes, adj),
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
function taper(items: Prescription[], maxes: Record<string, number>, isOpenerDay: boolean): Prescription[] {
  // Conditioning comes out of a taper week entirely: leave fresh.
  return items.filter((i) => i.kind !== 'metcon').map((i) => {
    if (i.kind !== 'lift') return i
    if (i.percent != null) {
      if (isOpenerDay && i.slot === 'pd_power_cj') {
        const setPlan = [80, 85, 88].map((p) => ({ reps: 1, percent: p, targetWeightLbs: resolveWeight(p, i.maxKey, maxes) }))
        return {
          ...i, name: 'Clean & Jerk — Openers',
          sets: 3, reps: 1, percent: 80, setPlan, targetRpe: 7,
          targetWeightLbs: setPlan[0].targetWeightLbs, appliedAdjustmentPct: undefined,
          note: 'Practise the opener: the last single is what you would open with next week. Easy and fast.',
        }
      }
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
    'Your best made snatch and clean & jerk are your new maxes',
    'Enter them in your maxes, with any squat or press you tested',
    'The next block computes from them the moment you do',
  ],
}

/**
 * Week 13: a mock meet on the last session, light technique before it.
 * Attempts are a percent of the CURRENT max: 90 / 95 / 100, and the third can
 * be a PR if the first two moved fast. Six attempts, like the platform.
 */
function testDay(dayNumber: number, maxes: Record<string, number>): DayPlan {
  const lastDay = Math.max(...Object.keys(SESSION_BY_DAY).map(Number))
  const attempts = (slot: string, name: string, maxKey: string): LiftPrescription => {
    const setPlan = [90, 95, 100].map((p) => ({ reps: 1, percent: p, targetWeightLbs: resolveWeight(p, maxKey, maxes) }))
    return {
      kind: 'lift', slot, name, maxKey, sets: 3, reps: 1, percent: 90, setPlan,
      targetWeightLbs: setPlan[0].targetWeightLbs,
      note: 'Three attempts, two to three minutes apart. Third attempt: take a PR if the second moved fast, or repeat it.',
    }
  }
  if (dayNumber === lastDay) {
    return {
      dayNumber, dayName: 'MOCK MEET', dayType: 'test',
      sessionIntent: 'Warm up like it is meet day. Three snatches, then three clean & jerks.',
      items: [
        attempts('test_snatch', 'Snatch — Attempts', 'snatch'),
        attempts('test_cj', 'Clean & Jerk — Attempts', 'clean_jerk'),
        WRAP,
      ],
    }
  }
  const sess = SESSION_BY_DAY[dayNumber]
  if (!sess) return { dayNumber, dayName: 'Rest', dayType: 'rest', sessionIntent: 'Off.', items: [] }
  // The other days of meet week: one classic lift, light, and go home.
  const light = (slot: string, name: string, maxKey: string): LiftPrescription => ({
    kind: 'lift', slot, name, maxKey, sets: 3, reps: 1, percent: 70,
    targetWeightLbs: resolveWeight(70, maxKey, maxes), targetRpe: 5,
    note: 'Meet week. Fast singles, nothing heavy.',
  })
  const byDay: Record<Session, LiftPrescription[]> = {
    power_snatch: [light('test_sn_light', 'Snatch', 'snatch')],
    upper: [],
    legs: [light('test_cj_light', 'Clean & Jerk', 'clean_jerk')],
    power_cj: [],
  }
  return {
    dayNumber, dayName: 'Meet Week — Light', dayType: 'gym',
    sessionIntent: 'Stay sharp for the mock meet. Three fast singles and leave.',
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
    const isTaperWeek = pos.weekInMacro === MACRO_WEEKS - 1
    return {
      dayNumber, dayName: built.dayName, dayType: 'gym',
      sessionIntent: isTaperWeek && sess === 'power_cj'
        ? 'Taper. Practise your openers, then two easy sets of everything else.'
        : 'Taper — same movements, light. Leave feeling better than you arrived.',
      items: taper(built.items, maxes, isTaperWeek && sess === 'power_cj'),
    }
  }
  return { dayNumber, dayName: built.dayName, dayType: 'gym', sessionIntent: built.intent, items: built.items }
}

export const platformDad: ProgramConfig = {
  slug: 'platform-dad',
  name: 'Platform Dad',
  tagline: 'weightlifting · bodybuilding',
  description:
    'Power snatch and power clean & jerk twice a week, one box squat day, and bodybuilding that leans on the shoulders, built for cranky knees. Monday power snatch and hinge, Wednesday strict press and upper body, Friday box squat, hips and sled, Saturday power clean & jerk, jerk and a short bike or row piece. No jumps or sprints. Build, heavy and peak blocks, a taper week, then a mock meet in week 13.',
  daysPerWeek: 4,
  gymDayNumbers: [1, 3, 5, 6],
  macroWeeks: MACRO_WEEKS,
  // Andrew's own program, 2026-10-31: in the app, off the public site.
  listed: false,
  requiredMaxes: [
    { key: 'snatch', label: 'Snatch', hint: 'Best full snatch single' },
    { key: 'clean_jerk', label: 'Clean & Jerk', hint: 'Best clean & jerk single' },
    { key: 'back_squat', label: 'Back Squat', hint: 'Best recent single (lbs)' },
    { key: 'ohp', label: 'Overhead Press', hint: 'Strict press single' },
  ],
  buildDay,
}
