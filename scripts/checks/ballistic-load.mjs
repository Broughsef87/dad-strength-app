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
import { rampStage } from '../../src/lib/programs/prep.ts'
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
            const maximal = /broad jump|depth jump|depth drop/i.test(it.name)
            if (stage !== 'full' && maximal && it.ramp !== stage) rampBreaches.push(`${slug} w${week} d${day} ${label}: "${it.name}" at stage ${stage}`)
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
  `no maximal horizontal or depth jump is prescribed before the ramp completes — ${rampBreaches.length ? `${rampBreaches.length} are, first: ${rampBreaches[0]}` : 'none in any week'}`)
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

// ── The counting unit is written down where it is used ─────────────────────
const self = readFileSync(join(ROOT, 'scripts/checks/ballistic-load.mjs'), 'utf8')
assert(/2\.0 m of ground/.test(self) && String(METRES_PER_BOUND_STRIDE) === '2',
  'the bound-strike distance is stated in this file, beside the number')
assert(/DELIBERATE\s*\n?\/\/ CONSERVATIVE DEFAULT|CONSERVATIVE\s+DEFAULT/i.test(self),
  'the weekly ceiling is labelled a derived default rather than presented as a source')

if (failures) { console.log(`\nballistic-load: ${failures} of ${failures + passes} checks FAILED`); process.exit(1) }
console.log(`ballistic-load: ${passes} checks passed — ${built} program-days, every landing counted, prep included`)
