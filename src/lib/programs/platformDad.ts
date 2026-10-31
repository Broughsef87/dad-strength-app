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

// ═══════════════════════════════════════════════════════════════════════════════
// PLATFORM DAD — weightlifting plus bodybuilding, built around cranky knees
//
// Andrew, 2026-10-31: jumping and sprinting are too rough on his knees for a
// while. He wants four days a week of snatch, clean & jerk and bodybuilding,
// with a possible meet after about three months. His rules:
//
//   · a classic lift (snatch or clean & jerk, full or a variation) EVERY session
//   · squat exactly twice a week: one back squat day, one front squat day
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
//   M1 (W1-4)   build:  triples and doubles at 70-80%, positional variations
//   M2 (W5-8)   heavy:  doubles and singles at 80-90%. Meet decision after W8.
//   M3 (W9-11)  peak:   singles climbing to 92-95%
//   W12         taper:  same movements, light, openers on Saturday
//   W13         mock meet: three snatch and three clean & jerk attempts
//
// Two progression systems, as in Dad Built: the classic lifts, squats and the
// strict press are PERCENT-based off tested maxes; the bodybuilding work is
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
}
type PctSlot = { maxKey: string; mesos: Record<1 | 2 | 3, PctMeso>; shortDay?: boolean }

const same = (n: string): [string, string, string, string] => [n, n, n, n]

const KNEE_NOTE = 'Knee check first: above 3/10 today, catch these in a power position and keep it smooth.'
const SQUAT_KNEE_NOTE = 'Knee above 3/10 today: drop to 60% or squat to a box at parallel.'

const SLOTS: Record<string, PctSlot> = {
  // Monday — the snatch
  pd_snatch: {
    maxKey: 'snatch', shortDay: true,
    mesos: {
      1: { names: same('Snatch'), sets: 4, reps: 3, pctStart: 70, pctStep: 2, note: KNEE_NOTE },
      2: { names: same('Snatch'), sets: 4, reps: 2, pctStart: 80, pctStep: 2, note: KNEE_NOTE },
      3: { names: same('Snatch'), sets: 4, reps: 1, pctStart: 86, pctStep: 2, note: KNEE_NOTE },
    },
  },
  pd_snatch_pull: {
    maxKey: 'snatch',
    mesos: {
      1: { names: same('Snatch Pull'), sets: 4, reps: 3, pctStart: 90, pctStep: 2 },
      2: { names: same('Snatch Pull'), sets: 4, reps: 2, pctStart: 98, pctStep: 2 },
      3: { names: same('Snatch Pull'), sets: 3, reps: 2, pctStart: 100, pctStep: 2 },
    },
  },
  pd_back_squat: {
    maxKey: 'back_squat', shortDay: true,
    mesos: {
      1: { names: same('Back Squat'), sets: 4, reps: 5, pctStart: 68, pctStep: 2, note: SQUAT_KNEE_NOTE },
      2: { names: same('Back Squat'), sets: 4, reps: 3, pctStart: 78, pctStep: 2, note: SQUAT_KNEE_NOTE },
      3: { names: same('Back Squat'), sets: 3, reps: 2, pctStart: 85, pctStep: 2, note: SQUAT_KNEE_NOTE },
    },
  },

  // Wednesday — the clean & jerk, and the strict press
  pd_cj: {
    maxKey: 'clean_jerk', shortDay: true,
    mesos: {
      1: { names: same('Clean + 2 Jerks'), sets: 4, reps: 1, pctStart: 70, pctStep: 2,
        note: 'One clean, then two jerks from the front rack. The jerk needs the reps. ' + KNEE_NOTE },
      2: { names: same('Clean & Jerk'), sets: 4, reps: 1, pctStart: 80, pctStep: 2, note: KNEE_NOTE },
      3: { names: same('Clean & Jerk'), sets: 4, reps: 1, pctStart: 85, pctStep: 2, note: KNEE_NOTE },
    },
  },
  pd_ohp: {
    maxKey: 'ohp', shortDay: true,
    mesos: {
      1: { names: same('Strict Press'), sets: 4, reps: 6, pctStart: 70, pctStep: 2,
        note: 'The priority lift of the program. Glutes tight, no leg drive.' },
      2: { names: same('Strict Press'), sets: 4, reps: 4, pctStart: 78, pctStep: 2,
        note: 'The priority lift of the program. Glutes tight, no leg drive.' },
      3: { names: same('Strict Press'), sets: 4, reps: 3, pctStart: 84, pctStep: 2,
        note: 'The priority lift of the program. Glutes tight, no leg drive.' },
    },
  },

  // Friday — snatch technique, the front squat
  pd_snatch_tech: {
    maxKey: 'snatch', shortDay: true,
    mesos: {
      1: { names: same('Hang Snatch, Above Knee'), sets: 4, reps: 2, pctStart: 70, pctStep: 2,
        note: 'Positions over load. Stay over the bar, finish tall, fast elbows.' },
      2: { names: same('Pause Snatch, At Knee'), sets: 4, reps: 2, pctStart: 72, pctStep: 2,
        note: 'Two-second pause at the knee, shoulders over the bar, then go.' },
      3: { names: same('Power Snatch'), sets: 4, reps: 1, pctStart: 75, pctStep: 2,
        note: 'Light and fast. The speed you take into Saturday.' },
    },
  },
  pd_front_squat: {
    maxKey: 'front_squat', shortDay: true,
    mesos: {
      1: { names: same('Front Squat'), sets: 4, reps: 4, pctStart: 70, pctStep: 2, note: SQUAT_KNEE_NOTE },
      2: { names: same('Front Squat'), sets: 4, reps: 3, pctStart: 78, pctStep: 2, note: SQUAT_KNEE_NOTE },
      3: { names: same('Front Squat'), sets: 3, reps: 2, pctStart: 85, pctStep: 2, note: SQUAT_KNEE_NOTE },
    },
  },

  // Saturday — heavy singles, the jerk
  pd_snatch_heavy: {
    maxKey: 'snatch', shortDay: true,
    mesos: {
      1: { names: same('Snatch — Heavy Single'), sets: 3, reps: 1, pctStart: 74, pctStep: 2,
        sequence: [{ reps: 1, pctStart: 74, pctStep: 2 }, { reps: 1, pctStart: 78, pctStep: 2 }, { reps: 1, pctStart: 82, pctStep: 2 }],
        note: 'Climb to the day\'s heavy single. Make every one; a miss ends the climb. ' + KNEE_NOTE },
      2: { names: same('Snatch — Heavy Single'), sets: 3, reps: 1, pctStart: 80, pctStep: 1.5,
        sequence: [{ reps: 1, pctStart: 80, pctStep: 1.5 }, { reps: 1, pctStart: 84, pctStep: 1.5 }, { reps: 1, pctStart: 88, pctStep: 1.5 }],
        note: 'Climb to the day\'s heavy single. Make every one; a miss ends the climb. ' + KNEE_NOTE },
      3: { names: same('Snatch — Heavy Single'), sets: 3, reps: 1, pctStart: 84, pctStep: 1.5,
        sequence: [{ reps: 1, pctStart: 84, pctStep: 1.5 }, { reps: 1, pctStart: 88, pctStep: 1.5 }, { reps: 1, pctStart: 92, pctStep: 1.5 }],
        note: 'Climb to the day\'s heavy single. Make every one; a miss ends the climb. ' + KNEE_NOTE },
    },
  },
  pd_cj_heavy: {
    maxKey: 'clean_jerk', shortDay: true,
    mesos: {
      1: { names: same('Clean & Jerk — Heavy Single'), sets: 3, reps: 1, pctStart: 74, pctStep: 2,
        sequence: [{ reps: 1, pctStart: 74, pctStep: 2 }, { reps: 1, pctStart: 78, pctStep: 2 }, { reps: 1, pctStart: 82, pctStep: 2 }],
        note: 'Climb to the day\'s heavy single. ' + KNEE_NOTE },
      2: { names: same('Clean & Jerk — Heavy Single'), sets: 3, reps: 1, pctStart: 80, pctStep: 1.5,
        sequence: [{ reps: 1, pctStart: 80, pctStep: 1.5 }, { reps: 1, pctStart: 84, pctStep: 1.5 }, { reps: 1, pctStart: 88, pctStep: 1.5 }],
        note: 'Climb to the day\'s heavy single. ' + KNEE_NOTE },
      3: { names: same('Clean & Jerk — Heavy Single'), sets: 3, reps: 1, pctStart: 84, pctStep: 1.5,
        sequence: [{ reps: 1, pctStart: 84, pctStep: 1.5 }, { reps: 1, pctStart: 88, pctStep: 1.5 }, { reps: 1, pctStart: 92, pctStep: 1.5 }],
        note: 'Climb to the day\'s heavy single. ' + KNEE_NOTE },
    },
  },
  pd_jerk: {
    maxKey: 'clean_jerk',
    mesos: {
      1: { names: same('Jerk from Rack'), sets: 4, reps: 2, pctStart: 70, pctStep: 2,
        note: 'Off the rack, straight dip, punch under. The overhead work that counts on the platform.' },
      2: { names: same('Jerk from Rack'), sets: 4, reps: 2, pctStart: 78, pctStep: 2,
        note: 'Off the rack, straight dip, punch under.' },
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
  const at = (start: number, step: number) => Math.round((start + step * (pos.weekInMeso - 1) + adj) * 2) / 2
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
    targetRpe: MESO_TARGET_RPE[pos.meso] ?? 8,
    appliedAdjustmentPct: adj !== 0 ? adj : undefined,
    note: def.note,
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
 * change. Squats: back on Monday, front on Friday, nowhere else.
 */
type Session = 'snatch' | 'cj_press' | 'technique' | 'heavy'
const SESSION_BY_DAY: Record<number, Session> = {
  1: 'snatch',     // Mon — snatch, back squat, hinge, delts
  3: 'cj_press',   // Wed — clean & jerk, strict press, upper body
  5: 'technique',  // Fri — snatch technique, front squat, back and arms
  6: 'heavy',      // Sat — heavy singles, jerk, overhead
}

function session(
  sess: Session, pos: MacroPos, maxes: Record<string, number>,
  adj: Record<string, number>, lt: Record<string, number>,
): { dayName: string; intent: string; items: Prescription[] } {
  const r = RANGE_BY_MESO[pos.meso]
  switch (sess) {
    case 'snatch':
      return {
        dayName: 'Snatch + Back Squat',
        intent: 'Snatch first while you are fresh, pull heavy, squat, then hamstrings and delts.',
        items: [
          pct('pd_snatch', pos, maxes, adj),
          pct('pd_snatch_pull', pos, maxes, adj),
          pct('pd_back_squat', pos, maxes, adj),
          range('pd_rdl', 'Romanian Deadlift', 3, r.heavy, lt, { step: 10, note: 'Hinge, do not squat it. Easy on the knees, hard on the hamstrings.' }),
          range('pd_legcurl', 'Lying Leg Curl', 3, r.mid, lt, { note: 'Hamstrings protect the knee. Slow on the way down.' }),
          range('pd_lateral_a', 'Lateral Raise', 4, r.wide, lt, { rir: 1, note: 'Light and strict. Shoulders are the priority this block.' }),
        ],
      }
    case 'cj_press':
      return {
        dayName: 'Clean & Jerk + Press',
        intent: 'Clean and jerk, then the strict press: the lift this program exists to bring up. Then the upper body.',
        items: [
          pct('pd_cj', pos, maxes, adj),
          pct('pd_ohp', pos, maxes, adj),
          range('pd_incline', 'Incline DB Press', 3, r.mid, lt),
          range('pd_lateral_b', 'Lateral Raise', 3, r.wide, lt, { rir: 1, superset: 'pd_ss_delts' }),
          range('pd_facepull', 'Face Pull', 3, r.wide, lt, { rir: 1, superset: 'pd_ss_delts', note: 'Rear delts and the upper back that holds a jerk overhead.' }),
          range('pd_oh_triceps', 'Overhead Triceps Extension', 3, r.mid, lt, { rir: 1, note: 'Triceps lock out the jerk. The stretch overhead is the point.' }),
        ],
      }
    case 'technique':
      return {
        dayName: 'Snatch Technique + Front Squat',
        intent: 'Lighter snatch work for positions, the week\'s front squat, a push press, then back and biceps.',
        items: [
          pct('pd_snatch_tech', pos, maxes, adj),
          pct('pd_front_squat', pos, maxes, adj),
          range('pd_pullup', 'Weighted Pull-Up', 4, r.heavy, lt, { note: 'Dead hang to chin over. Add load when the top of the range is easy.' }),
          range('pd_row', 'Chest-Supported Row', 3, r.mid, lt, { note: 'Chest stays down. No body english.' }),
          range('pd_push_press', 'Push Press', 3, r.heavy, lt, { note: 'Out of the front rack after the squats. The third overhead day of the week.' }),
          range('pd_curl', 'EZ-Bar Curl', 3, r.mid, lt),
        ],
      }
    case 'heavy':
      return {
        dayName: 'Heavy Singles + Jerk',
        intent: 'Climb to a heavy snatch and clean & jerk, jerk from the rack, then build the shoulders.',
        items: [
          pct('pd_snatch_heavy', pos, maxes, adj),
          pct('pd_cj_heavy', pos, maxes, adj),
          pct('pd_jerk', pos, maxes, adj),
          range('pd_zpress', 'Z-Press', 3, r.heavy, lt, { note: 'Seated on the floor, no back support. Strict overhead strength, nothing to cheat with.' }),
          range('pd_lateral_c', 'Cable Lateral Raise', 3, r.wide, lt, { rir: 1 }),
          range('pd_triceps', 'Rope Pushdown', 3, r.mid, lt, { rir: 1 }),
        ],
      }
  }
}

// Taper (week 12, or a fatigue deload): same movements, light. Classic lifts
// and squats drop to 75% for two or three crisp sets; range work to two sets.
function taper(items: Prescription[], maxes: Record<string, number>, isOpenerDay: boolean): Prescription[] {
  return items.map((i) => {
    if (i.kind !== 'lift') return i
    if (i.percent != null) {
      if (isOpenerDay && (i.slot === 'pd_snatch_heavy' || i.slot === 'pd_cj_heavy')) {
        const setPlan = [80, 85, 88].map((p) => ({ reps: 1, percent: p, targetWeightLbs: resolveWeight(p, i.maxKey, maxes) }))
        return {
          ...i, name: i.slot === 'pd_snatch_heavy' ? 'Snatch — Openers' : 'Clean & Jerk — Openers',
          sets: 3, reps: 1, percent: 80, setPlan, targetRpe: 7,
          targetWeightLbs: setPlan[0].targetWeightLbs, appliedAdjustmentPct: undefined,
          note: 'Practise the opener: the last single is what you would open with next week. Easy and fast.',
        }
      }
      const { setPlan: _drop, ...rest } = i
      // A pull lives above the lift's max; 75% of a snatch is not a pull.
      // Never heavier than the slot's own load this week (FOR-331): a light
      // M1 slot at 70% must not climb to the taper's 75.
      const tp = Math.min(/pull/.test(i.slot) ? 90 : 75, i.percent)
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
    snatch: [light('test_sn_light', 'Snatch', 'snatch')],
    cj_press: [light('test_cj_light', 'Clean & Jerk', 'clean_jerk')],
    technique: [light('test_sn_light', 'Snatch', 'snatch'), light('test_cj_light', 'Clean & Jerk', 'clean_jerk')],
    heavy: [],
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
  const built = session(sess, pos, maxes, adjustments, opts?.loadTargets ?? {})
  if (pos.isDeload) {
    const isTaperWeek = pos.weekInMacro === MACRO_WEEKS - 1
    return {
      dayNumber, dayName: built.dayName, dayType: 'gym',
      sessionIntent: isTaperWeek && sess === 'heavy'
        ? 'Taper. Practise your openers, then two easy sets of everything else.'
        : 'Taper — same movements, light. Leave feeling better than you arrived.',
      items: taper(built.items, maxes, isTaperWeek && sess === 'heavy'),
    }
  }
  return { dayNumber, dayName: built.dayName, dayType: 'gym', sessionIntent: built.intent, items: built.items }
}

export const platformDad: ProgramConfig = {
  slug: 'platform-dad',
  name: 'Platform Dad',
  tagline: 'weightlifting · bodybuilding',
  description:
    'The snatch and the clean & jerk four days a week, with bodybuilding that leans on the shoulders. Monday snatch and back squat, Wednesday clean & jerk and strict press, Friday snatch technique and front squat, Saturday heavy singles and the jerk. No jumps or sprints, squats twice a week. Build, heavy and peak blocks, a taper week, then a mock meet in week 13.',
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
