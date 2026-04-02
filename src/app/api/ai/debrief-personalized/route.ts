import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'

export const dynamic = 'force-dynamic'

const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT = 3
const RATE_WINDOW = 60 * 1000

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const now = Date.now()
  const timestamps = (rateLimitMap.get(ip) ?? []).filter(t => now - t < RATE_WINDOW)
  if (timestamps.length >= RATE_LIMIT) {
    return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 })
  }
  rateLimitMap.set(ip, [...timestamps, now])

  // ── Auth: validate session server-side, never trust userId from body ──────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = user.id  // always use server-verified id

  try {
    const { weekStart, weekEnd, userInputs } = await request.json()

    if (!weekStart || !weekEnd) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    // ── Query workout_logs: distinct session days for the week ──────────────
    const { data: workoutLogs } = await supabase
      .from('workout_logs')
      .select('created_at')
      .eq('user_id', userId)
      .eq('completed', true)
      .gte('created_at', new Date(weekStart + 'T00:00:00').toISOString())
      .lte('created_at', new Date(weekEnd + 'T23:59:59').toISOString())

    const workoutSessionDays = new Set(
      (workoutLogs || []).map((l: any) => new Date(l.created_at).toDateString())
    )
    const workoutsCompleted = workoutSessionDays.size

    // ── Query daily_objectives: count completed vs total for the week ───────
    const { data: objectivesData } = await supabase
      .from('daily_objectives')
      .select('completed, date')
      .eq('user_id', userId)
      .gte('date', weekStart)
      .lte('date', weekEnd)

    const totalObjectives = (objectivesData || []).length
    const completedObjectives = (objectivesData || []).filter((o: any) => o.completed).length

    // ── Query daily_checkins: habit_completions and mind/spirit state ───────
    const { data: checkinsData } = await supabase
      .from('daily_checkins')
      .select('date, mind_state, spirit_state')
      .eq('user_id', userId)
      .gte('date', weekStart)
      .lte('date', weekEnd)

    const checkins = checkinsData || []
    const checkinCount = checkins.length

    // ── Query user_profiles: body_composition + sleep_log ──────────────────
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('body_composition, sleep_log')
      .eq('id', userId)
      .maybeSingle()

    // Weight trend: last 2 body_composition entries
    let weightTrend = 'no data'
    if (profile?.body_composition && Array.isArray(profile.body_composition)) {
      const sorted = (profile.body_composition as { date: string; weight: number }[])
        .sort((a, b) => a.date.localeCompare(b.date))
      const last2 = sorted.slice(-2)
      if (last2.length === 2) {
        const diff = last2[1].weight - last2[0].weight
        if (Math.abs(diff) < 0.5) {
          weightTrend = `stable at ${last2[1].weight} lbs`
        } else if (diff > 0) {
          weightTrend = `up ${diff.toFixed(1)} lbs to ${last2[1].weight} lbs`
        } else {
          weightTrend = `down ${Math.abs(diff).toFixed(1)} lbs to ${last2[1].weight} lbs`
        }
      } else if (last2.length === 1) {
        weightTrend = `${last2[0].weight} lbs (single reading)`
      }
    }

    // Sleep: rough nights in last 7 entries
    let roughNights = 0
    let avgPersonalHours: number | null = null
    if (profile?.sleep_log && Array.isArray(profile.sleep_log)) {
      const sleepEntries = (profile.sleep_log as { date: string; babyQuality: string; personalHours: number }[])
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-7)
      roughNights = sleepEntries.filter(e => e.babyQuality === 'rough').length
      const hoursArr = sleepEntries.map(e => e.personalHours).filter(h => h > 0)
      if (hoursArr.length > 0) {
        avgPersonalHours = Math.round((hoursArr.reduce((a, b) => a + b, 0) / hoursArr.length) * 10) / 10
      }
    }

    // ── Build data context string ───────────────────────────────────────────
    const sleepContext = [
      roughNights > 0 ? `${roughNights} rough night(s) this week` : 'no rough nights logged',
      avgPersonalHours !== null ? `avg ${avgPersonalHours}h personal sleep` : null,
    ].filter(Boolean).join(', ')

    const objectivesContext = totalObjectives > 0
      ? `${completedObjectives}/${totalObjectives} daily objectives completed`
      : 'no objectives logged'

    const checkinsContext = checkinCount > 0
      ? `${checkinCount} daily check-ins logged this week`
      : 'no daily check-ins this week'

    const dataContext = `
REAL WEEK DATA (${weekStart} to ${weekEnd}):
- Training sessions completed: ${workoutsCompleted} (counted by distinct days with completed sets)
- Daily objectives: ${objectivesContext}
- Daily check-ins: ${checkinsContext}
- Sleep (last 7 days): ${sleepContext}
- Body weight trend: ${weightTrend}
USER'S OWN WORDS:
- Biggest win this week: ${userInputs?.biggestWin || 'not provided'}
- Biggest challenge: ${userInputs?.biggestChallenge || 'not provided'}
- Intention for next week: ${userInputs?.intentionForNext || 'not provided'}
`.trim()

    // ── Generate AI debrief ─────────────────────────────────────────────────
    const { object: debrief } = await generateObject({
      model: google('gemini-2.5-flash'),
      system: `You are a no-nonsense strength and life coach for dads with young kids. You write weekly debriefs that are specific, honest, and data-driven.

Rules:
- Always reference the actual numbers from the data (e.g., "You hit 3 of your 4 training days")
- Be direct like a good coach — no fluff, no generic motivational quotes
- Acknowledge the reality of dad life (sleep deprivation, competing demands)
- Wins should be real wins backed by data or the user's own words
- Gaps should be honest without being harsh
- Adjustments must be concrete and achievable next week
- The mindset note should be one powerful, original sentence — never cliché
- Grade accurately: "Rise Up" means a rough week, "Dad Elite" is reserved for exceptional weeks`,
      prompt: dataContext,
      schema: z.object({
        overallGrade: z.enum(['Rise Up', 'Grinding', 'Solid', 'Strong', 'Dad Elite'])
          .describe('Honest overall grade for the week based on the data'),
        assessmentHeadline: z.string()
          .describe('One punchy sentence summarizing the week, referencing specific data (e.g., "3 of 4 sessions done — training held up despite the rough nights.")'),
        wins: z.array(z.string()).max(3)
          .describe('Up to 3 specific wins this week, referencing actual numbers where possible'),
        gaps: z.array(z.string()).max(3)
          .describe('Up to 3 honest gaps or misses this week — specific, not generic'),
        adjustments: z.array(z.string()).max(3)
          .describe('Up to 3 concrete, actionable adjustments for next week'),
        mindsetNote: z.string()
          .describe('One powerful, original sentence about what this week means in the bigger picture of being a strong dad'),
        focusWord: z.string()
          .describe('One single word that should define next week (e.g., CONSISTENCY, RECOVERY, ATTACK)'),
      }),
    })

    return NextResponse.json({ debrief })
  } catch (error) {
    console.error('Personalized Debrief Error:', error)
    return NextResponse.json({ error: 'Failed to generate debrief. Try again.' }, { status: 500 })
  }
}
