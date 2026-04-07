import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const req = request
  try {
    const { minutes, state, objectives } = await req.json()
    
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.GEMINI_API_KEY) {
      console.error('Missing Google/Gemini API key in environment');
      return Response.json({ error: 'AI configuration missing' }, { status: 500 });
    }

    const hasObjectives = objectives?.filter(Boolean).length > 0
    const objectivesList = hasObjectives
      ? objectives.filter(Boolean).map((o: string, i: number) => `${i + 1}. ${o}`).join('\n')
      : 'No objectives set yet'

    const { object: sprint } = await generateObject({
      model: google('gemini-2.5-flash'),
      system: `You are a productivity coach for busy dads with limited time windows. Generate a focused mental sprint protocol.
Rules:
- Time blocks must add up to exactly the requested minutes
- If objectives exist, anchor the protocol to them
- State 'tired/low energy' = shorter focus blocks (max 10 min)
- State 'scattered' = start with a 2-min brain dump block
- State 'focused' = longer single focus blocks
- Tone: direct, no fluff`,
      prompt: `Context:
- Available time: ${minutes} minutes
- Current mental state: ${state}
- Today's objectives:
${objectivesList}`,
      schema: z.object({
        title: z.string(),
        primaryFocus: z.string(),
        blocks: z.array(z.object({
          minutes: z.number(),
          task: z.string(),
          type: z.enum(["focus", "transition", "review"])
        })),
        mindset: z.string(),
        skip: z.string()
      })
    })

    return Response.json({ sprint })
  } catch (error) {
    console.error('AI Sprint Error:', error);
    return Response.json({ error: 'Failed to generate sprint' }, { status: 500 })
  }
}
