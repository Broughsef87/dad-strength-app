// ── Ballistic load (FOR-244) — a standing invariant, its own file ───────────
// Andrew has a lower-abdominal strain he attributes to broad jumps in Power
// Dad. Power Dad opened Monday with four sets of three maximal broad jumps as
// the FIRST thing in the session, in a cold garage, in every meso from week
// one. Nothing in scripts/checks/ counted ballistic volume at all.
//
// Three assertions, and the order matters:
//
//   A. EVERY BALLISTIC OR SPRINT DAY RENDERS A PREP SLOT. This is the
//      confirmed defect and the red-first assertion: it fails on e834df8
//      because no gym day has one. "First in the session" and "warmed up" were
//      treated as the same thing, and they are opposites.
//
//   B. NO JUMP HIDES IN PROSE. A jump written into an outside session's parts
//      or a metcon's whiteboard text, with no structured line behind it, is
//      load nothing can count — and a ceiling over a number that omits it is
//      worse than no ceiling, because it manufactures confidence. So every
//      jump is either a slot or a metcon line this file knows how to read, and
//      anything jump-shaped that it cannot read is a FAILURE, not a zero.
//
//   C. NO PROGRAM EXCEEDS ITS CEILING. Proven able to fail BY MUTATION —
//      raise a program's volume and watch this go red — never by whether Power
//      Dad happens to trip it today. The ceiling is NEVER tuned until Power Dad
//      fails: that is fitting the instrument to the conclusion, and it is how a
//      number nobody can recompute ships as a standard (FOR-244 AC4, and
//      Andrew's ruling of 2026-09-16).
//
// THE COUNTING UNIT, stated here because a number nobody can recompute is
// worse than no number (FOR-244 §4, ruling rows 3, 6 and 10):
//   · ONE unit: every landing, prep included. No carve-outs, no second unit.
//   · A depth jump, a depth drop, a box jump and a metcon box jump are 1 landing
//     each — UKSCA's own convention. No invented multiplier.
//   · A bound strike is 2.0 m of ground covered, so 30 m of bounding is 15.
//   · Lateral bounds count PER SIDE.
//   · "A or B" counts as the harder option.
//   · A carry is not a landing (Dad Built's only plyo slot is a farmer carry).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { PROGRAMS } from '../../src/lib/programs/index.ts'
import { rampStage, exposureWeek } from '../../src/lib/programs/prep.ts'
import { blockCount, isStationFree } from '../../src/lib/programs/schedule.ts'

let failures = 0, passes = 0
const assert = (cond, msg) => { if (cond) passes++; else { failures++; console.log('  ✗ ' + msg) } }
const ROOT = fileURLToPath(new URL('../../', import.meta.url))

// Lifts the athlete might hold. The numbers do not matter to a landing count;
// they exist so buildDay renders.
const MAXES = { snatch: 185, clean_jerk: 225, back_squat: 315, front_squat: 255, deadlift: 405, bench: 225, press: 135, ohp: 135, push_press: 165, strict_press: 135, weighted_pullup: 90, row: 185 }
const MODES = [
  { label: 'full', opts: {} },
  { label: 'deload', opts: { forceDeload: true } },
  { label: 'short', opts: { timeConstrained: true } },
]

// ── The ceilings ────────────────────────────────────────────────────────────
// PER SESSION: 80–100 foot contacts is the published beginner range (Potach &
// Chu in NSCA's Essentials 4th ed. ch. 18; UKSCA, Brearley et al. 2017). The
// ceiling takes the TOP of that range, so the check fails only on volume no
// source defends.
const SESSION_CEILING = 100
// PER WEEK: NO AUTHORITATIVE WEEKLY LIMIT EXISTS. This is a DELIBERATE
// CONSERVATIVE DEFAULT, derived and labelled as one rather than presented as a
// standard: the sourced per-session figure times the top of NSCA's sourced
// two-to-three plyometric sessions a week (p. 477). Derived, not sourced.
const WEEK_CEILING = SESSION_CEILING * 3

// ── Landings ────────────────────────────────────────────────────────────────
const METRES_PER_BOUND_STRIDE = 2.0

/** Words that mean a foot leaves the ground and comes back. Used to catch load hiding in prose. */
const JUMP_WORDS = /\b(jump|jumps|bound|bounds|bounding|hop|hops|hurdle|depth drop|drop freeze|plyo|plyometric|skip|skips|burpee|burpees)\b/i

// ── AC2, AMENDED (FOR-268) ─────────────────────────────────────────────────
//
// AC2 as shipped: no maximal horizontal or depth jump is prescribed before the
// ramp completes. I held FOR-268's depth jump for exactly that reason, and
// Blaine ruled on 2026-10-07 that the newer specific request wins — AC2 exists
// so a lifter never meets reactive work COLD, and Andrew has had four weeks of
// trap bar and box jumps and chose depth jumps himself after hearing why.
//
// The exemption is NARROW BY CONSTRUCTION: one program, one day, one slot, from
// one exposure week. "Every other program and stage keeps the ramp as shipped"
// is the ruling's wording, and section A2b below proves that rather than
// trusting this comment — each field is probed by flipping it and watching the
// breach come back.
//
// An entry needs a reason, and the reason carries the date of the ruling that
// granted it, so an exemption nobody can trace back cannot sit here quietly.
const RAMP_EXEMPTIONS = [
  {
    program: 'hybrid-power',
    day: 3,
    slot: 'depth_jump',
    // THE MOVEMENT, not just the slot key. Keying on the slot alone meant a
    // maximal BROAD JUMP carrying slot: 'depth_jump' was exempt, and Codex r2
    // proved it by renaming W6's movement — both suites stayed green. An
    // unapproved maximal horizontal prescription walking out through a grant
    // written for a vertical one is the gate not gating.
    movement: /^depth jump$/i,
    // AND THE POSITION. The grant is for meso 2's Wednesday. Without this it
    // also admitted a Wednesday depth jump in the SECOND macro's meso 1 and
    // meso 3 at a restarted exposure of 5 (Codex r2).
    meso: 2,
    fromExposure: 5,
    reason:
      "Blaine's ruling 2026-10-07 (FOR-268): Andrew's own newer request, after four weeks " +
      'of trap bar and box jumps. The ramp survives in the drop height — 12" in W5-6, 18" in ' +
      'W7-8 — because the box is the dose of a depth jump. hybrid-power Wednesday, meso 2 only.',
  },
]

/** Which meso an absolute week falls in — 4-week blocks, the test week its own. */
const mesoOfWeek = (week, macroWeeks) => Math.ceil((((week - 1) % macroWeeks) + 1) / 4)

/**
 * Is this maximal jump exempt from the ramp, by a written and dated grant?
 *
 * EVERY field has to match: the program, the day, the slot key, the MOVEMENT
 * the slot is carrying, the meso, and the exposure.
 *
 * `meso` and `exposure` arrive as NUMBERS rather than being derived from the
 * week in here, and that is deliberate. Derived from one week with origin 1
 * they are collinear — meso 2 always means exposure >= 5 — so `fromExposure`
 * could not be made to fail and was unprobeable dead weight. My own mutation
 * run caught that: lowering it to 1 left the suite green. Taking them as
 * arguments lets A2b vary one while holding the other.
 */
const rampExempt = (slug, day, item, { meso, exposure }) =>
  RAMP_EXEMPTIONS.some(
    (e) =>
      e.program === slug &&
      e.day === day &&
      e.slot === item.slot &&
      e.movement.test((item.name ?? '').trim()) &&
      meso === e.meso &&
      exposure >= e.fromExposure,
  )

/**
 * The breach decision, in one named place.
 *
 * Extracted so A2b can assert the DECISION both ways instead of only the
 * grant. The loop's wiring — that this is actually consulted for every item —
 * is still not provable from inside this file; see the note in A2b.
 */
const isRampBreach = (stage, item, slug, day, ctx) =>
  stage !== 'full' &&
  /broad jump|depth jump|depth drop/i.test(item.name ?? '') &&
  item.ramp !== stage &&
  !rampExempt(slug, day, item, ctx)
/** Prose that mentions a jump word but is NOT load: a cue, a name, a caution. */
const NOT_LOAD = /\b(step-over|step-overs|step over|no jogging|cooldown|walk|stretch)\b/i

/**
 * Landings in one structured plyo line. A carry is not a landing; anything this
 * does not recognise returns null so the caller can fail loudly rather than
 * silently scoring it zero.
 */
export function plyoLandings(item) {
  const name = `${item.name} ${item.note ?? ''}`.toLowerCase()
  const reps = (item.sets ?? 0) * (item.reps ?? 0)
  if (/carry|farmer/.test(name)) return 0
  // Both boundaries: without a leading one, "bound" matches inside "rebound",
  // and the seated box jump's own cue says "NO rock or rebound".
  if (/\blateral bounds?\b/.test(name)) return reps * 2     // per side
  if (/\bbounding\b|\bbounds?\b/.test(name)) return null    // bounding is prescribed by distance, not reps
  // A trap bar jump is a landing like any other. NSCA's own Essentials frames a
  // ~30% 1RM loaded squat jump as resistance added to a plyometric movement
  // (p. 480) and lists a loaded jump's landing among eccentric demands (p. 535);
  // measured peak ground reaction force puts it second only to a depth jump
  // (Ebben 2010). "Land soft" is a cue, not a reason to leave it out of a
  // ground-contact count.
  if (/broad jump|box jump|depth jump|depth drop|hurdle hop|trap bar jump|pogo|ankle hop|snap-down|tuck jump|squat jump|hop/.test(name)) return reps
  return null
}

/**
 * Landings in one prep line. The prep is COUNTED — "every landing, prep
 * included" is the whole point of one unit, and the prep is the load this
 * ticket ADDS. A prep line that this cannot read is a failure like any other.
 */
export function prepLandings(item) {
  const name = String(item.name ?? '').toLowerCase()
  const reps = (item.sets ?? 0) * (item.reps ?? 0)
  // A locomotor drill is not a jump. NSCA's warm-up table 18.5 lists marching,
  // jogging, skipping, footwork and lunging as warm-up rather than as
  // plyometric drills — so a skip, a high knee and a butt kick are steps, and
  // steps are not landings. Checked FIRST, because "A-Skips" would otherwise be
  // caught by the hop test below.
  if (/skip|high knee|butt kick|swing|march|lunge|carry|walk|drill|stretch|reach|rotation/.test(name)) return 0
  // The ankle hop IS a Low plyometric drill (Essentials 4th ed. p. 484), so the
  // prep's hops are counted. That is what "every landing, prep included" means.
  if (/pogo|ankle hop|\bhops?\b|snap-down|jump/.test(name)) return reps
  return null
}

/** Rounds a metcon's whiteboard text implies, for multiplying a per-round jump count. */
function metconRounds(m) {
  const d = String(m.description ?? '')
  const rounds = d.match(/(\d+)\s+rounds?/i)
  if (rounds) return Number(rounds[1])
  if (m.format === 'emom') {
    const alt = (d.match(/min\s+\d+:/gi) ?? []).length
    return alt > 1 ? Math.floor((m.timeCapMinutes ?? 0) / alt) : (m.timeCapMinutes ?? 0)
  }
  return 1
}

/**
 * Landings in one metcon. A descender like 21-15-9 is its own rep scheme. An
 * UNCAPPED AMRAP cannot be counted at all — by construction, not by omission —
 * so a jump inside one is unbudgetable and this returns null, which fails.
 * That is why the Aerodyne jump-overs became permanent step-overs (ruling 5).
 */
export function metconLandings(m) {
  const desc = String(m.description ?? '')
  const lines = desc.split('\n').map((l) => l.trim()).filter(Boolean)
  const rounds = metconRounds(m)
  let total = 0
  for (const line of lines) {
    if (!JUMP_WORDS.test(line) || NOT_LOAD.test(line)) continue
    const descender = desc.match(/^\s*(\d+)-(\d+)-(\d+)\s*$/m)
    // "burpees over the rower" under a 21-15-9 header: the header is the scheme.
    if (descender && /burpee|jump/i.test(line) && !/^\d/.test(line)) {
      total += Number(descender[1]) + Number(descender[2]) + Number(descender[3])
      continue
    }
    const n = line.match(/(\d+)\s+[a-z ()"']*?(box jump|jump over|burpee|hop|bound)/i)
    if (n) {
      if (m.format === 'amrap') return null   // uncapped: unbudgetable by construction
      total += Number(n[1]) * rounds
      continue
    }
    // A plain burpee is an in-place hop, not on the ruling's list.
    if (/\bburpees?\b/i.test(line) && !/over/i.test(line)) continue
    return null                                // jump-shaped and unreadable
  }
  return total
}

/** Landings written into an outside session's prose. Any is a failure — see assertion B. */
export function proseJumpLines(o) {
  return (o.parts ?? []).filter((p) => JUMP_WORDS.test(p) && !NOT_LOAD.test(p))
}

const isPrep = (i) => i.kind === 'prep'
const isSprint = (i) => i.kind === 'outside' && i.slot === 'sprint'

// ── Walk every program, every week, every day, every mode ───────────────────
/** A jump the ramp should have replaced, and one still wearing the ramp label after it ended. */
const rampBreaches = []
const staleRamp = []
const labelMismatch = []
const overBlocks = []
let prepDays = 0, prepBlocks = 0
const unreadable = []
const noPrep = []
const prose = []
const sessions = []            // { program, week, day, mode, landings }
const weekTotals = new Map()   // `${program}|${week}|${mode}` → landings

let built = 0
for (const [slug, program] of Object.entries(PROGRAMS)) {
  // TWO macros, not one. The ramp is keyed on EXPOSURE and the program on macro
  // POSITION, and they only come apart in the second cycle: full exposure first
  // meets meso 1 at week 14. Walking a single macro left every
  // full-exposure-in-meso-1 combination untested, and a mutation that left a
  // ramp label on meso 1's Saturday slipped straight through.
  for (let week = 1; week <= program.macroWeeks * 2; week++) {
    for (let day = 1; day <= 7; day++) {
      for (const { label, opts } of MODES) {
        let plan
        try { plan = program.buildDay(week, day, MAXES, {}, opts) } catch { continue }
        const items = plan?.items ?? []
        if (!items.length) continue
        built++
        let landings = 0
        let ballistic = false
        // Exposure runs from week one here: the check asks what a NEW athlete is
        // prescribed, which is the athlete the ramp exists for.
        const stage = rampStage(week)
        for (const it of items) {
          if (it.kind === 'plyo') {
            const n = plyoLandings(it)
            if (n === null) { unreadable.push(`${slug} w${week} d${day} ${label}: plyo "${it.name}"`); continue }
            if (n > 0) ballistic = true
            landings += n
            const ctx = { meso: mesoOfWeek(week, program.macroWeeks), exposure: exposureWeek(week) }
            if (isRampBreach(stage, it, slug, day, ctx)) rampBreaches.push(`${slug} w${week} d${day} ${label}: "${it.name}" at stage ${stage}`)
            // A ramped line must say what it is, and a low-box depth drop must not
            // be told it is a max-height box jump.
            if (it.ramp && !it.intent) labelMismatch.push(`${slug} w${week} d${day}: "${it.name}" is ramped with no intent label`)
            if (it.intent && /LOW BOX/.test(it.intent) && !/depth/i.test(it.name)) labelMismatch.push(`${slug} w${week} d${day}: "${it.name}" labelled LOW BOX`)
            if (it.intent && /VERTICAL/.test(it.intent) && !/box jump/i.test(it.name)) labelMismatch.push(`${slug} w${week} d${day}: "${it.name}" labelled VERTICAL`)
            if (stage === 'full' && it.ramp) staleRamp.push(`${slug} w${week} d${day} ${label}: "${it.name}" still marked ${it.ramp}`)
          } else if (isPrep(it)) {
            const n = prepLandings(it)
            if (n === null) { unreadable.push(`${slug} w${week} d${day} ${label}: prep "${it.name}"`); continue }
            landings += n
          } else if (it.kind === 'metcon') {
            const n = metconLandings(it)
            if (n === null) { unreadable.push(`${slug} w${week} d${day} ${label}: metcon "${it.name}"`); continue }
            if (n > 0) ballistic = true
            landings += n
          } else if (it.kind === 'outside') {
            const lines = proseJumpLines(it)
            if (lines.length) prose.push(`${slug} w${week} d${day} ${label}: "${it.title}" — ${JSON.stringify(lines[0])}`)
          }
        }
        // The six-block budget, on the day the app actually renders.
        if (plan.dayType === 'gym' && label === 'full' && slug === 'hybrid-power') {
          const blocks = blockCount(plan)
          if (blocks > 6) overBlocks.push(`${slug} w${week} d${day}: ${blocks} blocks`)
          const preps = items.filter(isPrep)
          if (preps.length) { prepDays++; prepBlocks += preps.filter((i) => !isStationFree(i)).length }
        }
        const needsPrep = ballistic || items.some(isSprint)
        if (needsPrep && !items.some(isPrep)) noPrep.push(`${slug} w${week} d${day} ${label}`)
        if (landings > 0) sessions.push({ slug, week, day, label, landings })
        const key = `${slug}|${week}|${label}`
        weekTotals.set(key, (weekTotals.get(key) ?? 0) + landings)
      }
    }
  }
}

// ── A. the prep slot — the confirmed defect, red first ──────────────────────
assert(built > 500, `${built} program-days built across ${Object.keys(PROGRAMS).length} programs, every week, every day, every mode`)
assert(noPrep.length === 0,
  `every day with a ballistic or sprint slot renders a prep slot — ${noPrep.length ? `${noPrep.length} do not, first: ${noPrep[0]}` : 'all of them'}`)

// ── A2. the ramp — AC2, asserted structurally ──────────────────────────────
// "No maximal horizontal or depth jump is prescribed before the ramp-in weeks
// are complete." Asserted against the `ramp` FIELD, never against a note: a
// prescription that says "go easy" under a maximal jump is the same bug in
// softer words. And at full exposure nothing may still claim to be ramping,
// or the ramp would be a label that never comes off.
assert(rampBreaches.length === 0,
  `no maximal horizontal or depth jump is prescribed before the ramp completes, except by a dated grant — ${rampBreaches.length ? `${rampBreaches.length} do, first: ${rampBreaches[0]}` : 'none in any week'}`)

// ── A2b. THE GRANT IS NARROW, proved field by field ───────────────────────
//
// A one-line exemption is the cheapest way to turn a safety gate into a
// formality, so every field of it is probed here: change one thing about the
// prescription and the breach must come back. Without this, widening `slot` to
// a prefix or dropping `day` would leave the suite green.
{
  const DJ = { slot: 'depth_jump', name: 'Depth Jump' }
  const at = (meso, exposure) => ({ meso, exposure })
  const M2 = at(2, 5)                       // the granted position
  const ok = (slug, day, item, ctx) => rampExempt(slug, day, item, ctx)

  assert(ok('hybrid-power', 3, DJ, M2),
    'the grant covers hybrid-power Wednesday depth_jump in meso 2 at exposure 5 — otherwise it grants nothing and M2 could not build')
  assert(ok('hybrid-power', 3, DJ, at(2, 8)), 'and on through exposure 8, the end of the meso')

  // ── EXPOSURE, held apart from the meso ──
  // Derived from one week these two are collinear, so this is the probe that
  // only works because the predicate takes them separately.
  assert(!ok('hybrid-power', 3, DJ, at(2, 4)),
    'it does NOT reach exposure 4 even in meso 2 — a restart that puts M2 at exposure 4 is still inside the ramp')
  assert(!ok('hybrid-power', 3, DJ, at(2, 1)),
    'nor exposure 1, which is what a restart at the top of M2 produces')

  // ── MESO, held apart from the exposure ──
  assert(!ok('hybrid-power', 3, DJ, at(1, 5)), 'nor meso 1 at the same exposure')
  assert(!ok('hybrid-power', 3, DJ, at(3, 9)), 'nor meso 3')
  assert(!ok('hybrid-power', 3, DJ, at(1, 14)),
    "nor the second macro's meso 1, where exposure is well past 5 but the position is wrong")
  assert(!ok('hybrid-power', 3, DJ, at(4, 13)), 'nor the test week, which belongs to no meso the grant names')

  // ── program ──
  assert(!ok('dad-built', 3, DJ, M2), 'it does not leak to another program')
  assert(!ok('hybrid-dad', 3, DJ, M2), 'nor to the third one')

  // ── day ──
  assert(!ok('hybrid-power', 1, DJ, M2), 'nor to another day')
  assert(!ok('hybrid-power', 6, DJ, M2), "nor to Saturday's plyo ladder")

  // ── MOVEMENT (Codex r2 P1). These keep the EXEMPT slot and vary only the
  // name, so they isolate movement identity. My first pair changed both at
  // once and proved only that a different slot is refused.
  assert(!ok('hybrid-power', 3, { slot: 'depth_jump', name: 'Broad Jump' }, M2),
    'a maximal BROAD jump wearing the depth_jump slot is NOT exempt — AC2 names it alongside the depth jump')
  assert(!ok('hybrid-power', 3, { slot: 'depth_jump', name: 'Depth Drops' }, M2),
    'nor are depth DROPS wearing it — a different movement at a different intensity')
  assert(!ok('hybrid-power', 3, { slot: 'depth_jump', name: 'Weighted Depth Jump' }, M2),
    'nor a LOADED depth jump — the grant is for the bodyweight movement')
  assert(!ok('hybrid-power', 3, { slot: 'depth_jump', name: undefined }, M2),
    'and a line with no name at all is refused rather than defaulting through')

  // ── SLOT KEY, exactly (Codex r2 P2): a prefix match would widen it ──
  assert(!ok('hybrid-power', 3, { slot: 'depth_jump_x', name: 'Depth Jump' }, M2),
    'a slot that merely BEGINS with depth_jump is not the granted slot')
  assert(!ok('hybrid-power', 3, { slot: 'x_depth_jump', name: 'Depth Jump' }, M2),
    'nor one that merely ends with it')

  // ── THE DECISION, both ways. The grant above is only half of it; this is
  // the branch the loop consults.
  assert(isRampBreach('max_vertical', { slot: 'broad_jump', name: 'Broad Jump' }, 'hybrid-power', 3, M2),
    'an ungranted maximal jump inside the ramp IS a breach — otherwise every probe above tests a gate that never fires')
  assert(isRampBreach('max_vertical', DJ, 'dad-built', 3, M2),
    'and so is a depth jump in a program the grant does not name')
  assert(!isRampBreach('max_vertical', DJ, 'hybrid-power', 3, M2), 'while the granted one is not')
  assert(!isRampBreach('full', { slot: 'broad_jump', name: 'Broad Jump' }, 'hybrid-power', 3, at(3, 9)),
    'and nothing is a breach at full exposure, which is where the ramp ends')
  assert(!isRampBreach('max_vertical', { slot: 'plyo', name: 'Box Jumps' }, 'hybrid-power', 6, M2),
    'a box jump is not a maximal horizontal or depth jump, so it is never a breach')
  // WHAT THIS DOES NOT PROVE: that the loop above actually consults
  // isRampBreach for every item. Replacing that call with `if (false)` leaves
  // this suite green — a check cannot prove its own wiring from the inside
  // without a planted fixture program, which Small tier does not buy. Said
  // here rather than left to be assumed.

  // ── and the grant itself has to be legible ──
  for (const e of RAMP_EXEMPTIONS) {
    assert(/\d{4}-\d{2}-\d{2}/.test(e.reason),
      `every grant's reason carries the date of the ruling that gave it — ${e.program}/${e.slot} does not`)
    assert(e.reason.length > 60, `and says why, not just when — ${e.program}/${e.slot}`)
    assert(Number.isInteger(e.fromExposure) && e.fromExposure >= 1,
      `and names the exposure week it starts at — ${e.program}/${e.slot}`)
    assert(e.movement instanceof RegExp, `and the MOVEMENT it covers — ${e.program}/${e.slot}`)
    assert(Number.isInteger(e.meso), `and the meso — ${e.program}/${e.slot}`)
  }
  console.log(`  \u00b7 ${RAMP_EXEMPTIONS.length} dated ramp grant(s), each probed narrow: ` +
    RAMP_EXEMPTIONS.map((e) => `${e.program} d${e.day} ${e.slot} (${e.movement}) meso ${e.meso} from exposure ${e.fromExposure}`).join('; '))
}
assert(staleRamp.length === 0,
  `nothing is still marked as ramping once exposure is full — ${staleRamp.length ? `${staleRamp.length} are, first: ${staleRamp[0]}` : 'none'}`)

// ── B. nothing jump-shaped is uncountable ──────────────────────────────────
assert(prose.length === 0,
  `no jump is written into an outside session's prose, where nothing can count it — ${prose.length ? `${prose.length} found, first: ${prose[0]}` : 'none'}`)
assert(unreadable.length === 0,
  `every ballistic line this file meets is one it can count — ${unreadable.length ? `${unreadable.length} unreadable, first: ${unreadable[0]}` : 'all of them'}`)

// ── C. the ceilings ────────────────────────────────────────────────────────
const worstSession = sessions.reduce((a, b) => (b.landings > (a?.landings ?? -1) ? b : a), null)
const worstWeek = [...weekTotals.entries()].map(([k, v]) => ({ k, v })).reduce((a, b) => (b.v > (a?.v ?? -1) ? b : a), null)
const overSession = sessions.filter((s) => s.landings > SESSION_CEILING)
const overWeek = [...weekTotals.entries()].filter(([, v]) => v > WEEK_CEILING)

assert(overSession.length === 0,
  `no session exceeds ${SESSION_CEILING} landings, the top of the published beginner range — ${overSession.length ? `${overSession.length} do, worst: ${overSession[0].slug} w${overSession[0].week} d${overSession[0].day} ${overSession[0].label} at ${overSession[0].landings}` : 'none'}`)
assert(overWeek.length === 0,
  `no week exceeds ${WEEK_CEILING} landings, the labelled conservative default — ${overWeek.length ? `${overWeek.length} do, worst: ${overWeek[0][0]} at ${overWeek[0][1]}` : 'none'}`)

// ── The finding, not a requirement ─────────────────────────────────────────
// Whether Power Dad comes in under a sourced ceiling is a FINDING to report.
// If it comes in under, that is said plainly and the ceiling is NOT lowered to
// make it fail (AC4 as corrected, 2026-09-17).
console.log(`  · heaviest session: ${worstSession ? `${worstSession.slug} w${worstSession.week} d${worstSession.day} ${worstSession.label} — ${worstSession.landings} landings, ceiling ${SESSION_CEILING}` : 'none'}`)
console.log(`  · heaviest week:    ${worstWeek ? `${worstWeek.k} — ${worstWeek.v} landings, ceiling ${WEEK_CEILING}` : 'none'}`)

// ── D. the prep costs no blocks, measured on the day that SHIPS ────────────
// Ruling 8: the prep is free of the six-block budget, with its minutes shown
// instead. The budget is about the clock — stations you set up — and the prep
// is six drills on the open floor.
//
// Measured THROUGH THE REGISTRY on purpose. sweep.mjs imports the raw program
// config, which the registry then wraps, so the day it asserts against is not
// the day the app renders: without this, the prep could have pushed every
// ballistic day to twelve blocks and the budget assertion over there would
// still have passed. That gap is older and wider than this ticket — every
// sweep assertion has it — and it is reported rather than refactored inside an
// injury ticket.
// Power Dad's budget, and only Power Dad's: the six-block cap is that program's
// own rule ("I have a kid, I can't spend 2+ hours"). Dad Built runs eight on its
// first day and always has — asserting six across the registry would have been
// me inventing a rule for a program that never had one.
assert(overBlocks.length === 0,
  `no Power Dad gym day exceeds its six-block budget once the prep is on it — ${overBlocks.length ? `${overBlocks.length} do, first: ${overBlocks[0]}` : 'none'}`)
assert(prepDays > 0 && prepBlocks === 0,
  `the prep is on ${prepDays} Power Dad gym days and costs ${prepBlocks} blocks on every one of them`)

// ── E. the card cannot shout over the prescription ─────────────────────────
// The jump card's header read MAX INTENT unconditionally, so a ramp week put
// those words above a note asking for three-quarter effort — the loudest thing
// on the card contradicting the reason the ramp exists (Codex r3). The label is
// derived from the stage now, and this keeps it that way.
const dayPage = readFileSync(join(ROOT, 'src/app/train/[program]/[day]/page.tsx'), 'utf8')
assert(/item\.intent \?\? 'MAX INTENT'/.test(dayPage) && !/· MAX INTENT</.test(dayPage),
  'the jump card takes its intensity label from the prescription, not from a hardcoded MAX INTENT')
// PER ITEM, not per stage: at low_depth one stage carries a submaximal broad
// jump, a low-box depth drop AND a max-height box jump, so a stage-derived label
// gave two of the three an instruction that was not theirs (Codex r4).
assert(labelMismatch.length === 0,
  `every ramped jump carries its own intensity label — ${labelMismatch.length ? `${labelMismatch.length} do not, first: ${labelMismatch[0]}` : 'all of them'}`)

// ── The counting unit is written down where it is used ─────────────────────
const self = readFileSync(join(ROOT, 'scripts/checks/ballistic-load.mjs'), 'utf8')
assert(/2\.0 m of ground/.test(self) && String(METRES_PER_BOUND_STRIDE) === '2',
  'the bound-strike distance is stated in this file, beside the number')
assert(/DELIBERATE\s*\n?\/\/ CONSERVATIVE DEFAULT|CONSERVATIVE\s+DEFAULT/i.test(self),
  'the weekly ceiling is labelled a derived default rather than presented as a source')

if (failures) { console.log(`\nballistic-load: ${failures} of ${failures + passes} checks FAILED`); process.exit(1) }
console.log(`ballistic-load: ${passes} checks passed — ${built} program-days, every landing counted, prep included`)
