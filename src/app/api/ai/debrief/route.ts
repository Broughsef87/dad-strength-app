import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'
import { checkRateLimit } from '../../../../lib/rateLimit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { allowed } = await checkRateLimit(supabase, user.id, 'debrief', 10, 60_000)
  if (!allowed) return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 })

  const req = request
  try {
    const { weekSessions, totalVolume, topLift, journalEntries, streak, objectives } = await req.json()

    const { object: debrief } = await generateObject({
      model: google('gemini-2.5-flash'),
      system: `You are a strength and life coach for busy dads. Write a weekly debrief - honest, brief, motivating.
Tone: like a coach who respects you. Direct. No fluff. Acknowledge the reality of being a dad with a young baby.`,
      prompt: `This week's data:
- Training sessions completed: ${weekSessions}
- Total volume lifted: ${totalVolume ? totalVolume.toLocaleString() + ' lbs' : 'not tracked'}
- Top lift this week: ${topLift || 'none recorded'}
- Current streak: ${streak} days
- Weekly objectives set: ${objectives?.filter(Boolean).join(', ') || 'none'}
- Journal notes this week: ${journalEntries?.length ? journalEntries.slice(0, 3).join(' | ') : 'nothing logged'}`,
      schema: z.object({
        headline: z.string().describe("one punchy headline summarizing the week"),
        summary: z.string().describe("2-3 sentences: honest assessment of the week"),
        win: z.string().describe("the single biggest win this week, specific if possible"),
        focus: z.string().describe("one thing to focus on next week - specific and actionable"),
        dadQuote: z.string().describe("one short quote or thought about fatherhood and strength - original, not cliche")
      })
    })

    return Response.json({ debrief })
  } catch (error) {
    console.error('AI Debrief Error:', error);
    return Response.json({ error: 'Failed to generate debrief' }, { status: 500 })
  }
}