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
// DAD STRONG
//
// Strength / powerlifting / strongman. 13-week macro: 3 × 4-week mesos + test.
//   Meso 1 (W1-4):   hypertrophy — 5-6s at 65-75%, build the base
//   Meso 2 (W5-8):   strength — 3-5s at 75-85%
//   Meso 3 (W9-12):  peak — 1-3s at 85-93%. W12 = deload. W13 = TEST.
//
// Week: Mon Squat · Tue Bench · Wed rest · Thu Deadlift · Fri rest ·
//       Sat Press + Strongman · Sun easy Z2 (the dad-health floor).
//
// Strongman is 24hr-Fitness-realistic: sled, heavy DBs, KBs, sandbag-or-DB —
// no yoke/log/stones fantasy programming. Rotating curated pool, like metcons.
//
// All loads are computed here — deterministic, never AI-generated.
// ═══════════════════════════════════════════════════════════════════════════════

interface MacroPos {
  weekInMacro: number
  meso: number
  weekInMeso: number
  isDeload: boolean
  isTest: boolean
}

function macroPos(weekNumber: number): MacroPos {
  const weekInMacro = ((weekNumber - 1) % 13) + 1
  const isTest = weekInMacro === 13
  const meso = isTest ? 3 : Math.ceil(weekInMacro / 4)
  const weekInMeso = isTest ? 4 : ((weekInMacro - 1) % 4) + 1
  return { weekInMacro, meso, weekInMeso, isDeload: weekInMacro === 12, isTest }
}

interface SlotMeso {
  names: [string, string, string, string]
  sets: number
  reps: number
  pctStart: number
  pctStep: number
  targetRpe?: number
  note?: string
}

const MESO_TARGET_RPE: Record<number, number> = { 1: 7, 2: 8, 3: 9 }
// 8 gives the weight-follow (re-anchoring to actual lifted loads) real room.
const MAX_ADJ = 8

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
  const percent = Math.round((basePct + adj) * 2) / 2
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

// ── Strongman pool (Saturday finisher) — rotates by absolute week ─────────────
const STRONGMAN_POOL: Array<Omit<MetconPrescription, 'kind' | 'slot'>> = [
  { name: 'Sled Gauntlet', format: 'for_time', timeCapMinutes: 12, description: '5 rounds:\n40yd sled push (heavy)\n40yd backward sled drag\nRest as needed — quality over pace' },
  { name: "Farmer's Highway", format: 'for_time', timeCapMinutes: 12, description: '4 rounds:\n60yd heavy DB farmer carry\n10 KB swings (heavy)\nGrip is the event — no straps' },
  { name: 'Over & Onward', format: 'for_time', timeCapMinutes: 12, description: '4 rounds:\n8 sandbag (or DB) over shoulder\n20yd bear-hug carry\n10 push-ups' },
  { name: 'Prowler Intervals', format: 'for_time', timeCapMinutes: 10, description: '6 rounds:\n20yd prowler sprint (moderate-heavy)\nRest 60-90s between efforts — full power each push' },
  { name: 'Loaded Mile-ish', format: 'for_time', timeCapMinutes: 15, description: '3 rounds:\n100yd suitcase carry (switch hands at 50)\n15 cal row\nStay tall — no leaning into the DB' },
  { name: 'KB Complex', format: 'amrap', timeCapMinutes: 10, description: 'AMRAP 10 (moderate KB)\n6 KB cleans (per side)\n6 goblet squats\n6 KB push press (per side)' },
]

// ── Sunday — the dad-health floor ──────────────────────────────────────────────
function sundayZ2(pos: MacroPos): OutsideSession {
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

// ═══════════════════════════════════════════════════════════════════════════════
// SLOT TABLES — [meso 1 hypertrophy, meso 2 strength, meso 3 peak]
// ═══════════════════════════════════════════════════════════════════════════════

// Day 1 — Squat
const D1_SQUAT: SlotMeso[] = [
  { names: ['Back Squat', 'Back Squat', 'Back Squat', 'Back Squat'], sets: 5, reps: 6, pctStart: 67, pctStep: 2 },
  { names: ['Back Squat', 'Back Squat', 'Back Squat', 'Back Squat'], sets: 4, reps: 4, pctStart: 77, pctStep: 2 },
  { names: ['Back Squat', 'Back Squat', 'Back Squat', 'Back Squat'], sets: 3, reps: 2, pctStart: 87, pctStep: 1.5 },
]
const D1_PAUSE: SlotMeso[] = [
  { names: ['Pause Back Squat (2s)', 'Pause Back Squat (2s)', 'Pause Back Squat (2s)', 'Pause Back Squat (2s)'], sets: 3, reps: 5, pctStart: 62, pctStep: 2, note: 'Dead-stop in the hole, stay tight' },
  { names: ['Pause Back Squat (2s)', 'Pause Back Squat (2s)', 'Pause Back Squat (2s)', 'Pause Back Squat (2s)'], sets: 3, reps: 3, pctStart: 70, pctStep: 2, note: 'Dead-stop in the hole, stay tight' },
  { names: ['Pause Back Squat (2s)', 'Pause Back Squat (2s)', 'Pause Back Squat (2s)', 'Pause Back Squat (2s)'], sets: 2, reps: 2, pctStart: 74, pctStep: 2, note: 'Dead-stop in the hole, stay tight' },
]

// Day 2 — Bench
const D2_BENCH: SlotMeso[] = [
  { names: ['Bench Press', 'Bench Press', 'Bench Press', 'Bench Press'], sets: 4, reps: 6, pctStart: 70, pctStep: 2 },
  { names: ['Bench Press', 'Bench Press', 'Bench Press', 'Bench Press'], sets: 4, reps: 4, pctStart: 77, pctStep: 2 },
  { names: ['Bench Press', 'Bench Press', 'Bench Press', 'Bench Press'], sets: 4, reps: 2, pctStart: 85, pctStep: 1.5 },
]
const D2_CLOSE_GRIP: SlotMeso[] = [
  { names: ['Close-Grip Bench Press', 'Close-Grip Bench Press', 'Close-Grip Bench Press', 'Close-Grip Bench Press'], sets: 3, reps: 8, pctStart: 60, pctStep: 2 },
  { names: ['Close-Grip Bench Press', 'Close-Grip Bench Press', 'Close-Grip Bench Press', 'Close-Grip Bench Press'], sets: 3, reps: 5, pctStart: 68, pctStep: 2 },
  { names: ['Close-Grip Bench Press', 'Close-Grip Bench Press', 'Close-Grip Bench Press', 'Close-Grip Bench Press'], sets: 3, reps: 3, pctStart: 74, pctStep: 2 },
]

// Day 4 — Deadlift (secondary rotates by meso: RDL → deficit → block pull)
const D4_DL: SlotMeso[] = [
  { names: ['Deadlift', 'Deadlift', 'Deadlift', 'Deadlift'], sets: 4, reps: 5, pctStart: 70, pctStep: 2 },
  { names: ['Deadlift', 'Deadlift', 'Deadlift', 'Deadlift'], sets: 4, reps: 3, pctStart: 78, pctStep: 2 },
  { names: ['Deadlift', 'Deadlift', 'Deadlift', 'Deadlift'], sets: 3, reps: 2, pctStart: 86, pctStep: 2 },
]
const D4_SECONDARY: SlotMeso[] = [
  { names: ['Romanian Deadlift', 'Romanian Deadlift', 'Romanian Deadlift', 'Romanian Deadlift'], sets: 3, reps: 8, pctStart: 55, pctStep: 2, note: 'Hamstrings loaded, bar close' },
  { names: ['Deficit Deadlift (1-2")', 'Deficit Deadlift (1-2")', 'Deficit Deadlift (1-2")', 'Deficit Deadlift (1-2")'], sets: 3, reps: 3, pctStart: 70, pctStep: 2, note: 'Off a plate — perfect positions' },
  { names: ['Block Pull (below knee)', 'Block Pull (below knee)', 'Block Pull (below knee)', 'Block Pull (below knee)'], sets: 2, reps: 2, pctStart: 88, pctStep: 2, note: 'Overload the lockout' },
]

// Day 6 — Overhead Press + Strongman
const D6_OHP: SlotMeso[] = [
  { names: ['Overhead Press', 'Overhead Press', 'Overhead Press', 'Overhead Press'], sets: 4, reps: 6, pctStart: 67, pctStep: 2 },
  { names: ['Overhead Press', 'Overhead Press', 'Overhead Press', 'Overhead Press'], sets: 4, reps: 4, pctStart: 75, pctStep: 2 },
  { names: ['Overhead Press', 'Overhead Press', 'Overhead Press', 'Overhead Press'], sets: 4, reps: 2, pctStart: 83, pctStep: 1.5 },
]
// Push press keys off the strict OHP max — 1RM push press runs ~120% of strict,
// so 78-98% of OHP is honest overload without a separate max to collect.
const D6_PUSH_PRESS: SlotMeso[] = [
  { names: ['Push Press', 'Push Press', 'Push Press', 'Push Press'], sets: 3, reps: 5, pctStart: 78, pctStep: 2 },
  { names: ['Push Press', 'Push Press', 'Push Press', 'Push Press'], sets: 3, reps: 3, pctStart: 86, pctStep: 2 },
  { names: ['Push Press', 'Push Press', 'Push Press', 'Push Press'], sets: 2, reps: 2, pctStart: 92, pctStep: 2 },
]

// ═══════════════════════════════════════════════════════════════════════════════
// Day builders
// ═══════════════════════════════════════════════════════════════════════════════

const DELOAD_NOTE = 'Deload — bar speed crisp, leave feeling fresh'

function applyDeload(p: LiftPrescription): LiftPrescription {
  return {
    ...p,
    sets: Math.max(2, Math.ceil(p.sets / 2)),
    percent: p.percent != null ? 60 : undefined,
    targetRpe: p.targetRpe != null ? 6 : undefined,
    note: DELOAD_NOTE,
  }
}

function withResolvedDeload(p: LiftPrescription, maxes: Record<string, number>): LiftPrescription {
  const d = applyDeload(p)
  d.targetWeightLbs = resolveWeight(d.percent, d.maxKey, maxes)
  return d
}

function deloadLifts(items: Prescription[], maxes: Record<string, number>, dropSlots: string[] = []): Prescription[] {
  return items
    .filter(i => !(i.kind === 'lift' && dropSlots.includes(i.slot)))
    .map(i => (i.kind === 'lift' && i.percent != null ? withResolvedDeload(i, maxes) : i))
}

function testDay(dayNumber: number): DayPlan {
  const plans: Record<number, DayPlan> = {
    1: {
      dayNumber, dayName: 'TEST — Squat 1RM', dayType: 'test',
      sessionIntent: 'Work to a new 1RM back squat. Take your time between attempts.',
      items: [
        { kind: 'lift', slot: 'test_squat', name: 'Back Squat — work to 1RM', sets: 6, reps: 1, note: 'Climb 60/70/80/88/94%+ then max attempts. Log your top single.' },
        accessory('test_acc', 'Easy bike flush', 1, 10, '10 min easy spin after'),
      ],
    },
    2: {
      dayNumber, dayName: 'TEST — Bench 1RM', dayType: 'test',
      sessionIntent: 'Work to a new 1RM bench press.',
      items: [
        { kind: 'lift', slot: 'test_bench', name: 'Bench Press — work to 1RM', sets: 6, reps: 1, note: 'Climb 60/70/80/88/94%+ then max attempts. Get a spot for the big ones.' },
        accessory('test_acc', 'Light rows + face pulls', 3, 12, 'Keep the shoulders happy'),
      ],
    },
    4: {
      dayNumber, dayName: 'TEST — Deadlift 1RM', dayType: 'test',
      sessionIntent: 'Pull a new 1RM deadlift.',
      items: [
        { kind: 'lift', slot: 'test_dl', name: 'Deadlift — work to 1RM', sets: 6, reps: 1, note: 'Climb 60/70/80/88/94%+ then max attempts. Belt up.' },
      ],
    },
    6: {
      dayNumber, dayName: 'TEST — Press 1RM (optional)', dayType: 'test',
      sessionIntent: 'Optional OHP 1RM, then the macro is done. Update your maxes in the app.',
      items: [
        { kind: 'lift', slot: 'test_ohp', name: 'Overhead Press — work to 1RM (optional)', sets: 5, reps: 1, note: 'Only if the week left something in the tank' },
        { kind: 'outside', slot: 'move', title: 'Celebrate & Move', parts: ['20 min easy walk or spin', 'Update ALL 1RMs in the app — next macro computes from the new numbers'] },
      ],
    },
  }
  if (plans[dayNumber]) return plans[dayNumber]
  if (dayNumber === 7) {
    return { dayNumber, dayName: 'Dad Miles', dayType: 'outside', sessionIntent: 'Easy movement between test days.', items: [sundayZ2({ weekInMacro: 13, meso: 3, weekInMeso: 4, isDeload: false, isTest: true })] }
  }
  return { dayNumber, dayName: 'Rest', dayType: 'rest', sessionIntent: 'Recover between test days.', items: [] }
}

function buildDay(weekNumber: number, dayNumber: number, maxes: Record<string, number>, adjustments: Record<string, number> = {}, opts?: BuildDayOpts): DayPlan {
  const pos = macroPos(weekNumber)
  // Athlete-flagged fatigue deload — same treatment as the built-in W12.
  if (opts?.forceDeload && !pos.isTest) pos.isDeload = true
  if (pos.isTest) return testDay(dayNumber)

  const m = pos.meso - 1
  const w = pos.weekInMeso

  switch (dayNumber) {
    case 1: {
      let items: Prescription[] = [
        liftFromSlot('main_squat', D1_SQUAT[m], w, 'back_squat', maxes, pos.meso, adjustments),
        liftFromSlot('pause_squat', D1_PAUSE[m], w, 'back_squat', maxes, pos.meso, adjustments),
        accessory('acc_lunge', 'Walking Lunge', 3, 10, 'Per leg, DBs in hand'),
        accessory('acc_ham', 'Leg Curl', 3, 10, 'Or nordic negatives'),
        accessory('acc_core', 'Hanging Leg Raises', 3, 12, '60s rest'),
      ]
      if (pos.isDeload) items = deloadLifts(items, maxes, ['pause_squat'])
      return {
        dayNumber, dayName: 'Squat Day', dayType: 'gym',
        sessionIntent: pos.isDeload ? 'Deload — light and fast, out quick.' : 'Heavy back squat, then pause work to own the bottom.',
        items,
      }
    }
    case 2: {
      let items: Prescription[] = [
        liftFromSlot('main_bench', D2_BENCH[m], w, 'bench', maxes, pos.meso, adjustments),
        liftFromSlot('close_grip', D2_CLOSE_GRIP[m], w, 'bench', maxes, pos.meso, adjustments),
        accessory('acc_row', 'Chest-Supported Row', 3, 10, 'Match your pressing volume with pulling'),
        { ...accessory('acc_delt', 'Lateral Raise', 3, 12, '45s rest'), superset: 'arms_pair' },
        { ...accessory('acc_tri', 'Triceps Pressdown', 3, 12, '45s rest'), superset: 'arms_pair' },
        accessory('acc_curl', 'Barbell Curl', 3, 10, 'Dad guns are load-bearing'),
      ]
      if (pos.isDeload) items = deloadLifts(items, maxes, ['close_grip'])
      return {
        dayNumber, dayName: 'Bench Day', dayType: 'gym',
        sessionIntent: pos.isDeload ? 'Deload — crisp presses, nothing to failure.' : 'Heavy bench, close-grip backoff, arm work to finish.',
        items,
      }
    }
    case 4: {
      let items: Prescription[] = [
        liftFromSlot('main_dl', D4_DL[m], w, 'deadlift', maxes, pos.meso, adjustments),
        liftFromSlot('dl_secondary', D4_SECONDARY[m], w, 'deadlift', maxes, pos.meso, adjustments),
        accessory('acc_pullup', 'Pull-Up', 3, 8, 'Add weight if 8 is easy'),
        accessory('acc_back_ext', 'Back Extension', 3, 12, 'Squeeze glutes at the top'),
        accessory('acc_carry', 'Farmer Carry', 3, 40, 'Yards. Heavy DBs — finisher, walk tall'),
      ]
      if (pos.isDeload) items = deloadLifts(items, maxes, ['dl_secondary']).filter(i => !(i.kind === 'lift' && i.slot === 'acc_carry'))
      return {
        dayNumber, dayName: 'Deadlift Day', dayType: 'gym',
        sessionIntent: pos.isDeload ? 'Deload — grease the pattern, save the back.' : 'Heavy pull, positional secondary, grip to close.',
        items,
      }
    }
    case 6: {
      let items: Prescription[] = [
        liftFromSlot('main_ohp', D6_OHP[m], w, 'ohp', maxes, pos.meso, adjustments),
        liftFromSlot('push_press', D6_PUSH_PRESS[m], w, 'ohp', maxes, pos.meso, adjustments),
        { ...accessory('acc_dip', 'Weighted Dip', 3, 8, 'Or DB incline press'), superset: 'push_pull_pair' },
        { ...accessory('acc_facepull', 'Face Pull', 3, 15, 'Rear delts keep you pressing'), superset: 'push_pull_pair' },
      ]
      if (pos.isDeload) {
        items = deloadLifts(items, maxes, ['push_press'])
        items.push({ kind: 'outside', slot: 'strongman_sub', title: 'Easy Flush', parts: ['8-10 min easy row or bike — Z2, nothing hard'] })
      } else {
        const sm = STRONGMAN_POOL[(weekNumber - 1) % STRONGMAN_POOL.length]
        items.push({ kind: 'metcon', slot: 'strongman', ...sm })
      }
      return {
        dayNumber, dayName: 'Press + Strongman', dayType: 'gym',
        sessionIntent: pos.isDeload ? 'Deload — light presses, easy movement.' : 'Strict press, push press overload, then the week\'s strongman event.',
        items,
      }
    }
    case 7:
      return { dayNumber, dayName: 'Dad Miles', dayType: 'outside', sessionIntent: 'Easy aerobic movement — the health floor.', items: [sundayZ2(pos)] }
    default:
      return { dayNumber, dayName: 'Rest', dayType: 'rest', sessionIntent: 'Rest. Eat. Sleep. Grow.', items: [] }
  }
}

export const dadStrong: ProgramConfig = {
  slug: 'dad-strong',
  name: 'Dad Strong',
  tagline: 'Strength · powerlifting · strongman',
  description:
    '4 lifting days built on the powerlifts — squat, bench, deadlift, press — each capped with strongman-flavored finishers you can actually do at a commercial gym, plus one easy Z2 day. 13-week macro: hypertrophy → strength → peak, deload week 12, test week 13.',
  daysPerWeek: 5,
  gymDayNumbers: [1, 2, 4, 6],
  macroWeeks: 13,
  requiredMaxes: [
    { key: 'back_squat', label: 'Back Squat', hint: 'Best recent single (lbs)' },
    { key: 'bench', label: 'Bench Press', hint: 'Best recent single (lbs)' },
    { key: 'deadlift', label: 'Deadlift', hint: 'Best recent single (lbs)' },
    { key: 'ohp', label: 'Overhead Press', hint: 'Best recent single (lbs)' },
  ],
  buildDay,
}
