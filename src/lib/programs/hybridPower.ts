import {
  DayPlan,
  LiftPrescription,
  MetconPrescription,
  OutsideSession,
  PlyoPrescription,
  ProgramConfig,
  Prescription,
  resolveWeight,
} from './types'

// ═══════════════════════════════════════════════════════════════════════════════
// HYBRID POWER ATHLETE
//
// 13-week macro: 3 × 4-week mesos + test week.
//   Meso 1 (W1-4):   volume + technique + variation
//   Meso 2 (W5-8):   intensification — fewer variations, heavier
//   Meso 3 (W9-12):  realization — full competition lifts, heavy singles.
//                    W12 = deload. W13 = TEST (1RM snatch, C&J, squats).
//
// Week: Mon Oly A · Tue sprint · Wed Oly B · Thu conditioning ·
//       Fri Oly C · Sat strength/jump/metcon · Sun conditioning.
//
// All loads are computed here — deterministic, never AI-generated.
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

// A slot definition: per-meso variation names (indexed by weekInMeso) and a
// percent ramp. pct(week) = pctStart + pctStep * (weekInMeso - 1).
interface SlotMeso {
  names: [string, string, string, string]
  sets: number
  reps: number
  pctStart: number
  pctStep: number
  targetRpe?: number  // overrides the meso default (pulls feel heavy by design)
  note?: string
}

// Default expected difficulty of %-based work per meso — the autoreg anchor.
const MESO_TARGET_RPE: Record<number, number> = { 1: 7, 2: 8, 3: 9 }

// Autoreg deltas are clamped so feedback can bend the wave, never break it.
const MAX_ADJ = 6

// Classic-lift floor. The snatch and clean & jerk are speed-strength skills,
// not grinds — working under 65% teaches slow, sloppy positions. 65% is the
// hard floor (reserved for slow-tempo work); everything else lives at 70%+.
// This is a backstop: table waves are authored above it, and it also stops
// autoregulation from ever dropping a classic working set below 65%.
// Applies to the competition lifts and their receiving work — NOT to pulls
// (which live at 88-105%) or squats (keyed to their own maxes).
const CLASSIC_FLOOR = 65

function isClassicLiftSlot(slot: string, maxKey: string): boolean {
  if (maxKey !== 'snatch' && maxKey !== 'clean_jerk') return false
  return !slot.includes('pull')
}

function liftFromSlot(
  slot: string,
  def: SlotMeso,
  weekInMeso: number,
  maxKey: string,
  maxes: Record<string, number>,
  meso: number,
  adjustments: Record<string, number>,
  overrides?: Partial<LiftPrescription>,
): LiftPrescription {
  const basePct = def.pctStart + def.pctStep * (weekInMeso - 1)
  const rawAdj = adjustments[slot] ?? 0
  const adj = Math.max(-MAX_ADJ, Math.min(MAX_ADJ, rawAdj))
  let percent = Math.round((basePct + adj) * 2) / 2
  if (percent > 0 && isClassicLiftSlot(slot, maxKey) && percent < CLASSIC_FLOOR) {
    percent = CLASSIC_FLOOR
  }
  return {
    kind: 'lift',
    slot,
    name: def.names[weekInMeso - 1],
    sets: def.sets,
    reps: def.reps,
    percent,
    maxKey,
    targetWeightLbs: resolveWeight(percent, maxKey, maxes),
    targetRpe: def.targetRpe ?? MESO_TARGET_RPE[meso] ?? 8,
    appliedAdjustmentPct: adj !== 0 ? adj : undefined,
    note: def.note,
    ...overrides,
  }
}

function accessory(slot: string, name: string, sets: number, reps: number, note?: string): LiftPrescription {
  return { kind: 'lift', slot, name, sets, reps, rpe: 7, note }
}

// ── Metcon pool (Saturday) — curated, rotates by absolute week ────────────────
const METCON_POOL: Array<Omit<MetconPrescription, 'kind' | 'slot'>> = [
  { name: 'Sled & Row', format: 'for_time', timeCapMinutes: 12, description: '4 rounds:\n40yd sled push (heavy)\n15 cal row\n10 burpees' },
  { name: 'Aerodyne Ladder', format: 'amrap', timeCapMinutes: 10, description: 'AMRAP 10\n10 cal Aerodyne\n10 box jump overs (24")\n10 KB swings (53 lb)' },
  { name: 'Grind', format: 'for_time', timeCapMinutes: 15, description: '3 rounds:\n20 cal row\n15 DB thrusters (35s)\n10 pull-ups' },
  { name: 'EMOM Engine', format: 'emom', timeCapMinutes: 12, description: 'EMOM 12 (alternating)\nmin 1: 12 cal Aerodyne\nmin 2: 10 DB snatches (50 lb)\nmin 3: 12 box jumps' },
  { name: 'Sled Sprint Repeats', format: 'for_time', timeCapMinutes: 10, description: '6 rounds:\n20yd sled sprint (moderate)\n10 push-ups\nrest 45s between rounds' },
  { name: 'Row + Burpee Descender', format: 'for_time', timeCapMinutes: 12, description: '21-15-9\ncal row\nburpees over rower' },
  { name: 'KB Chipper', format: 'for_time', timeCapMinutes: 14, description: 'For time:\n30 KB swings (53)\n25 goblet squats\n20 cal Aerodyne\n15 burpee box step-overs\n10 TRX rows' },
  { name: 'Short Circuit', format: 'amrap', timeCapMinutes: 8, description: 'AMRAP 8\n8 DB push press (45s)\n8 cal row\n8 V-ups' },
]

// ── Sprint day (Tue) — A/B alternating by absolute week ───────────────────────
function sprintSession(weekNumber: number, pos: MacroPos): OutsideSession {
  if (pos.isDeload || pos.isTest) {
    return {
      kind: 'outside', slot: 'sprint',
      title: pos.isTest ? 'Easy Strides (test week)' : 'Easy Strides (deload)',
      parts: ['Thorough warm-up + drills (A-skips, B-skips)', '4 × 15m relaxed strides @ ~70%', 'Full recovery walk-back'],
      note: 'Keep the legs alive, nothing more. No timing, no straining.',
    }
  }
  const isAccel = weekNumber % 2 === 1
  const trim = pos.meso === 3 // meso 3: trim volume, keep intent maximal
  return isAccel
    ? {
        kind: 'outside', slot: 'sprint', title: 'Acceleration Day',
        parts: [
          'Warm-up: 10 min jog + drills (A-skip, B-skip, high knees)',
          `${trim ? 5 : 7} × 20-30m accelerations from 3-point or falling start, FULL recovery (2-3 min)`,
          `${trim ? 3 : 4} × 5 broad jumps, stick each landing`,
          'Cooldown walk 5 min',
        ],
        note: 'Every rep max intent. If quality drops, end the session.',
      }
    : {
        kind: 'outside', slot: 'sprint', title: 'Max Velocity Day',
        parts: [
          'Warm-up: 10 min jog + drills + 2 build-up strides',
          `${trim ? 3 : 5} × flying 20s (20m build + 20m fly), full recovery`,
          `${trim ? 3 : 4} × 30m bounding`,
          '3 × 5 hurdle hops or line hops',
        ],
        note: 'Tall posture, relaxed face and hands at top speed.',
      }
}

// ── Conditioning (Thu intervals / Sun steady) ─────────────────────────────────
function thursdayConditioning(weekNumber: number, pos: MacroPos): OutsideSession {
  if (pos.isDeload || pos.isTest) {
    return {
      kind: 'outside', slot: 'cond_intervals', title: 'Easy Spin (recovery)',
      parts: ['25-30 min very easy bike or jog — conversational pace'],
    }
  }
  const bikeWeek = weekNumber % 2 === 1
  const byMeso: Record<number, string> = {
    1: bikeWeek ? '5 × 4 min @ threshold, 2 min easy between' : '5 × 3 min hard run, 2 min walk/jog between',
    2: bikeWeek ? '6 × 3 min @ slightly above threshold, 2 min easy' : '6 × 2 min hard run, 90s recovery',
    3: bikeWeek ? '8 × 90s hard, 90s easy' : '8 × 1 min hard run, 1 min walk',
  }
  return {
    kind: 'outside', slot: 'cond_intervals',
    title: bikeWeek ? 'Bike Intervals' : 'Run Intervals',
    parts: ['10 min progressive warm-up', byMeso[pos.meso], '5-10 min easy cooldown'],
    note: 'Hard but repeatable — last rep should match the first.',
  }
}

function sundayConditioning(weekNumber: number, pos: MacroPos): OutsideSession {
  if (pos.isDeload || pos.isTest) {
    return {
      kind: 'outside', slot: 'cond_steady', title: 'Easy Z2 (recovery)',
      parts: ['30 min easy Z2 — opposite modality from Thursday', 'Nasal breathing pace'],
    }
  }
  const thursdayWasBike = weekNumber % 2 === 1
  const modality = thursdayWasBike ? 'run (or brisk ruck)' : 'bike / Peloton'
  const mins = pos.meso === 1 ? '40-50' : pos.meso === 2 ? '45-55' : '40-45'
  return {
    kind: 'outside', slot: 'cond_steady', title: 'Steady Z2',
    parts: [`${mins} min steady Z2 ${modality}`, 'Conversational the whole way — this builds the base, not the ego'],
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GYM DAY SLOT TABLES  — [meso 1, meso 2, meso 3]
// ═══════════════════════════════════════════════════════════════════════════════

// ── Day 1 — Oly A (Mon): snatch primary + C&J secondary + clean pull + BS heavy
const D1_SNATCH: SlotMeso[] = [
  { names: ['Pause Snatch, At Knee', 'Block Snatch, Below Knee', 'Hang Snatch, Above Knee', 'Snatch'], sets: 4, reps: 3, pctStart: 68, pctStep: 2 },
  { names: ['Power Snatch', 'Snatch w/ Pause Below Knee', 'Snatch', 'Snatch'], sets: 4, reps: 2, pctStart: 73, pctStep: 2 },
  { names: ['Snatch', 'Snatch', 'Snatch', 'Snatch'], sets: 5, reps: 2, pctStart: 81, pctStep: 3 },
]
const D1_CJ: SlotMeso[] = [
  { names: ['Hang Clean, Above Knee + Jerk (1+1)', 'Power Clean + Push Jerk (1+1)', 'Clean + Front Squat + Jerk (1+1+1)', 'Clean & Jerk'], sets: 5, reps: 1, pctStart: 68, pctStep: 2, note: 'Complex — see name for sequence' },
  { names: ['Clean & Jerk', 'Pause Clean + Jerk (1+1)', 'Clean & Jerk', 'Clean & Jerk'], sets: 5, reps: 1, pctStart: 72, pctStep: 2 },
  { names: ['Clean & Jerk', 'Clean & Jerk', 'Clean & Jerk', 'Clean & Jerk'], sets: 5, reps: 1, pctStart: 80, pctStep: 3 },
]
const D1_PULL: SlotMeso[] = [
  { names: ['Clean Pull', 'Clean High Pull', 'Clean Pull w/ Pause Below Knee', 'Clean Pull'], sets: 4, reps: 4, pctStart: 90, pctStep: 3 },
  { names: ['Clean Pull', 'Clean Pull', 'Clean Pull w/ Pause Above Knee', 'Clean Pull'], sets: 4, reps: 3, pctStart: 97, pctStep: 2.5 },
  { names: ['Clean Pull', 'Clean Pull', 'Clean Pull', 'Clean Pull'], sets: 3, reps: 2, pctStart: 102, pctStep: 4 },
]
const D1_SQUAT: SlotMeso[] = [
  { names: ['Back Squat', 'Back Squat', 'Back Squat', 'Back Squat'], sets: 5, reps: 5, pctStart: 70, pctStep: 2 },
  { names: ['Back Squat', 'Back Squat', 'Back Squat', 'Back Squat'], sets: 4, reps: 4, pctStart: 78, pctStep: 2 },
  { names: ['Back Squat', 'Back Squat', 'Back Squat', 'Back Squat'], sets: 4, reps: 3, pctStart: 85, pctStep: 1.5 },
]

// ── Day 3 — Oly B (Wed): snatch technique + snatch pull + FRONT SQUAT (pushed)
//   + receiving work (snatch balance / drop snatch — NEVER OHS: this is a heavy
//   front-squat day, and OHS must not share a day with heavy squatting).
const D3_SNATCH: SlotMeso[] = [
  { names: ['Tempo Snatch (3s pull)', 'Drop Snatch', 'Snatch Balance', 'Pause Snatch, Below Knee'], sets: 4, reps: 3, pctStart: 65, pctStep: 2 },
  { names: ['Snatch Balance', 'Drop Snatch', 'Pause Snatch, At Knee', 'Snatch'], sets: 4, reps: 2, pctStart: 70, pctStep: 2 },
  { names: ['Power Snatch', 'Power Snatch', 'Power Snatch', 'Power Snatch'], sets: 3, reps: 2, pctStart: 72, pctStep: 1, note: 'Technique primer — crisp, not heavy' },
]
const D3_PULL: SlotMeso[] = [
  { names: ['Snatch High Pull', 'Snatch High Pull', 'Snatch Pull w/ Pause Below Knee', 'Snatch High Pull'], sets: 3, reps: 5, pctStart: 88, pctStep: 3 },
  { names: ['Snatch Pull', 'Snatch Pull', 'Snatch Pull w/ Pause Above Knee', 'Snatch Pull'], sets: 4, reps: 3, pctStart: 95, pctStep: 3 },
  { names: ['Snatch Pull', 'Snatch Pull', 'Snatch Pull', 'Snatch Pull'], sets: 3, reps: 2, pctStart: 100, pctStep: 4 },
]
const D3_FSQUAT: SlotMeso[] = [
  { names: ['Front Squat', 'Front Squat', 'Front Squat', 'Front Squat'], sets: 4, reps: 5, pctStart: 72, pctStep: 2 },
  { names: ['Front Squat', 'Front Squat', 'Front Squat', 'Front Squat'], sets: 4, reps: 3, pctStart: 78, pctStep: 2.5 },
  { names: ['Front Squat', 'Front Squat', 'Front Squat', 'Front Squat'], sets: 3, reps: 2, pctStart: 85, pctStep: 2.5 },
]

// ── Day 5 — Oly C (Fri): snatch expression + FULL C&J + snatch/clean pull + BS light
const D5_SNATCH: SlotMeso[] = [
  { names: ['Power Snatch', 'Power Snatch, No Feet', 'Hang Power Snatch', 'Power Snatch'], sets: 3, reps: 3, pctStart: 66, pctStep: 2 },
  { names: ['Snatch', 'Snatch', 'Snatch', 'Snatch'], sets: 4, reps: 2, pctStart: 74, pctStep: 3 },
  { names: ['Snatch', 'Snatch', 'Snatch', 'Snatch'], sets: 6, reps: 1, pctStart: 82, pctStep: 3 },
]
const D5_CJ: SlotMeso[] = [
  { names: ['Clean & Jerk', 'Clean & Jerk', 'Clean & Jerk', 'Clean & Jerk'], sets: 6, reps: 1, pctStart: 74, pctStep: 2 },
  { names: ['Clean & Jerk', 'Clean & Jerk', 'Clean & Jerk', 'Clean & Jerk'], sets: 6, reps: 1, pctStart: 78, pctStep: 2.5 },
  { names: ['Clean & Jerk', 'Clean & Jerk', 'Clean & Jerk', 'Clean & Jerk'], sets: 6, reps: 1, pctStart: 84, pctStep: 3 },
]
const D5_PULL: SlotMeso[] = [
  { names: ['Snatch Pull', 'Snatch Pull', 'Snatch High Pull', 'Snatch Pull'], sets: 4, reps: 5, pctStart: 88, pctStep: 2 },
  { names: ['Clean Pull', 'Clean Pull', 'Clean Pull', 'Clean Pull'], sets: 4, reps: 3, pctStart: 97, pctStep: 2.5 },
  // Meso 3: pull slot omitted Friday — CNS budget goes to the heavy singles.
  { names: ['', '', '', ''], sets: 0, reps: 0, pctStart: 0, pctStep: 0 },
]
const D5_SQUAT: SlotMeso[] = [
  { names: ['Back Squat', 'Back Squat', 'Back Squat', 'Back Squat'], sets: 3, reps: 5, pctStart: 64, pctStep: 1.5 },
  { names: ['Back Squat', 'Back Squat', 'Back Squat', 'Back Squat'], sets: 3, reps: 3, pctStart: 72, pctStep: 1.5 },
  { names: ['Back Squat', 'Back Squat', 'Back Squat', 'Back Squat'], sets: 3, reps: 2, pctStart: 78, pctStep: 1 },
]

// ── Day 6 — Sat: heavy DL + overhead/receiving + plyos + metcon ───────────────
const D6_DL_CLEAN: SlotMeso[] = [
  { names: ['Clean Deadlift', 'Clean Deadlift', 'Clean Deadlift', 'Clean Deadlift'], sets: 5, reps: 4, pctStart: 96, pctStep: 2 },
  { names: ['Clean Deadlift', 'Clean Deadlift', 'Clean Deadlift', 'Clean Deadlift'], sets: 4, reps: 3, pctStart: 100, pctStep: 2.5 },
  { names: ['Clean Deadlift', 'Clean Deadlift', 'Clean Deadlift', 'Clean Deadlift'], sets: 3, reps: 2, pctStart: 105, pctStep: 2.5 },
]
const D6_DL_SNATCH: SlotMeso[] = [
  { names: ['Snatch Deadlift', 'Snatch Deadlift', 'Snatch Deadlift', 'Snatch Deadlift'], sets: 5, reps: 4, pctStart: 96, pctStep: 2 },
  { names: ['Snatch Deadlift', 'Snatch Deadlift', 'Snatch Deadlift', 'Snatch Deadlift'], sets: 4, reps: 3, pctStart: 100, pctStep: 2.5 },
  { names: ['Snatch Deadlift', 'Snatch Deadlift', 'Snatch Deadlift', 'Snatch Deadlift'], sets: 3, reps: 2, pctStart: 105, pctStep: 2.5 },
]

function saturdayOverhead(pos: MacroPos, maxes: Record<string, number>): LiftPrescription {
  if (pos.meso === 1) {
    const pct = 78 + 3 * (pos.weekInMeso - 1)
    return { kind: 'lift', slot: 'sat_overhead', name: 'Snatch Balance', sets: 3, reps: 3, percent: pct, maxKey: 'snatch', targetWeightLbs: resolveWeight(pct, 'snatch', maxes) }
  }
  if (pos.meso === 2) {
    const pct = 68 + 3 * (pos.weekInMeso - 1)
    return { kind: 'lift', slot: 'sat_overhead', name: 'Push Press', sets: 4, reps: 3, percent: pct, maxKey: 'clean_jerk', targetWeightLbs: resolveWeight(pct, 'clean_jerk', maxes) }
  }
  const pct = 85 + 3 * (pos.weekInMeso - 1)
  return { kind: 'lift', slot: 'sat_overhead', name: 'Jerk from Rack', sets: 4, reps: 1, percent: pct, maxKey: 'clean_jerk', targetWeightLbs: resolveWeight(pct, 'clean_jerk', maxes) }
}

function saturdayPlyo(pos: MacroPos): PlyoPrescription[] {
  if (pos.meso === 1) return [{ kind: 'plyo', slot: 'plyo', name: 'Box Jumps', sets: 4, reps: 5, note: 'Step down, reset each rep — max intent' }]
  if (pos.meso === 2) return [
    { kind: 'plyo', slot: 'plyo', name: 'Broad Jumps', sets: 4, reps: 4, note: 'Stick landings' },
    { kind: 'plyo', slot: 'plyo_2', name: 'Depth Drops', sets: 3, reps: 3, note: 'From ~18", absorb quietly' },
  ]
  return [
    { kind: 'plyo', slot: 'plyo', name: 'Depth Jumps', sets: 3, reps: 3, note: 'From ~18-24", rebound fast' },
    { kind: 'plyo', slot: 'plyo_2', name: 'Box Jumps', sets: 3, reps: 3, note: 'Max height, full recovery' },
  ]
}

// ═══════════════════════════════════════════════════════════════════════════════
// Day builders
// ═══════════════════════════════════════════════════════════════════════════════

const DELOAD_PCT = 60
const DELOAD_NOTE = 'Deload — bar speed crisp, leave feeling fresh'

function applyDeload(p: LiftPrescription): LiftPrescription {
  return {
    ...p,
    sets: Math.max(2, Math.ceil(p.sets / 2)),
    percent: p.percent != null ? DELOAD_PCT : undefined,
    note: DELOAD_NOTE,
  }
}

function withResolvedDeload(p: LiftPrescription, maxes: Record<string, number>): LiftPrescription {
  const d = applyDeload(p)
  d.targetWeightLbs = resolveWeight(d.percent, d.maxKey, maxes)
  return d
}

function testDay(dayNumber: number, maxes: Record<string, number>): DayPlan {
  const plans: Record<number, DayPlan> = {
    1: {
      dayNumber, dayName: 'TEST — Snatch 1RM', dayType: 'test',
      sessionIntent: 'Work to a new 1RM snatch. Take your time between attempts.',
      items: [
        { kind: 'lift', slot: 'test_snatch', name: 'Snatch — work to 1RM', sets: 8, reps: 1, note: 'Suggested climb: 60/70/78/85/90/95%+ then PR attempts. Log your top single.' },
        accessory('test_acc', 'Easy bike flush', 1, 10, '10 min easy spin after'),
      ],
    },
    3: {
      dayNumber, dayName: 'TEST — Clean & Jerk 1RM', dayType: 'test',
      sessionIntent: 'Work to a new 1RM clean & jerk.',
      items: [
        { kind: 'lift', slot: 'test_cj', name: 'Clean & Jerk — work to 1RM', sets: 8, reps: 1, note: 'Suggested climb: 60/70/78/85/90/95%+ then PR attempts. Log your top single.' },
        accessory('test_acc', 'Easy bike flush', 1, 10, '10 min easy spin after'),
      ],
    },
    5: {
      dayNumber, dayName: 'TEST — Squat 1RMs', dayType: 'test',
      sessionIntent: 'Back squat 1RM, then front squat 1RM if you have juice left.',
      items: [
        { kind: 'lift', slot: 'test_bs', name: 'Back Squat — work to 1RM', sets: 6, reps: 1, note: 'Climb 60/70/80/88/94%+ then max attempts' },
        { kind: 'lift', slot: 'test_fs', name: 'Front Squat — work to 1RM (optional)', sets: 4, reps: 1, note: 'Only if back squat felt strong' },
      ],
    },
    6: {
      dayNumber, dayName: 'Celebrate & Move', dayType: 'outside',
      sessionIntent: 'Macro complete. Update your maxes in the app, then move easy.',
      items: [
        { kind: 'outside', slot: 'move', title: 'Recovery Movement', parts: ['30-40 min walk, easy bike, or swim', 'Update your 1RMs in settings — next macro computes from the new numbers'] },
      ],
    },
  }
  if (plans[dayNumber]) return plans[dayNumber]
  // Outside days during test week are easy movement.
  const pos = { weekInMacro: 13, meso: 3, weekInMeso: 4, isDeload: false, isTest: true }
  if (dayNumber === 2) return { dayNumber, dayName: 'Strides', dayType: 'outside', sessionIntent: 'Easy speed, stay springy for testing.', items: [sprintSession(13, pos)] }
  if (dayNumber === 4) return { dayNumber, dayName: 'Recovery Spin', dayType: 'outside', sessionIntent: 'Flush the legs between test days.', items: [thursdayConditioning(13, pos)] }
  return { dayNumber, dayName: 'Easy Z2', dayType: 'outside', sessionIntent: 'Easy aerobic work.', items: [sundayConditioning(13, pos)] }
}

function buildDay(weekNumber: number, dayNumber: number, maxes: Record<string, number>, adjustments: Record<string, number> = {}): DayPlan {
  const pos = macroPos(weekNumber)
  if (pos.isTest) return testDay(dayNumber, maxes)

  const m = pos.meso - 1
  const w = pos.weekInMeso

  switch (dayNumber) {
    case 1: {
      let items: Prescription[] = [
        liftFromSlot('snatch_primary', D1_SNATCH[m], w, 'snatch', maxes, pos.meso, adjustments),
        liftFromSlot('cj_secondary', D1_CJ[m], w, 'clean_jerk', maxes, pos.meso, adjustments),
        liftFromSlot('clean_pull', D1_PULL[m], w, 'clean_jerk', maxes, pos.meso, adjustments),
        liftFromSlot('back_squat_heavy', D1_SQUAT[m], w, 'back_squat', maxes, pos.meso, adjustments),
        accessory('acc_pull', pos.meso === 3 ? 'Weighted Pull-Up' : 'Bent-Over Row', 3, pos.meso === 3 ? 6 : 10, '90s rest'),
        accessory('acc_core', 'Hanging Leg Raises', 3, 12, '60s rest'),
      ]
      if (pos.isDeload) {
        items = items.map(i => (i.kind === 'lift' && i.percent != null ? withResolvedDeload(i, maxes) : i))
          .filter(i => !(i.kind === 'lift' && i.slot === 'clean_pull')) // drop pulls on deload
      }
      return {
        dayNumber, dayName: 'Oly A — Snatch + C&J', dayType: 'gym',
        sessionIntent: pos.isDeload ? 'Deload — light, fast, out of the gym feeling fresh.' : 'Snatch focus, C&J secondary, heavy back squat.',
        items,
      }
    }
    case 3: {
      let items: Prescription[] = [
        liftFromSlot('snatch_tech', D3_SNATCH[m], w, 'snatch', maxes, pos.meso, adjustments),
        liftFromSlot('snatch_pull', D3_PULL[m], w, 'snatch', maxes, pos.meso, adjustments),
        liftFromSlot('front_squat', D3_FSQUAT[m], w, 'front_squat', maxes, pos.meso, adjustments),
      ]
      // Receiving slot — NEVER OHS on this heavy front-squat day. Meso 1 drop
      // snatch (fast under the bar), meso 2 snatch balance (heavier catch),
      // meso 3 omitted (CNS budget goes to the pulls + front squat).
      if (pos.meso === 1) {
        const pct = 75 + 3 * (w - 1)
        items.push({ kind: 'lift', slot: 'receiving', name: 'Drop Snatch', sets: 3, reps: 2, percent: pct, maxKey: 'snatch', targetWeightLbs: resolveWeight(pct, 'snatch', maxes) })
      } else if (pos.meso === 2) {
        const pct = 85 + 3 * (w - 1)
        items.push({ kind: 'lift', slot: 'receiving', name: 'Snatch Balance', sets: 3, reps: 2, percent: pct, maxKey: 'snatch', targetWeightLbs: resolveWeight(pct, 'snatch', maxes) })
      }
      items.push(
        accessory('acc_single_leg', 'Bulgarian Split Squat', 3, 10, '90s rest each leg'),
        accessory('acc_press', 'Dumbbell Shoulder Press, Standing', 3, 10, '90s rest'),
      )
      if (pos.isDeload) {
        items = items.map(i => (i.kind === 'lift' && i.percent != null ? withResolvedDeload(i, maxes) : i))
          .filter(i => !(i.kind === 'lift' && (i.slot === 'snatch_pull' || i.slot === 'receiving')))
      }
      return {
        dayNumber, dayName: 'Oly B — Technique + Front Squat', dayType: 'gym',
        sessionIntent: pos.isDeload ? 'Deload — grease positions only.' : 'Snatch technique work and a hard front squat.',
        items,
      }
    }
    case 5: {
      let items: Prescription[] = [
        liftFromSlot('snatch_express', D5_SNATCH[m], w, 'snatch', maxes, pos.meso, adjustments),
        liftFromSlot('cj_full', D5_CJ[m], w, 'clean_jerk', maxes, pos.meso, adjustments),
      ]
      if (D5_PULL[m].sets > 0) {
        const pullMaxKey = pos.meso === 2 ? 'clean_jerk' : 'snatch'
        items.push(liftFromSlot('fri_pull', D5_PULL[m], w, pullMaxKey, maxes, pos.meso, adjustments))
      }
      items.push(
        liftFromSlot('back_squat_light', D5_SQUAT[m], w, 'back_squat', maxes, pos.meso, adjustments),
        accessory('acc_pullup', 'Pull-Up', 3, 8, 'Add weight if 8 is easy'),
        accessory('acc_core', 'Plank', 3, 45, 'Seconds, not reps'),
      )
      if (pos.isDeload) {
        items = items.map(i => (i.kind === 'lift' && i.percent != null ? withResolvedDeload(i, maxes) : i))
          .filter(i => !(i.kind === 'lift' && i.slot === 'fri_pull'))
      }
      return {
        dayNumber, dayName: 'Oly C — Expression', dayType: 'gym',
        sessionIntent: pos.isDeload ? 'Deload — a few crisp singles, nothing else.' : 'Heavier snatch work and full clean & jerks; light squat to finish.',
        items,
      }
    }
    case 6: {
      const cleanWeek = weekNumber % 2 === 1
      const dl = liftFromSlot('sat_dl', (cleanWeek ? D6_DL_CLEAN : D6_DL_SNATCH)[m], w, cleanWeek ? 'clean_jerk' : 'snatch', maxes, pos.meso, adjustments)
      let items: Prescription[] = [dl, saturdayOverhead(pos, maxes), ...saturdayPlyo(pos)]
      if (pos.isDeload) {
        items = [
          withResolvedDeload(dl, maxes),
          { kind: 'plyo', slot: 'plyo', name: 'Box Jumps', sets: 3, reps: 3, note: 'Easy height, springy' },
          { kind: 'outside', slot: 'metcon_sub', title: 'Easy Flush', parts: ['8-10 min easy row or Aerodyne — Z2, nothing hard'] },
        ]
      } else {
        const mc = METCON_POOL[(weekNumber - 1) % METCON_POOL.length]
        items.push({ kind: 'metcon', slot: 'metcon', ...mc })
        items.push(accessory('acc_posterior', 'Glute Ham Raise', 3, 10, 'Or back extension'))
      }
      return {
        dayNumber, dayName: 'Strength + Jump + MetCon', dayType: 'gym',
        sessionIntent: pos.isDeload ? 'Deload — move, don\'t grind.' : 'Heavy pull from the floor, explosive jumps, then the week\'s metcon.',
        items,
      }
    }
    case 2:
      return { dayNumber, dayName: 'Sprint / Jump / Bound', dayType: 'outside', sessionIntent: 'Speed work — quality over quantity, full recoveries.', items: [sprintSession(weekNumber, pos)] }
    case 4:
      return { dayNumber, dayName: 'Conditioning — Intervals', dayType: 'outside', sessionIntent: 'Interval engine work.', items: [thursdayConditioning(weekNumber, pos)] }
    case 7:
      return { dayNumber, dayName: 'Conditioning — Steady', dayType: 'outside', sessionIntent: 'Aerobic base.', items: [sundayConditioning(weekNumber, pos)] }
    default:
      return { dayNumber, dayName: `Day ${dayNumber}`, dayType: 'rest', sessionIntent: 'Rest.', items: [] }
  }
}

export const hybridPower: ProgramConfig = {
  slug: 'hybrid-power',
  name: 'Hybrid Power Athlete',
  tagline: 'Olympic weightlifting · sprinting · engine',
  description:
    '3 weightlifting days + 1 strength/jump/metcon day in the gym, plus sprint work and two conditioning sessions outside. 13-week macro: volume → intensity → full lifts, deload week 12, test week 13.',
  daysPerWeek: 7,
  gymDayNumbers: [1, 3, 5, 6],
  macroWeeks: 13,
  requiredMaxes: [
    { key: 'snatch', label: 'Snatch', hint: 'Best recent single (lbs)' },
    { key: 'clean_jerk', label: 'Clean & Jerk', hint: 'Best recent single (lbs)' },
    { key: 'back_squat', label: 'Back Squat', hint: 'Best recent single (lbs)' },
    { key: 'front_squat', label: 'Front Squat', hint: 'Best recent single (lbs)' },
  ],
  buildDay,
}
