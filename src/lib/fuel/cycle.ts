// ── Fuel: which cycle is live ────────────────────────────────────────────────
// A plan is keyed by the Monday its cycle started, and a fortnight cycle is
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

/** Days from a cycle's start to `today`, whole days. */
export function daysInto(weekStart: string, today: Date): number {
  const start = parse(weekStart)
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((t.getTime() - start.getTime()) / 86_400_000)
}

/**
 * The newest plan whose cycle covers today, or null. Rows may arrive in any
 * order and any version; the latest start wins, and within it the highest
 * version. A cycle started on a Sunday for the coming week (the page's own
 * advice) is live from that Sunday.
 */
export function activeCycle<T extends CycleRow>(rows: T[], today: Date): T | null {
  const live = rows.filter((r) => {
    const into = daysInto(r.week_start, today)
    return into >= -1 && into < Math.max(7, r.shop_cadence_days)
  })
  if (!live.length) return null
  return live.sort((a, b) => b.week_start.localeCompare(a.week_start) || b.version - a.version)[0]
}

/** The key a NEW cycle gets: the live cycle's start if there is one, else this week's Monday. */
export function cycleKeyFor(active: CycleRow | null, today: Date): string {
  return active ? active.week_start : mondayOf(today)
}
