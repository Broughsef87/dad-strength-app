// ── Adherence: two honest numbers ────────────────────────────────────────────
//
// FOR-228. The dashboard used to show one streak: consecutive CALENDAR days
// with a completed row in workout_logs. The programs prescribe four lifting
// days a week, so a compliant athlete could never hold that streak past 1 or
// 2 — the metric could not produce a streak for the programs the app ships,
// and the morning protocol, the only thing that happens every day, counted
// for nothing.
//
// It is replaced by two numbers that are never blended:
//
//   rollingDays          "N of the last 20 days" — the DAILY number, off
//                        morning-protocol completion. A rolling window has no
//                        break to protect: a bad week costs the days it cost,
//                        nothing more, and the number recovers as they roll
//                        off. It cannot reset.
//
//   trainingAdherence    sessions completed vs sessions prescribed — the
//                        WEEKLY number. The dashboard reads it for the current
//                        week; the check reads it across four.
//
// Both are pure. Day identity is a YYYY-MM-DD local-day key — for the morning
// protocol that is the 4am-cutoff key MorningProtocol writes, so a 1am
// finish counts for the morning it belonged to.

const DAY_MS = 86_400_000

/** Local calendar date from a YYYY-MM-DD key. Local, so DST cannot shift the day. */
function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Whole days from `from` to `to` (both keys). Rounded, so a DST hour is not a day. */
export function daysBetween(from: string, to: string): number {
  return Math.round((fromKey(to).getTime() - fromKey(from).getTime()) / DAY_MS)
}

export interface RollingDays {
  /** distinct done days inside the window */
  done: number
  /** the window, in days, ending today inclusive */
  window: number
}

/**
 * How many of the last `window` days (today inclusive) carry a completion.
 *
 * `doneDays` are day keys; duplicates and days outside the window are ignored,
 * and a day in the future is not counted either. Nothing here can reset — the
 * only way the number falls is a done day rolling out of the window.
 */
export function rollingDays(doneDays: Iterable<string>, today: string, window = 20): RollingDays {
  const inWindow = new Set<string>()
  for (const key of doneDays) {
    const age = daysBetween(key, today)
    if (Number.isFinite(age) && age >= 0 && age < window) inWindow.add(key)
  }
  return { done: inWindow.size, window }
}

/** One saved protocol, as it sits in daily_checkins.spirit_state.morning. */
export interface MorningEntry {
  date?: string
  protocol?: { theme?: string; steps?: unknown[] }
  completed?: boolean[]
}

/** The shape daily_checkins.spirit_state holds. */
export interface MorningState {
  morning?: MorningEntry | null
  /** The row this snapshot came from — daily_checkins.date. */
  row?: string | null
}

/**
 * THE RECORD IS THE ROW, and for one protocol day it is ONE row: the row keyed
 * on that day. Nothing else is consulted — no second copy, no timestamp, no
 * ranking between rows (FOR-231 v2).
 *
 * Every protocol write lands in the row keyed on the entry's own 4am-cutoff day
 * (FOR-228, ruling 2), so post-fix a protocol day has exactly one row and
 * (user_id, date) is unique. A row whose date differs from the entry it carries
 * is pre-fix history — written when the row was keyed on the calendar day, so a
 * 1am finish landed in the next day's row. Those rows are NOT the record and
 * are not counted.
 *
 * The transition, stated: a protocol completed pre-dawn before 2026-09-13 sits
 * in the following day's row and stops counting. Nothing writes that shape any
 * more, and the 20-day window drops every pre-fix day on 2026-10-03, after
 * which this rule never fires. That is the ninth clause DELETED rather than
 * answered — the eight-clause negotiation it belonged to is gone with it.
 */
export function isRecordRow(s: MorningState | null | undefined): boolean {
  const date = s?.morning?.date
  return !!date && s?.row === date
}

/**
 * The day keys on which the morning protocol was COMPLETED — every step
 * ticked. A protocol generated and half-run is a day it was opened, not a day
 * it was done. Keyed on the protocol's own 4am-cutoff date.
 */
export function protocolCompleteDays(states: Iterable<MorningState | null | undefined>): string[] {
  // One pass, no ranking: only the row that IS the record for a day is judged.
  // A completion later undone is not a completion, because the undo lands in
  // that same row.
  const done = new Set<string>()
  for (const s of states) {
    if (!isRecordRow(s)) continue
    const m = s!.morning!
    if (!Array.isArray(m.completed) || m.completed.length === 0) continue
    const steps = m.protocol?.steps
    if (Array.isArray(steps) && steps.length !== m.completed.length) continue
    if (m.completed.every(Boolean)) done.add(m.date!)
  }
  return [...done]
}

export interface WeekRecord {
  /** scheduled sessions completed in that week */
  done: number
  /** sessions the program asked for in that week */
  prescribed: number
}

export interface TrainingAdherence {
  done: number
  prescribed: number
}

/**
 * Sessions completed vs sessions prescribed over the weeks given.
 *
 * Each record is one week as the schedule module counts it — done is
 * `scheduledDoneDays(...).length`, prescribed is `sessionsThisWeek(...)` — so
 * the number agrees with the week strip above it by construction. One record
 * is the dashboard's weekly read; four is the check's.
 */
export function trainingAdherence(weeks: Iterable<WeekRecord>): TrainingAdherence {
  let done = 0
  let prescribed = 0
  for (const w of weeks) {
    done += Math.max(0, w.done)
    prescribed += Math.max(0, w.prescribed)
  }
  return { done, prescribed }
}
