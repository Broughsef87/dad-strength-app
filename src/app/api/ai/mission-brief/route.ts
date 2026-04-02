import { NextResponse } from 'next/server'
import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import { createClient } from '../../../../utils/supabase/server'

export const dynamic = 'force-dynamic'

const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT = 5
const RATE_WINDOW = 60 * 1000

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const now = Date.now()
  const timestamps = (rateLimitMap.get(ip) ?? []).filter(t => now - t < RATE_WINDOW)
  if (timestamps.length >= RATE_LIMIT) {
    return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 })
  }
  rateLimitMap.set(ip, [...timestamps, now])

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { weekObjective, familyIntention, trainingFocus, weekNumber } = await request.json()

    const { object: brief } = await generateObject({
      model: google('gemini-2.5-flash'),
      system: `You are a high-performance advisor for elite dads. Generate a weekly Mission Brief in the style of a special operations briefing. Tone: stoic, direct, tactical. No fluff. Every word earns its place.`,
      prompt: `Generate a weekly Mission Brief for a high-performing dad.
Week: ${weekNumber || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
Primary Objective: ${weekObjective || 'Unspecified'}
Family Intention: ${familyIntention || 'Be present'}
Training Focus: ${trainingFocus || 'Maintain strength'}`,
      schema: z.object({
        weekTheme: z.string().describe('One powerful theme word or short phrase for the week (e.g. IRON DISCIPLINE, FAMILY FIRST)'),
        missionStatement: z.string().describe('2-3 sentence mission statement for the week. Stoic. Tactical. Personal.'),
        primaryObjective: z.string().describe('The #1 objective for the week, reframed in mission language'),
        familyMission: z.string().describe('The family intention reframed as a tactical directive'),
        trainingDirective: z.string().describe('One-sentence training directive for the week'),
        dailyEdge: z.string().describe('One brief stoic insight or principle to carry through the week'),
      }),
    })

    return NextResponse.json({ brief })
  } catch (error) {
    console.error('Mission Brief Error:', error)
    return NextResponse.json({ error: 'Failed to generate brief. Try again.' }, { status: 500 })
  }
}
