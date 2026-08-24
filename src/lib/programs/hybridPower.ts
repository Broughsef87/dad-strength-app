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
// POWER DAD — athletic power, not weightlifting
//
// The FULL snatch (Mon) and the POWER clean (Fri) are the heavy expression —
// zero technique work (no pauses, tempos, complexes, receiving drills), just
// heavy doubles and singles at 80%+ of the FULL-lift maxes. The clean side is
// powers by the athlete's call, but the percentages stayed where the full
// clean had them: %-of-power-max under-loads him, so the reference max stays
// the full clean. Speed lives in the Friday hang/power snatch slot (triples,
// 65-74%) and the speed box squats. Overhead is
// push press (Wed, power) + strict OHP wave (Sat, strength) — jerk retired.
// Percent rules: pure lifts ≤2 reps ≥80%; any ≤2-rep set ≥75%; power/hang
// triples ≥65%. Clean pulls (Fri) key off the clean max, heavy (100-116%);
// Monday is squat-priority (squat leads) with Nordics as the hamstring slot.
//
// 13-week macro: 3 × 4-week mesos + test week.
//   Meso 1 (W1-4):   straight heavy doubles @ 80-83%
//   Meso 2 (W5-8):   top double (83-86%) + back-off doubles @ 80%
//   Meso 3 (W9-12):  top single (87-91%) + back-off singles @ 83-85%.
//                    W12 = deload. W13 = TEST (Snatch, Clean, squats, bench, DL).
// Variation model ("variation isn't the enemy"): vary the MIDDLE, get
// specific at the end. M2 is the variation meso — hang-position snatch
// back-offs, 1¼ bench, pause front squat, snatch pulls (off the snatch max),
// close-grip Wed bench, floor power snatch — then M3 snaps back to the pure
// lifts for realization. The top Snatch/Clean sets, OHP wave, and push press
// never rotate. Squat pausing caps at ONE pause-squat slot per week, any
// variant (currently Wed's M2 pause front squat is the one). Deficit
// deadlifts are legal for future mesos ("sometimes" — athlete, 2026-08);
// this macro keeps back squat and deadlift straight.
// Pauses/tempos are allowed on STRENGTH lifts only — the oly technique ban
// (complexes, balances, blocks, pause snatches) stands.
//
// Week: Mon Power A (snatch) · Tue sprint · Wed athletic strength ·
//       Thu conditioning · Fri Power B (clean) · Sat power + engine · Sun Z2.
// Session budget: every gym day caps at 6 BLOCKS. A back-off slot (*_back) is
// not its own block — it's the same bar, same station, immediately after the
// top set, so it costs cards but not gym time. The budget is about the clock
// ("I have a kid, I can't spend 2+ hours"), so it counts stations you set up.
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
  velocity?: boolean  // speed slot — bar speed governs, so no RPE anchor at all
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
    // Speed slots carry NO difficulty anchor. A 55-64% double SHOULD feel like
    // an RPE 4; against a target of 6 the autoreg read that honesty as "+3%
    // too light" every single week and walked the slot out of its speed band.
    targetRpe: def.velocity ? undefined : (def.targetRpe ?? MESO_TARGET_RPE[meso] ?? 8),
    appliedAdjustmentPct: adj !== 0 ? adj : undefined,
    velocity: def.velocity,
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

// ── Sprint day (Tue) — pooled, alternating accel / max-velocity bias ──────────
// Two pools instead of two fixed sessions. Odd weeks pull from the
// acceleration pool, even weeks from the max-velocity pool, and each pool
// advances one step per appearance — so the emphasis still alternates (never
// two top-speed days back to back) but the session itself keeps changing.
// NO JOGGING in any warm-up: drills only, athlete's rule.
const SPRINT_WARMUP =
  'Warm-up (no jogging): pogo hops, A-skips, B-skips, high knees, butt kicks, leg swings'
const SPRINT_COOLDOWN = 'Cooldown walk 5 min'
const NECK_ISO = 'Neck: hand-resisted isometrics — 2 × 10s each direction (front/back/sides)'

// trim = meso 3: cut the volume, never the intent.
type SprintSpec = { title: string; parts: string[]; note?: string }
type SprintBuilder = (trim: boolean) => SprintSpec

const ACCEL_POOL: SprintBuilder[] = [
  trim => ({
    title: 'Acceleration — Starts',
    parts: [`${trim ? 4 : 5} × 20-30m accelerations from a 3-point or falling start, FULL recovery (2-3 min)`],
    note: 'Every rep max intent. If quality drops, end the session.',
  }),
  trim => ({
    title: 'Sprint Projection — 2-3 Step',
    parts: [
      `${trim ? 5 : 6} × 15-20m from a 2- or 3-step walk-in, FULL recovery (2 min)`,
      'Walk the return slowly — the walk-back IS the rest',
    ],
    note: 'Projection is the whole point: push the ground back behind you, chest stays down through the first 8-10m. Out, not up.',
  }),
  trim => ({
    title: 'Resisted Starts — Sled',
    parts: [
      `${trim ? 5 : 6} × 15m sled sprint, moderate load (~10-15% bodyweight), full recovery`,
      '2 × 20m unresisted to finish — feel the contrast',
    ],
    note: 'The sled teaches the shin angle for you. If the load makes you shuffle or stand upright, strip a plate.',
  }),
  trim => ({
    title: 'Hill Sprints',
    parts: [
      `${trim ? 6 : 8} × 20m uphill, hard effort`,
      'Walk down = the recovery. Do not rush back to the bottom',
    ],
    note: 'Moderate grade — a park slope or driveway. The hill puts you in the acceleration position without you thinking about it.',
  }),
]

const MAXV_POOL: SprintBuilder[] = [
  trim => ({
    title: 'Max Velocity — Flying 20s',
    parts: [
      '2 build-up strides: one at ~80%, one at ~90%',
      `${trim ? 3 : 5} × flying 20s (20m build + 20m fly), FULL recovery (3-4 min)`,
      `${trim ? 3 : 4} × 30m bounding`,
    ],
    note: 'Tall posture, relaxed face and hands at top speed.',
  }),
  trim => ({
    title: 'Flying 10s',
    parts: [
      '2 build-up strides',
      `${trim ? 4 : 6} × flying 10s (30m build-in + 10m fly), FULL recovery (3 min)`,
      '3 × 5 hurdle hops or line hops',
    ],
    note: 'Longest build-in you can hold and still stay loose. That 10m is the fastest you will move all week — do not strain for it.',
  }),
  trim => ({
    title: 'Sprint · Float · Sprint',
    parts: [
      '2 build-up strides',
      `${trim ? 3 : 4} × (20m accelerate / 20m float / 20m re-accelerate), FULL recovery (4 min)`,
    ],
    note: 'The float is the skill — hold the speed without pressing, then pick it back up without tensing your jaw or shoulders.',
  }),
  trim => ({
    title: 'Change of Direction',
    parts: [
      `${trim ? 4 : 6} × 5-10-5 shuttle, full recovery between reps`,
      `${trim ? 3 : 4} × 20m curve runs, alternating the direction you lean`,
      '3 × 5 lateral bounds, stick each landing',
    ],
    note: 'Plant, drop the hips, go. Braking well is what makes the cut fast — the change of direction is a deceleration skill.',
  }),
]

function sprintSession(weekNumber: number, pos: MacroPos): OutsideSession {
  if (pos.isDeload || pos.isTest) {
    return {
      kind: 'outside', slot: 'sprint',
      title: pos.isTest ? 'Easy Strides (test week)' : 'Easy Strides (deload)',
      parts: [SPRINT_WARMUP, '4 × 15m relaxed strides @ ~70%', 'Full recovery walk-back'],
      note: 'Keep the legs alive, nothing more. No timing, no straining.',
    }
  }
  const isAccel = weekNumber % 2 === 1
  const pool = isAccel ? ACCEL_POOL : MAXV_POOL
  // Each pool advances once per appearance, not once per week.
  const spec = pool[Math.floor((weekNumber - 1) / 2) % pool.length](pos.meso === 3)
  return {
    kind: 'outside', slot: 'sprint', title: spec.title,
    parts: [SPRINT_WARMUP, ...spec.parts, SPRINT_COOLDOWN, NECK_ISO],
    note: spec.note,
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
  // The week has seven sessions and no valley in it — four hard gym days, a
  // speed day, intervals, and this. That's the structural reason fatigue
  // accumulates, so Sunday is the day the program gives back: shorter than it
  // was, and explicitly skippable. Volume here was never the point.
  const mins = pos.meso === 3 ? '30-40' : '35-45'
  return {
    kind: 'outside', slot: 'cond_steady', title: 'Steady Z2 — Or Rest',
    parts: [
      `${mins} min steady Z2 — bike, row, run, or ruck`,
      'Beat up? Cut it short or skip it entirely. This is the one session that owes you nothing',
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
// M2 back-offs move to the hang — same full-depth catch (heavy expression
// preserved), new position, legal under the ≥75 doubles rule. M3 snaps back
// to the pure lift for realization.
const D1_SN_BACK: SlotMeso[] = [
  { names: ['', '', '', ''], sets: 0, reps: 0, pctStart: 0, pctStep: 0 }, // M1: straight sets, no back-offs
  { names: ['Hang Snatch', 'Hang Snatch', 'Hang Snatch', 'Hang Snatch'], sets: 3, reps: 2, pctStart: 75, pctStep: 1, targetRpe: 7, note: 'From above the knee — full catch, sit in' },
  { names: ['Snatch', 'Snatch', 'Snatch', 'Snatch'], sets: 2, reps: 1, pctStart: 83, pctStep: 1, targetRpe: 7, note: 'Back-off singles' },
]
// Monday heavy bench — the week's heavy-upper anchor. Dip-drive overhead was
// triple-booked (Mon power jerk + Wed push press + Sat jerk slot); the jerk
// left Monday so pressing splits heavy (Mon) / volume (Wed) instead.
// M2 rotates to the 1¼ bench (athlete's pick — "bench press with a pump
// fake"): down, drive a quarter up, back down, then press to lockout = one
// rep. Capacity runs ~85-90% of the comp bench, so the wave sits ~8% under
// where straight triples would — M3 returns to straight bench to realize.
const D1_BENCH_HEAVY: SlotMeso[] = [
  { names: ['Bench Press', 'Bench Press', 'Bench Press', 'Bench Press'], sets: 4, reps: 4, pctStart: 75, pctStep: 2, targetRpe: 7, note: 'Heavy day — Wednesday stays the volume day' },
  { names: ['1¼ Bench Press', '1¼ Bench Press', '1¼ Bench Press', '1¼ Bench Press'], sets: 4, reps: 3, pctStart: 72, pctStep: 2, targetRpe: 8, note: 'Pump fake: down, quarter up, back down, press. That whole thing = 1 rep' },
  { names: ['Bench Press', 'Bench Press', 'Bench Press', 'Bench Press'], sets: 3, reps: 2, pctStart: 86, pctStep: 1, targetRpe: 8 },
]
// Monday's snatch pull retired (2026-07): the day is squat-priority now, and
// the freed slot went to Nordic curls — the program's only knee-flexion work.
// Positional pulling lives in Friday's clean pulls (100-116%).
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
// M2/M3 rotate to close-grip — still keyed to the comp-bench max, waved ~5%
// under the straight-bar numbers (CGB capacity ≈ low-90s% of comp bench).
// Feeds OHP lockout, the athlete's stated overhead weakness.
const D3_BENCH: SlotMeso[] = [
  { names: ['Bench Press', 'Bench Press', 'Bench Press', 'Bench Press'], sets: 4, reps: 6, pctStart: 70, pctStep: 2, note: 'Superset with weighted pull-ups' },
  { names: ['Close-Grip Bench Press', 'Close-Grip Bench Press', 'Close-Grip Bench Press', 'Close-Grip Bench Press'], sets: 4, reps: 4, pctStart: 73, pctStep: 2, note: 'Index fingers just inside the rings — elbows tucked. Superset with weighted pull-ups' },
  { names: ['Close-Grip Bench Press', 'Close-Grip Bench Press', 'Close-Grip Bench Press', 'Close-Grip Bench Press'], sets: 3, reps: 3, pctStart: 79, pctStep: 2, note: 'Index fingers just inside the rings — elbows tucked. Superset with weighted pull-ups' },
]
// M2 rotates to the pause front squat — contrast from a dead stop is the
// best version of the jump pairing (strength lifts may pause; the oly
// technique ban is about the classic lifts, not squats).
const D3_FSQUAT: SlotMeso[] = [
  { names: ['Front Squat', 'Front Squat', 'Front Squat', 'Front Squat'], sets: 4, reps: 5, pctStart: 72, pctStep: 2, note: 'Contrast: trap bar jumps ~30s after each set' },
  { names: ['Pause Front Squat', 'Pause Front Squat', 'Pause Front Squat', 'Pause Front Squat'], sets: 4, reps: 3, pctStart: 70, pctStep: 2, note: '2-count dead stop in the hole, then UP — trap bar jumps ~30s after each set' },
  { names: ['Front Squat', 'Front Squat', 'Front Squat', 'Front Squat'], sets: 3, reps: 2, pctStart: 85, pctStep: 2.5, note: 'Contrast: trap bar jumps ~30s after each set' },
]

// ── Day 5 — Oly B (Fri): power clean primary + snatch speed + pull + speed squat
// Friday mirrors Monday's shape with the power clean as the primary. No jerk —
// overhead lives on Wednesday (push press) and Saturday (strict OHP).
// POWER cleans — catch above parallel, no jerk. Percentages still key off the
// FULL clean max (athlete's locked rule: %-of-power-max under-loads him), and
// the numbers are unchanged from when this slot ran full cleans: 80-83 → 83-86
// → 87-90. Heavy by design: at the top end the catch may ride down into a
// squat clean, and that's an accepted outcome, not a missed rep — the athlete
// doesn't police power-vs-squat at these percentages. Don't taper the wave
// to keep every rep a true power.
const D5_CL_TOP: SlotMeso[] = [
  { names: ['Power Clean', 'Power Clean', 'Power Clean', 'Power Clean'], sets: 4, reps: 2, pctStart: 80, pctStep: 1, targetRpe: 8, note: 'Straight heavy doubles — catch above parallel, stand it up' },
  { names: ['Power Clean', 'Power Clean', 'Power Clean', 'Power Clean'], sets: 1, reps: 2, pctStart: 83, pctStep: 1, targetRpe: 8, note: 'Build to this top double — singles on the way up. If it rides down, ride it down and stand up.' },
  { names: ['Power Clean', 'Power Clean', 'Power Clean', 'Power Clean'], sets: 1, reps: 1, pctStart: 87, pctStep: 1.5, targetRpe: 8, note: 'Build to this top single. If it rides down, ride it down and stand up — the weight is the point up here.' },
]
// Every clean stays off the FLOOR — athlete's preference, so no hang variant
// here (the snatch side still hangs in M2). The M2 variation for this slot is
// structural instead: a top double plus back-offs, where M1 ran straight sets.
// Top set climbs 83→86 while the back-offs hold at 80 — that's the point.
const D5_CL_BACK: SlotMeso[] = [
  { names: ['', '', '', ''], sets: 0, reps: 0, pctStart: 0, pctStep: 0 },
  { names: ['Power Clean', 'Power Clean', 'Power Clean', 'Power Clean'], sets: 2, reps: 2, pctStart: 80, pctStep: 0, targetRpe: 7, note: 'Back-off doubles — off the floor, stay sharp' },
  { names: ['Power Clean', 'Power Clean', 'Power Clean', 'Power Clean'], sets: 1, reps: 1, pctStart: 83, pctStep: 1, targetRpe: 7, note: 'Back-off single' },
]
// Second snatch exposure of the week: speed-slot TRIPLES in the 65-74% zone
// (power/hang work may run lighter than 75, so 3s, never 2s). Rotates by meso:
// hang (M1) → power snatch from the floor (M2 — restores the floor-speed pull
// pattern after Monday's snatch pull was cut) → back to the hang, heavier (M3,
// shorter ROM while CNS load peaks).
const D5_HPS: SlotMeso[] = [
  { names: ['Hang Power Snatch', 'Hang Power Snatch', 'Hang Power Snatch', 'Hang Power Snatch'], sets: 3, reps: 3, pctStart: 65, pctStep: 1.5, velocity: true, note: 'From the hang. Bar speed only.' },
  { names: ['Power Snatch', 'Power Snatch', 'Power Snatch', 'Power Snatch'], sets: 3, reps: 3, pctStart: 68, pctStep: 2, velocity: true, note: 'From the floor — full pull, crisp turnover, bar speed only.' },
  { names: ['Hang Power Snatch', 'Hang Power Snatch', 'Hang Power Snatch', 'Hang Power Snatch'], sets: 2, reps: 3, pctStart: 71, pctStep: 1, velocity: true, note: 'From the hang. Bar speed only.' },
]
// M2 rotates to SNATCH pulls — the snatch otherwise gets zero heavy pulling
// (Monday's snatch pull was cut), and 102-110% of the snatch max feeds M3's
// 87-90% snatch singles directly. The call site swaps maxKey to 'snatch' for
// meso 2; M1/M3 stay clean pulls off the clean max. Slot id stays
// 'clean_pull' — autoreg continuity beats cosmetics (±8 clamp + the
// weight-follow re-anchor absorb the cross-lift handoff).
const D5_PULL: SlotMeso[] = [
  { names: ['Clean Pull', 'Clean Pull', 'Clean Pull', 'Clean Pull'], sets: 3, reps: 4, pctStart: 100, pctStep: 2, targetRpe: 8, note: 'Heavy and fast — position honest, bar tight' },
  { names: ['Snatch Pull', 'Snatch Pull', 'Snatch Pull', 'Snatch Pull'], sets: 3, reps: 3, pctStart: 102, pctStep: 2.5, targetRpe: 8, note: 'Of your SNATCH max. Heavy and fast — wide grip honest, bar tight' },
  { names: ['Clean Pull', 'Clean Pull', 'Clean Pull', 'Clean Pull'], sets: 3, reps: 2, pctStart: 110, pctStep: 3, targetRpe: 8, note: 'Heavy and fast — position honest, bar tight' },
]
// Speed-strength slot: box squat at dynamic-effort loads. Dead stop on the box
// kills the stretch reflex — force from zero, max RFD. Autoreg anchors low:
// this should never feel heavy; if bar speed dies the session is over.
const D5_SPEED_SQUAT: SlotMeso[] = [
  { names: ['Speed Box Squat', 'Speed Box Squat', 'Speed Box Squat', 'Speed Box Squat'], sets: 5, reps: 2, pctStart: 55, pctStep: 2, velocity: true, note: 'Box at parallel. Sit, pause, EXPLODE. A set slower off the box than the last one ends the exercise.' },
  { names: ['Speed Box Squat', 'Speed Box Squat', 'Speed Box Squat', 'Speed Box Squat'], sets: 5, reps: 2, pctStart: 60, pctStep: 2, velocity: true, note: 'Box at parallel. Sit, pause, EXPLODE. A set slower off the box than the last one ends the exercise.' },
  { names: ['Speed Box Squat', 'Speed Box Squat', 'Speed Box Squat', 'Speed Box Squat'], sets: 4, reps: 2, pctStart: 64, pctStep: 2, velocity: true, note: 'Box at parallel. Sit, pause, EXPLODE. A set slower off the box than the last one ends the exercise.' },
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

// Monday's ballistic slot (MESO 2 ONLY): broad jumps — horizontal power to
// balance the vertical jumps on Friday and Saturday, and the quality that
// feeds acceleration. Moved off the sprint day at the athlete's request.
//
// These OPEN the day rather than contrasting off the squat: there's no room to
// broad jump by the racks, and pairing them would mean walking away from a
// loaded bar on every set. Done first they're also the freshest jumps of the
// week (max-intent power should never be fatigued) and they prime the squat
// instead of competing with it.
function broadJumps(): PlyoPrescription {
  return { kind: 'plyo', slot: 'broad_jump', name: 'Broad Jump', sets: 4, reps: 3, note: 'Session opener — knock these out in the open floor before you claim a rack. Stick every landing, full reset between reps.' }
}

// Friday's ballistic slot: seated box jump — dead-stop concentric, zero
// stretch reflex, pure rate of force development. Shares the box with the
// speed box squat, so it runs off the same station.
function seatedBoxJumps(): PlyoPrescription {
  return { kind: 'plyo', slot: 'seated_box_jump', name: 'Seated Box Jump', sets: 4, reps: 3, note: 'Sit tall on a box, shins vertical, NO rock or rebound — explode from a dead stop onto the box. Full reset between reps.' }
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
      dayNumber, dayName: 'TEST — Snatch 1RM', dayType: 'test',
      sessionIntent: 'Work to a new 1RM snatch. Take your time between attempts.',
      items: [
        { kind: 'lift', slot: 'test_snatch', name: 'Snatch — work to 1RM', sets: 8, reps: 1, note: 'Climb 60/70/78/85/90/95%+ then PR attempts. Log the top single and update your Snatch max — it anchors next macro.' },
        accessory('test_acc', 'Easy bike flush', 1, 10, '10 min easy spin after'),
      ],
    },
    3: {
      dayNumber, dayName: 'TEST — Clean + Press 1RMs', dayType: 'test',
      sessionIntent: 'Work to a new 1RM clean, then a strict press max.',
      items: [
        { kind: 'lift', slot: 'test_clean', name: 'Clean — work to 1RM (no jerk)', sets: 8, reps: 1, note: 'Climb 60/70/78/85/90/95%+ then PR attempts. Log the top single and update your Clean max — it anchors next macro.' },
        // The OHP wave is the overhead-weakness project, and its max was never
        // retested — so next macro kept computing off the number first entered.
        { kind: 'lift', slot: 'test_ohp', name: 'Overhead Press — work to 1RM', sets: 5, reps: 1, note: 'Strict, no leg drive. Climb 60/72/82/90%+ then max attempts. Log it and update your OHP max — all of Saturday keys off it.' },
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
      // M2 only: broad jumps open the day (a primer, not a competing lift).
      let items: Prescription[] = pos.meso === 2 ? [broadJumps()] : []
      items.push(
        // Squat-priority day: the back squat leads the barbell work — fresh
        // legs go to strength. Snatch follows (80%+ doubles tolerate
        // pre-fatigue; the weight-follow autoreg tracks what actually gets
        // loaded).
        liftFromSlot('back_squat_heavy', D1_SQUAT[m], w, 'back_squat', maxes, pos.meso, adjustments),
        liftFromSlot('sn_top', D1_SN_TOP[m], w, 'snatch', maxes, pos.meso, adjustments),
      )
      if (D1_SN_BACK[m].sets > 0) {
        items.push(liftFromSlot('sn_back', D1_SN_BACK[m], w, 'snatch', maxes, pos.meso, adjustments))
      }
      items.push(
        liftFromSlot('bench_heavy', D1_BENCH_HEAVY[m], w, 'bench', maxes, pos.meso, adjustments),
        // Knee-flexion hamstring work — the one pattern pulls/DL don't cover.
        // Snatch pull slot retired for this (positions still trained: full
        // snatch here, the Fri speed-oly slot, clean pulls Fri at 100-116%).
        accessory('acc_nordic', 'Nordic Curl', 3, 5, 'Heels under a lat-pulldown pad or loaded bar. Slow lower, push-up assist back up. Swap for Romanian Deadlift if needed.'),
      )
      items.push(
        // M1/M3 train the anterior core (flexion); M2 covers ANTI-ROTATION,
        // which nothing else in the program touches now that the carries are
        // gone. Ab wheel came out because it duplicates the leg raises.
        pos.meso === 1 ? accessory('acc_core', 'Hanging Leg Raises', 3, 12, '60s rest')
          : pos.meso === 2 ? accessory('acc_core', 'Pallof Press', 3, 12, 'Per side, cable or band at chest height. Resist the twist — hips square, ribs down.')
          : accessory('acc_core', 'Weighted Hanging Leg Raise', 3, 8, 'DB between the feet — strict, no swing'),
      )
      if (pos.isDeload) {
        items = items.map(i => (i.kind === 'lift' && i.percent != null ? withResolvedDeload(i, maxes) : i))
          .filter(i => !(i.kind === 'lift' && i.slot === 'sn_back'))
          .filter(i => !(i.kind === 'plyo' && i.slot === 'broad_jump'))
      }
      return {
        dayNumber, dayName: 'Power A — Snatch', dayType: 'gym',
        sessionIntent: pos.isDeload ? 'Deload — light, fast, out of the gym feeling fresh.' : 'Squats first — build the base. Then heavy snatch doubles, bench, hamstrings.',
        items,
      }
    }
    case 3: {
      // Order is rack-driven: push press and front squat share the bar and the
      // rack, so they run back to back (with the jump contrast) before the
      // session moves to the bench.
      let items: Prescription[] = [
        liftFromSlot('push_press', D3_PUSH_PRESS[m], w, 'clean_jerk', maxes, pos.meso, adjustments),
        liftFromSlot('front_squat', D3_FSQUAT[m], w, 'front_squat', maxes, pos.meso, adjustments, { superset: 'fs_contrast' }),
        trapBarJumps(pos, maxes),
        liftFromSlot('bench', D3_BENCH[m], w, 'bench', maxes, pos.meso, adjustments, { superset: 'press_pull' }),
        { ...accessory('acc_wpu', 'Weighted Pull-Up', 4, pos.meso === 1 ? 6 : pos.meso === 2 ? 5 : 3, 'Superset with bench — add load as reps drop'), superset: 'press_pull' },
        pos.meso === 1 ? accessory('acc_single_leg', 'Rear-Foot-Elevated Split Squat', 3, 8, 'Per leg, DBs in hand, 90s rest')
          : pos.meso === 2 ? accessory('acc_single_leg', 'DB Reverse Lunge', 3, 8, 'Per leg, DBs in hand — control the descent, drive up tall, 90s rest')
          : accessory('acc_single_leg', 'Rear-Foot-Elevated Split Squat', 3, 5, 'Per leg — heavy DBs, 5s should be honest, 90s rest'),
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
      // ── THE SPEED DAY — ordered fast-to-heavy ──────────────────────────────
      // This day always held the week's speed work; it was just ordered like a
      // strength day, so every fast slot ran behind an 87-90% clean. Rate of
      // force development is a quality, not a workload: it only exists while
      // the CNS is fresh, so the jumps and the sub-75% bar speed work go first
      // and the heavy clean — strength-speed, the ceiling-raiser — goes last.
      // No load was added anywhere to achieve this. Reordering is the whole fix.
      let items: Prescription[] = [
        // 1. Unloaded RFD, freshest moment of the week. Dead-stop, no rebound.
        seatedBoxJumps(),
        // 2. THE speed-strength block: a power variant at 65-74% of the FULL
        //    snatch is the peak-power zone, and legal at 3 reps under the
        //    athlete's own floor rule (power/hang triples may go to 65%).
        liftFromSlot('hang_psn', D5_HPS[m], w, 'snatch', maxes, pos.meso, adjustments),
        // 3. Dynamic-effort squat off the box — stretch reflex killed, force
        //    from zero. Clamped to its band; never chased upward by autoreg.
        liftFromSlot('speed_squat', D5_SPEED_SQUAT[m], w, 'back_squat', maxes, pos.meso, adjustments),
        // 4. Strength-speed, not speed: the heaviest bar of the day, and now
        //    the last one. Unchanged loads — "the weight is the point up here."
        liftFromSlot('cl_top', D5_CL_TOP[m], w, 'clean_jerk', maxes, pos.meso, adjustments),
      ]
      if (D5_CL_BACK[m].sets > 0) {
        items.push(liftFromSlot('cl_back', D5_CL_BACK[m], w, 'clean_jerk', maxes, pos.meso, adjustments))
      }
      items.push(
        // 5. Heavy pull, unchanged at 100-116%.
        liftFromSlot('clean_pull', D5_PULL[m], w, pos.meso === 2 ? 'snatch' : 'clean_jerk', maxes, pos.meso, adjustments),
        // 6. The program's ONLY horizontal pulling, against five pressing
        //    exposures a week — so M2 and M3 both row. Deliberately last: this
        //    is the designated overflow block, the one to cut when the clock
        //    beats you. Nothing above it is optional.
        pos.meso === 1 ? accessory('acc_pullup', 'Pull-Up', 3, 8, 'Add weight if 8 is easy. Cut this block first if the clock beats you.')
          : pos.meso === 2 ? accessory('acc_pullup', 'Pendlay Row', 3, 8, 'Barbell dead-stops on the floor every rep. Flat back, explosive pull to the sternum. Cut this block first if the clock beats you.')
          : accessory('acc_pullup', 'Chest-Supported Row', 3, 10, 'Chest on an incline bench — strict, no bounce. Cut this block first if the clock beats you.'),
      )
      if (pos.isDeload) {
        items = items.map(i => (i.kind === 'lift' && i.percent != null ? withResolvedDeload(i, maxes) : i))
          .filter(i => !(i.kind === 'lift' && (i.slot === 'clean_pull' || i.slot === 'cl_back')))
          .filter(i => !(i.kind === 'plyo' && i.slot === 'seated_box_jump'))
      }
      return {
        dayNumber, dayName: 'Speed + Clean', dayType: 'gym',
        sessionIntent: pos.isDeload
          ? 'Deload — a few crisp doubles, nothing else.'
          : 'Fast first: jumps, snatch speed, speed squats. Then the heavy clean and the pull.',
        items,
      }
    }
    case 6: {
      const dl = liftFromSlot('sat_dl', D6_DL[m], w, 'deadlift', maxes, pos.meso, adjustments)
      const dips = accessory('acc_dips', 'Dips', 3, pos.meso === 1 ? 10 : pos.meso === 2 ? 8 : 6,
        'Bodyweight+ — add load when every rep is crisp; log added lbs as the weight')
      // OHP LEADS: overhead strength is the stated weakness, and it was sitting
      // behind a heavy deadlift at the end of the week — the worst slot in the
      // program for the thing being prioritised. Same logic as squat-first
      // Monday: the priority lift gets the fresh slot.
      let items: Prescription[] = [liftFromSlot('ohp_press', D6_OHP[m], w, 'ohp', maxes, pos.meso, adjustments), dl, dips, ...saturdayPlyo(pos)]
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
        sessionIntent: pos.isDeload ? 'Deload — move, don\'t grind.' : 'Strict press first, then heavy deadlift, jumps, and the week\'s metcon.',
        items,
      }
    }
    case 2:
      return { dayNumber, dayName: 'Speed Day', dayType: 'outside', sessionIntent: 'Speed work — quality over quantity, full recoveries.', items: [sprintSession(weekNumber, pos)] }
    case 4:
      return { dayNumber, dayName: 'Conditioning — Intervals', dayType: 'outside', sessionIntent: 'Interval engine work.', items: [thursdayConditioning(weekNumber, pos)] }
    case 7:
      return { dayNumber, dayName: 'Conditioning — Steady', dayType: 'outside', sessionIntent: 'Aerobic base.', items: [sundayConditioning(weekNumber, pos)] }
    default:
      return { dayNumber, dayName: `Day ${dayNumber}`, dayType: 'rest', sessionIntent: 'Rest.', items: [] }
  }
}

export const hybridPower: ProgramConfig = {
  // Slug stays 'hybrid-power' deliberately. It is an identifier, not branding:
  // it keys user_programs, generated_workouts and user_exercise_subs, so
  // renaming it without migrating those three tables would detach the athlete
  // from his own history. Display name is what anyone actually reads.
  slug: 'hybrid-power',
  name: 'Power Dad',
  tagline: 'Olympic power · sprinting · engine',
  description:
    'Two Olympic days — heavy full snatch and power clean, zero technique drills — plus an athletic strength day and a power/engine day in the gym, then a rotating speed day and two conditioning sessions outside. Every gym day caps at 6 blocks. 13-week macro: three mesos that vary the middle and realise on the pure lifts, deload week 12, test week 13. Flag a deload any week you need one.',
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
