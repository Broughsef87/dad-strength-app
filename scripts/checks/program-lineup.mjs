// ── The program lineup (FOR-225-A) ──────────────────────────────────────────
// Three programs, one mode. Standing check, its own file, so a revert of the
// lineup change cannot delete the assertion that would have caught it.
//
//   1. exactly three programs in the registry; Dad Strong resolves nowhere,
//      and neither does the old hybrid-endurance slug — Hybrid Dad does.
//   2. opts.timeConstrained returns a REDUCED day for each of the three, and
//      does NOT create a program row.
//   3. opts.equipment exists as a shape and nothing reads it yet.
//   4. no orphaned references to the cut or renamed slugs anywhere in src,
//      scripts or supabase (migration history excepted — it is history).
//
// Every assertion here was verified by reintroducing the bug it catches and
// confirming it fires, then restoring the tree byte-identical.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'
import { PROGRAMS, getProgram } from '../../src/lib/programs/index.ts'
import { reduceForTime, TIME_CONSTRAINED_LIFTS, TIME_CONSTRAINED_MAX_SETS } from '../../src/lib/programs/timeConstrained.ts'
import { scheduledDayNumbers } from '../../src/lib/programs/schedule.ts'

let failures = 0, passes = 0
const assert = (cond, msg) => { if (cond) passes++; else { failures++; console.log('  ✗ ' + msg) } }
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const readLF = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')

const MAXES = {
  snatch: 185, clean_jerk: 225, back_squat: 315, front_squat: 265, bench: 225, deadlift: 405,
  ohp: 135, overhead_press: 135, push_press: 165, row_2k: 8, run_5k: 25, run_mile: 8,
}

// ── 1. three programs, the right three ──────────────────────────────────────
const slugs = Object.keys(PROGRAMS).sort()
assert(slugs.length === 3, `the registry has exactly three programs — got ${slugs.length}: ${slugs.join(', ')}`)
assert(slugs.join(',') === 'dad-built,hybrid-dad,hybrid-power',
  `the three are Power Dad, Dad Built and Hybrid Dad — got ${slugs.join(', ')}`)
assert(PROGRAMS['hybrid-power']?.name === 'Power Dad' && PROGRAMS['dad-built']?.name === 'Dad Built' && PROGRAMS['hybrid-dad']?.name === 'Hybrid Dad',
  'the display names are Power Dad, Dad Built, Hybrid Dad')
assert(getProgram('dad-strong') === null, 'Dad Strong resolves nowhere')
assert(getProgram('hybrid-endurance') === null, 'the old hybrid-endurance slug resolves nowhere — it is hybrid-dad now')
assert(!existsSync(join(ROOT, 'src/lib/programs/dadStrong.ts')), 'dadStrong.ts is gone')
assert(!existsSync(join(ROOT, 'src/lib/programs/hybridEndurance.ts')) && existsSync(join(ROOT, 'src/lib/programs/hybridDad.ts')),
  'hybridEndurance.ts is hybridDad.ts')
for (const [slug, p] of Object.entries(PROGRAMS)) {
  assert(p.slug === slug, `${slug}: the registry key is the program's own slug`)
  assert(scheduledDayNumbers(p, 1).length === 6, `${slug} prescribes six days in week 1 — got ${scheduledDayNumbers(p, 1).length}`)
}

// ── 2. the time-constrained MODE ────────────────────────────────────────────
// Every program, every gym day of weeks 1, 6 and 12: the reduced day keeps at
// least one lift and no more than the primaries, drops everything past them,
// caps sets, and is still the same kind of day. Test, rest and outside days
// are returned untouched.
const sets = (plan) => plan.items.reduce((n, i) => n + ('sets' in i ? i.sets : 0), 0)
for (const [slug, p] of Object.entries(PROGRAMS)) {
  let reducedDays = 0
  for (const wk of [1, 6, 12]) {
    for (let d = 1; d <= 7; d++) {
      const full = p.buildDay(wk, d, MAXES, {}, {})
      const short = p.buildDay(wk, d, MAXES, {}, { timeConstrained: true })
      assert(short.dayType === full.dayType, `${slug} W${wk} D${d}: the mode keeps the day's type`)
      if (full.dayType !== 'gym') {
        assert(JSON.stringify(short) === JSON.stringify(full), `${slug} W${wk} D${d} (${full.dayType}): a non-gym day is returned untouched`)
        continue
      }
      reducedDays++
      const lifts = short.items.filter((i) => i.kind === 'lift')
      assert(lifts.length >= 1 && lifts.length <= TIME_CONSTRAINED_LIFTS,
        `${slug} W${wk} D${d}: the reduced day keeps 1..${TIME_CONSTRAINED_LIFTS} lifts — got ${lifts.length}`)
      assert(short.items.length < full.items.length || sets(short) < sets(full),
        `${slug} W${wk} D${d}: the reduced day is actually reduced (${short.items.length} items / ${sets(short)} sets vs ${full.items.length} / ${sets(full)})`)
      assert(short.items.every((i) => !('sets' in i) || i.sets <= TIME_CONSTRAINED_MAX_SETS),
        `${slug} W${wk} D${d}: no kept item exceeds ${TIME_CONSTRAINED_MAX_SETS} sets`)
      assert(short.items.every((i) => !('superset' in i) || i.superset == null || short.items.some((k) => k !== i && 'superset' in k && k.superset === i.superset)),
        `${slug} W${wk} D${d}: no dangling superset link on a kept item`)
      // What was dropped leaves no trace on what was kept (Codex, round 1):
      // no kept item's note names a dropped item, and a kept item whose
      // partner was dropped carries no pairing note.
      const keptSlots = new Set(short.items.map((i) => i.slot))
      const droppedNames = full.items.filter((i) => !keptSlots.has(i.slot)).map((i) => ('name' in i ? i.name : i.title).toLowerCase())
      for (const i of short.items) {
        const note = ('note' in i && i.note) ? i.note.toLowerCase() : ''
        assert(!droppedNames.some((n) => n.length > 2 && note.includes(n)),
          `${slug} W${wk} D${d}: kept "${i.name ?? i.title}" still says "${i.note}" — it names dropped work`)
        assert(!/contrast|superset|pair/i.test(note) || short.items.some((k) => k !== i && 'superset' in k && k.superset === ('superset' in i ? i.superset : undefined)),
          `${slug} W${wk} D${d}: kept "${i.name ?? i.title}" keeps a pairing note ("${i.note}") with no partner`)
      }
      const fullLifts = full.items.filter((i) => i.kind === 'lift')
      assert(lifts.every((l, i) => l.slot === fullLifts[i].slot && l.name === fullLifts[i].name),
        `${slug} W${wk} D${d}: the kept lifts are the program's primaries, in order`)
      assert(short.dayName.endsWith(' · short') && short.sessionIntent.startsWith('Time-constrained:'),
        `${slug} W${wk} D${d}: the reduced day says so`)
    }
  }
  assert(reducedDays > 0, `${slug}: the mode reduced at least one gym day`)
}
// The exact day Codex ran (round 1): Power Dad's non-deload Wednesday drops
// the trap bar jumps; the kept front squat must not still say "Contrast: trap
// bar jumps ~30s after each set".
{
  const short = PROGRAMS['hybrid-power'].buildDay(1, 3, MAXES, {}, { timeConstrained: true })
  const fs = short.items.find((i) => i.kind === 'lift' && /front squat/i.test(i.name))
  assert(!!fs, 'Power Dad W1 D3 reduced keeps the front squat')
  assert(!short.items.some((i) => /trap bar jump/i.test(i.name ?? i.title ?? '')), 'Power Dad W1 D3 reduced drops the trap bar jumps')
  assert(!fs || !/trap bar/i.test(fs.note ?? ''), `Power Dad W1 D3: the front squat no longer says "${fs?.note}"`)
}
// The general rule, on a plan no program ships today so it cannot be satisfied
// by accident: a kept lift with NO pairing link whose note names a dropped
// item loses the note; one whose note is innocent keeps it.
{
  const plan = {
    dayNumber: 1, dayName: 'Synthetic', dayType: 'gym', sessionIntent: 'x',
    items: [
      { kind: 'lift', slot: 'a', name: 'Back Squat', sets: 4, reps: 5, note: 'Then straight into the Sled Push' },
      { kind: 'lift', slot: 'b', name: 'Bench Press', sets: 4, reps: 5, note: '90s rest' },
      { kind: 'lift', slot: 'c', name: 'Sled Push', sets: 3, reps: 1 },
    ],
  }
  const short = reduceForTime(plan)
  assert(short.items.length === 2 && short.items[0].note == null, `a note naming dropped work is removed — got "${short.items[0].note}"`)
  assert(short.items[1].note === '90s rest', 'an innocent note on a kept lift survives')
}
// ...and it is a mode, not a program: the registry is the same three with the
// mode on or off, no slug mentions time, and reduceForTime is pure.
assert(Object.keys(PROGRAMS).length === 3 && !Object.keys(PROGRAMS).some((s) => /time|short|constrained/i.test(s)),
  'the time-constrained mode adds no program row and no slug')
{
  const p = PROGRAMS['hybrid-power']
  const a = p.buildDay(2, 1, MAXES, {}, { timeConstrained: true })
  const b = p.buildDay(2, 1, MAXES, {}, { timeConstrained: true })
  assert(JSON.stringify(a) === JSON.stringify(b), 'the reduced day is deterministic')
  const full = p.buildDay(2, 1, MAXES, {}, {})
  const snapshot = JSON.stringify(full)
  reduceForTime(full)
  assert(JSON.stringify(full) === snapshot, 'reduceForTime does not mutate the full plan')
}
const idx = readLF('src/lib/programs/index.ts')
assert(/opts\?\.timeConstrained \? reduceForTime\(plan\) : plan/.test(idx), 'the registry applies the mode, program-agnostic, in one place')
assert(!/time-constrained|timeConstrained: \{|slug: 'time/.test(idx.replace(/\/\/.*$/gm, '')), 'no program entry is named after the mode')

// ── 3. equipment: shape only ────────────────────────────────────────────────
const types = readLF('src/lib/programs/types.ts')
assert(/equipment\?: Equipment/.test(types) && /export interface Equipment \{/.test(types) && /export type EquipmentItem =/.test(types),
  'BuildDayOpts carries opts.equipment as a typed shape (rides in opts, not a positional parameter)')
assert(/timeConstrained\?: boolean/.test(types), 'BuildDayOpts carries opts.timeConstrained')
const buildDaySig = (types.match(/buildDay\(([\s\S]*?)\): DayPlan/) || [])[1] || ''
assert(/opts\?: BuildDayOpts,?\s*$/.test(buildDaySig.trim()) && !/equipment/.test(buildDaySig),
  'buildDay still ends in opts — equipment did not become a sixth positional parameter')
for (const f of ['hybridPower.ts', 'dadBuilt.ts', 'hybridDad.ts', 'timeConstrained.ts']) {
  assert(!/opts\??\.equipment|\.equipment\b/.test(readLF('src/lib/programs/' + f).replace(/\/\/.*$/gm, '')),
    `${f} does not read opts.equipment yet — shape only until the questionnaire ticket`)
}

// ── 4. no orphaned references to the cut or renamed slugs ──────────────────
// Identifiers, not prose: the quoted slugs, the old export names, the old
// file names, the old route. Migration history is excluded because it IS
// history; this file is excluded because it names them on purpose.
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'migrations'])
const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|mjs|js|sql|json|md)$/.test(name)) out.push(p)
  }
  return out
}
const identifiers = /'dad-strong'|"dad-strong"|`dad-strong`|\/dad-strong\/|dadStrong\b|dad_strong|'hybrid-endurance'|"hybrid-endurance"|`hybrid-endurance`|\/hybrid-endurance\/|hybridEndurance\b|hybrid_endurance/
const orphans = []
for (const root of ['src', 'scripts', 'supabase']) {
  for (const f of walk(join(ROOT, root))) {
    const rel = relative(ROOT, f).replace(/\\/g, '/')
    if (rel === 'scripts/checks/program-lineup.mjs') continue
    const lines = readFileSync(f, 'utf8').split(/\r?\n/)
    lines.forEach((line, i) => { if (identifiers.test(line)) orphans.push(`${rel}:${i + 1}`) })
  }
}
assert(orphans.length === 0, `no orphaned references to dad-strong or hybrid-endurance — found: ${orphans.join(' ')}`)
// Rendered copy: the display name of the cut program appears in no string
// literal (the "Dad Strong+" plan name is a different thing and is allowed).
const copyHits = []
for (const f of walk(join(ROOT, 'src'))) {
  const rel = relative(ROOT, f).replace(/\\/g, '/')
  readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '')
    if (/^\s*(\*|\/\*)/.test(line)) return
    if (/Dad Strong(?!\+)/.test(code) || /Hybrid Endurance/.test(code)) copyHits.push(`${rel}:${i + 1}`)
  })
}
assert(copyHits.length === 0, `no rendered string names Dad Strong or Hybrid Endurance — found: ${copyHits.join(' ')}`)

// ── Report ──────────────────────────────────────────────────────────────────
if (failures) { console.log(`\nprogram lineup: ${failures} of ${failures + passes} checks FAILED`); process.exit(1) }
console.log(`program lineup: ${passes} checks passed — three programs, one mode, no orphans`)
