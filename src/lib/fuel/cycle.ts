// ── Fuel: which cycle is live ────────────────────────────────────────────────
// A plan is keyed by the Monday its cycle starts, and a fortnight cycle is
// live for fourteen days from there — the second week is when the second
// trip happens, so the plan must still be the plan on day nine. Pure, so the
// check can prove it; the store passes it the rows and today.

export interface CycleRow {
  week_start: string
  version: number
  /** From rules_snapshot.shop_cadence_days — how long the cycle runs. */
  shop_cadence_days: number
}

const parse = (key: string): Date => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d) }
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Monday of the week containing `d`, local. */
export function mondayOf(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return key(x)
}

/**
 * The Monday a NEW cycle planned today starts on. Sunday is planning day —
 * the page says so — and a Sunday plan is for the week that starts
 * tomorrow, not the one that ended yesterday (Codex, round 2).
 */
export function cycleStartFor(today: Date): string {
  if (today.getDay() === 0) {
    const mon = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
    return key(mon)
  }
  return mondayOf(today)
}

/**
 * The oldest start worth loading: five weeks back — a fortnight cycle
 * started up to fourteen days ago is still live, and the monthly steak rule
 * is judged over the four weeks before a cycle ends (Codex, round 10).
 * Bounding the query by START keeps a busy cycle's version history from
 * crowding the live one out of a row limit (Codex, round 5).
 */
export function historyFloor(today: Date): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 35)
  return key(d)
}

/** Whole days from one cycle key to another; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return daysInto(from, parse(to))
}

/** Days from a cycle's start to `today`, whole days. */
export function daysInto(weekStart: string, today: Date): number {
  const start = parse(weekStart)
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((t.getTime() - start.getTime()) / 86_400_000)
}

/**
 * The newest plan whose cycle covers today, or null. Rows may arrive in any
 * order and any version. For each start, only the HIGHEST version speaks —
 * a superseded version's longer cadence cannot resurrect it after the newer
 * version has expired (Codex, round 2). Among live starts the latest wins.
 * A cycle planned on the Sunday before its Monday is live from that Sunday.
 */
export function activeCycle<T extends CycleRow>(rows: T[], today: Date): T | null {
  const latest = new Map<string, T>()
  for (const r of rows) {
    const cur = latest.get(r.week_start)
    if (!cur || r.version > cur.version) latest.set(r.week_start, r)
  }
  const live = [...latest.values()].filter((r) => {
    const into = daysInto(r.week_start, today)
    return into >= -1 && into < Math.max(7, r.shop_cadence_days)
  })
  if (!live.length) return null
  return live.sort((a, b) => b.week_start.localeCompare(a.week_start))[0]
}

/** The key a NEW version gets: the live cycle's start if there is one, else the cycle a plan made today belongs to. */
export function cycleKeyFor(active: CycleRow | null, today: Date): string {
  return active ? active.week_start : cycleStartFor(today)
}

/**
 * The key a REBUILD of the live cycle gets. Normally the live start. But a
 * household that shortens its cadence mid-cycle — a fortnight rebuilt as
 * weekly on day nine — would snapshot a cycle that is already over, and the
 * new version would be invisible on reload (Codex, round 4). When today is
 * past the new cadence, the rebuild is a fresh cycle keyed on this week.
 */
export function rebuildKey(active: CycleRow, newCadenceDays: number, today: Date): string {
  const into = daysInto(active.week_start, today)
  return into >= Math.max(7, newCadenceDays) ? cycleStartFor(today) : active.week_start
}

/**
 * A cycle planned AHEAD — its start is after tomorrow — is not live yet but
 * must not be lost (Codex, round 4): the nearest upcoming start, highest
 * version, or null.
 */
export function upcomingCycle<T extends CycleRow>(rows: T[], today: Date): T | null {
  const latest = new Map<string, T>()
  for (const r of rows) {
    const cur = latest.get(r.week_start)
    if (!cur || r.version > cur.version) latest.set(r.week_start, r)
  }
  const ahead = [...latest.values()].filter((r) => daysInto(r.week_start, today) < -1)
  if (!ahead.length) return null
  return ahead.sort((a, b) => a.week_start.localeCompare(b.week_start))[0]
}

/** The Monday the cycle after `active` starts on — its start plus its cadence. */
export function nextCycleStart(active: CycleRow): string {
  const start = parse(active.week_start)
  const next = new Date(start.getFullYear(), start.getMonth(), start.getDate() + Math.max(7, active.shop_cadence_days))
  return key(next)
}

/**
 * The key a NEXT-cycle build gets: the cycle already planned ahead, or the
 * start where the live one ends — unless that start has itself expired
 * while the page sat open (a weekly plan opened on its Sunday and built a
 * week later), when the next cycle is the one that covers today (Codex,
 * round 9). A start still live, or still ahead, is kept.
 */
export function nextCycleKey(active: CycleRow, upcomingStart: string | null, newCadenceDays: number, today: Date): string {
  const target = upcomingStart ?? nextCycleStart(active)
  return daysInto(target, today) >= Math.max(7, newCadenceDays) ? cycleStartFor(today) : target
}

/**
 * Is a plan made today a regeneration of the live cycle, or the NEXT cycle?
 * On a cycle's final day — the Sunday before the next Monday, planning day —
 * the answer is the next cycle: a rebuild that kept the old start would be
 * live for a day and gone (Codex, round 3). Before that, it is a
 * regeneration. The page lets the athlete override either way.
 */
export function planningMode(active: CycleRow | null, today: Date): 'regenerate' | 'next' {
  if (!active) return 'next'
  const into = daysInto(active.week_start, today)
  return into >= Math.max(7, active.shop_cadence_days) - 1 ? 'next' : 'regenerate'
}
