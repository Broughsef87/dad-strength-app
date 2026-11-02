// ── Lights on the classic lifts (FOR-337) ───────────────────────────────────
// Executes src/lib/programs/lights.ts and runs computeAdjustments against a
// fake db: which lifts get lights, what each pattern of lights does to next
// week, and when the deload question is asked. Its own file, so a revert of
// the feature cannot take the check with it.
import { usesLights, lightsDelta, shouldAskDeload, MISS_STEP_DOWN, CLEAN_STEP_UP } from '../../src/lib/programs/lights.ts'
import { computeAdjustments, MAX_ADJ } from '../../src/lib/programs/autoreg.ts'
import { platformDad } from '../../src/lib/programs/platformDad.ts'
import { RUN_EPOCH } from '../../src/lib/programs/run.ts'

let checks = 0
const fails = []
const eq = (a, b, msg) => { checks++; if (JSON.stringify(a) !== JSON.stringify(b)) fails.push(`${msg}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`) }

// Which lifts.
eq(usesLights('pd_snatch', 'Snatch', 'snatch'), true, 'snatch gets lights')
eq(usesLights('pd_cj', 'Clean + 2 Jerks', 'clean_jerk'), true, 'clean + jerks gets lights')
eq(usesLights('pd_snatch_tech', 'Hang Snatch, Above Knee', 'snatch'), true, 'hang snatch gets lights')
eq(usesLights('pd_jerk', 'Jerk from Rack', 'clean_jerk'), true, 'jerk gets lights')
eq(usesLights('pd_snatch_heavy', 'Snatch — Heavy Single', 'snatch'), true, 'heavy climb gets lights')
eq(usesLights('pd_snatch_pull', 'Snatch Pull', 'snatch'), false, 'a pull keeps RPE')
eq(usesLights('push_press', 'Push Press', 'clean_jerk'), false, 'a press keeps RPE')
eq(usesLights('sn_back', 'Overhead Squat', 'snatch'), false, 'a squat keeps RPE')
eq(usesLights('pd_back_squat', 'Back Squat', 'back_squat'), false, 'a squat max keeps RPE')
eq(usesLights('x', 'Snatch', undefined), false, 'no max, no lights')

// What each pattern does, with the table climbing 2% this week.
eq(lightsDelta([], 2), 0, 'nothing rated: as written')
eq(lightsDelta([2, 3, 2, 2], 2), 0, 'good lifts: as written')
eq(lightsDelta([3, 3, 3], 2), CLEAN_STEP_UP, 'all clean: small step up')
eq(lightsDelta([3, 2, 1], 2), -2, 'one barely: hold')
eq(lightsDelta([3, 2, 0], 2), -2, 'one miss: hold')
eq(lightsDelta([0, 2, 0], 2), -2 - MISS_STEP_DOWN, 'two misses: hold and a step down')
eq(lightsDelta([3, 0], 0), 0, 'one miss on a flat week: nothing to cancel')
eq(lightsDelta([3, 0], -5), 0, 'one miss on a meso boundary drop: nothing to cancel')
eq(lightsDelta([0, 0, 0], 0), -MISS_STEP_DOWN, 'three misses on a flat week: a step down')

// The deload question: most recent session first.
eq(shouldAskDeload([]), false, 'no sessions: no question')
eq(shouldAskDeload([3]), true, 'three misses in one session asks')
eq(shouldAskDeload([2, 0, 0]), false, 'two misses in one session alone does not')
eq(shouldAskDeload([1, 0, 1]), true, 'misses in 2 of the last 3 sessions asks')
eq(shouldAskDeload([1, 0, 0, 1]), false, 'a miss four sessions back does not count')
eq(shouldAskDeload([0, 0, 0]), false, 'clean sessions: no question')

// Autoreg end to end on Platform Dad. Week 3 reads week 2's logs.
const MAXES = { snatch: 215, clean_jerk: 265, back_squat: 435, front_squat: 335, ohp: 180 }
const db = (logs) => ({
  from: () => {
    const o = {
      select: () => o, eq: () => o, gte: () => o, order: () => o,
      limit: () => Promise.resolve({ data: [{ id: 'w', workout_data: { adjustments: {} } }] }),
      not: () => Promise.resolve({ data: logs }),
    }
    return o
  },
})
let day = null
for (let d = 1; d <= 7 && day == null; d++) {
  if (platformDad.buildDay(2, d, MAXES).items.some((i) => i.slot === 'pd_snatch')) day = d
}
eq(day != null, true, 'Platform Dad has a snatch day')
const shownAt = (wk) => platformDad.buildDay(wk, day, MAXES).items.find((i) => i.slot === 'pd_snatch')
const wk2 = shownAt(2), wk3 = shownAt(3)
const step = wk3.percent - wk2.percent
eq(step > 0, true, 'the table climbs into week 3')
const sets = (lights, extra = {}) => lights.map((l, i) => ({ slot: 'pd_snatch', rpe: null, lights: l, weight_lbs: wk2.targetWeightLbs, set_number: i + 1, ...extra }))
const run = async (logs) => (await computeAdjustments(db(logs), 'u', platformDad, 3, day, RUN_EPOCH, MAXES)).pd_snatch ?? 0
eq(await run(sets([2, 2, 3, 2])), 0, 'good lifts: week 3 as written')
eq(await run(sets([2, 1, 2, 2])), -step, 'one barely: week 3 holds week 2')
eq(await run(sets([2, 0, 2, 2])), -step, 'one miss: week 3 holds week 2')
eq(await run(sets([0, 2, 0, 2])), -step - MISS_STEP_DOWN, 'two misses: week 3 a step under week 2')
eq(await run(sets([3, 3, 3, 3])), CLEAN_STEP_UP, 'all clean: small step up')
// Lights replace RPE: an RPE of 10 on a lit set is ignored.
eq(await run(sets([2, 2, 2, 2], { rpe: 10 })), 0, 'RPE on a lit set does not move it')
// A week logged before lights existed keeps its RPE signal.
const rpeOnly = await run(sets([null, null, null, null], { rpe: 10 }))
eq(rpeOnly < 0, true, 'an old RPE-only week still counts')
const bound = await run(sets([0, 0, 0, 0]))
eq(Math.abs(bound) <= MAX_ADJ, true, 'bounded by MAX_ADJ')
// The squat on the same day is untouched by lights.
const sq = (await computeAdjustments(db([{ slot: 'pd_back_squat', rpe: null, lights: 0, weight_lbs: null, set_number: 1 }]), 'u', platformDad, 3, day, RUN_EPOCH, MAXES)).pd_back_squat ?? 0
eq(sq, 0, 'a stray light on a squat does nothing')

if (fails.length) {
  console.error(`lights: ${fails.length} of ${checks} failed`)
  for (const f of fails) console.error('  ' + f)
  process.exit(1)
}
console.log(`lights: ${checks} checks pass`)
