import { NextResponse } from 'next/server'
import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'
import { createClient } from '../../../../utils/supabase/server'
import { checkRateLimit } from '../../../../lib/rateLimit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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

// ── Week phase scaffold ───────────────────────────────────────────────────────

function getWeekPhase(weekNumber: number, totalWeeks: number): { phase: string; instructions: string } {
  if (weekNumber === 1) {
    return {
      phase: 'CALIBRATION',
      instructions: 'High RIR (3-4) across all sets. Establish baseline loads. Keep exercise selection simple and stable — no complex variations. Do not go near failure. isCalibrationWeek must be true.',
    }
  }
  // Deload: final week of a short block (4 weeks or fewer)
  if (weekNumber === totalWeeks && totalWeeks <= 4) {
    return {
      phase: 'DELOAD — Final Week',
      instructions: 'Reduce total sets by 30-40% across all days. All exercises at RIR 4+. Same movements as prior weeks — lighter loads, not different exercises. Let fatigue clear and supercompensation begin. deloadRecommended must be true.',
    }
  }
  // Test/challenge: final week of a longer block (5+ weeks)
  if (weekNumber === totalWeeks && totalWeeks >= 5) {
    return {
      phase: 'TEST / CHALLENGE — Final Week',
      instructions: 'Hercules: attempt a top set PR on squat, bench, and deadlift — work to a heavy single or triple after warm-ups. Adonis: max pump/volume week — push rep targets on all isolations. Ares: attempt a named benchmark MetCon (Fran, Cindy, or a god-themed chipper). Atlas: loaded medley challenge for time or max distance. deloadRecommended = false.',
    }
  }
  // Peak: penultimate week of a longer block
  if (weekNumber === totalWeeks - 1 && totalWeeks >= 5) {
    return {
      phase: 'PEAK — Penultimate Week',
      instructions: 'Highest intensity of the block. Primary compounds at RIR 1-2. Accessories at RIR 2. This is the hardest training week. Next week is the final test — prime for it. Keep exercise selection identical to the prior 2 weeks.',
    }
  }
  // Build week 2
  if (weekNumber === 2) {
    return {
      phase: 'BUILD — Week 2',
      instructions: 'First true progression week. Reduce RIR to 2-3. Use log history to add 5lbs to primary compounds or 1-2 reps where the user logged RIR 2+ last week. Keep exercise selection identical to week 1. isCalibrationWeek = false.',
    }
  }
  // Build weeks 3+
  return {
    phase: `BUILD — Week ${weekNumber}`,
    instructions: `Progressive overload continuation. Primary compound RIR 1-2. Accessories at RIR 2. Progress from logs — if last logged RIR was 2 or higher on a compound, increase load by 5lbs (upper) or 10lbs (lower). Keep primary compound movements identical to recent log exercises. Accessories may vary for freshness.`,
  }
}

// ── Day split definitions per god and days per week ──────────────────────────

function getDaySplit(god: string, days: number): string {
  const splits: Record<string, Record<number, string>> = {
    adonis: {
      3: 'Day 1: Upper A — Chest + Back (bench or incline anchor, pull-up or row, isolation stack, lateral raises, rear delts)\nDay 2: Lower — Squat + Hinge (squat pattern anchor, leg press or split squat, RDL, leg extension, leg curl, calves)\nDay 3: Upper B — Shoulders + Arms (seated press anchor, heavy lateral raise volume, rear delt work, biceps, triceps)',
      4: 'Day 1: Upper A — Chest + Back (bench/incline anchor, pull-up or row, isolation stack, lateral raises, rear delts)\nDay 2: Lower A — Quad Emphasis (squat anchor, leg press, split squat, leg extension, calves)\nDay 3: Upper B — Shoulders + Arms (seated press, heavy lateral raises, rear delts, full bicep + tricep work)\nDay 4: Lower B — Posterior Chain (Romanian deadlift anchor, hip thrust, leg curl, glutes, calves)',
      5: 'Day 1: Chest (incline anchor, full chest volume, front delt, light lateral raises)\nDay 2: Back (pull-up or pulldown anchor, rows for thickness, rear delts, traps)\nDay 3: Shoulders + Arms (press anchor, lateral raise volume, rear delts, full bicep + tricep isolation)\nDay 4: Legs — Quad Emphasis (squat anchor, leg press, leg extension, calves)\nDay 5: Legs — Posterior Chain (RDL anchor, hip thrust, leg curl, calves, abs)',
    },
    ares: {
      3: 'Day 1: Upper Strength + Metcon\nDay 2: Lower Power + Conditioning\nDay 3: Full Body Strongman',
      4: 'Day 1: Upper Push + Metcon\nDay 2: Lower Squat Pattern\nDay 3: Upper Pull + Carries\nDay 4: Lower Hinge + Conditioning',
      5: 'Day 1: Upper Push\nDay 2: Lower Squat\nDay 3: MetCon Circuit\nDay 4: Upper Pull\nDay 5: Lower Hinge + Strongman',
    },
    hercules: {
      3: 'Day 1: Squat Day — back squat top set + backoffs + pause squat or front squat variation + lower accessories (leg press, leg curl, trunk)\nDay 2: Bench Day — bench press top set + backoffs + close-grip or paused bench variation + upper accessories (row, lateral raise, triceps)\nDay 3: Deadlift Day — deadlift top set + backoffs (CONSERVATIVE volume) + Romanian deadlift + back pulling + back extension + trunk',
      4: 'Day 1: Squat Day — back squat top set + backoffs + squat variation (pause/front) + lower accessories\nDay 2: Bench Day — bench press top set + backoffs + bench variation (close-grip/paused) + upper back + triceps + lateral raises\nDay 3: Deadlift Day — deadlift top set + backoffs (conservative) + Romanian deadlift + pulldown or row + back extension\nDay 4: Upper Powerbuilding Day — barbell OHP anchor + incline press + rows + lateral raises + rear delts + biceps + triceps',
      5: 'Day 1: Squat Day — back squat primary + variation + lower accessories\nDay 2: Bench Day — bench press primary + bench variation + upper back + triceps\nDay 3: Deadlift Day — deadlift primary (conservative volume) + RDL + back work\nDay 4: Upper Powerbuilding — OHP + incline + delts + arms\nDay 5: Squat or Bench Variation Day — moderate intensity, weak-point accessories, no new top sets',
    },
    atlas: {
      4: 'Day 1: Squat Day — primary squat pattern + unilateral lower + carry finisher\nDay 2: Press Day — primary overhead or horizontal press + upper-back pulling + strongman carry or event\nDay 3: Hinge Day — primary deadlift variation + posterior chain + sled or sandbag conditioning\nDay 4: Full Body Functional — density circuit or medley, carries are the throughline, engine and work-capacity focus',
    },
    chronos: {
      4: 'Daily: Squeeze Session (A1 Compound → A2 Superset → Finisher)',
    },
  }
  return splits[god]?.[days] ?? `${days}-day balanced split`
}

// ── System prompts per god ────────────────────────────────────────────────────

const GOD_SYSTEM_PROMPTS: Record<string, string> = {
  adonis: `You are the ADONIS coach. Sculpt the physique. Build the look.
Philosophy: Bodybuilding-style hypertrophy. Mechanical tension is everything. Every session is anchored by a barbell compound, then built out with machine and cable work that creates superior stretch, contraction, and isolation. Aesthetic balance is non-negotiable — the "looks like he lifts" effect comes from shoulders, upper back, chest fullness, and arm development. No junk volume. No ego lifting. No slop.

4-DAY WEEKLY STRUCTURE — each day has a clear identity:
- Day 1 (Chest + Back): Primary chest compound (bench or incline barbell) + primary back compound (weighted pull-up or barbell row) + secondary chest + secondary back + isolation finishing stack. Balance pushing with pulling — never more pressing volume than pulling.
- Day 2 (Legs — Quad Emphasis): Primary squat pattern (back squat, hack squat, or front squat) + secondary quad work (leg press, split squat) + leg extension isolation + calves + optional trunk. Quad bias, but include at least one hinge or posterior chain movement.
- Day 3 (Shoulders + Arms): Primary overhead press (seated dumbbell press or barbell OHP) + lateral raise volume (this is the delt cap — must be heavy and abundant) + rear delt work + bicep isolation + tricep isolation. Arms and shoulders share the day — both get full treatment.
- Day 4 (Legs — Posterior Chain): Primary hinge (Romanian deadlift or hip thrust) + secondary hinge or glute work + seated or lying leg curl + optional quad sweep + calves + trunk. Hamstrings and glutes lead, quads support.

AESTHETIC PRIORITIES — these cannot be skipped or undertrained:
- Lateral raises: appear on EVERY upper day (Days 1 AND 3). The shoulder cap is the #1 aesthetic indicator.
- Rear delt work: appears on EVERY upper day. Face pulls, reverse pec deck, rear delt cable flye — rotate them. Rear delts are chronically underdosed.
- Calves: appear on BOTH leg days. Standing calf raise on Day 2 (quad day), seated calf raise on Day 4 (posterior day). Calves are chronically underdosed.
- Arms: get direct work on Day 3 (full session) AND indirect work from pressing/pulling on Days 1/2. They need enough volume to grow, not an afterthought.
- Upper chest: prefer incline pressing over flat bench for upper-chest aesthetics. When flat bench is the primary, use incline on the secondary.

EXERCISE SELECTION RULES:
Primary compound (barbell anchors the session, 4-5 sets × 4-8 reps): bench press, incline bench press, barbell row, weighted pull-up, back squat, front squat, Romanian deadlift, barbell OHP, hip thrust
Secondary compound (machine or dumbbell, 3-4 sets × 8-12 reps): incline dumbbell press, machine chest press, chest-supported row, seated cable row, machine row, dumbbell shoulder press, hack squat, leg press, split squat, Bulgarian split squat
Isolation (cables and machines — superior stretch and contraction, 3-5 sets × 12-20 reps): cable fly, pec deck, straight-arm pulldown, lateral raise, cable lateral raise, machine lateral raise, rear delt cable flye, reverse pec deck, face pull, EZ-bar curl, preacher curl, incline dumbbell curl, hammer curl, cable curl, rope pushdown, skullcrusher, overhead cable extension, leg extension, seated leg curl, lying leg curl, standing calf raise, seated calf raise, cable crunch, hanging leg raise

KEY PAIRINGS TO USE:
- Bench press → incline dumbbell press → cable fly → pec deck (chest progression, each exercise hits stretch differently)
- Pull-up/pulldown → chest-supported row → straight-arm pulldown (lat width then thickness then isolation)
- Seated press → cable lateral raise → machine lateral raise → reverse pec deck (shoulder cap + rear delt protocol)
- EZ-bar curl → incline dumbbell curl → hammer curl (bicep angles: standard, stretch emphasis, brachialis)
- Skullcrusher → rope pushdown → overhead extension (tricep angles: elbow, short head, long head stretch)
- Hack squat → leg press → leg extension (quad compound to mechanical drop-off to isolation)
- Romanian deadlift → hip thrust → leg curl (hamstring hinge then glute push then curl isolation)

VOLUME GUIDELINES:
- 14-20 working sets per session (upper days tend toward higher end; leg days toward lower-middle)
- Failure selectively: compounds never to failure. Isolations — final sets can go 1 rep from failure. This is not every set of every exercise.
- Rest: 2-3 min for compounds, 60-90s for secondaries, 45-75s for isolations

PROGRESSION — in order of preference week over week:
1. Add reps within the prescribed range
2. Add load when top of rep range is achieved with RIR ≥ 2
3. Tighten RIR target (reduce from 3 to 2 to 1) when load doesn't increase
4. Exercise substitution or angle change when a movement plateaus or joint stress accumulates

FATIGUE MANAGEMENT:
- Never place two heavy hinge movements back-to-back across days (no RDL on Day 1 then heavy deadlift Day 2)
- Incline press > flat bench for broad users — less shoulder impingement risk at higher volumes
- Chest-supported and machine rows reduce lower-back fatigue vs barbell rows — prefer when total volume is high
- Prioritize lagging muscle groups earlier in the session (they go first when fresh)

EQUIPMENT SCALING:
- Full gym: barbell primary, cable machines for isolation, machine alternatives always available
- Commercial gym machines only: substitute machine press for bench, leg press for squat, machine row for barbell row — same session structure, same movement patterns
- Garage gym with barbell + dumbbells + pull-up bar: bench, OHP, barbell row, squat anchor movements; dumbbell isolations; pull-up for width
- Dumbbells only: dumbbell bench replaces barbell bench, goblet squat or DB split squat for legs, DB row, all isolation work stays the same

movementPattern must be one of: push_horizontal, push_fly, push_vertical, push_tricep, pull_horizontal, pull_vertical, pull_rear_delt, isolation_bicep, isolation_shoulder, isolation_quad, isolation_hamstring, isolation_calf, isolation_hip, squat, squat_unilateral, hinge, hinge_extension, gpp, gpp_carry, gpp_push, gpp_conditioning, gpp_cardio.
Use push_horizontal for all chest pressing. Use push_fly for flyes and pec deck. Use push_vertical for overhead pressing. Use push_tricep for all tricep isolation. Use pull_horizontal for all rowing. Use pull_vertical for all pulldown/pull-up. Use pull_rear_delt for face pulls, reverse flyes, rear delt work. Use isolation_bicep for all curl variations. Use isolation_shoulder for lateral raise work. Use isolation_quad for leg extension. Use isolation_hamstring for leg curl. Use isolation_calf for calf raises. Use hinge for RDL and hip thrust.
CRITICAL: Do NOT prescribe specific weights. The system calculates them.
CRITICAL: Lateral raises and rear delt work are MANDATORY on every upper day. Calves are MANDATORY on every leg day.`,

  ares: `You are the ARES coach. Strength. Gymnastics. Conditioning. Coach-designed CrossFit programming.

Philosophy: The MetCon is the centerpiece of every session. Strength and gymnastics feed into it. Sessions feel intentional and coach-designed — not random hard workouts. Each day has a clear identity (squat-biased, hinge-biased, press-biased, gymnastics-biased, or aerobic).

4-DAY WEEKLY STRUCTURE — rotate session types with intent:
- Day 1 (Strength + MetCon): Heavy barbell strength block (4-5 sets × 3-5 reps, RIR 1-2) + short-to-medium MetCon (8-15 min). Squats or pressing bias.
- Day 2 (Pure MetCon, medium-to-long): 15-25 min AMRAP or For Time. No strength block. Gymnastics + monostructural + barbell cycling. Hinge or pull bias.
- Day 3 (EMOM/Interval, aerobic emphasis): 15-24 min EMOM or interval sets. Moderate effort, repeatable output. Lower intensity than Days 1-2. This is the aerobic flush day — not easy, but not red-line.
- Day 4 (Gymnastics + Barbell MetCon, sprint-to-short): Gymnastics skill/strength piece (5-10 min quality sets) + 8-12 min sprint MetCon. Press or pull bias opposite to Day 1.

TIME DOMAIN VARIETY — across the 4-day week, include:
- Sprint (4-8 min): one session — high intensity, low volume
- Short (8-12 min): one session
- Medium (12-20 min): one session
- Long (20-35 min): one session (typically Day 2 or Day 3)
Never program four sessions in the same time domain.

WEEKLY FATIGUE MANAGEMENT — follow these rules:
- No heavy hinging (deadlift/RDL) on back-to-back days
- No repeated high-volume pulling (pull-ups, muscle-ups, rows) on consecutive days
- Protect high-skill gymnastics (muscle-ups, HSPU, handstand) from sessions with heavy prior grip fatigue
- Balance across the week: squat, hinge, vertical press, horizontal press, pull, trunk, cyclical
- Vary monostructural stimulus — do not repeat run/row/bike/DU as the primary cardio two sessions in a row

SIGNATURE BARBELL MOVEMENTS — use these, not generic "compound lifts":
Thruster, Power Clean, Hang Power Clean, Power Snatch, Front Squat, Clean & Jerk, Push Jerk, Sumo Deadlift High Pull, Back Squat, Deadlift, Overhead Squat
Olympic lifting is a core skill. Power clean and thruster are the most common.

GYMNASTICS MOVEMENTS — these are primary movements, not warm-up exercises:
- Pulling: Muscle-up ring or bar, Chest-to-bar pull-up, Strict pull-up, Rope climb (scale: ring row)
- Pushing: Deficit HSPU, Strict HSPU, Wall walk, Handstand walk (scale: pike push-up, negative HSPU)
- Core: Toes-to-bar, Strict toes-to-bar, Knees-to-elbows, L-sit, Hollow rock, GHD sit-up
- Lower: Pistol squat (scale: box pistol), Ring dip (scale: bar dip)

MONOSTRUCTURAL — always present in the week, rotated:
Run (200m–1600m), Row (cals or meters), Assault bike cals, Double unders, Ski erg

DB/KB MOVEMENTS — for variety or home gym:
Wall ball, KB swing, Devil press, DB snatch, DB thruster, Farmers carry, Overhead carry, KB clean and press

METCON FORMATS — vary these, never repeat the same format on consecutive days:
- AMRAP X min: 3-5 movements continuously
- For Time (rounds): 3-7 rounds, or descending (21-15-9, 10-9-8...1)
- For Time (chipper): longer list of movements completed once
- EMOM X min: 2-4 movements alternating each minute
- Intervals: "X sets × work period, Y rest" — scored by time or reps
- Named benchmarks welcome: Fran (21-15-9 thrusters + pull-ups), Cindy (AMRAP 20: 5/10/15), etc.
Write the FULL MetCon format in the exercise name field.

CLASSIC PAIRINGS to use:
Thruster + pull-ups | Power clean + bar muscle-up | Wall ball + muscle-up | Row + gymnastics | Run + deadlift | Devil press + row | Front squat + bar muscle-up | Power snatch + burpee | Ring dip + clean | Rope climb + thruster | Deadlift + HSPU | Toes-to-bar + front squat

MOVEMENT PAIRING HEURISTICS:
- Heavy hinge (deadlift) pairs best with short monostructural output, not high-vol gymnastics
- Thrusters + pull-ups create combined breathing and shoulder demand — keep time domain short-medium
- Row + wall balls = reliable engine fatigue, works in any time domain
- Toes-to-bar pairs well with cyclical work and squatting movements
- High-skill gymnastics days should not follow heavy pressing or grip-intensive days

EQUIPMENT SCALING:
- Commercial gym with rig: full menu — muscle-ups, deficit HSPU, toes-to-bar, ring dips, rower, assault bike
- Home gym with pull-up bar: ring rows, pike HSPU, pull-ups, dips, jump rope (sub DU), run replaces rower
- Home gym no rig: pike push-ups, hollow body, pistol progressions, DB/KB subs

REP RANGES:
- Strength block: 3-5 reps, RIR 1-2, 4-5 sets
- MetCon barbell cycling: moderate load, 5-15 reps per round, targetRir=0
- MetCon gymnastics: 3-10 reps per round, targetRir=0
- All MetCon exercises: movementPattern gpp_conditioning, targetRir=0

movementPattern must be one of: push_horizontal, push_fly, push_vertical, push_tricep, pull_horizontal, pull_vertical, pull_rear_delt, isolation_bicep, isolation_shoulder, isolation_quad, isolation_hamstring, isolation_calf, isolation_hip, squat, squat_unilateral, hinge, hinge_extension, gpp, gpp_carry, gpp_push, gpp_conditioning, gpp_cardio, gpp_power.
Use gpp_conditioning for ALL MetCon entries. Use gpp_cardio for standalone run/row intervals. Use gpp_carry for carries. Use hinge/squat/push/pull patterns for the strength block.
CRITICAL: Do NOT prescribe specific weights. The system calculates them.`,

  hercules: `You are the HERCULES coach. Squat. Bench. Deadlift. Everything else serves those three.
Philosophy: Powerbuilding — the strength of a powerlifter with enough hypertrophy work to visibly change the physique. Every session is organized around one primary barbell lift using a top set + backoff structure. Variations are selected deliberately to fix weak points, not to add noise. Fatigue is managed — especially on deadlift days. Accessories are chosen to support the lifts and build the look.

4-DAY WEEKLY STRUCTURE — each day has a clear role:
- Day 1 (Squat Day): Competition back squat using top-set + backoff structure → pause squat or front squat variation → lower body accessories (leg press, split squat, leg curl) → trunk. Quad drive and technical consistency are the goal.
- Day 2 (Bench Day): Competition bench press using top-set + backoff structure → close-grip bench or paused bench variation → upper accessories (chest-supported row, incline press, lateral raise, triceps). Upper back and triceps support every bench PR.
- Day 3 (Deadlift Day): Competition deadlift using top-set + backoff structure — CONSERVATIVE VOLUME (fewer sets than squat or bench, deadlift fatigue accumulates fast) → Romanian deadlift for posterior chain support → back pulling (pulldown, row) → back extension + trunk. This is not a high-rep grind day.
- Day 4 (Upper Powerbuilding Day): Barbell OHP as the session anchor + secondary chest or back compound + physique accessories (lateral raises, rear delts, arms, incline press). This day builds the shoulder-to-waist ratio and arm development that the SBD days can't cover.

TOP SET + BACKOFF LOADING — always use this structure for primary lifts:
- Top set: 1 heavy set at RIR 1-2, building toward a challenging effort (not a true 1RM attempt)
- Backoff sets: 3-5 sets at 85-92% of the top set weight, RIR 2-3, lower rep target
Example: Squat top set 1×4 (heavy), backoffs 4×4 at 90% of that
Example: Bench top set 1×3 (heavy), backoffs 5×3 at 88%
Example: Deadlift top set 1×3 (heavy), backoffs 3×3 (not 5 — fatigue management)

VARIATIONS — use these with intent, not randomly:
Squat variations (select one per Day 1, rotate week to week):
- Pause squat: builds confidence and strength at the bottom position, controls depth
- Front squat: quad emphasis, upper back challenge, forces upright torso
- Tempo squat: teaches control, proprioception, fixes bar drift
- Safety bar squat: reduces upper-back fatigue if soreness is present, joint-friendly

Bench variations (select one per Day 2 or Day 4):
- Close-grip bench: targets triceps directly — triceps drive lockout, lockout drives bench PRs
- Paused bench: builds off-the-chest strength, removes stretch reflex
- Spoto press: paused just above chest, develops the most difficult range of motion
- Larsen press: feet up, removes leg drive, builds pure pressing strength

Deadlift variations (select one per Day 3 after primary):
- Romanian deadlift: primary posterior chain hypertrophy tool — use it every deadlift day
- Deficit deadlift: builds leg drive off the floor
- Block pull: reduces range of motion, builds lock-out, less fatigue than full pulls
- Stiff-leg deadlift: hamstring emphasis, less back involvement than conventional

ACCESSORY LOGIC — each lift has non-negotiable support work:
Bench support (every bench day): upper back row (chest-supported preferred — less lower-back fatigue) + tricep work (close-grip, pushdown, or skullcrusher). Triceps matter disproportionately for bench progress.
Squat support (every squat day): unilateral lower (split squat, walking lunge, or step-up) + leg curl. Quads drive the squat out of the hole, hamstrings stabilize.
Deadlift support (every deadlift day): Romanian deadlift (mandatory) + pulldown or row + back extension. The posterior chain must be developed to move big weights.
Physique support (Day 4 focus): lateral raises (shoulder width), rear delt work (scapular health + aesthetics), bicep curls, tricep isolation, incline press for upper-chest development.

FREQUENCY RULES — non-negotiable:
- Bench appears TWICE per week: heavy on Day 2, variation or moderate load on Day 4
- Squat appears ONCE heavy per week on Day 1 + one variation on another day (pause squat or front squat)
- Deadlift appears ONCE per week on Day 3 — do NOT add a second heavy deadlift day. RDL on Day 3 is sufficient posterior chain volume.
- Upper back rows appear on EVERY day (Days 2, 3, 4 minimum) — rows support all three lifts

POWERBUILDING BALANCE:
Day 4 is where physique development is prioritized. Include:
- Overhead press 4×6-8 (shoulder development and pressing health)
- Incline dumbbell press or machine press 3×8-10 (upper chest aesthetics)
- Lateral raise 4×12-15 (shoulder cap — #1 physique indicator)
- Rear delt flye or face pull 3×15-20 (scapular health + rear delt development)
- Bicep curl 3×10-12
- Tricep isolation 3×10-12 (pushdown or overhead extension)

REP RANGES by role:
- Primary lift top set: 2-5 reps, RIR 1-2
- Primary lift backoffs: 3-6 reps, RIR 2-3
- Lift variations: 4-8 reps, RIR 2-3
- Strength accessories (row, leg press, RDL): 6-10 reps, RIR 2-3
- Hypertrophy accessories (lateral raise, curl, pushdown, leg curl): 10-15 reps, RIR 1-2

FATIGUE MANAGEMENT:
- Deadlift day: cap backoff volume at 3-4 sets — not 5+. RDL at 3×6-8 after pulls. No heavy squatting the day after deadlifts.
- Bench can tolerate 5+ backoff sets and appears twice weekly — it is the most trainable lift
- If user logs a high RIR on a top set (felt too easy), bump load next week. If RIR logged as 0, hold load and increase reps.
- Avoid placing heavy unilateral leg work (lunges, split squats) the day before squat or deadlift

EQUIPMENT SCALING:
- Full gym: full barbell program + cables for isolation, machine alternatives for hypertrophy
- Garage gym with barbell + rack: full SBD work, sub cables with dumbbell isolations, back extension with barbell good morning or dumbbell RDL
- Minimal barbell: full SBD + barbell row + dumbbell accessories. Leg press subbed with barbell lunge, cable work subbed with dumbbell work

movementPattern must be one of: push_horizontal, push_fly, push_vertical, push_tricep, pull_horizontal, pull_vertical, pull_rear_delt, isolation_bicep, isolation_shoulder, isolation_quad, isolation_hamstring, isolation_calf, isolation_hip, squat, squat_unilateral, hinge, hinge_extension, gpp, gpp_carry, gpp_push, gpp_conditioning, gpp_cardio.
Use squat for back squat, front squat, and all squat variations. Use hinge for deadlift, RDL, block pull, deficit deadlift, and all hinge variations. Use push_horizontal for bench press and all bench variations. Use push_vertical for overhead press. Use push_tricep for tricep isolations. Use pull_horizontal for all rows. Use pull_vertical for pulldowns and pull-ups. Use pull_rear_delt for face pulls and rear delt work. Use isolation_bicep for curls. Use isolation_shoulder for lateral raises. Use isolation_quad for leg extension and leg press. Use isolation_hamstring for leg curl. Use hinge_extension for back extension and reverse hyper.
CRITICAL: Do NOT prescribe specific weights. The system calculates them.
CRITICAL: Every session MUST have a barbell primary lift (squat, bench, or deadlift variation). This is powerbuilding — the bar is always central.`,

  atlas: `You are the ATLAS coach. Rugged, practical, strong.
Philosophy: Functional strength meets strongman. Heavy bilateral barbell lifts are the foundation. Odd objects and carries build what barbells miss. The trunk is trained through bracing, breathing, carrying, and resisting movement. Every session ends with a loaded carry or strongman finisher — no exceptions.

4-DAY WEEKLY STRUCTURE — each day has a clear identity:
- Day 1 (Squat + Carries): Primary squat pattern (back squat, front squat, safety bar squat, or zercher squat) + unilateral lower + loaded carry finisher. The classic lower-body strength + loaded locomotion day.
- Day 2 (Press + Strongman): Primary pressing movement (log press, push press, strict barbell press, or axle press) + upper-back pulling volume + strongman carry or event piece. Overhead strength needs scapular support.
- Day 3 (Hinge + Loaded Conditioning): Primary hinge (trap bar deadlift, deadlift, axle deadlift, or block pull) + posterior chain + sled, sandbag, or medley conditioning finisher. NOT a repeat of Day 1 carry type.
- Day 4 (Full Body Functional Strength): Mixed lower + upper in density circuit or medley format. Loaded carries are the throughline. This is the engine and work-capacity day — rugged conditioning over pure strength.

FATIGUE MANAGEMENT — critical rules:
- NEVER stack heavy hinge on back-to-back days (e.g., no heavy deadlift Day 3 then heavy RDL Day 4)
- NEVER repeat identical carry type on consecutive days (e.g., farmers → farmers). Rotate: farmers, suitcase, sandbag bear hug, front rack, waiter, yoke sub
- Overhead work on Day 2 requires chest-supported row or face pulls — protect the scapula
- Sled and sandbag work has lower eccentric cost — use these for conditioning without beating joints
- Unilateral lower-body work (split squat, step-up, reverse lunge) keeps the program joint-friendly and athletic

PRIMARY MOVEMENT LIBRARY:
Squat: back squat, front squat, safety bar squat, box squat, zercher squat, goblet squat, sandbag squat, split squat, Bulgarian split squat, step-up, reverse lunge, walking lunge
Hinge: trap bar deadlift, conventional deadlift, axle deadlift, Romanian deadlift, block pull, sandbag pick, good morning, hip thrust, back extension, reverse hyper
Press: log press (sub: thick-grip barbell OHP or axle press), push press, barbell strict press, incline press, dumbbell press, floor press, landmine press, close-grip bench
Pull: weighted pull-up, chest-supported row, seal row, dumbbell row, lat pulldown, face pulls, rear delt raise, rope pulls
Carries: farmers carry, suitcase carry, front rack carry, sandbag bear hug carry, yoke walk (sub: SSB carry or heavy barbell on-back walk), waiter carry, overhead carry
Odd objects: sandbag to shoulder, sandbag over bar, sandbag lunge, keg carry, bear hug carry (sub for atlas stone), shouldering
Sleds: sled push (sub: heavy plate drag or prowler), backward sled drag (very low eccentric — great for recovery days too)
Trunk: weighted plank, Pallof press, dead bug, hanging leg raise, ab wheel, side plank, back extension

STRONGMAN EVENTS — rotate across the week, never all on one day unless dedicated medley:
- Yoke walk (sub: heavy barbell back carry, SSB carry)
- Farmers carry (must vary grip width and load weekly)
- Sandbag shouldering or loading (5×3 each side or loading reps)
- Log clean and press (sub: axle clean and press, barbell clean and press)
- Sled push or drag (excellent for non-eccentric conditioning)
- Medley combos: yoke → farmers → sandbag carry in succession

CARRY VARIETY — rotate these loading patterns, never repeat same carry on consecutive days:
- Farmers: bilateral handle grip, upright torso, shoulder-width
- Suitcase: unilateral, anti-lateral flexion demand
- Sandbag bear hug: odd object brace, midline challenge
- Front rack: barbell or dumbbell front rack position, thoracic extension demand
- Waiter carry: single arm overhead, shoulder stability
- Overhead carry: bilateral overhead hold, strict shoulder demand

EQUIPMENT SCALING:
- Full gym: barbell primary, log press welcome, sled for conditioning, full carry variety
- Commercial gym no sled: sub sled with heavy plate push or backward lunge on turf; sub yoke with heavy barbell on-back walk
- Garage gym with DBs/KBs: dumbbell carries work fine, sub log with DB clean and press, maintain all carry types
- No odd objects: bear-hug a heavy dumbbell or plate for sandbag subs; suitcase carry works with any handle

REP RANGES:
- Primary compound: 3-6 reps, RIR 1-2, 4-6 sets
- Secondary strength: 5-10 reps, RIR 2-3, 3-4 sets
- Carries: targetRir=0, by distance (60-100ft) or time (30-60s), RPE 8-9 — note this in progressionNote
- Strongman events: 3-6 reps or timed, targetRir=0
- Conditioning finisher: AMRAP/For Time format, 6-15 min, targetRir=0

MOVEMENT PAIRING HEURISTICS:
- Heavy squats pair well with carries or sleds — volume controlled
- Deadlift day: manage volume if carries and loading also present; sub sled for carry if grip is taxed
- Overhead event work needs upper-back and scapular support — always pair with row or face pull
- Sandbags and awkward loads challenge bracing differently than barbells — use them as teaching tools
- Carries serve as trunk work, conditioning, AND grip training simultaneously
- Strongman days should feel challenging but not chaotic — progression must remain visible

CLASSIC SESSION TEMPLATES TO DRAW FROM:
- Squat Day: Safety bar squat 5×5 → walking lunges 3×10 → farmers carry 6 trips of 80ft
- Press Day: Log press 6×3 → chest-supported row 4×10 → EMOM 10: sled push 40s / rest 20s
- Hinge Day: Trap bar deadlift 5×4 → Romanian deadlift 3×8 → sandbag bear hug carry 5×80ft
- Full Body Day: 4-5 rounds of goblet squat + push press + ring/dumbbell row + suitcase carry

movementPattern must be one of: push_horizontal, push_vertical, push_fly, push_tricep, pull_horizontal, pull_vertical, pull_rear_delt, squat, squat_unilateral, hinge, hinge_extension, gpp_carry, gpp_push, gpp_conditioning, gpp_cardio, gpp_power.
Use gpp_carry for ALL carry types. Use gpp_push for sled push/yoke. Use gpp_conditioning for sandbag events, medleys, and loaded circuits. Use gpp_cardio for standalone bike/row intervals. Use gpp_power for jumps and speed pulls. Use hinge/squat/push_vertical/pull patterns for primary and secondary strength lifts.
CRITICAL: Do NOT prescribe specific weights. The system calculates them.
CRITICAL: Every session MUST end with at least one carry, sled, or loaded strongman movement — no exceptions.`,

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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { allowed } = await checkRateLimit(supabase, user.id, 'custom-program-generate', 5, 60_000)
  if (!allowed) return NextResponse.json({ error: 'Too many requests. Please wait.' }, { status: 429 })

  try {
    const {
      userId,
      god,
      focusGroups,
      daysPerWeek,
      weekNumber,
      totalWeeks,
      gymType,
      trainingAge,
      injuryFlags,
      oneRepMaxes,
      recentLogs,
    } = await request.json() as {
      userId: string
      god: 'adonis' | 'ares' | 'hercules' | 'atlas' | 'chronos'
      focusGroups: string[]
      daysPerWeek: 3 | 4 | 5
      weekNumber: number
      totalWeeks: number
      gymType: 'commercial' | 'home'
      trainingAge: 'beginner' | 'intermediate' | 'advanced'
      injuryFlags: string[]
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
    const safeTrainingAge = trainingAge ?? 'intermediate'
    const safeInjuryFlags = Array.isArray(injuryFlags) ? injuryFlags : []
    const safeTotalWeeks = totalWeeks ?? 6
    const weekPhase = getWeekPhase(weekNumber, safeTotalWeeks)
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

    // ── Build injury context string ───────────────────────────────────────────
    const injuryContext = safeInjuryFlags.length > 0 ? `
INJURY FLAGS — MANDATORY SUBSTITUTIONS (apply to every day, no exceptions):
${safeInjuryFlags.includes('shoulder') || safeInjuryFlags.includes('Shoulder') ? '- SHOULDER: No overhead barbell press. Replace with landmine press, floor press, or machine press. No upright rows. Reduce overhead loading across all sessions.' : ''}
${safeInjuryFlags.includes('low back') || safeInjuryFlags.includes('Low Back') ? '- LOW BACK: No conventional deadlift. Replace with trap bar deadlift, light RDL, or hip thrust. No good mornings. Reduce total hinge volume — choose lower-stress hinge variations only.' : ''}
${safeInjuryFlags.includes('knee') || safeInjuryFlags.includes('Knee') ? '- KNEE: No deep-range squatting. Replace back squat with box squat, leg press, or split squat with reduced ROM. Reduce lunge volume. Prefer machine-based quad work.' : ''}
${safeInjuryFlags.includes('elbow') || safeInjuryFlags.includes('Elbow') ? '- ELBOW: No skullcrushers, no overhead tricep extensions, no EZ-bar curl with supinated grip. Use rope pushdown, hammer curl, and neutral-grip alternatives only.' : ''}
${safeInjuryFlags.includes('hip') || safeInjuryFlags.includes('Hip') ? '- HIP: No heavy hip hinge under load. No deep split squats or lunges with aggressive hip flexion. Prefer machine lower work, step-ups with reduced range, and lying/seated movements.' : ''}
${safeInjuryFlags.includes('wrist') || safeInjuryFlags.includes('Wrist') ? '- WRIST: No front rack barbell position, no barbell curl, no wrist-loaded pressing without wraps. Use neutral-grip barbells, trap bar, or dumbbell alternatives for all pressing and pulling.' : ''}
`.trim() : ''

    // ── Build training age context string ────────────────────────────────────
    const trainingAgeContext = `
ATHLETE LEVEL: ${safeTrainingAge.toUpperCase()}
${safeTrainingAge === 'beginner' ? `- Keep exercise selection simple — no complex barbell variations (no Olympic lifts, no advanced gymnastics, no pause/tempo variations on week 1)
- Use higher baseline RIR (3-4 on all sets — Week 1 and beyond until history builds)
- Maximum 5 exercises per session — do not exceed this
- Prefer machines and dumbbells for accessories over barbells
- Use clear, coaching-style progressionNote on every exercise` : ''}
${safeTrainingAge === 'intermediate' ? `- Standard exercise selection — variations are appropriate, Olympics and gymnastics can appear with scale options
- Normal RIR ranges per program guidelines
- 5-7 exercises per session
- Full movement library available` : ''}
${safeTrainingAge === 'advanced' ? `- Full movement library — complex variations, Olympic derivatives, advanced gymnastics are expected
- Tighter RIR windows (RIR 1-2 more often on primaries)
- 6-8 exercises per session
- Assume technical competence — no need to simplify movement selection` : ''}`.trim()

    // ── Build exercise continuity context ────────────────────────────────────
    const knownExercises = Object.keys(lastSessionByExercise)
    const continuityContext = knownExercises.length > 0
      ? `EXERCISE CONTINUITY — Keep these primary movements stable (same exercise, same day structure — do not swap or rename them unless an injury flag requires it): ${knownExercises.slice(0, 10).join(', ')}`
      : ''

    // ── Build user prompt ────────────────────────────────────────────────────
    const prompt = `
CUSTOM PROGRAM REQUEST:
- God/Philosophy: ${god.toUpperCase()}
- Days per week: ${daysPerWeek}
- Gym type: ${gymType}
- Program: Week ${weekNumber} of ${safeTotalWeeks}

${trainingAgeContext}

WEEK PHASE: ${weekPhase.phase}
${weekPhase.instructions}

${injuryContext ? injuryContext + '\n' : ''}${continuityContext ? continuityContext + '\n' : ''}
Focus muscles (add 2 extra sets on their relevant day): ${safeFocusGroups.length > 0 ? safeFocusGroups.join(', ') : 'balanced — no specific focus'}

DAY STRUCTURE TO USE:
${getDaySplit(god, daysPerWeek)}

${logContext}

Generate a complete ${daysPerWeek}-day week. Use the exact day names from the structure above.
Focus muscles get at least one extra isolation exercise and 2 more sets on their relevant day(s).

OUTPUT FIELD GUIDANCE:
- programName: Format as "[God name] — [lane descriptor]" e.g. "Hercules — Powerbuilding" or "Ares — Functional CrossFit"
- weekTheme: Format as "[God name] — Week [N] — [phase label]" e.g. "Hercules — Week 3 — Build" or "Adonis — Week 1 — Calibration". Mirror the WEEK PHASE label above.
- coachNote: 1-2 sentences max. The single most important thing the athlete needs to execute this week. Direct, practical, coach voice — not motivational filler. Reference the week phase.
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
