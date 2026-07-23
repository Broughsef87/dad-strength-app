import {
  BuildDayOpts,
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
// HYBRID POWER ATHLETE — athletic power, not weightlifting
//
// The FULL snatch and clean (no jerk) are the heavy expression — zero
// technique work (no pauses, tempos, complexes, receiving drills), just heavy
// doubles and singles at 80%+ per the fulls rule. Speed lives in Friday's
// hang power snatch (triples, 65-72%) and the speed box squats. Overhead is
// push press (Wed, power) + strict OHP wave (Sat, strength) — jerk retired.
// Percent rules: pure lifts ≤2 reps ≥80%; any ≤2-rep set ≥75%; power/hang
// triples ≥65%. Pulls key off the full-lift maxes and run heavy (100-116%).
//
// 13-week macro: 3 × 4-week mesos + test week.
//   Meso 1 (W1-4):   straight heavy doubles @ 80-83%
//   Meso 2 (W5-8):   top double (83-86%) + back-off doubles @ 80%
//   Meso 3 (W9-12):  top single (87-91%) + back-off singles @ 83-85%.
//                    W12 = deload. W13 = TEST (Snatch, Clean, squats, bench, DL).
//
// Week: Mon Power A (snatch) · Tue sprint · Wed athletic strength ·
//       Thu conditioning · Fri Power B (clean) · Sat power + engine · Sun Z2.
// Session budget: every gym day caps at 6 cards.
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
// 8 gives the weight-follow (re-anchoring to what was actually lifted) real
// room while still stopping a single wild session from hijacking the macro.
const MAX_ADJ = 8

// Classic-lift percent floors. The snatch and clean & jerk are speed-strength
// skills, not grinds, and the sport's realities set the floor by rep/variation:
//   • the PURE competition lift ("Snatch" / "Clean & Jerk") at ≤2 reps must be
//     heavy — a light single or double of the full lift trains nothing
//     (2 reps @ 66% is no stimulus). Floor 80%.
//   • slow tempo / pause work at 3+ reps may drop to 65% — that IS the stimulus.
//   • everything else classic lives at 70%+ (variations, higher-rep work).
// This is a backstop: table waves are authored above it, and it also stops
// autoregulation from ever dropping a classic set below its floor.
// Applies to the competition lifts + receiving work — NOT pulls (88-114%) or
// squats/presses (keyed to their own maxes).
function classicFloor(name: string, reps: number): number {
  const n = name.trim().toLowerCase()
  // Block work is a full-lift expression from a raised start — it follows the
  // SAME rules as the pure lift (a light block double trains nothing). Hangs
  // may run a touch lighter (they fall through to the lower floors).
  const isFullLift = n === 'snatch' || n === 'clean' || n === 'clean & jerk' || /block/.test(n)
  if (isFullLift && reps <= 2) return 80
  // Doubles and singles are never light — a 2-rep set below 75% of the full
  // lift is no stimulus, whatever the variation.
  if (reps <= 2) return 75
  // Triples+ on power/hang variants are speed work — 65 floor.
  if (/power|hang/.test(n)) return 65
  const isTempo = /tempo|pause/.test(n)
  if (isTempo && reps >= 3) return 65
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
  overrides?: Partial<LiftPrescription>,
): LiftPrescription {
  const basePct = def.pctStart + def.pctStep * (weekInMeso - 1)
  const rawAdj = adjustments[slot] ?? 0
  const adj = Math.max(-MAX_ADJ, Math.min(MAX_ADJ, rawAdj))
  let percent = Math.round((basePct + adj) * 2) / 2
  if (percent > 0 && isClassicLiftSlot(slot, maxKey)) {
    const floor = classicFloor(def.names[weekInMeso - 1], def.reps)
    if (percent < floor) percent = floor
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
          'Neck: hand-resisted isometrics — 2 × 10s each direction (front/back/sides)',
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
          'Neck: hand-resisted isometrics — 2 × 10s each direction (front/back/sides)',
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
  // Time-based intervals work on any modality — the athlete picks the tool.
  const byMeso: Record<number, string> = {
    1: '5 × 4 min hard, 2 min easy between',
    2: '6 × 3 min hard, 2 min easy between',
    3: '8 × 90s hard, 90s easy between',
  }
  return {
    kind: 'outside', slot: 'cond_intervals',
    title: 'Intervals — Bike / Row / Run',
    parts: ['10 min progressive warm-up (any modality)', byMeso[pos.meso], '5-10 min easy cooldown'],
    note: 'Pick bike, rower, or run — whichever suits you today. Hard but repeatable: the last rep should match the first.',
  }
}

function sundayConditioning(weekNumber: number, pos: MacroPos): OutsideSession {
  if (pos.isDeload || pos.isTest) {
    return {
      kind: 'outside', slot: 'cond_steady', title: 'Easy Z2 (recovery)',
      parts: ['30 min easy Z2 — opposite modality from Thursday', 'Nasal breathing pace'],
    }
  }
  const mins = pos.meso === 1 ? '40-50' : pos.meso === 2 ? '45-55' : '40-45'
  return {
    kind: 'outside', slot: 'cond_steady', title: 'Steady Z2 — Your Pick',
    parts: [
      `${mins} min steady Z2 — bike, row, run, or ruck`,
      'Conversational the whole way — this builds the base, not the ego',
      'Neck: 2 × 15 plate curls + extensions (bench, towel, 5-10 lb plate) — or isometrics at home',
    ],
    note: 'Rotating modalities across weeks spreads the wear. Different tool than Thursday is a good default.',
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GYM DAY SLOT TABLES  — [meso 1, meso 2, meso 3]
// ═══════════════════════════════════════════════════════════════════════════════

// ── Day 1 — Oly A (Mon): snatch primary + C&J secondary + snatch pull + BS heavy
// With 2 Oly days, primaries carry a touch more volume than the old 3-day split.
// Athletic-power rework: NO technique work — no pauses, tempos, or complexes.
// The FULL lifts are back as the heavy expression — no technique work, just
// heavy snatches and cleans per the user's own floor: fulls at ≤2 reps live
// at 80%+. Speed lives in Friday's hang power snatch and the box squats.
//   M1 straight heavy doubles · M2 top double + back-offs · M3 top single.
const D1_SN_TOP: SlotMeso[] = [
  { names: ['Snatch', 'Snatch', 'Snatch', 'Snatch'], sets: 4, reps: 2, pctStart: 80, pctStep: 1, targetRpe: 8, note: 'Straight heavy doubles — full lift, no fluff' },
  { names: ['Snatch', 'Snatch', 'Snatch', 'Snatch'], sets: 1, reps: 2, pctStart: 83, pctStep: 1, targetRpe: 8, note: 'Build to this top double — singles on the way up' },
  { names: ['Snatch', 'Snatch', 'Snatch', 'Snatch'], sets: 1, reps: 1, pctStart: 87, pctStep: 1.5, targetRpe: 8, note: 'Build to this top single' },
]
const D1_SN_BACK: SlotMeso[] = [
  { names: ['', '', '', ''], sets: 0, reps: 0, pctStart: 0, pctStep: 0 }, // M1: straight sets, no back-offs
  { names: ['Snatch', 'Snatch', 'Snatch', 'Snatch'], sets: 3, reps: 2, pctStart: 80, pctStep: 0, targetRpe: 7, note: 'Back-off doubles — stay sharp' },
  { names: ['Snatch', 'Snatch', 'Snatch', 'Snatch'], sets: 2, reps: 1, pctStart: 83, pctStep: 1, targetRpe: 7, note: 'Back-off singles' },
]
// Monday heavy bench — the week's heavy-upper anchor. Dip-drive overhead was
// triple-booked (Mon power jerk + Wed push press + Sat jerk slot); the jerk
// left Monday so pressing splits heavy (Mon) / volume (Wed) instead.
const D1_BENCH_HEAVY: SlotMeso[] = [
  { names: ['Bench Press', 'Bench Press', 'Bench Press', 'Bench Press'], sets: 4, reps: 4, pctStart: 75, pctStep: 2, targetRpe: 7, note: 'Heavy day — Wednesday stays the volume day' },
  { names: ['Bench Press', 'Bench Press', 'Bench Press', 'Bench Press'], sets: 4, reps: 3, pctStart: 80, pctStep: 2, targetRpe: 8 },
  { names: ['Bench Press', 'Bench Press', 'Bench Press', 'Bench Press'], sets: 3, reps: 2, pctStart: 86, pctStep: 1, targetRpe: 8 },
]
// Pulls key off the FULL-lift maxes and run heavy — a strong puller gets
// nothing from sub-95% pulls. 100 → 116% across the macro.
const D1_PULL: SlotMeso[] = [
  { names: ['Snatch Pull', 'Snatch Pull', 'Snatch Pull', 'Snatch Pull'], sets: 4, reps: 4, pctStart: 100, pctStep: 2, targetRpe: 8, note: 'Heavy and fast — position honest, bar tight' },
  { names: ['Snatch Pull', 'Snatch Pull', 'Snatch Pull', 'Snatch Pull'], sets: 4, reps: 3, pctStart: 105, pctStep: 2.5, targetRpe: 8, note: 'Heavy and fast — position honest, bar tight' },
  { names: ['Snatch Pull', 'Snatch Pull', 'Snatch Pull', 'Snatch Pull'], sets: 3, reps: 2, pctStart: 110, pctStep: 3, targetRpe: 8, note: 'Heavy and fast — position honest, bar tight' },
]
const D1_SQUAT: SlotMeso[] = [
  { names: ['Back Squat', 'Back Squat', 'Back Squat', 'Back Squat'], sets: 5, reps: 5, pctStart: 70, pctStep: 2 },
  { names: ['Back Squat', 'Back Squat', 'Back Squat', 'Back Squat'], sets: 4, reps: 4, pctStart: 78, pctStep: 2 },
  { names: ['Back Squat', 'Back Squat', 'Back Squat', 'Back Squat'], sets: 4, reps: 3, pctStart: 85, pctStep: 1.5 },
]

// ── Day 3 — Athletic Strength (Wed): presses + FS/jump contrast + unilateral ──
// Strength you can't get from the platform, CNS-friendly enough to leave
// Friday's C&J fresh. Bench supersets with weighted pull-ups (push/pull pair).
const D3_PUSH_PRESS: SlotMeso[] = [
  { names: ['Push Press', 'Push Press', 'Push Press', 'Push Press'], sets: 4, reps: 5, pctStart: 65, pctStep: 2 },
  { names: ['Push Press', 'Push Press', 'Push Press', 'Push Press'], sets: 4, reps: 3, pctStart: 72, pctStep: 2 },
  { names: ['Push Press', 'Push Press', 'Push Press', 'Push Press'], sets: 4, reps: 2, pctStart: 78, pctStep: 2 },
]
const D3_BENCH: SlotMeso[] = [
  { names: ['Bench Press', 'Bench Press', 'Bench Press', 'Bench Press'], sets: 4, reps: 6, pctStart: 70, pctStep: 2, note: 'Superset with weighted pull-ups' },
  { names: ['Bench Press', 'Bench Press', 'Bench Press', 'Bench Press'], sets: 4, reps: 4, pctStart: 77, pctStep: 2, note: 'Superset with weighted pull-ups' },
  { names: ['Bench Press', 'Bench Press', 'Bench Press', 'Bench Press'], sets: 3, reps: 3, pctStart: 84, pctStep: 2, note: 'Superset with weighted pull-ups' },
]
const D3_FSQUAT: SlotMeso[] = [
  { names: ['Front Squat', 'Front Squat', 'Front Squat', 'Front Squat'], sets: 4, reps: 5, pctStart: 72, pctStep: 2, note: 'Contrast: trap bar jumps ~30s after each set' },
  { names: ['Front Squat', 'Front Squat', 'Front Squat', 'Front Squat'], sets: 4, reps: 3, pctStart: 78, pctStep: 2.5, note: 'Contrast: trap bar jumps ~30s after each set' },
  { names: ['Front Squat', 'Front Squat', 'Front Squat', 'Front Squat'], sets: 3, reps: 2, pctStart: 85, pctStep: 2.5, note: 'Contrast: trap bar jumps ~30s after each set' },
]

// ── Day 5 — Oly B (Fri): C&J primary + snatch secondary + clean pull + speed squat
// Friday mirrors Monday's shape with the clean as the primary. No jerk —
// overhead lives on Wednesday (push press) and Saturday (jerk slot).
const D5_CL_TOP: SlotMeso[] = [
  { names: ['Clean', 'Clean', 'Clean', 'Clean'], sets: 4, reps: 2, pctStart: 80, pctStep: 1, targetRpe: 8, note: 'Straight heavy doubles — no jerk, stand it up' },
  { names: ['Clean', 'Clean', 'Clean', 'Clean'], sets: 1, reps: 2, pctStart: 83, pctStep: 1, targetRpe: 8, note: 'Build to this top double — singles on the way up' },
  { names: ['Clean', 'Clean', 'Clean', 'Clean'], sets: 1, reps: 1, pctStart: 87, pctStep: 1.5, targetRpe: 8, note: 'Build to this top single' },
]
const D5_CL_BACK: SlotMeso[] = [
  { names: ['', '', '', ''], sets: 0, reps: 0, pctStart: 0, pctStep: 0 },
  { names: ['Clean', 'Clean', 'Clean', 'Clean'], sets: 3, reps: 2, pctStart: 80, pctStep: 0, targetRpe: 7, note: 'Back-off doubles — stay sharp' },
  { names: ['Clean', 'Clean', 'Clean', 'Clean'], sets: 2, reps: 1, pctStart: 83, pctStep: 1, targetRpe: 7, note: 'Back-off singles' },
]
// Second snatch exposure of the week: hang power snatch as TRIPLES — hangs may
// run lighter than 75, so they stay at 3 reps in the 65-72% speed zone.
const D5_HPS: SlotMeso[] = [
  { names: ['Hang Power Snatch', 'Hang Power Snatch', 'Hang Power Snatch', 'Hang Power Snatch'], sets: 4, reps: 3, pctStart: 65, pctStep: 1.5, targetRpe: 6, note: 'From the hang. Bar speed only.' },
  { names: ['Hang Power Snatch', 'Hang Power Snatch', 'Hang Power Snatch', 'Hang Power Snatch'], sets: 4, reps: 3, pctStart: 68, pctStep: 1.5, targetRpe: 6, note: 'From the hang. Bar speed only.' },
  { names: ['Hang Power Snatch', 'Hang Power Snatch', 'Hang Power Snatch', 'Hang Power Snatch'], sets: 3, reps: 3, pctStart: 70, pctStep: 1, targetRpe: 6, note: 'From the hang. Bar speed only.' },
]
const D5_PULL: SlotMeso[] = [
  { names: ['Clean Pull', 'Clean Pull', 'Clean Pull', 'Clean Pull'], sets: 4, reps: 4, pctStart: 100, pctStep: 2, targetRpe: 8, note: 'Heavy and fast — position honest, bar tight' },
  { names: ['Clean Pull', 'Clean Pull', 'Clean Pull', 'Clean Pull'], sets: 4, reps: 3, pctStart: 105, pctStep: 2.5, targetRpe: 8, note: 'Heavy and fast — position honest, bar tight' },
  { names: ['Clean Pull', 'Clean Pull', 'Clean Pull', 'Clean Pull'], sets: 3, reps: 2, pctStart: 110, pctStep: 3, targetRpe: 8, note: 'Heavy and fast — position honest, bar tight' },
]
// Speed-strength slot: box squat at dynamic-effort loads. Dead stop on the box
// kills the stretch reflex — force from zero, max RFD. Autoreg anchors low:
// this should never feel heavy; if bar speed dies the session is over.
const D5_SPEED_SQUAT: SlotMeso[] = [
  { names: ['Speed Box Squat', 'Speed Box Squat', 'Speed Box Squat', 'Speed Box Squat'], sets: 5, reps: 2, pctStart: 55, pctStep: 2, targetRpe: 6, note: 'Box at parallel. Sit, pause, EXPLODE. If bar speed dies, stop.' },
  { names: ['Speed Box Squat', 'Speed Box Squat', 'Speed Box Squat', 'Speed Box Squat'], sets: 5, reps: 2, pctStart: 60, pctStep: 2, targetRpe: 6, note: 'Box at parallel. Sit, pause, EXPLODE. If bar speed dies, stop.' },
  { names: ['Speed Box Squat', 'Speed Box Squat', 'Speed Box Squat', 'Speed Box Squat'], sets: 4, reps: 2, pctStart: 64, pctStep: 2, targetRpe: 6, note: 'Box at parallel. Sit, pause, EXPLODE. If bar speed dies, stop.' },
]

// ── Day 6 — Sat: heavy conventional DL + overhead + plyos + metcon ────────────
// Conventional deadlift off its own 1RM — the strength driver. Positional
// pulling stays honest via Mon snatch pulls + Fri clean pulls.
const D6_DL: SlotMeso[] = [
  { names: ['Deadlift', 'Deadlift', 'Deadlift', 'Deadlift'], sets: 4, reps: 4, pctStart: 70, pctStep: 2.5 },
  { names: ['Deadlift', 'Deadlift', 'Deadlift', 'Deadlift'], sets: 4, reps: 3, pctStart: 78, pctStep: 2.5 },
  { names: ['Deadlift', 'Deadlift', 'Deadlift', 'Deadlift'], sets: 3, reps: 2, pctStart: 85, pctStep: 2 },
]

// Saturday overhead: strict press wave — the dedicated overhead-STRENGTH slot.
// The jerk is fully retired (was triple-booked); Wednesday push press owns
// overhead power, this owns the grind. Keyed to its own ohp max.
const D6_OHP: SlotMeso[] = [
  { names: ['Overhead Press', 'Overhead Press', 'Overhead Press', 'Overhead Press'], sets: 4, reps: 6, pctStart: 67, pctStep: 2, targetRpe: 7, note: 'Strict — no leg drive, glutes tight' },
  { names: ['Overhead Press', 'Overhead Press', 'Overhead Press', 'Overhead Press'], sets: 4, reps: 4, pctStart: 75, pctStep: 2, targetRpe: 8, note: 'Strict — no leg drive, glutes tight' },
  { names: ['Overhead Press', 'Overhead Press', 'Overhead Press', 'Overhead Press'], sets: 4, reps: 2, pctStart: 83, pctStep: 1.5, targetRpe: 8, note: 'Strict — no leg drive, glutes tight' },
]

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

// Wednesday's ballistic slot: trap bar jumps, contrast-paired with front squat.
// Ballistic = no deceleration phase; ~20-30% of BS sits at peak power output.
function trapBarJumps(pos: MacroPos, maxes: Record<string, number>): PlyoPrescription {
  const bs = maxes['back_squat']
  const load = bs ? `${Math.round((bs * 0.25) / 5) * 5} lb (~25% BS)` : '~25% of back squat'
  const sets = pos.meso === 3 ? 3 : 4
  return { kind: 'plyo', slot: 'tb_jump', name: 'Trap Bar Jump', sets, reps: 3, superset: 'fs_contrast', note: `Load ${load}. Jump for HEIGHT, land soft, reset each rep. Pair ~30s after each front squat set.` }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Day builders
// ═══════════════════════════════════════════════════════════════════════════════

const DELOAD_NOTE = 'Deload — bar speed crisp, leave feeling fresh'

const DELOAD_CLASSIC_PCT = 65 // deload is recovery, not a working set — light
                              // technique work is exempt from the ≥80 rule.
function applyDeload(p: LiftPrescription): LiftPrescription {
  // Classic lifts deload to a crisp 65%; everything else drops to 60.
  const pct = p.maxKey && isClassicLiftSlot(p.slot, p.maxKey) ? DELOAD_CLASSIC_PCT : 60
  return {
    ...p,
    sets: Math.max(2, Math.ceil(p.sets / 2)),
    percent: p.percent != null ? pct : undefined,
    targetRpe: p.targetRpe != null ? 6 : undefined, // deload should FEEL easy — keep autoreg honest
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
      dayNumber, dayName: 'TEST — Power Snatch 1RM', dayType: 'test',
      sessionIntent: 'Work to a new 1RM power snatch. Take your time between attempts.',
      items: [
        { kind: 'lift', slot: 'test_snatch', name: 'Snatch — work to 1RM', sets: 8, reps: 1, note: 'Climb 60/70/78/85/90/95%+ then PR attempts. Log the top single and update your Snatch max — it anchors next macro.' },
        accessory('test_acc', 'Easy bike flush', 1, 10, '10 min easy spin after'),
      ],
    },
    3: {
      dayNumber, dayName: 'TEST — Power Clean 1RM', dayType: 'test',
      sessionIntent: 'Work to a new 1RM power clean.',
      items: [
        { kind: 'lift', slot: 'test_clean', name: 'Clean — work to 1RM (no jerk)', sets: 8, reps: 1, note: 'Climb 60/70/78/85/90/95%+ then PR attempts. Log the top single and update your Clean max — it anchors next macro.' },
        accessory('test_acc', 'Easy bike flush', 1, 10, '10 min easy spin after'),
      ],
    },
    5: {
      dayNumber, dayName: 'TEST — Squat + Bench 1RMs', dayType: 'test',
      sessionIntent: 'Back squat 1RM, bench 1RM between squat rests, front squat if you have juice left.',
      items: [
        { kind: 'lift', slot: 'test_bs', name: 'Back Squat — work to 1RM', sets: 6, reps: 1, note: 'Climb 60/70/80/88/94%+ then max attempts' },
        { kind: 'lift', slot: 'test_bench', name: 'Bench Press — work to 1RM', sets: 6, reps: 1, note: 'Climb 60/70/80/88/94%+ — alternate with squat rests' },
        { kind: 'lift', slot: 'test_fs', name: 'Front Squat — work to 1RM (optional)', sets: 4, reps: 1, note: 'Only if back squat felt strong' },
      ],
    },
    6: {
      dayNumber, dayName: 'TEST — Deadlift 1RM', dayType: 'test',
      sessionIntent: 'Pull a 1RM deadlift, then the macro is complete. Update your maxes in the app.',
      items: [
        { kind: 'lift', slot: 'test_dl', name: 'Deadlift — work to 1RM', sets: 6, reps: 1, note: 'Climb 60/70/80/88/94%+ then max attempts. Belt up.' },
        { kind: 'outside', slot: 'move', title: 'Celebrate & Move', parts: ['15-20 min easy walk or spin to flush', 'Update ALL 1RMs in the app — next macro computes from the new numbers'] },
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

function buildDay(weekNumber: number, dayNumber: number, maxes: Record<string, number>, adjustments: Record<string, number> = {}, opts?: BuildDayOpts): DayPlan {
  const pos = macroPos(weekNumber)
  // Athlete-flagged fatigue deload — same treatment as the built-in W12.
  if (opts?.forceDeload && !pos.isTest) pos.isDeload = true
  if (pos.isTest) return testDay(dayNumber, maxes)

  const m = pos.meso - 1
  const w = pos.weekInMeso

  switch (dayNumber) {
    case 1: {
      let items: Prescription[] = [
        liftFromSlot('sn_top', D1_SN_TOP[m], w, 'snatch', maxes, pos.meso, adjustments),
      ]
      if (D1_SN_BACK[m].sets > 0) {
        items.push(liftFromSlot('sn_back', D1_SN_BACK[m], w, 'snatch', maxes, pos.meso, adjustments))
      }
      items.push(
        liftFromSlot('bench_heavy', D1_BENCH_HEAVY[m], w, 'bench', maxes, pos.meso, adjustments),
        liftFromSlot('snatch_pull', D1_PULL[m], w, 'snatch', maxes, pos.meso, adjustments),
        liftFromSlot('back_squat_heavy', D1_SQUAT[m], w, 'back_squat', maxes, pos.meso, adjustments),
        accessory('acc_core', 'Hanging Leg Raises', 3, 12, '60s rest'),
      )
      if (pos.isDeload) {
        items = items.map(i => (i.kind === 'lift' && i.percent != null ? withResolvedDeload(i, maxes) : i))
          .filter(i => !(i.kind === 'lift' && (i.slot === 'snatch_pull' || i.slot === 'sn_back')))
      }
      return {
        dayNumber, dayName: 'Power A — Snatch', dayType: 'gym',
        sessionIntent: pos.isDeload ? 'Deload — light, fast, out of the gym feeling fresh.' : 'Heavy snatches, heavy bench, heavy pull, heavy squat.',
        items,
      }
    }
    case 3: {
      let items: Prescription[] = [
        liftFromSlot('push_press', D3_PUSH_PRESS[m], w, 'clean_jerk', maxes, pos.meso, adjustments),
        liftFromSlot('bench', D3_BENCH[m], w, 'bench', maxes, pos.meso, adjustments, { superset: 'press_pull' }),
        { ...accessory('acc_wpu', 'Weighted Pull-Up', 4, pos.meso === 1 ? 6 : pos.meso === 2 ? 5 : 3, 'Superset with bench — add load as reps drop'), superset: 'press_pull' },
        liftFromSlot('front_squat', D3_FSQUAT[m], w, 'front_squat', maxes, pos.meso, adjustments, { superset: 'fs_contrast' }),
        trapBarJumps(pos, maxes),
        accessory('acc_single_leg', 'Rear-Foot-Elevated Split Squat', 3, pos.meso === 1 ? 8 : pos.meso === 2 ? 6 : 5, 'Per leg, DBs in hand, 90s rest'),
      ]
      // Session diet: med-ball throws + farmer carries cut — ballistic work is
      // the trap bar jumps' job, carries recur in Saturday's metcon pool.
      if (pos.isDeload) {
        items = items.filter(i => !(i.kind === 'plyo' && i.slot === 'tb_jump'))
          .map(i => (i.kind === 'lift' && i.percent != null ? withResolvedDeload(i, maxes) : i))
      }
      return {
        dayNumber, dayName: 'Athletic Strength', dayType: 'gym',
        sessionIntent: pos.isDeload ? 'Deload — light presses, no jumps, out quick.' : 'Presses, unilateral strength, and ballistic power — everything the platform can\'t give you.',
        items,
      }
    }
    case 5: {
      let items: Prescription[] = [
        liftFromSlot('cl_top', D5_CL_TOP[m], w, 'clean_jerk', maxes, pos.meso, adjustments),
      ]
      if (D5_CL_BACK[m].sets > 0) {
        items.push(liftFromSlot('cl_back', D5_CL_BACK[m], w, 'clean_jerk', maxes, pos.meso, adjustments))
      }
      items.push(
        liftFromSlot('hang_psn', D5_HPS[m], w, 'snatch', maxes, pos.meso, adjustments),
        liftFromSlot('clean_pull', D5_PULL[m], w, 'clean_jerk', maxes, pos.meso, adjustments),
        liftFromSlot('speed_squat', D5_SPEED_SQUAT[m], w, 'back_squat', maxes, pos.meso, adjustments),
        accessory('acc_pullup', 'Pull-Up', 3, 8, 'Add weight if 8 is easy'),
      )
      if (pos.isDeload) {
        items = items.map(i => (i.kind === 'lift' && i.percent != null ? withResolvedDeload(i, maxes) : i))
          .filter(i => !(i.kind === 'lift' && (i.slot === 'clean_pull' || i.slot === 'cl_back')))
      }
      return {
        dayNumber, dayName: 'Power B — Clean', dayType: 'gym',
        sessionIntent: pos.isDeload ? 'Deload — a few crisp doubles, nothing else.' : 'Heavy cleans, hang snatch for speed, heavy pull, speed squats.',
        items,
      }
    }
    case 6: {
      const dl = liftFromSlot('sat_dl', D6_DL[m], w, 'deadlift', maxes, pos.meso, adjustments)
      const dips = accessory('acc_dips', 'Dips', 3, pos.meso === 1 ? 10 : pos.meso === 2 ? 8 : 6,
        'Bodyweight+ — add load when every rep is crisp; log added lbs as the weight')
      let items: Prescription[] = [dl, liftFromSlot('ohp_press', D6_OHP[m], w, 'ohp', maxes, pos.meso, adjustments), dips, ...saturdayPlyo(pos)]
      if (pos.isDeload) {
        items = [
          withResolvedDeload(dl, maxes),
          { kind: 'plyo', slot: 'plyo', name: 'Box Jumps', sets: 3, reps: 3, note: 'Easy height, springy' },
          { kind: 'outside', slot: 'metcon_sub', title: 'Easy Flush', parts: ['8-10 min easy row or Aerodyne — Z2, nothing hard'] },
        ]
      } else {
        const mc = METCON_POOL[(weekNumber - 1) % METCON_POOL.length]
        items.push({ kind: 'metcon', slot: 'metcon', ...mc })
      }
      return {
        dayNumber, dayName: 'Power + Engine', dayType: 'gym',
        sessionIntent: pos.isDeload ? 'Deload — move, don\'t grind.' : 'Heavy deadlift, explosive jumps, then the week\'s metcon.',
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
  tagline: 'Olympic power · sprinting · engine',
  description:
    '2 power days built on the Olympic lifts (power variants only — no technique work), an athletic strength day, and a power/engine day in the gym, plus sprint work and two conditioning sessions outside. 13-week macro, deload week 12, test week 13.',
  daysPerWeek: 7,
  gymDayNumbers: [1, 3, 5, 6],
  macroWeeks: 13,
  requiredMaxes: [
    { key: 'snatch', label: 'Snatch', hint: 'Best full-lift single — all snatch work keys off this' },
    { key: 'clean_jerk', label: 'Clean', hint: 'Best clean single — all clean work keys off this' },
    { key: 'back_squat', label: 'Back Squat', hint: 'Best recent single (lbs)' },
    { key: 'front_squat', label: 'Front Squat', hint: 'Best recent single (lbs)' },
    { key: 'bench', label: 'Bench Press', hint: 'Best recent single (lbs)' },
    { key: 'deadlift', label: 'Deadlift', hint: 'Best recent single (lbs)' },
    { key: 'ohp', label: 'Overhead Press', hint: 'Strict press single — estimate: best 5×5 × 1.15' },
  ],
  buildDay,
}
