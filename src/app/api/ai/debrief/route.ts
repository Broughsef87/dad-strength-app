import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import { NextResponse } from 'next/server'

const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT = 10
const RATE_WINDOW = 60 * 1000

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const now = Date.now()
  const timestamps = (rateLimitMap.get(ip) ?? []).filter(t => now - t < RATE_WINDOW)
  if (timestamps.length >= RATE_LIMIT) {
    return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 })
  }
  rateLimitMap.set(ip, [...timestamps, now])

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