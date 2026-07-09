import {
  DayPlan,
  LiftPrescription,
  OutsideSession,
  ProgramConfig,
  Prescription,
  resolveWeight,
} from './types'

// ═══════════════════════════════════════════════════════════════════════════════
// HYBRID ENDURANCE
//
// Endurance is the priority; strength is MAINTAINED, not built. General engine
// with a run bias — rolling aerobic base, not race prep (a race-mode variant
// can come later).
//
// 13-week macro: 3 × 4-week mesos + test week.
//   Meso 1 (W1-4):   base — easy volume, short intervals, long day 45-60 min
//   Meso 2 (W5-8):   build — interval density up, long day 60-75 min
//   Meso 3 (W9-12):  sharpen — faster reps, long day 75-90 min. W12 = deload.
//   W13 = TEST: 5K time trial + strength singles @ RPE 8 (not true 1RMs).
//
// Week: Mon Strength A · Tue Run Intervals · Wed Easy Z2 + Core ·
//       Thu Strength B · Fri Tempo · Sat Long · Sun rest.
//
// THE PACE ENGINE: a recent 5K time (entered in minutes at program creation,
// e.g. 26.5 = 26:30) deterministically derives easy / tempo / interval paces —
// a VDOT-lite lookup, computed here, never AI-generated. No benchmark → RPE
// prose fallback. Test week's new 5K re-derives next macro's paces.
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

// ── Pace derivation (VDOT-lite) ────────────────────────────────────────────────

interface Paces {
  easy: string      // conversational, Z2
  tempo: string     // comfortably hard, ~1-hour-race effort
  interval: string  // 3-5 min rep effort, ~5K pace or a hair under
}

function fmtPace(secPerMile: number): string {
  const m = Math.floor(secPerMile / 60)
  const s = Math.round(secPerMile % 60)
  return `${m}:${String(s).padStart(2, '0')}/mi`
}

export function derivePaces(fiveKMinutes: number | undefined): Paces | null {
  if (!fiveKMinutes || fiveKMinutes <= 0) return null
  const per5k = (fiveKMinutes * 60) / 3.107 // sec per mile at 5K effort
  return {
    easy: fmtPace(per5k * 1.3),
    tempo: fmtPace(per5k * 1.07),
    interval: fmtPace(per5k * 0.97),
  }
}

// Pace string with RPE fallback when no benchmark is on file.
function pace(p: Paces | null, key: keyof Paces, fallback: string): string {
  return p ? `${p[key]} (${fallback})` : fallback
}

// ── Strength (maintenance doses, %-based to keep it honest) ────────────────────

interface SlotMeso {
  names: [string, string, string, string]
  sets: number
  reps: number
  pctStart: number
  pctStep: number
  note?: string
}

const MAX_ADJ = 6
const STRENGTH_TARGET_RPE = 7 // maintenance — never grinding

function liftFromSlot(
  slot: string,
  def: SlotMeso,
  weekInMeso: number,
  maxKey: string,
  maxes: Record<string, number>,
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
    targetRpe: STRENGTH_TARGET_RPE,
    appliedAdjustmentPct: adj !== 0 ? adj : undefined,
    note: def.note,
    ...overrides,
  }
}

function accessory(slot: string, name: string, sets: number, reps: number, note?: string): LiftPrescription {
  return { kind: 'lift', slot, name, sets, reps, rpe: 7, note }
}

// Strength waves nudge up across the macro but stay maintenance-sized.
const A_SQUAT: SlotMeso[] = [
  { names: ['Back Squat', 'Back Squat', 'Back Squat', 'Back Squat'], sets: 3, reps: 5, pctStart: 70, pctStep: 1.5 },
  { names: ['Back Squat', 'Back Squat', 'Back Squat', 'Back Squat'], sets: 3, reps: 4, pctStart: 74, pctStep: 1.5 },
  { names: ['Back Squat', 'Back Squat', 'Back Squat', 'Back Squat'], sets: 3, reps: 3, pctStart: 78, pctStep: 1.5 },
]
const A_BENCH: SlotMeso[] = [
  { names: ['Bench Press', 'Bench Press', 'Bench Press', 'Bench Press'], sets: 3, reps: 5, pctStart: 70, pctStep: 1.5 },
  { names: ['Bench Press', 'Bench Press', 'Bench Press', 'Bench Press'], sets: 3, reps: 4, pctStart: 74, pctStep: 1.5 },
  { names: ['Bench Press', 'Bench Press', 'Bench Press', 'Bench Press'], sets: 3, reps: 3, pctStart: 78, pctStep: 1.5 },
]
const B_DL: SlotMeso[] = [
  { names: ['Deadlift', 'Deadlift', 'Deadlift', 'Deadlift'], sets: 3, reps: 4, pctStart: 72, pctStep: 1.5 },
  { names: ['Deadlift', 'Deadlift', 'Deadlift', 'Deadlift'], sets: 3, reps: 3, pctStart: 76, pctStep: 1.5 },
  { names: ['Deadlift', 'Deadlift', 'Deadlift', 'Deadlift'], sets: 2, reps: 3, pctStart: 80, pctStep: 1.5 },
]

// ═══════════════════════════════════════════════════════════════════════════════
// Endurance sessions
// ═══════════════════════════════════════════════════════════════════════════════

function intervalsDay(pos: MacroPos, p: Paces | null): OutsideSession {
  if (pos.isDeload) {
    return {
      kind: 'outside', slot: 'run_intervals', title: 'Strides (deload)',
      parts: ['15-20 min easy jog', '4 × 20s relaxed strides, full recovery walk-back'],
      note: 'Keep the legs alive, nothing more.',
    }
  }
  const iv = pace(p, 'interval', 'hard — RPE 8-9')
  const byMeso: Record<number, string[]> = {
    1: [`5 × 3 min @ ${iv}`, '2 min jog between reps'],
    2: [`6 × 3 min @ ${iv}`, '90s jog between reps'],
    3: [`4 × 4 min @ ${iv}`, '2 min jog between reps'],
  }
  return {
    kind: 'outside', slot: 'run_intervals', title: 'Run Intervals',
    parts: ['10-15 min warm-up jog + drills + 2 strides', ...byMeso[pos.meso], '10 min easy cooldown'],
    note: 'Even pacing — the last rep should match the first.',
  }
}

function easyZ2Core(pos: MacroPos, p: Paces | null): Prescription[] {
  const easy = pace(p, 'easy', 'conversational — RPE 3-4')
  const mins = pos.isDeload ? '20-25' : '30-35'
  return [
    {
      kind: 'outside', slot: 'easy_z2', title: 'Easy Z2',
      parts: [`${mins} min easy run or bike @ ${easy}`, 'Nasal breathing pace — genuinely easy'],
      note: 'This day builds the base precisely because it stays easy.',
    },
    accessory('acc_core_1', 'Plank', 3, 45, 'Seconds. Superset with dead bugs'),
    accessory('acc_core_2', 'Dead Bug', 3, 10, 'Per side, slow and controlled'),
  ]
}

function tempoDay(weekNumber: number, pos: MacroPos, p: Paces | null): OutsideSession {
  if (pos.isDeload) {
    return {
      kind: 'outside', slot: 'tempo', title: 'Easy Spin (deload)',
      parts: ['25-30 min very easy bike or jog'],
    }
  }
  const runWeek = weekNumber % 2 === 1
  const tempo = pace(p, 'tempo', 'comfortably hard — RPE 7')
  const byMeso: Record<number, string> = {
    1: runWeek ? `2 × 10 min @ ${tempo}, 3 min easy between` : '2 × 12 min hard steady bike (RPE 7), 3 min easy between',
    2: runWeek ? `2 × 12 min @ ${tempo}, 3 min easy between` : '3 × 10 min hard steady bike (RPE 7), 3 min easy between',
    3: runWeek ? `25 min continuous @ ${tempo}` : '30 min hard steady bike (RPE 7-8)',
  }
  return {
    kind: 'outside', slot: 'tempo',
    title: runWeek ? 'Tempo Run' : 'Tempo Bike',
    parts: ['10 min progressive warm-up', byMeso[pos.meso], '5-10 min easy cooldown'],
    note: 'Comfortably hard — you could speak a sentence, not a paragraph.',
  }
}

function longDay(weekNumber: number, pos: MacroPos, p: Paces | null): OutsideSession {
  if (pos.isDeload) {
    return {
      kind: 'outside', slot: 'long', title: 'Long-ish (deload)',
      parts: ['40 min easy Z2, any modality', 'Flat, relaxed, unhurried'],
    }
  }
  const easy = pace(p, 'easy', 'conversational — RPE 3-4')
  const mins = 45 + 5 * (pos.weekInMeso - 1) + 15 * (pos.meso - 1) // 45-60 / 60-75 / 75-90
  const ruckWeek = pos.weekInMeso === 3
  return {
    kind: 'outside', slot: 'long', title: 'Long Session',
    parts: [
      ruckWeek
        ? `${mins} min ruck (30-40 lb) or hilly hike — steady effort`
        : `${mins} min run @ ${easy} (bike OK if the legs are beat)`,
      'Fuel if over 60 min. Walk breaks are legal.',
    ],
    note: 'The most important session of the week. Slow is the point.',
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Day builders
// ═══════════════════════════════════════════════════════════════════════════════

const DELOAD_NOTE = 'Deload — bar speed crisp, leave feeling fresh'

function deloadLift(pr: LiftPrescription, maxes: Record<string, number>): LiftPrescription {
  const d: LiftPrescription = {
    ...pr,
    sets: 2,
    percent: pr.percent != null ? 60 : undefined,
    targetRpe: pr.targetRpe != null ? 6 : undefined,
    note: DELOAD_NOTE,
  }
  d.targetWeightLbs = resolveWeight(d.percent, d.maxKey, maxes)
  return d
}

function testDay(dayNumber: number, maxes: Record<string, number>, p: Paces | null): DayPlan {
  const easy = pace(p, 'easy', 'conversational')
  const plans: Record<number, DayPlan> = {
    1: {
      dayNumber, dayName: 'TT Prep', dayType: 'outside',
      sessionIntent: 'Prime the legs for tomorrow\'s time trial.',
      items: [{
        kind: 'outside', slot: 'tt_prep', title: 'Shakeout + Strides',
        parts: [`20 min easy @ ${easy}`, '4 × 20s strides at TT effort', 'Early night — tomorrow counts'],
      }],
    },
    2: {
      dayNumber, dayName: 'TEST — 5K Time Trial', dayType: 'test',
      sessionIntent: 'All-out 5K. Flat course or track. This number drives next macro\'s paces.',
      items: [{
        kind: 'outside', slot: 'test_5k', title: '5K TIME TRIAL',
        parts: [
          '15 min warm-up: easy jog + drills + 3 strides',
          '5K all-out — start controlled, negative split if possible',
          '10 min cooldown walk/jog',
          'UPDATE YOUR 5K TIME in the app (minutes, e.g. 26.5 = 26:30)',
        ],
        note: 'Log your time in the debrief too.',
      }],
    },
    4: {
      dayNumber, dayName: 'TEST — Strength Check', dayType: 'test',
      sessionIntent: 'Heavy singles at RPE 8 — crisp, no grinding. This path doesn\'t need true 1RMs.',
      items: [
        { kind: 'lift', slot: 'test_squat', name: 'Back Squat — single @ RPE 8', sets: 4, reps: 1, note: 'Climb 60/70/80% then RPE-8 single. Log the top single.' },
        { kind: 'lift', slot: 'test_bench', name: 'Bench Press — single @ RPE 8', sets: 4, reps: 1, note: 'Same climb. Crisp, not maximal.' },
        { kind: 'lift', slot: 'test_dl', name: 'Deadlift — single @ RPE 8', sets: 3, reps: 1, note: 'One clean heavy single. Update maxes if these moved.' },
      ],
    },
    5: {
      dayNumber, dayName: 'Easy Spin', dayType: 'outside',
      sessionIntent: 'Flush the week.',
      items: [{ kind: 'outside', slot: 'easy_flush', title: 'Easy Z2', parts: ['25-30 min very easy bike or walk'] }],
    },
    6: {
      dayNumber, dayName: 'Victory Lap', dayType: 'outside',
      sessionIntent: 'Macro complete. Easy long movement, then rest up for the next one.',
      items: [{
        kind: 'outside', slot: 'victory', title: 'Victory Lap',
        parts: ['45 min easy — run, ruck, or ride', 'New paces kick in next week, computed from your new 5K'],
      }],
    },
  }
  if (plans[dayNumber]) return plans[dayNumber]
  return { dayNumber, dayName: 'Rest', dayType: 'rest', sessionIntent: 'Recover — the TT and strength check need fresh legs.', items: [] }
}

function buildDay(weekNumber: number, dayNumber: number, maxes: Record<string, number>, adjustments: Record<string, number> = {}): DayPlan {
  const pos = macroPos(weekNumber)
  const paces = derivePaces(maxes['five_k_time'])
  if (pos.isTest) return testDay(dayNumber, maxes, paces)

  const m = pos.meso - 1
  const w = pos.weekInMeso

  switch (dayNumber) {
    case 1: {
      let items: Prescription[] = [
        liftFromSlot('a_squat', A_SQUAT[m], w, 'back_squat', maxes, adjustments),
        liftFromSlot('a_bench', A_BENCH[m], w, 'bench', maxes, adjustments, { superset: 'press_pull' }),
        { ...accessory('acc_row', 'One-Arm DB Row', 3, 10, 'Per side'), superset: 'press_pull' },
        accessory('acc_core', 'Hanging Knee Raise', 3, 12, '60s rest'),
      ]
      if (pos.isDeload) {
        items = items.map(i => (i.kind === 'lift' && i.percent != null ? deloadLift(i, maxes) : i))
      }
      return {
        dayNumber, dayName: 'Strength A', dayType: 'gym',
        sessionIntent: pos.isDeload ? 'Deload — light and quick.' : 'Squat + press maintenance. In, heavy-ish, out — save the legs for the week.',
        items,
      }
    }
    case 2:
      return { dayNumber, dayName: 'Run Intervals', dayType: 'outside', sessionIntent: 'The week\'s hard aerobic stimulus.', items: [intervalsDay(pos, paces)] }
    case 3:
      return { dayNumber, dayName: 'Easy Z2 + Core', dayType: 'outside', sessionIntent: 'Base miles and a strong trunk.', items: easyZ2Core(pos, paces) }
    case 4: {
      let items: Prescription[] = [
        liftFromSlot('b_dl', B_DL[m], w, 'deadlift', maxes, adjustments),
        { ...accessory('acc_press', 'Standing DB Press', 3, 8, ''), superset: 'press_pull_b' },
        { ...accessory('acc_pullup', 'Pull-Up', 3, 8, 'Add weight if 8 is easy'), superset: 'press_pull_b' },
        accessory('acc_lunge', 'Walking Lunge', 2, 10, 'Per leg — light, quality steps'),
        accessory('acc_carry', 'Farmer Carry', 2, 40, 'Yards. Heavy enough to matter'),
      ]
      if (pos.isDeload) {
        items = items
          .map(i => (i.kind === 'lift' && i.percent != null ? deloadLift(i, maxes) : i))
          .filter(i => !(i.kind === 'lift' && (i.slot === 'acc_lunge' || i.slot === 'acc_carry')))
      }
      return {
        dayNumber, dayName: 'Strength B', dayType: 'gym',
        sessionIntent: pos.isDeload ? 'Deload — grease the hinge, nothing heavy.' : 'Hinge + upper maintenance. Low volume on purpose.',
        items,
      }
    }
    case 5:
      return { dayNumber, dayName: 'Tempo', dayType: 'outside', sessionIntent: 'Threshold work — comfortably hard, repeatable.', items: [tempoDay(weekNumber, pos, paces)] }
    case 6:
      return { dayNumber, dayName: 'Long Session', dayType: 'outside', sessionIntent: 'The aerobic anchor of the week.', items: [longDay(weekNumber, pos, paces)] }
    default:
      return { dayNumber, dayName: 'Rest', dayType: 'rest', sessionIntent: 'Full rest. The adaptation happens here.', items: [] }
  }
}

export const hybridEndurance: ProgramConfig = {
  slug: 'hybrid-endurance',
  name: 'Hybrid Endurance',
  tagline: 'Strength · endurance · conditioning',
  description:
    'A serious aerobic engine with strength genuinely maintained — 2 low-volume lifting days, run intervals, tempo, easy Z2, and a long session that grows across the macro. Paces are computed from your 5K benchmark. 13-week macro: base → build → sharpen, deload week 12, 5K time trial week 13.',
  daysPerWeek: 6,
  gymDayNumbers: [1, 4],
  macroWeeks: 13,
  requiredMaxes: [
    { key: 'back_squat', label: 'Back Squat', hint: 'Best recent single (lbs)' },
    { key: 'bench', label: 'Bench Press', hint: 'Best recent single (lbs)' },
    { key: 'deadlift', label: 'Deadlift', hint: 'Best recent single (lbs)' },
    { key: 'five_k_time', label: '5K Time', hint: 'Minutes — 26.5 = 26:30. Honest estimate is fine', unit: 'min' },
  ],
  buildDay,
}
