import { ProgramConfig } from './types'
import { hybridPower } from './hybridPower'
import { dadStrong } from './dadStrong'
import { hybridEndurance } from './hybridEndurance'

export * from './types'

// Registry of training paths — the engine is program-agnostic.
export const PROGRAMS: Record<string, ProgramConfig> = {
  [dadStrong.slug]: dadStrong,
  [hybridPower.slug]: hybridPower,
  [hybridEndurance.slug]: hybridEndurance,
}

// All three paths are live; new paths queue here while their programming
// is specced.
export const UPCOMING_PROGRAMS: Array<{
  slug: string; name: string; tagline: string; description: string
}> = []

export function getProgram(slug: string): ProgramConfig | null {
  return PROGRAMS[slug] ?? null
}
