import { ProgramConfig } from './types'
import { hybridPower } from './hybridPower'
import { dadStrong } from './dadStrong'
import { hybridEndurance } from './hybridEndurance'
import { dadBuilt } from './dadBuilt'

export * from './types'
export * from './progression'

// Registry of training paths — the engine is program-agnostic.
export const PROGRAMS: Record<string, ProgramConfig> = {
  [dadStrong.slug]: dadStrong,
  [hybridPower.slug]: hybridPower,
  [hybridEndurance.slug]: hybridEndurance,
  [dadBuilt.slug]: dadBuilt,
}

// All four paths are live; new paths queue here while their programming
// is specced.
export const UPCOMING_PROGRAMS: Array<{
  slug: string; name: string; tagline: string; description: string
}> = []

export function getProgram(slug: string): ProgramConfig | null {
  return PROGRAMS[slug] ?? null
}
