import { NextResponse } from 'next/server'
import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import { createClient } from '../../../../utils/supabase/server'
import { checkRateLimit } from '../../../../lib/rateLimit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ── Movement vocabulary the AI draws from ────────────────────────────────────

const MOVEMENT_LIBRARY = {
  olympic: [
    'Power Clean', 'Squat Clean', 'Hang Power Clean', 'Hang Squat Clean',
    'Power Snatch', 'Squat Snatch', 'Hang Power Snatch',
    'Clean & Jerk', 'Split Jerk', 'Push Jerk',
    'Clean Pull', 'Snatch Pull', 'Clean Deadlift',
  ],
  gymnastics: [
    'Pull-ups', 'Chest-to-Bar Pull-ups', 'Strict Pull-ups',
    'Ring Muscle-ups', 'Bar Muscle-ups',
    'Handstand Push-ups', 'Strict Handstand Push-ups', 'Pike Push-ups',
    'Ring Dips', 'Bar Dips',
    'Toes-to-Bar', 'Knees-to-Elbows', 'Hanging Knee Raises',
    'Box Jumps', 'Box Jump Overs',
    'Double-Unders', 'Single-Unders',
    'Burpees', 'Burpee Box Jumps', 'Bar-Facing Burpees',
    'Pistol Squats', 'Air Squats',
    'Push-ups', 'Hand Release Push-ups',
    'Hollow Rocks', 'V-Ups', 'GHD Sit-ups',
    'Back Extensions (GHD)',
    'L-Sit Hold', 'Rope Climbs', 'Rope Climb Progressions',
    'Wall Walk', 'Handstand Walk',
  ],
  barbell_metcon: [
    'Thrusters', 'Front Squats', 'Back Squats', 'Overhead Squats',
    'Deadlifts', 'Romanian Deadlifts',
    'Push Press', 'Push Jerk',
    'Barbell Lunges', 'Good Mornings',
    'Hang Power Cleans', 'Power Cleans',
    'Sumo Deadlift High Pull',
    'Wall Balls (DB or Med Ball)',
  ],
  monostructural: [
    'Run', 'Row (erg)', 'Assault Bike', 'Ski Erg',
    'Jump Rope', 'Double-Unders',
  ],
  kettlebell_db: [
    'KB Swings', 'KB Goblet Squat', 'KB Turkish Get-up',
    'KB Clean & Press', 'KB Snatch',
    'DB Snatch', 'DB Hang Power Clean', 'DB Thrusters',
    'Farmer Carry', 'Overhead Carry',
  ],
  strength_compounds: [
    'Back Squat', 'Front Squat', 'Overhead Squat',
    'Deadlift', 'Romanian Deadlift', 'Sumo Deadlift',
    'Bench Press', 'Overhead Press', 'Push Press',
    'Barbell Row', 'Pendlay Row',
    'Bulgarian Split Squat', 'Walking Lunges',
    'Good Morning', 'Hip Thrust',
    'Clean & Jerk', 'Snatch',
  ],
}

// ── Named benchmark workouts the AI can prescribe ────────────────────────────

const BENCHMARK_WODS = `
CLASSIC BENCHMARKS — prescribe these exactly when appropriate:
- Fran: 21-15-9 Thrusters (95/65 lb) + Pull-ups. For Time. Sprint ~2-6 min.
- Grace: 30 Clean & Jerks (135/95 lb). For Time. Sprint ~1-5 min.
- Isabel: 30 Snatches (135/95 lb). For Time. Sprint ~1-5 min.
- Diane: 21-15-9 Deadlifts (225/155 lb) + Handstand Push-ups. For Time.
- Helen: 3 rounds — Run 400m + 21 KB Swings (53/35 lb) + 12 Pull-ups. For Time.
- Annie: 50-40-30-20-10 Double-Unders + Sit-ups. For Time.
- Cindy: AMRAP 20 — 5 Pull-ups / 10 Push-ups / 15 Air Squats.
- Barbara: 5 rounds — 20 Pull-ups / 30 Push-ups / 40 Sit-ups / 50 Air Squats. Rest 3 min between rounds.
- Jackie: 1000m Row + 50 Thrusters (45 lb) + 30 Pull-ups. For Time.
- Karen: 150 Wall Balls (20/14 lb). For Time.
- Murph: 1 Mile Run + 100 Pull-ups + 200 Push-ups + 300 Air Squats + 1 Mile Run. For Time. Partition as needed. (45+ min)
- DT: 5 rounds — 12 Deadlifts + 9 Hang Power Cleans + 6 Push Jerks (155/105 lb). For Time.
`

// ── Zod schema for the AI output ──────────────────────────────────────────────

const AresBlockSchema = z.object({
  blockType: z.enum(['strength', 'olympic_build', 'gymnastics_skill', 'monostructural', 'accessory']),
  name: z.string().describe('Exercise or activity name, e.g. "Back Squat", "Clean & Jerk", "Pull-up Skill Work", "5k Run"'),
  format: z.enum(['sets_reps', 'build_to_max', 'skill_time', 'monostructural_distance', 'monostructural_time']),

  // sets_reps fields
  sets: z.number().optional(),
  repsMin: z.number().optional(),
  repsMax: z.number().optional(),
  targetRir: z.number().optional().describe('Only for strength work — 0-3 reps in reserve'),

  // build_to_max fields
  climbScheme: z.string().optional().describe('e.g. "5-4-3-2-2-1-1" or "3-3-2-2-1-1-1"'),
  timeCapMinutes: z.number().optional(),

  // skill_time fields
  durationMinutes: z.number().optional(),
  skillFocus: z.string().optional().describe('Specific skill to practice, e.g. "kipping timing", "bar muscle-up transition"'),

  // monostructural fields
  distance: z.string().optional().describe('e.g. "5k", "2000m", "20 minutes"'),

  coachCue: z.string().optional().describe('One short technical or mental cue'),
  notes: z.string().optional(),
})

const AresMetconSchema = z.object({
  name: z.string().optional().describe('Named workout if applicable, e.g. "Fran", "Murph", or null for custom'),
  format: z.enum(['for_time', 'amrap', 'emom', 'chipper', 'for_time_with_cap']),
  timeDomain: z.enum(['short', 'medium', 'long', 'very_long']).describe('short <10min, medium 10-25min, long 25-45min, very_long 45min+'),
  timeCapMinutes: z.number().optional().describe('Time cap in minutes for for_time_with_cap or AMRAP duration'),
  description: z.string().describe('Full workout prescription as you would write it on a whiteboard. Be specific about reps, weights, distances.'),
  movements: z.array(z.object({
    name: z.string(),
    reps: z.number().optional(),
    calories: z.number().optional(),
    distance: z.string().optional(),
    weightRx: z.string().optional().describe('e.g. "95/65 lb", "53/35 lb KB", "bodyweight"'),
    scaledOption: z.string().optional().describe('Common scale, e.g. "Ring rows or jumping pull-ups"'),
  })),
  rounds: z.number().optional().describe('Number of rounds for "X rounds for time" or EMOM structure'),
  coachNote: z.string().optional().describe('Brief intent or pacing note'),
}).nullable()

const AresDaySchema = z.object({
  dayNumber: z.number(),
  dayName: z.string().describe('Evocative name, e.g. "Squat & Suffer", "Olympic Day", "Long Grind"'),
  archetype: z.enum(['strength_metcon', 'olympic_build', 'gymnastics_skill', 'monostructural_strength', 'long_metcon', 'benchmark']),
  blocks: z.array(AresBlockSchema).describe('Ordered list: strength/skill first, MetCon last. 1-4 blocks max.'),
  metcon: AresMetconSchema,
  sessionIntent: z.string().describe('One sentence: what this session trains and why it fits the week'),
})

const AresProgramSchema = z.object({
  weekNumber: z.number(),
  weekTheme: z.string().describe('e.g. "Week 2 — Olympic Focus", "Week 4 — Aerobic Base"'),
  coachNote: z.string().describe('2-3 sentences referencing data. Direct, no fluff.'),
  days: z.array(AresDaySchema),
  deloadRecommended: z.boolean(),
  deloadReason: z.string().optional(),
})

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { allowed } = await checkRateLimit(supabase, user.id, 'ares-generate', 8, 60_000)
  if (!allowed) return NextResponse.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 })

  try {
    const {
      weekNumber,
      daysPerWeek = 4,
      userProfile,
      previousWeekArchetypes,
      olympicLifts1RMs,
      recentMetconResults,
      recentStrengthLogs,
    } = await request.json() as {
      weekNumber: number
      daysPerWeek?: number
      userProfile?: {
        trainingAge?: string
        gymType?: string
        equipment?: Record<string, boolean>
        injuryFlags?: string[]
        primaryGoal?: string
      }
      previousWeekArchetypes?: string[]   // archetypes used last week
      olympicLifts1RMs?: Record<string, number>  // clean, snatch, jerk peak weights
      recentMetconResults?: Array<{
        workoutName: string
        format: string
        result: string  // e.g. "8:42", "12 rounds + 5 reps"
        weekNumber: number
        rx: boolean
      }>
      recentStrengthLogs?: Array<{
        exercise: string
        sets: Array<{ weight: number; reps: number; rir: number | null }>
        weekNumber: number
      }>
    }

    if (!weekNumber) {
      return NextResponse.json({ error: 'Missing weekNumber' }, { status: 400 })
    }

    // Build context strings
    const prevArchetypeContext = previousWeekArchetypes?.length
      ? `LAST WEEK'S DAY ARCHETYPES: ${previousWeekArchetypes.join(' → ')}\nDo NOT repeat the same sequence. Vary the structure.`
      : 'FIRST WEEK — no previous archetype data.'

    const olympicContext = olympicLifts1RMs && Object.keys(olympicLifts1RMs).length
      ? `OLYMPIC LIFT RECENT MAXES:\n${Object.entries(olympicLifts1RMs).map(([k, v]) => `  ${k}: ${v} lbs`).join('\n')}`
      : 'OLYMPIC LIFT MAXES: Not established yet — Week 1 or first Olympic session. Start conservatively.'

    const metconContext = recentMetconResults?.length
      ? `RECENT METCON RESULTS:\n${recentMetconResults.map(r =>
          `  Week ${r.weekNumber} — ${r.workoutName} (${r.format}): ${r.result}${r.rx ? ' RX' : ' scaled'}`
        ).join('\n')}`
      : 'METCON HISTORY: None yet.'

    const strengthContext = recentStrengthLogs?.length
      ? `RECENT STRENGTH LOGS:\n${recentStrengthLogs.map(l =>
          `  ${l.exercise} (Week ${l.weekNumber}): ${l.sets.map(s =>
            `${s.weight}lb×${s.reps}@RIR${s.rir ?? '?'}`
          ).join(', ')}`
        ).join('\n')}`
      : 'STRENGTH LOG HISTORY: None yet.'

    const injuryContext = userProfile?.injuryFlags?.length
      ? `INJURY FLAGS: ${userProfile.injuryFlags.join(', ')} — avoid loading these patterns`
      : ''

    const gymContext = userProfile?.gymType === 'home'
      ? `GYM: Home — avoid equipment not in: ${Object.entries(userProfile?.equipment ?? {}).filter(([, v]) => v).map(([k]) => k).join(', ') || 'basic home setup'}`
      : 'GYM: Commercial — full equipment available'

    const prompt = `
WEEK: ${weekNumber}
DAYS THIS WEEK: ${daysPerWeek}
TRAINING AGE: ${userProfile?.trainingAge ?? 'intermediate'}
${gymContext}
${injuryContext}

${prevArchetypeContext}

${olympicContext}

${metconContext}

${strengthContext}

Generate ${daysPerWeek} training days for Ares week ${weekNumber}.
Apply all weekly variety rules and progression logic from the system prompt.
`.trim()

    const { object: program } = await generateObject({
      model: google('gemini-2.5-flash'),
      system: `You are an elite CrossFit and functional fitness programmer. You write for serious athletes who train 4 days/week and want constantly varied, high-quality programming.

PROGRAM IDENTITY — ARES:
Ares is a constantly varied functional fitness program. No two weeks look the same.
The movement menu includes: Olympic weightlifting, gymnastics/bodyweight skills, barbell strength, monostructural cardio (run/row/bike), and MetCons.
Ares respects three energy systems: phosphagen (short/max effort), glycolytic (medium intensity), oxidative (aerobic/long).

═══════════════════════════════════════════
DAY ARCHETYPES — choose one per day
═══════════════════════════════════════════

strength_metcon:
  1-2 heavy compound barbell lifts (squat, deadlift, press, row)
  1-2 complementary accessories
  MetCon: any time domain, must complement (not duplicate) the strength work
  Example: Back Squat 4×5, Bulgarian Split Squat 3×8, Good Morning 3×8 → MetCon with pull-ups + running

olympic_build:
  Build to heavy single or double on an Olympic lift (C&J, snatch, clean, split jerk)
  Climb scheme: 5-4-3-2-2-1-1 or 3-3-2-2-1-1 over 15-20 minutes
  Optional: 1 strength accessory (OHP, front squat, pull) if Olympic build is short
  MetCon: short only (<10 min) — athlete needs CNS recovery. Or no MetCon.
  Example: Build to heavy C&J in 20 min (5-4-3-2-2-1) → Grace or short AMRAP

gymnastics_skill:
  15-20 min focused skill block on ONE gymnastics movement
  (pull-ups, muscle-ups, handstand push-ups, double-unders, rope climbs, pistols)
  1-2 accessory movements that support the skill (e.g., ring rows + dips for muscle-ups)
  MetCon: medium time domain (10-20 min), must include the skill or a scaled version
  Example: 20 min pull-up skill (kipping/butterfly) + ring rows + 3-round AMRAP with pull-ups

monostructural_strength:
  Long monostructural cardio piece (5k run, 5000m row, 20 min assault bike, 30 min easy row)
  1 strength block AFTER the cardio — keep it simple (OHP, rows, or single compound)
  NO separate MetCon — the monostructural piece IS the conditioning
  Example: 5k run → OHP 4×6 + Barbell Row 4×6

long_metcon:
  One long effort: 30-60 minutes
  Can be a hero WOD (Murph, DT, etc.) or long AMRAP or chipper
  Minimal other work — maybe a brief warm-up skill or 1 short strength piece
  Example: 10 min skill warm-up → Murph

benchmark:
  A named CrossFit benchmark (Fran, Grace, Isabel, Cindy, Helen, etc.)
  1 strength primer BEFORE the benchmark — keep it light, not fatiguing
  The benchmark IS the MetCon — no additional MetCon
  Example: OHP 4×5 (moderate) → Fran

═══════════════════════════════════════════
WEEKLY VARIETY RULES — must enforce
═══════════════════════════════════════════

1. ARCHETYPE ROTATION: Do not repeat last week's archetype sequence. Every 4-week cycle should include all 6 archetypes at least once.
2. OLYMPIC COVERAGE: At least 1 Olympic lift per week (olympic_build OR Olympic movement in MetCon).
3. GYMNASTICS COVERAGE: At least 1 gymnastics element per week (gymnastics_skill day OR gymnastics in MetCon).
4. METCON TIME DOMAINS: Across 4 days — aim for 1 short (<10), 1 medium (10-25), 1 long (25+). Avoid 3 short MetCons in one week.
5. NO BACK-TO-BACK HEAVY HINGING: Don't program heavy deadlifts two days in a row.
6. NO SAME-DAY GRIP CLASH: Don't pair heavy Olympic lifting + lots of pull-ups on the same day.
7. ENERGY SYSTEM BALANCE: At least 1 oxidative (aerobic) session per week (long MetCon, monostructural_strength, or very long AMRAP).
8. DELOAD SIGNAL: If week ≥ 5 or if recentMetconResults show declining performance — recommend deload. Deload = reduce MetCon intensity by 30%, no heavy strength max-effort work.

═══════════════════════════════════════════
METCON DESIGN PRINCIPLES
═══════════════════════════════════════════

Short (<10 min) — SPRINT. Classic couplets/triplets:
  - Format: For Time or EMOM
  - Rep schemes: 21-15-9, 10-8-6, 5 rounds of small sets, or named benchmarks (Fran, Grace, Isabel)
  - Load: athletes should move continuously — use 55-65% of 1RM for barbell movements
  - Example: 21-15-9 Thrusters 95/65 + Pull-ups (Fran)

Medium (10-25 min) — SUSTAIN. AMRAPs, longer For Time:
  - Format: AMRAP or For Time
  - 3-6 movements, balanced push/pull/mono
  - Athletes can breathe — keep moving but not all-out sprint pace
  - Example: AMRAP 20 — 400m Run + 15 KB Swings + 10 Pull-ups

Long (25-45 min) — GRIND. Chippers, hero WODs, long AMRAPs:
  - Format: For Time or AMRAP
  - Pacing matters — prescribe a target pace or break strategy in coachNote
  - Example: 5 rounds: 800m run + 30 KB swings + 20 pull-ups + 10 bar muscle-ups

Very Long (45+ min) — ENDURE. Named hero WODs only or long monostructural:
  - Murph, long chipper, 60-min AMRAP
  - Partner version acceptable

EMOM structure:
  - Each minute has a distinct movement or short set
  - Built-in rest = can use higher skill or heavier load
  - Example: EMOM 15 — Min 1: 3 Power Cleans @ 75% / Min 2: 6 Ring Dips / Min 3: 10 Box Jumps

${BENCHMARK_WODS}

═══════════════════════════════════════════
STRENGTH PRESCRIPTION RULES
═══════════════════════════════════════════

For strength blocks (format = sets_reps):
  - Prescribe sets, repsMin/repsMax, targetRir (0-3)
  - Week 1: RIR 3-4 (baseline)
  - Week 2+: progress based on logs — if athlete hit top of rep range at RIR 3, tighten to RIR 2
  - Do NOT prescribe weights — the system handles weight recommendations

For Olympic builds (format = build_to_max):
  - Prescribe the climb scheme (e.g., "5-4-3-2-2-1-1") and time cap
  - The athlete climbs to their daily heavy — system does NOT prescribe weights
  - Week-over-week: if last week's max is in history, note "aim to beat by 2-5 lbs" in coachCue

For skill work (format = skill_time):
  - Prescribe duration (15-20 min) and specific skill focus
  - Be specific: not just "pull-up practice" but "work kipping pull-up timing: 5-8 reps per set, prioritize lat engagement at the top"

For monostructural (format = monostructural_distance or monostructural_time):
  - Prescribe distance OR time with effort level in coachCue
  - e.g., "5k run — conversational pace, Z2 effort, no stopping"

═══════════════════════════════════════════
OUTPUT RULES
═══════════════════════════════════════════

- dayName: vivid, e.g. "Barbell & Breathe", "The Long Grind", "Olympic Day", "Gymnast's Test"
- sessionIntent: one sentence explaining what this day trains and why it's in the week
- coachNote (top-level): 2-3 sentences. Reference actual data from logs. Direct and honest.
- Blocks: ordered strength → skill → MetCon. Max 4 blocks per day.
- metcon.description: write exactly as it would appear on a whiteboard.
  Example: "AMRAP 20\\n5 Pull-ups\\n10 Push-ups\\n15 Air Squats"
  Example: "For Time\\n21-15-9\\nThrusters (95/65 lb)\\nPull-ups"
- metcon.coachNote: pacing or intent, e.g. "Aim for unbroken sets of 5 on pull-ups through round 2."
- Scale options: always include at least one scaled option per gymnastics movement in metcon.`,
      prompt,
      schema: AresProgramSchema,
    })

    return NextResponse.json({ program })

  } catch (error) {
    console.error('Ares Generate Error:', error)
    return NextResponse.json({ error: 'Failed to generate Ares program. Try again.' }, { status: 500 })
  }
}
