import { google } from '@ai-sdk/google'
import { generateText } from 'ai'

export async function POST(req: Request) {
  const { minutes, situation, track } = await req.json()

  const { text } = await generateText({
    model: google('gemini-2.5-pro'),
    prompt: `You are a strength coach for busy dads. Generate a practical, no-fluff workout.

Context:
- Available time: ${minutes} minutes
- Situation: ${situation || 'standard session'}
- Equipment: ${track === 'home' ? 'home setup (dumbbells, bodyweight)' : 'full gym'}

Return a JSON object with this exact structure:
{
  "title": "short punchy workout name",
  "tagline": "one sentence, motivational, dad-specific",
  "exercises": [
    { "name": "Exercise Name", "sets": 3, "reps": "10-12", "note": "optional short cue" }
  ],
  "coachNote": "2-3 sentences of coaching context for a busy dad"
}

Rules:
- Scale exercises to fit the time available (${minutes} min). 20 min = 3-4 exercises, 45 min = 5-6.
- Keep rest periods short (45-60s) for time constraints under 30 minutes
- Tone: direct, no fluff, respect that this dad is tired and short on time
- Output valid JSON only, no markdown, no explanation`,
  })

  try {
    const cleaned = text.replace(/```json|```/g, '').trim()
    const workout = JSON.parse(cleaned)
    return Response.json({ workout })
  } catch {
    return Response.json({ error: 'Failed to parse workout' }, { status: 500 })
  }
}
