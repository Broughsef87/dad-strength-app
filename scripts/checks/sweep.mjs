// Deterministic sweep of the athletic-power hybridPower config.
// Run: npx tsx sweep.mjs (from repo root or with absolute path)
import { hybridPower } from '../../src/lib/programs/hybridPower.ts'

const MAXES = {
  snatch: 205, clean_jerk: 260,
  back_squat: 365, front_squat: 315, bench: 250, deadlift: 465, ohp: 155,
}

const OLY_KEYS = new Set(['snatch', 'clean_jerk'])
// Banned EVERYWHERE: the jerk (retired) and block work (no blocks in the gym).
const FORBIDDEN_ANY = /block|& jerk/i
// Banned on the CLASSIC LIFT slots only: oly technique work. Pauses and
// tempos on strength lifts (front squat, bench) are legal — athlete's ruling.
const FORBIDDEN_OLY = /pause|tempo|balance|\(1\+/i
const isClassicSlot = (slot, maxKey) =>
  OLY_KEYS.has(maxKey) && !slot.includes('pull') && !slot.includes('press')

let checks = 0
const fails = []
const overBudget = new Set() // days knowingly running >6 cards
const assert = (cond, msg) => { checks++; if (!cond) fails.push(msg) }

// Track week-over-week % per slot for step-size checks.
const prevPct = {}

for (let week = 1; week <= 13; week++) {
  for (const day of [1, 3, 5, 6]) {
    const plan = hybridPower.buildDay(week, day, MAXES)
    for (const item of plan.items) {
      if (item.kind !== 'lift') continue
      const tag = `W${week} D${day} ${item.slot} "${item.name}"`

      // 1. No jerk / block work anywhere; no oly technique work on the
      // classic-lift slots (strength lifts may pause).
      assert(!FORBIDDEN_ANY.test(item.name), `${tag}: forbidden jerk/block name`)
      if (item.maxKey != null && isClassicSlot(item.slot, item.maxKey)) {
        assert(!FORBIDDEN_OLY.test(item.name), `${tag}: oly technique work on a classic-lift slot`)
      }

      if (item.percent == null || item.maxKey == null) continue

      // 2. Power-lift slots live in the 65-90 zone of the FULL-lift maxes.
      if (/(_top|_back|hang_psn)$/.test(item.slot)) {
        assert(item.percent >= 65 && item.percent <= 90, `${tag}: power pct ${item.percent} outside 65-90`)
      }
      // 2b. USER RULE: any ≤2-rep working set ≥75% (deload W12 exempt — recovery).
      if (OLY_KEYS.has(item.maxKey) && !item.slot.includes('pull') && !item.slot.includes('press')
          && item.reps <= 2 && ((week - 1) % 13) + 1 !== 12) {
        assert(item.percent >= 75, `${tag}: ${item.reps}-rep set @ ${item.percent} < 75`)
      }
      // 3. Pulls are heavy: >= 100% (except deload week).
      if (item.slot.includes('pull') && week !== 12) {
        assert(item.percent >= 100, `${tag}: pull pct ${item.percent} < 100`)
      }
      // 4. Oly floors: power/hang >= 65 (deload included). Pulls and presses
      // are excluded, mirroring isClassicLiftSlot in the config.
      if (OLY_KEYS.has(item.maxKey) && !item.slot.includes('pull') && !item.slot.includes('press')) {
        assert(item.percent >= 65, `${tag}: oly pct ${item.percent} < 65 floor`)
      }
      // 4b. PURE full lifts at <=2 reps are heavy: >= 80 (working weeks).
      const nm = item.name.trim().toLowerCase()
      if ((nm === 'snatch' || nm === 'clean') && item.reps <= 2 && week % 13 !== 12) {
        assert(item.percent >= 80, `${tag}: full lift ${item.reps}-rep @ ${item.percent} < 80`)
      }
      // 5. Weekly jumps <= 3% within a meso (non-deload, non-test).
      const wim = ((week - 1) % 13) + 1
      const key = `${day}:${item.slot}`
      if (wim <= 11 && prevPct[key] != null && ((wim - 1) % 4) !== 0) {
        const step = item.percent - prevPct[key]
        assert(step <= 3.01 && step >= -0.01, `${tag}: weekly step ${step.toFixed(1)} outside 0-3`)
      }
      if (wim <= 11) prevPct[key] = item.percent

      // 6. Weight resolves.
      assert(item.targetWeightLbs != null, `${tag}: no resolved weight`)
    }

    // 7. Top/back-off relationship on power days (mesos 2-3, non-deload).
    if ((day === 1 || day === 5) && week >= 5 && week <= 11) {
      const lifts = plan.items.filter(i => i.kind === 'lift')
      const top = lifts.find(i => i.slot.endsWith('_top'))
      const back = lifts.find(i => i.slot.endsWith('_back'))
      assert(top && back, `W${week} D${day}: expected top+backoff pair`)
      if (top && back) assert(back.percent < top.percent, `W${week} D${day}: backoff ${back.percent} >= top ${top.percent}`)
    }
    // 8. M1 (weeks 1-4): straight sets only — no backoff slot.
    if ((day === 1 || day === 5) && week <= 4) {
      assert(!plan.items.some(i => i.kind === 'lift' && i.slot.endsWith('_back')), `W${week} D${day}: unexpected backoff in M1`)
    }
    // 8b. Session budget: every gym day caps at 6 BLOCKS (non-test weeks).
    // A *_back slot is the same bar right after the top set — it costs a card
    // but no extra station, so it doesn't count against the clock budget.
    if (((week - 1) % 13) + 1 !== 13) {
      const blocks = plan.items.filter(i => !i.slot.endsWith('_back')).length
      assert(blocks <= 6, `W${week} D${day}: ${blocks} blocks > 6 budget (${plan.items.length} cards)`)
      if (blocks > 6) overBudget.add(`W${week} D${day} (${blocks})`)
    }
  }
}

// 8c. Meso rotation: second-tier slots change names between mesos; spine doesn't.
const nameAt = (week, day, slot) =>
  hybridPower.buildDay(week, day, MAXES).items.find(i => i.slot === slot)?.name
const itemAt = (week, day, slot) =>
  hybridPower.buildDay(week, day, MAXES).items.find(i => i.slot === slot)

// M2 variation meso → M3 realization on the pure lifts.
assert(nameAt(5, 1, 'sn_back') === 'Hang Snatch' && nameAt(9, 1, 'sn_back') === 'Snatch', 'snatch back-offs: hang in M2, pure in M3')
// Athlete's preference: EVERY clean comes off the floor — no hang variant on
// the clean side, in any meso. The snatch still hangs in M2.
for (const wk of [5, 9]) assert(nameAt(wk, 5, 'cl_back') === 'Power Clean', `W${wk} clean back-offs must be off the floor`)
for (const wk of [1, 5, 9]) {
  for (const slot of ['cl_top', 'cl_back']) {
    assert(!/hang/i.test(nameAt(wk, 5, slot) ?? ''), `W${wk} ${slot}: no hang cleans — athlete's call`)
  }
}
// The clean side is POWER cleans, but the loads stayed where the full clean
// had them (athlete's call — %-of-power-max under-loads him). The "pure full
// lift ≥80" rule no longer covers this slot, so guard the wave explicitly.
for (const wk of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
  const top = itemAt(wk, 5, 'cl_top')
  assert(top?.name === 'Power Clean', `W${wk} cl_top should be Power Clean`)
  assert(top?.percent >= 80, `W${wk} cl_top @ ${top?.percent} — top power clean must stay ≥80`)
  assert(top?.maxKey === 'clean_jerk', `W${wk} cl_top must key off the FULL clean max`)
}
// Pulls: 3 sets, every meso (athlete's call).
for (const wk of [1, 5, 9]) {
  assert(itemAt(wk, 5, 'clean_pull')?.sets === 3, `W${wk} pull should be 3 sets`)
}
// FRIDAY is the speed day: ordered fast-to-heavy. RFD only exists while fresh,
// so every sub-75% speed slot must precede the heaviest bar of the day.
for (const wk of [1, 2, 5, 9, 11]) {
  const s = hybridPower.buildDay(wk, 5, MAXES).items.map(i => i.slot)
  const pos = k => s.indexOf(k)
  assert(pos('seated_box_jump') === 0, `W${wk} Fri: jumps must open the day, got ${s[0]}`)
  assert(pos('hang_psn') === -1, `W${wk} Fri: hang_psn was removed (FOR-188)`)
  // M1 only: M2/M3 add the clean back-off, so Friday is legitimately 6 there.
  if (wk <= 4) assert(s.length === 5, `W${wk} Fri: 5 stations in M1 after the hang-snatch cut, got ${s.length}`)
  // both present first: indexOf gives -1 for a missing slot, and -1 < n is
  // true, so the ordering assert alone would survive either one vanishing
  assert(pos('speed_squat') >= 0 && pos('cl_top') >= 0, `W${wk} Fri: speed squat and clean must both exist`)
  assert(pos('speed_squat') < pos('cl_top'), `W${wk} Fri: speed squat must precede the heavy clean`)
  assert(pos('cl_top') < pos('clean_pull'), `W${wk} Fri: clean before the pull`)
  assert(pos('acc_pullup') === s.length - 1, `W${wk} Fri: the row is the overflow block, must be last`)
}
// Speed slots carry NO RPE anchor (a 57% double honestly rates ~4; against a
// target of 6 the autoreg read that as "+3% too light" every week).
for (const wk of [1, 5, 9]) {
  for (const slot of ['speed_squat']) {
    const it = itemAt(wk, 5, slot)
    assert(it?.velocity === true, `W${wk} ${slot} must be flagged velocity`)
    assert(it?.targetRpe === undefined, `W${wk} ${slot} must carry no targetRpe, got ${it?.targetRpe}`)
  }
}
// Wednesday order: push press → front squat → trap bar jump → bench (rack-driven).
const wedSlots = hybridPower.buildDay(1, 3, MAXES).items.map(i => i.slot)
assert(
  wedSlots.indexOf('push_press') < wedSlots.indexOf('front_squat') &&
  wedSlots.indexOf('front_squat') < wedSlots.indexOf('tb_jump') &&
  wedSlots.indexOf('tb_jump') < wedSlots.indexOf('bench'),
  `Wed order wrong: ${wedSlots.join(' → ')}`,
)
assert(nameAt(1, 1, 'bench_heavy') === 'Bench Press' && nameAt(5, 1, 'bench_heavy') === '1¼ Bench Press' && nameAt(9, 1, 'bench_heavy') === 'Bench Press', 'Mon bench: 1¼ in M2 only')
assert(nameAt(5, 3, 'front_squat') === 'Pause Front Squat' && nameAt(9, 3, 'front_squat') === 'Front Squat', 'front squat: pause in M2, straight in M3')
assert(nameAt(5, 5, 'clean_pull') === 'Snatch Pull' && nameAt(1, 5, 'clean_pull') === 'Clean Pull' && nameAt(9, 5, 'clean_pull') === 'Clean Pull', 'pull: snatch pull in M2 only')
// M2 snatch pulls key off the SNATCH max, not the clean.
assert(itemAt(5, 5, 'clean_pull')?.maxKey === 'snatch', 'M2 snatch pull must key off the snatch max')
assert(itemAt(1, 5, 'clean_pull')?.maxKey === 'clean_jerk' && itemAt(9, 5, 'clean_pull')?.maxKey === 'clean_jerk', 'M1/M3 clean pulls key off the clean max')
// Athlete's rule (2026-08 revision): AT MOST ONE pause-squat slot per week,
// any squat variant. Deficit deadlifts are legal for future mesos, so the
// old "deadlift must stay straight" assert is retired; the weekly pause cap
// is the constraint that survives.
for (const wk of [1, 5, 9]) {
  let pauseSquats = 0
  for (const d of [1, 3, 5, 6]) {
    for (const item of hybridPower.buildDay(wk, d, MAXES).items) {
      if (item.kind === 'lift' && /pause/i.test(item.name) && /squat/i.test(item.name)) pauseSquats++
    }
  }
  assert(pauseSquats <= 1, `W${wk}: ${pauseSquats} pause-squat slots — cap is 1/week`)
}
assert(nameAt(1, 3, 'bench') === 'Bench Press' && nameAt(5, 3, 'bench') === 'Close-Grip Bench Press', 'Wed bench should rotate to close-grip in M2')
assert(nameAt(1, 5, 'acc_pullup') === 'Pull-Up' && nameAt(5, 5, 'acc_pullup') === 'Pendlay Row' && nameAt(9, 5, 'acc_pullup') === 'Chest-Supported Row', 'Fri pull slot should rotate')
// Horizontal pulling must exist in M2 AND M3 — five pressing exposures a week
// against one vertical pull is the imbalance this fixes.
for (const wk of [5, 9]) assert(/row/i.test(nameAt(wk, 5, 'acc_pullup') ?? ''), `W${wk}: Friday needs a horizontal row`)
// M3 must not just repeat Wednesday's weighted pull-up.
assert(nameAt(9, 5, 'acc_pullup') !== nameAt(9, 3, 'acc_wpu'), 'M3 Friday pull duplicates Wednesday')
// Anti-rotation exists somewhere in the macro (M2 core).
assert([1, 5, 9].some(wk => /pallof/i.test(nameAt(wk, 1, 'acc_core') ?? '')), 'no anti-rotation core anywhere')
// OHP leads Saturday — the stated weakness gets the fresh slot, not the
// leftovers behind a heavy deadlift.
for (const wk of [1, 5, 9]) {
  const slots = hybridPower.buildDay(wk, 6, MAXES).items.map(i => i.slot)
  assert(slots.includes('ohp_press') && slots.includes('sat_dl'), `W${wk}: OHP and deadlift must both exist`)
  assert(slots.indexOf('ohp_press') < slots.indexOf('sat_dl'), `W${wk}: OHP must come before the deadlift`)
}
// Test week has to retest every max the program consumes, OHP included —
// it was missing, so Saturday's wave computed off a frozen number forever.
const testedMaxes = new Set()
for (const d of [1, 3, 5, 6]) {
  for (const i of hybridPower.buildDay(13, d, MAXES).items) {
    if (/^(Snatch|Clean) —/.test(i.name ?? '')) testedMaxes.add(i.name.startsWith('Snatch') ? 'snatch' : 'clean_jerk')
    if (/^Back Squat —/.test(i.name ?? '')) testedMaxes.add('back_squat')
    if (/^Front Squat —/.test(i.name ?? '')) testedMaxes.add('front_squat')
    if (/^Bench Press —/.test(i.name ?? '')) testedMaxes.add('bench')
    if (/^Deadlift —/.test(i.name ?? '')) testedMaxes.add('deadlift')
    if (/^Overhead Press —/.test(i.name ?? '')) testedMaxes.add('ohp')
  }
}
for (const { key } of hybridPower.requiredMaxes) {
  assert(testedMaxes.has(key), `test week never retests the "${key}" max`)
}
// Jumps: broad jumps live on Monday in M2 ONLY; seated box jumps every Friday.
assert(!nameAt(1, 1, 'broad_jump') && nameAt(5, 1, 'broad_jump') === 'Broad Jump' && !nameAt(9, 1, 'broad_jump'), 'broad jumps: Monday, meso 2 only')
// Broad jumps OPEN Monday and are unlinked — no room to jump by the racks, so
// they can't be a squat contrast pair, and doing them last would mean fatigued
// jumps. Fresh, first, one trip to the open floor.
{
  const mon = hybridPower.buildDay(5, 1, MAXES)
  assert(mon.items[0].slot === 'broad_jump', `broad jumps must open Monday, got ${mon.items[0].slot}`)
  assert(!mon.items.some(i => i.superset === 'sq_contrast'), 'broad jumps must not be superset with the squat')
}
for (const wk of [1, 5, 9]) assert(nameAt(wk, 5, 'seated_box_jump') === 'Seated Box Jump', `W${wk}: Friday needs seated box jumps`)
// Sprint day: every working week is jog-free, broad-jump-free, and carries
// the warm-up + cooldown + neck work.
const sprintTitles = []
for (let wk = 1; wk <= 13; wk++) {
  const s = hybridPower.buildDay(wk, 2, MAXES).items[0]
  const parts = s.parts ?? []
  assert(!parts.some(p => /broad jump/i.test(p)), `W${wk} sprint day still has broad jumps`)
  // "no jogging" is the instruction, not a violation — strip it before testing.
  assert(!parts.some(p => /\bjog(ging)?\b/i.test(p.replace(/no jogging/gi, ''))), `W${wk} sprint day still warms up with a jog`)
  assert(/no jogging/i.test(parts[0] ?? ''), `W${wk} sprint day missing the drill warm-up`)
  const wim = ((wk - 1) % 13) + 1
  if (wim !== 12 && wim !== 13) {
    assert(parts.some(p => /^Neck:/.test(p)), `W${wk} sprint day missing neck work`)
    assert(parts.some(p => /Cooldown/.test(p)), `W${wk} sprint day missing cooldown`)
    sprintTitles.push(s.title)
  }
}
// The pool actually rotates, and the accel / max-velocity emphasis alternates
// so two top-speed days never land back to back.
assert(new Set(sprintTitles).size >= 6, `sprint pool too shallow: ${new Set(sprintTitles).size} distinct sessions`)
const MAXV_TITLES = new Set(['Max Velocity — Flying 20s', 'Flying 10s', 'Sprint · Float · Sprint', 'Change of Direction'])
for (let wk = 1; wk <= 11; wk++) {
  const t = hybridPower.buildDay(wk, 2, MAXES).items[0].title
  assert(MAXV_TITLES.has(t) === (wk % 2 === 0), `W${wk} "${t}": wrong pool for an ${wk % 2 === 1 ? 'odd (accel)' : 'even (max-V)'} week`)
}
// Friday volume trims (athlete's call): speed-oly −1 set, clean back-off −1 set.
assert([1, 5, 9].every(wk => itemAt(wk, 5, 'hang_psn') === undefined),
  'hang_psn was removed from Friday (FOR-188) and must not return')
assert(itemAt(5, 5, 'cl_back')?.sets === 2 && itemAt(9, 5, 'cl_back')?.sets === 1, 'clean back-offs should be 2 (M2) / 1 (M3)')
// Core survives on Monday in every meso — top+back-off is one block, so the
// broad jumps didn't have to displace it.
for (const wk of [1, 5, 9]) assert(nameAt(wk, 1, 'acc_core'), `W${wk}: Monday core missing`)
assert(nameAt(1, 1, 'acc_core') === 'Hanging Leg Raises' && nameAt(5, 1, 'acc_core') === 'Pallof Press' && nameAt(9, 1, 'acc_core') === 'Weighted Hanging Leg Raise', 'Mon core should rotate')
assert(nameAt(5, 3, 'acc_single_leg') === 'DB Reverse Lunge' && nameAt(9, 3, 'acc_single_leg') === 'Rear-Foot-Elevated Split Squat', 'Wed unilateral should rotate')
for (const [d, s] of [[1, 'sn_top'], [5, 'cl_top'], [1, 'back_squat_heavy'], [6, 'sat_dl'], [6, 'ohp_press'], [3, 'push_press'], [5, 'speed_squat']]) {
  assert(nameAt(1, d, s) === nameAt(5, d, s) && nameAt(5, d, s) === nameAt(9, d, s), `spine slot ${s} must NOT rotate`)
}

// The 4-set ceiling (FOR-188). Nothing pinned this before, which is how the
// config kept prescribing a fifth Monday squat that the athlete cut by hand
// every week for months — the suite passed the whole time.
for (const wk of [1, 2, 3, 4]) {
  const sq = itemAt(wk, 1, 'back_squat_heavy')
  assert(sq?.sets === 4, `W${wk} Mon squat should be 4 sets in M1, got ${sq?.sets}`)
}
assert(itemAt(1, 1, 'sn_top')?.note?.includes('65-70%'),
  'M1 snatch must carry the 65-70% warm-up singles that replace the Friday speed work')

// 9. Autoreg clamp extremes can't break floors (adjustments ±8 — the new
// MAX_ADJ, wide enough for the weight-follow — on every slot).
for (const sign of [-8, 8]) {
  const adj = {}
  for (const s of ['sn_top', 'sn_back', 'cl_top', 'cl_back', 'clean_pull', 'bench_heavy', 'back_squat_heavy']) adj[s] = sign
  for (const [week, day] of [[1, 1], [5, 1], [9, 5], [1, 5], [11, 1]]) {
    const plan = hybridPower.buildDay(week, day, MAXES, adj)
    for (const item of plan.items) {
      if (item.kind !== 'lift' || item.percent == null || !item.maxKey) continue
      if (OLY_KEYS.has(item.maxKey) && !item.slot.includes('pull') && !item.slot.includes('press')) {
        assert(item.percent >= 65, `ADJ${sign} W${week} D${day} ${item.slot}: pct ${item.percent} broke 65 floor`)
        assert(item.percent <= 98, `ADJ${sign} W${week} D${day} ${item.slot}: pct ${item.percent} absurd top`)
      }
    }
  }
}

// 10. Test week names.
const t1 = hybridPower.buildDay(13, 1, MAXES)
const t3 = hybridPower.buildDay(13, 3, MAXES)
assert(t1.items.some(i => i.kind === 'lift' && /^Snatch — work/.test(i.name)), 'Test D1 missing Snatch 1RM')
assert(t3.items.some(i => i.kind === 'lift' && /^Clean — work/.test(i.name)), 'Test D3 missing Clean 1RM')

// ── Report ────────────────────────────────────────────────────────────────────
const show = (day, slot, label) => {
  const rows = []
  for (let w = 1; w <= 11; w++) {
    const p = hybridPower.buildDay(w, day, MAXES).items.find(i => i.kind === 'lift' && i.slot === slot)
    if (p?.percent != null) rows.push(`W${w}:${p.percent}%(${p.sets}x${p.reps})`)
  }
  console.log(`${label}: ${rows.join('  ')}`)
}
console.log('── Monday Snatch (of FULL snatch max', MAXES.snatch, 'lb) ──')
show(1, 'sn_top', '  top'); show(1, 'sn_back', '  back')
console.log('── Friday Clean (of FULL clean max', MAXES.clean_jerk, 'lb) ──')
show(5, 'cl_top', '  top'); show(5, 'cl_back', '  back')
console.log('── Pulls / squat (of full-lift maxes) ──')
show(1, 'back_squat_heavy', '  mon squat'); show(5, 'clean_pull', '  clean pull')
console.log('── Wed volume bench (rotating) ──')
show(3, 'bench', '  wed bench')

// ── Autoreg meso-boundary guard ───────────────────────────────────────────────
// Week 5 is the M2 boundary: clean_pull becomes Snatch Pull off a DIFFERENT
// max. Feedback from week 4 describes the old lift and must not carry over.
// Slots whose lift is unchanged still must.
const { computeAdjustments } = await import('../../src/lib/programs/autoreg.ts')
const W4_LOGS = [
  { slot: 'cl_top', rpe: 8, weight_lbs: 230 },       // Power Clean → Power Clean (unchanged)
  { slot: 'clean_pull', rpe: 8, weight_lbs: 300 },   // Clean Pull → Snatch Pull (rotated + re-keyed)
  { slot: 'speed_squat', rpe: 6, weight_lbs: 250 },  // Speed Box Squat (unchanged)
]
const chain = data => {
  const o = { select: () => o, eq: () => o, order: () => o, limit: () => Promise.resolve({ data }), not: () => Promise.resolve({ data }) }
  return o
}
const fakeDb = { from: t => chain(t === 'generated_workouts' ? [{ id: 'w4' }] : W4_LOGS) }
const adj = await computeAdjustments(fakeDb, 'u1', hybridPower, 5, 5, MAXES)
assert(adj.clean_pull === undefined, `rotated clean_pull carried an adjustment (${adj.clean_pull})`)
assert(adj.cl_top != null && adj.cl_top > 0, `unchanged cl_top lost its adjustment (${adj.cl_top})`)
// speed_squat is unchanged across the boundary too, but it's a VELOCITY slot:
// loading above the window is the slot's failure mode, so autoreg must refuse
// to follow it up. Downward tracking is covered in autoreg-behaviour.mjs.
assert((adj.speed_squat ?? 0) <= 0, `velocity slot chased an overload (${adj.speed_squat})`)
console.log('\n── Autoreg at the M2 boundary (W4 logs → W5 build) ──')
console.log(`  carried: ${Object.entries(adj).map(([k, v]) => `${k}:${v > 0 ? '+' : ''}${v}`).join('  ') || '(none)'}`)
console.log('  blocked: clean_pull (rotated lift)')

console.log('\n── Speed day rotation (Tue) ──')
for (let wk = 1; wk <= 13; wk++) {
  console.log(`  W${String(wk).padStart(2)}: ${hybridPower.buildDay(wk, 2, MAXES).items[0].title}`)
}

console.log('\n── Blocks per gym day (budget 6; cards in parens) ──')
for (const wk of [1, 5, 9]) {
  const row = [1, 3, 5, 6].map(d => {
    const it = hybridPower.buildDay(wk, d, MAXES).items
    const blocks = it.filter(i => !i.slot.endsWith('_back')).length
    return `D${d}:${blocks}${blocks === it.length ? '' : `(${it.length})`}`
  })
  console.log(`  M${Math.ceil(wk / 4)}: ` + row.join('  '))
}
if (overBudget.size) console.log(`  ⚠ over 6: ${[...overBudget].join(', ')}`)

console.log('\n' + '═'.repeat(60))
if (fails.length) {
  console.log(`✗ ${fails.length} FAILURES of ${checks} checks:`)
  for (const f of fails) console.log('  -', f)
  process.exit(1)
} else {
  console.log(`✓ ALL RULES HOLD — ${checks} checks across 13 weeks`)
}
