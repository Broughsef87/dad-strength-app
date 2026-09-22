// ── The check-in record (FOR-231) — a standing invariant, its own file ───────
// The row is the record. daily_checkins holds the morning protocol
// (spirit_state) and the day's objectives (mind_state); localStorage is a paint
// layer — written for an instant first frame, replaced by whatever the row
// says, and never read by anything that decides, counts or saves.
//
// This used to be a negotiation between two copies: across FOR-228's rounds,
// nine findings, eight clauses (reconcileLocal, localMatchesMirror, tier,
// newer, pendingLocalSave, settled, a bounded re-read, a protocol-only save
// signal), and a ninth finding inside the eighth clause. Blaine ruled (a): the
// mirror is authoritative. This file holds that ruling:
//
//   1. Nothing outside a component's own first-frame paint reads either paint
//      key, and no save is built from one.
//   2. Every reader reads the row, and the row's answer replaces the paint —
//      including "nothing today".
//   3. The signal that tells readers to re-read fires only once the row holds
//      the change, never when a write starts.
//   4. The negotiation is gone from the whole tree, and cannot come back under
//      its old names.
//   5. A change that has not reached the row says so on screen.
//
// Deliberately NOT one of the components: a revert of the feature must not take
// the check that would catch the revert with it.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'

let failures = 0, passes = 0
const assert = (cond, msg) => { if (cond) passes++; else { failures++; console.log('  ✗ ' + msg) } }
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const readLF = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')
// Code only — the comments quote the old clauses while explaining why they went.
const code = (src) => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
const fnBody = (src, start) => { const at = src.indexOf(start); return at < 0 ? '' : src.slice(at, src.indexOf('\n  }\n', at)) }

const MP_PATH = 'src/components/MorningProtocol.tsx'
const OBJ_PATH = 'src/components/DailyObjectivesCard.tsx'
const mp = readLF(MP_PATH)
const obj = readLF(OBJ_PATH)
const fwc = readLF('src/components/FirstWeekChecklist.tsx')
const dash = readLF('src/app/dashboard/page.tsx')
const adh = readLF('src/lib/adherence.ts')

// ── 0. the ruling is written down where the code is ───────────────────────
assert(/THE RECORD IS THE ROW/.test(mp) && /localStorage is a PAINT\s*\n?\/\/ layer and nothing more/.test(mp),
  'MorningProtocol states which copy is the record — the row — and what localStorage is')
assert(/THE RECORD IS THE ROW/.test(obj) && /one\s*\n?\/\/ authority for the whole row/.test(obj),
  'the objectives card states the same rule for mind_state — one authority for the row, not one per column')

// ── 1. the paint keys: read only to paint, never to decide ────────────────
const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [] })
const files = walk(join(ROOT, 'src')).map((p) => ({ rel: relative(ROOT, p).replace(/\\/g, '/'), src: readFileSync(p, 'utf8').replace(/\r\n/g, '\n') }))
const readers = files.filter((f) => /dad-strength-morning-protocol|dad-strength-mind-state/.test(code(f.src))).map((f) => f.rel).sort()
assert(JSON.stringify(readers) === JSON.stringify([OBJ_PATH, MP_PATH].sort()),
  `the paint keys appear in exactly the two components that paint from them — found ${readers.join(', ')}`)
// Anchored on the effect's CODE — its guard and its dependency list — not on a
// comment, which code() strips (the first version of this looked at nothing).
const fwcEffect = (() => { const at = fwc.indexOf('if (!userId || state.morning_protocol) return'); return at < 0 ? '' : fwc.slice(at, fwc.indexOf('}, [userId, state.morning_protocol, protocolTick])', at)) })()
assert(fwcEffect.length > 0 && !/localStorage/.test(code(fwcEffect)) && /\.from\('daily_checkins'\)\s*\.select\('spirit_state'\)\s*\.eq\('user_id', userId\)\s*\.eq\('date', today\)/.test(fwcEffect),
  'the first-week checklist reads the protocol ROW, not the paint — an unowned browser key would tick it for whoever signs in next')

const mpLoader = mp.slice(mp.indexOf('// PAINT from this device\'s copy'), mp.indexOf('  const saveCache = '))
const mpGets = (code(mp).match(/localStorage\.getItem\(/g) ?? []).length
assert(mpGets === 1 && /localStorage\.getItem\(STORAGE_KEY\)/.test(mpLoader),
  `MorningProtocol reads its paint in ONE place — the first-frame paint on open — found ${mpGets} reads`)
const objGets = (code(obj).match(/localStorage\.getItem\(/g) ?? []).length
const objLoad = obj.slice(obj.indexOf('  useEffect(() => {\n    const load = async () => {'), obj.indexOf('  const toggle = async'))
assert(objGets === 1 && /localStorage\.getItem\(MIND_KEY\)/.test(objLoad),
  `the objectives card reads its paint in ONE place — the first-frame paint on load — found ${objGets} reads`)
const toggleFn = fnBody(obj, 'const toggle = async')
assert(toggleFn.length > 0 && !/localStorage\.getItem/.test(toggleFn) && /const updated = \{ date: localDay\(\), objectives, completedObjectives: newCompleted, lockedIn: locked \}/.test(toggleFn),
  'a tick is built from what the RECORD said, never read-modify-written from the paint — which wrote a row with no objectives when the paint was empty')

// ── 2. every reader reads the row, and the row wins ───────────────────────
assert(/\.from\('daily_checkins'\)\s*\.select\('spirit_state'\)\s*\.eq\('user_id', user\.id\)\s*\.eq\('date', todayKey\(\)\)/.test(mpLoader),
  'the protocol reads its row on every open — the one keyed on its own 4am-cutoff day')
assert(!/remoteDone > localDone|remoteDone|localDone/.test(code(mp)),
  'the row is not compared with the paint — "the remote wins only if more is done" is gone')
assert(/if \(m\?\.protocol && m\.date === todayKey\(\)\) \{[\s\S]{0,400}setProtocol\(m\.protocol\)[\s\S]{0,700}\} else \{[\s\S]{0,500}setProtocol\(null\)[\s\S]{0,200}setConfigured\(false\)[\s\S]{0,120}localStorage\.removeItem\(STORAGE_KEY\)/.test(mpLoader),
  'whatever the row says replaces the paint — and a row with no protocol today takes the painted one away, and clears it')
// The only return allowed before the read is the signed-out one: no user, no row.
const loadGap = objLoad.slice(objLoad.indexOf('localStorage.getItem(MIND_KEY)'), objLoad.indexOf(".from('daily_checkins')"))
  .replace('if (!user) { setLoading(false); return }', '')
assert(objLoad.includes(".from('daily_checkins')") && !/\breturn\b/.test(code(loadGap)),
  'the objectives card reads the row EVERY time — no return between its paint and its read, which is how the paint became the authority')
assert(/setObjectives\(n\.objectives\)[\s\S]{0,300}if \(ms\) localStorage\.setItem\(MIND_KEY[\s\S]{0,120}else localStorage\.removeItem\(MIND_KEY\)/.test(objLoad),
  'and what its row says replaces the paint, including that there is nothing today')
// A change made while the read was in flight is newer than the read.
assert(/const editsAtOpen = localEdits\.current/.test(mpLoader) && /if \(localEdits\.current !== editsAtOpen\) return/.test(mpLoader)
  && /const editsAtOpen = localEdits\.current/.test(objLoad) && /if \(localEdits\.current !== editsAtOpen\)/.test(objLoad),
  'a row read that started before a change made here is not applied over it — the change is newer, and already on its way to the row')
assert(/localEdits\.current\+\+/.test(fnBody(mp, 'const saveCache = ')) && /localEdits\.current\+\+/.test(toggleFn) && /localEdits\.current\+\+/.test(fnBody(obj, 'const saveDraft = async')),
  'every change made here counts as one')

// ── 3. the signal fires once the row has the change ───────────────────────
const saveFn = fnBody(mp, 'const saveCache = ')
const failAt = saveFn.indexOf("if (res.error) { setSync('unsaved'); return }"), signalAt = saveFn.indexOf('onSaved?.()')
assert(failAt > 0 && signalAt > failAt && saveFn.indexOf("from('daily_checkins').upsert(") < failAt,
  'a protocol save signals its readers only AFTER its row write has landed — never when the write starts')
const mindFn = fnBody(mp, 'const saveMindState = ')
const mFail = mindFn.indexOf('if (res.error) {'), mSignal = mindFn.indexOf('onSaved?.()')
assert(mFail > 0 && mSignal > mFail && mindFn.indexOf("from('daily_checkins').upsert(") < mFail,
  'an objectives save does the same — "Saved" and the signal both wait for the row')
assert(!/onProtocolSaved/.test(code(mp)) && !/onProtocolSaved/.test(code(dash)),
  'one signal, because there is one record — the protocol-only signal existed to protect a cache no reader consults')
assert(/queue\(async \(\) => \{[\s\S]{0,700}from\('daily_checkins'\)\.upsert\(/.test(saveFn) && /queue\(async \(\) => supabase\.from\('daily_checkins'\)\.upsert\(/.test(mindFn) && /const \[queue\] = useState\(\(\) => serialWriter\(\)\)/.test(mp),
  'protocol writes go through one queue — gratitude saves per keystroke, and an earlier keystroke landing last would be the record')
assert(/queue\(async \(\) => supabase\.from\('daily_checkins'\)\.upsert\(/.test(fnBody(obj, 'const writeRecord = async')) && /const \[queue\] = useState\(\(\) => serialWriter\(\)\)/.test(obj),
  'objectives writes too')

// ── 4. the negotiation is gone, everywhere ────────────────────────────────
const NEGOTIATION = ['reconcileLocal', 'localMatchesMirror', 'pendingLocalSave', 'PROTOCOL_CACHE_KEY', 'protocolSaveTick', 'onProtocolSaved', 'sameProtocol']
const survivors = files.flatMap((f) => NEGOTIATION.filter((n) => new RegExp(`\\b${n}\\b`).test(code(f.src))).map((n) => `${n} in ${f.rel}`))
assert(survivors.length === 0, `no clause of the old negotiation survives anywhere in src — found ${survivors.join('; ') || 'none'}`)
assert(!/function tier\(|function newer\(|function rank\(/.test(adh) && !/\bupdated_at\b|\.at\b/.test(code(adh).slice(code(adh).indexOf('export function protocolCompleteDays'))),
  'the count chooses a day\'s record without ranking snapshots or reading a timestamp')
const defs = files.filter((f) => /export function serialWriter\(/.test(f.src)).map((f) => f.rel)
assert(JSON.stringify(defs) === JSON.stringify(['src/lib/serialWriter.ts']),
  `the write queue is defined once and shared — found it defined in ${defs.join(', ')}`)

// ── 5. the screen says when a change has not reached the row ──────────────
// Rendered on the sync state — not merely present in the file, where a dead
// branch would keep the words and show nothing.
assert(/\{sync !== 'synced' && \(\s*<p[^>]*role="status">\s*\{sync === 'unsaved'[\s\S]{0,200}not saved yet[\s\S]{0,200}onClick=\{retrySave\}/.test(mp) && /couldn\\u2019t reach your record/.test(mp),
  'the protocol says when a change has not reached the record, offers to retry, and says when the record could not be read')
assert(/mindError && <p/.test(mp) && /setMindError\('not saved/.test(mp), 'an objectives save that did not land says so, instead of "Saved"')
assert(/sync === 'unsaved'[\s\S]{0,200}not saved yet/.test(obj) && /\{syncNote && <p/.test(obj),
  'the objectives card says the same')

if (failures) { console.log(`\ncheckin-record: ${failures} of ${failures + passes} checks FAILED`); process.exit(1) }
console.log(`checkin-record: ${passes} checks passed — the row is the record, and the paint never decides`)
