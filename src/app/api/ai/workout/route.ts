import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'

export async function POST(req: Request) {
  const { minutes, situation, track } = await req.json()

  try {
    const { object: workout } = await generateObject({
      model: google('gemini-2.5-flash'),
      system: `You are a strength coach for busy dads. Generate a practical, no-fluff workout.

Rules:
- Scale exercises to fit the time available. 20 min = 3-4 exercises, 45 min = 5-6.
- Keep rest periods short (45-60s) for time constraints under 30 minutes
- Tone: direct, no fluff, respect that this dad is tired and short on time`,
      prompt: `Context:
- Available time: ${minutes} minutes
- Situation: ${situation || 'standard session'}
- Equipment: ${track === 'home' ? 'home setup (dumbbells, bodyweight)' : 'full gym'}`,
      schema: z.object({
        title: z.string().describe("short punchy workout name"),
        tagline: z.string().describe("one sentence, motivational, dad-specific"),
        exercises: z.array(z.object({
          name: z.string(),
          sets: z.number(),
          reps: z.string(),
          note: z.string().optional().describe("optional short cue")
        })),
        coachNote: z.string().describe("2-3 sentences of coaching context for a busy dad")
      })
    })

    return Response.json({ workout })
  } catch (error) {
    return Response.json({ error: 'Failed to generate workout' }, { status: 500 })
  }
}
