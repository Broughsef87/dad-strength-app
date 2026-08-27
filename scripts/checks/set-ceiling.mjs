// ── the 4-set ceiling ───────────────────────────────────────────────────────
//
// Andrew, 2026-08-27: "I always trim the squats from 5 to 4. I don't really like
// doing more than 4 sets of anything unless it's real sub-maximal work."
//
// He had been cutting a prescribed set by hand every Monday for months. The
// engine never knew: autoregulation watches load and RPE, and nothing watched
// set count. Two configs out of four carried the fifth set, and both were the
// same M1 back-squat accumulation instinct.
//
// This asserts the rule the programs are already written to, so the exception
// cannot quietly reappear in a program added later.
//
// Two exemptions, and they are the rule working rather than holes in it:
//   velocity: true   real sub-maximal work — 5x2 @55% off a box is speed, not
//                    volume, and is exactly what Andrew's own words allow
//   test-week ramps  a climb to a 1RM is singles up a ladder, not accumulation
//
// It runs against buildDay output rather than the source text, so it sees what
// is actually PRESCRIBED — including anything a program assembles conditionally.
//
// Allowlist is empty and should stay that way. An entry needs a written reason.
import { readFileSync } from 'node:fs'
import { PROGRAMS } from '../../src/lib/programs/index.ts'

const CEILING = 4
const MAXES = {
  snatch: 165, clean: 225, jerk: 205, backSquat: 315, frontSquat: 255,
  bench: 245, deadlift: 405, ohp: 145, clean_jerk: 225,
}

let allow = []
try {
  allow = JSON.parse(readFileSync(new URL('./set-ceiling-allowlist.json', import.meta.url), 'utf8'))
} catch { allow = [] }

const violations = []
let inspected = 0
let exemptVelocity = 0
let exemptTest = 0

for (const [slug, program] of Object.entries(PROGRAMS)) {
  const days = program.daysPerWeek ?? 7
  for (let week = 1; week <= 13; week++) {
    for (let day = 1; day <= days; day++) {
      let plan
      try {
        plan = program.buildDay(week, day, MAXES)
      } catch {
        continue                       // a day this program does not build
      }
      for (const item of plan?.items ?? []) {
        if (typeof item.sets !== 'number') continue
        inspected++
        if (item.sets <= CEILING) continue
        if (item.velocity === true) { exemptVelocity++; continue }
        const isTestRamp = week === 13 || String(item.slot ?? '').startsWith('test_')
        if (isTestRamp) { exemptTest++; continue }
        const key = `${slug}:${item.slot}`
        if (allow.some((a) => a === key || a?.entry === key)) continue
        violations.push(
          `${slug} W${week}D${day} ${item.slot} — ${item.sets}x${item.reps ?? '?'}`
          + (item.percent != null ? ` @${item.percent}%` : ''))
      }
    }
  }
}

// one line per offending slot, not per week it appears in
const unique = [...new Set(violations.map((v) => v.replace(/ W\d+D\d+/, '')))]

console.log('')
console.log('── the 4-set ceiling ─────────────────────────────────────────')
console.log(`  prescriptions inspected     ${inspected}`)
console.log(`  exempt, velocity            ${exemptVelocity}`)
console.log(`  exempt, test-week ramp      ${exemptTest}`)
console.log(`  allowlisted                 ${allow.length}`)
console.log('')

if (unique.length) {
  console.log(`✗ ${unique.length} slot(s) over the ${CEILING}-set ceiling:`)
  for (const v of unique) console.log(`    ${v}`)
  console.log('')
  console.log('  Cut sets, never percentages. If the block is genuinely sub-maximal')
  console.log('  speed work it wants velocity: true, which is the real exemption.')
  process.exit(1)
}

console.log(`✓ no prescription exceeds ${CEILING} sets outside velocity work and test ramps`)
