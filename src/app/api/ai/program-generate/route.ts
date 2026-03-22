import { NextResponse } from 'next/server'
import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'

const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT = 5
const RATE_WINDOW = 60 * 1000

const DAD_STRONG_5 = {
  name: "Dad Strong",
  daysPerWeek: 5,
  days: [
    {
      dayNumber: 1,
      dayName: "Pressing",
      exercises: [
        { name: "Barbell Bench Press", sets: 3, repMin: 5, repMax: 8, perSetRir: [3, 3, 2], movementPattern: "push_horizontal", setOrder: 1 },
        { name: "Incline DB Press", sets: 3, repMin: 8, repMax: 12, perSetRir: [3, 3, 3], movementPattern: "push_horizontal", setOrder: 2 },
        { name: "Cable Flyes", sets: 2, repMin: 12, repMax: 15, perSetRir: [2, 1], movementPattern: "push_fly", setOrder: 3 },
        { name: "JM Press", sets: 2, repMin: 6, repMax: 10, perSetRir: [4, 4], movementPattern: "push_tricep", setOrder: 4 },
        { name: "Skull Crushers", sets: 3, repMin: 8, repMax: 12, perSetRir: [3, 3, 3], movementPattern: "push_tricep", setOrder: 5 },
        { name: "Cable Triceps Pushdown (Bar)", sets: 3, repMin: 6, repMax: 10, perSetRir: [4, 4, 4], movementPattern: "push_tricep", setOrder: 6 }
      ]
    },
    {
      dayNumber: 2,
      dayName: "Legs - Quad Focused",
      exercises: [
        { name: "Barbell Back Squat (High Bar)", sets: 3, repMin: 5, repMax: 5, perSetRir: [3, 3, 3], movementPattern: "squat", setOrder: 1 },
        { name: "Bulgarian Split Squat", sets: 2, repMin: 8, repMax: 12, perSetRir: [2, 2], movementPattern: "squat_unilateral", setOrder: 2 },
        { name: "Leg Press", sets: 2, repMin: 5, repMax: 8, perSetRir: [4, 4], movementPattern: "squat", setOrder: 3 },
        { name: "Leg Extension", sets: 3, repMin: 8, repMax: 12, perSetRir: [4, 3, 2], movementPattern: "isolation_quad", setOrder: 4 },
        { name: "Hamstring Curl", sets: 2, repMin: 6, repMax: 10, perSetRir: [3, 3], movementPattern: "isolation_hamstring", setOrder: 5 },
        { name: "Standing Calf Raise", sets: 3, repMin: 6, repMax: 10, perSetRir: [4, 4, 4], movementPattern: "isolation_calf", setOrder: 6 }
      ]
    },
    {
      dayNumber: 3,
      dayName: "Arms",
      exercises: [
        { name: "Chin Ups", sets: 3, repMin: 5, repMax: 10, perSetRir: [3, 3, 2], movementPattern: "pull_vertical", setOrder: 1, notes: "Use assistance if needed" },
        { name: "Alternating DB Curl", sets: 3, repMin: 12, repMax: 15, perSetRir: [4, 4, 4], movementPattern: "isolation_bicep", setOrder: 2 },
        { name: "Hammer Curl", sets: 3, repMin: 8, repMax: 12, perSetRir: [3, 3, 3], movementPattern: "isolation_bicep", setOrder: 3 },
        { name: "Dips (Triceps Focused)", sets: 2, repMin: 5, repMax: 10, perSetRir: [2, 2], movementPattern: "push_tricep", setOrder: 4 },
        { name: "Behind Head Triceps Extension", sets: 2, repMin: 15, repMax: 20, perSetRir: [3, 2], movementPattern: "push_tricep", setOrder: 5 },
        { name: "Cable Triceps Pushdown (Rope)", sets: 3, repMin: 8, repMax: 12, perSetRir: [4, 4, 4], movementPattern: "push_tricep", setOrder: 6 }
      ]
    },
    {
      dayNumber: 4,
      dayName: "Legs - Posterior Chain",
      exercises: [
        { name: "Deadlift", sets: 6, repMin: 3, repMax: 3, perSetRir: [4, 4, 4, 3, 3, 3], movementPattern: "hinge", setOrder: 1 },
        { name: "Barbell Good Morning", sets: 3, repMin: 6, repMax: 8, perSetRir: [3, 3, 3], movementPattern: "hinge", setOrder: 2 },
        { name: "DB Stiff Legged Deadlift", sets: 2, repMin: 12, repMax: 15, perSetRir: [2, 4], movementPattern: "hinge", setOrder: 3 },
        { name: "Hip Abduction Machine", sets: 3, repMin: 15, repMax: 20, perSetRir: [4, 4, 4], movementPattern: "isolation_hip", setOrder: 4 },
        { name: "Walking Lunges", sets: 3, repMin: 8, repMax: 12, perSetRir: [3, 3, 2], movementPattern: "squat_unilateral", setOrder: 5 },
        { name: "Back Extension", sets: 4, repMin: 12, repMax: 15, perSetRir: [4, 4, 4, 4], movementPattern: "hinge_extension", setOrder: 6 }
      ]
    },
    {
      dayNumber: 5,
      dayName: "Pulling",
      exercises: [
        { name: "Barbell Rows", sets: 3, repMin: 5, repMax: 5, perSetRir: [2, 2, 3], movementPattern: "pull_horizontal", setOrder: 1 },
        { name: "Wide Grip Lat Pulldown", sets: 3, repMin: 8, repMax: 12, perSetRir: [4, 3, 3], movementPattern: "pull_vertical", setOrder: 2 },
        { name: "Seated Cable Row", sets: 3, repMin: 12, repMax: 15, perSetRir: [3, 3, 3], movementPattern: "pull_horizontal", setOrder: 3 },
        { name: "Straight Arm Lat Pulldown", sets: 2, repMin: 15, repMax: 20, perSetRir: [4, 2], movementPattern: "pull_vertical", setOrder: 4 },
        { name: "EZ Bar Curls", sets: 3, repMin: 8, repMax: 12, perSetRir: [4, 4, 4], movementPattern: "isolation_bicep", setOrder: 5 },
        { name: "Cable Curls", sets: 2, repMin: 12, repMax: 15, perSetRir: [3, 3], movementPattern: "isolation_bicep", setOrder: 6 }
      ]
    }
  ]
}

const PROGRAM_TEMPLATES: Record<string, typeof DAD_STRONG_5> = {
  'dad-strong-5': DAD_STRONG_5,
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const now = Date.now()
  const timestamps = (rateLimitMap.get(ip) ?? []).filter(t => now - t < RATE_WINDOW)
  if (timestamps.length >= RATE_LIMIT) {
    return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 })
  }
  rateLimitMap.set(ip, [...timestamps, now])

  try {
    const { userId, weekNumber, programSlug, userProfile, recentLogs } = await request.json()

    if (!userId || !weekNumber || !programSlug) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const template = PROGRAM_TEMPLATES[programSlug]
    if (!template) {
      return NextResponse.json({ error: `Unknown program: ${programSlug}` }, { status: 400 })
    }

    // ── Build log summary per exercise ─────────────────────────────────────
    const logsByExercise: Record<string, Array<{
      weight: number
      reps: number
      rir_actual: number | null
      completed: boolean
      logged_at: string
    }>> = {}

    for (const log of (recentLogs || [])) {
      if (!logsByExercise[log.exercise]) {
        logsByExercise[log.exercise] = []
      }
      logsByExercise[log.exercise].push(log)
    }

    // Summarize last session per exercise
    const exerciseSummaryLines: string[] = []
    for (const [exercise, logs] of Object.entries(logsByExercise)) {
      const sorted = logs.sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime())
      const lastSessionDate = sorted[0].logged_at.split('T')[0]
      const lastSession = sorted.filter(l => l.logged_at.startsWith(lastSessionDate))
      const setLines = lastSession.map((s, i) =>
        `  Set ${i + 1}: ${s.weight}lbs x ${s.reps} reps, RIR logged=${s.rir_actual ?? 'not logged'}, completed=${s.completed}`
      ).join('\n')
      exerciseSummaryLines.push(`${exercise} (last session: ${lastSessionDate}):\n${setLines}`)
    }

    const hasHistory = exerciseSummaryLines.length > 0
    const logContext = hasHistory
      ? `RECENT TRAINING LOGS (last 2 weeks):\n${exerciseSummaryLines.join('\n\n')}`
      : `RECENT TRAINING LOGS: None — this is the user's first week on this program.`

    const templateJson = JSON.stringify(template, null, 2)

    const prompt = `
PROGRAM TEMPLATE:
${templateJson}

USER PROFILE:
- Training age: ${userProfile?.trainingAge ?? 'intermediate'}
- Primary goal: ${userProfile?.primaryGoal ?? 'strength'}
- Equipment available: ${userProfile?.equipment ? Object.entries(userProfile.equipment).filter(([, v]) => v).map(([k]) => k).join(', ') || 'standard gym' : 'standard gym'}

WEEK: ${weekNumber}

${logContext}

Generate a complete week of programmed workouts for week ${weekNumber}.
`.trim()

    // ── Generate AI program ─────────────────────────────────────────────────
    const { object: program } = await generateObject({
      model: google('gemini-2.5-flash'),
      system: `You are an experienced strength coach programming for busy dads. You are data-driven, direct, and brief — no fluff. You write like a coach talking to someone with limited time and real responsibilities.

PROGRESSION RULES (follow these exactly):
1. For each exercise, find the user's last logged weight, reps, and rir_actual from the provided logs.
2. If rir_actual > target RIR (too easy): increase weight — 5 lbs for isolation movements, 10 lbs for compound movements.
3. If rir_actual = target RIR (on target): keep weight. If they hit the top of the rep range, add 2.5 lbs.
4. If rir_actual < target RIR (too hard): keep weight or reduce 5-10%.
5. If completed=false on any set: reduce weight 10% for that exercise.
6. For week 1 with no history, suggest conservative starting weights based on training age:
   - beginner: empty bar or very light weight, technique focus
   - intermediate: moderate working weights (e.g., bench ~135 lbs, squat ~155 lbs, deadlift ~185 lbs)
   - advanced: near-max programming with heavier starting points
7. For week 1 new users: add a note like "Start conservative — we'll dial in your weights over the first 2 sessions"

OUTPUT RULES:
- Always reference actual numbers from logs when explaining progression decisions in progressionNote.
- Keep progressionNote brief: one sentence max. Example: "Up from 185x5 last week — hit top of range with RIR 4."
- coachNote should be 1-2 sentences max. Direct. References what the data shows or what to focus on this week.
- weekTheme should be concise: e.g. "Foundation Week", "Week 3 — Adding Load", "Deload Week".
- Set targetWeight to 0 for bodyweight exercises.
- Ensure every exercise from the template is included in each day.
- deloadRecommended should be true if the user has 4+ consecutive weeks of logged data showing fatigue indicators (rir_actual consistently below target or failed sets).`,
      prompt,
      schema: z.object({
        weekNumber: z.number(),
        programName: z.string(),
        weekTheme: z.string().describe('Short label for this week, e.g. "Foundation Week" or "Push Week 3 — Adding Load"'),
        coachNote: z.string().describe('1-2 sentences from the coach on what to focus on this week, referencing actual data'),
        days: z.array(z.object({
          dayNumber: z.number(),
          dayName: z.string(),
          exercises: z.array(z.object({
            name: z.string(),
            sets: z.array(z.object({
              setNumber: z.number(),
              targetWeight: z.number().describe('Weight in lbs. Use 0 for bodyweight exercises.'),
              targetReps: z.number(),
              targetRir: z.number(),
              notes: z.string().optional().describe('e.g. "increase from last week" or "start conservative"'),
            })),
            progressionNote: z.string().optional().describe('One sentence explaining why weight changed or stayed the same vs last week'),
          })),
        })),
        deloadRecommended: z.boolean(),
        deloadReason: z.string().optional().describe('Why a deload is recommended, if applicable'),
      }),
    })

    return NextResponse.json({ program })
  } catch (error) {
    console.error('Program Generate Error:', error)
    return NextResponse.json({ error: 'Failed to generate program. Try again.' }, { status: 500 })
  }
}
