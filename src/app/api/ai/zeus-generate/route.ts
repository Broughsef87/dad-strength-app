import { NextResponse } from 'next/server'
import { groq } from '@ai-sdk/groq'
import { generateObject } from 'ai'
import { z } from 'zod'
import { createClient } from '../../../../utils/supabase/server'
import { checkRateLimit } from '../../../../lib/rateLimit'

export const dynamic = 'force-dynamic'
// Groq responses are sub-second typical. 60s is plenty of headroom for a
// retry. (Gemini previously needed 120s due to thinking-mode latency and
// preview-model rate queuing — those are no longer in the picture.)
export const maxDuration = 60

// ── Zod schemas ───────────────────────────────────────────────────────────────

// NOTE: All "not-always-present" fields are .nullable() rather than .optional().
// Groq's strict structured-output mode requires every property to appear in
// `required`; the nullable-not-optional shape satisfies that while letting
// the model return `null` for fields that don't apply to the current block.

const ZeusBlockSchema = z.object({
  blockType: z.enum(['strength_a', 'strength_b', 'olympic', 'gymnastics', 'conditioning', 'accessory']),
  name: z.string().describe('Exercise name, e.g. "Back Squat", "Hang Power Clean + Push Jerk", "Toes-to-Bar"'),
  format: z.enum(['sets_reps', 'build_to_max', 'skill_time', 'intervals', 'steady_state', 'accessory_circuit']),

  // sets_reps
  sets: z.number().nullable(),
  repsMin: z.number().nullable(),
  repsMax: z.number().nullable(),
  targetRir: z.number().nullable().describe('0-3 reps in reserve. Only for strength_a and strength_b blocks.'),
  variation: z.string().nullable().describe('Movement variation: "Paused", "Box", "Tempo 3-1-0", "Deficit", "Pin", "Banded", etc.'),

  // build_to_max (oly)
  climbScheme: z.string().nullable().describe('Rep scheme to build to heavy. Use "3-2-2-1-1" for a heavy single, "3-3-2-2-2" for a heavy double. NEVER start with a set of 5+ reps.'),
  timeCapMinutes: z.number().nullable(),

  // skill_time (gymnastics)
  durationMinutes: z.number().nullable(),
  skillFocus: z.string().nullable().describe('Specific focus, e.g. "T2B kip timing — hip-to-bar lat engagement, 5-7 per set"'),
  scaledOption: z.string().nullable().describe('Conservative scale for rusty athlete: e.g. "Hanging knee raise" or "Box pike push-up"'),
  progressionNote: z.string().nullable().describe('What this develops toward in future weeks'),

  // intervals / conditioning
  intervalScheme: z.string().nullable().describe('e.g. "6×3 min @85% / 2 min rest" or "8×200m / 60s rest"'),
  machine: z.string().nullable().describe('"Row", "Bike", "Run", "Free Runner"'),
  effortCue: z.string().nullable().describe('Pacing cue, e.g. "Uncomfortable but controlled — stay aerobic"'),

  // accessory_circuit
  accessoryExercises: z.array(z.object({
    name: z.string(),
    sets: z.number(),
    repsMin: z.number(),
    repsMax: z.number(),
    note: z.string().nullable(),
  })).nullable(),

  coachCue: z.string().nullable().describe('One technical or mental cue for this block'),
  notes: z.string().nullable(),
})

const ZeusMetconSchema = z.object({
  name: z.string().nullable(),
  format: z.enum(['for_time', 'amrap', 'emom', 'for_time_with_cap']),
  timeDomain: z.enum(['short', 'medium', 'long']).describe('short <10min, medium 10-20min, long 20-30min'),
  timeCapMinutes: z.number().nullable(),
  description: z.string().describe('Whiteboard-style prescription. E.g. "AMRAP 12\\n5 Power Cleans (185/135 lb)\\n10 Box Jumps (24/20)\\n15 Cal Row"'),
  movements: z.array(z.object({
    name: z.string(),
    reps: z.number().nullable(),
    calories: z.number().nullable(),
    distance: z.string().nullable(),
    weightRx: z.string().nullable().describe('e.g. "185/135 lb", "bodyweight"'),
    scaledOption: z.string().nullable(),
  })),
  rounds: z.number().nullable(),
  coachNote: z.string().nullable(),
}).nullable()

// Schema only asks AI for content it must generate — server fills in
// weekNumber, mesoNumber, weekInMeso, dayNumber after the fact. Saves
// output tokens and generation latency.
const ZeusDaySchema = z.object({
  dayName: z.string().describe('Short name, MAX 6 words. e.g. "Clean & Jerk + Squat"'),
  sessionIntent: z.string().describe('ONE sentence, MAX 25 words.'),
  blocks: z.array(ZeusBlockSchema),
  metcon: ZeusMetconSchema,
  coachNote: z.string().describe('2-3 short sentences, MAX 60 words total.'),
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

    // Pre-compute structural choices so the AI only picks exercise variations
    // and writes the prose — no wasted time deliberating over structure.
    const MONO_ROTATION = [
      { d2: 'intervals', d3: 'distance' },
      { d2: 'sprints', d3: 'intervals' },
      { d2: 'distance', d3: 'sprints' },
      { d2: 'intervals', d3: 'distance' },
    ]
    const mono = MONO_ROTATION[(weekInMeso - 1) % 4]

    // Metcon length alternates each week: one short (4-12), one long (12-20)
    const day1MetconLen = weekNumber % 2 === 1 ? '4-10 min' : '12-18 min'
    const day4MetconLen = weekNumber % 2 === 1 ? '12-18 min' : '4-10 min'

    // Day 4 "random" flavor rotates through 4 options across the meso
    const RANDOM_ROTATION = [
      'EXTRA CONDITIONING — a mono piece DIFFERENT from Day 2 and Day 3 that week',
      'SECOND GYMNASTICS — pick a skill DIFFERENT from Day 2\'s skill that week',
      'CF SKILLS — one of: Double Unders, Rope Climbs, Handstand Walks, Wall Walks, Pistols',
      'JERK-SPECIFIC — Split Jerk, Push Jerk, Jerk from Blocks, Jerk Recovery, Jerk Dip drills',
    ]
    const randomFlavor = RANDOM_ROTATION[(weekInMeso - 1) % 4]

    // Day 2 B rotates: Pull-up → Row → Dip → Pull-up
    const DAY2_B_ROTATION = ['Pull-up', 'Barbell Row', 'Dip', 'Pull-up']
    const day2B = DAY2_B_ROTATION[(weekInMeso - 1) % 4]

    // Day 4 B: odd weeks Deadlift variant, even weeks a pulling/pressing lift
    // that's different from Day 2's B that week
    const day4B = weekInMeso % 2 === 1
      ? 'Deadlift variant (Conventional, Sumo, Romanian, Deficit, Trap Bar)'
      : day2B === 'Pull-up'
        ? 'Weighted Dip or Barbell Row variant'
        : day2B === 'Dip'
          ? 'Weighted Pull-up/Chin-up or Barbell Row variant'
          : 'Weighted Pull-up/Chin-up or Weighted Dip'

    // Per-day structural briefing — only what THIS day needs
    const dayBrief = dayNumber === 1
      ? `DAY 1 — Clean & Jerk + ${squatVariant} + Mixed-Modal Metcon
Blocks (in order):
  1. olympic: Clean & Jerk work (build_to_max, 10-15 min cap). Occasionally Clean-only (~1 in 4 weeks).
  2. strength_a: ${squatVariant}, sets_reps. MUST include sets, repsMin, repsMax. Target RIR for week ${weekInMeso} (see progression).
  3. accessory: 2× quad/glute/ham accessories, straight sets, 60-90s rest.
metcon: POPULATED. Mixed-modal, ${day1MetconLen}. Do NOT include heavy squats.
Total blocks: 3.`
      : dayNumber === 2
      ? `DAY 2 — Gymnastics + ${day2B} + ${mono.d2} Mono
Blocks (in order):
  1. gymnastics: Skill DONE FRESH — T2B / HSPU / Pull-up / Muscle-up progression. 10-12 min. Include scaledOption.
  2. strength_b: ${day2B} family, sets_reps. NO machine subs (lat pulldown is not a pull-up; dip machine is not a dip). Variations allowed (weighted, chin-up, ring dip, pendlay row, chest-supported row, seal row). MUST include sets, repsMin, repsMax.
  3. accessory: 2× matching Block 2's muscle group.
  4. conditioning: ${mono.d2} (Row, Bike, Run, or Ski). Include intervalScheme, machine, effortCue.
metcon: null.
Total blocks: 4.`
      : dayNumber === 3
      ? `DAY 3 — Snatch + ${ohpVariant} + ${mono.d3} Mono
Blocks (in order):
  1. olympic: Snatch work (Power, Squat, Hang, Block, Complex). build_to_max, 10-15 min cap.
  2. strength_a: ${ohpVariant}, sets_reps. MUST include sets, repsMin, repsMax.
  3. accessory: 2× shoulder/tricep/upper-back accessories.
  4. conditioning: ${mono.d3} (Row, Bike, Run, or Ski). Include intervalScheme, machine, effortCue.
metcon: null.
Total blocks: 4.`
      : `DAY 4 — Random + Flex B + Mixed-Modal Metcon
Blocks (in order):
  1. Random flavor THIS WEEK: ${randomFlavor}.
     Format depends on flavor: conditioning (intervals/steady_state), gymnastics (skill_time + scaledOption), or olympic (build_to_max).
  2. strength_b: ${day4B}. sets_reps. MUST include sets, repsMin, repsMax.
  3. accessory: 2× matching Block 2's muscle group (hinge accessories if DL, upper if pull/push).
metcon: POPULATED. Mixed-modal, ${day4MetconLen}. Avoid repeating Block 2's pattern at load.
Total blocks: 3.`

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
GENERATE ZEUS DAY ${dayNumber} OF WEEK ${weekNumber}
(Meso ${mesoNumber}, week ${weekInMeso} of 4 in meso, meso is ${mesoParity})

${dayBrief}

${olympicContext}

${strengthContext}

${metconContext}

PROGRESSION for this week (${weekInMeso} of 4):
  ${weekInMeso === 1 ? 'Week 1 — RIR 3 baseline, establish the pattern.' : ''}${weekInMeso === 2 ? 'Week 2 — RIR 2, add a small amount of load or a rep.' : ''}${weekInMeso === 3 ? 'Week 3 — RIR 1, push hard, close to failure on last set.' : ''}${weekInMeso === 4 ? 'Week 4 — PEAK. Top heavy single/double OR a push-to-failure set on the last set.' : ''}
`.trim()

    // Groq model strategy:
    //   Attempt 1: openai/gpt-oss-120b — OpenAI's open-weights model, known
    //              for strict JSON schema compliance. Ideal for generateObject.
    //   Attempt 2: llama-3.3-70b-versatile — fast fallback if OSS is having
    //              a bad day. Less reliable on JSON schemas but still usable.
    const MODELS = ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile'] as const
    const startTime = Date.now()
    let day: unknown
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt === 1 && Date.now() - startTime > 40_000) {
        throw new Error('Generation exceeded retry budget — skipping retry to avoid 504')
      }
      try {
        const result = await generateObject({
          model: groq(MODELS[attempt]),
          // Strict mode ON: the Zod schema was rewritten to use .nullable()
          // on all non-required fields (rather than .optional()), which
          // Groq's strict JSON-schema compilation accepts. This guarantees
          // the model's output matches the schema before we even validate.
          providerOptions: {
            groq: { structuredOutputs: true },
          },
          system: `You are an elite CrossFit programmer writing a single-day session for Zeus, an accomplished weightlifter rebuilding CrossFit skills at a busy 24 Hour Fitness. Output a JSON object matching the schema; use null for fields that don't apply to the current block (e.g. sets/repsMin on an olympic block).

ATHLETE CONTEXT
- Strong barbell foundation: squats, deadlifts, Olympic lifts are home turf.
- Rusty at gymnastics (7-8 years away). ALWAYS scale gymnastics: T2B → knee raises; HSPU → pike push-ups; muscle-ups only after T2B and strict pull-ups solid; DUs rebuilding from singles.
- Cardio engine rebuilding — short-to-medium efforts preferred.
- Equipment: full commercial gym. Barbell, DBs, machines, rower, bike, runner, ski erg, rings, rig, GHD. No sled.

PROGRESSION TARGETS
- W1 RIR 3 baseline  W2 RIR 2  W3 RIR 1  W4 peak (top single/double or push-to-failure)
- No weight prescriptions — use coachCue for intent. If recentLogs show athlete hit top of rep range at low RIR, coachCue says "increase load". If missed reps, "hold load, focus on quality".

NO-REPEAT RULE (CRITICAL)
- Within a single day, no block may repeat another block's movement family.
- If strength_b is Conventional Deadlift, accessories may NOT be any DL variant (RDL, Sumo, Deficit). Accessories are hamstring curls, good mornings, hip thrusts, back extensions.
- Accessory block NEVER repeats the primary movement's family.

HARD LENGTH CAPS (phones, not essays)
- dayName ≤ 6 words. sessionIntent ≤ 25 words. coachNote ≤ 60 words total.
- coachCue ≤ 20 words. notes ≤ 15 words. skillFocus ≤ 25 words.
- scaledOption ≤ 15 words. progressionNote ≤ 20 words. effortCue ≤ 15 words.
- accessoryExercises[].note ≤ 10 words (usually the rest interval).
NEVER write paragraphs. NEVER repeat yourself.

ACCESSORY RULES
- accessory_circuit format. Prescribe 2 movements (3 ONLY if all bodyweight).
- STRAIGHT SETS by default (all sets of #1, then all sets of #2). Never a 3-machine rotation.
- Rep range 8-12. Rest 60-90s, in the note field.
- Match B's muscle group/pattern:
  Squat day: leg extensions, Bulgarian split squat, walking lunges, leg press, GHD back ext, Nordic curls, hip thrust, step-ups, FFE split squat, leg curls, good mornings, KB swings.
  Pull-up day: single-arm DB row, seated cable row, lat pulldown (as ACCESSORY, not Pull-up sub), T-bar row, chest-supported row, face pull, barbell curl, hammer curl, reverse flye.
  Dip day: tricep pushdown, overhead tri ext, close-grip bench, skull crushers, cable kickback, pec deck, cable flye, diamond push-ups.
  Row day: single-arm DB row, T-bar row, seal row, face pull, reverse flye, shrug, hammer curl, barbell curl.
  OHP day: lateral raise, rear delt flye, face pull, seated DB press, Arnold press, landmine press, Z-press, tricep pushdown, overhead tri ext.
  Deadlift day: RDLs, hamstring curls, good mornings, hip thrust, KB swings, 45° back ext, reverse hyper, single-leg RDL, stiff-leg DL.

OLYMPIC BLOCKS
- format build_to_max. Include climbScheme and timeCapMinutes (10-15, not longer).
- climbScheme HARD RULE: NEVER start the climb with a set of 5+ reps. Use EXACTLY "3-2-2-1-1" when building to a heavy SINGLE, or EXACTLY "3-3-2-2-2" when building to a heavy DOUBLE. No 5-3-1-1, no 5-5-3-1, no variations starting with 5.
- Day 1 C&J: default full C&J. Occasionally Clean-only (~1 in 4 weeks). NEVER Jerk-only on Day 1.
- Day 3 Snatch: rotate variations (Power, Squat, Hang, Block, Complex, Pause).

METCON RULES (Days 1 and 4 only)
- Mixed-modal: TWO or more modalities. Formats: for_time, amrap, emom, for_time_with_cap.
- MUST NOT include that day's strength_a pattern at load (Day 1 squat → no heavy squats in the metcon; box step-ups, wall balls, light DB work fine).
- MUST NOT include that day's gymnastics skill at load (Day 4 if Random = gymnastics).
- Pool: Oly at LIGHT load, DBs, KBs, wall balls, box jumps, burpees, mono pieces, scaled gymnastics.
- Always provide scaledOption on any gymnastics movement.
- Write description whiteboard-style: "AMRAP 12\\n5 Power Cleans (135 lb)\\n10 Box Jumps (24\\" box)\\n15 Cal Row"

MONO CONDITIONING (Days 2 and 3)
- Monostructural, single modality. Flavors specified in the per-day brief.
- Intervals: 6-10 × 30s-2min @ 85-95% / full rest, or 4-6 × 3-5min @ 80-85% / 2-3min rest.
- Sprints: 6-10 × 100-400m or 10-30 cal bike/row @ 90%+ / full rest.
- Distance: steady Z2, Row ≤5k, Run ≤5k, Bike ≤20min, Ski ≤3k. NEVER longer.
- Include intervalScheme (or distance spec), machine, effortCue.

FIELD REQUIREMENTS
- strength_a/strength_b: format sets_reps. MUST include sets, repsMin, repsMax. If a single rep target, set repsMin = repsMax.
- gymnastics blocks: MUST include scaledOption.
- metcon: populated for Days 1 and 4; null for Days 2 and 3.`,
          prompt,
          schema: ZeusDaySchema,
        })
        // Inject server-determined fields that the AI schema no longer
        // includes — saves output tokens, keeps the shape the UI expects.
        day = {
          ...result.object,
          weekNumber,
          mesoNumber,
          weekInMeso,
          dayNumber,
        }
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
            skillFocus?: string
            scaledOption?: string
            progressionNote?: string
            effortCue?: string
          }>
          coachNote?: string
        }

        // Sanitize AI-generated text:
        //   1. Strip label prefixes like "PROGRESSIONNOTE:", "NOTES:" etc.
        //      that Flash sometimes prepends when it decides to concatenate
        //      multiple fields into one string.
        //   2. Aggressive truncation — ~100-char caps, not 200-400. Anything
        //      longer than one sentence is too long for the mobile UI.
        const LABEL_PREFIX_RE = /^(?:\s*(?:PROGRESSION\s*NOTE|COACH\s*(?:CUE|NOTE)|SKILL\s*FOCUS|SCALED\s*OPTION|EFFORT\s*CUE|NOTES?)\s*:\s*)+/i
        const INLINE_LABEL_RE = /\s*(?:PROGRESSION\s*NOTE|COACH\s*(?:CUE|NOTE)|SKILL\s*FOCUS|SCALED\s*OPTION|EFFORT\s*CUE|NOTES?)\s*:\s*/gi
        const clean = (s: string | undefined, cap: number): string | undefined => {
          if (!s) return s
          let out = s.replace(LABEL_PREFIX_RE, '').trim()
          // Second pass: strip label tokens that appear mid-string (Flash
          // concatenates multiple fields with "NOTES: ... PROGRESSIONNOTE: ...").
          // Keep the first segment only.
          const firstLabelIdx = out.search(INLINE_LABEL_RE)
          if (firstLabelIdx > 0) out = out.slice(0, firstLabelIdx).trim()
          if (out.length > cap) out = out.slice(0, cap - 1).trimEnd() + '…'
          return out
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
          b.coachCue = clean(b.coachCue, 120)
          b.notes = clean(b.notes, 80)
          b.skillFocus = clean(b.skillFocus, 140)
          b.scaledOption = clean(b.scaledOption, 100)
          b.progressionNote = clean(b.progressionNote, 120)
          b.effortCue = clean(b.effortCue, 100)
        }
        d.coachNote = clean(d.coachNote, 250)
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
        const e = err as {
          name?: string
          message?: string
          statusCode?: number
          responseBody?: string
          url?: string
          cause?: unknown
          text?: string        // NoObjectGeneratedError carries the raw model output here
        }
        console.error(
          `Zeus generation attempt ${attempt + 1} failed:`,
          JSON.stringify({
            name: e?.name,
            message: e?.message,
            statusCode: e?.statusCode,
            url: e?.url,
            responseBody: e?.responseBody?.slice(0, 800),
            // On AI_NoObjectGeneratedError, `text` is the model's raw output
            // that failed schema validation. Essential for diagnosing "the
            // model returned JSON that doesn't match the schema" failures.
            rawText: e?.text?.slice(0, 2000),
            cause: e?.cause ? String(e.cause).slice(0, 400) : undefined,
          }),
        )
        if (attempt === 1) throw err
      }
    }

    return NextResponse.json({ day })

  } catch (error) {
    // Surface the actual error so we can diagnose auth / rate-limit / schema issues.
    // AI_APICallError from @ai-sdk/google carries statusCode + responseBody which
    // is the only thing that tells us 401 vs 403 vs 429 vs 500.
    const err = error as {
      name?: string
      message?: string
      statusCode?: number
      responseBody?: string
      url?: string
      cause?: unknown
    }
    const detail = {
      name: err?.name ?? 'Error',
      message: err?.message ?? String(error),
      statusCode: err?.statusCode,
      url: err?.url,
      responseBody: err?.responseBody?.slice(0, 800),
      cause: err?.cause ? String(err.cause).slice(0, 400) : undefined,
    }
    console.error('Zeus Generate Error:', JSON.stringify(detail))
    return NextResponse.json(
      { error: 'Failed to generate Zeus session. Try again.', detail },
      { status: 500 },
    )
  }
}
