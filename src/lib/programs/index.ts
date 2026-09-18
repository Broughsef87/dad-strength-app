import { ProgramConfig, BuildDayOpts, DayPlan } from './types'
import { hybridPower } from './hybridPower'
import { hybridDad } from './hybridDad'
import { dadBuilt } from './dadBuilt'
import { reduceForTime } from './timeConstrained'
import { prepSlots } from './prep'

export * from './types'
export * from './prep'
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
      const plan = withPrep(config.buildDay(weekNumber, dayNumber, maxes, adjustments, opts))
      return opts?.timeConstrained ? reduceForTime(plan) : plan
    },
  }
}

/**
 * The prep sequence, in front of every day that asks for max intent (FOR-244).
 *
 * HERE, not in the program files, for the same reason the modes are here: a
 * program must not be able to add a ballistic slot and forget the warm-up. A
 * day earns a prep by CONTAINING a jump or a sprint, so the rule holds for
 * Dad Built and Hybrid Dad the moment either grows one — which is what the
 * ticket means by "the check must still cover all three".
 *
 * It goes FIRST, before the jumps it exists to precede. Jumps stay first among
 * the work: max-intent power should never be fatigued, and Andrew's ruling is
 * explicit that they do not move later. A prep before them is not moving them.
 *
 * Dad Built's only plyo slot is a farmer carry, which is a carry and not a
 * landing — so `ballistic` asks for sets AND reps above one, and a 3×1 carry
 * does not earn a prep it has no use for.
 */
function withPrep(plan: DayPlan): DayPlan {
  if (plan.items.some((i) => i.kind === 'prep')) return plan
  const ballistic = plan.items.some((i) => i.kind === 'plyo' && !/carry|farmer/i.test(i.name) && i.reps > 1)
  const sprint = plan.items.some((i) => i.kind === 'outside' && i.slot === 'sprint')
  if (!ballistic && !sprint) return plan
  return { ...plan, items: [...prepSlots(), ...plan.items] }
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
