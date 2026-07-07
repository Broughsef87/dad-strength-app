// ── Program engine types ───────────────────────────────────────────────────────
// A program is a deterministic function: (weekNumber, dayNumber, maxes) → DayPlan.
// No AI in the prescription path — percentages, sets, reps, and variations are
// config-owned. (AI freelancing loads was the root of the Zeus-era failures.)

export interface MaxDef {
  key: string        // 'snatch' | 'clean_jerk' | 'back_squat' | 'front_squat' | ...
  label: string      // "Snatch"
  hint?: string      // "Best recent single, in lbs"
}

// One prescribed lift line on a gym day.
export interface LiftPrescription {
  kind: 'lift'
  slot: string             // stable identity for logging, e.g. 'snatch_primary'
  name: string             // "Pause Snatch, At Knee"
  sets: number
  reps: number             // per set (for 1+1 complexes, reps=1 and note explains)
  percent?: number         // % of the referenced max, e.g. 73.5
  maxKey?: string          // which max the % references
  targetWeightLbs?: number // computed: round((percent/100) * max, nearest 5)
  rpe?: number             // accessories use RPE instead of %
  note?: string            // "1+1 — one clean, one jerk" / "90s rest"
}

// Plyometrics / jumps — logged as done/notes, no load math.
export interface PlyoPrescription {
  kind: 'plyo'
  slot: string
  name: string             // "Depth Jumps"
  sets: number
  reps: number
  note?: string
}

// Saturday metcon — from the curated pool, not AI.
export interface MetconPrescription {
  kind: 'metcon'
  slot: string
  name: string
  format: 'amrap' | 'for_time' | 'emom'
  timeCapMinutes: number
  description: string      // whiteboard text
}

// Outside sessions (sprint / conditioning) — simple prescribed card,
// completed via checkbox with optional notes.
export interface OutsideSession {
  kind: 'outside'
  slot: string
  title: string            // "Acceleration Day"
  parts: string[]          // bullet lines of the session
  note?: string
}

export type Prescription =
  | LiftPrescription
  | PlyoPrescription
  | MetconPrescription
  | OutsideSession

export interface DayPlan {
  dayNumber: number        // 1-7 (Mon..Sun)
  dayName: string          // "Oly A — Snatch Focus"
  dayType: 'gym' | 'outside' | 'test' | 'rest'
  sessionIntent: string
  items: Prescription[]
}

export interface ProgramConfig {
  slug: string
  name: string
  tagline: string
  description: string
  daysPerWeek: number          // sessions per week the user must complete (7 here)
  gymDayNumbers: number[]      // which of 1-7 are full gym sessions
  macroWeeks: number           // full cycle length incl. deload/test (13)
  requiredMaxes: MaxDef[]
  buildDay(
    weekNumber: number,        // absolute, 1..∞ — config maps into macro position
    dayNumber: number,         // 1-7
    maxes: Record<string, number>,
  ): DayPlan
}

// Round a computed barbell weight to the nearest 5 lb.
export function roundTo5(lbs: number): number {
  return Math.round(lbs / 5) * 5
}

export function resolveWeight(
  percent: number | undefined,
  maxKey: string | undefined,
  maxes: Record<string, number>,
): number | undefined {
  if (percent == null || !maxKey) return undefined
  const max = maxes[maxKey]
  if (!max || max <= 0) return undefined
  return roundTo5((percent / 100) * max)
}
