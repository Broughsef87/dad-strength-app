// Deterministic sweep of the athletic-power hybridPower config.
// Run: npx tsx sweep.mjs (from repo root or with absolute path)
import { hybridPower } from '../../src/lib/programs/hybridPower.ts'
import { dadStrong } from '../../src/lib/programs/dadStrong.ts'
import { PROGRAMS } from '../../src/lib/programs/index.ts'
// The station rule and the week's shape are SHARED with the app now. The
// schedule screen kept its own copy of blockCount that only knew about
// *_back, so it would have printed '7 blocks' on a Saturday this suite calls
// 6. Importing it means the check and the screen cannot disagree again.
import { blockCount, isStationFree, scheduledDayNumbers, scheduledDoneDays }
  from '../../src/lib/programs/schedule.ts'
// RUN_EPOCH: these suites build their own fixtures and are not exercising
// run scoping, so they ask for every row.
import { RUN_EPOCH } from '../../src/lib/programs/run.ts'

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
// Cards that cost no extra station — isStationFree, imported above, is the
// one definition; see rule 8b for why plyo_2 is in it.
const stationFree = isStationFree
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
      // 4b. PURE full lifts at <=2 reps are heavy: >= 80 (working weeks) — on
      // the TOP sets. A *_back slot is the back-off that follows them, and it
      // takes the 75 doubles floor instead (rule 2b above already enforces
      // that). M2's snatch back-offs have run at 75 since this macro was
      // written and only cleared this rule because they were named 'Hang
      // Snatch'; FOR-195 puts the pure lift there in M1 at the same 75, so the
      // exemption is the slot, not the word. Bounded deliberately: a top slot
      // at 79 must still fail.
      const nm = item.name.trim().toLowerCase()
      if ((nm === 'snatch' || nm === 'clean') && item.reps <= 2 && week % 13 !== 12
          && !item.slot.endsWith('_back')) {
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

    // 7. Top/back-off relationship on power days — EVERY working meso now,
    // M1 included (FOR-195 items 1 and 8 gave it the structure M2/M3 had).
    // The old rule 8 said the opposite for weeks 1-4 and is gone with it.
    if ((day === 1 || day === 5) && week <= 11) {
      const lifts = plan.items.filter(i => i.kind === 'lift')
      const top = lifts.find(i => i.slot.endsWith('_top'))
      const back = lifts.find(i => i.slot.endsWith('_back'))
      assert(top && back, `W${week} D${day}: expected top+backoff pair`)
      // The back-off has to be genuinely lighter, not merely present: a
      // back-off at the top set's percentage is just two more working sets,
      // which is how a 4-set ceiling gets broken without any number changing.
      if (top && back) assert(back.percent < top.percent, `W${week} D${day}: backoff ${back.percent} >= top ${top.percent}`)
    }
    // 8b. Session budget: every gym day caps at 6 BLOCKS (non-test weeks).
    // The budget counts STATIONS you set up, not cards, which is why two kinds
    // of card are free:
    //   *_back   the same bar, immediately after the top set
    //   plyo_2   the second jump variation at the same box, back to back with
    //            the first — one trip to the corner, two movements
    // plyo_2 became load-bearing in FOR-195: Saturday gained the relocated core
    // slot, and M2/M3 are the mesos where saturdayPlyo returns a PAIR. Counted
    // as two stations that is 7 and the day is over budget; counted as the one
    // station it actually is, Saturday sits at 6 in every meso. Flagged to
    // Andrew — the alternative is dropping plyo_2 or the Saturday core, and
    // FOR-195 explicitly says to leave saturdayPlyo alone.
    if (((week - 1) % 13) + 1 !== 13) {
      const blocks = blockCount(plan)
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
// FRIDAY is CLEAN-PRIMARY (FOR-195 item 7). It used to be ordered strictly
// fast-to-heavy, which put the speed squat ahead of the clean. That ordering
// existed to protect the day's speed work from an 87-90% clean sitting in
// front of it — and with the snatch gone to Monday, the clean IS the day.
// Andrew's call: the primary gets the fresh slot, exactly like the squat does
// on Monday. The jumps still open (unloaded RFD is still first), and the speed
// squat is still velocity: true, so autoreg cannot chase it while fatigued.
const FRI_ORDER = ['seated_box_jump', 'cl_top', 'cl_back', 'speed_squat', 'clean_pull', 'acc_pullup']
for (const wk of [1, 2, 5, 9, 11]) {
  const s = hybridPower.buildDay(wk, 5, MAXES).items.map(i => i.slot)
  const pos = k => s.indexOf(k)
  assert(s.join(' → ') === FRI_ORDER.join(' → '), `W${wk} Fri order: ${s.join(' → ')}`)
  assert(pos('hang_psn') === -1, `W${wk} Fri: hang_psn was removed (FOR-188)`)
  // Every meso is 6 cards / 5 stations now — M1 gained the clean back-off.
  assert(s.length === 6, `W${wk} Fri: 6 cards expected, got ${s.length}`)
  // both present first: indexOf gives -1 for a missing slot, and -1 < n is
  // true, so the ordering assert alone would survive either one vanishing
  assert(pos('speed_squat') >= 0 && pos('cl_top') >= 0, `W${wk} Fri: speed squat and clean must both exist`)
  assert(pos('cl_top') < pos('speed_squat'), `W${wk} Fri: the clean is the primary and goes first`)
  assert(pos('cl_top') < pos('clean_pull'), `W${wk} Fri: clean before the pull`)
  assert(pos('acc_pullup') === s.length - 1, `W${wk} Fri: the row is the overflow block, must be last`)
  // No snatch survives on Friday in any form — that was the whole of item 6.
  for (const it of hybridPower.buildDay(wk, 5, MAXES).items) {
    assert(!/snatch/i.test(it.name ?? ''), `W${wk} Fri: ${it.name} — the snatch is Monday-only now`)
  }
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
// Wednesday order: push press → front squat → trap bar jump → DB bench.
const wedSlots = hybridPower.buildDay(1, 3, MAXES).items.map(i => i.slot)
assert(
  wedSlots.indexOf('push_press') < wedSlots.indexOf('front_squat') &&
  wedSlots.indexOf('front_squat') < wedSlots.indexOf('tb_jump') &&
  wedSlots.indexOf('tb_jump') < wedSlots.indexOf('db_bench'),
  `Wed order wrong: ${wedSlots.join(' → ')}`,
)
assert(nameAt(1, 1, 'bench_heavy') === 'Bench Press' && nameAt(5, 1, 'bench_heavy') === '1¼ Bench Press' && nameAt(9, 1, 'bench_heavy') === 'Bench Press', 'Mon bench: 1¼ in M2 only')
assert(nameAt(5, 3, 'front_squat') === 'Pause Front Squat' && nameAt(9, 3, 'front_squat') === 'Front Squat', 'front squat: pause in M2, straight in M3')
// FOR-195 item 6: the pull is a CLEAN pull in every meso, off the clean max.
// M2's snatch pull was the snatch's only heavy pulling, and the snatch has
// left this day entirely — a snatch pull on the clean day was the last thing
// keeping two lifts on one session.
for (const wk of [1, 5, 9]) {
  assert(nameAt(wk, 5, 'clean_pull') === 'Clean Pull', `W${wk} pull should be a Clean Pull`)
  assert(itemAt(wk, 5, 'clean_pull')?.maxKey === 'clean_jerk', `W${wk} pull must key off the clean max`)
}
// ...and the M1→M3 ramp is continuous now that it is one lift off one max:
// each meso tops out higher than the last, on fewer reps.
{
  // M3 stops at week 11: week 12 is the deload and drops the pull entirely.
  const topOf = wks => Math.max(...wks.map(wk => itemAt(wk, 5, 'clean_pull').percent))
  const [m1, m2, m3] = [topOf([1, 2, 3, 4]), topOf([5, 6, 7, 8]), topOf([9, 10, 11])]
  assert(m1 < m2 && m2 < m3, `pull ramp must ascend across mesos: ${m1} → ${m2} → ${m3}`)
  assert(itemAt(1, 5, 'clean_pull').reps > itemAt(5, 5, 'clean_pull').reps
      && itemAt(5, 5, 'clean_pull').reps > itemAt(9, 5, 'clean_pull').reps,
    'pull reps must fall as the percentage climbs')
}
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
// ── Wednesday's DB bench: the program's first double-progression slot ──────
// (FOR-195 item 4.) Dumbbells in every meso, off no max at all: the load comes
// from logged history, not a percentage. The old barbell/close-grip rotation
// is gone, and so is the 'bench' slot id — deliberately, because the day page
// looks progression history up BY SLOT across every program. Reusing 'bench'
// would have fed years of 185 lb barbell sets in as the working DB weight.
assert(itemAt(1, 3, 'bench') === undefined && itemAt(5, 3, 'bench') === undefined,
  "the Wednesday 'bench' slot is retired — its history is barbell, this slot is dumbbells")
for (const [wk, sets, lo, hi] of [[1, 4, 8, 10], [5, 4, 6, 8], [9, 3, 5, 6]]) {
  const it = itemAt(wk, 3, 'db_bench')
  assert(it?.name === 'DB Bench Press', `W${wk} Wed press should be the DB bench, got ${it?.name}`)
  assert(it?.percent === undefined && it?.maxKey === undefined,
    `W${wk} db_bench must leave the percent engine — a DB load has no barbell 1RM behind it`)
  assert(it?.sets === sets, `W${wk} db_bench should be ${sets} sets, got ${it?.sets}`)
  assert(it?.repRange?.[0] === lo && it?.repRange?.[1] === hi,
    `W${wk} db_bench window should be ${lo}-${hi}, got ${JSON.stringify(it?.repRange)}`)
  assert(it?.reps === lo, `W${wk} db_bench reps must carry the BOTTOM of the window, got ${it?.reps}`)
  assert(it?.loadStepLbs === 5, `W${wk} db_bench step should be 5 lb/hand, got ${it?.loadStepLbs}`)
  assert(it?.superset === 'press_pull', `W${wk} db_bench must stay supersetted with the weighted pull-ups`)
  assert(/per hand/i.test(it?.note ?? ''), `W${wk} db_bench note must say the weight is per hand`)
}
// THE WIRING, and the only assertion here that would have caught the FOR-175
// failure mode: hybridPower.buildDay did not read opts.loadTargets at all
// before this ticket. Everything above passes with the slot printing blank
// forever; only this fails.
{
  assert(itemAt(1, 3, 'db_bench')?.targetWeightLbs === undefined,
    'no loadTargets → no invented weight')
  const wired = hybridPower.buildDay(1, 3, MAXES, {}, { loadTargets: { db_bench: 60 } })
    .items.find(i => i.slot === 'db_bench')
  assert(wired?.targetWeightLbs === 60,
    `buildDay must read opts.loadTargets — got ${wired?.targetWeightLbs}, want 60`)
}
// Deload has to reach a range slot by SETS: it has no percent to cut, so
// without this the barbell drops to 60% while the DB bench asks for four sets.
{
  const dl = hybridPower.buildDay(12, 3, MAXES).items.find(i => i.slot === 'db_bench')
  assert(dl?.sets === 2, `deload db_bench should be 2 sets, got ${dl?.sets}`)
}
assert(nameAt(1, 5, 'acc_pullup') === 'Seated Cable Row' && nameAt(5, 5, 'acc_pullup') === 'Pendlay Row' && nameAt(9, 5, 'acc_pullup') === 'Chest-Supported Row', 'Fri pull slot should rotate')
// Horizontal pulling in ALL THREE mesos now (FOR-195 item 9). M1 ran a
// pull-up, which is vertical — and Wednesday already owns vertical pulling
// with weighted pull-ups in every meso, so one meso in three answered five
// weekly pressing exposures by repeating Wednesday.
for (const wk of [1, 5, 9]) {
  assert(/row/i.test(nameAt(wk, 5, 'acc_pullup') ?? ''), `W${wk}: Friday needs a horizontal row`)
  assert(nameAt(wk, 5, 'acc_pullup') !== nameAt(wk, 3, 'acc_wpu'), `W${wk} Friday pull duplicates Wednesday`)
}
// ── Core: relocated from Monday to Saturday (FOR-195 items 3 + 11b) ───────
// Monday sheds the block for time; Saturday runs it as DEALER'S CHOICE —
// deliberately untracked, because Andrew rotates core work by feel and
// prescribing one movement just means he substitutes it. The rotation IS the
// prescription; three sets is the only part the program insists on.
for (const wk of [1, 5, 9]) {
  assert(itemAt(wk, 1, 'acc_core') === undefined, `W${wk}: core must be off Monday`)
  const core = itemAt(wk, 6, 'acc_core')
  assert(core?.name === "Core — Dealer's Choice", `W${wk}: Saturday core missing, got ${core?.name}`)
  assert(core?.sets === 3, `W${wk}: Saturday core should be 3 sets, got ${core?.sets}`)
  // Untracked means untracked: a repRange would silently enrol it in double
  // progression against Monday's old acc_core history, and a percent or a
  // maxKey would put it back on the percent engine.
  assert(core?.repRange === undefined && core?.percent === undefined && core?.maxKey === undefined,
    `W${wk}: the dealer's-choice core must carry no range, percent or max`)
  // The note is the prescription, so it has to actually offer the options —
  // including the anti-rotation work that used to be M2's Pallof press and is
  // otherwise trained nowhere in the program.
  assert(/pallof/i.test(core?.note ?? ''), `W${wk}: no anti-rotation option offered`)
  assert(/10-15/.test(core?.note ?? ''), `W${wk}: the 10-15 rep window must be stated`)
}
// ...and it drops on the deload Saturday like every other accessory.
assert(itemAt(12, 6, 'acc_core') === undefined, 'deload Saturday must not carry the core slot')
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
// Jumps: broad jumps open Monday in EVERY meso (FOR-195 item 2 — they were
// M2-only, so two thirds of the macro had no horizontal power in it at all);
// seated box jumps every Friday.
for (const wk of [1, 5, 9]) assert(nameAt(wk, 1, 'broad_jump') === 'Broad Jump', `W${wk}: Monday needs broad jumps`)
// Broad jumps OPEN Monday and are unlinked — no room to jump by the racks, so
// they can't be a squat contrast pair, and doing them last would mean fatigued
// jumps. Fresh, first, one trip to the open floor.
for (const wk of [1, 5, 9]) {
  const mon = hybridPower.buildDay(wk, 1, MAXES)
  assert(mon.items[0].slot === 'broad_jump', `W${wk}: broad jumps must open Monday, got ${mon.items[0].slot}`)
  assert(!mon.items.some(i => i.superset === 'sq_contrast'), `W${wk}: broad jumps must not be superset with the squat`)
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
// ── The Day-5 set-ceiling case (FOR-195 §3) ───────────────────────────────
// Item 8 asked for more heavy clean volume. Andrew's raw note put it on the
// primary "if there are no back offs", which would have made M1 6×2 and
// failed the 4-set ceiling he ratified two days earlier. It went into the
// back-offs instead: +2 sets in M1 and M2, +3 in M3, and nothing past 4.
assert(itemAt(1, 5, 'cl_back')?.sets === 2, `M1 clean back-offs should be 2, got ${itemAt(1, 5, 'cl_back')?.sets}`)
assert(itemAt(5, 5, 'cl_back')?.sets === 4 && itemAt(9, 5, 'cl_back')?.sets === 4, 'clean back-offs should be 4 (M2) / 4 (M3)')
for (const wk of [1, 5, 9]) {
  assert(itemAt(wk, 5, 'cl_top').sets <= 4 && itemAt(wk, 5, 'cl_back').sets <= 4,
    `W${wk} Fri: a clean slot went past the 4-set ceiling`)
}
// The one slot on this day allowed past 4, and only because it is genuinely
// sub-maximal: 5×3 @ 55% off a box is speed, which is the exemption in the
// athlete's own words. M1 goes to TRIPLES (item 10) — the lightest wave of
// the three, so the extra rep costs seconds and buys bar-speed reps.
for (const [wk, sets, reps] of [[1, 5, 3], [5, 5, 2], [9, 4, 2]]) {
  const sq = itemAt(wk, 5, 'speed_squat')
  assert(sq.sets === sets && sq.reps === reps,
    `W${wk} Fri: speed squat should be ${sets}×${reps}, got ${sq.sets}×${sq.reps}`)
  assert(sq.velocity === true && sq.targetRpe === undefined,
    `W${wk} Fri: speed squat must stay a velocity slot with no RPE anchor`)
}
// Monday: the top set sheds two sets, the back-offs carry the volume (item 1).
assert(itemAt(1, 1, 'sn_top')?.sets === 2, `M1 snatch top should be 2 sets, got ${itemAt(1, 1, 'sn_top')?.sets}`)
for (const [wk, sets, lo] of [[1, 3, 75], [5, 3, 75], [9, 2, 83]]) {
  const b = itemAt(wk, 1, 'sn_back')
  assert(b?.sets === sets, `W${wk} snatch back-offs should be ${sets} sets, got ${b?.sets}`)
  assert(b?.percent === lo, `W${wk} snatch back-offs should open at ${lo}%, got ${b?.percent}`)
}
// M1's back-offs are the PURE lift (M1 is the pure-lift meso); M2 hangs.
assert(nameAt(1, 1, 'sn_back') === 'Snatch', 'M1 snatch back-offs must be the full lift, not the hang')
// Wednesday: front squat 3 sets everywhere, jumps paired one-for-one (item 5).
for (const wk of [1, 5, 9]) {
  assert(itemAt(wk, 3, 'front_squat')?.sets === 3, `W${wk} front squat should be 3 sets, got ${itemAt(wk, 3, 'front_squat')?.sets}`)
  const tb = hybridPower.buildDay(wk, 3, MAXES).items.find(i => i.slot === 'tb_jump')
  assert(tb?.sets === 3 && tb?.reps === 3, `W${wk} trap bar jumps should be 3×3, got ${tb?.sets}×${tb?.reps}`)
}
// Saturday: M2 pulls from a deficit at a deliberately lighter % (item 11).
assert(nameAt(1, 6, 'sat_dl') === 'Deadlift' && nameAt(9, 6, 'sat_dl') === 'Deadlift', 'M1/M3 deadlifts stay conventional')
assert(nameAt(5, 6, 'sat_dl') === 'Deficit Deadlift', `M2 should pull from a deficit, got ${nameAt(5, 6, 'sat_dl')}`)
assert(itemAt(5, 6, 'sat_dl')?.percent === 72, `M2 deficit should open at 72%, got ${itemAt(5, 6, 'sat_dl')?.percent}`)
assert(itemAt(5, 6, 'sat_dl')?.percent < itemAt(1, 6, 'sat_dl')?.percent + 8,
  'a deficit at the conventional percentage is a different, harder lift — the load must come down')
assert(nameAt(5, 3, 'acc_single_leg') === 'DB Reverse Lunge' && nameAt(9, 3, 'acc_single_leg') === 'Rear-Foot-Elevated Split Squat', 'Wed unilateral should rotate')
// sat_dl left the spine in FOR-195 item 11: M2 pulls from a deficit, which is
// the variation meso finally reaching the deadlift. The config had already
// blessed it ("deficit deadlifts are legal for future mesos") and the M2
// rotation is asserted above. Everything else still never rotates.
for (const [d, s] of [[1, 'sn_top'], [5, 'cl_top'], [1, 'back_squat_heavy'], [6, 'ohp_press'], [3, 'push_press'], [5, 'speed_squat']]) {
  assert(nameAt(1, d, s) === nameAt(5, d, s) && nameAt(5, d, s) === nameAt(9, d, s), `spine slot ${s} must NOT rotate`)
}

// The 4-set ceiling (FOR-188). Nothing pinned this before, which is how the
// config kept prescribing a fifth Monday squat that the athlete cut by hand
// every week for months — the suite passed the whole time.
for (const wk of [1, 2, 3, 4]) {
  const sq = itemAt(wk, 1, 'back_squat_heavy')
  assert(sq?.sets === 4, `W${wk} Mon squat should be 4 sets in M1, got ${sq?.sets}`)
}
// The 65-70% warm-up-singles note is GONE (FOR-195 item 1 supersedes FOR-188's
// patch). It was a workaround for an M1 with no sub-maximal snatch in it; the
// 3×2 @ 75-78 back-offs asserted above are the real fix, and keeping both
// would have the card telling him to warm up to a weight he then backs off to.
assert(!/65-70%/.test(itemAt(1, 1, 'sn_top')?.note ?? ''),
  'the M1 warm-up-singles note should have gone with the back-offs')

// ── 8d. THE WEEK IS SIX DAYS (FOR-195 item 12) ────────────────────────────
// Sunday's steady Z2 was the seventh session in a week with no valley in it,
// and the card itself told him to skip it. Cutting it is most of the ~40-55
// min/week this revision gives back.
//
// The blast radius is daysPerWeek, because every surface derives from it —
// the dashboard week strip, the hub's week list, the done-days pills, the
// next-session button, and advanceWeekIfDone all iterate 1..daysPerWeek. So
// the two assertions that matter are: the count is 6, and day 7 builds
// nothing. Nothing else has to know.
assert(hybridPower.daysPerWeek === 6, `daysPerWeek must be 6, got ${hybridPower.daysPerWeek}`)
for (let wk = 1; wk <= 13; wk++) {
  const sun = hybridPower.buildDay(wk, 7, MAXES)
  assert(sun.dayType === 'rest', `W${wk} D7 should be a rest day, got ${sun.dayType}`)
  assert(sun.items.length === 0, `W${wk} D7 still prescribes ${sun.items.length} item(s)`)
  // ...and every day the app DOES render has something in it. A daysPerWeek
  // that overshoots would print an empty card; one that undershoots would
  // hide a real session, and neither shows up anywhere else.
  for (let d = 1; d <= hybridPower.daysPerWeek; d++) {
    const p = hybridPower.buildDay(wk, d, MAXES)
    assert(p.items.length > 0, `W${wk} D${d} renders an empty day`)
    assert(p.dayType !== 'rest', `W${wk} D${d} is a rest day inside daysPerWeek`)
  }
}
// The description has to stop advertising the session that was cut.
assert(!/two conditioning sessions/i.test(hybridPower.description),
  'the description still promises two outside conditioning sessions')
assert(/sunday is off/i.test(hybridPower.description),
  'the description should say Sunday is off')

// ── 8e. Thursday runs a four-session cycle, one per week in the meso ──────
// (FOR-195 item 13.) It used to be the same interval session twelve weeks
// running — one shape, one energy system. Deterministic and keyed to
// weekInMeso, so the cycle restarts with each meso.
const THU_CYCLE = ['cond_intervals', 'cond_threshold', 'cond_distance', 'cond_tempo']
for (const start of [1, 5]) {
  const got = [0, 1, 2, 3].map(k => hybridPower.buildDay(start + k, 4, MAXES).items[0])
  assert(got.map(g => g.slot).join(',') === THU_CYCLE.join(','),
    `W${start}-${start + 3} Thu cycle: ${got.map(g => g.slot).join(',')}`)
  assert(new Set(got.map(g => g.title)).size === 4,
    `W${start}-${start + 3} Thu: four weeks must be four DIFFERENT sessions`)
  for (const g of got) assert((g.parts ?? []).length >= 2, `${g.title}: session has no content`)
  // The day is named after whatever the session turned out to be.
  for (const k of [0, 1, 2, 3]) {
    const day = hybridPower.buildDay(start + k, 4, MAXES)
    assert(day.dayName === day.items[0].title, `W${start + k} Thu name/title mismatch`)
  }
}
// Meso 3 gets weeks 1-3 of the cycle; its fourth week is the DELOAD, which
// short-circuits above the cycle and keeps its recovery spin. Test week too.
assert([9, 10, 11].map(wk => hybridPower.buildDay(wk, 4, MAXES).items[0].slot).join(',')
  === THU_CYCLE.slice(0, 3).join(','), 'M3 Thu should run weeks 1-3 of the cycle')
for (const wk of [12, 13]) {
  assert(hybridPower.buildDay(wk, 4, MAXES).items[0].title === 'Easy Spin (recovery)',
    `W${wk} Thu should stay the recovery spin`)
}
// The interval week keeps its meso grading — the hardest session still gets
// harder across the macro, which is what the cycle must not flatten.
assert(new Set([1, 5, 9].map(wk => hybridPower.buildDay(wk, 4, MAXES).items[0].parts[1])).size === 3,
  'the interval week must still grade by meso')

// ── 8f. A completion for a day the program no longer runs is HISTORY ─────
// Codex [P2] on this branch. Cutting Sunday moved every surface that derives
// from daysPerWeek, but the session_complete sentinels already in the table did
// not move: advanceWeekIfDone counts doneDays.length against daysPerWeek, so a
// legacy day-7 row stands in for a session never trained and the week advances
// a day early — permanently, because current_week is the macro position the
// whole percent engine reads.
//
// The rows are real training and stay where they are. They just stop counting.
{
  const n = hybridPower.daysPerWeek
  // The exact live shape: five real sessions plus the ghost Sunday.
  assert(scheduledDoneDays([1, 2, 3, 5, 6, 7], hybridPower, 1).length < n,
    'a legacy day-7 sentinel must not complete a six-day week')
  assert(scheduledDoneDays([1, 2, 3, 4, 5, 6], hybridPower, 1).length === n,
    'a genuinely finished week must still complete')
  assert(scheduledDoneDays([0, -1, 7, 8, NaN], hybridPower, 1).length === 0, 'out-of-range days are dropped')
  assert(scheduledDoneDays([1, 2, 3], hybridPower, 1).join() === '1,2,3', 'scheduled days pass through untouched')
  assert(scheduledDayNumbers(hybridPower, 1).join() === '1,2,3,4,5,6',
    `Power Dad should run days 1-6, got ${scheduledDayNumbers(hybridPower, 1).join()}`)

  // Codex [P2], round 2, and the reason this filters by SCHEDULED DAYS rather
  // than `<= daysPerWeek`. daysPerWeek is a COUNT, not a range: Dad Strong is
  // 5 days on Mon/Tue/Thu/Sat/Sun. The first version of this filter dropped
  // days 6 and 7 as out of range, which capped that program at 3 done days
  // against a threshold of 5 — its week could never have advanced again.
  assert(scheduledDayNumbers(dadStrong, 1).join() === '1,2,4,6,7',
    `Dad Strong runs Mon/Tue/Thu/Sat/Sun, got ${scheduledDayNumbers(dadStrong, 1).join()}`)
  assert(scheduledDoneDays([1, 2, 4, 6, 7], dadStrong, 1).length === dadStrong.daysPerWeek,
    'Dad Strong must still be able to finish a week — days 6 and 7 are real sessions')

  // Codex [P1], round 3, and the reason the rule is scheduled-OR-RENDERED.
  // Filtering to the scheduled days ALONE strands Dad Strong from the other
  // direction: its hub renders days 1-5, so 6 and 7 are unreachable, while 3
  // and 5 render as rest days the finish button still completes. Its week
  // advances today on exactly those two fake completions. Both halves of the
  // OR are load-bearing, so both are pinned.
  const rendered = Array.from({ length: dadStrong.daysPerWeek }, (_, i) => i + 1)
  assert(scheduledDoneDays(rendered, dadStrong, 1).length === dadStrong.daysPerWeek,
    'a Dad Strong week completed through the UI as it stands must still advance')

  // ...and the whole point: this changes ONE thing in the codebase. Every
  // program's own rendered week still counts in full; only Power Dad's
  // now-unscheduled, now-unrendered day 7 is dropped.
  for (const p of Object.values(PROGRAMS)) {
    const own = Array.from({ length: p.daysPerWeek }, (_, i) => i + 1)
    assert(scheduledDoneDays(own, p, 1).length === p.daysPerWeek,
      `${p.slug}: its own rendered week must count in full`)
  }
  assert(scheduledDoneDays([7], hybridPower, 1).length === 0,
    'Power Dad day 7 is neither scheduled nor rendered — it is the ghost')

  // ...and the call sites still USE it. This is the class of wiring that
  // disappears in a refactor while every behavioural assertion above keeps
  // passing, because they all drive the helper directly.
  const { readFileSync } = await import('node:fs')
  const readLF = (u) => readFileSync(new URL(u, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  const day = readLF('../../src/app/train/[program]/[day]/page.tsx')
  // Scoped to the FUNCTION, not the file. Written first as a plain regex over
  // the whole page, which passed with the filter deleted from
  // advanceWeekIfDone — because the debrief counter lower down calls
  // scheduledDoneDays too and satisfied the pattern. Presence-in-file is not
  // the claim; presence in the function that advances the week is.
  const advance = day.slice(day.indexOf('async function advanceWeekIfDone('))
  const body = advance.slice(0, advance.indexOf('\n}\n'))
  assert(body.length > 0 && body.length < 2000, 'could not isolate advanceWeekIfDone')
  assert(/scheduledDoneDays\(/.test(body),
    'advanceWeekIfDone must filter done days to the ones the program schedules')
  for (const [file, url] of [
    ['dashboard', '../../src/app/dashboard/page.tsx'],
    ['ActiveProgram', '../../src/components/ActiveProgram.tsx'],
  ]) {
    assert(readLF(url).includes('scheduledDoneDays('), `${file} still counts done days unfiltered`)
  }
  // The schedule screen must not keep its own block rule. It did, and only
  // this suite learned that plyo_2 shares a station — so the app would have
  // shown Saturday breaking a budget the program says it meets.
  const hub = readLF('../../src/app/train/[program]/page.tsx')
  assert(/import {[^}]*blockCount[^}]*} from '.*programs\/schedule'/.test(hub),
    'the schedule screen must import blockCount, not define its own')
  assert(!/const blockCount\s*=/.test(hub), 'the schedule screen still defines a local blockCount')
}

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
console.log('── Wed DB bench (double progression, no percent) ──')
{
  const rows = []
  for (let w = 1; w <= 11; w++) {
    const p = hybridPower.buildDay(w, 3, MAXES).items.find(i => i.slot === 'db_bench')
    if (p) rows.push(`W${w}:${p.sets}x${p.repRange[0]}-${p.repRange[1]}`)
  }
  console.log(`  db bench: ${rows.join('  ')}`)
}
console.log('── Sat deadlift (M2 pulls from a deficit) ──')
show(6, 'sat_dl', '  sat dl')
console.log('\n── Thursday engine cycle ──')
for (let wk = 1; wk <= 13; wk++) {
  console.log(`  W${String(wk).padStart(2)}: ${hybridPower.buildDay(wk, 4, MAXES).items[0].title}`)
}

// ── Autoreg meso-boundary guard ───────────────────────────────────────────────
// Week 5 is the M2 boundary, where slots rotate to a different exercise (and
// sometimes a different max). Feedback from week 4 describes the OLD movement
// and must not carry over; slots whose lift is unchanged still must.
//
// The fixture moved from Friday to Monday in FOR-195. It used to lean on
// clean_pull rotating into a snatch pull — item 6 deleted that rotation, so
// Friday no longer HAS a percent slot that changes lift at the boundary and
// the test would have been asserting a guard it no longer exercised. Monday
// has two: bench_heavy (Bench Press → 1¼ Bench Press) and sn_back (Snatch →
// Hang Snatch), against back_squat_heavy and sn_top which do not move.
const { computeAdjustments } = await import('../../src/lib/programs/autoreg.ts')
const chain = data => {
  const o = { select: () => o, eq: () => o, gte: () => o, order: () => o, limit: () => Promise.resolve({ data }), not: () => Promise.resolve({ data }) }
  return o
}
const fakeDbOf = logs => ({ from: t => chain(t === 'generated_workouts' ? [{ id: 'w4' }] : logs) })

const MON_W4_LOGS = [
  { slot: 'sn_top', rpe: 8, weight_lbs: 180 },            // Snatch → Snatch (unchanged)
  { slot: 'bench_heavy', rpe: 8, weight_lbs: 230 },       // Bench → 1¼ Bench (rotated)
  { slot: 'sn_back', rpe: 8, weight_lbs: 165 },           // Snatch → Hang Snatch (rotated)
  { slot: 'back_squat_heavy', rpe: 6, weight_lbs: 300 },  // Back Squat (unchanged)
]
const monAdj = await computeAdjustments(fakeDbOf(MON_W4_LOGS), 'u1', hybridPower, 5, 1, RUN_EPOCH, MAXES)
assert(monAdj.bench_heavy === undefined, `rotated bench_heavy carried an adjustment (${monAdj.bench_heavy})`)
assert(monAdj.sn_back === undefined, `rotated sn_back carried an adjustment (${monAdj.sn_back})`)
assert(monAdj.back_squat_heavy != null && monAdj.back_squat_heavy > 0,
  `unchanged back_squat_heavy lost its adjustment (${monAdj.back_squat_heavy})`)

// Friday's own case. clean_pull is the SAME lift off the SAME max in every
// meso now, so the adjustment has to survive the boundary — the mirror image
// of the assertion it replaces, and it fails if item 6 is ever reverted
// halfway.
const FRI_W4_LOGS = [
  { slot: 'cl_top', rpe: 8, weight_lbs: 230 },       // Power Clean → Power Clean (unchanged)
  { slot: 'clean_pull', rpe: 8, weight_lbs: 300 },   // Clean Pull → Clean Pull (unchanged now)
  { slot: 'speed_squat', rpe: 6, weight_lbs: 250 },  // Speed Box Squat (unchanged)
]
const adj = await computeAdjustments(fakeDbOf(FRI_W4_LOGS), 'u1', hybridPower, 5, 5, RUN_EPOCH, MAXES)
assert(adj.clean_pull != null, 'clean_pull no longer rotates at the boundary — its feedback must carry')
assert(adj.cl_top != null && adj.cl_top > 0, `unchanged cl_top lost its adjustment (${adj.cl_top})`)
// speed_squat is unchanged across the boundary too, but it's a VELOCITY slot:
// loading above the window is the slot's failure mode, so autoreg must refuse
// to follow it up. Downward tracking is covered in autoreg-behaviour.mjs.
assert((adj.speed_squat ?? 0) <= 0, `velocity slot chased an overload (${adj.speed_squat})`)
console.log('\n── Autoreg at the M2 boundary (W4 logs → W5 build) ──')
console.log(`  Mon carried: ${Object.entries(monAdj).map(([k, v]) => `${k}:${v > 0 ? '+' : ''}${v}`).join('  ') || '(none)'}`)
console.log('  Mon blocked: bench_heavy, sn_back (rotated lifts)')
console.log(`  Fri carried: ${Object.entries(adj).map(([k, v]) => `${k}:${v > 0 ? '+' : ''}${v}`).join('  ') || '(none)'}`)

console.log('\n── Speed day rotation (Tue) ──')
for (let wk = 1; wk <= 13; wk++) {
  console.log(`  W${String(wk).padStart(2)}: ${hybridPower.buildDay(wk, 2, MAXES).items[0].title}`)
}

console.log('\n── Blocks per gym day (budget 6; cards in parens) ──')
for (const wk of [1, 5, 9]) {
  const row = [1, 3, 5, 6].map(d => {
    const plan = hybridPower.buildDay(wk, d, MAXES)
    const it = plan.items
    const blocks = blockCount(plan)
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
