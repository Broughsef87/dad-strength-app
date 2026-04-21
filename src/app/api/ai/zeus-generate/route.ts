import { NextResponse } from 'next/server'
import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import { createClient } from '../../../../utils/supabase/server'
import { checkRateLimit } from '../../../../lib/rateLimit'

export const dynamic = 'force-dynamic'
// Vercel Pro allows up to 300s. We need headroom for Flash's thinking budget
// plus a single retry. 120s is the sweet spot — enough slack without
// letting a truly hung call hang forever.
export const maxDuration = 120

// ── Zod schemas ───────────────────────────────────────────────────────────────

const ZeusBlockSchema = z.object({
  blockType: z.enum(['strength_a', 'strength_b', 'olympic', 'gymnastics', 'conditioning', 'accessory']),
  name: z.string().describe('Exercise name, e.g. "Back Squat", "Hang Power Clean + Push Jerk", "Toes-to-Bar"'),
  format: z.enum(['sets_reps', 'build_to_max', 'skill_time', 'intervals', 'steady_state', 'accessory_circuit']),

  // sets_reps
  sets: z.number().optional(),
  repsMin: z.number().optional(),
  repsMax: z.number().optional(),
  targetRir: z.number().optional().describe('0-3 reps in reserve. Only for strength_a and strength_b blocks.'),
  variation: z.string().optional().describe('Movement variation: "Paused", "Box", "Tempo 3-1-0", "Deficit", "Pin", "Banded", etc.'),

  // build_to_max (oly)
  climbScheme: z.string().optional().describe('e.g. "3-3-2-2-1-1" — rep scheme to build to heavy'),
  timeCapMinutes: z.number().optional(),

  // skill_time (gymnastics)
  durationMinutes: z.number().optional(),
  skillFocus: z.string().optional().describe('Specific focus, e.g. "T2B kip timing — hip-to-bar lat engagement, 5-7 per set"'),
  scaledOption: z.string().optional().describe('Conservative scale for rusty athlete: e.g. "Hanging knee raise" or "Box pike push-up"'),
  progressionNote: z.string().optional().describe('What this develops toward in future weeks'),

  // intervals / conditioning
  intervalScheme: z.string().optional().describe('e.g. "6×3 min @85% / 2 min rest" or "8×200m / 60s rest"'),
  machine: z.string().optional().describe('"Row", "Bike", "Run", "Free Runner"'),
  effortCue: z.string().optional().describe('Pacing cue, e.g. "Uncomfortable but controlled — stay aerobic"'),

  // accessory_circuit
  accessoryExercises: z.array(z.object({
    name: z.string(),
    sets: z.number(),
    repsMin: z.number(),
    repsMax: z.number(),
    note: z.string().optional(),
  })).optional(),

  coachCue: z.string().optional().describe('One technical or mental cue for this block'),
  notes: z.string().optional(),
})

const ZeusMetconSchema = z.object({
  name: z.string().optional(),
  format: z.enum(['for_time', 'amrap', 'emom', 'for_time_with_cap']),
  timeDomain: z.enum(['short', 'medium', 'long']).describe('short <10min, medium 10-20min, long 20-30min'),
  timeCapMinutes: z.number().optional(),
  description: z.string().describe('Whiteboard-style prescription. E.g. "AMRAP 12\\n5 Power Cleans (185/135 lb)\\n10 Box Jumps (24/20)\\n15 Cal Row"'),
  movements: z.array(z.object({
    name: z.string(),
    reps: z.number().optional(),
    calories: z.number().optional(),
    distance: z.string().optional(),
    weightRx: z.string().optional().describe('e.g. "185/135 lb", "bodyweight"'),
    scaledOption: z.string().optional(),
  })),
  rounds: z.number().optional(),
  coachNote: z.string().optional(),
}).nullable()

const ZeusDaySchema = z.object({
  weekNumber: z.number(),
  mesoNumber: z.number().describe('Running meso count — 1 for weeks 1-4, 2 for weeks 5-8, etc. Indefinite.'),
  weekInMeso: z.number().describe('1-4 within the current meso'),
  dayNumber: z.number().describe('1-4'),
  dayName: z.string().describe('Evocative name, e.g. "Squat Day", "Engine Room", "Push & Breathe"'),
  sessionIntent: z.string().describe('One sentence: what this session trains and why it belongs in this day slot'),
  blocks: z.array(ZeusBlockSchema).describe('Ordered blocks per day template. Day 1/3 include metcon separately; Day 2/4 do not.'),
  metcon: ZeusMetconSchema,
  coachNote: z.string().describe('2-3 sentences. Reference progression data if available. Honest and direct.'),
})

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { allowed } = await checkRateLimit(supabase, user.id, 'zeus-generate', 20, 60_000)
  if (!allowed) return NextResponse.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 })

  try {
    const {
      weekNumber,
      dayNumber,
      recentLogs,
      recentMetcons,
      olympicLifts1RMs,
    } = await request.json() as {
      weekNumber: number
      dayNumber: number
      recentLogs?: Array<{
        exercise: string
        weekNumber: number
        sets: Array<{ weight: number; reps: number; rir?: number }>
      }>
      recentMetcons?: Array<{
        name: string
        format: string
        result: string
        weekNumber: number
      }>
      olympicLifts1RMs?: Record<string, number>
    }

    if (!weekNumber || weekNumber < 1) {
      return NextResponse.json({ error: 'weekNumber must be >= 1' }, { status: 400 })
    }
    if (!dayNumber || dayNumber < 1 || dayNumber > 4) {
      return NextResponse.json({ error: 'dayNumber must be 1-4' }, { status: 400 })
    }

    // Derive meso and week-in-meso. Program cycles indefinitely in 4-week mesos.
    const mesoNumber = Math.ceil(weekNumber / 4)
    const weekInMeso = ((weekNumber - 1) % 4) + 1
    const mesoParity = mesoNumber % 2 === 1 ? 'odd' : 'even'
    const squatVariant = mesoParity === 'odd' ? 'Back Squat' : 'Front Squat'
    const ohpVariant = mesoParity === 'odd' ? 'Strict Press' : 'Push Press'

    // Build context strings
    const strengthContext = recentLogs?.length
      ? `RECENT STRENGTH LOGS:\n${recentLogs.map(l =>
          `  ${l.exercise} (Week ${l.weekNumber}): ${l.sets.map(s =>
            `${s.weight}lb×${s.reps}${s.rir !== undefined ? `@RIR${s.rir}` : ''}`
          ).join(', ')}`
        ).join('\n')}`
      : 'STRENGTH LOG HISTORY: None yet — start conservatively.'

    const metconContext = recentMetcons?.length
      ? `RECENT METCON RESULTS:\n${recentMetcons.map(r =>
          `  Week ${r.weekNumber} — ${r.name} (${r.format}): ${r.result}`
        ).join('\n')}`
      : 'METCON HISTORY: None yet.'

    const olympicContext = olympicLifts1RMs && Object.keys(olympicLifts1RMs).length
      ? `OLYMPIC LIFT 1RMs (from calibration):\n${Object.entries(olympicLifts1RMs).map(([k, v]) => {
          const label = k === 'snatch' ? 'Snatch' : k === 'cleanJerk' ? 'Clean & Jerk' : k
          return `  ${label}: ${v} lbs`
        }).join('\n')}\nUse these to calibrate Olympic session intensity — reference %1RM in coachCue where appropriate (e.g. "build to ~85%" ≈ lbs).`
      : 'OLYMPIC 1RMs: Not provided — start Olympic work conservatively and build by feel.'

    const prompt = `
ZEUS PROGRAM — GENERATE SINGLE DAY
Week: ${weekNumber} (Meso ${mesoNumber}, week ${weekInMeso} of 4 in meso)
Meso parity: ${mesoParity} — Squat variant this meso: ${squatVariant}. OHP variant this meso: ${ohpVariant}.
Day: ${dayNumber} of 4

${olympicContext}

${strengthContext}

${metconContext}

Generate Day ${dayNumber} for Zeus Week ${weekNumber}.
Apply the strict day template for Day ${dayNumber}.
On squat day use ${squatVariant} for all 4 weeks of this meso.
On OHP day use ${ohpVariant} for all 4 weeks of this meso.
Scale load climb by week-in-meso (W1 RIR 3, W2 RIR 2, W3 RIR 1, W4 peak).
`.trim()

    // Flash occasionally produces output that fails Zod validation on a long
    // system prompt. Retry once before giving up — cheap insurance. Skip
    // the retry if we've already burned >60s to avoid 504ing on the client.
    const startTime = Date.now()
    let day: unknown
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt === 1 && Date.now() - startTime > 60_000) {
        throw new Error('Generation exceeded retry budget — skipping retry to avoid 504')
      }
      try {
        const result = await generateObject({
          model: google('gemini-2.5-flash'),
          // Disable Gemini's "thinking" step — the Zod schema enforces
          // structure, we don't need chain-of-thought reasoning. Thinking
          // adds 10-30s of latency and was the main 504 cause.
          providerOptions: {
            google: {
              thinkingConfig: { thinkingBudget: 0 },
            },
          },
          system: `You are an elite CrossFit programmer writing for a single athlete: Zeus.

═══════════════════════════════════════════
ATHLETE PROFILE
═══════════════════════════════════════════

Zeus is an accomplished weightlifter rebuilding CrossFit skills and engine.
- Strong barbell foundation: squats, deadlifts, Olympic lifts are home turf.
- WEAK and RUSTY in gymnastics — 7-8 years away from CrossFit gymnastics.
  → Always scale gymnastics conservatively. No kipping before strict volume is solid.
  → T2B: start at hanging knee raises → tuck → partial T2B → full T2B.
  → HSPU: pike push-ups → kipping → strict → deficit (later mesos).
  → Muscle-ups: bar progressions only after T2B and strict pull-ups are solid.
  → Double unders: rebuilding — singles, DU attempts in short sets, building linked sets.
- Cardio engine rebuilding — short to medium efforts preferred over long slow stuff.
- Equipment: 24 Hour Fitness commercial gym. Full barbell, DBs, machines,
  Concept2 rower, Assault/Echo bike, free runner, ski erg, rings, rig, GHD.
  No sled, no specialty bars.

═══════════════════════════════════════════
PROGRAM STRUCTURE — 4-WEEK MESOS, INDEFINITE
═══════════════════════════════════════════

Zeus runs 4-week mesocycles indefinitely. No terminal end. 4 days/week.
Squat and OHP variants alternate per meso (odd vs even meso number).

Each day has 4 elements:
  A — Technique/Skill movement
  B — Main compound strength (strength_a)
  C — 2× accessories supporting B's pattern or muscle group
  D — Conditioning finisher (mixed-modal metcon or monostructural)

Weekly shape (same every week):
  Day 1 — Clean & Jerk + Squat + Mixed-Modal Metcon
  Day 2 — Gymnastics + Pull-up/Row/Dip + Monostructural
  Day 3 — Snatch + OHP/Push Press + Monostructural (different from Day 2)
  Day 4 — Random + Flex B + Mixed-Modal Metcon

═══════════════════════════════════════════
MESO ROTATION — SQUAT AND OHP VARIANTS
═══════════════════════════════════════════

The caller tells you which Squat and OHP variants to use this meso.
Follow those exactly. The variant holds ALL 4 weeks of the meso — load
climbs week-to-week but the exercise does NOT change.

Squat (Day 1 strength_a):
  Odd mesos: Back Squat
  Even mesos: Front Squat

OHP (Day 3 strength_a):
  Odd mesos: Strict Press
  Even mesos: Push Press

Day 2 B (Pull-up / Row / Dip) and Day 4 B (Flex) can VARY week-to-week
within a meso — pick from the allowed pool to keep variety. Never
substitute a machine for Pull-up or Dip. Lat pulldown is NOT a pull-up
substitute; dip machine is NOT a dip substitute. Those bodyweight lifts
stay as primary foundational movements. Variations within family allowed
(weighted pull-up, chin-up, L-sit pull-up, ring dip, weighted dip, etc.).

═══════════════════════════════════════════
OLYMPIC LIFT SELECTION
═══════════════════════════════════════════

Day 1 Oly (Clean & Jerk day):
  Default: full Clean & Jerk (Power Clean + Split/Push Jerk, or Squat Clean
  + Jerk). Occasionally (~1 in 4 weeks) swap to CLEAN-ONLY work
  (Power Clean, Squat Clean, Clean Complex, Pause Clean). NEVER Jerk-only
  on Day 1 — standalone jerk work lives on Day 4 as a "Random" flavor.

Day 3 Oly (Snatch day):
  Rotate variations across weeks: Power Snatch, Squat Snatch, Hang Power
  Snatch, Hang Squat Snatch, Block Snatch, Snatch Complex (e.g. Snatch +
  OHS + Snatch Balance), Pause Snatch. Pick based on meso state and logs.

Both Oly blocks: blockType "olympic", format "build_to_max". Include
climbScheme (e.g. "3-3-2-2-1-1") and timeCapMinutes (10-15 min, not longer).

═══════════════════════════════════════════
PROGRESSION — 4-WEEK LINEAR BUILD
═══════════════════════════════════════════

Strength (B) and Accessories (C) climb across the meso:
  Week 1: RIR 3 — baseline, comfortable, establish the pattern.
  Week 2: RIR 2 — add weight or a rep, slightly harder.
  Week 3: RIR 1 — push hard, close to failure on the last set.
  Week 4: PEAK — either a top heavy single/double OR a push-to-failure set.

Reference recentLogs:
  - Hit top of rep range at low RIR last week → "increase load" in coachCue.
  - Missed reps or RIR was high → "hold load, focus on quality".
  - No logs → start conservatively.
  No exact weight prescriptions — intent cues only.

Skill (A) does NOT progress. Each session is technique work; pick
variations appropriate to current athlete state.

═══════════════════════════════════════════
DAY TEMPLATES — STRICT
═══════════════════════════════════════════

SESSION BUDGET: 60-75 minutes including warmup.

─── DAY 1 — Clean & Jerk + Squat + Metcon ───
  Block 1 (olympic): Clean & Jerk work (occasionally Clean-only).
  Block 2 (strength_a): Squat — the meso's locked variant. Format sets_reps.
  Block 3 (accessory): 2× quad/glute/ham accessories. Straight sets, 60-90s rest.
  METCON: Mixed-modal (populated). NO separate conditioning block.
  Total blocks: 3. Metcon field populated.

─── DAY 2 — Gymnastics + Pulling Foundational + Mono ───
  Block 1 (gymnastics): Skill DONE FRESH — T2B / HSPU / Pull-up /
    Muscle-up progression / Handstand Walk / Wall Walk. 10-12 min.
    Always include scaledOption.
  Block 2 (strength_b): Pull-up, Dip, or Barbell Row family. No machine subs
    for Pull-up or Dip — those remain the primary bodyweight lifts.
    Variation within family allowed (weighted, chin-up, ring dip, pendlay
    row, chest-supported row, seal row). Format sets_reps.
  Block 3 (accessory): 2× accessories matching Block 2's muscle group.
  Block 4 (conditioning): Mono — intervals OR sprints OR distance. Must
    DIFFER from Day 3's mono this week. Format intervals or steady_state.
  METCON: null.
  Total blocks: 4.

─── DAY 3 — Snatch + OHP + Mono ───
  Block 1 (olympic): Snatch work.
  Block 2 (strength_a): OHP — the meso's locked variant (Strict Press or
    Push Press). Format sets_reps.
  Block 3 (accessory): 2× shoulder/tricep/upper-back accessories.
  Block 4 (conditioning): Mono — must DIFFER from Day 2's mono this week.
    If Day 2 was intervals, Day 3 is sprints or distance. Etc.
  METCON: null.
  Total blocks: 4.

─── DAY 4 — Random + Flex B + Metcon ───
  Block 1 (depends on Random flavor): Rotate flavor across weeks from this pool:
    (a) EXTRA CONDITIONING — a mono piece that DIFFERS from Day 2's and
        Day 3's mono that week. Format conditioning (intervals or steady_state).
    (b) SECOND GYMNASTICS — a DIFFERENT gymnastics skill from Day 2's that
        week. Format gymnastics (skill_time). Include scaledOption.
    (c) CF SKILLS — Double Unders, Rope Climbs, Handstand Walks, Wall
        Walks, Pistols, etc. ONE focus per session. Format gymnastics
        (skill_time).
    (d) JERK-SPECIFIC — Split Jerk, Push Jerk, Jerk from Blocks, Jerk
        Recovery, Jerk Dip drills. Format olympic (build_to_max).

  Block 2 (strength_b): Flex B — rotate weekly within the meso. Valid pool:
    Deadlift family (Conventional, Sumo, Romanian, Deficit, Trap Bar),
    Weighted Pull-up / Chin-up (if Day 2 was not Pull-up this week),
    Weighted Dip (if Day 2 was not Dip this week),
    Barbell Row / Pendlay Row (if Day 2 was not Row this week).
    BENCH / DB Press generally does NOT fit — see ADJACENCY.
    Format sets_reps.

  Block 3 (accessory): 2× accessories matching Block 2's muscle group.

  METCON: Mixed-modal (populated).
  Total blocks: 3. Metcon field populated.

═══════════════════════════════════════════
METCON LENGTH ROTATION (Days 1 and 4)
═══════════════════════════════════════════

Each week, the two metcons have DIFFERENT lengths. One short (4-12 min),
one medium-long (12-20 min). Doesn't matter which day gets which — rotate
across weeks for variance. Use recentMetcons history to pick a different
length pattern than last week.

═══════════════════════════════════════════
ADJACENCY RULES
═══════════════════════════════════════════

Training week: Day 1 → 2 → 3 → 4. Back-to-back pairs are (1,2) and (3,4).
(2,3) has a rest day between.

  - Squat on Day 1 + Deadlift on Day 2 is back-to-back — AVOID. Deadlift
    belongs on Day 4 (4 days from Day 1 squat).
  - OHP/Push Press on Day 3 + Bench Press on Day 4 is back-to-back — AVOID.
    Bench rarely fits this program; that's OK, it doesn't need to appear.

═══════════════════════════════════════════
NO-REPEAT RULES — CRITICAL
═══════════════════════════════════════════

Within a SINGLE day:
  - No two blocks may prescribe the same movement or movement family.
  - If Day 4 B is Conventional Deadlift, accessories may NOT be RDL, Sumo
    DL, or any other deadlift variant. Accessories are hamstring curls,
    good mornings, hip thrust, back extensions, etc.
  - Accessory block NEVER repeats the primary movement family.

Within a SINGLE week:
  - Squat appears ONCE (Day 1).
  - OHP/Push Press appears ONCE (Day 3).
  - If Day 2 B was Pull-up, don't make Day 4 B a Pull-up that week.
  - If Day 2 B was Dip, don't make Day 4 B a Dip that week.
  - If Day 2 B was Row, don't make Day 4 B a Row that week.

═══════════════════════════════════════════
MONO CONDITIONING (Days 2 and 3 only)
═══════════════════════════════════════════

Monostructural — single modality, Z2-Z5 effort. Three flavors; the two
mono days (Day 2 and Day 3) in a given week MUST be different flavors.

  INTERVALS: 6-10 × 30s-2 min @ 85-95% / full rest, OR 4-6 × 3-5 min @
    80-85% / 2-3 min rest.
  SPRINTS: 6-10 × 100-400m run / 10-30 cal row or bike @ 90%+ / full rest.
  DISTANCE: Steady Z2. Row ≤5k, Run ≤5k, Bike ≤20 min, Ski Erg ≤3k.
    NEVER longer than 5k or 20 min, whichever comes first.

Machines: Row, Bike, Run, Ski Erg. Rotate across weeks.
Include intervalScheme (or distance spec), machine, effortCue.

═══════════════════════════════════════════
MIXED-MODAL METCON (Days 1 and 4 only)
═══════════════════════════════════════════

Classic CrossFit metcons — TWO OR MORE modalities mixed.
Formats: for_time, amrap, emom, for_time_with_cap.

Movement pool: Oly variants at LIGHT load, DB snatches/cleans/thrusters,
KB swings, wall balls, box jumps, burpees, row/bike/ski cal work, DUs (when
ready), gymnastics scaled (ring rows, knee raises, pike push-ups, etc.).

HARD METCON MOVEMENT CONSTRAINTS:
  - MUST NOT include the day's strength_a pattern at load. Day 1 squatted
    heavy → metcon MUST NOT include heavy squats. Box step-ups, wall balls,
    light DB front squats are fine.
  - MUST NOT include the day's gymnastics skill just practiced (Day 4 if
    Random = gymnastics). Pick a different gymnastics movement or an
    easier scaled variant.
  - Day 1 metcon can include: Oly light, box work, DBs, KBs, burpees,
    wall balls, mono (row/bike).
  - Day 4 metcon can include: same pool, plus gymnastics skills NOT
    practiced in Day 4's Block 1 that day.

Gymnastics scaling — Zeus is rusty, always provide scaledOption:
  - Pull-ups → Ring rows or banded pull-ups
  - T2B → Hanging knee raise or sit-ups
  - HSPU → Pike push-up or DB push press
  - Muscle-ups → C2B pull-up or jumping muscle-up
  - Double unders → Singles (3:1 ratio) or short DU attempts

Write description as a whiteboard:
  "AMRAP 12\\n5 Power Cleans (135 lb)\\n10 Box Jumps (24\\" box)\\n15 Cal Row"

═══════════════════════════════════════════
ACCESSORY DESIGN
═══════════════════════════════════════════

Format: accessory_circuit (legacy enum — treat as accessory WORK, not a
circuit). Prescribe 2 movements. Allow 3 ONLY if all are bodyweight or
require no equipment contention.

EXECUTION:
  - DEFAULT is STRAIGHT SETS (all sets of movement 1, then movement 2).
  - Supersets allowed ONLY with different equipment not in high demand.
  - Rest 60-90s between sets. Bodybuilding tempo, not conditioning.
  - Write rest guidance in the "note" field of each exercise.
  - NEVER a 3-machine rotation. Zeus trains at a busy 24 Hour Fitness.

Rep range: 8-12 reps (hypertrophy). Match B's muscle group or pattern.

Day 1 Squat accessories (quad/glute/ham pool):
  Leg extensions, Bulgarian split squat, walking lunges, leg press,
  GHD back extension, Nordic curls, hip thrust, goblet squats, step-ups,
  FFE split squat, Zercher squat, leg curls, good mornings, KB swings.

Day 2 Pull-up B accessories (lats/biceps/rear delts):
  Single-arm DB row, seated cable row, lat pulldown (as ACCESSORY only —
  never as Pull-up substitute), T-bar row, chest-supported row, face pull,
  barbell curl, hammer curl, preacher curl, reverse flye, shrug.

Day 2 Dip B accessories (triceps/pecs/front delts):
  Tricep pushdown, overhead triceps extension, close-grip bench, skull
  crushers, cable kickback, pec deck, cable flye, diamond push-ups.

Day 2 Row B accessories (upper back/rear delts/biceps):
  Single-arm DB row, T-bar row, chest-supported row, seal row, face pull,
  reverse flye, shrug, hammer curl, barbell curl.

Day 3 OHP accessories (shoulders/triceps):
  Lateral raise, rear delt flye, face pull, seated DB press, Arnold press,
  landmine press, Z-press, tricep pushdown, overhead triceps extension,
  upright row.

Day 4 Deadlift accessories (hamstrings/glutes/lower back):
  RDLs, hamstring curls, good mornings, hip thrust, KB swings, 45° back
  extension, reverse hyper, single-leg RDL, stiff-leg DL.

Day 4 Weighted Pull-up / Dip / Row accessories: see Day 2 pools above.

═══════════════════════════════════════════
OUTPUT RULES
═══════════════════════════════════════════

- dayName: specific and honest. MAX 6 words. (e.g. "Clean & Jerk + Squat",
  "Gymnastics + Pulling", "Snatch + Press", "Random + Deadlift")
- sessionIntent: ONE sentence. MAX 25 words. No prose.
- coachNote: 2-3 short sentences. MAX 60 words TOTAL. No essays.

HARD OUTPUT LENGTH CAPS — CRITICAL:
  - coachCue: ONE short sentence, MAX 20 words.
  - notes: MAX 15 words. Usually null.
  - skillFocus: ONE sentence, MAX 25 words.
  - scaledOption: Short phrase, MAX 15 words (e.g. "Hanging knee raise").
  - progressionNote: ONE sentence, MAX 20 words.
  - effortCue: Short phrase, MAX 15 words.
  - accessoryExercises[].note: MAX 10 words. Usually the rest interval.

DO NOT write paragraphs. DO NOT repeat yourself. Athlete reads this on a
phone between sets — respect the real estate.

FIELD REQUIREMENTS:
- blocks: follow the day template exactly. Do not add or skip blocks.
- metcon: populated for Days 1 and 4. null for Days 2 and 3.
- strength_a and strength_b blocks use format sets_reps. MUST include
  sets, repsMin, repsMax. Never omit — UI renders "undefined" if you skip.
  If rep target is a single number (e.g. 5), set repsMin = repsMax = 5.
- Gymnastics blocks MUST include scaledOption.
- Olympic blocks use format build_to_max. Include climbScheme and
  timeCapMinutes (cap 15 min).
- Conditioning blocks use format intervals or steady_state. Include
  intervalScheme, machine, effortCue.
- Accessory blocks use format accessory_circuit. Include accessoryExercises
  array (2 items; 3 only if all bodyweight). Rest 60-90s in notes.`,
          prompt,
          schema: ZeusDaySchema,
        })
        day = result.object
        // Backfill defaults if Flash skipped required sets_reps fields.
        // Schema has them optional to avoid 500s, but the UI renders "—" —
        // prefer sane defaults over blanks so the athlete isn't guessing.
        const d = day as {
          blocks?: Array<{
            blockType?: string
            format?: string
            sets?: number
            repsMin?: number
            repsMax?: number
            coachCue?: string
            notes?: string
          }>
          coachNote?: string
        }
        for (const b of d.blocks ?? []) {
          if (
            (b.blockType === 'strength_a' || b.blockType === 'strength_b') &&
            b.format === 'sets_reps'
          ) {
            if (b.sets == null) b.sets = 4
            if (b.repsMin == null && b.repsMax == null) {
              b.repsMin = 5
              b.repsMax = 8
            } else if (b.repsMin == null) {
              b.repsMin = b.repsMax
            } else if (b.repsMax == null) {
              b.repsMax = b.repsMin
            }
          }
          // Truncate runaway cue/notes — hard stop at 200 chars for cue,
          // 120 for notes. Flash occasionally ignores the length caps.
          if (b.coachCue && b.coachCue.length > 200) {
            b.coachCue = b.coachCue.slice(0, 197).trimEnd() + '…'
          }
          if (b.notes && b.notes.length > 120) {
            b.notes = b.notes.slice(0, 117).trimEnd() + '…'
          }
        }
        if (d.coachNote && d.coachNote.length > 400) {
          d.coachNote = d.coachNote.slice(0, 397).trimEnd() + '…'
        }
        // Dedupe check — detect Flash programming the same movement in
        // multiple blocks. If found, retry (attempt 0) or flag (attempt 1).
        const dTyped = day as { blocks?: Array<{ name?: string }> }
        const movementFamily = (name: string): string => {
          const n = name.toLowerCase()
          if (n.includes('deadlift') || n.includes('rdl') || n.includes('good morning')) return 'deadlift'
          if (n.includes('squat') && !n.includes('overhead')) return 'squat'
          if (n.includes('bench') || n.includes('push press') || n.includes('strict press') || n.includes('overhead press')) return 'press'
          if (n.includes('row') || n.includes('pull-up') || n.includes('chin-up') || n.includes('pulldown')) return 'pull'
          if (n.includes('clean') && !n.includes('deadlift') && !n.includes('pull')) return 'clean'
          if (n.includes('snatch') && !n.includes('deadlift') && !n.includes('pull')) return 'snatch'
          return n
        }
        const families = (dTyped.blocks ?? [])
          .map(b => b.name ? movementFamily(b.name) : '')
          .filter(f => f && f !== 'unknown')
        const seen = new Set<string>()
        let hasDupe = false
        for (const f of families) {
          if (seen.has(f)) { hasDupe = true; break }
          seen.add(f)
        }
        if (hasDupe && attempt === 0) {
          console.warn(
            'Zeus generation attempt 1 produced duplicate movement families — retrying:',
            families.join(', '),
          )
          continue
        } else if (hasDupe) {
          console.error(
            'Zeus generation retry STILL has duplicate movement families — shipping anyway:',
            families.join(', '),
          )
        }
        break
      } catch (err) {
        const e = err as { name?: string; message?: string }
        console.error(
          `Zeus generation attempt ${attempt + 1} failed:`,
          e?.name,
          e?.message,
        )
        if (attempt === 1) throw err
      }
    }

    return NextResponse.json({ day })

  } catch (error) {
    // Surface the actual error so we can diagnose Flash schema flakes
    const err = error as { name?: string; message?: string; cause?: unknown }
    const detail = {
      name: err?.name ?? 'Error',
      message: err?.message ?? String(error),
      cause: err?.cause ? String(err.cause) : undefined,
    }
    console.error('Zeus Generate Error:', JSON.stringify(detail))
    return NextResponse.json(
      { error: 'Failed to generate Zeus session. Try again.', detail },
      { status: 500 },
    )
  }
}
