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
// A file this suite reads can be ABSENT — that is what a revert of the writer
// looks like — and the suite then has to FAIL with a message rather than crash
// before a single assertion has run. Red with no message proves nothing.
const readSoft = (p) => (existsSync(join(root, p)) ? readLF(p) : '')

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

// The paint rule, imported for its BEHAVIOUR rather than read as text.
let gateFactory = null
let gateError = null
try {
  gateFactory = (await import('../../src/lib/checkins.ts')).paintGate
} catch (e) {
  gateError = e
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

/** One function's body, by its opening line — so order inside it can be asserted. */
function body(src, header) {
  const i = src.indexOf(header)
  if (i < 0) return ''
  const j = src.indexOf('\n  }', i)
  return j < 0 ? src.slice(i) : src.slice(i, j + 4)
}
/** Does `first` appear before `second` inside `fn`, with `second` present? */
function before(fn, first, second) {
  const a = fn.indexOf(first), b = fn.indexOf(second)
  return a >= 0 && b >= 0 && a < b
}

// ── EACH WRITER NAMES THE PATHS IT OWNS (r3) ───────────────────────────────
// Deleting localStorage did not cure the clobbering and was never going to:
// `spirit_state` had four writers and every one of them sent the WHOLE entry,
// so a gratitude blur carried the completion flags it had read before a tick
// and the tick came back off the row. The cure is that each writer names its
// own fields and the database merges them (20261003_checkin_set_path.sql).
//
// This table is the spec. A writer that gains a path it does not own, or loses
// one it does, fails here. The DB proof (`npm run proof:checkins`) is what
// shows two of these paths surviving each other on one row; what this check
// adds is that the CLIENT names those same paths.
const WRITERS = [
  ['MorningProtocol generation', mp, '  const generate = async () => {', [['morning']]],
  ['MorningProtocol step tick', mp, '  const toggleStep = async (i: number) => {', [['morning', 'completed']]],
  ['MorningProtocol gratitude', mp, '  const commitGratitude = () => {', [['morning', 'gratitude']]],
  ['MorningProtocol Goals step', mp, '  const saveMindState = async () => {',
    [['date'], ['objectives'], ['completedObjectives'], ['lockedIn']]],
  ["the card's Goals write", card, '  const saveDraft = async () => {',
    [['date'], ['objectives'], ['completedObjectives'], ['lockedIn']]],
  // The PAIR, not one half of it: objectives and completedObjectives are
  // paired by index, so a writer of either writes both, or a flag can land on
  // a list it was not read against. `lockedIn` and `date` stay the Goals
  // step's — a tick naming either would be reaching outside what it owns.
  ["the card's objective tick", card, '  const toggle = async (i: number) => {',
    [['objectives'], ['completedObjectives']]],
]
for (const [label, src, decl, want] of WRITERS) {
  const fn = body(src, decl)
  assert(fn.length > 0, `${label} is found by name`)
  const got = [...fn.matchAll(/path:\s*\[([^\]]*)\]/g)]
    .map(m => m[1].split(',').map(k => k.trim().replace(/^'|'$/g, '')).join('.'))
  assert(got.join(' + ') === want.map(w => w.join('.')).join(' + '),
    `${label} patches exactly ${want.map(w => w.join('.')).join(' + ')} — got ${got.join(' + ') || 'no path at all'}`)
}
// The four mind_state keys are ONE call, because objectives and
// completedObjectives are paired by index: as two calls the row holds a new
// list against the old list's flags between them.
for (const [label, src, decl] of [['MorningProtocol', mp, '  const saveMindState = async () => {'],
                                  ['the card', card, '  const saveDraft = async () => {']]) {
  assert((body(src, decl).match(/patchCheckin\(/g) ?? []).length === 1,
    `${label}'s Goals write sends its four keys in one call`)
}
// A whole-column write is refused by the function itself (a path must name a
// key), so this says the client does not even try.
assert(!/path:\s*\[\s*\]/.test(mp + card), 'no writer names an empty path')

// AND THE DB PROOF EXERCISES THE PATHS THE CLIENT NAMES. The survival of two
// writers on one row is proven in SQL against a throwaway Postgres
// (`npm run proof:checkins`), never here — nothing in this process touches a
// database. What this guards is the two drifting apart: a client renaming a
// path while the proof keeps contending the old one would leave the collision
// proven for a path nobody writes.
const proof = readSoft('scripts/checkin-db-proof.mjs')
assert(proof.length > 0, 'the DB proof exists — a path merge nobody proved against a database is a claim')
for (const path of ['{morning,completed}', '{morning,gratitude}', '{completedObjectives}', '{objectives}']) {
  assert(proof.includes(path), `the DB proof contends ${path}, which a writer above names`)
}

// ── AND NOTHING WRITES THE COLUMN WHOLE ANY MORE ───────────────────────────
const lib = readSoft('src/lib/checkins.ts')
assert(lib.length > 0, 'src/lib/checkins.ts exists — it is the only place a check-in is written')
for (const [name, src] of [['MorningProtocol', mp], ['the objectives card', card]]) {
  assert(!/\.upsert\(/.test(src), `${name} no longer upserts the check-in row`)
  assert(!/\.rpc\(/.test(src), `${name} reaches the database through the one writer, not directly`)
}
assert((lib.match(/supabase\.rpc\('checkin_patch'/g) ?? []).length === 1,
  'there is exactly ONE call site for the merge function, and it is in src/lib/checkins.ts')
assert(/if \(patches\.length === 0\) return false/.test(lib),
  'a write with no patches is a failed write, not a silent success')

assert(/if \(!landed\) \{ setUnsaved\(as\); return false \}/.test(mp),
  'a spirit write that did not land answers false, so the caller cannot tick the screen')
assert(/if \(!landed\) \{ setUnsaved\('objectives'\); return \}/.test(mp),
  'an objectives write that did not land says so and stops')
assert(/if \(!landed\)[\s\S]{0,80}return \}\n    setMindSaved\(true\)/.test(mp),
  'the objectives Saved confirmation is only reached once the row has them')
assert(!/onSaved\?\.\(\)[\s\S]{0,400}await patchCheckin\(/.test(mp),
  'the save signal is never fired before the write')

assert(/return !error/.test(lib), "the one writer answers on the function's own result")
// THE ROW FIRST. The previous version of this suite asserted
// /setCompleted\(before\)/ to prove "a failed tick comes off the screen" — which
// REQUIRED the stale-snapshot rollback Codex flagged as a P2, so it would have
// failed on the correct fix. It encoded the defect as the spec. What the
// re-spec actually asks for is that the tick was never on the screen at all
// (Blaine's ruling, 2026-10-01).
const toggleFn = body(card, '  const toggle = async (i: number) => {')
const stepFn = body(mp, '  const toggleStep = async (i: number) => {')
assert(toggleFn.length > 0 && stepFn.length > 0, 'both tick handlers are found by name')
assert(before(toggleFn, 'await patchCheckin(', 'setCompleted('),
  'the objectives card writes the row BEFORE the tick reaches the screen')
assert(before(stepFn, 'await patchSpirit(', 'setCompleted('),
  'the protocol writes the row BEFORE the step is ticked on the screen')
assert(!/const before = completed/.test(card),
  'no snapshot of what the screen held — there is no paint to roll back to')
assert(!/setCompleted\(before\)/.test(card), 'nothing rolls a paint back')
assert(/if \(!locked \|\| saving\) return/.test(toggleFn) && /if \(!protocol \|\| writing\) return/.test(stepFn),
  'a write in flight stops a second one starting, so two writes of this row never race')

// A retry carries a TAG, never a payload. A captured closure holds the draft it
// was made with, which is a queued intention the re-spec forbids — and Codex
// caught one writing stale objectives over newer edits.
for (const [name, src] of [['the objectives card', card], ['MorningProtocol', mp]]) {
  assert(!/setUnsaved\(\(\)\s*=>/.test(src), `${name} stores no closure in its unsaved state`)
}
// The TYPE is the guard a regex cannot be: a union of string literals and null
// cannot hold a function, so tsc refuses a captured closure outright.
assert(/useState<'draft' \| 'tick' \| null>\(null\)/.test(card),
  'the card names which write failed and its type cannot hold a closure')
assert(/useState<'protocol' \| 'objectives' \| 'tick' \| 'gratitude' \| null>\(null\)/.test(mp),
  'the protocol names which write failed and its type cannot hold a closure')
// A failed tick has nothing to retry: the screen never moved, so the step is
// still as the row has it and tapping it again IS the retry. Offering Retry
// there saved the unchanged array and cleared the warning (Codex r2).
assert(/\{unsaved !== 'tick' && \(/.test(mp), 'a failed tick is offered no Retry, in the protocol as in the card')
assert(/'That step did not save/.test(mp), 'a failed tick says to tap it again')
assert(/patchSpirit\(\[\{ path: \['morning', 'completed'\], value: next \}\], 'tick'\)/.test(mp),
  'a tick tells the writer it was a tick, and sends only the completion flags')

// ── A RETRY RE-SENDS THE PATH THAT FAILED (r3) ─────────────────────────────
// One Retry that rewrote the whole entry would hand every failure back the
// clobbering this round removes — the button would be the fourth whole-entry
// writer. So there is a tag per owned path, and the Record type makes tsc
// refuse a tag with no label rather than rendering `undefined`.
const retry = mp.slice(mp.indexOf('          onClick={() => {'), mp.indexOf('          >\n          Retry'))
assert(/unsaved === 'objectives'[\s\S]{0,120}saveMindState\(\)/.test(retry),
  'a failed objectives write is retried as an objectives write')
assert(/unsaved === 'gratitude'[\s\S]{0,160}path: \['morning', 'gratitude'\]/.test(retry),
  'a failed gratitude write is retried as a gratitude write, not as the whole entry')
assert(/morningEntry\(protocol, completed, gratitude\)/.test(retry),
  'and only the protocol tag retries the whole morning entry, which is what it owns')
assert(/const UNSAVED_LABEL: Record<'protocol' \| 'objectives' \| 'gratitude', string>/.test(mp),
  'every tag that shows a label has one, enforced by the type rather than by a regex')
assert(/onClick=\{\(\) => \{ void saveDraft\(\) \}\}/.test(card),
  "the card's Retry re-runs the draft save, which reads the inputs as they are then")
for (const [name, src] of [['MorningProtocol', mp], ['the objectives card', card]]) {
  assert(/>Retry</.test(src) || /\n\s*Retry\n/.test(src), `${name} offers Retry on screen`)
}

// The banner is built ONCE, above every early return, and rendered in every
// view. It used to sit inside the setup branch only, and generation sets
// `configured` before saving — so after the first save no failure showed a
// warning or a Retry anywhere (Codex r1, P1).
const bannerDecl = mp.indexOf('const unsavedBanner = unsaved ?')
const firstReturn = mp.indexOf('  if (reading) {')
assert(bannerDecl >= 0 && firstReturn >= 0 && bannerDecl < firstReturn,
  'the protocol builds its unsaved banner before the first early return')
assert((mp.match(/\{unsavedBanner[\s&}]/g) ?? []).length >= 2,
  'the protocol renders that banner in more than one view')
const activeView = mp.slice(mp.indexOf('  // ── Active protocol'))
assert(activeView.includes('{unsavedBanner}'),
  'the ACTIVE protocol view renders it — a failed save after generation is where it was invisible')
assert(activeView.indexOf('{unsavedBanner}') < activeView.indexOf('allDone && !reviewOpen'),
  'it renders above the done/expanded split, so the collapsed "morning done" state carries it too')

// ── ONLY THE NEWEST OPERATION PAINTS (r3) ──────────────────────────────────
// The last ordering question this ticket had left: a refresh that started
// before a write landing after it, and painting the row as it was. Blaine left
// it to me. The answer never compares the two operations' contents — it asks
// only which one is newer — so there is nothing to vouch for, nothing to
// negotiate, and the loser is DISCARDED rather than queued.
//
// RUN, not read. `paintGate` is a plain factory in src/lib/checkins.ts for
// exactly this reason: an ordering rule written inside a component could only
// be asserted as text here, and text is satisfied by code wired up wrong.
assert(gateError === null, `src/lib/checkins.ts imports cleanly — ${gateError?.message ?? ''}`)
if (gateFactory) {
  const g = gateFactory()
  const first = g.claim()
  assert(g.mayPaint(first), 'a claim with nothing after it may paint')
  const second = g.claim()
  assert(!g.mayPaint(first), 'a read that claimed BEFORE a later operation may not paint')
  assert(g.mayPaint(second), 'and the later one may')
  assert(!g.mayPaint(first), 'the older claim stays refused — it is discarded, never queued')
  const third = g.claim()
  assert(!g.mayPaint(second) && g.mayPaint(third), 'only ever the newest claim, however many there are')
  assert(first !== second && second !== third, 'claims are distinct, so two cannot be confused for each other')
  const h = gateFactory()
  assert(h.mayPaint(h.claim()), 'each component gets its own gate')
  assert(!h.mayPaint(third), "and one component's claim means nothing to another's gate")
  // The over-discarding direction, which a counter shared between components
  // produces: the protocol writing would throw away the card's in-flight read
  // and the card would hold a loading skeleton it never comes out of.
  const g1 = gateFactory(), g2 = gateFactory()
  const reading = g1.claim()
  g2.claim()
  assert(g1.mayPaint(reading),
    "one component's write does not discard another component's read")
}

// ONE GATE PER COMPONENT, NOT ONE PER RENDER. A gate rebuilt on every render
// forgets every claim, so every read would believe itself the newest and the
// rule would be inert while reading exactly right. Only the hook can say this,
// and running the factory cannot see it — so it is read, and listed in the
// report as read rather than proven.
assert(/if \(gate\.current === null\) gate\.current = paintGate\(\)/.test(lib),
  'the hook builds its gate once and keeps it across renders')

// The rest of the WIRING is also only readable as source, the gap FOR-256 names.
// What can be asserted: both components hold a gate, every read claims before
// it awaits anything and checks before it paints the row, and the claim in a
// read is a captured value rather than a fresh call at the end.
for (const [name, src] of [['MorningProtocol', mp], ['the objectives card', card]]) {
  assert(/const gate = usePaintGate\(\)/.test(src), `${name} holds one paint gate`)
}
const cardLoad = card.slice(card.indexOf('    const load = async () => {'), card.indexOf('    load()'))
assert(cardLoad.length > 0, "the card's read is found by name")
assert(before(cardLoad, 'const claim = gate.claim()', 'await'),
  "the card's read claims before it awaits anything, or a write could start inside the gap")
assert(before(cardLoad, 'gate.mayPaint(claim)', 'setObjectives('),
  "the card's read checks its claim before it paints the row")
// Six spaces puts it OUTSIDE the gated block, whose body is at eight — a
// discarded first read that left the skeleton up would leave the card blank
// for the rest of the session.
assert(/\n      setLoading\(false\)\n/.test(cardLoad.slice(cardLoad.indexOf('gate.mayPaint(claim)'))),
  'and the loading skeleton comes down outside the gate, so a discarded read still ends the skeleton')

const mpRead = mp.slice(mp.indexOf('    let cancelled = false'), mp.indexOf('    return () => { cancelled = true }'))
assert(mpRead.length > 0, "the protocol's read is found by name")
assert(before(mpRead, 'const claim = gate.claim()', 'await'),
  "the protocol's read claims before it awaits anything")
assert(before(mpRead, 'gate.mayPaint(claim)', 'setProtocol('),
  "the protocol's read checks its claim before it paints — generation paints first, so this read can land after it")

// Every write claims. A write never CHECKS: it paints what it just put in the
// row, so there is no older value it could be painting over.
for (const [label, src, decl] of [
  ['the spirit writer', mp, '  const patchSpirit = async ('],
  ['the Goals step', mp, '  const saveMindState = async () => {'],
  ["the card's Goals write", card, '  const saveDraft = async () => {'],
  ["the card's objective tick", card, '  const toggle = async (i: number) => {'],
]) {
  const fn = body(src, decl)
  assert(before(fn, 'gate.claim()', 'await'), `${label} claims before it awaits the row`)
  assert(!/gate\.mayPaint/.test(fn), `${label} does not check a claim — a write paints what it wrote`)
}

// ── verdict ─────────────────────────────────────────────────────────────────
if (fails.length) {
  console.log(`\ncheckin record: ${fails.length} of ${checks} checks FAILED`)
  for (const f of fails) console.log('  ✗ ' + f)
  process.exit(1)
}
console.log(`checkin record: ${checks} checks passed — the row is the record, and there is no second copy`)
