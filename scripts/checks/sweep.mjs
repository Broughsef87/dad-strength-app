// Power Dad's rules — the knees-first rebuild (FOR-358, Andrew 2026-11-23).
// Run: npx tsx scripts/checks/sweep.mjs
//
// The old sweep pinned the six-day program (three squat days, Monday broad
// jumps, Wednesday depth jumps, M2 waves). That program is gone at Andrew's
// ask; these are the rules of the one that replaced it. Every rule here is
// executed against buildDay, not read out of the source.
import { hybridPower, sprintLevel } from '../../src/lib/programs/hybridPower.ts'
// The registry wraps the raw config (modes, and the FOR-244 prep). Where an
// assertion is about the day the APP renders, it reads this.
import { PROGRAMS } from '../../src/lib/programs/index.ts'
import { blockCount, scheduledDayNumbers } from '../../src/lib/programs/schedule.ts'
import { MAX_ADJ } from '../../src/lib/programs/autoreg.ts'

const MAXES = { snatch: 220, clean_jerk: 275, back_squat: 435, front_squat: 355, bench: 255, deadlift: 435, ohp: 185 }
const app = PROGRAMS['hybrid-power']
const GYM = [1, 3, 5, 6]

let checks = 0
const fails = []
const assert = (cond, msg) => { checks++; if (!cond) fails.push(msg) }
const lifts = (plan) => plan.items.filter((i) => i.kind === 'lift')
const pctsOf = (it) => (it.setPlan?.length ? it.setPlan.map((s) => s.percent) : it.percent != null ? [it.percent] : [])

// ── 1. The week is five days: Mon, Wed, Thu, Fri, Sat ─────────────────────
assert(hybridPower.daysPerWeek === 5, `daysPerWeek is 5 — got ${hybridPower.daysPerWeek}`)
assert(JSON.stringify(hybridPower.gymDayNumbers) === JSON.stringify(GYM), `gym days are Mon/Wed/Fri/Sat — got ${hybridPower.gymDayNumbers}`)
for (let wk = 1; wk <= 26; wk++) {
  const days = scheduledDayNumbers(hybridPower, wk)
  assert(JSON.stringify(days) === '[1,3,4,5,6]', `W${wk} schedules Mon/Wed/Thu/Fri/Sat — got ${days}`)
}

// ── 2. Every day builds, deterministically, with real numbers ────────────
for (let wk = 1; wk <= 26; wk++) {
  for (let d = 1; d <= 7; d++) {
    const a = app.buildDay(wk, d, MAXES, {}, {})
    const b = app.buildDay(wk, d, MAXES, {}, {})
    assert(JSON.stringify(a) === JSON.stringify(b), `W${wk} D${d} is deterministic`)
    for (const it of lifts(a)) {
      if (it.percent != null) {
        assert(Number.isFinite(it.percent) && it.percent > 0, `W${wk} D${d} ${it.name}: percent ${it.percent}`)
        assert(Number.isFinite(it.targetWeightLbs) && it.targetWeightLbs > 0, `W${wk} D${d} ${it.name}: weight ${it.targetWeightLbs}`)
      }
      if (it.setPlan) assert(it.setPlan.length === it.sets, `W${wk} D${d} ${it.name}: ${it.sets} sets but ${it.setPlan.length} in the plan`)
    }
    if (a.dayType === 'gym') assert(blockCount(a) <= 6, `W${wk} D${d}: ${blockCount(a)} blocks, budget 6`)
  }
}

// ── 3. No jumping on the gym days; the jumps live on Thursday ───────────
// Andrew: "the heavy squatting and the plyo frequency has really torn my
// knees up." Gym days carry no plyo card and so no prep sequence either.
for (let wk = 1; wk <= 26; wk++) {
  for (const d of GYM) {
    const plan = app.buildDay(wk, d, MAXES, {}, {})
    assert(!plan.items.some((i) => i.kind === 'plyo'), `W${wk} D${d}: a jump on a gym day`)
    assert(!plan.items.some((i) => i.kind === 'prep'), `W${wk} D${d}: the jump prep on a gym day`)
  }
}

// ── 4. Movements that are out ─────────────────────────────────────────────
// No jerks, no separate pulls, no split squats or lunges, no speed squats,
// and no power snatch ("I don't really care if it's a power or not").
const OUT = /jerk|(snatch|clean)[- ](grip )?pull|split squat|bulgarian|lunge|speed box|power snatch|depth jump|trap.?bar jump/i
for (let wk = 1; wk <= 13; wk++) {
  for (const d of GYM) {
    for (const it of lifts(app.buildDay(wk, d, MAXES, {}, {}))) {
      assert(!OUT.test(it.name), `W${wk} D${d}: "${it.name}" is out of the program`)
    }
  }
}

// ── 5. One back squat day and one front squat day, both moderate ───────
// The 76% ceiling holds AFTER autoreg: eight points of easy feedback cannot
// walk a squat back into the range that hurt him.
for (let wk = 1; wk <= 11; wk++) {
  const squats = GYM.flatMap((d) => lifts(app.buildDay(wk, d, MAXES, {}, {})).filter((i) => i.maxKey === 'back_squat' || i.maxKey === 'front_squat').map((i) => ({ d, ...i })))
  assert(squats.length === 2 && squats.some((s) => s.maxKey === 'back_squat' && s.d === 1) && squats.some((s) => s.maxKey === 'front_squat' && s.d === 5),
    `W${wk}: one back squat on Monday and one front squat on Friday — got ${squats.map((s) => `D${s.d} ${s.name}`).join(', ')}`)
  for (const [d, slot] of [[1, 'back_squat_heavy'], [5, 'front_squat']]) {
    const hot = app.buildDay(wk, d, MAXES, { [slot]: MAX_ADJ }, {}).items.find((i) => i.slot === slot)
    assert(Math.max(...pctsOf(hot)) <= 76, `W${wk} ${hot.name} at +${MAX_ADJ}: ${Math.max(...pctsOf(hot))}% is over the 76% ceiling`)
    const shown = app.buildDay(wk, d, MAXES, {}, {}).items.find((i) => i.slot === slot)
    assert(Math.min(...pctsOf(shown)) >= 50, `W${wk} ${shown.name}: ${Math.min(...pctsOf(shown))}% is too light to train anything`)
  }
}

// ── 6. The classic lifts: snatch off the snatch, cleans off the clean ──
// Andrew: "those clean and snatch weights look so low that they won't truly
// provide stimulus." The floors hold even at the full −8.
for (let wk = 1; wk <= 11; wk++) {
  const sn = app.buildDay(wk, 1, MAXES, { sn_top: -MAX_ADJ }, {}).items.find((i) => i.slot === 'sn_top')
  const cl = app.buildDay(wk, 5, MAXES, { cl_top: -MAX_ADJ }, {}).items.find((i) => i.slot === 'cl_top')
  assert(sn?.maxKey === 'snatch' && /snatch/i.test(sn.name), `W${wk} Monday opens with a snatch off the snatch max — got ${sn?.name} (${sn?.maxKey})`)
  assert(cl?.maxKey === 'clean_jerk' && /clean/i.test(cl.name) && /power/i.test(cl.name), `W${wk} Friday opens with a power clean off the clean max — got ${cl?.name} (${cl?.maxKey})`)
  if (wk === 12) continue
  for (const it of [sn, cl]) {
    const n = it.name.trim().toLowerCase()
    const full = n === 'snatch' || n === 'clean'
    const want = it.reps <= 2 ? (full ? 80 : 75) : 65
    assert(Math.min(...pctsOf(it)) >= want, `W${wk} ${it.name} ${it.sets}×${it.reps} at −${MAX_ADJ}: ${Math.min(...pctsOf(it))}% under its ${want}% floor`)
  }
}

// ── 6b. Andrew's set ceiling and single floor (2026-08-27, FOR-335) ────
// Never more than 4 sets of anything; no single on a full classic lift
// below 85%, even at the full −8. Deload and test-week ramps are not working
// sets (set-ceiling.mjs makes the same exemption).
for (let wk = 1; wk <= 11; wk++) {
  for (const d of GYM) {
    for (const it of lifts(app.buildDay(wk, d, MAXES, {}, {}))) assert(it.sets <= 4, `W${wk} D${d} ${it.name}: ${it.sets} sets, ceiling 4`)
    for (const it of lifts(app.buildDay(wk, d, MAXES, { sn_top: -MAX_ADJ, cl_top: -MAX_ADJ }, {}))) {
      const n = it.name.trim().toLowerCase()
      if ((n === 'snatch' || n === 'clean') && it.maxKey) {
        const singles = (it.setPlan ?? [{ reps: it.reps, percent: it.percent }]).filter((x) => x.reps === 1)
        for (const x of singles) assert(x.percent >= 85, `W${wk} D${d} ${it.name}: a single at ${x.percent}%, floor 85`)
      }
    }
  }
}

// ── 7. Every lift varies week to week ──────────────────────────────────
// "I don't want the same exact exercises for every microcycle." In the two
// building blocks each percentage slot, and each rotating accessory, shows at
// least three different movements in its four weeks. Peak (W9-11) runs the
// base lifts on purpose: the test is the point of the block.
const FIXED = new Set(['db_incline']) // double progression: the range is the variation
for (const meso of [1, 2]) {
  for (const d of GYM) {
    const bySlot = new Map()
    for (let w = 1; w <= 4; w++) {
      for (const it of lifts(app.buildDay((meso - 1) * 4 + w, d, MAXES, {}, {}))) {
        if (!bySlot.has(it.slot)) bySlot.set(it.slot, new Set())
        bySlot.get(it.slot).add(it.name)
      }
    }
    for (const [slot, names] of bySlot) {
      if (FIXED.has(slot)) continue
      assert(names.size >= 3, `M${meso} D${d} ${slot}: only ${names.size} movement(s) in four weeks — ${[...names].join(' / ')}`)
    }
  }
}

// ── 8. A variation is the same lift to autoreg; a block is a new one ──
for (const d of GYM) {
  for (let wk = 1; wk <= 11; wk++) {
    for (const it of lifts(app.buildDay(wk, d, MAXES, {}, {})).filter((i) => i.percent != null)) {
      assert(it.family === `${it.slot}:m${Math.ceil(wk / 4)}`, `W${wk} D${d} ${it.name}: family ${it.family}`)
    }
  }
}

// ── 9. Thursday: the sprint-return ladder, by weeks of exposure ────────
// "I really want to take 6-9 months to condition my body to do it regularly."
const thu = (wk, from) => app.buildDay(wk, 4, MAXES, {}, from ? { jumpRampFromWeek: from } : {})
const LADDER = [[1, 1], [8, 1], [9, 2], [17, 2], [18, 3], [26, 3], [27, 4], [40, 4]]
for (const [wk, level] of LADDER) {
  assert(sprintLevel(wk) === level, `exposure ${wk} is level ${level} — got ${sprintLevel(wk)}`)
}
for (let wk = 1; wk <= 40; wk++) {
  const plan = thu(wk)
  const pos = ((wk - 1) % 13) + 1
  if (pos >= 12) {
    assert(plan.dayName === 'Easy Spin' && plan.items.length === 1, `W${wk} Thursday in a deload or test week is an easy spin — got ${plan.dayName}`)
    continue
  }
  const level = sprintLevel(wk)
  const plyo = plan.items.filter((i) => i.kind === 'plyo')
  const sprint = plan.items.some((i) => i.kind === 'outside' && i.slot === 'sprint')
  assert(plan.dayType === 'outside', `W${wk} Thursday is an outside day`)
  assert(plan.items.some((i) => i.slot === 'cond_engine'), `W${wk} Thursday ends with the engine`)
  if (level === 1) assert(plyo.length === 0 && !sprint, `W${wk} level 1 has no jumps and no sprinting`)
  if (level === 2) assert(plyo.length > 0 && !sprint, `W${wk} level 2 has low jumps and no sprinting`)
  if (level >= 3) assert(sprint, `W${wk} level ${level} sprints`)
  if (plyo.length || sprint) assert(plan.items.some((i) => i.kind === 'prep'), `W${wk} Thursday jumps or sprints without the prep`)
}
// The existing "restart jump ramp" control is the knee drop-back: restarting
// at week 30 puts week 30 back at level 1.
assert(!thu(30, 30).items.some((i) => i.kind === 'plyo' || i.slot === 'sprint'), 'a ramp restart at W30 drops Thursday back to level 1')
assert(thu(30).items.some((i) => i.slot === 'sprint'), 'and without it W30 is a sprint week')

// The week screen shows the ladder every week, jumps or not, so the restart
// is reachable in level 1 and the copy is the ladder's, not the old ramp's
// (Codex r1, PR #95).
assert(typeof app.rampLabel === 'function', 'Power Dad describes its own ramp, so the week screen shows the restart every week')
assert(/level 1 of 4/.test(app.rampLabel(8, 1)) && /level 2 of 4/.test(app.rampLabel(9, 1)), `the ramp copy follows the ladder — got "${app.rampLabel?.(9, 1)}"`)
assert(/level 1 of 4/.test(app.rampLabel(30, 30)), 'and a restart reads as level 1')

// ── 10. Deload week 12 and test week 13 ─────────────────────────────────
for (const d of GYM) {
  for (const it of lifts(app.buildDay(12, d, MAXES, {}, {}))) {
    assert(it.sets === 2, `W12 D${d} ${it.name}: deload is 2 sets — got ${it.sets}`)
    if (it.percent != null) assert(it.percent <= 65, `W12 D${d} ${it.name}: deload at ${it.percent}%`)
  }
}
const test = [1, 3, 5].flatMap((d) => app.buildDay(13, d, MAXES, {}, {}).items.map((i) => i.name ?? i.title))
assert(test.some((n) => /power clean.*1rm/i.test(n)), `test week tests the power clean — got ${test.join(', ')}`)
assert(test.some((n) => /bench.*1rm/i.test(n)), 'test week tests the bench')
assert(!test.some((n) => /snatch/i.test(n)), 'test week does not test the snatch')
assert(!test.some((n) => /deadlift/i.test(n)), 'test week does not test the deadlift')

// ── Report ───────────────────────────────────────────────────────────────
const line = (wk, d) => {
  const plan = hybridPower.buildDay(wk, d, MAXES)
  return `  D${d} ${plan.dayName}: ` + plan.items.map((i) => i.kind === 'lift'
    ? `${i.name}${i.percent != null ? ` ${i.sets}×${i.reps} @${i.percent}% ${i.targetWeightLbs}` : ''}`
    : (i.name ?? i.title)).join(' · ')
}
for (const wk of [1, 6, 10]) {
  console.log(`\n── Week ${wk} ──`)
  for (const d of [1, 3, 4, 5, 6]) console.log(line(wk, d))
}

console.log('\n' + '═'.repeat(60))
if (fails.length) {
  console.log(`✗ ${fails.length} FAILURES of ${checks} checks:`)
  for (const f of fails.slice(0, 40)) console.log('  -', f)
  process.exit(1)
} else {
  console.log(`✓ ALL RULES HOLD — ${checks} checks`)
}
