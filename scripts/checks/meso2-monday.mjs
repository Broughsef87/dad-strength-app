// ── M2 Monday: the EMOM and the waves (FOR-263) ─────────────────────────────
//
// Andrew, 2026-10-05: meso 2's Monday was a top double at 83% with hang
// back-offs and a straight 4x4 squat at 78%, which landed within a percentage
// point or two of where meso 1 finished. Two of the same lifts at nearly the
// same loads is not a second meso.
//
// What it is now:
//
//   SNATCH   8x1 EMOM     W5 80 · W6 81.5 · W7 83 · W8 84.5
//            and NO back-off slot — the density is the dose.
//
//   SQUAT    two waves of 3/2/1, the second 2% over the first, +2% a week
//            W5  3@75 2@80 1@85 · 3@77 2@82 1@87
//            W6  3@77 2@82 1@87 · 3@79 2@84 1@89
//            W7  3@79 2@84 1@89 · 3@81 2@86 1@91
//            W8  3@81 2@86 1@91 · 3@83 2@88 1@93
//
// ITS OWN FILE, because a revert of hybridPower.ts must not also delete the
// check that would catch the revert. Everything below runs against buildDay
// output, so it pins what is PRESCRIBED rather than what the source says.
import { hybridPower } from '../../src/lib/programs/hybridPower.ts'
import { computeAdjustments } from '../../src/lib/programs/autoreg.ts'

// Andrew's maxes, the fixture sweep.mjs uses. The KEYS matter: the program asks
// for `back_squat`, so a fixture spelling it `backSquat` resolves every squat
// weight to null and every weight assertion below would pass on nothing.
const MAXES = {
  snatch: 205, clean_jerk: 260,
  back_squat: 365, front_squat: 315, bench: 250, deadlift: 465, ohp: 155,
}

let failed = 0
let passed = 0
const assert = (cond, msg) => {
  if (cond) { passed++; return }
  failed++
  console.log(`  \u2717 ${msg}`)
}

const monday = (w) => hybridPower.buildDay(w, 1, MAXES)
const at = (w, slot) => monday(w).items.find((i) => i.slot === slot)

// ── 1. the fixture resolves ────────────────────────────────────────────────
// A null weight makes every load assertion below vacuous, so prove the
// fixture reaches the program before trusting a single number from it.
assert(at(5, 'back_squat_heavy')?.targetWeightLbs != null,
  'the max fixture resolves a squat weight — otherwise every load assertion here is vacuous')
assert(at(5, 'sn_top')?.targetWeightLbs != null,
  'the max fixture resolves a snatch weight')

// ── 2. the snatch is an 8x1 EMOM, at these four percentages ────────────────
const EMOM = { 5: 80, 6: 81.5, 7: 83, 8: 84.5 }
for (const [w, pct] of Object.entries(EMOM)) {
  const t = at(Number(w), 'sn_top')
  assert(t?.sets === 8, `W${w} snatch should be 8 sets, got ${t?.sets}`)
  assert(t?.reps === 1, `W${w} snatch should be singles, got ${t?.reps} reps`)
  assert(t?.percent === pct, `W${w} snatch should be ${pct}%, got ${t?.percent}%`)
  assert(t?.name === 'Snatch', `W${w} snatch must be the full lift, got ${t?.name}`)
  // 80% is exactly the classic floor for a full-lift single, so W5 proves the
  // floor does not push the opening week UP off its prescription.
  assert(t?.setPlan === undefined, `W${w} snatch is one weight for all eight singles — it carries no per-set plan`)
  assert(/minute/i.test(t?.note ?? ''), `W${w} snatch note should tell him it is on the minute, got ${JSON.stringify(t?.note)}`)
}

// ── 3. M2 prescribes NO snatch back-off ────────────────────────────────────
for (const w of [5, 6, 7, 8]) {
  assert(at(w, 'sn_back') === undefined,
    `W${w} should prescribe no snatch back-off, got ${JSON.stringify(at(w, 'sn_back')?.name)}`)
}
// …and M1 and M3 still have theirs, so this is M2's exception and not a
// deletion of the slot.
assert(at(1, 'sn_back')?.sets === 3, `M1 keeps its back-offs, got ${at(1, 'sn_back')?.sets} sets`)
assert(at(9, 'sn_back')?.sets === 2, `M3 keeps its back-offs, got ${at(9, 'sn_back')?.sets} sets`)

// ── 4. the squat is two waves of 3/2/1, week by week ───────────────────────
const WAVES = {
  5: [[3, 75], [2, 80], [1, 85], [3, 77], [2, 82], [1, 87]],
  6: [[3, 77], [2, 82], [1, 87], [3, 79], [2, 84], [1, 89]],
  7: [[3, 79], [2, 84], [1, 89], [3, 81], [2, 86], [1, 91]],
  8: [[3, 81], [2, 86], [1, 91], [3, 83], [2, 88], [1, 93]],
}
for (const [w, want] of Object.entries(WAVES)) {
  const sq = at(Number(w), 'back_squat_heavy')
  assert(sq?.sets === 6, `W${w} squat should be 6 sets, got ${sq?.sets}`)
  assert(sq?.setPlan?.length === 6, `W${w} squat should carry 6 planned sets, got ${sq?.setPlan?.length}`)
  const got = (sq?.setPlan ?? []).map((x) => [x.reps, x.percent])
  assert(JSON.stringify(got) === JSON.stringify(want),
    `W${w} squat wave should be ${JSON.stringify(want)}, got ${JSON.stringify(got)}`)
  // Every planned set resolves to a real bar weight — a plan with a null load
  // in it puts an empty row in front of him mid-session.
  assert((sq?.setPlan ?? []).every((x) => typeof x.targetWeightLbs === 'number' && x.targetWeightLbs > 0),
    `W${w} squat: every planned set has a load, got ${JSON.stringify((sq?.setPlan ?? []).map((x) => x.targetWeightLbs))}`)
  // The loads ASCEND within each wave, which is what makes it a wave.
  for (const [lo, hi] of [[0, 2], [3, 5]]) {
    const a = sq?.setPlan?.[lo]?.targetWeightLbs ?? 0
    const b = sq?.setPlan?.[hi]?.targetWeightLbs ?? 0
    assert(b > a, `W${w} squat sets ${lo + 1}-${hi + 1} must climb, got ${a} then ${b}`)
  }
  // …and the SECOND wave opens above the first, which is the 2% offset.
  assert((sq?.setPlan?.[3]?.percent ?? 0) === (sq?.setPlan?.[0]?.percent ?? 0) + 2,
    `W${w} squat: the second wave opens 2% over the first`)
}
// sets and the plan are ONE fact. A sixth row with no fifth prescription is a
// set he has to guess at, so the registry refuses the mismatch outright.
for (const w of [5, 6, 7, 8]) {
  const sq = at(w, 'back_squat_heavy')
  assert(sq?.sets === sq?.setPlan?.length, `W${w} squat: sets is ${sq?.sets} and the plan holds ${sq?.setPlan?.length}`)
  assert(sq?.reps === sq?.setPlan?.[0]?.reps && sq?.percent === sq?.setPlan?.[0]?.percent,
    `W${w} squat: reps/percent describe the FIRST set, so nothing reading them sees undefined`)
}

// ── 5. OBEDIENCE IS NOT A SIGNAL. Lift the wave as written, drift nothing ──
//
// The weight-follow averages every load logged in the day and measures it
// against the prescription. A wave's `percent` is its first set (75), while
// its average is 81, so reading the first set as the prescription turns doing
// exactly as told into "+6% heavy" and walks the whole wave up a week at a
// time. This is the assertion that catches that.
const chain = (data) => {
  const o = {
    select: () => o, eq: () => o, gte: () => o, order: () => o,
    limit: () => Promise.resolve({ data }), not: () => Promise.resolve({ data }),
  }
  return o
}
const fakeDbOf = (logs) => ({ from: (t) => chain(t === 'generated_workouts' ? [{ id: 'w5' }] : logs) })

{
  const sq = at(5, 'back_squat_heavy')
  const sn = at(5, 'sn_top')
  // Exactly what the card told him to do, every set, at the target RPE.
  const logs = [
    ...(sq?.setPlan ?? []).map((x) => ({ slot: 'back_squat_heavy', rpe: sq.targetRpe, weight_lbs: x.targetWeightLbs })),
    ...Array.from({ length: sn?.sets ?? 0 }, () => ({ slot: 'sn_top', rpe: sn.targetRpe, weight_lbs: sn.targetWeightLbs })),
  ]
  const adj = await computeAdjustments(fakeDbOf(logs), 'u1', hybridPower, 6, 1, Date.now(), MAXES)
  assert((adj.back_squat_heavy ?? 0) === 0,
    `lifting the W5 wave exactly as prescribed must move W6 nowhere, got ${adj.back_squat_heavy}`)
  assert((adj.sn_top ?? 0) === 0,
    `lifting the W5 EMOM exactly as prescribed must move W6 nowhere, got ${adj.sn_top}`)
  // And the instrument still has teeth: 10 lb a set over the wave IS a signal.
  const heavy = logs.map((r) => (r.slot === 'back_squat_heavy' ? { ...r, weight_lbs: r.weight_lbs + 10 } : r))
  const adjHeavy = await computeAdjustments(fakeDbOf(heavy), 'u1', hybridPower, 6, 1, Date.now(), MAXES)
  assert((adjHeavy.back_squat_heavy ?? 0) > 0,
    `10 lb a set above the wave must still read as heavier, got ${adjHeavy.back_squat_heavy}`)
}

// ── 6. EVERY OTHER MONDAY IS UNCHANGED ─────────────────────────────────────
//
// Captured from origin/master at b4ad986 on 2026-10-05, before this ticket
// touched anything, by building the same Monday off the same maxes in a
// detached worktree. Weeks 5-8 are the four this ticket changes and are
// asserted above; these nine are the ones it must not have touched.
const BASELINE = {
  1: [
    'broad_jump|Box Jumps|4x3@undefined|undefined',
    'back_squat_heavy|Back Squat|4x5@70|255',
    'sn_top|Snatch|2x2@80|165',
    'sn_back|Snatch|3x2@75|155',
    'bench_heavy|Bench Press|4x4@75|190',
    'acc_nordic|Nordic Curl|3x5@undefined|undefined',
  ],
  2: [
    'broad_jump|Box Jumps|4x3@undefined|undefined',
    'back_squat_heavy|Back Squat|4x5@72|265',
    'sn_top|Snatch|2x2@81|165',
    'sn_back|Snatch|3x2@76|155',
    'bench_heavy|Bench Press|4x4@77|195',
    'acc_nordic|Nordic Curl|3x5@undefined|undefined',
  ],
  3: [
    'broad_jump|Broad Jump|4x3@undefined|undefined',
    'back_squat_heavy|Back Squat|4x5@74|270',
    'sn_top|Snatch|2x2@82|170',
    'sn_back|Snatch|3x2@77|160',
    'bench_heavy|Bench Press|4x4@79|200',
    'acc_nordic|Nordic Curl|3x5@undefined|undefined',
  ],
  4: [
    'broad_jump|Broad Jump|4x3@undefined|undefined',
    'back_squat_heavy|Back Squat|4x5@76|275',
    'sn_top|Snatch|2x2@83|170',
    'sn_back|Snatch|3x2@78|160',
    'bench_heavy|Bench Press|4x4@81|205',
    'acc_nordic|Nordic Curl|3x5@undefined|undefined',
  ],
  9: [
    'broad_jump|Broad Jump|4x3@undefined|undefined',
    'back_squat_heavy|Back Squat|4x3@85|310',
    'sn_top|Snatch|1x1@87|180',
    'sn_back|Snatch|2x1@83|170',
    'bench_heavy|Bench Press|3x2@86|215',
    'acc_nordic|Nordic Curl|3x5@undefined|undefined',
  ],
  10: [
    'broad_jump|Broad Jump|4x3@undefined|undefined',
    'back_squat_heavy|Back Squat|4x3@86.5|315',
    'sn_top|Snatch|1x1@88.5|180',
    'sn_back|Snatch|2x1@84|170',
    'bench_heavy|Bench Press|3x2@87|220',
    'acc_nordic|Nordic Curl|3x5@undefined|undefined',
  ],
  11: [
    'broad_jump|Broad Jump|4x3@undefined|undefined',
    'back_squat_heavy|Back Squat|4x3@88|320',
    'sn_top|Snatch|1x1@90|185',
    'sn_back|Snatch|2x1@85|175',
    'bench_heavy|Bench Press|3x2@88|220',
    'acc_nordic|Nordic Curl|3x5@undefined|undefined',
  ],
  12: [
    'back_squat_heavy|Back Squat|2x3@60|220',
    'sn_top|Snatch|2x1@65|135',
    'bench_heavy|Bench Press|2x2@60|150',
    'acc_nordic|Nordic Curl|3x5@undefined|undefined',
  ],
  13: [
    'test_snatch|Snatch — work to 1RM|8x1@undefined|undefined',
    'test_acc|Easy bike flush|1x10@undefined|undefined',
  ],
}

for (const [w, want] of Object.entries(BASELINE)) {
  const got = monday(Number(w)).items.map((i) =>
    `${i.slot}|${i.name}|${i.sets}x${i.reps}@${i.percent}|${i.targetWeightLbs}`)
  assert(JSON.stringify(got) === JSON.stringify(want),
    `W${w} Monday changed\n      before ${JSON.stringify(want)}\n      now    ${JSON.stringify(got)}`)
  // No week outside M2 grew a per-set plan.
  assert(monday(Number(w)).items.every((i) => i.setPlan === undefined),
    `W${w} Monday should carry no per-set plan`)
}

console.log('')
console.log('── M2 Monday: the EMOM and the waves (FOR-263) ───────────────')
for (const w of [5, 6, 7, 8]) {
  const sn = at(w, 'sn_top')
  const sq = at(w, 'back_squat_heavy')
  console.log(`  W${w}  snatch ${sn.sets}x${sn.reps} @ ${sn.percent}% (${sn.targetWeightLbs} lb)`)
  console.log(`      squat  ${(sq.setPlan ?? []).map((x) => `${x.reps}@${x.targetWeightLbs}`).join(' ')}`
    + `   [${(sq.setPlan ?? []).map((x) => x.percent).join('/')}]`)
}
console.log(`  Mondays pinned unchanged    ${Object.keys(BASELINE).join(', ')}`)
console.log('')

if (failed) {
  console.log(`\u2717 ${failed} of ${passed + failed} assertions failed`)
  process.exit(1)
}
console.log(`\u2713 ${passed} assertions: M2 Monday is the EMOM and the waves, every other Monday untouched`)
