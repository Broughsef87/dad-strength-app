// Deterministic sweep of the Dad Built config (v1.1, per FOR-176).
// Hypertrophy's currency is HARD SETS PER MUSCLE PER WEEK, so that is what
// this checks — the analogue of Power Dad's percentage floors.
import { dadBuilt, MUSCLE_MAP, setCredit, DAD_BUILT_BLOCK_BUDGET }
  from '../../src/lib/programs/dadBuilt.ts'

const MAXES = { back_squat: 315, bench: 225, deadlift: 405, ohp: 135 }
const GYM = [1, 3, 5, 6]   // Mon / Wed / Fri / Sat — FOR-176 ruling 2

let checks = 0
const fails = []
const assert = (c, m) => { checks++; if (!c) fails.push(m) }

const MIN_SETS = 10
const MAX_SETS = 22
// Calves and core carry their own floor rather than a blanket exemption.
// Skipping them entirely means never noticing if one drops to two sets; the
// major-muscle band is simply the wrong yardstick for a muscle that recovers
// in a day and gets trained inside every squat and carry anyway.
const SMALL = new Set(['calves', 'core'])
const SMALL_MIN = 6

const creditOf = (it) => (it.kind === 'lift' || it.kind === 'plyo') ? setCredit(it.slot, it.sets) : {}

for (let week = 1; week <= 13; week++) {
  const wim = ((week - 1) % 13) + 1
  const isTest = wim === 13
  const isDeload = wim === 12
  const perMuscle = {}

  for (const day of GYM) {
    const plan = dadBuilt.buildDay(week, day, MAXES)
    const tag = `W${week} D${day}`

    assert(plan.items.length <= DAD_BUILT_BLOCK_BUDGET,
      `${tag}: ${plan.items.length} blocks > ${DAD_BUILT_BLOCK_BUDGET}`)

    if (isTest) continue

    let compounds = 0
    for (const it of plan.items) {
      for (const [m, c] of Object.entries(creditOf(it))) perMuscle[m] = (perMuscle[m] ?? 0) + c
      if (it.kind !== 'lift') continue

      if (it.percent != null) {
        compounds++
        assert(it.maxKey != null, `${tag} ${it.slot}: percent with no maxKey`)
        assert(it.targetWeightLbs != null, `${tag} ${it.slot}: unresolved weight`)
        assert(it.percent >= 55 && it.percent <= 95, `${tag} ${it.slot}: ${it.percent}% outside 55-95`)
        assert(it.repRange == null, `${tag} ${it.slot}: both percent and repRange`)
      } else {
        // Every non-percent lift MUST carry a range, or double progression
        // cannot move it and it prints the same thing forever.
        assert(Array.isArray(it.repRange), `${tag} ${it.slot}: accessory with no repRange`)
        if (Array.isArray(it.repRange)) {
          const [lo, hi] = it.repRange
          assert(lo > 0 && hi > lo, `${tag} ${it.slot}: bad range ${lo}-${hi}`)
          assert(it.reps === lo, `${tag} ${it.slot}: reps(${it.reps}) should be range floor(${lo})`)
        }
        assert(it.targetRir != null, `${tag} ${it.slot}: range work with no RIR target`)
      }

      if (!isDeload) {
        assert(MUSCLE_MAP[it.slot] != null || it.slot.startsWith('test_'),
          `${tag} ${it.slot}: untagged in MUSCLE_MAP`)
      }
    }

    assert(compounds === 1, `${tag}: ${compounds} percent compounds, expected 1`)

    const groups = {}
    plan.items.forEach((it, idx) => { if (it.superset) (groups[it.superset] ??= []).push(idx) })
    for (const [id, idxs] of Object.entries(groups)) {
      assert(idxs.length === 2, `${tag}: superset ${id} has ${idxs.length} members, expected 2`)
      assert(idxs[1] - idxs[0] === 1, `${tag}: superset ${id} members not adjacent`)
    }
  }

  if (isTest) continue

  if (!isDeload) {
    for (const [muscle, sets] of Object.entries(perMuscle)) {
      const floor = SMALL.has(muscle) ? SMALL_MIN : MIN_SETS
      assert(sets >= floor, `W${week}: ${muscle} only ${sets} sets/wk (min ${floor})`)
      assert(sets <= MAX_SETS, `W${week}: ${muscle} ${sets} sets/wk (max ${MAX_SETS})`)
    }
    for (const m of ['quads', 'hamstrings', 'glutes', 'chest', 'back', 'delts', 'biceps', 'triceps']) {
      assert(perMuscle[m] > 0, `W${week}: ${m} got NO sets`)
    }
  } else {
    let w11 = 0
    for (const d of GYM) for (const it of dadBuilt.buildDay(11, d, MAXES).items)
      for (const c of Object.values(creditOf(it))) w11 += c
    const total = Object.values(perMuscle).reduce((a, b) => a + b, 0)
    assert(total < w11 * 0.7, `W${week} deload: ${total} sets vs ${w11} in W11 — not light enough`)
  }
}

// ── Double progression feeds the prescription ────────────────────────────────
{
  const bare = dadBuilt.buildDay(3, 3, MAXES)
  const fed = dadBuilt.buildDay(3, 3, MAXES, {}, { loadTargets: { pb_lateral_a: 30 } })
  assert(bare.items.find(i => i.slot === 'pb_lateral_a').targetWeightLbs == null,
    'no history should mean no invented accessory weight')
  assert(fed.items.find(i => i.slot === 'pb_lateral_a').targetWeightLbs === 30,
    'loadTargets should drive the accessory weight')
}

// ── Week shape (ruling 2) ────────────────────────────────────────────────────
assert(dadBuilt.daysPerWeek === 6, 'daysPerWeek must be 6 (Mon-Sat, Sunday off)')
assert(JSON.stringify(dadBuilt.gymDayNumbers) === '[1,3,5,6]', 'gym days must be Mon/Wed/Fri/Sat')
for (const d of [2, 4]) {
  const p = dadBuilt.buildDay(3, d, MAXES)
  assert(p.dayType === 'outside', `day ${d} should be dad miles`)
  assert(p.items[0].title.startsWith('Dad Miles'), `day ${d} must be the dad-miles card`)
  assert(!/interval/i.test(JSON.stringify(p)), `day ${d} must stay genuinely easy — no interval finisher`)
}
// Every countable day is a real, completable session, or advanceWeekIfDone
// never fires and the athlete is stuck on week 1 forever.
for (let d = 1; d <= dadBuilt.daysPerWeek; d++) {
  assert(dadBuilt.buildDay(3, d, MAXES).items.length > 0, `day ${d} is countable but empty`)
}

// ── DoD 1: test week caps 8/8/6/8, W12 deload treatment ──────────────────────
const CAPS = { 1: 8, 3: 8, 5: 6, 6: 8 }
for (const [day, cap] of Object.entries(CAPS)) {
  const t = dadBuilt.buildDay(13, Number(day), MAXES)
  const lift = t.items.find(i => i.kind === 'lift')
  assert(t.dayType === 'test', `W13 D${day} should be a test day`)
  assert(lift.reps === cap, `W13 D${day}: cap ${lift.reps}, expected ${cap}`)
  assert(lift.percent === 85, `W13 D${day}: AMRAP should be @85%, got ${lift.percent}`)
  assert(/reps\/30/.test(lift.note ?? ''), `W13 D${day}: card must carry the e1RM formula`)
  assert(cap <= 10, `W13 D${day}: cap ${cap} exceeds what Epley accepts`)
  // The gap that let an unresolved AMRAP weight ship: the main loop skips
  // test weeks before it ever checks that a percent resolves to a number.
  assert(lift.targetWeightLbs != null && lift.targetWeightLbs > 0,
    `W13 D${day}: AMRAP has no weight on the card (got ${lift.targetWeightLbs})`)
}
assert(dadBuilt.buildDay(13, 6, MAXES).items.some(i => i.slot === 'pb_wrap'),
  'Saturday must close with the update-maxes card')
for (const d of GYM) {
  const dl = dadBuilt.buildDay(12, d, MAXES)
  assert(dl.items.every(i => i.kind !== 'plyo'), `W12 D${d}: primers/carry must drop in the deload`)
  assert(dl.items.find(i => i.kind === 'lift' && i.percent != null).percent === 60,
    `W12 D${d}: deload % should be 60`)
}

// ── DoD 3: block counts ──────────────────────────────────────────────────────
for (const d of GYM) {
  const n = dadBuilt.buildDay(1, d, MAXES).items.length
  assert(n === 8, `D${d} should be 8 blocks, got ${n}`)
}

// ── Ruling 4: primers open lower days, carry closes Lower B ─────────────────
{
  const mon = dadBuilt.buildDay(1, 1, MAXES).items
  const fri = dadBuilt.buildDay(1, 5, MAXES).items
  assert(mon[0].slot === 'pb_jump_a' && mon[0].kind === 'plyo', 'Box Jump must open Monday')
  assert(fri[0].slot === 'pb_jump_b' && fri[0].kind === 'plyo', 'Broad Jump must open Friday')
  assert(fri[fri.length - 1].slot === 'pb_carry', 'Farmer Carry must close Lower B')
  // Contest upheld on FOR-176: the Ab Wheel was the cut, not the calves.
  assert(!fri.some(i => i.slot === 'pb_core_b'), 'Ab Wheel Rollout was the agreed cut')
  assert(fri.some(i => i.slot === 'pb_calf_b'), 'Seated Calf Raise stays on Lower B')
}

// ── DoD 1: every % slot's computed weight, W1-W13 ───────────────────────────
console.log(`── Main-lift loads at ${MAXES.back_squat}/${MAXES.bench}/${MAXES.deadlift}/${MAXES.ohp} ──`)
for (const d of GYM) {
  const rows = []
  for (let w = 1; w <= 13; w++) {
    const it = dadBuilt.buildDay(w, d, MAXES).items.find(i => i.kind === 'lift' && i.percent != null)
    if (!it) continue
    const wim = ((w - 1) % 13) + 1
    const tagW = wim === 13 ? 'T' : wim === 12 ? 'D' : String(w)
    rows.push(`${tagW}:${it.percent}%/${it.targetWeightLbs}x${it.sets}x${it.reps}`)
  }
  const name = dadBuilt.buildDay(1, d, MAXES).items.find(i => i.percent != null).name
  console.log(`  D${d} ${name.padEnd(16)} ${rows.join('  ')}`)
}

console.log('\n── Weekly hard sets per muscle (secondary movers = half) ──')
for (const week of [1, 5, 9, 12]) {
  const per = {}
  for (const d of GYM) for (const it of dadBuilt.buildDay(week, d, MAXES).items) {
    for (const [m, c] of Object.entries(creditOf(it))) per[m] = (per[m] ?? 0) + c
  }
  const wim = ((week - 1) % 13) + 1
  const label = wim === 12 ? 'deload' : `M${Math.ceil(wim / 4)}`
  console.log(`  W${String(week).padStart(2)} (${label.padEnd(6)}) ` +
    Object.entries(per).sort().map(([m, s]) => `${m}:${s}`).join('  '))
}

console.log('\n── Blocks per gym day ──')
for (const week of [1, 5, 9, 12]) {
  console.log(`  W${String(week).padStart(2)}: ` +
    GYM.map(d => `D${d}:${dadBuilt.buildDay(week, d, MAXES).items.length}`).join('  '))
}

console.log('\n' + '='.repeat(64))
if (fails.length) {
  console.log(`FAIL ${fails.length} of ${checks} checks:`)
  for (const f of fails.slice(0, 25)) console.log('  -', f)
  process.exit(1)
} else {
  console.log(`PASS ${checks} FAIL 0 — Dad Built v1.1, 13 weeks`)
}
