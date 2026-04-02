import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'

export const dynamic = 'force-dynamic'

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
    const { minutes, babyNight, energy, objectives, dayOfWeek } = await req.json()

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.GEMINI_API_KEY) {
      console.error('Missing Google/Gemini API key in environment');
      return Response.json({ error: 'AI configuration missing' }, { status: 500 });
    }

    const hasObjectives = objectives?.filter(Boolean).length > 0
    const objectivesList = hasObjectives
      ? objectives.filter(Boolean).map((o: string, i: number) => `${i + 1}. ${o}`).join('\n')
      : 'No objectives set'

    const { object: protocol } = await generateObject({
      model: google('gemini-2.5-flash'),
      system: `You are a high-performance coach for busy dads. Generate a morning protocol built around 4 pillars: Prayer, Meditation, Reading, and Gratitude. Tone: Stoic, direct, no fluff. Time must add up to exactly the requested minutes distributed across the pillars.`,
      prompt: `Today is ${dayOfWeek}.
Available time: ${minutes} minutes
Sleep quality: ${babyNight}
Energy level: ${energy}
Today's objectives:
${objectivesList}

Generate a morning protocol with exactly 4 steps — one for each pillar (Prayer, Meditation, Reading, Gratitude). Distribute the ${minutes} minutes wisely based on energy. Low energy = more Prayer/Meditation. High energy = more Reading. Always end with Gratitude. For the Gratitude step, the guidance should encourage writing 3 things they're grateful for.`,
      schema: z.object({
        theme: z.string().describe("A short, punchy theme for today's morning — e.g. 'The Quiet Before the War'"),
        greeting: z.string().describe("1-2 sentence personal greeting acknowledging sleep quality and energy level. Direct, warm, stoic."),
        steps: z.array(z.object({
          pillar: z.enum(['Prayer', 'Meditation', 'Reading', 'Gratitude']),
          minutes: z.number().describe('Minutes allocated to this pillar'),
          title: z.string().describe('Short action title for this pillar'),
          guidance: z.string().describe('2-3 sentence guidance for this block'),
          prompt: z.string().describe('A single focus prompt or intention for this block'),
        })).length(4),
        closingWord: z.string().describe("One final sentence to send them into the day — stoic, motivating"),
      })
    })

    return Response.json({ protocol })
  } catch (error) {
    console.error('AI Morning Protocol Error:', error);
    return Response.json({ error: 'Failed to generate protocol' }, { status: 500 })
  }
}
