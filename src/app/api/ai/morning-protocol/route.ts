import { anthropic } from '@ai-sdk/anthropic'
import { generateObject } from 'ai'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'
import { checkRateLimit } from '../../../../lib/rateLimit'
import { chargeAiQuota, requireAiQuota } from '../../../../lib/entitlements'
import { MORNING_CALL, MORNING_MODEL, MORNING_SYSTEM, MorningProtocolSchema, morningPrompt } from '../../../../lib/ai/morningProtocolPrompt'

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
    const { object: protocol } = await generateObject({
      model: anthropic(MORNING_MODEL),
      // A stuck call used to hold the spinner until the platform killed the
      // function — and with no output cap it asked for the model's maximum.
      abortSignal: AbortSignal.timeout(25_000),
      ...MORNING_CALL,
      system: MORNING_SYSTEM,
      prompt: morningPrompt({ minutes, sleepQuality, energy, objectives, dayOfWeek }),
      schema: MorningProtocolSchema,
    })

    await chargeAiQuota(supabase, user.id, 'morning-protocol')
    return Response.json({ protocol })
  } catch (error) {
    console.error('AI Morning Protocol Error:', error);
    return Response.json({ error: 'Failed to generate protocol' }, { status: 500 })
  }
}
