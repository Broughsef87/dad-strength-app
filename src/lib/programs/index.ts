import { ProgramConfig } from './types'
import { hybridPower } from './hybridPower'

export * from './types'

// Registry of training paths. Dad Strong and Hybrid Endurance land here
// once their programming is specced — the engine is program-agnostic.
export const PROGRAMS: Record<string, ProgramConfig> = {
  [hybridPower.slug]: hybridPower,
}

export const UPCOMING_PROGRAMS = [
  {
    slug: 'dad-strong',
    name: 'Dad Strong',
    tagline: 'Strength · powerlifting · strongman',
    description: 'General strength with powerlifting and strongman flavor. Coming soon.',
  },
  {
    slug: 'hybrid-endurance',
    name: 'Hybrid Endurance',
    tagline: 'Strength · endurance · conditioning',
    description: 'Strength maintained on a serious aerobic engine. Coming soon.',
  },
]

export function getProgram(slug: string): ProgramConfig | null {
  return PROGRAMS[slug] ?? null
}
