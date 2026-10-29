// ═══════════════════════════════════════════════════════════════════════════
// DAD BUILT GROUPING — a muscle's exercises run back to back.
//
// Athlete's rule, 2026-10-28: on Dad Built, the exercises for one muscle group
// are consecutive unless a superset requires otherwise. A superset pair is
// treated as one unit (both moves happen together), so a pair may sit at the
// seam between two muscles. Any other gap in a muscle's run fails.
//
// Muscle = the PRIMARY muscles in MUSCLE_MAP. Secondary movers do not count:
// a bench set is not a triceps set (see dadBuilt.ts).
//
// Its own file so a revert of the ordering cannot take this check with it.
// ═══════════════════════════════════════════════════════════════════════════
import { dadBuilt, MUSCLE_MAP } from '../../src/lib/programs/dadBuilt.ts'

const MAXES = { back_squat: 315, bench: 225, deadlift: 405, ohp: 135 }
const GYM = [1, 3, 5, 6]

let checks = 0
const fails = []
const assert = (c, m) => { checks++; if (!c) fails.push(m) }

/** Collapse adjacent items sharing a superset id into one unit of muscles. */
function units(items) {
  const out = []
  for (const it of items) {
    const muscles = new Set(MUSCLE_MAP[it.slot]?.primary ?? [])
    const last = out[out.length - 1]
    if (it.superset && last && last.superset === it.superset) {
      for (const m of muscles) last.muscles.add(m)
      last.slots.push(it.slot)
    } else {
      out.push({ superset: it.superset, muscles, slots: [it.slot] })
    }
  }
  return out
}

/** Muscles whose units are not one unbroken run, with where they sit. */
export function splitMuscles(items) {
  const us = units(items)
  const where = {}
  us.forEach((u, i) => { for (const m of u.muscles) (where[m] ??= []).push(i) })
  return Object.entries(where)
    .filter(([, idx]) => idx[idx.length - 1] - idx[0] !== idx.length - 1)
    .map(([m, idx]) => `${m} at units ${idx.join(',')} of [${us.map(u => u.slots.join('+')).join(' · ')}]`)
}

// Real days, every week of the macro (deload keeps the order; test week is
// single-lift days and passes trivially).
for (let week = 1; week <= 13; week++) {
  for (const day of GYM) {
    const plan = dadBuilt.buildDay(week, day, MAXES)
    const bad = splitMuscles(plan.items)
    assert(bad.length === 0, `W${week} D${day}: ${bad.join('; ')}`)
  }
}

// The rule itself, red first: a split run must be caught, and a superset seam
// must not be.
const L = (slot, superset) => ({ kind: 'lift', slot, superset })
assert(splitMuscles([L('pb_bench'), L('pb_pullup'), L('pb_fly')]).length === 1,
  'chest split by a non-superset back move must fail')
assert(splitMuscles([L('pb_bench'), L('pb_fly', 's'), L('pb_row_a', 's'), L('pb_pullup')]).length === 0,
  'a superset pair at the chest/back seam must pass')
assert(splitMuscles([L('pb_bench'), L('pb_row_a', 's'), L('pb_incline', 's'), L('pb_pullup'), L('pb_fly')]).length > 0,
  'a superset does not excuse a later chest move after a back move')

console.log('  ── dad built grouping ' + '─'.repeat(39))
for (const f of fails) console.log('    ✗ ' + f)
console.log(`    checks                    ${checks}`)
if (fails.length) { console.log(`\n✗ ${fails.length} of ${checks} checks failed`); process.exit(1) }
console.log('\n✓ every Dad Built day keeps each muscle together')
