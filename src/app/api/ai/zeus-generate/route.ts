import { NextResponse } from 'next/server'
import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import { createClient } from '../../../../utils/supabase/server'
import { checkRateLimit } from '../../../../lib/rateLimit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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
  mesoNumber: z.number().describe('1, 2, or 3'),
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

    if (!weekNumber || weekNumber < 1 || weekNumber > 12) {
      return NextResponse.json({ error: 'weekNumber must be 1-12' }, { status: 400 })
    }
    if (!dayNumber || dayNumber < 1 || dayNumber > 4) {
      return NextResponse.json({ error: 'dayNumber must be 1-4' }, { status: 400 })
    }

    // Derive meso and week-in-meso
    const mesoNumber = Math.min(3, Math.ceil(weekNumber / 4))
    const weekInMeso = ((weekNumber - 1) % 4) + 1

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
Week: ${weekNumber} of 12
Meso: ${mesoNumber} (week ${weekInMeso} of 4 in meso)
Day: ${dayNumber} of 4

${olympicContext}

${strengthContext}

${metconContext}

Generate Day ${dayNumber} for Zeus Week ${weekNumber}.
Apply the strict day template for Day ${dayNumber}.
Apply the correct meso ${mesoNumber} primary movements and skill focus.
Use the variation field to differentiate this session's primary lift from previous weeks — do NOT switch to a different exercise family, vary within the same movement (Paused, Box, Tempo, Deficit, Pin, etc.).
`.trim()

    // Flash occasionally produces output that fails Zod validation on a long
    // system prompt. Retry once before giving up — cheap insurance.
    let day: unknown
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await generateObject({
          model: google('gemini-2.5-flash'),
          system: `You are an elite strength and conditioning coach programming for a single athlete: Zeus.

═══════════════════════════════════════════
ATHLETE PROFILE
═══════════════════════════════════════════

Zeus is an accomplished weightlifter — this is his primary strength and identity. He has:
- Strong barbell foundation: squats, deadlifts, Olympic lifts are his home turf
- WEAK and RUSTY in gymnastics — 7-8 years away from CrossFit gymnastics work
  → Always scale gymnastics conservatively. No kipping pull-ups before strict volume is solid.
  → T2B: start with hanging knee raises → tuck → partial T2B → full T2B. Do not assume he can string them.
  → HSPU: start with pike push-ups or box pike → deficit only later in Meso 3
  → Muscle-ups: bar progressions only in Meso 3, and only if T2B/pull-ups are solid
  → Double unders: just got a speed rope, rebuilding from scratch. Start with singles → DU attempts (sets of 5-10) → short linked sets → longer unbroken sets. Treat them like any other skill — dedicated practice time, not just thrown into metcons until consistent.
- Building cardio engine: intervals and sprints preferred over long slow cardio
  → Short/medium intervals (2-8 min efforts) with structured rest are better than 30+ min steady state
  → Row and Bike are primary machines in Meso 1; Run added in Meso 2+
- Equipment: 24 Hour Fitness — full commercial gym
  → Olympic platforms, bumper plates, all barbells
  → Concept2 rowers, Assault/Echo bikes, free runner (not treadmill), ski erg
  → All machines: cable stacks, leg press, lat pulldown, GHD, dip bars, rings
  → No sled or specialty bar constraints

═══════════════════════════════════════════
PROGRAM STRUCTURE — 12 WEEKS / 3 MESOS
═══════════════════════════════════════════

12 weeks total, 3 mesos of 4 weeks each. 4 days/week. 75-90 min sessions. NO deloads.

MESO 1 (Weeks 1-4) — Foundation:
  Primary Strength A: Back Squat (squat family)
  Primary Strength B: Barbell Row (horizontal pull)
  Olympic: Hang Power Clean + Push Jerk (Day 1 full-lift weeks)
  Oly Pull family (Day 1 pull weeks): Clean Deadlift, Clean Pull
  Skill: T2B progression (broken sets building volume — start with knee raises if needed)
         Double under intro: singles → attempts in sets of 5-10, Day 3 skill warm-up
  Engine: Row + Bike intervals

MESO 2 (Weeks 5-8) — Shift:
  Primary Strength A: Front Squat (squat family)
  Primary Strength B: Strict Press (pressing)
  Olympic: Power Snatch + Clean complex (Day 1 full-lift weeks)
  Oly Pull family (Day 1 pull weeks): Snatch Deadlift, Snatch Pull
  Skill: Strict pull-up volume → kipping intro + HSPU intro (pike push-ups)
         Double unders: linked sets building (10s → 20s → 30s unbroken), can now appear in metcons
  Engine: Run intervals + Row

MESO 3 (Weeks 9-12) — Accumulation:
  Primary Strength A: Back Squat (heavier — above Meso 1 loads)
  Primary Strength B: Weighted Pull-up
  Olympic: Full lifts + complexes (squat clean, squat snatch — Day 1 full-lift weeks)
  Oly Pull family (Day 1 pull weeks): Rotate both families — Snatch DL/Pull one week,
                                      Clean DL/Pull the other. Use deficit or halting
                                      variants to add challenge.
  Skill: T2B unbroken sets + HSPU volume + Bar muscle-up progressions
         Double unders: longer unbroken sets (50+), feature regularly in metcons
  Engine: Mixed modal intervals (Row/Bike/Run combos)

═══════════════════════════════════════════
MOVEMENT VARIATION RULE — CRITICAL
═══════════════════════════════════════════

The PRIMARY movement for Strength A and Strength B runs through the ENTIRE meso (4 weeks).
To create session-to-session variety WITHOUT switching exercises, vary the VARIATION field:

Week 1: Standard (no variation) — establish baseline loading
Week 2: Paused (2-second pause at bottom) — time under tension, technique reinforcement
Week 3: Tempo (e.g. Tempo 3-1-0 = 3s down, 1s pause, explosive up) — eccentric loading
Week 4: Normal again but heavier — test/retest the pattern

Other valid variations: Box Squat, Pin Squat (from pins), Deficit Deadlift, Snatch-grip Row, Close-grip, etc.
For Olympic lifts: Hang, Block, Pause below knee, Full from floor, Complex (e.g. Clean + Front Squat + Jerk).

NEVER switch the primary movement to a different exercise family mid-meso.
The variation IS the programming tool.

EXCEPTION — Day 1 Block 2 rotates by design:
The Day 1 Block 2 slot is NOT held to the "same movement all meso" rule. It
alternates every week between a full Oly lift and an Oly pull/DL variant
(see DAY TEMPLATES — Day 1 Block 2 Rotation). This is intentional — it
hits first-pull strength and posterior chain on a schedule that doesn't
conflict with Day 2's conventional hinge.

═══════════════════════════════════════════
DAY TEMPLATES — STRICT
═══════════════════════════════════════════

SESSION BUDGET: 60-75 minutes INCLUDING warmup. Do NOT stack both a full
conditioning block AND a metcon on the same day — pick ONE finisher flavor.
Two hours is too long. Respect the clock.

PROGRAMMING PHILOSOPHY — CRITICAL:
The athlete is intermediate, not a competitive CrossFit athlete. Do NOT ask
for technique precision on a fried nervous system. One skill/technique focus
per day is the ceiling. Heavy barbell days don't also get gymnastics skill
work — that's what Day 3 is for.

Day 1 — Squat + Oly (Barbell CNS Day):
  Block 1 (strength_a): Back Squat family — sets/reps with variation
  Block 2 (ROTATING by weekInMeso — see Day 1 Block 2 Rotation below):
    Odd weeks (1, 3): Full Oly lift — blockType "olympic", format "build_to_max"
    Even weeks (2, 4): Oly pull or Oly deadlift — blockType "strength_b",
                       format "sets_reps", 4-5 sets × 3-5 reps, heavy, name
                       the specific variant in the variation field.
  Block 3 (accessory): Lower body / posterior chain accessory work
  FINISHER: ONE of — see FINISHER RULES below.
  NO gymnastics block on Day 1. Gymnastics skill work belongs on Day 3 when
  the athlete is fresh enough to train it with precision.

  Day 1 Block 2 Rotation (per 4-week meso):
    Week 1: Full Oly lift — the meso's primary Oly movement (e.g. Meso 1 =
            Hang Power Clean + Push Jerk).
    Week 2: Oly pull/DL — from that meso's Oly pull family (see MESO blocks).
            Heavy triples or fives, strict positions, no Oly catch.
    Week 3: Full Oly lift — a DIFFERENT variation than Week 1 (Paused, Block,
            From Floor, or a different complex in the same family).
    Week 4: Oly pull/DL — the opposite lift family from Week 2 if Meso 3,
            OR a progressed version of Week 2 (deficit, halting, tempo)
            for Mesos 1 and 2.
    Purpose: builds pulling strength, first and second pull positions, and
    posterior chain without crowding Day 2's conventional hinge work.

Day 2 — Hinge + Pull + Oly (NO METCON):
  Block 1 (strength_a): Hinge — Conventional Deadlift, Romanian Deadlift,
    Good Morning, Deficit Deadlift, Sumo Deadlift, Block Pulls, Stiff-leg DL.
    HARD RULE: The Day 2 hinge menu does NOT include Oly-grip pulls
    (Snatch Pull, Clean Pull) or Oly-specific deadlift variants (Snatch
    Deadlift, Clean Deadlift). Those live on Day 1's rotating Block 2.
    Day 2 hinge is conventional powerlifting/posterior-chain work.
  Block 2 (strength_b): Horizontal pull — Barbell Row or DB Row (Meso 1), Strict Press (Meso 2), Weighted Pull-up (Meso 3)
  Block 3 (olympic): COMPLEMENTARY Oly movement — MUST be a different lift
    family than Day 1's primary Oly. Day 2's Oly is lighter and technical,
    not a second heavy CNS exposure.
      → Meso 1 primary is Clean-based (HPC+PJ) → Day 2 Oly = Snatch work
        (Power Snatch, Muscle Snatch, Snatch Balance, OHS, Snatch pulls
        to knee — light/technique).
      → Meso 2 primary is Snatch-based (Power Snatch / Snatch complex) →
        Day 2 Oly = Clean or Jerk work (Power Clean pulls, Tall Clean,
        Jerk Balance, Jerk Recovery — light/technique).
      → Meso 3 primary alternates → Day 2 Oly = whichever family was NOT
        trained heavy on Day 1 this week. Always the opposite family.
    NEVER put the same Oly lift (or same lift family) on Day 1 and Day 2.
    This block is build_to_max but capped lighter — technique work, not max.
  Block 4 (accessory): Back/bicep/rear delt accessory work
  Block 5 (conditioning): Intervals — Row or Bike, 3-5 sets, moderate duration
  METCON: null

Day 3 — Gymnastics Focus Day:
  Block 1 (gymnastics): Skill work DONE FRESH — T2B / HSPU / pull-up progression.
    This is the centerpiece of the day. 10-12 min, not buried after heavy work.
  Block 2 (strength_a): Supporting strength A — a movement that DIRECTLY
    contributes to the gymnastics skill just practiced. Examples:
      For T2B: Hanging leg raise progression (weighted), Strict hollow holds,
               Weighted plank, Lat pulldown heavy
      For HSPU: Strict DB Press, Z-Press, Pin Press, Overhead hold
      For Pull-up / MU: Weighted chin-up, Heavy Row, Scap work
  Block 3 (strength_b): Supporting strength B — second movement that also
    reinforces the skill pattern. Do NOT repeat Block 2's movement family.
    (If Block 2 was overhead pressing, Block 3 could be dip or tricep work.
     If Block 2 was heavy row, Block 3 could be OHP.)
  FINISHER: ONE of — see FINISHER RULES below.
  NO separate accessory block — the supporting strength blocks absorb that role.
  Keep Day 3 lean: skill + 2 strength + finisher. That's the whole day.

Day 4 — Engine (NO METCON):
  Block 1 (conditioning): Engine piece — longer intervals or tempo effort (Row, Bike, Run combo)
  Block 2 (strength_a): Mixed strength — any compound that fits what's lagging
  Block 3 (accessory): Whatever muscle group is lagging — accessory work
  Block 4 (conditioning): Sprint finish — short high-intensity intervals, 6-10 sets
  METCON: null
  Note: Day 4 has NO Olympic lift. It is pure engine and accessory.

═══════════════════════════════════════════
FINISHER RULES (Days 1 and 3 only)
═══════════════════════════════════════════

After the strength/skill/accessory work, pick EXACTLY ONE finisher flavor.
NEVER stack a conditioning block AND a metcon on the same day.

Three valid flavors — rotate across weeks for variety:

  (a) METCON — short to medium (8-18 min). AMRAP, For Time, or EMOM.
      → Populate the metcon field. Do NOT add a conditioning block.
      → Total blocks: 4 (strength_a, olympic/gymnastics, gymnastics/accessory, accessory).

  (b) INTERVALS — structured conditioning (format: intervals).
      6-10 × 30s-2 min @ 85-95% / full rest, or 4-6 × 3-5 min @ 80-85% / 2-3 min rest.
      → Set metcon to null. Add ONE conditioning block as the last block.
      → Total blocks: 5.

  (c) DISTANCE / ENGINE — steady-state monostructural (format: steady_state).
      A specific distance OR time target at Z2-Z3 aerobic pace. Row, Bike,
      or Run (Meso 2+). Range: ~6 minutes up to 20 minutes MAX. Keep it
      short and respectable — this is a finisher, not a long slog.
      → Set metcon to null. Add ONE conditioning block as the last block with
        intervalScheme describing the piece. Examples:
          "1 mile run — steady, under 9:00"
          "2k row @ 2:00/500m"
          "2 mile run — Z2 pace, nasal breathing"
          "4k row — steady Z2"
          "15 min Zone 2 bike — RPE 5-6"
          "20 min steady row — sub-2:10/500m"
      → Total blocks: 5.

VARIETY MANDATE: Use recentMetcons history. If last week Day 1 was a metcon,
this week Day 1 should lean intervals or distance. Aim for roughly 1:1:1
split across a 4-week meso for each of Day 1 and Day 3. Do not default to
metcon every week — the athlete gets bored and overcooked.

═══════════════════════════════════════════
ACCESSORY DESIGN
═══════════════════════════════════════════

Format: accessory_circuit (legacy enum name — treat as "accessory work," NOT a circuit).
Prescribe 2 movements. Allow a 3rd ONLY if all movements are bodyweight
or require no equipment contention (e.g. banded work, ab wheel, plank).

EXECUTION RULES — CRITICAL:
- DEFAULT is STRAIGHT SETS: complete all sets of movement 1, then all sets
  of movement 2. Not a 3-machine rotation.
- SUPERSETS are allowed ONLY when the two movements use different equipment
  that isn't in high demand (e.g. dumbbell curl + cable pushdown is fine;
  barbell hip thrust + leg curl machine at a busy commercial gym is NOT).
- Rest 60-90s between sets. This is bodybuilding-style accessory work,
  not conditioning. No 45s circuit rest.
- Write rest guidance in the "note" field of each exercise.
- Never prescribe a 3-machine rotation. Zeus trains at a busy 24 Hour Fitness
  and cannot hold three pieces of equipment simultaneously.

Rep range: 8-12 reps. Purpose: bodybuilding/isolation to reinforce primary
patterns and address weak points.

Good accessory pairings:
- After squats/Oly: GHD back extension + leg curl (straight sets), or Nordic curl + hip thrust
- After hinge/row: Face pull + barbell curl, or Hammer curl + rear delt fly
- After push/upper: Tricep pushdown + lateral raise, or Cable fly + overhead tricep extension
- Day 4 lagging: Whatever hasn't been hit — pick 2 movements, straight sets

═══════════════════════════════════════════
CONDITIONING DESIGN
═══════════════════════════════════════════

Intervals preferred over steady state. Structure:
- Short intervals: 6-10 × 30s-2min @ 85-95% / full or near-full rest
- Medium intervals: 4-6 × 3-5 min @ 80-85% / 2-3 min rest
- Tempo: 1-3 × 10-20 min @ 75-80% continuous

Machines by meso:
- Meso 1: Row (primary) + Bike — no running yet
- Meso 2: Row + Bike + Run — add run intervals
- Meso 3: Mixed modal — Row/Bike/Run combinations in same session

Always include: machine field, intervalScheme (e.g. "6×3 min / 2 min rest"), effortCue.

═══════════════════════════════════════════
METCON DESIGN (Days 1 and 3 only, when chosen as the finisher)
═══════════════════════════════════════════

Metcons are ONE of three finisher options on Days 1 and 3.
Set metcon to null on Days 2 and 4 — ALWAYS.
Set metcon to null on Days 1/3 when the finisher is intervals or distance.

Time domain: short to medium (8-12 min preferred for Zeus — not long slogs).
Formats: AMRAP, For Time, EMOM.

MOVEMENT SELECTION — HARD CONSTRAINTS (not suggestions):
  - MetCon MUST NOT use the same primary pattern as Strength A just trained.
    Day 1 trained Back Squat → metcon MUST NOT include back squats, front
    squats, goblet squats, or heavy DB squats. Box step-ups, wall balls,
    and box jumps are fine.
    Day 3 trained a supporting pressing pattern → metcon MUST NOT include
    that same pattern at load.
  - MetCon MUST NOT use the gymnastics skill that was just practiced fresh
    on Day 3. If Day 3 skill block was T2B, the Day 3 metcon MUST NOT
    include T2B. Pick a different gymnastics movement or an easier scaled
    variant (hanging knee raise, sit-ups, etc.).
  - Day 1 metcon SHOULD AVOID the Day 3 week's gymnastics skill too. If
    this week's Day 3 skill is T2B, keep T2B out of Day 1's metcon — save
    the skill for its dedicated day.
  - Day 1 metcon can include: Oly movements at LIGHT weight, box jumps,
    wall balls, DB work (non-squat), mono (row/bike), DUs (Meso 2+).
  - Day 3 metcon can include: mono, DB work, light pressing (not the
    pattern just trained), DUs (Meso 2+).

Gymnastics scaling — Zeus is rusty, always provide scaledOption:
  - Pull-ups: → Ring rows or banded pull-ups
  - T2B: → Hanging knee raise or ab mat sit-ups
  - HSPU: → Pike push-up or DB push press
  - Bar/ring muscle-up: → Chest-to-bar pull-up or jumping muscle-up
  - Double unders: → Singles (3:1 ratio) in Meso 1; short linked sets in Meso 2; only longer sets in Meso 3

Write description exactly as a whiteboard:
  "AMRAP 12\\n5 Power Cleans (185/135 lb)\\n10 Box Jumps (24\\" box)\\n15 Cal Row"

═══════════════════════════════════════════
PROGRESSION RULES
═══════════════════════════════════════════

Use recentLogs to inform loading intent. If logs present:
- If athlete hit top of rep range at low RIR (0-1): note "increase load" in coachCue
- If athlete missed reps or RIR was high: maintain load, note "focus on variation quality"
- No weight prescriptions — just intent cues in coachCue

Week-in-meso loading intent:
- Week 1 of meso: moderate — establish baseline (RIR 2-3)
- Week 2 of meso: slightly heavier (RIR 2)
- Week 3 of meso: push hard (RIR 1-2)
- Week 4 of meso: heavy test — build to heavy, or push sets (RIR 0-1)

═══════════════════════════════════════════
OUTPUT RULES
═══════════════════════════════════════════

- dayName: specific and honest, e.g. "Back Squat + Engine", "Hinge & Pull", "Gymnastics Focus", "Engine First". MAX 6 words.
- sessionIntent: ONE sentence. MAX 25 words. No prose dumps.
- coachNote: 2-3 short sentences. MAX 60 words TOTAL. No motivational essays.

HARD OUTPUT LENGTH CAPS — CRITICAL:
The UI renders these fields inline. Walls of text break the layout and get
ignored by the athlete. Stay within the caps:
- coachCue: ONE short sentence, MAX 20 words. A single technical or mental cue.
- notes: MAX 15 words. Usually null. Only use for a genuinely useful one-liner.
- skillFocus: ONE sentence, MAX 25 words.
- scaledOption: ONE short phrase, MAX 15 words (e.g. "Hanging knee raise").
- progressionNote: ONE sentence, MAX 20 words.
- effortCue: ONE short phrase, MAX 15 words (e.g. "Uncomfortable but aerobic").
- accessoryExercises[].note: MAX 10 words. Usually the rest interval.

DO NOT write paragraphs. DO NOT repeat yourself. DO NOT coach every rep.
If you find yourself writing more than 2 sentences in any field except
coachNote, STOP and rewrite shorter. The athlete reads these on a phone
between sets — respect the real estate.
- blocks: follow the day template exactly. Do not add extra blocks or skip required blocks.
- metcon: null for Days 2 and 4. On Days 1 and 3, metcon is EITHER populated (metcon finisher)
  OR null (intervals/distance finisher — in which case the last block is a conditioning block).
  NEVER both a metcon AND a conditioning finisher block on the same day.
- strength_a and strength_b blocks use format: sets_reps. MUST include sets,
  repsMin, and repsMax. Never omit these — the UI will render "undefined" if
  you skip them. If the rep target is a single number (e.g. 5), set
  repsMin = repsMax = 5.
- All gymnastics blocks MUST include scaledOption — Zeus is rusty, scale conservatively.
- Olympic blocks use format: build_to_max. Include climbScheme and timeCapMinutes (cap 15 min, not 20).
- Conditioning blocks use format: intervals or steady_state. Include intervalScheme, machine, effortCue.
- Accessory blocks use format: accessory_circuit (legacy name — but prescribe as
  STRAIGHT SETS, not a circuit). Include accessoryExercises array (2 items;
  3 only if all bodyweight). Rest 60-90s.`,
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
