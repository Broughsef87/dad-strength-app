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
