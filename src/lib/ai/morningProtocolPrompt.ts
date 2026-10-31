// The morning routine's model call: model, prompts, schema and call options.
// One copy. The route sends it and the scored eval (scripts/evals/morning-protocol)
// runs it, so what gets scored is what users get. A prompt or model change here
// means rerunning that eval (FOR-326).
import { z } from 'zod'

export const MORNING_MODEL = 'claude-haiku-5-5'

export type MorningInput = {
  minutes: number
  sleepQuality?: string | null
  energy?: string | null
  objectives?: string[]
  dayOfWeek: string
}

const oneLine = (v: string) => v.replace(/[\r\n]+/g, ' ').trim()

export const MORNING_SYSTEM = `You are a high-performance coach for busy dads with young babies. Generate a morning protocol built around 4 pillars: Prayer, Meditation, Reading, and Goals. Tone: Stoic, direct, no fluff. Time must add up to exactly the requested minutes distributed across the pillars.`

export function morningPrompt({ minutes, sleepQuality, energy, objectives = [], dayOfWeek }: MorningInput): string {
  const named = objectives.map(oneLine).filter(Boolean)
  const objectivesList = named.length
    ? named.map((o, i) => `${i + 1}. ${o}`).join('\n')
    : 'No objectives set'
  return `Today is ${dayOfWeek}.
Available time: ${minutes} minutes
Last night's sleep: ${sleepQuality ? oneLine(sleepQuality) : 'not given'}
Energy level: ${energy ? oneLine(energy) : 'not given'}
Today's objectives:
${objectivesList}

Generate a morning protocol with exactly 4 steps — one for each pillar. Distribute the ${minutes} minutes wisely based on energy. Low energy = more Prayer/Meditation. High energy = more Reading/Goals.
If last night was rough (Rough night or Up all night): keep the time split, but make Reading a short, light passage (no heavy study), and make Goals about the ONE most important objective today, not the whole list. Name that in the guidance.`
}

export const MorningProtocolSchema = z.object({
  theme: z.string().describe("A short, punchy theme for today's morning — e.g. 'The Quiet Before the War'"),
  greeting: z.string().describe("1-2 sentence personal greeting acknowledging last night's sleep and energy level. Direct, warm, stoic."),
  steps: z.array(z.object({
    pillar: z.enum(['Prayer', 'Meditation', 'Reading', 'Goals']),
    minutes: z.number().describe('Minutes allocated to this pillar'),
    title: z.string().describe('Short action title for this pillar'),
    guidance: z.string().describe('2-3 sentence guidance for this block'),
    prompt: z.string().describe('A single focus prompt or intention for this block'),
  })).length(4),
  closingWord: z.string().describe("One final sentence to send them into the day — stoic, motivating"),
})

export type MorningProtocol = z.infer<typeof MorningProtocolSchema>

// Output cap and effort. The route adds its own 25s abort signal.
export const MORNING_CALL = {
  maxOutputTokens: 2000,
  // Short structured output: low effort keeps the response fast.
  providerOptions: { anthropic: { effort: 'low' as const } },
}
