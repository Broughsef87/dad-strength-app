import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'

export async function POST(req: Request) {
  const { minutes, babyNight, energy, objectives, dayOfWeek } = await req.json()

  const hasObjectives = Array.isArray(objectives) && objectives.filter(Boolean).length > 0
  const objectivesList = hasObjectives
    ? objectives.filter(Boolean).join(', ')
    : 'none set'

  try {
    const { object: protocol } = await generateObject({
      model: google('gemini-1.5-flash'),
      system: `You are a morning routine coach for a Christian dad who wants to show up strong for his family and his mission. Build a personalized morning protocol.

Rules:
- Total step minutes must add up to exactly the requested available time.
- If energy is low or baby's night was rough: shorter steps, more grace, gentler tone — this dad is tired
- If energy is high: push harder, more depth, more challenge
- Sunday: lean into rest and reflection, not hustle
- Objectives should shape the Goals & Journal step specifically
- Reading guidance should suggest a TYPE of book or topic, not a specific title
- Tone: like a coach and a brother — direct, warm, real. No corporate wellness speak. No toxic positivity.
- Use ONLY these four pillars (drop Meditation if under 15 min): Prayer, Meditation, Reading, Goals & Journal.`,
      prompt: `Context:
- Available time: ${minutes} minutes
- Baby's night: ${babyNight}
- Energy level: ${energy}
- Day of week: ${dayOfWeek}
- Today's objectives: ${objectivesList}`,
      schema: z.object({
        theme: z.string().describe("one word or short phrase that captures the tone of this morning"),
        greeting: z.string().describe("one direct, personal opening line — acknowledge baby's night if rough"),
        steps: z.array(z.object({
          pillar: z.enum(["Prayer", "Meditation", "Reading", "Goals & Journal"]),
          minutes: z.number(),
          title: z.string(),
          guidance: z.string().describe("2-3 sentences of specific, practical guidance"),
          prompt: z.string().describe("one specific question or focus prompt for this step")
        })),
        closingWord: z.string().describe("one short sentence to carry into the day — grounded, fatherhood-focused")
      })
    })

    return Response.json({ protocol })
  } catch (error: any) {
    console.error('Failed to generate protocol:', error)
    return Response.json({ error: error?.message || 'Failed to generate protocol' }, { status: 500 })
  }
}
