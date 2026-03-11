import { google } from '@ai-sdk/google'
import { generateText } from 'ai'

export async function POST(req: Request) {
  const { weekSessions, totalVolume, topLift, journalEntries, streak, objectives } = await req.json()

  const { text } = await generateText({
    model: google('gemini-2.5-pro'),
    prompt: `You are a strength and life coach for busy dads. Write a weekly debrief — honest, brief, motivating.

This week's data:
- Training sessions completed: ${weekSessions}
- Total volume lifted: ${totalVolume ? totalVolume.toLocaleString() + ' lbs' : 'not tracked'}
- Top lift this week: ${topLift || 'none recorded'}
- Current streak: ${streak} days
- Weekly objectives set: ${objectives?.filter(Boolean).join(', ') || 'none'}
- Journal notes this week: ${journalEntries?.length ? journalEntries.slice(0, 3).join(' | ') : 'nothing logged'}

Write a debrief with this JSON structure:
{
  "headline": "one punchy headline summarizing the week (e.g. 'Solid. Build on it.' or 'You showed up.')",
  "summary": "2-3 sentences: honest assessment of the week — what they did, what it means",
  "win": "the single biggest win this week, specific if possible",
  "focus": "one thing to focus on next week — specific and actionable",
  "dadQuote": "one short quote or thought about fatherhood and strength — original, not cliche"
}

Tone: like a coach who respects you. Direct. No fluff. Acknowledge the reality of being a dad with a young baby.
Output valid JSON only, no markdown.`,
  })

  try {
    const cleaned = text.replace(/```json|```/g, '').trim()
    const debrief = JSON.parse(cleaned)
    return Response.json({ debrief })
  } catch {
    return Response.json({ error: 'Failed to generate debrief' }, { status: 500 })
  }
}
