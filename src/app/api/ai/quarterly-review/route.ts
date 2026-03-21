import { NextResponse } from 'next/server'
import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'

const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT = 2
const RATE_WINDOW = 3600000

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const now = Date.now()
  const timestamps = (rateLimitMap.get(ip) ?? []).filter(t => now - t < RATE_WINDOW)
  if (timestamps.length >= RATE_LIMIT) {
    return NextResponse.json({ error: 'Too many requests. Please wait an hour.' }, { status: 429 })
  }
  rateLimitMap.set(ip, [...timestamps, now])

  try {
    const { quarterData, userInputs } = await request.json()
    const { workoutCount, weeklyAvgSessions, roughSleepNights, activeCheckinDays, totalDays, weightChange, quarterLabel } = quarterData
    const { biggestWin, biggestChallenge, wantsDifferent } = userInputs

    const { object: review } = await generateObject({
      model: google('gemini-2.5-flash'),
      system: `You are a brutally honest, forward-looking performance coach for dads. You analyze 90-day performance data and deliver a quarterly review that is direct, data-driven, and motivating. Reference actual numbers. No corporate fluff. No empty praise. Every word earns its place. Write like a coach who has seen the data and respects the man enough to tell the truth.`,
      prompt: `Generate a quarterly performance review for a dad.

Quarter: ${quarterLabel}
Days elapsed this quarter: ${totalDays}

PERFORMANCE DATA:
- Workouts completed: ${workoutCount}
- Weekly average sessions: ${weeklyAvgSessions.toFixed(1)}/week
- Active check-in days: ${activeCheckinDays} of ${totalDays} days (${Math.round((activeCheckinDays / Math.max(totalDays, 1)) * 100)}% consistency)
- Rough sleep nights logged: ${roughSleepNights}
${weightChange !== null ? `- Weight change this quarter: ${weightChange > 0 ? '+' : ''}${weightChange.toFixed(1)} lbs` : '- Weight change: not tracked'}

USER'S OWN WORDS:
- Biggest win this quarter: "${biggestWin || 'Not provided'}"
- What held them back: "${biggestChallenge || 'Not provided'}"
- What they want different next quarter: "${wantsDifferent || 'Not provided'}"

Grade scale context:
- Rise Up: Struggling, needs a reset
- Grinding: Below potential, inconsistent
- Solid: Respectable, getting it done
- Strong: Above average, momentum building
- Dad Elite: Exceptional quarter, firing on all cylinders

Assess the grade based on workout frequency, consistency rate, and self-reported wins. Be honest. A dad doing 2 workouts a week is Grinding, not Strong.`,
      schema: z.object({
        quarterGrade: z.enum(['Rise Up', 'Grinding', 'Solid', 'Strong', 'Dad Elite']),
        quarterHeadline: z.string().describe('One punchy sentence summing up the quarter. Reference the data. Make it land.'),
        topWins: z.array(z.string()).length(3).describe('Three specific wins that reference the actual data and what the user said. Concrete, not generic.'),
        coreGaps: z.array(z.string()).length(2).describe('Two honest gaps. Name what the data shows. No sugar-coating.'),
        next90Focus: z.object({
          theme: z.string().describe('2-4 word theme for the next 90 days. All caps. Bold.'),
          primaryObjective: z.string().describe('The single most important objective for next quarter based on the gaps.'),
          trainingDirective: z.string().describe('Specific training directive for next quarter based on current frequency and gaps.'),
          familyCommitment: z.string().describe('One specific family commitment tied to what they said they want different.'),
        }),
        letterToSelf: z.string().describe('2-3 sentences written in first person as if the user is writing to themselves from the future. Reflective, honest, forward-looking. No AI voice. Pure "I" statements.'),
      }),
    })

    return NextResponse.json({ review })
  } catch (error) {
    console.error('Quarterly Review Error:', error)
    return NextResponse.json({ error: 'Failed to generate review. Try again.' }, { status: 500 })
  }
}
