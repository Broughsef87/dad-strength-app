// ── Competition lights on the classic lifts (FOR-337) ────────────────────────
// Andrew, 2026-11-02: RPE is hard to read on a snatch — you rarely feel a
// snatch as a 9 — but you always know whether you barely made it. So the
// snatch and the clean & jerk are rated the way a meet rates them:
//
//    3  ⚪⚪⚪  clean lift
//    2  ⚪⚪    good lift
//    1  ⚪     barely made it
//    0  🔴    miss
//
// Every other lift keeps RPE. Pure rules, no AI, no Supabase: the check in
// scripts/checks/lights.mjs executes this file.

export const LIGHTS = [3, 2, 1, 0] as const
export type Lights = (typeof LIGHTS)[number]

export const LIGHTS_LABEL: Record<Lights, string> = {
  3: 'Clean',
  2: 'Good',
  1: 'Barely',
  0: 'Miss',
}

export const LIGHTS_HINT: Record<Lights, string> = {
  3: 'Three white lights. Clean lift.',
  2: 'Two whites. A good lift.',
  1: 'One white. Barely made it.',
  0: 'Three reds. Missed it.',
}

const CLASSIC_MAX_KEYS = new Set(['snatch', 'clean_jerk'])

/**
 * Does this lift get lights? The snatch and clean & jerk and their variations
 * (hang, pause, power, jerk from rack, the heavy climbs). Not the strength
 * work keyed off the same maxes: pulls, presses and squats are rated by RPE
 * like everything else. Slot AND name are checked, because mesos rotate a
 * slot from one movement to another.
 */
export function usesLights(slot: string, name: string, maxKey: string | undefined): boolean {
  if (!maxKey || !CLASSIC_MAX_KEYS.has(maxKey)) return false
  const s = `${slot} ${name}`.toLowerCase()
  return !/pull|press|squat|deadlift|rdl/.test(s)
}

export const isLights = (v: unknown): v is Lights => v === 0 || v === 1 || v === 2 || v === 3

/** A step down after two or more misses, on top of holding the weight. */
export const MISS_STEP_DOWN = 2
/** A small step up when every lift was three whites. */
export const CLEAN_STEP_UP = 1.5

/**
 * Next week's change for a slot rated by lights, in percent of the max,
 * measured against what the table would otherwise do.
 *
 *   two or more misses ............ hold, then one step down
 *   one miss, or any one-white .... hold (cancel this week's table step)
 *   every set three whites ........ a small step up
 *   otherwise ..................... as written
 *
 * `tableStep` is how far the table moves this slot this week (this week's bare
 * percent minus last week's). Holding cancels it. A table that does not climb
 * this week (0 or negative, a meso boundary) has nothing to cancel, so a hold
 * there is 0.
 */
export function lightsDelta(lights: readonly number[], tableStep: number): number {
  const rated = lights.filter(isLights)
  if (!rated.length) return 0
  const misses = rated.filter((l) => l === 0).length
  const hold = -Math.max(0, tableStep)
  if (misses >= 2) return hold - MISS_STEP_DOWN
  if (misses === 1 || rated.includes(1)) return hold
  if (rated.every((l) => l === 3)) return CLEAN_STEP_UP
  return 0
}

/** Misses in one session that, on their own, raise the deload question. */
export const DELOAD_MISSES_IN_SESSION = 3

/**
 * Should the app ask about a deload? `sessions` is the classic-lift miss count
 * per session, most recent first (the session in progress included). It asks,
 * it never acts:
 *
 *   3+ misses in one session, or
 *   misses in 2 of the last 3 sessions that had classic lifts.
 */
export function shouldAskDeload(sessions: readonly number[]): boolean {
  if (sessions.some((m) => m >= DELOAD_MISSES_IN_SESSION)) return true
  return sessions.slice(0, 3).filter((m) => m > 0).length >= 2
}
