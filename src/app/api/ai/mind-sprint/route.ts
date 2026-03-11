import { google } from '@ai-sdk/google'
import { generateText } from 'ai'

export async function POST(req: Request) {
  const { minutes, state, objectives } = await req.json()

  const hasObjectives = objectives?.filter(Boolean).length > 0
  const objectivesList = hasObjectives
    ? objectives.filter(Boolean).map((o: string, i: number) => `${i + 1}. ${o}`).join('\n')
    : 'No objectives set yet'

  const { text } = await generateText({
    model: google('gemini-2.5-pro'),
    prompt: `You are a productivity coach for busy dads with limited time windows. Generate a focused mental sprint protocol.

Context:
- Available time: ${minutes} minutes
- Current mental state: ${state}
- Today's objectives:
${objectivesList}

Return a JSON object with this exact structure:
{
  "title": "short punchy sprint name (e.g. 'The 20-Minute Lock-In')",
  "primaryFocus": "the ONE thing to prioritize this session — specific",
  "blocks": [
    { "minutes": 5, "task": "what to do in this block", "type": "focus|transition|review" }
  ],
  "mindset": "one sharp sentence to lock in before starting — a mental anchor",
  "skip": "one thing to explicitly NOT do this session — helps cut distractions"
}

Rules:
- Time blocks must add up to exactly ${minutes} minutes
- If objectives exist, anchor the protocol to them — don't invent tasks
- If no objectives, suggest setting them as the first block
- State 'tired/low energy' = shorter focus blocks (max 10 min), more transitions
- State 'scattered' = start with a 2-min brain dump block before deep work
- State 'focused' = longer single focus blocks, minimal transitions
- Tone: direct, no fluff, respect that this dad stole this time from something else
- Output valid JSON only, no markdown`,
  })

  try {
    const cleaned = text.replace(/```json|```/g, '').trim()
    const sprint = JSON.parse(cleaned)
    return Response.json({ sprint })
  } catch {
    return Response.json({ error: 'Failed to parse sprint' }, { status: 500 })
  }
}
