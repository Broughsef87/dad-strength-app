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

/** One saved protocol — the shape MorningProtocol caches locally and mirrors. */
export interface MorningEntry {
  date?: string
  protocol?: { theme?: string; steps?: unknown[] }
  completed?: boolean[]
}

/** The shape MorningProtocol mirrors into daily_checkins.spirit_state. */
export interface MorningState {
  morning?: MorningEntry | null
  /**
   * When this snapshot was written — the mirror row's updated_at. Absent
   * means newest: a local save that has not landed yet.
   */
  at?: string | null
}

/** Ordering of a snapshot: newest first. Unstamped is newest; unparsable is oldest. */
function rank(s: MorningState): number {
  if (s.at == null) return Infinity
  const t = Date.parse(s.at)
  return Number.isNaN(t) ? -Infinity : t
}

/**
 * Reconcile the local cache MorningProtocol writes FIRST against the mirror
 * it writes after.
 *
 * The cache is the newer state — onSaved fires before the mirror lands — but
 * it carries no owner: it is one browser-wide key, and a previous account's
 * completion would otherwise count for whoever signs in next. So it is
 * trusted only when the mirror, which is row-level-secured to the signed-in
 * user, already holds the same protocol for the same day; then the cache is
 * that entry's latest state and REPLACES it — a step unticked seconds ago is
 * unticked, not unioned with the snapshot that still says done. A cache with
 * no matching mirror entry is ignored: someone else's, or a protocol so new
 * that nothing on it can be complete yet.
 */
export function reconcileLocal(
  states: Iterable<MorningState | null | undefined>,
  local: MorningEntry | null | undefined,
): (MorningState | null | undefined)[] {
  const all = [...states]
  if (!local?.date || !localMatchesMirror(all, local)) return all
  return [...all.filter((s) => !sameProtocol(s?.morning, local)), { morning: local }]
}

/**
 * Does the mirror already hold the protocol the local cache holds — same day,
 * same theme, same step count? False until the save that wrote the cache has
 * landed, which is how the dashboard knows whether to read again.
 */
export function localMatchesMirror(
  states: Iterable<MorningState | null | undefined>,
  local: MorningEntry | null | undefined,
): boolean {
  if (!local?.date) return false
  for (const s of states) if (sameProtocol(s?.morning, local)) return true
  return false
}

function sameProtocol(m: MorningEntry | null | undefined, local: MorningEntry): boolean {
  return !!m && m.date === local.date
    && m.protocol?.theme === local.protocol?.theme
    && (m.protocol?.steps?.length ?? -1) === (local.protocol?.steps?.length ?? -1)
}

/**
 * The day keys on which the morning protocol was COMPLETED — every step
 * ticked, the state MorningProtocol itself stamps "morning done". A protocol
 * that was generated and half-run is a day the protocol was opened, not a day
 * it was done. Keyed on the protocol's own 4am-cutoff date, not the row date.
 */
export function protocolCompleteDays(states: Iterable<MorningState | null | undefined>): string[] {
  // One protocol day can be mirrored in two calendar rows — finished before
  // midnight in one, a step unticked at 1am in the next — so each protocol
  // day is resolved to its LATEST snapshot first, and only that one is
  // judged. A completion that was later undone is not a completion.
  const latest = new Map<string, MorningState>()
  for (const s of states) {
    const date = s?.morning?.date
    if (!s || !date) continue
    const prev = latest.get(date)
    if (!prev || rank(s) >= rank(prev)) latest.set(date, s)
  }
  const out: string[] = []
  for (const [date, s] of latest) {
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
