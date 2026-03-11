import { google } from '@ai-sdk/google'
import { generateText } from 'ai'

export async function POST(req: Request) {
  const { streak, totalWorkouts, objectives, sleepHours, isWorkoutDay, programName } = await req.json()

  const { text } = await generateText({
    model: google('gemini-2.0-flash-exp'),
    prompt: `You are a no-nonsense coach and mentor for busy dads. Write a short personalized morning briefing.

Context about this dad:
- Workout streak: ${streak} days
- Total workouts logged: ${totalWorkouts}
- Today's objectives: ${objectives?.filter(Boolean).join(', ') || 'none set yet'}
- Sleep last night: ${sleepHours ? sleepHours + ' hours' : 'unknown'}
- Is today a workout day: ${isWorkoutDay ? 'yes — ' + (programName || 'training session') : 'no — rest/recovery day'}

Write a morning briefing with this JSON structure:
{
  "greeting": "short punchy opening line (not 'Good morning')",
  "protocol": "2-3 sentences: what to focus on today, adapted to their sleep and streak context",
  "anchor": "one powerful short sentence — a mindset anchor for the day as a dad and man",
  "intensity": "low | medium | high (based on sleep and streak — low if sleep under 5hrs)"
}

Tone: like a respected coach who knows you're a dad with a baby — real, direct, warm but not soft. No corporate wellness speak.
Output valid JSON only, no markdown.`,
  })

  try {
    const cleaned = text.replace(/```json|```/g, '').trim()
    const briefing = JSON.parse(cleaned)
    return Response.json({ briefing })
  } catch {
    return Response.json({ error: 'Failed to generate briefing' }, { status: 500 })
  }
}
