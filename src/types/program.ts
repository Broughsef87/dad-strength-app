// Canonical type definitions for the active training program.
// Previously lived in ProgramSelector.tsx — moved here so build/page.tsx
// and any other consumers don't depend on a deprecated component.

export interface ActiveProgramData {
  slug: string
  name: string
  startedAt: string
  currentWeek: number
  trainingAge: string
  primaryGoal: string
  equipment: Record<string, boolean>
  daysCount: number
  dayNames: string[]
}
