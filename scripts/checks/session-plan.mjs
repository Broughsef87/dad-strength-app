// ── The plan a session is drawn from (FOR-248) — a standing invariant, its own file ──
// A trained session shows what it was trained under, whatever buildDay returns
// today. An untrained one is built fresh and keeps taking corrections.
//
// The training-day page used to rebuild every session from buildDay on every
// open, so any program change rewrote what every past session appeared to
// prescribe — and because logs attach to cards by movement NAME, the sets on a
// renamed card vanished from the screen. FOR-244 made it visible: week one's
// "Broad Jump" now builds as "Box Jumps" at the same slot.
//
// What this holds:
//   1. The rule, as behaviour, on src/lib/programs/sessionPlan.ts.
//   2. Over EVERY program and day the registry builds: a trained session's
//      stored plan is what it draws, whatever the build says — the check that a
//      buildDay change cannot silently rewrite a stored session (AC4).
//   3. The ticket's own case, on the real Power Dad build.
//   4. The page draws through the rule, records the plan the moment a session
//      is trained, and keeps logs keyed by name (the database's unique index).
//
// This file is deliberately NOT sessionPlan.ts and NOT the page: a revert of the
// feature must not take the check that would catch the revert with it.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { RECORDED, isRecorded, isStoredPlan, isTrained, reattachLogged, recordOnce, rewriteRecord, samePlan, sessionPlan } from '../../src/lib/programs/sessionPlan.ts'
import { PROGRAMS } from '../../src/lib/programs/index.ts'
import { rampOriginFor } from '../../src/lib/programs/prep.ts'

let failures = 0, passes = 0
const assert = (cond, msg) => { if (cond) passes++; else { failures++; console.log('  ✗ ' + msg) } }
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const readLF = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')
const clone = (x) => JSON.parse(JSON.stringify(x))
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const MAXES = { back_squat: 315, bench: 225, deadlift: 405, ohp: 135, clean: 205, snatch: 155, front_squat: 265, power_clean: 205 }

// ── 1. the rule ────────────────────────────────────────────────────────────
{
  const built = { dayNumber: 1, dayName: 'A', dayType: 'gym', sessionIntent: '', items: [
    { kind: 'plyo', slot: 'broad_jump', name: 'Box Jumps', sets: 3, reps: 3 },
    { kind: 'lift', slot: 'squat', name: 'Back Squat', sets: 5, reps: 5 },
    { kind: 'metcon', slot: 'finisher', name: 'Row', format: 'amrap' },
  ] }
  const stored = { ...clone(built), items: [{ ...built.items[0], name: 'Broad Jump' }, built.items[1], built.items[2]] }

  const fresh = sessionPlan(built, stored, [])
  assert(fresh.plan === built && fresh.source === 'built',
    'a session not yet trained is drawn from the build — it still picks up a correction (AC3)')
  const trained = sessionPlan(built, stored, [{ block_name: 'Broad Jump', slot: 'broad_jump' }])
  assert(trained.source === 'stored' && trained.plan.items[0].name === 'Broad Jump',
    'a trained session is drawn from what it was trained under, not from the build (AC1)')
  assert(sessionPlan(built, stored, [{ block_name: '__session_complete__', slot: null }]).source === 'stored',
    'a session finished without a single set logged is still trained — the completion sentinel counts')
  assert(isTrained([{ block_name: 'x', slot: null }]) && !isTrained([]), 'trained means any log row at all')
  // Caught HERE: drawing junk throws, and a throw must fail this check by
  // name rather than take the whole suite down with it.
  const settle = (fn) => { try { return fn() } catch (e) { return { source: `threw: ${e.message}` } } }
  const junk = settle(() => sessionPlan(built, { junk: true }, [{ block_name: 'Back Squat', slot: 'squat' }]))
  const none = settle(() => sessionPlan(built, null, [{ block_name: 'Back Squat', slot: 'squat' }]))
  assert(junk.source === 'built' && none.source === 'built',
    `a row with no usable stored plan falls back to the build — junk on the row is never drawn (got ${junk.source}, ${none.source})`)
  assert(!isStoredPlan({ items: 'no' }) && !isStoredPlan(undefined) && isStoredPlan({ items: [] }), 'a stored plan is anything with an items array, and nothing else')

  // reattach: a card whose own name has no logs at its slot takes the one
  // name the slot's logs carry — the sets were written under it.
  const logsY = [{ block_name: 'Broad Jump', slot: 'broad_jump' }, { block_name: 'Broad Jump', slot: 'broad_jump' }]
  const re = reattachLogged(built, logsY)
  assert(re.items[0].name === 'Broad Jump' && re.items[1] === built.items[1],
    'a card whose name has no logs at its slot is shown under the name its sets were logged as — they reattach (AC2)')
  assert(reattachLogged(built, [...logsY, { block_name: 'Box Jumps', slot: 'broad_jump' }]).items[0].name === 'Box Jumps',
    'a card whose own name HAS logs keeps it — only a card nothing is attached to is renamed')
  assert(reattachLogged(built, [{ block_name: 'Broad Jump', slot: 'broad_jump' }, { block_name: 'Pogo Hops', slot: 'broad_jump' }]).items[0].name === 'Box Jumps',
    'two different names at one slot, neither the card\'s — left exactly as it was, never a guess')
  assert(reattachLogged(built, [{ block_name: 'Assault Bike', slot: 'finisher' }]).items[2].name === 'Row',
    'only a lift or a jump is reattached — the kinds whose logs carry a slot')
  assert(reattachLogged(built, [{ block_name: 'Back Squat', slot: 'squat' }]) === built, 'nothing to reattach hands the SAME plan back')
  assert(sessionPlan(built, null, logsY).plan.items[0].name === 'Broad Jump',
    'a trained session with no stored plan is still reattached to its logs')

  // A RECORDED plan is the record: drawn exactly, logs never overrule it. Log
  // Back Squat, swap the card to Front Squat, reload before a Front Squat set —
  // the swap stands (Codex r1).
  const swapped = { ...clone(built), items: built.items.map((i) => (i.slot === 'squat' ? { ...i, name: 'Front Squat', subbedFrom: 'Back Squat' } : i)) }
  const preSwap = [{ block_name: 'Back Squat', slot: 'squat' }]
  assert(sessionPlan(built, swapped, preSwap, true).plan.items[1].name === 'Front Squat',
    'a recorded plan is drawn exactly as recorded — a swap persisted after sets were logged is not undone by them')
  assert(sessionPlan(built, swapped, preSwap, false).plan.items[1].name === 'Back Squat',
    'an UNRECORDED plan (a row from before the record) is the one reconciled against its logs')
  assert(isRecorded({ [RECORDED]: true }) && !isRecorded({ [RECORDED]: 'yes' }) && !isRecorded({}) && !isRecorded(null),
    'recorded means the marker the page writes, exactly — nothing else on a row passes for it')
  assert(samePlan({ a: 1, b: { c: [1, 2], d: 'x' } }, { b: { d: 'x', c: [1, 2] }, a: 1 }) && !samePlan({ a: 1 }, { a: 2 }) && !samePlan({ items: [1, 2] }, { items: [2, 1] }),
    'plans compare the same whatever order jsonb hands their keys back in, and differ when they differ')
}

// ── 1b. the record is written once, and every log waits for it (Codex r2) ──
// Driven as behaviour, with writes that take time — the race is the thing.
{
  const tick = () => new Promise((r) => setTimeout(r, 5))
  // THE P1: a log per keystroke, all asked for while the first record is still
  // in flight. The last value typed must be the last one saved.
  const st = { recorded: false, pending: null }
  let writes = 0, landed = false
  const write = async () => { writes++; await tick(); landed = true; return { error: null } }
  const saved = []
  const log = async (v) => { await recordOnce(st, write); saved.push({ v, afterRecord: landed }) }
  await Promise.all([log('2'), log('22'), log('225')])
  assert(saved.map((x) => x.v).join(',') === '2,22,225',
    `logs asked for while the record is in flight are saved in the order they were typed — got ${saved.map((x) => x.v).join(',')} (typing 225 must never persist 2)`)
  assert(saved.every((x) => x.afterRecord) && writes === 1 && st.recorded,
    'every one of them waits for that record, the record is written once, and the session counts as recorded only when it lands')

  const st2 = { recorded: false, pending: null }
  let n2 = 0
  await recordOnce(st2, async () => { n2++; return { error: { message: 'down' } } })
  assert(!st2.recorded && st2.pending === null, 'a failed record leaves the session unrecorded, with nothing left pending')
  await recordOnce(st2, async () => { n2++; return { error: null } })
  assert(st2.recorded && n2 === 2, 'and the next log writes it again')

  const st3 = { recorded: false, pending: null }
  const r3 = await recordOnce(st3, async () => { throw new Error('boom') }).then((r) => r, (e) => ({ threw: e }))
  assert(!r3?.threw && r3?.error?.message === 'boom' && !st3.recorded, 'a record that THROWS comes back as an error — a log is never lost to its record')

  // A swap whose record fails must not leave the session marked recorded:
  // sets would then save under a name the stored record does not have.
  const st4 = { recorded: true, pending: null }
  await rewriteRecord(st4, async () => ({ error: { message: 'down' } }))
  assert(!st4.recorded, 'a swap whose record fails leaves the session UNRECORDED (Codex r2)')
  let n4 = 0
  await recordOnce(st4, async () => { n4++; return { error: null } })
  assert(n4 === 1 && st4.recorded, 'so the next log writes the swapped plan before it saves')

  const st5 = { recorded: false, pending: null }
  const order = []
  // The record in flight is the SLOWER write: equal delays would finish in order
  // by timer luck, and a swap that raced it would pass anyway.
  const first = recordOnce(st5, async () => { await tick(); await tick(); await tick(); order.push('record'); return { error: null } })
  const again = rewriteRecord(st5, async () => { await tick(); order.push('rewrite'); return { error: null } })
  const logged = (async () => { await recordOnce(st5, async () => { order.push('a second record'); return { error: null } }); order.push('log') })()
  await Promise.all([first, again, logged])
  assert(order.join(',') === 'record,rewrite,log' && st5.recorded,
    `a swap's record waits for the one in flight, and a log asked for meanwhile waits for both — got ${order.join(',')}`)
}

// ── 2. every program, every day: a stored session cannot be rewritten by a build ──
// The stored plan here is the real build with EVERY field changed — every
// string marked, every number moved, every flag flipped — so a single field
// leaking from the build into a drawn session shows. Only `kind` and `slot`
// are kept: they are what a card IS, and what its logs are matched on.
// Whatever the build returns, a trained session draws its stored plan, exactly.
const asTrained = (v, key) => {
  if (key === 'kind' || key === 'slot') return v
  if (Array.isArray(v)) return v.map((x) => asTrained(x))
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, asTrained(x, k)]))
  if (typeof v === 'string') return `${v} ·trained`
  if (typeof v === 'number') return v + 1000
  if (typeof v === 'boolean') return !v
  return v
}
{
  let sessions = 0, rewritten = 0, untrainedTook = 0, first = null
  for (const program of Object.values(PROGRAMS)) {
    for (const week of [1, 4, 7, 13]) {
      if (week > program.macroWeeks) continue
      for (let day = 1; day <= 7; day++) {
        const built = program.buildDay(week, day, MAXES, {}, { jumpRampFromWeek: rampOriginFor(week, []) })
        if (!built.items.length) continue
        const stored = asTrained(built)
        const logs = stored.items.filter((i) => i.kind === 'lift' || i.kind === 'plyo').map((i) => ({ block_name: i.name, slot: i.slot }))
        const trainedLogs = logs.length ? logs : [{ block_name: '__session_complete__', slot: null }]
        sessions++
        // Recorded or not: a row from before the record is reconciled against
        // its logs, and must still come out as exactly what was stored.
        for (const recorded of [true, false]) {
          if (!same(sessionPlan(built, stored, trainedLogs, recorded).plan, stored)) { rewritten++; first ??= `${program.slug} W${week} D${day}${recorded ? '' : ' (unrecorded)'}` }
        }
        if (sessionPlan(built, stored, []).plan === built) untrainedTook++
      }
    }
  }
  assert(sessions > 40 && rewritten === 0,
    `over ${sessions} real program-days, a trained session draws its stored plan exactly — no build rewrites it${first ? ` (first rewritten: ${first})` : ''}`)
  assert(untrainedTook === sessions, `and over the same ${sessions}, a session not yet trained takes the build — every one`)
  console.log(`  · ${sessions} real program-days swept (${Object.keys(PROGRAMS).length} programs × weeks 1, 4, 7, 13 × every day with work)`)
}

// ── 3. the ticket's case, on the real build ────────────────────────────────
// Power Dad, week one, day one, the broad_jump slot. The name it was TRAINED
// under is whatever the build does not say today — so this case stays a real
// program change however the program is edited later, rather than pinning the
// program's content (which is Andrew's, and must not redden this suite).
{
  const power = PROGRAMS['hybrid-power']
  const built = power.buildDay(1, 1, MAXES, {}, { jumpRampFromWeek: rampOriginFor(1, []) })
  const jump = built.items.find((i) => i.slot === 'broad_jump')
  assert(!!jump, 'Power Dad week 1 day 1 still has a broad_jump slot to test on')
  const now = jump?.name ?? ''
  const then = now === 'Broad Jump' ? 'Box Jumps' : 'Broad Jump'
  const at = (name) => ({ ...clone(built), items: built.items.map((i) => (i.slot === 'broad_jump' ? { ...i, name } : i)) })
  const logs = [1, 2, 3].map(() => ({ block_name: then, slot: 'broad_jump' }))
  const card = sessionPlan(built, at(then), logs).plan.items.find((i) => i.slot === 'broad_jump')
  assert(card?.name === then, `the week-one session trained as ${then} reopens as ${then}, not as today's "${card?.name}"`)
  assert(logs.filter((l) => l.block_name === card?.name).length === 3, 'and all three of its logged sets attach to that card by name')
  // A row stored at FIRST OPEN and trained after the change — what the
  // first-log record prevents from now on, and reattach covers for rows before it.
  const loggedAsNew = [1, 2].map(() => ({ block_name: now, slot: 'broad_jump' }))
  assert(sessionPlan(built, at(then), loggedAsNew).plan.items.find((i) => i.slot === 'broad_jump')?.name === now,
    'a row stored at first open but trained after a change reattaches to what was logged — the sets are not stranded under the old name')
}

// ── 4. the page draws through the rule and records it ──────────────────────
{
  const pg = readLF('src/app/train/[program]/[day]/page.tsx')
  const adopt = (() => { const at = pg.indexOf('const adopt = async (id: string, wd: Record<string, unknown>) => {'); return at < 0 ? '' : pg.slice(at, pg.indexOf('\n      }\n', at)) })()
  assert(/const read = await fetchSessionLogs\(supabase, id\)[\s\S]*logs = read\.logs[\s\S]*drawn = sessionPlan\(built, wd\.plan, logs, isRecorded\(wd\)\)\.plan/.test(adopt),
    'a found row is drawn through sessionPlan, with its logs read FIRST and whether its plan is a record — the rule needs both')
  // Not knowing is not "untrained" (Codex r1).
  const readFails = adopt.indexOf('if (read.error) throw'), firstDraw = adopt.indexOf('drawn = sessionPlan'), firstWrite = adopt.indexOf('.update(')
  assert(readFails > 0 && readFails < firstDraw && (firstWrite < 0 || readFails < firstWrite),
    'a log read that FAILS stops the session before anything is drawn or written — a failed read is not an untrained session')
  const fetchFn = (() => { const at = pg.indexOf('async function fetchSessionLogs('); return at < 0 ? '' : pg.slice(at, pg.indexOf('\n}\n', at)) })()
  assert(/const \{ data, error \} = await supabase/.test(fetchFn) && /error: error \?\? null/.test(fetchFn),
    'the log read returns its error instead of swallowing it into an empty list')
  assert(/if \(!trained && !samePlan\(wd\.plan, built\)\) \{\s*workoutDataRef\.current = \{ \.\.\.wd, plan: built, \[RECORDED\]: false \}/.test(adopt),
    "an untrained session's stored plan follows what it shows — unmarked, and only when it actually changed (Codex r1)")
  assert(/basePlanRef\.current = drawn/.test(adopt) && /setPlan\(applyOverrides\(drawn, ovr\)\)/.test(adopt),
    'what it draws is the base the session overrides and swaps build on — not the build')
  assert(/recordRef\.current = \{ recorded: trained && isRecorded\(wd\), pending: null \}/.test(adopt),
    'a row is known to be recorded only when it is trained AND carries the record — a row from before the record records at its next log')
  assert(/trainedRef\.current = trained/.test(adopt), 'and whether it has been trained is known from its logs')
  assert((pg.match(/await adopt\(/g) ?? []).length === 2 && /select\('id, workout_data'\)\s*\.eq\('user_id', user\.id\)\.eq\('program_slug', slug\)\s*\.eq\('week_number', weekNumber\)\.eq\('day_number', dayNumber\)\s*\.order\('id'/.test(pg),
    'BOTH ways a row is found — the run-scoped lookup and the unique-index fallback — draw through the same path')
  assert(/setSessionLogs\(logs\)/.test(pg) && !/if \(workoutId\) setSessionLogs\(await fetchSessionLogs/.test(pg),
    'the logs the rule decided on are the logs the cards show — read once')
  assert(/const liftNames = \[\.\.\.new Set\(drawn\.items/.test(pg), 'records are detected against the movements on screen, not the build')

  const recordFn = (() => { const at = pg.indexOf('const recordPlan = async () => {'); return at < 0 ? '' : pg.slice(at, pg.indexOf('\n  }\n', at)) })()
  const writeFn = (() => { const at = pg.indexOf('const writePlan = async ()'); return at < 0 ? '' : pg.slice(at, pg.indexOf('\n  }\n', at)) })()
  assert(/plan: basePlanRef\.current, \[RECORDED\]: true/.test(writeFn), 'the plan recorded is the one the cards are drawn from, marked as the record')
  assert(/const res = await recordOnce\(recordRef\.current, writePlan\)/.test(recordFn),
    'the page records through recordOnce — one shared record, every log waiting on it (the behaviour is asserted in 1b)')
  const writers = ['const logLiftSets', 'const logPlyoSets', 'const logSimple'].map((name) => {
    const at = pg.indexOf(name); return at < 0 ? '' : pg.slice(at, pg.indexOf('\n  }\n', at))
  })
  // BEFORE, not after: a log that landed while its record failed would read as
  // recorded on the next open, freezing whatever the row held (Codex r1).
  const recordsFirst = (w, write) => { const r = w.indexOf('await recordPlan()'), u = w.indexOf(write); return r > 0 && u > 0 && r < u }
  assert(writers.every((w) => recordsFirst(w, "from('ares_session_logs').upsert(")),
    'every log writer — sets, jumps, metcons and outside work — records the plan BEFORE its log is written')
  const complete = (() => { const at = pg.indexOf('const completeSession = async'); return at < 0 ? '' : pg.slice(at, pg.indexOf('await advanceWeekIfDone', at)) })()
  assert(recordsFirst(complete, "log_type: 'session_complete'"),
    'finishing a session records it too — before the sentinel is written, and so before the week can advance past it')
  const swap = (() => { const at = pg.indexOf('if (basePlanRef.current) basePlanRef.current = patchItems(basePlanRef.current)'); return at < 0 ? '' : pg.slice(at, pg.indexOf('\n  }\n', at)) })()
  assert(/if \(trainedRef\.current\) report\('session record', await rewriteRecord\(recordRef\.current, writePlan\)\)/.test(swap),
    'a swap on a TRAINED session rewrites its record — recorded before or not — through rewriteRecord (Codex r2)')
  assert(writers.every((w) => /if \(!res\?\.error\) trainedRef\.current = true/.test(w)) && /if \(!done\?\.error\) trainedRef\.current = true/.test(pg),
    'every log that lands marks the session trained, so a swap after it is recorded')

  // Logs stay keyed by NAME: the database's unique index is, and a card keyed
  // by slot would write a second row the first time a set was edited.
  assert(/const UPSERT_CONFLICT = 'user_id,generated_workout_id,block_name,set_number'/.test(pg) && /const logsFor = \(name: string\) => sessionLogs\.filter\(l => l\.block_name === name\)/.test(pg),
    'logs attach to a card by name, matching the unique index they are written under')
  // Autoregulation reads what the card SHOWED from `adjustments`, not from the
  // plan; nothing here may start writing it.
  assert(!/adjustments/.test(readLF('src/lib/programs/sessionPlan.ts').split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n'))
    && !/adjustments/.test(writeFn),
    'recording the plan never touches the adjustments autoregulation reads')
}

if (failures) { console.log(`\nsession-plan: ${failures} of ${failures + passes} checks FAILED`); process.exit(1) }
console.log(`session-plan: ${passes} checks passed — a trained session shows what it was trained under, an untrained one takes the build`)
