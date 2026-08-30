// ═══════════════════════════════════════════════════════════════════════════════
// TRAINING ANALYTICS — the pure layer.
//
// Every number the progress cards show is derived from sets the athlete already
// logged. Nothing new is collected, nothing is asked for, nothing is guessed.
//
// PURE BY CONSTRUCTION: no imports, no Supabase, no React, no Date.now(). The
// caller fetches rows and passes them in. That is what makes this testable, and
// it is why the deload list arrives as an argument instead of being queried.
//
// The rules below are load-bearing. Each one exists because breaking it makes
// the card LIE, and a card that lies is worse than no card:
//
//   1. e1RM is EPLEY — weight × (1 + reps/30). A single returns the weight
//      itself. Above 10 reps Epley degrades badly, so we refuse (null) rather
//      than publish a fantasy.
//   2. DELOAD WEEKS ARE EXCLUDED. A deload is light BY DESIGN (week 12 of every
//      macro drops to 60-65%), so counting it draws a cliff that never happened.
//      Athlete-flagged deloads are excluded the same way.
//   3. VELOCITY SLOTS ARE EXCLUDED FROM e1RM ENTIRELY. A 57% speed box squat
//      double has a meaningless e1RM — it is a bar-speed prescription, not an
//      attempt at load — and it would drag the squat trend down every Friday.
//   4. Only completed === true sets, and only rows carrying BOTH weight > 0 and
//      reps > 0.
//   5. One point per lift per WEEK, and it is the BEST e1RM of that week. The
//      top set is the capability; averaging in the back-offs measures the
//      program's design, not the athlete.
// ═══════════════════════════════════════════════════════════════════════════════

// ── The row shape (ares_session_logs, one row per set) ───────────────────────
// Numerics are typed loosely because Supabase can hand back `numeric` as a
// string; every read goes through the coercion helpers below.
export interface SetRow {
  block_name: string
  /** Stable slot id ('back_squat_heavy'). NULL on older rows — always fall
   *  back to block_name for identity. */
  slot?: string | null
  weight_lbs?: number | string | null
  reps?: number | string | null
  rpe?: number | string | null
  completed?: boolean | null
  completed_at?: string | null
  week_number?: number | string | null
  day_number?: number | string | null
  /** 'strength_set' | 'skill_work' | 'session_complete' | metcon types. */
  log_type?: string | null
  user_id?: string | null
}

// ── Program constants ────────────────────────────────────────────────────────
/** hybridPower.macroWeeks. */
export const MACRO_WEEKS = 13
/** Week 12 of every macro is the built-in deload — the macro's penultimate week. */
export const DELOAD_WEEK_IN_MACRO = MACRO_WEEKS - 1
/** Week 13 is the TEST week. It is deliberately NOT excluded: a test single is
 *  the truest data point in the whole macro. */
export const TEST_WEEK_IN_MACRO = MACRO_WEEKS

/** Slots flagged `velocity: true` in hybridPower — speed work at 55-74%. */
export const DEFAULT_VELOCITY_SLOTS = ['speed_squat', 'hang_psn'] as const

/** The exercise NAMES those slots log. Needed because a row with slot = NULL is
 *  identified by block_name alone, and rule 3 has to hold for legacy rows too. */
export const DEFAULT_VELOCITY_LIFT_NAMES = [
  'Speed Box Squat',
  'Hang Power Snatch',
  'Power Snatch',
] as const

/** requiredMaxes keys, in the order hybridPower declares them. */
export const REQUIRED_MAX_KEYS = [
  'snatch', 'clean_jerk', 'back_squat', 'front_squat', 'bench', 'deadlift', 'ohp',
] as const
export type MaxKey = (typeof REQUIRED_MAX_KEYS)[number]

export const MAX_KEY_LABELS: Record<string, string> = {
  snatch: 'Snatch',
  clean_jerk: 'Clean',
  back_squat: 'Back Squat',
  front_squat: 'Front Squat',
  bench: 'Bench Press',
  deadlift: 'Deadlift',
  ohp: 'Overhead Press',
}

// Which logged lift NAMES are a legitimate expression of which max.
//
// Deliberately conservative. Variations whose capacity sits well below the comp
// lift are LEFT OUT — a 1¼ bench runs ~85-90% of the bench and a close-grip
// ~low-90s%, so folding them in would answer "how strong is your bench?" with a
// number about a different exercise. Sub-maximal variations that DO share the
// max (hang snatch, pause front squat) are included because projection takes
// the MAX across sources: a lighter variant can never drag a projection down,
// only raise it if the athlete genuinely moved more.
export const LIFT_MAX_KEYS: Record<string, MaxKey> = {
  'snatch': 'snatch',
  'hang snatch': 'snatch',
  'clean': 'clean_jerk',
  'power clean': 'clean_jerk',
  'clean & jerk': 'clean_jerk',
  'clean and jerk': 'clean_jerk',
  'back squat': 'back_squat',
  'front squat': 'front_squat',
  'pause front squat': 'front_squat',
  'bench press': 'bench',
  'deadlift': 'deadlift',
  'overhead press': 'ohp',
}

/** Epley stops being trustworthy past this. */
export const MAX_E1RM_REPS = 10

/**
 * Upper bound on a bar weight we will treat as a lift.
 *
 * The heaviest lift any human has performed is ~1100 lb, so 2000 leaves absurd
 * headroom and everything above it is a typo or a corrupt numeric — and a
 * corrupt one is contagious: rule 5 takes the BEST set of the week, so a single
 * bad row becomes the athlete's `current`, `best` and projected max at once. A
 * `numeric` column can hand back '1e400', which Number() turns into Infinity
 * and the card renders as the string "Infinity".
 */
export const MAX_PLAUSIBLE_WEIGHT_LBS = 2000

/**
 * Upper bound on a week number we will accept from a row.
 *
 * 520 weeks is ten years — forty macros. Anything past it is corruption, not
 * training. The bound is load-bearing rather than cosmetic: `adherence` fills
 * every week between the first and last session so a skipped week shows as a
 * zero, and one row carrying week_number = 200000 turned that fill into a
 * 200,000-entry array (and, with a larger value, a hung tab) while dividing the
 * athlete's real adherence down to 0%.
 */
export const MAX_TRACKED_WEEK = 520

// ── Small helpers ────────────────────────────────────────────────────────────

function num(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function int(v: unknown): number | null {
  const n = num(v)
  return n == null ? null : Math.trunc(n)
}

/** Rounding that cannot manufacture Infinity. `n * f` overflows for absurd
 *  inputs (round(1e308) used to return Infinity), so an overflow falls back to
 *  the unrounded value and the caller's finite check decides what to do. */
function round(n: number, dp = 1): number {
  if (!Number.isFinite(n)) return n
  const f = 10 ** dp
  const r = Math.round(n * f) / f
  return Number.isFinite(r) ? r : n
}

/** A percentage that is only reported when it is a real number. Guards every
 *  division whose denominator comes from athlete-entered data. */
function pctChange(from: number, to: number): number | null {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0) return null
  const p = round(((to - from) / from) * 100, 1)
  return Number.isFinite(p) ? p : null
}

/** A row's week number, or null when it is missing or outside the plausible
 *  range. See MAX_TRACKED_WEEK. */
function weekOf(v: unknown): number | null {
  const w = int(v)
  if (w == null || w < 1 || w > MAX_TRACKED_WEEK) return null
  return w
}

/** Lowercase, collapse whitespace — the comparison form for names and slots. */
function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * The display/grouping name for a logged block.
 *
 * Test-week rows log block_name as "Back Squat — work to 1RM" and
 * "Clean — work to 1RM (no jerk)". Left raw, those would split off into their
 * own one-point "trends" at exactly the week that matters most. Stripping the
 * em-dash suffix and any trailing parenthetical folds the test single into the
 * lift's own trend line, which is what the athlete means by "my squat".
 */
export function canonicalLiftName(blockName: string): string {
  let s = String(blockName ?? '').trim()
  const dash = s.search(/\s[—–]\s/)
  if (dash > 0) s = s.slice(0, dash)
  s = s.replace(/\s*\([^)]*\)\s*$/, '')
  return s.trim()
}

/** The requiredMaxes key a lift name feeds, or null if it feeds none. */
export function maxKeyForLift(blockName: string): MaxKey | null {
  return LIFT_MAX_KEYS[normKey(canonicalLiftName(blockName))] ?? null
}

/**
 * Deload = the macro's built-in deload week (week 12 of each 13-week macro),
 * or any week the athlete flagged. Flagged weeks are ABSOLUTE week numbers, as
 * stored in user_programs.preferences.deload_weeks.
 */
export function isDeloadWeek(
  week: number,
  deloadWeeks: number[] = [],
  macroWeeks: number = MACRO_WEEKS,
): boolean {
  if (!Number.isFinite(week)) return false
  if (deloadWeeks.includes(week)) return true
  if (!Number.isFinite(macroWeeks) || macroWeeks < 2 || week < 1) return false
  return ((week - 1) % macroWeeks) + 1 === macroWeeks - 1
}

// ── 1. e1RM ──────────────────────────────────────────────────────────────────

/**
 * Epley estimated 1RM: weight × (1 + reps/30).
 *
 * Returns null — never a guess — when the input can't support an estimate:
 * a non-positive weight, a non-positive rep count, or more than 10 reps (Epley
 * over-predicts badly out there). A single returns the weight exactly.
 */
export function e1rm(weightLbs: number | string | null | undefined, reps: number | string | null | undefined): number | null {
  const w = num(weightLbs)
  const r = int(reps)
  if (w == null || w <= 0) return null
  // Corruption, not a lift. Left in, it becomes the week's best set (rule 5),
  // and therefore `current`, `best` and the projected max all at once — and a
  // big enough value overflows to a literal "Infinity" on the card, with a NaN
  // deltaPct beside it.
  if (w > MAX_PLAUSIBLE_WEIGHT_LBS) return null
  if (r == null || r < 1) return null
  if (r > MAX_E1RM_REPS) return null
  if (r === 1) return w
  const est = round(w * (1 + r / 30), 1)
  return Number.isFinite(est) ? est : null
}

// ── 2. Lift trends ───────────────────────────────────────────────────────────

export interface TrendPoint {
  week: number
  e1rm: number
  /** completed_at of the set that produced this week's best. */
  date: string | null
  /** The set behind the estimate — so the UI can show "275 × 2", not a bare number. */
  weightLbs: number
  reps: number
  /** block_name as logged (may differ from the trend name on test-week rows). */
  blockName: string
  slot: string | null
}

export interface LiftTrend {
  /** Canonical block_name — the trend's key. */
  name: string
  /** Every raw block_name folded into this trend. */
  blockNames: string[]
  /** Most recent non-null slot seen, for UI links back into the program. */
  slot: string | null
  /** requiredMaxes key this lift feeds, or null. */
  maxKey: MaxKey | null
  /** One per week, best e1RM of that week, ascending by week. */
  points: TrendPoint[]
  /** e1RM of the most recent point. */
  current: number
  /** Best e1RM across the whole trend. */
  best: number
  bestWeek: number
  /** e1RM of the earliest point — the baseline deltaPct measures from. */
  startingPoint: number
  /** % change from startingPoint to current. NULL when there is only one point:
   *  a single measurement has no trend, and 0% would be a claim we can't make. */
  deltaPct: number | null
  /** Distinct (week, day) sessions this lift appeared in. */
  sessionCount: number
  /** Usable sets behind the trend. */
  setCount: number
  firstWeek: number
  lastWeek: number
  /** TRUE when there are fewer than 2 points. Still returned — the UI decides —
   *  but it must not draw a line through a single dot. */
  sparse: boolean
}

export interface TrendOpts {
  /** Absolute week numbers the athlete flagged as deloads. */
  deloadWeeks: number[]
  /** Slot ids running at velocity (55-74%). Names are accepted here too. */
  velocitySlots: string[]
  /** Lift NAMES to treat as velocity — the safety net for slot = NULL rows.
   *  Defaults to DEFAULT_VELOCITY_LIFT_NAMES. */
  velocityNames?: string[]
  /** Defaults to 13 (hybridPower.macroWeeks). */
  macroWeeks?: number
}

/**
 * Per-lift e1RM trend from logged sets.
 *
 * Rows are dropped when: not a strength set · not completed · missing week ·
 * in a deload week · from a velocity slot · missing/zero weight or reps ·
 * or above the Epley rep ceiling.
 *
 * Everything surviving is grouped by canonical block_name, then reduced to one
 * point per week — the best e1RM of that week.
 */
export function liftTrends(rows: SetRow[], opts: TrendOpts): Record<string, LiftTrend> {
  const macroWeeks = opts.macroWeeks ?? MACRO_WEEKS
  const deloadWeeks = opts.deloadWeeks ?? []
  const velSlots = new Set((opts.velocitySlots ?? []).map(normKey))
  const velNames = new Set(
    (opts.velocityNames ?? (DEFAULT_VELOCITY_LIFT_NAMES as readonly string[])).map(normKey),
  )

  interface Acc {
    name: string
    blockNames: Set<string>
    slot: string | null
    slotAt: string | null
    weeks: Map<number, TrendPoint>
    sessions: Set<string>
    setCount: number
  }
  const acc = new Map<string, Acc>()

  for (const r of rows ?? []) {
    if (r == null) continue
    // Only strength sets. An undefined log_type means the caller already filtered.
    if (r.log_type != null && r.log_type !== 'strength_set') continue
    // Rule 4 — a set that was typed but not finished is not evidence.
    if (r.completed !== true) continue

    const week = weekOf(r.week_number)
    if (week == null) continue
    // Rule 2 — a deload is light by design.
    if (isDeloadWeek(week, deloadWeeks, macroWeeks)) continue

    const rawName = String(r.block_name ?? '').trim()
    if (!rawName) continue
    // Slot is the stable id, but it is NULL on old rows — identity always falls
    // back to block_name, which is why the trend key is the name, not the slot.
    const name = canonicalLiftName(rawName) || rawName
    const slot = r.slot != null && String(r.slot).trim() !== '' ? String(r.slot).trim() : null

    // Rule 3 — velocity work never produces an e1RM. Checked on the slot AND on
    // the name, so a legacy slot-NULL speed squat is excluded too.
    if (slot && velSlots.has(normKey(slot))) continue
    const nameKey = normKey(name)
    if (velSlots.has(nameKey) || velNames.has(nameKey)) continue

    // Rule 4 — both weight and reps must be real.
    const weight = num(r.weight_lbs)
    const reps = int(r.reps)
    if (weight == null || weight <= 0 || reps == null || reps <= 0) continue

    // Rule 1 — refuses above 10 reps.
    const est = e1rm(weight, reps)
    if (est == null) continue

    const key = nameKey
    let a = acc.get(key)
    if (!a) {
      a = { name, blockNames: new Set(), slot: null, slotAt: null, weeks: new Map(), sessions: new Set(), setCount: 0 }
      acc.set(key, a)
    }
    a.blockNames.add(rawName)
    a.setCount += 1

    const date = r.completed_at ?? null
    if (slot && (a.slotAt == null || (date != null && date >= a.slotAt))) {
      a.slot = slot
      a.slotAt = date ?? a.slotAt
    }

    const day = int(r.day_number)
    a.sessions.add(`${week}|${day ?? (date ? date.slice(0, 10) : '?')}`)

    // Rule 5 — the week's point is the BEST e1RM of that week, never the average.
    const prev = a.weeks.get(week)
    if (!prev || est > prev.e1rm) {
      a.weeks.set(week, { week, e1rm: est, date, weightLbs: weight, reps, blockName: rawName, slot })
    }
  }

  const out: Record<string, LiftTrend> = {}
  for (const a of [...acc.values()].sort((x, y) => x.name.localeCompare(y.name))) {
    const points = [...a.weeks.values()].sort((p, q) => p.week - q.week)
    if (!points.length) continue
    const start = points[0]
    const last = points[points.length - 1]
    let best = points[0]
    for (const p of points) if (p.e1rm > best.e1rm) best = p

    out[a.name] = {
      name: a.name,
      blockNames: [...a.blockNames].sort(),
      slot: a.slot,
      maxKey: maxKeyForLift(a.name),
      points,
      current: last.e1rm,
      best: best.e1rm,
      bestWeek: best.week,
      startingPoint: start.e1rm,
      deltaPct: points.length >= 2 ? pctChange(start.e1rm, last.e1rm) : null,
      sessionCount: a.sessions.size,
      setCount: a.setCount,
      firstWeek: start.week,
      lastWeek: last.week,
      sparse: points.length < 2,
    }
  }
  return out
}

// ── 3. Projections ───────────────────────────────────────────────────────────

export type Confidence = 'high' | 'medium' | 'low'

export interface Projection {
  key: string
  label: string
  /** The 1RM the athlete typed in. */
  entered: number | null
  /** What his actual training says, or NULL when the data can't support a
   *  number. Never a fabrication. */
  projected: number | null
  /** projected vs entered, %. NULL when either side is missing. */
  deltaPct: number | null
  confidence: Confidence
  /** One short line a human can check the number against. */
  basis: string
  /** Lift names that fed this projection. */
  sourceLifts: string[]
  weeksOfData: number
  setCount: number
  lastWeek: number | null
  /** Data exists but is too old to speak for today. */
  stale: boolean
}

export interface ProjectionOpts {
  /** Window for "what he can do NOW", in weeks back from his last session on
   *  that lift. Default 4 — one mesocycle. */
  recencyWeeks?: number
  /** Beyond this many weeks since the lift was last trained, refuse to project.
   *  Default 6. */
  staleAfterWeeks?: number
  /**
   * "Now", as a week number — pass `user_programs.current_week`.
   *
   * PASS THIS. Without it the module has no notion of today and falls back to
   * the latest week present in the trends, which by construction is never
   * stale: an athlete who logged weeks 1-4 and then stopped for six months
   * would read as "current" with 'high' confidence. When it is omitted the
   * per-lift staleness checks still work (a lift last trained long before his
   * other lifts is still caught), but confidence is capped at 'medium' and the
   * basis says "as of wk N" rather than "current", because recency relative to
   * an unknown today is not a claim this module can make.
   */
  latestWeek?: number
  /** Defaults to REQUIRED_MAX_KEYS. */
  maxKeys?: readonly string[]
  labels?: Record<string, string>
}

/**
 * Entered max vs what the training actually shows, per requiredMaxes key.
 *
 * Projection = the best e1RM inside a recency window, taken across every lift
 * that legitimately expresses that max. The MAX (not the mean) is used for the
 * same reason as rule 5, and it is what makes it safe to include sub-maximal
 * variations as sources.
 *
 * Honesty rules: no data → projected null. Data older than staleAfterWeeks →
 * projected null and stale = true. Both cases still return a row with a basis
 * string, because "we don't know" is a real answer and the UI should show it.
 */
export function projections(
  trends: Record<string, LiftTrend>,
  currentMaxes: Record<string, number | string | null | undefined> | null | undefined,
  opts: ProjectionOpts = {},
): Record<string, Projection> {
  const recencyWeeks = opts.recencyWeeks ?? 4
  const staleAfter = opts.staleAfterWeeks ?? 6
  const keys = opts.maxKeys ?? REQUIRED_MAX_KEYS
  const all = Object.values(trends ?? {})

  // Whether "now" was supplied or inferred changes what we are allowed to say
  // about recency. See ProjectionOpts.latestWeek.
  const nowIsKnown = opts.latestWeek != null && Number.isFinite(opts.latestWeek)
  const latestWeek = nowIsKnown
    ? (opts.latestWeek as number)
    : (all.length ? Math.max(...all.map(t => t.lastWeek)) : null)

  const out: Record<string, Projection> = {}

  for (const key of keys) {
    const label = opts.labels?.[key] ?? MAX_KEY_LABELS[key] ?? key
    const enteredRaw = num(currentMaxes?.[key])
    const entered = enteredRaw != null && enteredRaw > 0 ? enteredRaw : null

    const sources = all.filter(t => t.maxKey === key)

    // Merge every source lift onto one week axis, keeping the best per week.
    const byWeek = new Map<number, TrendPoint>()
    let setCount = 0
    for (const t of sources) {
      setCount += t.setCount
      for (const p of t.points) {
        const prev = byWeek.get(p.week)
        if (!prev || p.e1rm > prev.e1rm) byWeek.set(p.week, p)
      }
    }
    const points = [...byWeek.values()].sort((a, b) => a.week - b.week)
    const sourceLifts = sources.map(t => t.name).sort()

    const base = {
      key, label, entered, sourceLifts,
      weeksOfData: points.length, setCount,
    }

    if (!points.length) {
      out[key] = {
        ...base,
        projected: null, deltaPct: null, confidence: 'low', lastWeek: null, stale: false,
        basis: `No completed ${label.toLowerCase()} sets logged yet — nothing to project from.`,
      }
      continue
    }

    const lastWeek = points[points.length - 1].week
    const weeksSinceLast = latestWeek != null ? Math.max(0, latestWeek - lastWeek) : 0

    if (weeksSinceLast > staleAfter) {
      out[key] = {
        ...base,
        projected: null, deltaPct: null, confidence: 'low', lastWeek, stale: true,
        basis: `Last ${label.toLowerCase()} was week ${lastWeek}, ${weeksSinceLast} weeks ago — too stale to project from.`,
      }
      continue
    }

    // Best set inside the recency window — capability now, not a season ago.
    const windowStart = lastWeek - recencyWeeks + 1
    let src = points[points.length - 1]
    for (const p of points) {
      if (p.week >= windowStart && p.e1rm > src.e1rm) src = p
    }
    const projected = Math.round(src.e1rm)
    const deltaPct = entered != null ? pctChange(entered, projected) : null

    // Confidence answers two questions at once: is there enough of it, and is
    // it recent? Plenty of stale sets is not high confidence, and neither is
    // one heavy single yesterday.
    const raw: Confidence =
      points.length >= 4 && setCount >= 6 && weeksSinceLast <= 1 ? 'high'
      : points.length >= 2 && weeksSinceLast <= 3 ? 'medium'
      : 'low'
    // Recency we inferred from the athlete's own last session is not recency.
    const confidence: Confidence = !nowIsKnown && raw === 'high' ? 'medium' : raw

    const reps = src.reps === 1 ? 'single' : `${src.weightLbs} × ${src.reps}`
    const lift = canonicalLiftName(src.blockName) || src.blockName
    const weekWord = points.length === 1 ? '1 week' : `${points.length} weeks`
    const recency = !nowIsKnown ? `as of wk ${lastWeek}`
      : weeksSinceLast === 0 ? 'current'
      : `${weeksSinceLast} wk since last`

    out[key] = {
      ...base,
      projected, deltaPct, confidence, lastWeek, stale: false,
      basis: src.reps === 1
        ? `${src.weightLbs} lb ${lift} single (wk ${src.week}) · ${weekWord} of data · ${recency}`
        : `${reps} ${lift} (wk ${src.week}) → ${projected} lb e1RM · ${weekWord} of data · ${recency}`,
    }
  }

  return out
}

// ── 4. Adherence ─────────────────────────────────────────────────────────────

export interface WeekdayAdherence {
  /** day_number 1-7. In hybridPower this is Mon=1 … Sun=7. */
  day: number
  sessions: number
  /** sessions ÷ weeks tracked. */
  rate: number
}

export interface WeekAdherence {
  week: number
  sessions: number
  expected: number
  rate: number
  isDeload: boolean
}

export interface AdherenceResult {
  /** Where the counts came from — sentinel rows, or inferred from sets. */
  source: 'session_complete' | 'derived' | 'none'
  totalSessions: number
  weeksTracked: number
  averagePerWeek: number
  /** Total sessions ÷ (weeks × expected). */
  overallRate: number
  byWeekday: WeekdayAdherence[]
  byWeek: WeekAdherence[]
  sessions: Array<{ week: number; day: number | null; date: string | null }>
}

export interface AdherenceOpts {
  /** Sessions the program expects per week. Pass the active program's
   *  daysPerWeek — there is no single right number any more (Power Dad is 6
   *  since FOR-195 cut Sunday, Dad Built 6, Dad Strong 5). The default of 7
   *  is a full calendar week, not any program's shape. */
  daysPerWeek?: number
  /** Weekday buckets to report. Default 1-7. */
  weekdays?: number[]
  /** Flagged deloads — only used to LABEL weeks. Adherence never excludes them:
   *  a deload week is still a week you were supposed to show up. */
  deloadWeeks?: number[]
  macroWeeks?: number
}

/**
 * Session completion by weekday and by week.
 *
 * Prefers the 'session_complete' sentinel row (block_name '__session_complete__')
 * — that is the athlete explicitly finishing a session. When no sentinel exists
 * (older data, or a session logged set-by-set and never closed out), it falls
 * back to distinct (week_number, day_number) pairs carrying any completed set.
 *
 * Weeks between the first and last tracked week are FILLED IN at zero. A skipped
 * week that simply vanished from the chart would be the same lie as counting a
 * deload as a crash.
 */
export function adherence(rows: SetRow[], opts: AdherenceOpts = {}): AdherenceResult {
  const expected = opts.daysPerWeek ?? 7
  const weekdays = opts.weekdays ?? [1, 2, 3, 4, 5, 6, 7]
  const macroWeeks = opts.macroWeeks ?? MACRO_WEEKS
  const deloadWeeks = opts.deloadWeeks ?? []

  type Session = { week: number; day: number | null; date: string | null }
  const sentinel = new Map<string, Session>()
  const derived = new Map<string, Session>()

  for (const r of rows ?? []) {
    if (r == null) continue
    const week = weekOf(r.week_number)
    if (week == null) continue
    const day = int(r.day_number)
    const date = r.completed_at ?? null
    const key = `${week}|${day ?? '?'}`

    if (r.log_type === 'session_complete') {
      // The sentinel is written with completed = true; tolerate null, reject false.
      if (r.completed === false) continue
      const prev = sentinel.get(key)
      if (!prev || (date != null && (prev.date == null || date < prev.date))) {
        sentinel.set(key, { week, day, date })
      }
      continue
    }

    if (r.completed !== true) continue
    const prev = derived.get(key)
    if (!prev || (date != null && (prev.date == null || date < prev.date))) {
      derived.set(key, { week, day, date })
    }
  }

  const source: AdherenceResult['source'] =
    sentinel.size > 0 ? 'session_complete' : derived.size > 0 ? 'derived' : 'none'

  // Sentinels are authoritative from the FIRST week one appears onward: inside
  // that range, a day with sets but no sentinel is a session the athlete
  // started and never closed out, and counting it would inflate adherence.
  //
  // Before that week there were no sentinels to write — legacy data, or work
  // logged before the athlete ever pressed Finish — so those weeks must fall
  // back to sets. Switching globally instead of at that boundary meant a single
  // sentinel row retroactively deleted the athlete's entire set-logged history:
  // 40 real sessions across ten weeks reported as 1 session, 25% adherence.
  const picked = new Map<string, Session>()
  if (sentinel.size === 0) {
    for (const [k, v] of derived) picked.set(k, v)
  } else {
    const firstSentinelWeek = Math.min(...[...sentinel.values()].map(s => s.week))
    for (const [k, v] of derived) if (v.week < firstSentinelWeek) picked.set(k, v)
    for (const [k, v] of sentinel) picked.set(k, v)
  }

  const sessions = [...picked.values()].sort(
    (a, b) => a.week - b.week || (a.day ?? 0) - (b.day ?? 0),
  )

  if (!sessions.length) {
    return {
      source, totalSessions: 0, weeksTracked: 0, averagePerWeek: 0, overallRate: 0,
      byWeekday: weekdays.map(day => ({ day, sessions: 0, rate: 0 })),
      byWeek: [], sessions: [],
    }
  }

  const firstWeek = sessions[0].week
  const lastWeek = sessions[sessions.length - 1].week

  const weekCounts = new Map<number, number>()
  const dayCounts = new Map<number, number>()
  for (const s of sessions) {
    weekCounts.set(s.week, (weekCounts.get(s.week) ?? 0) + 1)
    if (s.day != null) dayCounts.set(s.day, (dayCounts.get(s.day) ?? 0) + 1)
  }

  const byWeek: WeekAdherence[] = []
  for (let w = firstWeek; w <= lastWeek; w++) {
    const n = weekCounts.get(w) ?? 0
    byWeek.push({
      week: w,
      sessions: n,
      expected,
      rate: expected > 0 ? round(n / expected, 3) : 0,
      isDeload: isDeloadWeek(w, deloadWeeks, macroWeeks),
    })
  }

  const weeksTracked = byWeek.length
  const byWeekday: WeekdayAdherence[] = weekdays.map(day => {
    const n = dayCounts.get(day) ?? 0
    return { day, sessions: n, rate: weeksTracked > 0 ? round(n / weeksTracked, 3) : 0 }
  })

  const totalSessions = sessions.length
  return {
    source,
    totalSessions,
    weeksTracked,
    averagePerWeek: weeksTracked > 0 ? round(totalSessions / weeksTracked, 2) : 0,
    overallRate: weeksTracked > 0 && expected > 0
      ? round(totalSessions / (weeksTracked * expected), 3)
      : 0,
    byWeekday,
    byWeek,
    sessions,
  }
}

// ── Weekly load ───────────────────────────────────────────────────────────────
// Tonnage and average intensity, per week. These two belong TOGETHER and are
// misleading apart: a periodised block deliberately trades volume for
// intensity, so 5x5 in meso 1 becomes 4x3 at 85%+ in meso 3 and tonnage FALLS
// while the athlete gets stronger. Shown alone, that reads as "you are doing
// less" — the same class of lie as counting a deload as a crash.
//
// Tonnage counts EVERY completed set, speed work and deload weeks included:
// it is total work done, and the deload dip is real and worth seeing.
// Intensity deliberately does NOT — velocity slots run at 55-74% by design and
// would drag the average toward a number that describes nothing.

export interface WeekLoad {
  week: number
  tonnage: number
  sets: number
  /** Mean of (weight / entered max) across mapped, non-velocity sets. */
  avgIntensityPct: number | null
  intensitySets: number
  isDeload: boolean
}

export function weeklyLoad(
  rows: SetRow[],
  currentMaxes: Record<string, number | string | null | undefined> | null | undefined,
  opts: TrendOpts,
): WeekLoad[] {
  const velSlots = new Set((opts.velocitySlots ?? []).map(normKey))
  const velNames = new Set(
    (opts.velocityNames ?? (DEFAULT_VELOCITY_LIFT_NAMES as readonly string[])).map(normKey),
  )
  const macroWeeks = opts.macroWeeks ?? MACRO_WEEKS

  const byWeek = new Map<number, { tonnage: number; sets: number; int: number[] }>()

  for (const r of rows) {
    if (r.log_type != null && r.log_type !== 'strength_set') continue
    if (r.completed === false) continue
    const w = int(r.week_number)
    const lb = num(r.weight_lbs)
    const reps = int(r.reps)
    if (w == null || lb == null || lb <= 0 || reps == null || reps <= 0) continue
    // A corrupt numeric must not become the week's headline.
    if (!Number.isFinite(lb) || !Number.isFinite(reps) || lb > 5000 || reps > 100) continue

    const bucket = byWeek.get(w) ?? { tonnage: 0, sets: 0, int: [] }
    bucket.tonnage += lb * reps
    bucket.sets += 1

    const isVel = velSlots.has(normKey(r.slot ?? '')) ||
      velSlots.has(normKey(r.block_name)) || velNames.has(normKey(r.block_name))
    if (!isVel) {
      const key = maxKeyForLift(r.block_name)
      const max = key ? num(currentMaxes?.[key]) : null
      if (max != null && max > 0) {
        const pct = (lb / max) * 100
        // Above ~120% of a max is a stale max or a typo, not a working set.
        if (Number.isFinite(pct) && pct > 0 && pct <= 120) bucket.int.push(pct)
      }
    }
    byWeek.set(w, bucket)
  }

  return [...byWeek.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([week, b]) => ({
      week,
      tonnage: Math.round(b.tonnage),
      sets: b.sets,
      avgIntensityPct: b.int.length
        ? Math.round((b.int.reduce((s, v) => s + v, 0) / b.int.length) * 10) / 10
        : null,
      intensitySets: b.int.length,
      isDeload: isDeloadWeek(week, opts.deloadWeeks ?? [], macroWeeks),
    }))
}
