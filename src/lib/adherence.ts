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

/** One saved protocol — the shape MorningProtocol writes into daily_checkins.spirit_state.morning. */
export interface MorningEntry {
  date?: string
  protocol?: { theme?: string; steps?: unknown[] }
  completed?: boolean[]
}

/**
 * One daily_checkins row, as the count reads it: the protocol entry the row
 * holds, and the calendar date the row is keyed on.
 */
export interface MorningState {
  morning?: MorningEntry | null
  /** daily_checkins.date. Absent is read as the row keyed on the entry's own day. */
  row?: string | null
}

// ── THE RECORD IS THE ROW (FOR-231) ──────────────────────────────────────────
// daily_checkins is the only record of the morning protocol. Nothing here reads
// localStorage, and nothing here weighs one copy against another: the count
// reads rows and nothing else.
//
// ONE PROTOCOL DAY, ONE ROW — with one stated exception for history. Since the
// FOR-228 row-key fix (shipped 2026-09-13) every protocol write lands in the row
// keyed on the protocol's own 4am-cutoff day, so a day has exactly one row and
// that row is its record. Before the fix, writes landed in the CALENDAR day's
// row: a protocol worked between midnight and 4am wrote into the next calendar
// day's row while its entry still carried its own date — a legacy row, the only
// kind whose row date differs from its entry's date. And by the way that code
// wrote rows, a legacy row was always the LAST write of its protocol day:
// everything written to the day's own row happened before midnight, everything
// written to the legacy row after it, and the next morning's protocol overwrote
// the legacy row entirely unless nothing followed. So the record of a pre-fix
// day is its legacy row when one survives, and its own row otherwise.
//
// That rule reads no timestamp — updated_at moves when objectives are saved
// into a row, which is how two earlier answers to this question went wrong
// (FOR-228, Codex r6 and r7). It is wrong for exactly one day: a protocol day
// whose window contained the fix's deploy, written into a legacy row before it
// and its own row after. And it expires by itself: once the rows written
// before 2026-09-13 leave the 20-day window, every row in it is keyed on its
// own day and there is nothing left to choose between.

/** Is this row a pre-fix legacy row — keyed on a calendar day other than its entry's own day? */
export function isLegacyRow(s: MorningState): boolean {
  return !!s.row && !!s.morning?.date && s.row !== s.morning.date
}

/**
 * The day keys on which the morning protocol was COMPLETED — every step
 * ticked, the state MorningProtocol itself stamps "morning done". A protocol
 * that was generated and half-run is a day the protocol was opened, not a day
 * it was done. Keyed on the protocol's own 4am-cutoff date, not the row date.
 * Each day is judged on its ONE record, chosen by the rule above.
 */
export function protocolCompleteDays(states: Iterable<MorningState | null | undefined>): string[] {
  const record = new Map<string, MorningState>()
  for (const s of states) {
    const date = s?.morning?.date
    if (!s || !date) continue
    const held = record.get(date)
    if (!held || (isLegacyRow(s) && !isLegacyRow(held))) record.set(date, s)
  }
  const out: string[] = []
  for (const [date, s] of record) {
    const m = s.morning
    if (!m || !Array.isArray(m.completed) || m.completed.length === 0) continue
    const steps = m.protocol?.steps
    if (Array.isArray(steps) && steps.length !== m.completed.length) continue
    if (m.completed.every(Boolean)) out.push(date)
  }
  return out
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
