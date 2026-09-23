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
import { currentRun, sessionIs } from '../../src/lib/objectivesOutbox.ts'

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
// The day's objectives have ONE outbox, shared by the card and the protocol's
// Goals step (src/lib/objectivesOutbox.ts, Codex r7).
const out = readLF('src/lib/objectivesOutbox.ts')
const guard = readLF('src/lib/unloadGuard.ts')
const topFn = (src, start) => { const at = src.indexOf(start); return at < 0 ? '' : src.slice(at, src.indexOf('\n}\n', at)) }

// ── 0. the ruling is written down where the code is ───────────────────────
assert(/THE RECORD IS THE ROW/.test(mp) && /localStorage is a PAINT\s*\n?\/\/ layer and nothing more/.test(mp),
  'MorningProtocol states which copy is the record — the row — and what localStorage is')
assert(/THE RECORD IS THE ROW/.test(obj) && /one\s*\n?\/\/ authority for the whole row/.test(obj),
  'the objectives card states the same rule for mind_state — one authority for the row, not one per column')

// ── 1. the paint keys: read only to paint, never to decide ────────────────
const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [] })
const files = walk(join(ROOT, 'src')).map((p) => ({ rel: relative(ROOT, p).replace(/\\/g, '/'), src: readFileSync(p, 'utf8').replace(/\r\n/g, '\n') }))
const readers = files.filter((f) => /dad-strength-morning-protocol|dad-strength-mind-state/.test(code(f.src))).map((f) => f.rel).sort()
assert(JSON.stringify(readers) === JSON.stringify(['src/lib/objectivesOutbox.ts', MP_PATH].sort()),
  `each paint key appears in exactly one place — the protocol's in its component, the objectives' in their outbox — found ${readers.join(', ')}`)
// Anchored on the effect's CODE — its guard and its dependency list — not on a
// comment, which code() strips (the first version of this looked at nothing).
const fwcEffect = (() => { const at = fwc.indexOf('if (!userId || state.morning_protocol) return'); return at < 0 ? '' : fwc.slice(at, fwc.indexOf('}, [userId, state.morning_protocol, protocolTick])', at)) })()
assert(fwcEffect.length > 0 && !/localStorage/.test(code(fwcEffect)) && /\.from\('daily_checkins'\)\s*\.select\('spirit_state'\)\s*\.eq\('user_id', userId\)\s*\.eq\('date', today\)/.test(fwcEffect),
  'the first-week checklist reads the protocol ROW, not the paint — an unowned browser key would tick it for whoever signs in next')

const mpLoader = mp.slice(mp.indexOf('// PAINT from this device\'s copy'), mp.indexOf('  const saveCache = '))
const mpGets = (code(mp).match(/localStorage\.getItem\(/g) ?? []).length
assert(mpGets === 1 && /localStorage\.getItem\(STORAGE_KEY\)/.test(mpLoader),
  `MorningProtocol reads its paint in ONE place — the first-frame paint on open — found ${mpGets} reads`)
const objGets = (code(out).match(/localStorage\.getItem\(/g) ?? []).length + (code(obj).match(/localStorage\.getItem\(/g) ?? []).length
const objLoad = obj.slice(obj.indexOf('    const load = async () => {'), obj.indexOf('  const toggle = '))
assert(objGets === 1 && /const cached = localStorage\.getItem\(MIND_KEY\)/.test(topFn(out, 'export function paintedMind')) && /const painted = paintedMind\(today\)/.test(objLoad),
  `the objectives paint is read in ONE place — the first frame of the card — found ${objGets} reads`)
const toggleFn = fnBody(obj, 'const toggle = ')
const flushFn = topFn(out, 'export async function flushObjectives')
const draftFn = fnBody(obj, 'const saveDraft = ')
assert(toggleFn.length > 0 && !/localStorage/.test(toggleFn) && /const now = book\(\)\.shown\(\)/.test(toggleFn)
  && /const mine: Change = \{ kind: 'tick', day: book\(\)\.day\(\), basis: now\.objectives, index: i, done: !now\.completed\[i\], owner \}\s*setOvertaken\(false\)\s*intend\(mine\)/.test(toggleFn),
  'a tick is an intent against the objectives ON SCREEN — the record plus every pending change — never built from the paint, which wrote a row with no objectives when it was empty')
assert(/runAs\(supabase, owner, async \(me\) => \{[\s\S]{0,900}\.select\('mind_state'\)\.eq\('user_id', me\)\.eq\('date', day\)\.maybeSingle\(\)[\s\S]{0,200}book\(\)\.plan\(day, data\?\.mind_state \?\? null\)[\s\S]{0,400}\.upsert\(\s*\{ user_id: me, date: day, mind_state: row,/.test(flushFn),
  'and it is saved as a read-modify-write of the RECORD inside the one queue — the row read, the changes applied to it, the result written back')
assert(/const mine: Change = \{ kind: 'set', day: book\(\)\.day\(\), basis: book\(\)\.shown\(\)\.objectives, objectives: dense, owner \}/.test(draftFn) && /intend\(mine\)/.test(draftFn) && /save\(owner\)/.test(draftFn) && /save\(owner\)/.test(toggleFn),
  'a lock-in is an intent too, and both go through the same save')
// Codex r8: the Goals step changes the same objectives on the same screen, so a
// tick worked out from a copy this card took when it last rendered could land
// on an objective the athlete never saw.
assert(/useEffect\(\(\) => onObjectives\(\(\) => \{ show\(\); settleSync\(false, syncRef\.current === 'unreached'\) \}\), \[\]\)/.test(obj)
  && /export function onObjectives\(fn: \(\) => void\): \(\) => void \{\s*readers\.add\(fn\)\s*return \(\) => \{ readers\.delete\(fn\) \}/.test(out)
  && /for \(const fn of \[\.\.\.readers\]\) fn\(\)/.test(out),
  'what a screen shows is what the outbox holds, contents and status both — a tick lands on the objective the athlete is looking at, and a change made on the other screen that failed has its Retry here (Codex r8, r9)')
assert(/settle\(applyIntents\(record\.mind, onDay\(d\)\)\.dead, 'dropped'\)/.test(readLF('src/lib/objectivesRecord.ts')),
  'a change a row read overtakes is dropped with an answer, not quietly forgotten (Codex r9)')
// Codex r8: a change the record overtook was reported as saved — the Goals step
// said "Saved" and hid its button over objectives that were never written.
assert(/book\(\)\.settle\(applied, 'saved'\)\s*book\(\)\.settle\(dead, 'dropped'\)/.test(flushFn) && /export const wasDropped = \(c: Change\) => book\(\)\.discarded\(c\)/.test(out)
  && /if \(wasDropped\(mine\)\) \{ setMindError\(/.test(mindFn2Early())
  && /if \(res\.dropped\.length\) setOvertaken\(true\)/.test(fnBody(obj, 'const save = '))
  && /const before = \[\.\.\.book\(\)\.pending\(\)\]/.test(flushFn) && /return \{ \.\.\.out, dropped: before\.filter\(\(c\) => book\(\)\.discarded\(c\)\) \}/.test(flushFn)
  && /\{overtaken && \(\s*<p[^>]*role="status">/.test(obj),
  'a change the record overtook is not "saved": both screens say so, and neither hides what was typed behind a confirmation it cannot make (Codex r8)')
// Codex r14: a refresh can overtake a pending change when no save is watching
// for it — the card's own save has already answered, or belongs to a card that
// is gone — and it vanished without the notice.
assert(/export function adoptRead\(day: string, ms: unknown, seq: number, load = false\): Change\[\] \{\s*const before = \[\.\.\.book\(\)\.pending\(\)\][\s\S]{0,200}return before\.filter\(\(c\) => book\(\)\.discarded\(c\)\)/.test(out)
  && /if \(adoptRead\(today, read\.ms, read\.seq, true\)\.length\) setOvertaken\(true\)/.test(objLoad),
  'a change a refresh overtakes is said out loud too, not dropped where no save is left watching for it (Codex r14)')
function mindFn2Early() { return fnBody(mp, 'const saveMindState = ') }
// Codex r7: the Goals step wrote the row itself, so a save that failed there was
// remembered by nothing — its objectives lived in the paint until the card
// replaced it with the row, and there was nothing to retry.
const mindFn2 = fnBody(mp, 'const saveMindState = ')
assert(/book\(\)\.turn\(localDay\(\)\)\s*const owner = changedBy\(ownerRef\.current\)\s*const mine: Change = \{ kind: 'set', day: book\(\)\.day\(\), basis: book\(\)\.shown\(\)\.objectives, objectives: dense, owner \}\s*intend\(mine\)/.test(mindFn2)
  && /const res = await flushObjectives\(owner\)/.test(mindFn2) && !/upsert/.test(mindFn2) && !/mind_state/.test(code(mp)),
  "the protocol's Goals step makes the same kind of change, in the same outbox — one writer of the day's objectives, not two (Codex r7)")
assert(flushFn.indexOf("book().settle(applied, 'saved')") > flushFn.indexOf('if (w.error) return { ok: false, landed }') && flushFn.indexOf('if (w.error) return { ok: false, landed }') > 0 && flushFn.indexOf('if (error) return { ok: false, landed }') > 0,
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
  assert(pl.write === null && pl.applied.length === 0 && pl.dead.length === 1,
    'a tick made against an objective set the record no longer holds is dropped — never written over the objectives that replaced it, and named as dropped (Codex r8)')
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
  assert(pl.write && eq(pl.write.completed, [true, true]) && pl.applied.length === 2 && pl.dead.length === 0,
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
  b.settle(inA.applied, 'saved')
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
  const overtaken = tick(['A'], 0, true)
  b.intend(overtaken)
  b.adopt(D, row(['G'], [false]), b.nextRead(), true)
  assert(b.pending().length === 0 && eq(b.shown().objectives, ['G']) && b.discarded(overtaken),
    'a change the record has overtaken — the Goals step replaced its objectives — is dropped, not left saying "not saved"')
  // Codex r9: a read landing while a save is still queued dropped the change
  // that save was carrying, and the save then reported success — over
  // objectives that were never written. What became of a change is the book's
  // to answer, whichever path discarded it.
  {
    const c = objectivesBook(D)
    const mine = { kind: 'set', day: D, basis: ['A'], objectives: ['B'] }
    c.intend(mine)
    c.adopt(D, row(['somebody', 'else'], [false, false]), c.nextRead(), true)
    const late = c.plan(D, row(['somebody', 'else'], [false, false]))
    assert(c.discarded(mine) && late.write === null && late.applied.length === 0 && c.pending().length === 0,
      'a change dropped by a read that landed while its save was queued is still answered — its save writes nothing, and cannot say "saved" (Codex r9)')
  }
  // Sparse legacy rows pair each flag with its objective before compacting.
  const n = normalise(['', 'A', 'B'], [false, true, false])
  assert(eq(n, { objectives: ['A', 'B'], completed: [true, false] }), 'a legacy sparse row keeps each flag on its own objective')
}

// ── 2. every reader reads the row, and the row wins ───────────────────────
assert(/\.from\('daily_checkins'\)\s*\.select\('spirit_state'\)\s*\.eq\('user_id', who\)\s*\.eq\('date', day\)/.test(mpLoader) && /const row = await readSpirit\(supabase, user\.id, todayKey\(\)\)/.test(mpLoader),
  'the protocol reads its row on every open — the one keyed on its own 4am-cutoff day')
assert(!/remoteDone > localDone|remoteDone|localDone/.test(code(mp)),
  'the row is not compared with the paint — "the remote wins only if more is done" is gone')
assert(/if \(held\) \{[\s\S]{0,400}setProtocol\(held\)[\s\S]{0,700}\} else \{[\s\S]{0,500}setProtocol\(null\)[\s\S]{0,200}setConfigured\(false\)[\s\S]{0,120}localStorage\.removeItem\(STORAGE_KEY\)/.test(mpLoader),
  'whatever the row says replaces the paint — and a row with no protocol today takes the painted one away, and clears it')
// The only return allowed before the read is the signed-out one: no user, no row.
const paintAt = objLoad.indexOf('const painted = paintedMind(today)')
const loadGap = objLoad.slice(paintAt, objLoad.indexOf(".from('daily_checkins')"))
  .replace('if (!user) { settleSync(false); setLoading(false); return }', '')
assert(paintAt > 0 && objLoad.includes(".from('daily_checkins')") && !/\breturn\b/.test(code(loadGap)),
  'the objectives card reads the row EVERY time — no return between its paint and its read, which is how the paint became the authority')
assert(/const painted = paintedMind\(today\)\s*if \(painted\) book\(\)\.paint\(today, painted\)[\s\S]{0,400}show\(\)\s*if \(painted \|\| book\(\)\.pending\(\)\.length\) setLoading\(false\)/.test(objLoad)
  && /if \(!user\) \{ settleSync\(false\); setLoading\(false\); return \}/.test(objLoad),
  'the card shows what this tab holds before any read answers — a first lock-in that failed is kept there and nowhere else, and coming back to an empty editor is losing it (Codex r12)')
assert(/adoptRead\(today, read\.ms, read\.seq, true\)/.test(objLoad)
  && /if \(book\(\)\.adopt\(day, ms, seq, load\)\) paintMind\(day, ms\)/.test(out)
  && /if \(ms\) localStorage\.setItem\(MIND_KEY[\s\S]{0,120}else localStorage\.removeItem\(MIND_KEY\)/.test(topFn(out, 'export function paintMind')),
  'and what its row says replaces the paint, including that there is nothing today')
// A change made while the read was in flight is newer than the read.
assert(/const editsAtOpen = localEdits\.current/.test(mpLoader) && /if \(keepScreen \|\| \(!rejected && localEdits\.current !== editsAtOpen \+ ownEdits\)\) \{ showStatus\(\); return \}/.test(mpLoader) && /ownEdits\+\+/.test(mpLoader) && /if \(!vouched && u\.day === todayKey\(\)\) rejected = true/.test(mpLoader)
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
assert(/seq: book\(\)\.nextRead\(\)/.test(objLoad) && /const seq = book\(\)\.nextRead\(\)/.test(flushFn) && /if \(cancelled\) return/.test(objLoad) && /return \(\) => \{ cancelled = true \}/.test(obj),
  'only the newest load paints what it read — every read takes its place in queue order, and one for an unmounted card is dropped')
// The day a change belongs to is captured when it is made, not when its
// queued write runs (Codex r1: across midnight, or 4am, that is the next day).
assert(/for \(const day of book\(\)\.days\(\)\)/.test(flushFn) && /date: day, mind_state: row/.test(flushFn) && !/localDay\(\)/.test(flushFn) && !/localDay\(\)/.test(toggleFn),
  "an objectives write goes to the day the change was made on — carried on the change — never a day read inside the queue")
// Codex r4: a card left open across midnight locked new objectives into
// yesterday's row. A lock-in is for the day it is typed on; a tick stays with
// the objectives it was made on.
assert(draftFn.indexOf('book().turn(localDay())') > 0 && draftFn.indexOf('book().turn(localDay())') < draftFn.indexOf("const mine: Change = { kind: 'set'"),
  'a lock-in is made for the day it is typed on — the card turns to today first, when the change is made (Codex r4)')
{
  const b = objectivesBook('2026-09-21')
  b.adopt('2026-09-21', { objectives: ['old'], completedObjectives: [true], lockedIn: true }, b.nextRead(), true)
  b.intend({ kind: 'tick', day: '2026-09-21', basis: ['old'], index: 0, done: false })
  b.turn('2026-09-22')
  const set = { kind: 'set', day: b.day(), basis: b.shown().objectives, objectives: ['new'] }
  b.intend(set)
  const stale = b.adopt('2026-09-21', { objectives: ['old'], completedObjectives: [true], lockedIn: true }, b.nextRead(), true)
  const plan = b.plan('2026-09-22', null)
  assert(b.day() === '2026-09-22' && JSON.stringify(b.shown().objectives) === '["new"]' && !stale && plan.write && plan.write.objectives[0] === 'new'
    && JSON.stringify(b.days()) === '["2026-09-21","2026-09-22"]',
    "after midnight a lock-in goes to today's row, a read of yesterday cannot take the card back, and yesterday's pending tick keeps its day")
}
assert(/const saveCache = \(p: Protocol, c: boolean\[\], g: string\[\], day: string = todayKey\(\), again\?: Latest\) => \{/.test(mp) && !/todayKey\(\)/.test(fnBody(mp, 'const saveCache = ').slice(fnBody(mp, 'const saveCache = ').indexOf('runAs(')))
  , 'a protocol write goes to the protocol day the change was made on — captured before it queues, never read inside the queue')
// Codex r2: Retry recomputed the day, so a change that failed before 4am was
// retried after it — into the NEXT day's row.
assert(/kept\.latest = \{\s*p, c, g, day, n: \+\+stamp,/.test(mp)
  && /const retrySave = \(\) => \{ void open\(\) \}/.test(mp),
  "a Retry IS the open-time read: it reads each kept day's row and saves the change only if that row still holds what the change was made against — every day the row does not have, never the latest snapshot, and never over a protocol another device has put there since (Codex r2, r13, r15, r26)")
// Codex r5: moving to another tab in the app unmounts these components. What
// the row does not have yet is kept per TAB, and the next open saves it — and
// it is never touched while rendering, where a server render would hand one
// visitor's changes to the next.
assert(/^const kept: \{[\s\S]{0,160}\} = \{ latest: null, unsent: new Map\(\) \}/m.test(mp) && !/useRef<Latest \| null>/.test(mp),
  'a protocol change the row does not have outlives this component — one tab, not one mount')
assert(/^const makeBook = \(\) => objectivesBook<Change>\(localDay\(\)\)\nlet theBook: ReturnType<typeof makeBook> \| null = null\nexport const book = \(\) => \{ watchSession\(\); return \(theBook \?\?= makeBook\(\)\) \}/m.test(out)
  && !/useState\(\(\) => objectivesBook/.test(obj) && !/\bbook\(\)/.test(obj.slice(obj.lastIndexOf('  return ('))),
  'the objectives outbox too — and its book is made on a click or an effect, never while rendering')
assert(/if \(book\(\)\.pending\(\)\.length\) save\(changedBy\(ownerRef\.current\)\)/.test(objLoad),
  'and a change kept from an earlier visit is saved when the card opens again (Codex r5)')
assert(/if \(res\.error\) \{ keep\(mine\); showStatus\(\); return \}\s*settled\(mine\)/.test(fnBody(mp, 'const saveCache = '))
  && /const settled = \(u: Latest\) => \{\s*const held = kept\.unsent\.get\(u\.day\)\s*if \(held && held\.n <= u\.n\) kept\.unsent\.delete\(u\.day\)\s*\}/.test(mp)
  && /const keep = \(u: Latest\) => \{\s*const held = kept\.unsent\.get\(u\.day\)\s*if \(!held \|\| held\.n <= u\.n\) kept\.unsent\.set\(u\.day, u\)\s*\}/.test(mp),
  "a protocol write that failed leaves its change kept, and a write that landed settles its own change and every older one for ITS DAY — never a newer one, and never another day's, which is a row this write cannot carry (Codex r6, r12)")
// Codex r6: a mount-local counter said "no write of mine is in flight", and
// cleared a change another mount had made.
assert(/^let writing = 0/m.test(mp) && !/inFlight/.test(mp) && /const s = writing \? 'saving' : kept\.unsent\.size \? 'unsaved' : 'synced'/.test(mp),
  'what the screen says is what everything kept says — writes counted per tab, not per mount (Codex r6)')

// ── 3. the signal fires once the row has the change ───────────────────────
const saveFn = fnBody(mp, 'const saveCache = ')
const failAt = saveFn.indexOf('if (res.error) { keep(mine); showStatus(); return }'), signalAt = saveFn.indexOf('onSaved?.()')
assert(failAt > 0 && signalAt > failAt && saveFn.indexOf("from('daily_checkins').upsert(") < failAt,
  'a protocol save signals its readers only AFTER its row write has landed — never when the write starts')
const mindFn = fnBody(mp, 'const saveMindState = ')
const mFail = mindFn.indexOf('if (!res.ok) {'), mSignal = mindFn.indexOf('onSaved?.()')
assert(mFail > 0 && mSignal > mFail && mindFn.indexOf('await flushObjectives(owner)') < mFail,
  'an objectives save does the same — "Saved" and the signal both wait for the row')
assert(!/onProtocolSaved/.test(code(mp)) && !/onProtocolSaved/.test(code(dash)),
  'one signal, because there is one record — the protocol-only signal existed to protect a cache no reader consults')
// ONE queue for both components, bound to the account (Codex r2).
assert(/runAs\(supabase, mine\.by, async \(me\): Promise<\{ error: \{ message: string \} \| null; stale\?: true \}> => \{[\s\S]{0,900}from\('daily_checkins'\)\.upsert\(/.test(saveFn),
  'protocol writes go through the one check-in queue — gratitude saves per keystroke, and an earlier keystroke landing last would be the record')
assert(/runAs\(supabase, owner, async \(me\) =>/.test(flushFn) && /const owner = changedBy\(ownerRef\.current\)/.test(toggleFn) && /const owner = changedBy\(ownerRef\.current\)/.test(draftFn)
  && /export const changedBy = \(known: string \| null\): Promise<string \| null> =>\s*accountAtChange\(createClient\(\), \{ current: known \}\)/.test(out),
  'objectives writes too — each bound to the account that made the change, fixed at the change')
assert(/const who = await c\.owner\s*if \(who === null \? c\.run !== run : who !== me\) book\(\)\.settle\(\[c\], 'dropped'\)/.test(flushFn)
  && /function sessionIs\(id: string \| null, ended = false\) \{\s*if \(ended \|\| \(id !== null && account !== null && id !== account\)\) run\+\+\s*account = id\s*\}/.test(out)
  && /export function accountIs\(me: string\) \{ sessionIs\(me\) \}/.test(out)
  && /accountIs\(me\)/.test(flushFn) && /accountIs\(user\.id\)/.test(objLoad) && /accountIs\(user\.id\)/.test(mpLoader)
  && /c\.run = run/.test(topFn(out, 'export function intend')),
  'a pending change made under another account is dropped, never saved under this one — and one nobody could name an account for belongs to the run it was made in, because objectives are private and matching text is no kind of ownership (Codex r10, P1)')
// Codex r11: with no account ever confirmed, a sign-out started no new run at
// all, and the next account's empty row took the objectives of the one before.
assert(/createClient\(\)\.auth\.onAuthStateChange\(\(event: string, session: Session\) => \{\s*sessionIs\(session\?\.user\?\.id \?\? null, event === 'SIGNED_OUT'\)/.test(out)
  && /export const book = \(\) => \{ watchSession\(\); return/.test(out),
  'and the run is watched at the SESSION, not at what a screen managed to load — the case that matters is the one where no screen ever confirmed an account (Codex r11, P1)')
// The rule itself, as behaviour — the outbox's own, not a copy of it here.
{
  const seen = []
  sessionIs('user-a'); seen.push(currentRun())         // told for the first time: the same run
  sessionIs('user-a'); seen.push(currentRun())         // a token refresh: the same run
  sessionIs(null, true); seen.push(currentRun())       // signed out: a new run
  sessionIs('user-b'); seen.push(currentRun())         // b signs in: still that new run
  sessionIs('user-c'); seen.push(currentRun())         // another account again: another run
  const moved = seen.map((r) => r - seen[0])
  assert(JSON.stringify(moved) === JSON.stringify([0, 0, 1, 1, 2]),
    'a change made before the tab knew who was signed in survives being told, and never survives a sign-out — moved ' + moved.join(','))
}
assert(/const settleSync = \(failed: boolean, unreached = false\) =>\s*setSync\(savingObjectives\(\) \? 'saving' : failed \|\| book\(\)\.pending\(\)\.length \? 'unsaved' : unreached \? 'unreached' : 'synced'\)/.test(obj)
  && /export const savingObjectives = \(\) => writing > 0/.test(out)
  && /settleSync\(!res\.ok\)/.test(fnBody(obj, 'const save = ')) && /settleSync\(false\)/.test(objLoad) && !/setSync\('synced'\)/.test(code(obj))
  && /if \(!\('seq' in read\) \|\| read\.error\) \{ settleSync\(false, true\); setLoading\(false\); return \}/.test(objLoad) && !/setSync\('unreached'\)/.test(code(obj)),
  'the card never says a change is saved while any change made here has not reached the row, or while a save is still queued (Codex r3, r4)')
// Codex r4: queued behind other writes, a change read as saved until its turn came.
assert(/setSync\('saving'\)\s*void flushObjectives\(owner\)/.test(fnBody(obj, 'const save = ')) && /writing\+\+\s*mark\(\)/.test(flushFn) && /writing\+\+\s*showStatus\(\)/.test(saveFn)
  && /writing--[\s\S]{0,600}showStatus\(\)/.test(saveFn) && /const showStatus = \(\) => setSync\(statusNow\(\)\)/.test(mp),
  'a change says "saving" from the moment it is made, and "saved" only when the last write queued has landed (Codex r4)')
// Codex r7: the warning belonged to the component, so navigating to another
// page in the app took it off a change still kept in the tab. It belongs to
// whatever HOLDS the change.
assert(/const warn = \(e: BeforeUnloadEvent\) => \{ e\.preventDefault\(\); e\.returnValue = '' \}/.test(guard)
  && /if \(has\) window\.addEventListener\('beforeunload', warn\)\s*else window\.removeEventListener\('beforeunload', warn\)/.test(guard)
  && !/beforeunload/.test(code(mp)) && !/beforeunload/.test(code(obj)),
  'closing the tab on a change the row does not have asks first — and the warning is not a component\'s to lose (Codex r7)')
assert(/setUnloadGuard\('protocol', s !== 'synced'\)/.test(mp) && /const mark = \(\) => \{\s*setUnloadGuard\('objectives', writing > 0 \|\| book\(\)\.pending\(\)\.length > 0\)/.test(out),
  'both stores raise it while they hold one: the protocol as it says where it stands, the outbox as changes are made and settled')
assert(/\{sync === 'saving' && 'saving · '\}\{doneCount\}/.test(obj) && /\{sync === 'saving' && <span[^>]*role="status">saving<\/span>\}/.test(mp),
  'and the screen says it is saving, in the header, where it moves nothing under the next tap')
assert(!/serialWriter/.test(code(mp)) && !/serialWriter/.test(code(obj)) && /export const checkinQueue = serialWriter\(\)/.test(readLF('src/lib/checkinQueue.ts')),
  'neither component keeps a queue of its own — with one each, a tick on the card could land after the Goals step replaced the objectives it was made against')
const openFn = fnBody(mp, 'const open = ')
assert(/const owner = ownerRef\.current/.test(saveFn) && /user_id: me,/.test(saveFn) && !/user_id: owner/.test(saveFn) && /if \(!owner\) \{\s*keep\(mine\)\s*const s = statusNow\(\)/.test(saveFn),
  'a protocol write is bound to the account that made it, captured when it was made — and with no confirmed account it is kept, never a write under an account nobody checked')
// Codex r16, P1: a snapshot sent again was re-stamped from what was true NOW —
// the account signed in, the protocol last generated — so a change account A
// made could be written under B, and an older day's generated protocol lost
// the only thing that could vouch for it.
assert(/by: again \? again\.by : madeBy\(\)/.test(mp) && /run: again \? again\.run : currentRun\(\)/.test(mp) && /const onTop = \[\.\.\.sending, \.\.\.\(kept\.unsent\.get\(day\) \? \[kept\.unsent\.get\(day\) as Latest\] : \[\]\)\]/.test(mp)
  && /\.reduce<Latest \| null>\(\(newest, u\) => \(newest === null \|\| u\.n > newest\.n \? u : newest\), null\)/.test(mp)
  && /was: again \? again\.was : \(onTop \? onTop\.was : recordP\.current\)/.test(mp)
  && /if \(vouched\) \{[\s\S]{0,400}saveCache\(u\.p, u\.c, u\.g, u\.day, \{ \.\.\.u, by: Promise\.resolve\(user\.id\) \}\)/.test(openFn)
  && /\} catch \{ \/\* that day's row did not answer; it stays kept \*\/ \}/.test(openFn),
  'a snapshot sent again keeps what was fixed when it was MADE — the account that made it, the run it was made in, and what it was made against — because having been sent under one account is no authorization under the next (Codex r16, r19)')
assert(openFn.indexOf('ownerRef.current = user.id') > openFn.indexOf('const row = await readSpirit(supabase, user.id, todayKey())') && openFn.indexOf('const row = await readSpirit(supabase, user.id, todayKey())') > 0
  && /if \(read === ACCOUNT_CHANGED \|\| read\.error\) throw new Error\('unreached'\)/.test(fnBody(mp, 'const readSpirit = ')) && (code(mp).match(/ownerRef\.current = /g) ?? []).length === 1,
  "the protocol's account is confirmed only by its row answering — until then the screen is a paint nobody checked, possibly another account's")
assert(/const its = u\.day === todayKey\(\) \? held : protocolOn\(await readSpirit\(supabase, user\.id, u\.day\), u\.day\)\s*vouched = sameJson\(its, u\.was\)/.test(openFn)
  && /if \(vouched\) \{[\s\S]{0,400}saveCache\(u\.p, u\.c, u\.g, u\.day, \{ \.\.\.u, by: Promise\.resolve\(user\.id\) \}\)/.test(openFn)
  && /const recordP = useRef<Protocol \| null>\(null\)/.test(mp) && /recordP\.current = data\.protocol/.test(mpLoader)
  && openFn.indexOf('recordP.current = held') > 0 && openFn.indexOf('recordP.current = held') < openFn.indexOf('for (const u of [...kept.unsent.values()])')
  && /if \(localEdits\.current === editsAtOpen\) applyRecord\(\)/.test(openFn)
  && openFn.indexOf('if (localEdits.current === editsAtOpen) applyRecord()') < openFn.indexOf('ownerRef.current = user.id')
  && /const isToday = day === todayKey\(\)/.test(saveFn) && /if \(isToday\) recordP\.current = p/.test(saveFn) && /const onTop = \[\.\.\.sending, \.\.\.\(kept\.unsent\.get\(day\) \? \[kept\.unsent\.get\(day\) as Latest\] : \[\]\)\]/.test(mp)
  && /\.reduce<Latest \| null>\(\(newest, u\) => \(newest === null \|\| u\.n > newest\.n \? u : newest\), null\)/.test(mp)
  && /was: again \? again\.was : \(onTop \? onTop\.was : recordP\.current\)/.test(mp) && !/generated/.test(code(mp)),
  'a change made before then is saved once the record vouches for it — the row still holds what the change was made against, which is the rule the objectives keep too: a rebuild whose save failed is recoverable because the row still holds what it replaced, and a protocol replaced elsewhere is never put back (Codex r18, r19)')
assert(/const queuedFor = new Map<string, number>\(\)/.test(mp) && /queuedFor\.set\(day, mine\.n\)/.test(saveFn)
  && /if \(\(queuedFor\.get\(day\) \?\? 0\) > mine\.n\) return \{ error: null, stale: true \}/.test(saveFn)
  && /if \('stale' in res && res\.stale\) \{ showStatus\(\); return \}/.test(saveFn),
  'a queued write the day has moved past writes nothing — gratitude saves on every keystroke, each carries the whole protocol, and the newest one is all of them (Codex r18)')
// Codex r5: retried after 4am, it was compared with the NEW day's row, which
// cannot hold yesterday's protocol — and was dropped as if the record had
// replaced it.
assert(openFn.indexOf('settled(u)', openFn.indexOf('const its = u.day === todayKey()')) > openFn.indexOf('const its = u.day === todayKey()')
  && /for \(const u of \[\.\.\.kept\.unsent\.values\(\)\]\)/.test(openFn)
  && /if \(u\.day === todayKey\(\)\) recovered = u/.test(openFn)
  && /if \(recovered\) \{[\s\S]{0,400}setProtocol\(recovered\.p\)\s*setCompleted\(recovered\.c\)\s*setGratitude\(recovered\.g\)\s*setConfigured\(true\)\s*return\s*\}/.test(openFn)
  && openFn.indexOf('if (u.day === todayKey()) recovered = u') > openFn.indexOf('saveCache(u.p, u.c, u.g, u.day, { ...u, by: Promise.resolve(user.id) })'),
  "the kept change is vouched against the row of the day it was made on, stays kept until that row has answered, and an earlier day's change recovered does not stop today's record being applied (Codex r5, r6)")
// Codex r6, P1: kept state outlives a sign-out. A change account A made must
// never be saved under account B — its protocol, and its gratitude, are A's.
assert(/type Latest = \{[\s\S]{0,900}by: Promise<string \| null>[\s\S]{0,900}was: Protocol \| null[\s\S]{0,900}run: number\s*\}/.test(mp)
  && /kept\.latest = \{\s*p, c, g, day, n: \+\+stamp,[\s\S]{0,900}was: again \? again\.was :[\s\S]{0,200}\}/.test(mp)
  && /const madeBy = \(\): Promise<string \| null> => accountAtChange\(createClient\(\), \{ current: ownerRef\.current \}\)/.test(mp),
  'every change kept carries the account that made it, fixed at the change, and a change-time lookup never becomes the confirmed account')
assert(/const by = await u\.by\s*let vouched = false\s*if \(by !== null \? by !== user\.id : u\.run !== currentRun\(\)\) \{\s*if \(kept\.latest && kept\.latest\.n <= u\.n\) kept\.latest = null\s*\} else \{/.test(openFn),
  'and a change made by another account is dropped, never saved under this one — and one nobody could name an account for belongs to the run of this tab it was made in, because an empty row of the next account is no kind of ownership (Codex r6, r20, P1)')
// Codex r20: a gratitude line typed while the protocol it belongs to was
// still saving was made against what the row held BEFORE that save landed.
assert(/const movedOn = \(day: string, p: Protocol, after: number\) => \{\s*const held = kept\.unsent\.get\(day\)\s*for \(const s of held \? \[\.\.\.sending, held\] : \[\.\.\.sending\]\) if \(s\.day === day && s\.n > after\) s\.was = p/.test(mp)
  && /movedOn\(day, p, mine\.n\)/.test(saveFn) && /sending\.add\(mine\)/.test(saveFn) && /sending\.delete\(mine\)/.test(saveFn),
  'a write that landed advances what anything still on its way to that day was made against — kept OR in flight, because a change made while a save is running is made on top of it, and comparing it with what the row held before would throw it away (Codex r20, r21)')
// Codex r10: deciding a kept change takes an await or two, and the account is
// confirmed before them — so a change made meanwhile is written on its own, and
// this older snapshot must not land on top of it.
assert(/settled\(u\)\s*\/\/[\s\S]{0,900}if \(kept\.latest !== null && kept\.latest\.day === u\.day && kept\.latest\.n > u\.n\) \{\s*if \(u\.day === todayKey\(\)\) keepScreen = true\s*continue\s*\}/.test(openFn)
  && openFn.indexOf('if (kept.latest !== null && kept.latest.day === u.day && kept.latest.n > u.n)') < openFn.indexOf('if (vouched) {')
  && /if \(keepScreen \|\| \(!rejected && localEdits\.current !== editsAtOpen \+ ownEdits\)\) \{ showStatus\(\); return \}/.test(openFn),
  'a kept change superseded while it was being decided is not saved, and the record is not applied over the change that superseded it (Codex r10)')
assert(/const protocolOn = \(row: \{ spirit_state\?: unknown \} \| null, day: string\) => \{[\s\S]{0,200}n\?\.protocol && n\.date === day \? n\.protocol : null/.test(mp)
  && (code(mp).match(/n\.date === day|m\.date === todayKey\(\)/g) ?? []).length === 1,
  'which day a row holds a protocol for is decided in one place, for any day')
// Kept while the open-time read runs is saving, not unsaved — the read saves
// it — and unsaved the moment that read ends without an account or a row.
assert(/setSync\(opening\.current \? 'saving' : s\)/.test(saveFn) && /opening\.current = true/.test(openFn) && /\} finally \{\s*opening\.current = false\s*\}/.test(openFn)
  && /if \(!user\) \{ if \(kept\.unsent\.size\) setSync\('unsaved'\); return \}/.test(openFn) && /setSync\(kept\.unsent\.size \? 'unsaved' : 'unreached'\)/.test(openFn),
  'a change kept while the open-time read runs says "saving" — and "not saved" once the read ends without saving it')
// Codex r25: a screen left while its open was reading went on settling and
// writing behind the screen that replaced it — which then showed one protocol
// while another was being saved.
assert(/^let opens = 0/m.test(mp) && /const mine = \+\+opens\s*const live = \(\) => mine === opens/.test(openFn)
  && /return \(\) => \{ opens\+\+ \}/.test(mpLoader)
  && /for \(const u of \[\.\.\.kept\.unsent\.values\(\)\]\) \{\s*if \(!live\(\)\) return/.test(openFn)
  && /if \(!live\(\)\) return\s*const held = protocolOn\(row, todayKey\(\)\)/.test(openFn)
  && /if \(!live\(\)\) return\s*if \(recovered\) \{/.test(openFn)
  && /const by = await u\.by[\s\S]{0,1200}if \(!live\(\)\) return\s*settled\(u\)/.test(openFn),
  "only this tab's newest open reads, settles and recovers — a newer one, or leaving the screen, ends the one before (Codex r25)")
// Codex r7: recovered without being rendered, the screen sat on the config step
// with a protocol already in the row — and generating again would overwrite it.
assert(/setProtocol\(recovered\.p\)\s*setCompleted\(recovered\.c\)\s*setGratitude\(recovered\.g\)\s*setConfigured\(true\)/.test(openFn),
  "a protocol recovered from what was kept is put on screen, not left to a paint that may not be there (Codex r7)")
assert(/const retrySave = \(\) => \{ void open\(\) \}/.test(mp),
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
assert(/const syncNotice = \(sync === 'unsaved' \|\| sync === 'unreached'\) && \(\s*<p[^>]*role="status">\s*\{sync === 'unsaved'[\s\S]{0,200}not saved yet[\s\S]{0,200}onClick=\{retrySave\}/.test(mp)
  && mp.includes(UNREACHED) && /reach your record[^<]*<button onClick=\{retrySave\}/.test(mp)
  && (code(mp).match(/\{syncNotice\}/g) ?? []).length === 2,
  'the protocol says when a change has not reached the record, and when the record could not be read — and offers Retry for both, on the config screen as well as the protocol, because a change kept from an earlier day leaves the config screen showing (Codex r14)')
assert(/mindError && <p/.test(mp) && /setMindError\('not saved/.test(mp), 'an objectives save that did not land says so, instead of "Saved"')
assert(/\{\(sync === 'unsaved' \|\| sync === 'unreached'\) && \(\s*<p[^>]*role="status">\s*\{sync === 'unsaved'[\s\S]{0,200}not saved yet[\s\S]{0,200}onClick=\{retry\}/.test(obj) && obj.includes(UNREACHED)
  && /const retry = \(\) => save\(changedBy\(ownerRef\.current\)\)/.test(obj),
  'the objectives card says the same, and its Retry saves every change the row does not have yet')

if (failures) { console.log(`\ncheckin-record: ${failures} of ${failures + passes} checks FAILED`); process.exit(1) }
console.log(`checkin-record: ${passes} checks passed — the row is the record, and the paint never decides`)
