import { anthropic } from '@ai-sdk/anthropic'
import { generateObject } from 'ai'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'
import { checkRateLimit } from '../../../../lib/rateLimit'
import { chargeAiQuota, requireAiQuota } from '../../../../lib/entitlements'

export const dynamic = 'force-dynamic'
// The model gets 25 seconds (below); the function a little longer, so a slow
// call ends in our error rather than the platform's.
export const maxDuration = 30

// Everything that reaches the prompt is bounded and typed. Free text went in
// verbatim before — newlines and "SYSTEM:" lines included, at any length.
const Body = z.object({
  minutes: z.number().int().min(5).max(60),
  sleepQuality: z.string().max(40).nullish(),
  energy: z.string().max(40).nullish(),
  objectives: z.array(z.string().max(200)).max(3).optional().default([]),
  dayOfWeek: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
})
const oneLine = (v: string) => v.replace(/[\r\n]+/g, ' ').trim()

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  const { minutes, sleepQuality, energy, objectives, dayOfWeek } = parsed.data

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Missing ANTHROPIC_API_KEY in environment')
    return NextResponse.json({ error: 'AI configuration missing' }, { status: 500 })
  }

  // Burst limit first: a 429 here must not have cost a day's quota.
  const { allowed } = await checkRateLimit(supabase, user.id, 'morning-protocol')
  if (!allowed) return NextResponse.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 })

  // Asks only. The day's build is charged below, once one has been made.
  const quota = await requireAiQuota(supabase, user.id, 'morning-protocol')
  if (quota) return quota

  try {
    const named = objectives.map(oneLine).filter(Boolean)
    const objectivesList = named.length
      ? named.map((o, i) => `${i + 1}. ${o}`).join('\n')
      : 'No objectives set'

    const { object: protocol } = await generateObject({
      model: anthropic('claude-haiku-5-5'),
      // A stuck call used to hold the spinner until the platform killed the
      // function — and with no output cap it asked for the model's maximum.
      abortSignal: AbortSignal.timeout(25_000),
      maxOutputTokens: 2000,
      // Short structured output: low effort keeps the response fast.
      providerOptions: { anthropic: { effort: 'low' } },
      system: `You are a high-performance coach for busy dads with young babies. Generate a morning protocol built around 4 pillars: Prayer, Meditation, Reading, and Goals. Tone: Stoic, direct, no fluff. Time must add up to exactly the requested minutes distributed across the pillars.`,
      prompt: `Today is ${dayOfWeek}.
Available time: ${minutes} minutes
Last night's sleep: ${sleepQuality ? oneLine(sleepQuality) : 'not given'}
Energy level: ${energy ? oneLine(energy) : 'not given'}
Today's objectives:
${objectivesList}

Generate a morning protocol with exactly 4 steps — one for each pillar. Distribute the ${minutes} minutes wisely based on energy. Low energy = more Prayer/Meditation. High energy = more Reading/Goals.
If last night was rough (Rough night or Up all night): keep the time split, but make Reading a short, light passage (no heavy study), and make Goals about the ONE most important objective today, not the whole list. Name that in the guidance.`,
      schema: z.object({
        theme: z.string().describe("A short, punchy theme for today's morning — e.g. 'The Quiet Before the War'"),
        greeting: z.string().describe("1-2 sentence personal greeting acknowledging last night's sleep and energy level. Direct, warm, stoic."),
        steps: z.array(z.object({
          pillar: z.enum(['Prayer', 'Meditation', 'Reading', 'Goals']),
          minutes: z.number().describe('Minutes allocated to this pillar'),
          title: z.string().describe('Short action title for this pillar'),
          guidance: z.string().describe('2-3 sentence guidance for this block'),
          prompt: z.string().describe('A single focus prompt or intention for this block'),
        })).length(4),
        closingWord: z.string().describe("One final sentence to send them into the day — stoic, motivating"),
      })
    })

    await chargeAiQuota(supabase, user.id, 'morning-protocol')
    return Response.json({ protocol })
  } catch (error) {
    console.error('AI Morning Protocol Error:', error);
    return Response.json({ error: 'Failed to generate protocol' }, { status: 500 })
  }
}
