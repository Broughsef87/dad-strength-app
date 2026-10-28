// Deterministic sweep of the Dad Built config (v1.1, per FOR-176).
// Hypertrophy's currency is HARD SETS PER MUSCLE PER WEEK, so that is what
// this checks — the analogue of Power Dad's percentage floors.
import { readFileSync } from 'node:fs'
import { dadBuilt, MUSCLE_MAP, setCredit, DAD_BUILT_BLOCK_BUDGET }
  from '../../src/lib/programs/dadBuilt.ts'

const MAXES = { back_squat: 315, bench: 225, ohp: 135 }
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
// Andrew, 2026-10-28: the curl + calf superset came off leg day and calves
// get one exercise a day at most. Hamstrings get RDL + lying leg curl on
// Saturday (8 sets) and calves one 4-set raise (the 4-set ceiling holds) — his legs are his strongest
// group, and this program spends its 6-7 slots a day on his upper body.
const FLOOR_OVERRIDE = { hamstrings: 8, calves: 4 }

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

    // Pull day (Fri) has no 1RM lift since deadlifts came out (2026-10-28).
    const wantCompounds = day === 5 ? 0 : 1
    assert(compounds === wantCompounds, `${tag}: ${compounds} percent compounds, expected ${wantCompounds}`)

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
      const floor = FLOOR_OVERRIDE[muscle] ?? (SMALL.has(muscle) ? SMALL_MIN : MIN_SETS)
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
  const bare = dadBuilt.buildDay(3, 6, MAXES)
  const fed = dadBuilt.buildDay(3, 6, MAXES, {}, { loadTargets: { pb_lateral_a: 30 } })
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
// Caps follow the LIFT: bench 8 (Mon), squat 8 (Wed), press 8 (Sat).
// Friday is pull day, which has no max to test.
const CAPS = { 1: 8, 3: 8, 6: 8 }
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
{
  const t = dadBuilt.buildDay(13, 5, MAXES)
  assert(t.dayType === 'gym' && t.items.length > 0, 'W13 Fri: pull day runs an easy session in test week')
  assert(t.items.every(i => i.kind !== 'lift' || i.sets === 2), 'W13 Fri: the test-week pull session is deload volume')
}
for (const d of GYM) {
  const dl = dadBuilt.buildDay(12, d, MAXES)
  assert(dl.items.every(i => i.kind !== 'plyo'), `W12 D${d}: primers/carry must drop in the deload`)
  const pct = dl.items.find(i => i.kind === 'lift' && i.percent != null)
  if (d !== 5) assert(pct?.percent === 60, `W12 D${d}: deload % should be 60`)
}

// ── Block counts ────────────────────────────────────────────────────────────
// Athlete, 2026-10-28: "should realistically only need 6 or 7 per day".
for (const d of GYM) {
  const n = dadBuilt.buildDay(1, d, MAXES).items.length
  assert(n >= 6 && n <= 7, `D${d} should be 6-7 blocks, got ${n}`)
}

// ── The week is push / legs / pull / shoulders, one leg day, no deadlifts ──
// Athlete's call, 2026-10-28. Asserted on the built plan rather than on the
// SESSION_BY_DAY table, so this fails if the table and the switch drift apart.
{
  const days = GYM.map(d => dadBuilt.buildDay(1, d, MAXES))
  const kind = days.map(p => p.dayName.split(' ')[0]).join(' ')
  assert(kind === 'Push Legs Pull Shoulders', `week must run push/legs/pull/shoulders, got ${kind}`)
  assert(days[0].items[0].slot === 'pb_bench', 'Bench must open push day')
  assert(days[1].items[0].slot === 'pb_squat', 'Back Squat must open legs day')
  assert(days[2].items[0].slot === 'pb_pullup', 'Weighted Pull-Up must open pull day')
  assert(days[3].items[0].slot === 'pb_ohp', 'Overhead Press must open shoulders day')
  assert(days[3].items[days[3].items.length - 1].slot === 'pb_carry', 'Farmer Carry must close the week')
  // One leg day: quads are only trained on Wednesday.
  const quadDays = days.filter(p => p.items.some(i => (MUSCLE_MAP[i.slot]?.primary ?? []).includes('quads')))
  assert(quadDays.length === 1, `quads trained on ${quadDays.length} days, expected 1 (one leg day)`)
  // More arms where he asked: triceps direct work on push, biceps on pull.
  const direct = (p, m) => p.items.filter(i => JSON.stringify(MUSCLE_MAP[i.slot]?.primary) === JSON.stringify([m])).length
  assert(direct(days[0], 'triceps') >= 3, 'push day needs at least 3 direct triceps moves')
  assert(direct(days[2], 'biceps') >= 3, 'pull day needs at least 3 direct biceps moves')
  for (let w = 1; w <= 13; w++) for (const d of GYM) for (const it of dadBuilt.buildDay(w, d, MAXES).items) {
    assert(!/^(pb_deadlift|test_dl)$/.test(it.slot ?? '') && !/^Deadlift/.test(it.name ?? ''),
      `W${w} D${d}: deadlifts came out on 2026-10-28`)
  }
  assert(!dadBuilt.requiredMaxes.some(m => m.key === 'deadlift'), 'no deadlift max is asked for')
}

// ── No jumping, anywhere, any week ─────────────────────────────────────────
// The athlete moved onto this program to train around an injury. A jump can
// only re-enter deliberately, not by a copy-paste from another program.
for (let w = 1; w <= 13; w++) {
  for (const d of GYM) {
    for (const it of dadBuilt.buildDay(w, d, MAXES).items) {
      assert(!/jump|bound|plyo/i.test(`${it.slot ?? ''} ${it.name ?? ''}`),
        `W${w} D${d}: "${it.name}" is jump/plyo work — removed for injury`)
    }
  }
}

// ── Every range lift is autoregulated by a visible RIR ─────────────────────
// targetRir shipped set-but-unrendered: the card printed a rep count with no
// indication of how hard to take the set. Assert both ends — the value exists,
// and the day page actually draws it.
{
  const page = readFileSync(new URL('../../src/app/train/[program]/[day]/page.tsx', import.meta.url), 'utf8')
  assert(/targetRir/.test(page), 'day page must render targetRir')
  assert(/repRange\[0\]/.test(page), 'day page must render the rep RANGE, not just its floor')
  for (const d of GYM) {
    for (const it of dadBuilt.buildDay(1, d, MAXES).items) {
      if (it.kind === 'lift' && it.repRange) {
        assert(it.targetRir != null, `D${d} ${it.slot}: range work with no RIR to display`)
      }
    }
  }
}

// ── DoD 1: every % slot's computed weight, W1-W13 ───────────────────────────
// Andrew, 2026-10-28: never two calf exercises in one day. Counted by what
// the exercise trains (MUSCLE_MAP), not by its set credit.
const isCalf = (i) => MUSCLE_MAP[i.slot]?.primary.includes('calves') ?? false
{
  const twoCalves = [{ slot: 'pb_calf_b', sets: 4 }, { slot: 'pb_calf_b', sets: 3 }, { slot: 'pb_squat', sets: 4 }]
  assert(twoCalves.filter(isCalf).length === 2, 'calf counter must see both calf exercises in the red fixture')
}
for (let w = 1; w <= 13; w++) for (const d of GYM) {
  const calves = dadBuilt.buildDay(w, d, MAXES).items.filter(isCalf)
  assert(calves.length <= 1, `W${w} D${d}: ${calves.length} calf exercises (${calves.map(i => i.name).join(', ')}) — max one a day`)
}

console.log(`── Main-lift loads at ${MAXES.back_squat}/${MAXES.bench}/${MAXES.ohp} ──`)
for (const d of GYM) {
  const rows = []
  for (let w = 1; w <= 13; w++) {
    const it = dadBuilt.buildDay(w, d, MAXES).items.find(i => i.kind === 'lift' && i.percent != null)
    if (!it) continue
    const wim = ((w - 1) % 13) + 1
    const tagW = wim === 13 ? 'T' : wim === 12 ? 'D' : String(w)
    rows.push(`${tagW}:${it.percent}%/${it.targetWeightLbs}x${it.sets}x${it.reps}`)
  }
  const lead = dadBuilt.buildDay(1, d, MAXES).items.find(i => i.percent != null)
  if (!lead) continue   // pull day: no 1RM lift
  const name = lead.name
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
