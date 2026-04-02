import { NextResponse } from 'next/server'
import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import { createClient } from '../../../../utils/supabase/server'

export const dynamic = 'force-dynamic'

const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT = 5
const RATE_WINDOW = 60 * 1000

// ── Rotation pattern (dayNumber % 7) ───────────────────────────────────────
const ROTATION_PATTERNS: Record<number, string> = {
  1: 'Hinge + Push/Pull + Carry',
  2: 'Squat + Conditioning + Sprint/Bike',
  3: 'Push + Pull/Hinge + Core',
  4: 'Pull + Squat/Conditioning + Carry',
  5: 'Hinge + Push/Squat + AMRAP',
  6: 'Full Body Circuit',
  0: 'Active Recovery',
}

const MOVEMENT_LIBRARY = `
PUSH: Barbell bench press, DB bench press, Weighted push-ups, Push-ups, Barbell OHP, DB OHP, Dips
PULL: Barbell rows, DB rows, Pull-ups/Chin-ups, Inverted rows, Face pulls, Curls
HINGE: Deadlift, Romanian DL, DB/KB swing, Good mornings, Single-leg RDL
SQUAT: Back squat, Goblet squat, Front squat, Bulgarian split squat, Split squat, Wall sit
CARRY/CORE: Farmer carry, Suitcase carry, Plank, Hollow body hold, Ab wheel, Dead bug
CONDITIONING: Burpees, Bike (cals), Rower (cals), Jump rope, Box jumps, Shuttle sprints, Battle ropes
`

// ── Zod schema ──────────────────────────────────────────────────────────────
const A1BlockSchema = z.object({
  blockId: z.literal('A1'),
  label: z.string(),
  type: z.literal('straight_sets'),
  sets: z.number(),
  reps: z.string(),
  restSeconds: z.number(),
  exercise: z.string(),
  targetWeight: z.string().optional(),
  scaleUp: z.string(),
  scaleDown: z.string(),
})

const A2BlockSchema = z.object({
  blockId: z.literal('A2'),
  label: z.string(),
  type: z.literal('superset'),
  rounds: z.number(),
  restBetweenRoundsSeconds: z.number(),
  exercises: z.array(z.object({
    name: z.string(),
    reps: z.string(),
    scaleDown: z.string().optional(),
  })),
})

const FinisherBlockSchema = z.object({
  blockId: z.literal('F'),
  label: z.string(),
  type: z.enum(['amrap', 'max_reps', 'for_time']),
  durationSeconds: z.number(),
  exercise: z.string(),
  instructions: z.string(),
  progressionNote: z.string(),
})

const CircuitBlockSchema = z.object({
  blockId: z.literal('CIRCUIT'),
  label: z.string(),
  type: z.literal('circuit'),
  rounds: z.number(),
  for_time: z.boolean(),
  exercises: z.array(z.object({
    name: z.string(),
    reps: z.string(),
    scaleDown: z.string().optional(),
  })),
})

const RecoveryBlockSchema = z.object({
  blockId: z.literal('RECOVERY'),
  label: z.string(),
  type: z.literal('recovery'),
  exercises: z.array(z.object({
    name: z.string(),
    duration: z.string(),
    notes: z.string().optional(),
  })),
})

const SqueezeSessionSchema = z.object({
  sessionTitle: z.string().describe('Short punchy title e.g. "Dead, Row, Carry"'),
  estimatedMinutes: z.number(),
  dayPattern: z.string(),
  isSubstitute: z.boolean(),
  coachNote: z.string().describe('1-2 sentences of motivation/focus cue'),
  blocks: z.union([
    z.tuple([A1BlockSchema, A2BlockSchema, FinisherBlockSchema]),
    z.tuple([CircuitBlockSchema]),
    z.tuple([RecoveryBlockSchema]),
  ]),
})

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
    const {
      userId,
      dayNumber,
      equipment,
      recentSqueezeMovements,
      isSubstitute,
      substitutedDayFocus,
    } = await request.json() as {
      userId: string
      dayNumber: number
      equipment: string[]
      recentSqueezeMovements?: string[]
      isSubstitute?: boolean
      substitutedDayFocus?: string
    }

    if (!userId || !dayNumber || !equipment) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const patternKey = dayNumber % 7
    const dayPattern = ROTATION_PATTERNS[patternKey]

    const hasBarbell = equipment.includes('barbell')
    const hasDumbbells = equipment.includes('dumbbells')
    const hasPullupBar = equipment.includes('pullup_bar')
    const hasBench = equipment.includes('bench')
    const hasKettlebell = equipment.includes('kettlebell')

    const equipmentNote = [
      hasBarbell ? 'Has barbell' : 'NO barbell',
      hasDumbbells ? 'Has dumbbells' : 'NO dumbbells',
      hasPullupBar ? 'Has pull-up bar' : 'NO pull-up bar',
      hasBench ? 'Has bench' : 'NO bench',
      hasKettlebell ? 'Has kettlebell' : 'NO kettlebell',
    ].join(', ')

    const recentNote = recentSqueezeMovements && recentSqueezeMovements.length > 0
      ? `NEVER use these as A1 (repeated recently): ${recentSqueezeMovements.join(', ')}`
      : 'No recent squeeze sessions.'

    const substituteNote = isSubstitute && substitutedDayFocus
      ? `This is substituting for a ${substitutedDayFocus} program day — try to match that muscle group focus.`
      : ''

    const systemPrompt = `You are a strength coach programming The Squeeze — a 15-20 min daily workout for busy dads.

THE SQUEEZE FORMAT:
- A1: Compound Strength Movement — 3 sets, heavy, 60s rest between sets
- A2: Conditioning Superset — 3 rounds, 2 exercises paired, no rest between exercises, 30-45s rest between rounds
- Finisher: Max Effort — AMRAP 3min OR max reps 2min OR for time

MOVEMENT LIBRARY:
${MOVEMENT_LIBRARY}

EQUIPMENT RULES (CRITICAL):
- NEVER program barbell movements if no barbell is available
- NEVER program pull-up movements if no pull-up bar is available
- Scale all movements to available equipment
- With no equipment, use bodyweight only

ROTATION LOGIC:
- Day 1 (pattern 1): Hinge A1, Push+Pull superset A2, Carry finisher
- Day 2 (pattern 2): Squat A1, Conditioning superset A2, Sprint/Bike finisher
- Day 3 (pattern 3): Push A1, Pull+Hinge superset A2, Core finisher
- Day 4 (pattern 4): Pull A1, Squat+Conditioning superset A2, Carry finisher
- Day 5 (pattern 5): Hinge A1, Push+Squat superset A2, AMRAP finisher
- Day 6 (pattern 6): Full body circuit — 5 movements, 3 rounds, for time — return a CIRCUIT block
- Day 0 (pattern 0): Active recovery — mobility + carries — return a RECOVERY block

SPECIAL RULES:
- ${recentNote}
- ${substituteNote || 'Standard session.'}
- Always include scaleUp and scaleDown for A1
- Keep coachNote direct and brief — 1-2 sentences max
- sessionTitle should be the exercise names shortened, e.g. "Dead, Row, Carry"
- For amrap type: durationSeconds = 180
- For max_reps type: durationSeconds = 120
- For for_time: durationSeconds = 0 (no cap)
- A2 restBetweenRoundsSeconds must be 30-45`

    const prompt = `Generate a Squeeze session for:
- Day number: ${dayNumber} (pattern key: ${patternKey} = "${dayPattern}")
- Equipment: ${equipmentNote}
- isSubstitute: ${isSubstitute ?? false}

Follow the rotation for pattern key ${patternKey}.`

    const { object: session } = await generateObject({
      model: google('gemini-2.5-flash'),
      system: systemPrompt,
      prompt,
      schema: SqueezeSessionSchema,
    })

    return NextResponse.json({ session, dayPattern })
  } catch (error) {
    console.error('Squeeze Generate Error:', error)
    return NextResponse.json({ error: 'Failed to generate squeeze session. Try again.' }, { status: 500 })
  }
}
