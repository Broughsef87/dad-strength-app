// ── Program engine types ───────────────────────────────────────────────────────
// A program is a deterministic function: (weekNumber, dayNumber, maxes) → DayPlan.
// No AI in the prescription path — percentages, sets, reps, and variations are
// config-owned. (AI freelancing loads was the root of the Zeus-era failures.)

export interface MaxDef {
  key: string        // 'snatch' | 'clean_jerk' | 'back_squat' | 'front_squat' | ...
  label: string      // "Snatch"
  hint?: string      // "Best recent single, in lbs"
  unit?: string      // display unit, defaults to 'lbs' (endurance benchmarks use 'min')
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
  targetRpe?: number       // expected difficulty for %-based work — autoreg anchor
  // ── Double progression (hypertrophy work) ──────────────────────────────
  // A lateral raise has no 1RM, so percent-based waves say nothing about it.
  // Range work instead holds the load until every set clears repRange[1],
  // then adds a step. `reps` stays the BOTTOM of the range so existing
  // consumers that read a single number still render something true.
  repRange?: [number, number]
  targetRir?: number       // reps in reserve — the effort target for range work
  loadStepLbs?: number     // smallest useful jump once the top is cleared
  velocity?: boolean       // speed slot: bar speed is the target, not difficulty.
                           // Carries NO targetRpe (an honest RPE 4 on a 57%
                           // double would otherwise read as "too light"), and
                           // autoreg never re-anchors it upward — loading above
                           // the window is a violation of the slot, not data.
  appliedAdjustmentPct?: number // autoreg delta baked into `percent` (display)
  note?: string            // "1+1 — one clean, one jerk" / "90s rest"
  superset?: string        // items sharing this id (and adjacent in the day) render linked
  subbedFrom?: string      // set client-side when a user substitution renamed this item
}

// Plyometrics / jumps — per-set logging like lifts, just no load math.
export interface PlyoPrescription {
  kind: 'plyo'
  slot: string
  name: string             // "Depth Jumps"
  sets: number
  reps: number
  note?: string
  superset?: string        // see LiftPrescription.superset
  subbedFrom?: string      // see LiftPrescription.subbedFrom
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
  // UNPINNED — "do this anytime this week" rather than on a named weekday.
  //
  // Andrew, on Dad Strong: "the lifting days are typically mon/wed/fri/sat and
  // then I fit the other days when I can." The lifts anchor; the easy aerobic
  // day floats.
  //
  // This is presentation, not capability. Nothing in the training flow has
  // ever read the real calendar weekday — day_number is a slot identity that
  // keys generated_workouts and ares_session_logs, and /train/<slug>/6 opens
  // and completes on a Tuesday exactly as it does on a Saturday. So a session
  // was ALREADY doable any day; the only thing pinning it was the week list
  // printing a weekday next to it. This flag stops that label lying.
  //
  // Deliberately a flag rather than a fifth dayType, and deliberately not
  // inferred from dayType === 'outside': Power Dad's Tuesday sprint and
  // Thursday conditioning are 'outside' and genuinely pinned. Only a program
  // that means it sets this.
  flexible?: boolean
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
    adjustments?: Record<string, number>, // slot → % delta from autoregulation
    opts?: BuildDayOpts,
  ): DayPlan
}

export interface BuildDayOpts {
  // Athlete-flagged fatigue deload: renders this week with the program's
  // deload treatment regardless of macro position (test week excepted).
  // Stored in user_programs.preferences.deload_weeks.
  forceDeload?: boolean
  // slot → next working load in lbs, from double progression over what was
  // actually logged. Percent-based slots ignore this; range-based accessory
  // slots use it instead of a percentage of a max they do not have.
  loadTargets?: Record<string, number>
  // The time-constrained MODE (FOR-225 §2): the day reduced to its primaries
  // for whatever program the athlete is on. A mode, not a program — it adds
  // no row, no slug and no selection UI. Applied by the registry, so no
  // program file needs to know about it. See timeConstrained.ts.
  timeConstrained?: boolean
  // What the athlete has to train with (FOR-225 §6, ruled 2026-09-13: it
  // rides in opts, not as a positional parameter). SHAPE ONLY for now — no
  // program reads it yet. It exists so the equipment questionnaire is an
  // addition later, not a signature change after the slot ids are foreign
  // keys. Free weights are the floor.
  equipment?: Equipment
}

// Equipment the athlete has. The floor is free weights; everything else is a
// declaration the questionnaire will make. Unused until that ticket lands.
export type EquipmentItem =
  | 'barbell' | 'dumbbells' | 'rack' | 'bench' | 'pullup_bar' | 'kettlebell'
  | 'box' | 'sled' | 'rower' | 'ski_erg' | 'bike' | 'sandbag' | 'wall_ball'

export interface Equipment {
  /** The floor every program assumes. Always 'free_weights' today. */
  floor: 'free_weights'
  /** Items the athlete declared beyond the floor. Absent means unknown, not none. */
  has?: Partial<Record<EquipmentItem, boolean>>
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
