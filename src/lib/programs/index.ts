import { ProgramConfig, BuildDayOpts } from './types'
import { hybridPower } from './hybridPower'
import { hybridDad } from './hybridDad'
import { dadBuilt } from './dadBuilt'
import { reduceForTime } from './timeConstrained'

export * from './types'
export * from './progression'
export { reduceForTime } from './timeConstrained'

// Modes live here, program-agnostic, so a program file never has to know
// about them and a mode can never become a fourth program by accident.
//
// opts.timeConstrained returns a reduced day for whatever program the athlete
// is already on (FOR-225 §2). It is NOT a program: no row, no slug, no
// selection UI — the registry below has exactly the three entries whether
// the mode is on or off.
function withModes(config: ProgramConfig): ProgramConfig {
  return {
    ...config,
    buildDay(weekNumber, dayNumber, maxes, adjustments, opts?: BuildDayOpts) {
      const plan = config.buildDay(weekNumber, dayNumber, maxes, adjustments, opts)
      return opts?.timeConstrained ? reduceForTime(plan) : plan
    },
  }
}

// Registry of training paths — the engine is program-agnostic.
//
// Three programs (FOR-225, 2026-09-13): Power Dad, Dad Built, Hybrid Dad.
// Dad Strong was cut and Hybrid Endurance renamed to Hybrid Dad. Both slugs
// were FK identifiers; both changed outright with no backfill, because there
// were no other users yet — the window that closes the day someone signs up.
export const PROGRAMS: Record<string, ProgramConfig> = {
  [hybridPower.slug]: withModes(hybridPower),
  [dadBuilt.slug]: withModes(dadBuilt),
  [hybridDad.slug]: withModes(hybridDad),
}

// All three paths are live; new paths queue here while their programming
// is specced.
export const UPCOMING_PROGRAMS: Array<{
  slug: string; name: string; tagline: string; description: string
}> = []

export function getProgram(slug: string): ProgramConfig | null {
  return PROGRAMS[slug] ?? null
}
