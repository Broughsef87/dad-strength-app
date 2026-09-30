// ── The record is the row (FOR-231 v2) ───────────────────────────────────────
// daily_checkins is the morning protocol (spirit_state) and the day's
// objectives (mind_state). Nothing about a check-in is kept in localStorage —
// no cache, no mirror, no optimistic layer — so there is never a second copy
// and never a question about which copy wins.
//
// v1 of this ticket demoted localStorage to a paint layer and kept unsaved
// changes alive until the row had them. That cost 41 Codex rounds, ~35 of them
// on questions that only exist once a change outlives the screen it was made
// on. v2 deletes the second copy instead of adjudicating it. This check is what
// stops it growing back.
//
// Its own file, so a revert of the feature cannot take the check with it.
//
//   node --import tsx scripts/checks/checkin-record.mjs   (run-all does this)
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

let checks = 0
const fails = []
const assert = (cond, msg) => { checks++; if (!cond) fails.push(msg) }

const root = fileURLToPath(new URL('../../', import.meta.url))
const readLF = (p) => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n')

// Imported for its behaviour, and imported LOUDLY. A tree where the record rule
// is not exported yet is a tree this check must FAIL on, with a message, rather
// than crash on before a single assertion has run.
let record = null
let recordError = null
try {
  record = await import('../../src/lib/adherence.ts')
} catch (e) {
  recordError = e
}

/** Every .ts/.tsx file under src/, so a new one cannot quietly reintroduce a copy. */
function sourceFiles(dir = 'src') {
  const out = []
  for (const name of readdirSync(join(root, dir))) {
    const rel = dir + '/' + name
    if (statSync(join(root, rel)).isDirectory()) out.push(...sourceFiles(rel))
    else if (/\.(ts|tsx)$/.test(name)) out.push(rel)
  }
  return out
}
const SRC = sourceFiles()
const ALL = new Map(SRC.map((p) => [p, readLF(p)]))

// ── 1. localStorage holds nothing about a check-in ───────────────────────────
// The two keys are gone from the whole tree, not only from the files that used
// to hold them: what is being prevented is a SECOND copy existing anywhere.
for (const key of ['dad-strength-morning-protocol', 'dad-strength-mind-state']) {
  const holders = SRC.filter((p) => ALL.get(p).includes(key))
  assert(holders.length === 0, `no file under src/ names ${key} — found in ${holders.join(', ')}`)
}

for (const p of ['src/components/MorningProtocol.tsx', 'src/components/DailyObjectivesCard.tsx']) {
  assert(!/localStorage\s*\.\s*\w+/.test(ALL.get(p)), `${p} never touches localStorage`)
}

// The check-in surface is every file that touches the two columns. Those files
// may still use localStorage for things that are not check-ins — which program
// is deployed, which workout is open — and for nothing else. Scoped this way the
// rule follows the surface as it grows, instead of policing unrelated features.
const CHECKIN_FILES = SRC.filter((p) => /spirit_state|mind_state/.test(ALL.get(p)))
// A floor on the count would pass while the scan quietly lost a file, which
// would make the stray-key rule below vacuous for it. So the surface is named:
// every file that must be in it, is in it.
const MUST_BE_CHECKIN = [
  'src/app/dashboard/page.tsx',
  'src/components/DailyObjectivesCard.tsx',
  'src/components/FirstWeekChecklist.tsx',
  'src/components/MorningProtocol.tsx',
  'src/lib/adherence.ts',
]
const missedSurface = MUST_BE_CHECKIN.filter((p) => !CHECKIN_FILES.includes(p))
assert(missedSurface.length === 0, `the check-in surface found by reading the tree includes every file that owns check-in state — missing ${missedSurface.join(', ')}`)
const NON_CHECKIN_KEYS = new Set([
  "'activeWorkoutId'", "'activeProgramConfig'", "'dad-strength-active-program'", "'onboardingComplete'",
])
const stray = []
for (const p of CHECKIN_FILES) {
  for (const m of ALL.get(p).matchAll(/localStorage\s*\.\s*(?:get|set|remove)Item\(\s*([^,)]+)/g)) {
    if (!NON_CHECKIN_KEYS.has(m[1].trim())) stray.push(p + ' -> ' + m[1].trim())
  }
}
assert(stray.length === 0, `no file that touches spirit_state or mind_state keeps check-in state in localStorage — stray: ${stray.join(', ')}`)

// ── 2. the negotiation machinery is gone, by name and by file ────────────────
for (const name of ['reconcileLocal', 'localMatchesMirror', 'pendingLocalSave', 'onProtocolSaved']) {
  const holders = SRC.filter((p) => ALL.get(p).includes(name))
  assert(holders.length === 0, `${name} is gone from src/ — found in ${holders.join(', ')}`)
}

const adh = ALL.get('src/lib/adherence.ts')
for (const fn of ['tier', 'newer', 'rank']) {
  assert(!new RegExp('function ' + fn + '\\s*\\(').test(adh),
    `adherence.ts has no ${fn}() — the row-vs-row ranking is deleted, not renamed`)
}

for (const f of ['src/lib/checkinQueue.ts', 'src/lib/objectivesOutbox.ts', 'src/lib/objectivesRecord.ts',
                 'src/lib/serialWriter.ts', 'src/lib/unloadGuard.ts']) {
  assert(!existsSync(join(root, f)), `${f} does not exist — v1's retention machinery stays deleted`)
}

// The bounded re-read loop: the dashboard waited for the row to catch up with
// the cache. With no cache there is nothing to wait for.
const dash = ALL.get('src/app/dashboard/page.tsx')
assert(!/setTimeout/.test(dash), 'the dashboard has no timed re-read — a landed save is read once')
assert(!/attempt\s*<\s*\d/.test(dash), 'the dashboard has no bounded retry loop')
assert((dash.match(/useState\(0\)/g) ?? []).length === 1,
  'the dashboard carries ONE save signal, not a general one plus a protocol-only one')

const guards = SRC.filter((p) => ALL.get(p).includes('beforeunload'))
assert(guards.length === 0, `nothing under src/ warns on unload — found in ${guards.join(', ')}`)

// ── 3. behaviour: the count reads the record row, and only that ──────────────
assert(record !== null && typeof record.isRecordRow === 'function' && typeof record.protocolCompleteDays === 'function',
  'src/lib/adherence.ts exports the record rule (isRecordRow, protocolCompleteDays) — '
  + (recordError ? String(recordError).split('\n')[0] : 'one of them is missing'))

if (record !== null && typeof record.isRecordRow === 'function') {
  const { isRecordRow, protocolCompleteDays, rollingDays } = record
  const eq = (got, want, msg) => {
    checks++
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      fails.push(`${msg} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
    }
  }
  const steps = (n) => ({ steps: new Array(n).fill({}) })
  const row = (day, on, done, protocolSteps = done.length) =>
    ({ morning: { date: day, protocol: steps(protocolSteps), completed: done }, row: on })

  eq(protocolCompleteDays([row('2026-09-20', '2026-09-20', [true, true, true])]), ['2026-09-20'],
    'a fully ticked entry in the row keyed on its own day is a done day')
  eq(protocolCompleteDays([row('2026-09-20', '2026-09-20', [true, false, true])]), [],
    'a partly ticked entry is not a done day')
  eq(protocolCompleteDays([row('2026-09-20', '2026-09-20', [true, true], 3)]), [],
    'an entry whose tick count disagrees with its step count is not judged done')

  // The row-key transition, stated as behaviour. A legacy row — keyed on the
  // calendar day, so a 1am finish landed in the NEXT day's row — is not the
  // record and is not counted, however complete it looks.
  eq(protocolCompleteDays([row('2026-09-12', '2026-09-13', [true, true, true])]), [],
    'a legacy row whose date differs from the entry it carries is not the record')
  eq(protocolCompleteDays([
    row('2026-09-12', '2026-09-12', [true, false, false]),
    row('2026-09-12', '2026-09-13', [true, true, true]),
  ]), [],
    "the record row decides even when a complete legacy row exists for the same day — the ticket's row 9, deleted rather than answered")
  eq(protocolCompleteDays([{ morning: { date: '2026-09-20', protocol: steps(1), completed: [true] } }]), [],
    'an entry with no row is not the record — nothing produces that shape now')
  eq(protocolCompleteDays([
    row('2026-09-20', '2026-09-20', [true]),
    row('2026-09-20', '2026-09-20', [true]),
  ]), ['2026-09-20'],
    'one day key, however many times the record row is handed over')

  assert(isRecordRow(row('2026-09-20', '2026-09-20', [true])), "isRecordRow: the row keyed on the entry's day IS the record")
  assert(!isRecordRow(row('2026-09-20', '2026-09-21', [true])), 'isRecordRow: any other row is not')
  assert(!isRecordRow({ morning: { date: undefined }, row: undefined }), 'isRecordRow: an entry with no day is not the record')
  assert(!isRecordRow(null), 'isRecordRow: nothing is not the record')

  // ── 4. the transition ages out of the window on its own ───────────────────
  // Pre-fix rows stopped being written on 2026-09-13 (1111342). The daily
  // number is a 20-day rolling window, so the oldest day it counts is
  // today − 19: from 2026-10-03 no pre-fix day is inside it, and the legacy
  // case above can never fire again.
  const PRE_FIX_LAST_DAY = '2026-09-13'
  assert(rollingDays([PRE_FIX_LAST_DAY], '2026-09-29', 20).done === 1,
    'on 2026-09-29 the last pre-fix day is still inside the 20-day window')
  assert(rollingDays([PRE_FIX_LAST_DAY], '2026-10-02', 20).done === 1,
    'on 2026-10-02 it is still inside the window')
  assert(rollingDays([PRE_FIX_LAST_DAY], '2026-10-03', 20).done === 0,
    'on 2026-10-03 the last pre-fix day has left the window')
}

// ── 5. a save is a write to the row, and a failure is reported ──────────────
// Structural: this repo has no component renderer, so the mechanism is asserted
// at the source rather than driven. What is asserted is the mechanism, never the
// wording of a comment.
const mp = ALL.get('src/components/MorningProtocol.tsx')
const card = ALL.get('src/components/DailyObjectivesCard.tsx')

assert((mp.match(/\.upsert\(/g) ?? []).length === 2,
  'MorningProtocol writes the row in exactly two places — the protocol and the objectives')
assert((mp.match(/landed = !res\.error/g) ?? []).length === 2,
  'both MorningProtocol writes read the upsert result rather than dropping it')
assert((mp.match(/if \(!landed\) \{ setUnsaved\('(?:protocol|objectives)'\); return \}/g) ?? []).length === 2,
  'a write that did not land sets unsaved and returns — it never reports success')
assert(/if \(!landed\)[\s\S]{0,80}return \}\n    setMindSaved\(true\)/.test(mp),
  'the objectives Saved confirmation is only reached once the row has them')
assert(!/onSaved\?\.\(\)[\s\S]{0,400}\.upsert\(/.test(mp), 'the save signal is never fired before the write')

assert((card.match(/\.upsert\(/g) ?? []).length === 1, 'the objectives card has ONE writer of the row')
assert(/return !res\.error/.test(card), "the card's writer answers on the upsert result")
assert(/setCompleted\(before\)/.test(card), 'a tick that did not reach the row is taken back off the screen')
assert(/setUnsaved\(\(\) => \(\) =>/.test(card), 'the card holds a Retry that re-runs the same write')
for (const [name, body] of [['MorningProtocol', mp], ['the objectives card', card]]) {
  assert(/>Retry</.test(body) || /\n\s*Retry\n/.test(body), `${name} offers Retry on screen`)
}

// ── verdict ─────────────────────────────────────────────────────────────────
if (fails.length) {
  console.log(`\ncheckin record: ${fails.length} of ${checks} checks FAILED`)
  for (const f of fails) console.log('  ✗ ' + f)
  process.exit(1)
}
console.log(`checkin record: ${checks} checks passed — the row is the record, and there is no second copy`)
