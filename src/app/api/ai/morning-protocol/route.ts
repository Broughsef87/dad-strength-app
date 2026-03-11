import { google } from '@ai-sdk/google'
import { generateText } from 'ai'

export async function POST(req: Request) {
  const { minutes, babyNight, energy, objectives, dayOfWeek } = await req.json()

  const hasObjectives = objectives?.filter(Boolean).length > 0
  const objectivesList = hasObjectives
    ? objectives.filter(Boolean).join(', ')
    : 'none set'

  const { text } = await generateText({
    model: google('gemini-2.5-pro'),
    prompt: `You are a morning routine coach for a Christian dad who wants to show up strong for his family and his mission. Build a personalized morning protocol.

Context:
- Available time: ${minutes} minutes
- Baby's night: ${babyNight}
- Energy level: ${energy}
- Day of week: ${dayOfWeek}
- Today's objectives/goals: ${objectivesList}

Build a morning protocol using ONLY these four pillars (all four must appear unless time is under 15 min, then drop meditation):
1. Prayer — personal, faith-based, intentional
2. Meditation — stillness and mental clarity
3. Reading — growth-oriented, not news/social
4. Goals & Journal — set the day's intention, connect to bigger mission

Return a JSON object with this exact structure:
{
  "theme": "one word or short phrase that captures the tone of this morning (e.g. 'Steady', 'Rise', 'Grateful')",
  "greeting": "one direct, personal opening line — acknowledge baby's night if rough, don't sugarcoat, be real",
  "steps": [
    {
      "pillar": "Prayer | Meditation | Reading | Goals & Journal",
      "minutes": 5,
      "title": "short action title",
      "guidance": "2-3 sentences of specific, practical guidance for this step. Not generic — make it feel personal and purposeful.",
      "prompt": "one specific question or focus prompt for this step (e.g. for journaling: 'What does winning today actually look like?')"
    }
  ],
  "closingWord": "one short sentence to carry into the day — grounded, fatherhood-focused"
}

Rules:
- Total step minutes must add up to exactly ${minutes} minutes
- If energy is low or baby's night was rough: shorter steps, more grace, gentler tone — this dad is tired
- If energy is high: push harder, more depth, more challenge
- Sunday: lean into rest and reflection, not hustle
- Objectives should shape the Goals & Journal step specifically
- Reading guidance should suggest a TYPE of book or topic, not a specific title
- Tone: like a coach and a brother — direct, warm, real. No corporate wellness speak. No toxic positivity.
- Output valid JSON only, no markdown`,
  })

  try {
    const cleaned = text.replace(/```json|```/g, '').trim()
    const protocol = JSON.parse(cleaned)
    return Response.json({ protocol })
  } catch {
    return Response.json({ error: 'Failed to parse protocol' }, { status: 500 })
  }
}
