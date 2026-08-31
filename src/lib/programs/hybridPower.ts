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
// the full clean. Speed lives in Monday's sub-max snatch back-offs and the
// Friday speed box squats. Overhead is
// push press (Wed, power) + strict OHP wave (Sat, strength) — jerk retired.
// Percent rules: pure lifts ≤2 reps ≥80% on the TOP sets (a *_back slot takes
// the 75 doubles floor instead — see classicFloor); any ≤2-rep set ≥75%;
// power/hang triples ≥65%. Clean pulls (Fri) key off the clean max in every
// meso, heavy (100-119%);
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
//       Thu conditioning · Fri Power B (clean) · Sat power + engine · Sun REST.
// Sunday's steady Z2 was cut in FOR-195 (2026-08-30): seven sessions with no
// valley in them was the structural reason fatigue accumulated, and it was the
// session the card itself told him to skip. daysPerWeek is 6.
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
function classicFloor(name: string, reps: number, slot?: string): number {
  const n = name.trim().toLowerCase()
  // Block work is a full-lift expression from a raised start — it follows the
  // SAME rules as the pure lift (a light block double trains nothing). Hangs
  // may run a touch lighter (they fall through to the lower floors).
  const isFullLift = n === 'snatch' || n === 'clean' || n === 'clean & jerk' || /block/.test(n)
  // ...but the 80 floor governs the lift's own WORKING sets, not the volume
  // that follows them. A *_back slot is the back-off: same bar, immediately
  // after the top set, deliberately lighter. M2's snatch back-offs have run
  // at 75 since this macro was written and only cleared the floor because
  // they were named 'Hang Snatch' — a naming artefact, not a training rule.
  // FOR-195 gives M1 the same structure with the PURE lift at the same 75,
  // so the exemption belongs to the slot rather than the word. The 75 floor
  // below still applies: a back-off is lighter, never light.
  const isBackOff = slot != null && slot.endsWith('_back')
  if (isFullLift && reps <= 2 && !isBackOff) return 80
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
    const floor = classicFloor(def.names[weekInMeso - 1], def.reps, slot)
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

/**
 * A range-based slot — double progression instead of a percentage.
 *
 * Ported from dadBuilt (FOR-175 built the machinery; this is the first slot
 * in THIS program to use it). Dumbbells have no barbell 1RM to take a
 * percentage of: 4 × 8-10 with 60s in each hand is a real prescription,
 * `72% of your bench` is not. So the load comes from what was actually
 * logged — hold it until every set clears the top of the window, then add a
 * step.
 *
 * `reps` carries the BOTTOM of the window so any consumer reading a plain
 * number still shows something true.
 *
 * The load only arrives if buildDay is handed opts.loadTargets. Without that
 * one line the slot prints with no weight forever and every check still
 * passes — the exact FOR-175 failure mode.
 */
function rangeSlot(
  slot: string, name: string, sets: number, window: [number, number],
  loadTargets: Record<string, number>,
  opts?: { rir?: number; step?: number; note?: string; superset?: string },
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

// ── Conditioning (Thu) ────────────────────────────────────────────────────────
// Thursday ran the same interval session every working week for twelve weeks —
// one shape, one energy system, graded only by meso. The engine wants more
// than the top end, so the week-in-meso now selects the session and each meso
// runs one full cycle:
//
//   W1  intervals        top-end, meso-graded (the session that was here)
//   W2  threshold        the sustainable-hard piece nothing else trained
//   W3  distance         one genuinely long aerobic effort
//   W4  mixed-erg tempo  alternating blocks, moderate — the lightest of the four
//
// W4 landing lightest is deliberate: it is the top week of every meso, so the
// heaviest barbell work of the block already sits around it. And deload (W12)
// and test (W13) are both weekInMeso 4, so they short-circuit above this and
// keep their recovery spin regardless.
function thursdayConditioning(weekNumber: number, pos: MacroPos): OutsideSession {
  if (pos.isDeload || pos.isTest) {
    return {
      kind: 'outside', slot: 'cond_intervals', title: 'Easy Spin (recovery)',
      parts: ['25-30 min very easy bike or jog — conversational pace'],
    }
  }

  if (pos.weekInMeso === 1) {
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

  if (pos.weekInMeso === 2) {
    // Threshold is the one the intervals never covered: comfortably HARD, held.
    // Rowing because it loads the posterior chain and the lats — the opposite
    // half of the body from a week of pressing and squatting.
    const byMeso: Record<number, string> = {
      1: '2 × 8 min @ threshold, 3 min easy between',
      2: '2 × 10 min @ threshold, 3 min easy between',
      3: '3 × 8 min @ threshold, 3 min easy between',
    }
    return {
      kind: 'outside', slot: 'cond_threshold',
      title: 'Lactate Threshold — Row',
      parts: ['10 min easy warm-up', byMeso[pos.meso], '5 min easy cooldown'],
      note: 'Comfortably hard — a pace you could hold for 30 min if you had to, not one you are surviving. If the split falls off inside the first two minutes you went out too hot.',
    }
  }

  if (pos.weekInMeso === 3) {
    return {
      kind: 'outside', slot: 'cond_distance',
      title: 'Distance — Steady',
      parts: [
        '40-50 min continuous, Z2 into low Z3',
        'Any modality — bike, row, run, ruck. Pick the one your legs will forgive on Friday',
      ],
      note: 'One effort, no intervals. This is the aerobic base the other three weeks spend.',
    }
  }

  return {
    kind: 'outside', slot: 'cond_tempo',
    title: 'Mixed-Erg Tempo',
    parts: [
      '8 min easy warm-up, alternating machines',
      '4 rounds: 3 min bike @ tempo + 3 min row @ tempo — no rest at the changeover',
      '5 min easy cooldown',
    ],
    note: 'Tempo, not threshold — you should finish each round able to talk in short sentences. The changeover is the session: 15 seconds to move, then straight back to pace.',
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
// at 80%+. Speed lives in Friday's box squats, and in M1 in the 65-70%
// warm-up singles below.
//   M1 straight heavy doubles · M2 top double + back-offs · M3 top single.
const D1_SN_TOP: SlotMeso[] = [
  // FOR-195: 4×2 → 2×2. The volume did not vanish, it moved down a slot: the
  // new back-offs below are 3×2 at 75-78, which is more total snatch than the
  // two sets that came off — and sub-maximal, which is what M1 was missing.
  // The 65-70% warm-up singles note goes with them: it was a patch for a meso
  // with no sub-max snatch in it, and the back-offs are the real fix.
  { names: ['Snatch', 'Snatch', 'Snatch', 'Snatch'], sets: 2, reps: 2, pctStart: 80, pctStep: 1, targetRpe: 8, note: 'Build in singles, then two heavy working doubles — full lift, no fluff' },
  { names: ['Snatch', 'Snatch', 'Snatch', 'Snatch'], sets: 1, reps: 2, pctStart: 83, pctStep: 1, targetRpe: 8, note: 'Build to this top double — singles on the way up' },
  { names: ['Snatch', 'Snatch', 'Snatch', 'Snatch'], sets: 1, reps: 1, pctStart: 87, pctStep: 1.5, targetRpe: 8, note: 'Build to this top single' },
]
// M2 back-offs move to the hang — same full-depth catch (heavy expression
// preserved), new position, legal under the ≥75 doubles rule. M3 snaps back
// to the pure lift for realization.
const D1_SN_BACK: SlotMeso[] = [
  // M1 gains the top+back structure M2/M3 already had. The PURE lift, not the
  // hang — M1 is the pure-lift meso, and the hang belongs to M2's variation
  // brief. 75 is the doubles floor, so these are the lightest legal full-snatch
  // doubles in the program: real sub-maximal exposure, which is the point.
  { names: ['Snatch', 'Snatch', 'Snatch', 'Snatch'], sets: 3, reps: 2, pctStart: 75, pctStep: 1, targetRpe: 7, note: 'Back-off doubles — full lift, sharp and fast. These are the speed work, not a grind' },
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
  { names: ['Back Squat', 'Back Squat', 'Back Squat', 'Back Squat'], sets: 4, reps: 5, pctStart: 70, pctStep: 2 },
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
// Wednesday's press is DUMBBELLS in every meso (FOR-195 item 4). Monday keeps
// the barbell as the heavy anchor; this slot was the volume day, and volume is
// what dumbbells are for — more range at the bottom, each side honest, and
// nothing to strip when the rack is busy.
//
// It is also the first slot in this program to leave the percent engine. A DB
// load has no barbell 1RM behind it, so it progresses by DOUBLE PROGRESSION:
// hold the pair until every set clears the top of the window, then +5 lb per
// hand. The windows tighten across the macro the way the percentages used to.
const D3_DB_BENCH: Array<{ sets: number; window: [number, number] }> = [
  { sets: 4, window: [8, 10] },
  { sets: 4, window: [6, 8] },
  { sets: 3, window: [5, 6] },
]
// M2 rotates to the pause front squat — contrast from a dead stop is the
// best version of the jump pairing (strength lifts may pause; the oly
// technique ban is about the classic lifts, not squats).
const D3_FSQUAT: SlotMeso[] = [
  // FOR-195: M1/M2 down to 3 sets, matching M3. Wednesday is the day the
  // clock beats him, and the front squat is contrast-paired with jumps — each
  // set costs two movements and a walk to the trap bar.
  { names: ['Front Squat', 'Front Squat', 'Front Squat', 'Front Squat'], sets: 3, reps: 5, pctStart: 72, pctStep: 2, note: 'Contrast: trap bar jumps ~30s after each set' },
  { names: ['Pause Front Squat', 'Pause Front Squat', 'Pause Front Squat', 'Pause Front Squat'], sets: 3, reps: 3, pctStart: 70, pctStep: 2, note: '2-count dead stop in the hole, then UP — trap bar jumps ~30s after each set' },
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
// FOR-195 item 8: more heavy clean volume, all of it in the BACK-OFFS. Andrew
// asked for the extra sets on the primary where there are no back-offs, which
// would have put M1 at 6×2 and failed the 4-set ceiling he ratified himself
// two days earlier. Same volume, one slot down: +2 sets in M1 and M2, +3 in
// M3, and no slot goes past 4.
const D5_CL_BACK: SlotMeso[] = [
  { names: ['Power Clean', 'Power Clean', 'Power Clean', 'Power Clean'], sets: 2, reps: 2, pctStart: 76, pctStep: 0, targetRpe: 7, note: 'Back-off doubles — off the floor, stay sharp' },
  { names: ['Power Clean', 'Power Clean', 'Power Clean', 'Power Clean'], sets: 4, reps: 2, pctStart: 80, pctStep: 0, targetRpe: 7, note: 'Back-off doubles — off the floor, stay sharp' },
  { names: ['Power Clean', 'Power Clean', 'Power Clean', 'Power Clean'], sets: 4, reps: 1, pctStart: 83, pctStep: 1, targetRpe: 7, note: 'Back-off singles — off the floor, stay sharp' },
]
// Clean pulls in EVERY meso (FOR-195 item 6). M2 used to rotate to snatch
// pulls, which was the snatch's only heavy pulling — but the snatch has left
// Friday entirely now and lives on Monday, so a snatch pull on the clean day
// was the last thing keeping two lifts on one session. The percentages carry
// the M1→M3 ramp continuously instead of resetting across a lift change:
//   M1  100 → 106  (4s)      M2  102 → 109.5 (3s)      M3  110 → 119 (2s)
// M2 keeps its own step (2.5) because it now has to bridge M1's 106 to M3's
// 110 rather than starting over on a different max.
const D5_PULL: SlotMeso[] = [
  { names: ['Clean Pull', 'Clean Pull', 'Clean Pull', 'Clean Pull'], sets: 3, reps: 4, pctStart: 100, pctStep: 2, targetRpe: 8, note: 'Heavy and fast — position honest, bar tight' },
  { names: ['Clean Pull', 'Clean Pull', 'Clean Pull', 'Clean Pull'], sets: 3, reps: 3, pctStart: 102, pctStep: 2.5, targetRpe: 8, note: 'Heavy and fast — position honest, bar tight' },
  { names: ['Clean Pull', 'Clean Pull', 'Clean Pull', 'Clean Pull'], sets: 3, reps: 2, pctStart: 110, pctStep: 3, targetRpe: 8, note: 'Heavy and fast — position honest, bar tight' },
]
// Speed-strength slot: box squat at dynamic-effort loads. Dead stop on the box
// kills the stretch reflex — force from zero, max RFD. Autoreg anchors low:
// this should never feel heavy; if bar speed dies the session is over.
const D5_SPEED_SQUAT: SlotMeso[] = [
  // M1 runs triples (FOR-195 item 10) — the lightest wave of the three, so the
  // extra rep costs seconds and buys bar-speed reps. Velocity slot, so the
  // 4-set ceiling does not apply: 5×3 @ 55% is the sub-maximal work the rule
  // explicitly exempts.
  { names: ['Speed Box Squat', 'Speed Box Squat', 'Speed Box Squat', 'Speed Box Squat'], sets: 5, reps: 3, pctStart: 55, pctStep: 2, velocity: true, note: 'Box at parallel. Sit, pause, EXPLODE. A set slower off the box than the last one ends the exercise.' },
  { names: ['Speed Box Squat', 'Speed Box Squat', 'Speed Box Squat', 'Speed Box Squat'], sets: 5, reps: 2, pctStart: 60, pctStep: 2, velocity: true, note: 'Box at parallel. Sit, pause, EXPLODE. A set slower off the box than the last one ends the exercise.' },
  { names: ['Speed Box Squat', 'Speed Box Squat', 'Speed Box Squat', 'Speed Box Squat'], sets: 4, reps: 2, pctStart: 64, pctStep: 2, velocity: true, note: 'Box at parallel. Sit, pause, EXPLODE. A set slower off the box than the last one ends the exercise.' },
]

// ── Day 6 — Sat: heavy conventional DL + overhead + plyos + metcon ────────────
// Conventional deadlift off its own 1RM — the strength driver. Positional
// pulling stays honest via Mon snatch pulls + Fri clean pulls.
// M2 pulls from a DEFICIT (FOR-195 item 11) — the variation meso finally
// reaches the deadlift, which the config had already blessed ("deficit
// deadlifts are legal for future mesos"). Stand on a plate, 1.5-2 inches. The load
// drops from 78 to 72 because a deficit at the same percentage is not the same
// lift: the extra range is the stimulus, and matching the conventional number
// would just be a harder deadlift done worse.
const D6_DL: SlotMeso[] = [
  { names: ['Deadlift', 'Deadlift', 'Deadlift', 'Deadlift'], sets: 4, reps: 4, pctStart: 70, pctStep: 2.5 },
  { names: ['Deficit Deadlift', 'Deficit Deadlift', 'Deficit Deadlift', 'Deficit Deadlift'], sets: 4, reps: 3, pctStart: 72, pctStep: 2.5, note: 'Stand on a plate — 1.5-2\" deficit. Same bar path, longer pull. Percentages are of your conventional max and deliberately lighter for it.' },
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

// Monday's ballistic slot (EVERY meso since FOR-195): broad jumps — horizontal
// power to balance the vertical jumps on Friday and Saturday, and the quality
// that feeds acceleration. Moved off the sprint day at the athlete's request.
// M2 therefore has broad jumps on Monday AND in saturdayPlyo. That is known
// and accepted: Saturday's are fatigued end-of-week jumps in a pair, Monday's
// are the fresh single-quality set.
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
function trapBarJumps(maxes: Record<string, number>): PlyoPrescription {
  const bs = maxes['back_squat']
  const load = bs ? `${Math.round((bs * 0.25) / 5) * 5} lb (~25% BS)` : '~25% of back squat'
  // 3×3 in every meso (FOR-195 item 5): the front squat is 3 sets everywhere
  // now, and the jumps are its contrast pair — one jump set per squat set.
  return { kind: 'plyo', slot: 'tb_jump', name: 'Trap Bar Jump', sets: 3, reps: 3, superset: 'fs_contrast', note: `Load ${load}. Jump for HEIGHT, land soft, reset each rep. Pair ~30s after each front squat set.` }
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
  // Day 7 included: test week ends on Saturday's deadlift like every other week.
  return { dayNumber, dayName: 'Rest', dayType: 'rest', sessionIntent: 'Rest. The macro is done.', items: [] }
}

function buildDay(weekNumber: number, dayNumber: number, maxes: Record<string, number>, adjustments: Record<string, number> = {}, opts?: BuildDayOpts): DayPlan {
  const pos = macroPos(weekNumber)
  // Athlete-flagged fatigue deload — same treatment as the built-in W12.
  if (opts?.forceDeload && !pos.isTest) pos.isDeload = true
  if (pos.isTest) return testDay(dayNumber, maxes)

  const m = pos.meso - 1
  const w = pos.weekInMeso
  // Double-progression loads for range-based slots, computed by the caller
  // from what was actually logged. Without this line Wednesday's DB bench
  // renders with no weight forever — the FOR-175 failure mode.
  const lt = opts?.loadTargets ?? {}

  switch (dayNumber) {
    case 1: {
      // Broad jumps open the day in EVERY meso (FOR-195 item 2) — a primer,
      // not a competing lift. They were M2-only, which meant two thirds of the
      // macro had no horizontal power in it at all.
      let items: Prescription[] = [broadJumps()]
      items.push(
        // Squat-priority day: the back squat leads the barbell work — fresh
        // legs go to strength. Snatch follows (80%+ doubles tolerate
        // pre-fatigue; the weight-follow autoreg tracks what actually gets
        // loaded).
        liftFromSlot('back_squat_heavy', D1_SQUAT[m], w, 'back_squat', maxes, pos.meso, adjustments),
        liftFromSlot('sn_top', D1_SN_TOP[m], w, 'snatch', maxes, pos.meso, adjustments),
      )
      // Every meso has snatch back-offs now (FOR-195 item 1) — the guard that
      // used to skip M1's empty slot went with them.
      items.push(liftFromSlot('sn_back', D1_SN_BACK[m], w, 'snatch', maxes, pos.meso, adjustments))
      items.push(
        liftFromSlot('bench_heavy', D1_BENCH_HEAVY[m], w, 'bench', maxes, pos.meso, adjustments),
        // Knee-flexion hamstring work — the one pattern pulls/DL don't cover.
        // Snatch pull slot retired for this (positions still trained: full
        // snatch here, the Fri speed-oly slot, clean pulls Fri at 100-116%).
        accessory('acc_nordic', 'Nordic Curl', 3, 5, 'Heels under a lat-pulldown pad or loaded bar. Slow lower, push-up assist back up. Swap for Romanian Deadlift if needed.'),
      )
      // Core RELOCATED to Saturday (FOR-195 items 3 + 11b). Monday is the
      // longest gym day and the one the broad jumps just joined, so the block
      // it sheds is the one that needs a fresh athlete least. Core did not
      // leave the program — Saturday runs it as dealer's choice.
      if (pos.isDeload) {
        items = items.map(i => (i.kind === 'lift' && i.percent != null ? withResolvedDeload(i, maxes) : i))
          .filter(i => !(i.kind === 'lift' && i.slot === 'sn_back'))
          .filter(i => !(i.kind === 'plyo' && i.slot === 'broad_jump'))
      }
      return {
        dayNumber, dayName: 'Power A — Snatch', dayType: 'gym',
        sessionIntent: pos.isDeload ? 'Deload — light, fast, out of the gym feeling fresh.' : 'Jump, then squat. Heavy snatch doubles into sub-max back-offs, bench, hamstrings.',
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
        trapBarJumps(maxes),
        rangeSlot('db_bench', 'DB Bench Press', D3_DB_BENCH[m].sets, D3_DB_BENCH[m].window, lt, {
          step: 5,
          superset: 'press_pull',
          note: 'Weight is PER HAND. Superset with weighted pull-ups. Hold the pair until every set clears the top of the range, then take the next pair up.',
        }),
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
          // Range work has no percent to cut, so the deload has to reach it by
          // sets instead — otherwise the barbell drops to 60% while the DB
          // bench still asks for four sets at the top of the window.
          .map(i => (i.kind === 'lift' && i.repRange ? { ...i, sets: 2, note: DELOAD_NOTE } : i))
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
        // (The hang power snatch used to sit here. Removed 2026-08-27: it cost
        //  more clock than the speed squat despite fewer sets — platform,
        //  bumpers and long rests against 5x2 @55% off a box with 45-60s
        //  turnarounds. FOR-195 finished the job: the snatch is Monday-only
        //  now, carried by that day's new sub-max back-offs.)
        // 2. THE CLEAN, and it goes second (FOR-195 item 7). This deliberately
        //    un-does part of the fast-to-heavy ordering that put the speed
        //    squat ahead of it — Andrew's call, and largely moot with the
        //    snatch gone: the day is clean-primary now, so the primary gets
        //    the fresh slot the way the squat does on Monday.
        liftFromSlot('cl_top', D5_CL_TOP[m], w, 'clean_jerk', maxes, pos.meso, adjustments),
        // 3. Back-offs, same bar, straight after the top set.
        liftFromSlot('cl_back', D5_CL_BACK[m], w, 'clean_jerk', maxes, pos.meso, adjustments),
      ]
      items.push(
        // 4. Dynamic-effort squat off the box — stretch reflex killed, force
        //    from zero. Clamped to its band; never chased upward by autoreg.
        //    Still velocity: true, so autoreg never chases it while fatigued —
        //    which matters more now that it follows the heavy clean.
        liftFromSlot('speed_squat', D5_SPEED_SQUAT[m], w, 'back_squat', maxes, pos.meso, adjustments),
        // 5. Heavy pull, unchanged at 100-119%.
        liftFromSlot('clean_pull', D5_PULL[m], w, 'clean_jerk', maxes, pos.meso, adjustments),
        // 6. The program's ONLY horizontal pulling, against five pressing
        //    exposures a week — so M2 and M3 both row. Deliberately last: this
        //    is the designated overflow block, the one to cut when the clock
        //    beats you. Nothing above it is optional.
        // FOR-195 item 9: M1's vertical pull-up becomes a ROW, so all three
        // mesos are horizontal here. Wednesday already owns the vertical pull
        // (weighted pull-ups, every meso) — this slot exists to answer the
        // week's five pressing exposures, and it could not do that while one
        // meso in three duplicated Wednesday.
        pos.meso === 1 ? accessory('acc_pullup', 'Seated Cable Row', 3, 10, 'Chest tall, drive the elbows back, no torso swing. Cut this block first if the clock beats you.')
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
          : 'Jumps to open, then the clean and its back-offs. Speed squats and the pull to finish.',
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
      // Core lives here now (FOR-195 item 11b), and it is deliberately
      // UNTRACKED: no rep range, no double progression, no max. Andrew rotates
      // core work by feel and always has — prescribing one movement just means
      // he substitutes it, so the rotation IS the prescription. Three sets is
      // the only part the program insists on.
      const core = accessory('acc_core', "Core — Dealer's Choice", 3, 10,
        'Any core movement you want today — leg raises, Pallof, ab wheel, weighted carry, plank. 10-15 reps (or 30-45s if it is a hold). Pick it when you get there; just do the three sets.')
      let items: Prescription[] = [liftFromSlot('ohp_press', D6_OHP[m], w, 'ohp', maxes, pos.meso, adjustments), dl, dips, core, ...saturdayPlyo(pos)]
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
        sessionIntent: pos.isDeload ? 'Deload — move, don\'t grind.' : 'Strict press first, then heavy deadlift, dips, core, jumps, and the week\'s metcon.',
        items,
      }
    }
    case 2:
      return { dayNumber, dayName: 'Speed Day', dayType: 'outside', sessionIntent: 'Speed work — quality over quantity, full recoveries.', items: [sprintSession(weekNumber, pos)] }
    case 4: {
      // The session rotates now, so the day is named after whatever it is.
      const cond = thursdayConditioning(weekNumber, pos)
      return { dayNumber, dayName: cond.title, dayType: 'outside', sessionIntent: 'Engine work.', items: [cond] }
    }
    // Day 7 is a REST day (FOR-195 item 12). Sunday's steady Z2 was the
    // seventh session in a week with no valley in it, and the one the athlete
    // was most often skipping anyway — the card told him so in writing. Cutting
    // it outright is the honest version of that, and it is most of the ~40-55
    // min/week this revision gives back. daysPerWeek drops to 6 with it, so no
    // surface renders a seventh slot at all.
    case 7:
    default:
      return { dayNumber, dayName: 'Rest', dayType: 'rest', sessionIntent: 'Rest. Nothing to log — the week ended on Saturday.', items: [] }
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
    'Two Olympic days — heavy full snatch and power clean, zero technique drills — plus an athletic strength day and a power/engine day in the gym, then a rotating speed day and one conditioning session outside. Six days: Sunday is off. Every gym day caps at 6 blocks. 13-week macro: three mesos that vary the middle and realise on the pure lifts, deload week 12, test week 13. Flag a deload any week you need one.',
  daysPerWeek: 6,
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
