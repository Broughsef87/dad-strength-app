import { NextResponse } from 'next/server'
import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import { createClient } from '../../../../utils/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT = 5
const RATE_WINDOW = 60 * 1000

// ── Compound movement patterns (used for weight progression increments) ───────

const COMPOUND_PATTERNS = new Set([
  'push_horizontal', 'push_vertical', 'pull_horizontal', 'pull_vertical',
  'squat', 'squat_unilateral', 'hinge',
])

// ── Epley-based weight recommendation ────────────────────────────────────────

function epleyWeight(oneRM: number, targetReps: number, targetRir: number): number {
  const effectiveReps = targetReps + targetRir
  if (effectiveReps <= 1) return oneRM
  const weight = oneRM / (1 + effectiveReps / 30)
  return Math.round(weight / 2.5) * 2.5
}

function get1RMForExercise(
  name: string,
  pattern: string,
  oneRepMaxes: Record<string, number>
): number {
  const n = name.toLowerCase()
  const bench = oneRepMaxes.bench || 0
  const squat = oneRepMaxes.squat || 0
  const deadlift = oneRepMaxes.deadlift || 0
  const ohp = oneRepMaxes.ohp || 0
  const row = oneRepMaxes.row || 0

  // Direct matches
  if (n.includes('bench press') && !n.includes('incline') && !n.includes('db')) return bench
  if ((n.includes('back squat') || n === 'squat') && !n.includes('goblet') && !n.includes('hack')) return squat
  if (n.includes('deadlift') && !n.includes('romanian') && !n.includes('stiff')) return deadlift
  if (n.includes('overhead press') || n.includes('ohp') || n.includes('barbell ohp')) return ohp
  if (n.includes('barbell row') || n.includes('barbell rows')) return row

  // Derivatives by pattern
  if (pattern === 'push_horizontal') return Math.round(bench * 0.375 / 2.5) * 2.5
  if (pattern === 'push_fly') return Math.round(bench * 0.16 / 2.5) * 2.5
  if (pattern === 'push_vertical') return Math.round((ohp || bench * 0.60) * 0.375 / 2.5) * 2.5
  if (pattern === 'push_tricep') return Math.round(bench * 0.30 / 2.5) * 2.5
  if (pattern === 'pull_horizontal') return Math.round(row * 0.85 / 2.5) * 2.5
  if (pattern === 'pull_vertical') return Math.round(row * 0.70 / 2.5) * 2.5
  if (pattern === 'pull_rear_delt') return Math.round(row * 0.18 / 2.5) * 2.5
  if (pattern === 'isolation_bicep') return Math.round(row * 0.16 / 2.5) * 2.5
  if (pattern === 'isolation_shoulder') return Math.round((ohp || bench * 0.60) * 0.18 / 2.5) * 2.5
  if (pattern === 'squat') return Math.round(squat * 1.3 / 5) * 5
  if (pattern === 'squat_unilateral') return Math.round(squat * 0.40 / 2.5) * 2.5
  if (pattern === 'isolation_quad') return Math.round(squat * 0.30 / 2.5) * 2.5
  if (pattern === 'hinge') return Math.round(deadlift * 0.50 / 2.5) * 2.5
  if (pattern === 'hinge_extension') return Math.round(deadlift * 0.30 / 2.5) * 2.5
  if (pattern === 'isolation_hamstring') return Math.round(deadlift * 0.20 / 2.5) * 2.5
  if (pattern === 'isolation_calf') return Math.round(squat * 0.45 / 5) * 5
  if (pattern === 'isolation_hip') return Math.round(squat * 0.25 / 2.5) * 2.5

  return 0
}

function calcRecommendedWeight(
  name: string,
  pattern: string,
  targetReps: number,
  targetRir: number,
  lastWeekWeight: number | null,
  lastWeekRir: number | null,
  oneRepMaxes: Record<string, number>
): number {
  const isCompound = COMPOUND_PATTERNS.has(pattern)

  if (lastWeekWeight === null) {
    // Week 1 — derive from 1RM
    const rm = get1RMForExercise(name, pattern, oneRepMaxes)
    if (!rm) return 0
    return epleyWeight(rm, targetReps, targetRir)
  }

  // Week 2+ — adjust from last week's actual
  if (lastWeekRir === 0) {
    // Hit true failure → add weight
    return lastWeekWeight + (isCompound ? 5 : 2.5)
  }

  // Otherwise weight stays same; AI changes RIR target
  return lastWeekWeight
}

// ── Day split definitions per god and days per week ──────────────────────────

function getDaySplit(god: string, days: number): string {
  const splits: Record<string, Record<number, string>> = {
    adonis: {
      3: 'Day 1: Push (Chest/Delts/Triceps)\nDay 2: Pull (Back/Biceps)\nDay 3: Legs (Quads/Hams/Glutes/Calves)',
      4: 'Day 1: Chest + Triceps\nDay 2: Back + Biceps\nDay 3: Shoulders + Arms\nDay 4: Legs',
      5: 'Day 1: Chest\nDay 2: Back\nDay 3: Shoulders + Arms\nDay 4: Legs (Quad Focus)\nDay 5: Legs (Glute + Ham Focus)',
    },
    ares: {
      3: 'Day 1: Upper Strength + Metcon\nDay 2: Lower Power + Conditioning\nDay 3: Full Body Strongman',
      4: 'Day 1: Upper Push + Metcon\nDay 2: Lower Squat Pattern\nDay 3: Upper Pull + Carries\nDay 4: Lower Hinge + Conditioning',
      5: 'Day 1: Upper Push\nDay 2: Lower Squat\nDay 3: MetCon Circuit\nDay 4: Upper Pull\nDay 5: Lower Hinge + Strongman',
    },
    hercules: {
      3: 'Day 1: Squat Day (primary: Back Squat)\nDay 2: Bench Day (primary: Barbell Bench Press)\nDay 3: Deadlift Day (primary: Deadlift + OHP)',
      4: 'Day 1: Squat Day (primary: Back Squat)\nDay 2: Bench Day (primary: Barbell Bench Press)\nDay 3: Deadlift Day (primary: Deadlift)\nDay 4: OHP Day (primary: Barbell OHP) + Accessory Work',
      5: 'Day 1: Squat Day\nDay 2: Bench Day\nDay 3: Deadlift Day\nDay 4: OHP Day\nDay 5: Weak Points (volume work, no 1RM attempts)',
    },
    atlas: {
      4: 'Day 1: Squat + Carries\nDay 2: Press + Strongman\nDay 3: Deadlift + Carries\nDay 4: Pull + Loaded Conditioning',
    },
    chronos: {
      4: 'Daily: Squeeze Session (A1 Compound → A2 Superset → Finisher)',
    },
  }
  return splits[god]?.[days] ?? `${days}-day balanced split`
}

// ── System prompts per god ────────────────────────────────────────────────────

const GOD_SYSTEM_PROMPTS: Record<string, string> = {
  adonis: `You are the ADONIS coach. Your philosophy: sculpt the physique through volume and pump.
Rep ranges: 8-15 for all accessory work, 6-12 for compounds. Never go below 6 reps.
Exercise priority: cables and machines over barbells for accessories (superior stretch and contraction). Barbells only for the primary compound lift of a day.
Volume: 18-24 working sets per session. Every session ends with isolation finishers.
Always include lateral raises and rear delt work on any upper body day.
CRITICAL: Do NOT prescribe specific weights. The system calculates them.
Your job: exercise name, movementPattern (must be one of: push_horizontal, push_fly, push_vertical, push_tricep, pull_horizontal, pull_vertical, pull_rear_delt, isolation_bicep, isolation_shoulder, isolation_quad, isolation_hamstring, isolation_calf, isolation_hip, squat, squat_unilateral, hinge, hinge_extension, gpp, gpp_carry, gpp_push, gpp_conditioning, gpp_cardio), sets count, targetReps, targetRir only.`,

  ares: `You are the ARES coach. Your athletes are warriors — built for battle, not just the mirror.
Philosophy: CrossFit-inspired hybrid training. Every session blends heavy iron with conditioning that leaves them gasping.

SESSION STRUCTURE:
1) Explosive Primer (3-5 sets × 3-5 reps): power clean, hang clean, box jump, med ball slam, or broad jump — pick what fits available equipment. This is about SPEED, not grinding.
2) Primary Strength Compound (4-5 sets × 3-6 reps, RIR 1-2): barbell squat, deadlift, bench, OHP, or weighted pull-ups
3) Assistance / Accessory (2-3 exercises, 3 sets × 6-10 reps, RIR 2-3): UNILATERAL MANDATORY — split squat, single-leg RDL, single-arm row, etc.
4) Conditioning Finisher: AMRAP, EMOM, or For-Time — carries, KB swings, push-ups, box jumps, row/bike cals, burpees. Use movementPattern gpp_conditioning for finishers.

EQUIPMENT SCALING (CRITICAL):
- Commercial gym (gymType='commercial'): barbells, cables, machines, rowers, sleds — use them all
- Home gym (gymType='home'): scale to DBs, KBs, bodyweight, pull-up bar — NO barbell unless barbell is in context. Replace power clean with DB hang clean or KB swing. Replace sled with farmer carry.
- ALWAYS program so the session is completable with available equipment.

REP RANGES:
- Explosive primer: 3-5 reps (intent is speed and power, not failure)
- Primary compound: 3-6 reps, RIR 1-2
- Assistance: 6-10 reps, RIR 2-3
- Conditioning finishers: targetRir=0, note "load by feel, RPE 8-9"

movementPattern must be one of: push_horizontal, push_fly, push_vertical, push_tricep, pull_horizontal, pull_vertical, pull_rear_delt, isolation_bicep, isolation_shoulder, isolation_quad, isolation_hamstring, isolation_calf, isolation_hip, squat, squat_unilateral, hinge, hinge_extension, gpp, gpp_carry, gpp_push, gpp_conditioning, gpp_cardio, gpp_power.
Use gpp_power for cleans/jumps/med ball. Use gpp_carry for farmer/suitcase/sandbag. Use gpp_push for sled/prowler. Use gpp_conditioning for AMRAP circuits and burpee/KB combos.
CRITICAL: Do NOT prescribe specific weights. The system calculates them.`,

  hercules: `You are the HERCULES coach. One religion: absolute strength.
Every day is built around ONE primary barbell lift (squat, bench, deadlift, or OHP).
Primary lift: 4-5 sets of 2-5 reps at RIR 1-2 (very heavy).
After the primary, include 4-6 accessory exercises targeting the same movement pattern and supporting muscle groups.
Accessories use whatever equipment best serves the movement: DBs, cables, and machines are all fair game.
Accessory rep ranges: 6-12 reps at RIR 2-3. Prioritize movements that reinforce the primary lift and protect joints.
Example accessories for Bench Day: incline DB press, cable fly, tricep pushdown, face pulls, lateral raises.
Example accessories for Squat Day: leg press, leg extension, leg curl, calf raises, back extensions.
Rep ranges never exceed 12 for accessories, never exceed 5 for primary lifts.
CRITICAL: Do NOT prescribe specific weights. The system calculates them.
movementPattern must match valid patterns.`,

  atlas: `You are the ATLAS coach. Your athletes carry the world — literally.
Philosophy: Functional strength meets strongman. Every session has carries. Every session has heavy compounds. No machines, no isolation. If it doesn't translate to real-world strength, it doesn't belong here.

SESSION STRUCTURE:
1) Primary Compound (4-5 sets × 3-6 reps, RIR 1-2): squat, deadlift, press, or row variation — barbell first
2) Accessory Strength (2-3 exercises, 3 sets × 5-8 reps, RIR 2-3): unilateral work, overhead, pulls — NO isolation machines
3) Loaded Carry or Strongman Finisher (MANDATORY every session): farmer carry, suitcase carry, overhead carry, sandbag carry, yoke walk, log press, tire flip sub — distance (40-60yd) or timed (30-45s)

STRONGMAN MOVEMENTS — rotate weekly:
- Farmer carry, suitcase carry, overhead carry
- Sandbag carry or bear-hug plate carry (sub for atlas stone)
- Log press (sub with axle barbell or thick-grip barbell OHP)
- Tire flip (sub with deadlift + box jump)
- Yoke walk (sub with heavy barbell back walk or SSB carry)

EQUIPMENT RULES:
- Commercial gym: barbell + rack is primary. Sub log with barbell.
- Home gym: DBs/KBs for carries. Sub barbell squats with goblet/KB. Keep carries regardless.

REP RANGES:
- Primary: 3-6 reps, RIR 1-2
- Accessories: 5-8 reps, RIR 2-3
- Carries/strongman: targetRir=0, note "load by feel, RPE 8-9"

movementPattern must be one of: push_horizontal, push_vertical, pull_horizontal, pull_vertical, squat, squat_unilateral, hinge, hinge_extension, gpp_carry, gpp_push, gpp_conditioning.
Use gpp_carry for ALL carries. Use gpp_conditioning for tire flip subs and sandbag events. Use gpp_push for yoke/sled.
CRITICAL: Do NOT prescribe specific weights. The system calculates them.
Every session MUST end with at least one carry or loaded strongman movement.`,

  chronos: `You are the CHRONOS coach. Time is the enemy. You win.
Philosophy: 15-20 minutes, maximum output. A1 compound → A2 superset → Finisher. No rest that isn't programmed. No wasted seconds.

SESSION STRUCTURE — STRICT:
A1: Compound Strength — 3 sets, heavy, 60s rest between sets
A2: Conditioning Superset — 3 rounds, 2 exercises paired, 0s rest between exercises, 30-45s rest between rounds
Finisher: Max Effort — AMRAP 3min OR max reps 2min OR for time

MOVEMENT LIBRARY:
PUSH: Barbell bench press, DB bench press, Push-ups, Barbell OHP, DB OHP, Dips
PULL: Barbell rows, DB rows, Pull-ups/Chin-ups, Inverted rows, Face pulls, Curls
HINGE: Deadlift, Romanian DL, DB/KB swing, Single-leg RDL
SQUAT: Back squat, Goblet squat, Bulgarian split squat, Wall sit
CARRY/CORE: Farmer carry, Suitcase carry, Plank, Hollow body, Ab wheel, Dead bug
CONDITIONING: Burpees, Bike cals, Rower cals, Jump rope, Box jumps, Shuttle sprints

EQUIPMENT RULES (CRITICAL):
- NEVER program barbell if no barbell available
- NEVER program pull-ups if no pull-up bar
- Scale all movements to available equipment
- With no equipment, bodyweight only

movementPattern: use same valid patterns. Use gpp_carry for carries, gpp_conditioning for circuits, hinge/squat/push/pull for A1.
CRITICAL: Do NOT prescribe specific weights. The system calculates them.`,
}

// ── Output schema (identical to program-generate route) ──────────────────────

const programSchema = z.object({
  weekNumber: z.number(),
  programName: z.string(),
  weekTheme: z.string(),
  coachNote: z.string(),
  days: z.array(z.object({
    dayNumber: z.number(),
    dayName: z.string(),
    exercises: z.array(z.object({
      name: z.string(),
      movementPattern: z.string(),
      sets: z.array(z.object({
        setNumber: z.number(),
        targetReps: z.number(),
        targetRir: z.number(),
        notes: z.string().optional(),
      })),
      progressionNote: z.string().optional(),
    })),
  })),
  deloadRecommended: z.boolean(),
  deloadReason: z.string().optional(),
  isCalibrationWeek: z.boolean(),
})

// ── POST handler ──────────────────────────────────────────────────────────────

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
      god,
      focusGroups,
      daysPerWeek,
      weekNumber,
      gymType,
      oneRepMaxes,
      recentLogs,
    } = await request.json() as {
      userId: string
      god: 'adonis' | 'ares' | 'hercules' | 'atlas' | 'chronos'
      focusGroups: string[]
      daysPerWeek: 3 | 4 | 5
      weekNumber: number
      gymType: 'commercial' | 'home'
      oneRepMaxes: { bench?: number; squat?: number; deadlift?: number; ohp?: number; row?: number }
      recentLogs: Array<{ exercise_name: string; weight: number; reps: number; rir_actual: number | null; completed: boolean; created_at: string }>
    }

    if (!userId || !god || !daysPerWeek || !weekNumber || !gymType) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    if (!['adonis', 'ares', 'hercules', 'atlas', 'chronos'].includes(god)) {
      return NextResponse.json({ error: `Unknown god: ${god}` }, { status: 400 })
    }

    if (![3, 4, 5].includes(daysPerWeek)) {
      return NextResponse.json({ error: 'daysPerWeek must be 3, 4, or 5.' }, { status: 400 })
    }

    const safeFocusGroups = Array.isArray(focusGroups) ? focusGroups.slice(0, 2) : []
    const rms = oneRepMaxes ?? {}

    // ── Build log summary per exercise ──────────────────────────────────────
    type LogEntry = { exercise_name: string; weight: number; reps: number; rir_actual: number | null; completed: boolean; created_at: string }
    const logsByExercise: Record<string, LogEntry[]> = {}
    for (const log of (recentLogs || [])) {
      const key = log.exercise_name
      if (!logsByExercise[key]) logsByExercise[key] = []
      logsByExercise[key].push(log)
    }

    // Last session per exercise
    const exerciseSummaryLines: string[] = []
    const lastSessionByExercise: Record<string, { weight: number; reps: number; rir_actual: number | null }> = {}
    for (const [exercise, logs] of Object.entries(logsByExercise)) {
      const sorted = logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      const lastDate = sorted[0].created_at.split('T')[0]
      const lastSession = sorted.filter(l => l.created_at.startsWith(lastDate))
      const lastSet = lastSession[lastSession.length - 1]
      lastSessionByExercise[exercise] = { weight: lastSet.weight, reps: lastSet.reps, rir_actual: lastSet.rir_actual }
      const setLines = lastSession.map((s, i) =>
        `  Set ${i + 1}: ${s.weight}lbs × ${s.reps} reps, RIR=${s.rir_actual ?? 'not logged'}, completed=${s.completed}`
      ).join('\n')
      exerciseSummaryLines.push(`${exercise} (${lastDate}):\n${setLines}`)
    }

    const hasHistory = exerciseSummaryLines.length > 0
    const logContext = hasHistory
      ? `RECENT TRAINING LOGS:\n${exerciseSummaryLines.join('\n\n')}`
      : `RECENT TRAINING LOGS: None — Week 1, user's first session.`

    // ── Build user prompt ────────────────────────────────────────────────────
    const prompt = `
CUSTOM PROGRAM REQUEST:
- God/Philosophy: ${god.toUpperCase()}
- Days per week: ${daysPerWeek}
- Gym type: ${gymType}
- Week: ${weekNumber}
- Focus muscles (add 2 extra sets of isolation work for these): ${safeFocusGroups.length > 0 ? safeFocusGroups.join(', ') : 'balanced — no specific focus'}

DAY STRUCTURE TO USE:
${getDaySplit(god, daysPerWeek)}

${logContext}

Generate a complete ${daysPerWeek}-day week. Use the exact day names from the structure above.
Focus muscles get at least one extra isolation exercise and 2 more sets on their relevant day(s).
Week 1 calibration: use baseline RIR 3-4 for all exercises. weekTheme = "Week 1 — Find Your Baseline".
`.trim()

    // ── Generate AI program ─────────────────────────────────────────────────
    const { object: aiProgram } = await generateObject({
      model: google('gemini-2.5-flash'),
      system: GOD_SYSTEM_PROMPTS[god],
      prompt,
      schema: programSchema,
    })

    // ── Server-side: inject recommendedWeight per set ───────────────────────
    const programWithWeights = {
      ...aiProgram,
      days: aiProgram.days.map(day => ({
        ...day,
        exercises: day.exercises.map(ex => {
          const lastData = lastSessionByExercise[ex.name] ?? null
          return {
            ...ex,
            sets: ex.sets.map(set => ({
              ...set,
              recommendedWeight: calcRecommendedWeight(
                ex.name,
                ex.movementPattern,
                set.targetReps,
                set.targetRir,
                lastData?.weight ?? null,
                lastData?.rir_actual ?? null,
                rms
              ),
            })),
          }
        }),
      })),
    }

    return NextResponse.json({ program: programWithWeights })
  } catch (error) {
    console.error('Custom Program Generate Error:', error)
    return NextResponse.json({ error: 'Failed to generate program. Try again.' }, { status: 500 })
  }
}
