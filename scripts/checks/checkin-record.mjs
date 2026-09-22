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
import { ACCOUNT_CHANGED, accountAtChange, runAs } from '../../src/lib/checkinQueue.ts'
import { EMPTY, normalise, objectivesBook } from '../../src/lib/objectivesRecord.ts'
import { sameJson } from '../../src/lib/canonical.ts'

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
const objLoad = obj.slice(obj.indexOf('    const load = async () => {'), obj.indexOf('  const toggle = '))
assert(objGets === 1 && /localStorage\.getItem\(MIND_KEY\)/.test(objLoad),
  `the objectives card reads its paint in ONE place — the first-frame paint on load — found ${objGets} reads`)
const toggleFn = fnBody(obj, 'const toggle = ')
const flushFn = fnBody(obj, 'const flush = ')
const draftFn = fnBody(obj, 'const saveDraft = ')
assert(toggleFn.length > 0 && !/localStorage/.test(toggleFn) && /const now = book\.shown\(\)/.test(toggleFn)
  && /book\.intend\(\{ kind: 'tick', day: book\.day\(\), basis: now\.objectives, index: i, done: !now\.completed\[i\], owner \}\)/.test(toggleFn),
  'a tick is an intent against the objectives ON SCREEN — the record plus every pending change — never built from the paint, which wrote a row with no objectives when it was empty')
assert(/runAs\(supabase, owner, async \(me\) => \{[\s\S]{0,900}\.select\('mind_state'\)\.eq\('user_id', me\)\.eq\('date', day\)\.maybeSingle\(\)[\s\S]{0,200}book\.plan\(day, data\?\.mind_state \?\? null\)[\s\S]{0,400}\.upsert\(\s*\{ user_id: me, date: day, mind_state: row,/.test(flushFn),
  'and it is saved as a read-modify-write of the RECORD inside the one queue — the row read, the changes applied to it, the result written back')
assert(/book\.intend\(\{ kind: 'set', day: book\.day\(\), basis: book\.shown\(\)\.objectives, objectives: dense, owner \}\)/.test(draftFn) && /flush\(owner\)/.test(draftFn) && /flush\(owner\)/.test(toggleFn),
  'a lock-in is an intent too, and both go through the same save')
assert(flushFn.indexOf('book.settle(settles)') > flushFn.indexOf('if (w.error) return { ok: false, landed }') && flushFn.indexOf('if (w.error) return { ok: false, landed }') > 0 && flushFn.indexOf('if (error) return { ok: false, landed }') > 0,
  'a change stops being pending only once the row has it — a failed read or write leaves it pending, for the next change or Retry to save (Codex r3)')

// The book, as behaviour. Each case is a defect Codex found or the one FOR-231 fixed.
{
  const D = 'd1'
  const row = (objectives, completedObjectives, lockedIn = true) => ({ date: D, objectives, completedObjectives, lockedIn })
  const tick = (basis, index, done) => ({ kind: 'tick', day: D, basis, index, done })
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

  // Codex r2: a tick against objectives the record no longer holds is dead.
  let b = objectivesBook(D)
  b.intend(tick(['A', 'B'], 0, true))
  let pl = b.plan(D, row(['X', 'Y'], [false, false]))
  assert(pl.write === null && pl.settles.length === 1,
    'a tick made against an objective set the record no longer holds is dropped — never written over the objectives that replaced it')
  // Only its own flag.
  b = objectivesBook(D)
  b.intend(tick(['A', 'B', 'C'], 1, true))
  pl = b.plan(D, row(['A', 'B', 'C'], [true, false, false]))
  assert(pl.write && eq(pl.write.completed, [true, true, false]),
    "a tick changes only its own objective's flag — every other flag stays what the row says")
  // Codex r3 #1: a failed tick is carried by the next change.
  b = objectivesBook(D)
  const a = tick(['A', 'B'], 0, true)
  b.intend(a)                                      // its write fails: nothing settles
  b.intend(tick(['A', 'B'], 1, true))
  pl = b.plan(D, row(['A', 'B'], [false, false]))
  assert(pl.write && eq(pl.write.completed, [true, true]) && pl.settles.length === 2,
    'a change that failed to save is saved by the next one — not overwritten by the flag the row still holds (Codex r3)')
  // Codex r3 #1b: a failed lock-in is carried too — a tick on it does not find it "stale".
  b = objectivesBook(D)
  b.intend({ kind: 'set', day: D, basis: [], objectives: ['A', 'B'] })   // fails
  b.intend(tick(['A', 'B'], 0, true))
  pl = b.plan(D, null)
  assert(pl.write && eq(pl.write.objectives, ['A', 'B']) && eq(pl.write.completed, [true, false]) && pl.write.lockedIn,
    'a lock-in that failed to save is saved with the next change, which is made on it (Codex r3)')
  // Codex r3 #2: an older write's answer does not take back a newer tick.
  b = objectivesBook(D)
  const tA = tick(['A', 'B'], 0, true)
  b.intend(tA)
  b.adopt(D, row(['A', 'B'], [false, false]), b.nextRead(), true)
  const inA = b.plan(D, row(['A', 'B'], [false, false]))              // A's job plans before B exists
  b.intend(tick(['A', 'B'], 1, true))                                  // B, made while A saves
  b.settle(inA.settles)
  b.adopt(D, { date: D, objectives: inA.write.objectives, completedObjectives: inA.write.completed, lockedIn: true }, b.nextRead())
  assert(eq(b.shown().completed, [true, true]) && b.pending().length === 1,
    "an older write's answer landing does not take back a tick made after it — the tick stays on top until its own write lands (Codex r3)")
  // Reads in queue order: an older answer landing last is not the record.
  b = objectivesBook(D)
  const older = b.nextRead(), newer = b.nextRead()
  b.adopt(D, row(['A'], [true]), newer, true)
  const took = b.adopt(D, row(['A'], [false]), older, true)
  assert(!took && eq(b.shown().completed, [true]),
    'a row read landing after a later one is older than it, and does not become the record')
  // The paint never outranks a read.
  b = objectivesBook(D)
  b.adopt(D, null, b.nextRead(), true)
  b.paint(D, row(['A'], [true]))
  assert(eq(b.shown(), EMPTY), 'the paint never outranks a row read — including a read that found nothing today')
  // A change dead against a fresh read stops counting as unsaved.
  b = objectivesBook(D)
  b.intend(tick(['A'], 0, true))
  b.adopt(D, row(['G'], [false]), b.nextRead(), true)
  assert(b.pending().length === 0 && eq(b.shown().objectives, ['G']),
    'a change the record has overtaken — the Goals step replaced its objectives — is dropped, not left saying "not saved"')
  // Sparse legacy rows pair each flag with its objective before compacting.
  const n = normalise(['', 'A', 'B'], [false, true, false])
  assert(eq(n, { objectives: ['A', 'B'], completed: [true, false] }), 'a legacy sparse row keeps each flag on its own objective')
}

// ── 2. every reader reads the row, and the row wins ───────────────────────
assert(/\.from\('daily_checkins'\)\s*\.select\('spirit_state'\)\s*\.eq\('user_id', user\.id\)\s*\.eq\('date', todayKey\(\)\)/.test(mpLoader),
  'the protocol reads its row on every open — the one keyed on its own 4am-cutoff day')
assert(!/remoteDone > localDone|remoteDone|localDone/.test(code(mp)),
  'the row is not compared with the paint — "the remote wins only if more is done" is gone')
assert(/if \(held\) \{[\s\S]{0,400}setProtocol\(held\)[\s\S]{0,700}\} else \{[\s\S]{0,500}setProtocol\(null\)[\s\S]{0,200}setConfigured\(false\)[\s\S]{0,120}localStorage\.removeItem\(STORAGE_KEY\)/.test(mpLoader),
  'whatever the row says replaces the paint — and a row with no protocol today takes the painted one away, and clears it')
// The only return allowed before the read is the signed-out one: no user, no row.
const loadGap = objLoad.slice(objLoad.indexOf('localStorage.getItem(MIND_KEY)'), objLoad.indexOf(".from('daily_checkins')"))
  .replace('if (!user) { setLoading(false); return }', '')
assert(objLoad.includes(".from('daily_checkins')") && !/\breturn\b/.test(code(loadGap)),
  'the objectives card reads the row EVERY time — no return between its paint and its read, which is how the paint became the authority')
assert(/if \(book\.adopt\(today, read\.ms, read\.seq, true\)\) paintCache\(today, read\.ms\)/.test(objLoad)
  && /if \(ms\) localStorage\.setItem\(MIND_KEY[\s\S]{0,120}else localStorage\.removeItem\(MIND_KEY\)/.test(fnBody(obj, 'const paintCache = ')),
  'and what its row says replaces the paint, including that there is nothing today')
// A change made while the read was in flight is newer than the read.
assert(/const editsAtOpen = localEdits\.current/.test(mpLoader) && /if \(!u && localEdits\.current !== editsAtOpen\) \{ setSync\('synced'\); return \}/.test(mpLoader)
  && /localEdits\.current\+\+/.test(fnBody(mp, 'const saveCache = ')),
  'a row read that started before a change made here does not put the protocol back behind it')
// The card needs no such guard: a read becomes the record, and every change the
// row does not have yet stays on top of it (the book, above).
assert(!/setObjectives\(/.test(objLoad.replace(fnBody(obj, 'const show = '), '')) && /show\(\)/.test(objLoad),
  "the card never paints a read directly — it shows the record with this device's pending changes on top")

// Reads and writes, in order (Codex r1). A read asked for while a tick's write
// is pending would return the row from before it and revert the tick on screen;
// two refreshes in flight could answer out of order.
assert(/await runAs\(supabase, user\.id, async \(me\) => \{\s*const r = await supabase\.from\('daily_checkins'\)\.select\('mind_state'\)/.test(objLoad),
  "the card's row read goes through the SAME queue as its writes — it runs after any pending write lands, and reads it back")
assert(/seq: book\.nextRead\(\)/.test(objLoad) && /const seq = book\.nextRead\(\)/.test(flushFn) && /if \(cancelled\) return/.test(objLoad) && /return \(\) => \{ cancelled = true \}/.test(obj),
  'only the newest load paints what it read — every read takes its place in queue order, and one for an unmounted card is dropped')
// The day a change belongs to is captured when it is made, not when its
// queued write runs (Codex r1: across midnight, or 4am, that is the next day).
assert(/for \(const day of book\.days\(\)\)/.test(flushFn) && /date: day, mind_state: row/.test(flushFn) && !/localDay\(\)/.test(flushFn) && !/localDay\(\)/.test(toggleFn) && !/localDay\(\)/.test(draftFn),
  "an objectives write goes to the day the change was made on — carried on the change — never a day read inside the queue")
assert(/const saveCache = \(p: Protocol, c: boolean\[\], g: string\[\], day: string = todayKey\(\)\) => \{/.test(mp) && !/todayKey\(\)/.test(fnBody(mp, 'const saveCache = ').slice(fnBody(mp, 'const saveCache = ').indexOf('runAs(')))
  , 'a protocol write goes to the protocol day the change was made on — captured before it queues, never read inside the queue')
// Codex r2: Retry recomputed the day, so a change that failed before 4am was
// retried after it — into the NEXT day's row.
assert(/latest\.current = \{ p, c, g, day \}/.test(mp) && /const l = latest\.current\s*if \(l\) saveCache\(l\.p, l\.c, l\.g, l\.day\)/.test(fnBody(mp, 'const retrySave = ')),
  'a Retry retries the change on the day it was made — not today')

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
// ONE queue for both components, bound to the account (Codex r2).
assert(/runAs\(supabase, owner, async \(\) => \{[\s\S]{0,700}from\('daily_checkins'\)\.upsert\(/.test(saveFn) && /runAs\(supabase, user\.id, async \(\) => supabase\.from\('daily_checkins'\)\.upsert\(/.test(mindFn),
  'protocol writes go through the one check-in queue — gratitude saves per keystroke, and an earlier keystroke landing last would be the record')
assert(/runAs\(supabase, owner, async \(me\) =>/.test(flushFn) && /const owner = accountAtChange\(supabase, ownerRef\)/.test(toggleFn) && /const owner = accountAtChange\(supabase, ownerRef\)/.test(draftFn),
  'objectives writes too — each bound to the account that made the change, fixed at the change')
assert(/for \(const c of book\.pending\(\)\) \{ const who = await c\.owner; if \(who && who !== me\) book\.settle\(\[c\]\) \}/.test(flushFn),
  'a pending change made under another account is dropped, never saved under this one')
assert(/setSync\(!res\.ok \|\| book\.pending\(\)\.length \? 'unsaved' : 'synced'\)/.test(flushFn) && /setSync\(book\.pending\(\)\.length \? 'unsaved' : 'synced'\)/.test(objLoad),
  'the card never says a change is saved while any change made here has not reached the row (Codex r3)')
assert(!/serialWriter/.test(code(mp)) && !/serialWriter/.test(code(obj)) && /export const checkinQueue = serialWriter\(\)/.test(readLF('src/lib/checkinQueue.ts')),
  'neither component keeps a queue of its own — with one each, a tick on the card could land after the Goals step replaced the objectives it was made against')
const openFn = fnBody(mp, 'const open = ')
assert(/const owner = ownerRef\.current/.test(saveFn) && /user_id: owner,/.test(saveFn) && /if \(!owner\) \{ unsent\.current = latest\.current; setSync\('unsaved'\); return \}/.test(saveFn),
  'a protocol write is bound to the account that made it, captured when it was made — and with no confirmed account it is kept, never a write under an account nobody checked')
assert(openFn.indexOf('ownerRef.current = user.id') > openFn.indexOf("if (read === ACCOUNT_CHANGED || read.error) throw new Error('unreached')") && openFn.indexOf("if (read === ACCOUNT_CHANGED || read.error)") > 0 && (code(mp).match(/ownerRef\.current = /g) ?? []).length === 1,
  "the protocol's account is confirmed only by its row answering — until then the screen is a paint nobody checked, possibly another account's")
assert(/if \(u && \(u\.p === generatedHere\.current \|\| \(held !== null && sameJson\(held, u\.p\)\)\)\) \{\s*saveCache\(u\.p, u\.c, u\.g, u\.day\)/.test(openFn) && /generatedHere\.current = fresh/.test(mp),
  'a change made before then is saved once the record vouches for it — the row holds its protocol, or it was generated here — and otherwise the record replaces it')
assert(/if \(!ownerRef\.current\) \{ void open\(\); return \}/.test(fnBody(mp, 'const retrySave = ')),
  'Retry recovers a failed open — it runs the read again — instead of refusing every change until a reload (Codex r3)')
// runAs, as behaviour: a job queued under one account never runs under another.
{
  let signedIn = 'user-a'
  const db = { auth: { getUser: async () => ({ data: { user: signedIn ? { id: signedIn } : null } }) } }
  let ran = 0
  const job = async () => { ran++; return { error: null } }
  const first = await runAs(db, 'user-a', job)
  signedIn = 'user-b'
  const second = await runAs(db, 'user-a', job)
  signedIn = null
  const third = await runAs(db, 'user-a', job)
  assert(first !== ACCOUNT_CHANGED && second === ACCOUNT_CHANGED && third === ACCOUNT_CHANGED && ran === 1,
    `a write queued for one account does not run once another is signed in, or none is — ran ${ran} of 3 (Codex r2, P1)`)
  signedIn = 'user-a'
  let handed = null
  const none = await runAs(db, Promise.resolve(null), job)
  await runAs(db, Promise.resolve('user-a'), async (me) => { handed = me; return { error: null } })
  assert(none === ACCOUNT_CHANGED && ran === 1 && handed === 'user-a',
    'a change made while no account was known does not run, and a job is handed the account that was checked — what it writes is filed under that one')
  let asked = 0
  const db2 = { auth: { getUser: async () => { asked++; return { data: { user: { id: 'user-c' } } } } } }
  const known = { current: null }
  const first2 = await accountAtChange(db2, known)
  const second2 = await accountAtChange(db2, known)
  assert(first2 === 'user-c' && second2 === 'user-c' && known.current === 'user-c' && asked === 1,
    'with no account known, a change asks who is signed in AT the change — once — instead of refusing until a reload (Codex r3)')
}

// ── 4. the negotiation is gone, everywhere ────────────────────────────────
const NEGOTIATION = ['reconcileLocal', 'localMatchesMirror', 'pendingLocalSave', 'PROTOCOL_CACHE_KEY', 'protocolSaveTick', 'onProtocolSaved', 'sameProtocol']
const survivors = files.flatMap((f) => NEGOTIATION.filter((n) => new RegExp(`\\b${n}\\b`).test(code(f.src))).map((n) => `${n} in ${f.rel}`))
assert(survivors.length === 0, `no clause of the old negotiation survives anywhere in src — found ${survivors.join('; ') || 'none'}`)
assert(!/function tier\(|function newer\(|function rank\(/.test(adh) && !/\bupdated_at\b|\.at\b/.test(code(adh).slice(code(adh).indexOf('export function protocolCompleteDays'))),
  'the count chooses a day\'s record without ranking snapshots or reading a timestamp')
const defs = files.filter((f) => /export function serialWriter\(/.test(f.src)).map((f) => f.rel)
assert(JSON.stringify(defs) === JSON.stringify(['src/lib/serialWriter.ts']),
  `the write queue is defined once and shared — found it defined in ${defs.join(', ')}`)
// The protocol's vouch compares a row's protocol with a painted one; jsonb
// reorders keys, so that is a JSON-value comparison — and there is one of those.
const canon = files.filter((f) => /function canonical\(/.test(code(f.src))).map((f) => f.rel)
assert(JSON.stringify(canon) === JSON.stringify(['src/lib/canonical.ts']),
  `key-order-blind JSON comparison is defined once — found it defined in ${canon.join(', ')}`)
{
  const row = { theme: 't', steps: [{ title: 'a', minutes: 5 }], greeting: 'g' }
  const painted = { greeting: 'g', steps: [{ minutes: 5, title: 'a' }], theme: 't' }
  assert(sameJson(row, painted) && !sameJson(row, { ...painted, theme: 'u' }),
    'a protocol read back from jsonb, keys reordered at every level, is the protocol that was painted — and a different one is not')
}

// ── 5. the screen says when a change has not reached the row ──────────────
// Rendered on the sync state — not merely present in the file, where a dead
// branch would keep the words and show nothing.
const UNREACHED = 'couldn' + String.fromCharCode(92) + 'u2019t reach your record'
assert(/\{sync !== 'synced' && \(\s*<p[^>]*role="status">\s*\{sync === 'unsaved'[\s\S]{0,200}not saved yet[\s\S]{0,200}onClick=\{retrySave\}/.test(mp)
  && mp.includes(UNREACHED) && /reach your record[^<]*<button onClick=\{retrySave\}/.test(mp),
  'the protocol says when a change has not reached the record, and when the record could not be read — and offers Retry for both')
assert(/mindError && <p/.test(mp) && /setMindError\('not saved/.test(mp), 'an objectives save that did not land says so, instead of "Saved"')
assert(/\{sync !== 'synced' && \(\s*<p[^>]*role="status">\s*\{sync === 'unsaved'[\s\S]{0,200}not saved yet[\s\S]{0,200}onClick=\{retry\}/.test(obj) && obj.includes(UNREACHED)
  && /const retry = \(\) => flush\(accountAtChange\(supabase, ownerRef\)\)/.test(obj),
  'the objectives card says the same, and its Retry saves every change the row does not have yet')

if (failures) { console.log(`\ncheckin-record: ${failures} of ${failures + passes} checks FAILED`); process.exit(1) }
console.log(`checkin-record: ${passes} checks passed — the row is the record, and the paint never decides`)
