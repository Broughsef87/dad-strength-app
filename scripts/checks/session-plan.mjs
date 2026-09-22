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
//   1b. The row's one writer, and reattach keeping a swap's identity (Codex r3).
//   4. The page draws through the rule; records the plan while an untrained
//      session loads and on every swap — never around a log, which is how two
//      rounds of this raced the per-keystroke set saves (Codex r2, r3); and
//      keeps logs keyed by name (the database's unique index).
//
// This file is deliberately NOT sessionPlan.ts and NOT the page: a revert of the
// feature must not take the check that would catch the revert with it.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { RECORDED, isRecorded, isStoredPlan, isTrained, reattachLogged, samePlan, serialWriter, sessionPlan } from '../../src/lib/programs/sessionPlan.ts'
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
  // The build here is what the page builds AFTER the swap: today's program with
  // the saved substitution applied — so it carries Front Squat, not Back Squat.
  const swapped = { ...clone(built), items: built.items.map((i) => (i.slot === 'squat' ? { ...i, name: 'Front Squat', subbedFrom: 'Back Squat' } : i)) }
  const buildSwapped = clone(swapped)
  const preSwap = [{ block_name: 'Back Squat', slot: 'squat' }]
  assert(sessionPlan(buildSwapped, swapped, preSwap, true).plan.items[1].name === 'Front Squat',
    'a recorded plan is drawn as recorded — a swap persisted after sets were logged is not undone by them')
  assert(sessionPlan(built, swapped, preSwap, false).plan.items[1].name === 'Back Squat',
    'an UNRECORDED plan (a row from before the record) is the one reconciled against its logs')
  // Nothing outside the session second-guesses its record (Codex r5). Log Back
  // Squat, swap this session to Front Squat (recorded), then change the
  // recurring substitution in another week so today's build says Back Squat
  // again: the recorded swap stands.
  assert(sessionPlan(built, swapped, preSwap, true).plan.items[1].name === 'Front Squat',
    'a recorded swap stands even when a LATER substitution change makes today\'s build agree with the older logs')
  // And neither do logs and build together: that state (a record behind the
  // card) is made unreachable at the swap — the record is written first — so
  // the reopen never has to infer staleness (Codex r4).
  assert(sessionPlan(buildSwapped, clone(built), [{ block_name: 'Front Squat', slot: 'squat' }], true).plan.items[1].name === 'Back Squat',
    'a recorded plan is drawn exactly as recorded — logs and the build together still never move it')
  assert(isRecorded({ [RECORDED]: true }) && !isRecorded({ [RECORDED]: 'yes' }) && !isRecorded({}) && !isRecorded(null),
    'recorded means the marker the page writes, exactly — nothing else on a row passes for it')
  assert(samePlan({ a: 1, b: { c: [1, 2], d: 'x' } }, { b: { d: 'x', c: [1, 2] }, a: 1 }) && !samePlan({ a: 1 }, { a: 2 }) && !samePlan({ items: [1, 2] }, { items: [2, 1] }),
    'plans compare the same whatever order jsonb hands their keys back in, and differ when they differ')
}

// ── 1b. one writer for the row (Codex r3) ──────────────────────────────────
// Every write of a session's workout_data sends the whole object; two in flight
// at once can land out of order and put back what the newer one removed. The
// queue is asserted as behaviour, with writes that take time — and the EARLIER
// write is the slower one, because equal delays would finish in order by timer
// luck and a queue that did nothing would pass.
{
  const tick = (n = 1) => new Promise((r) => setTimeout(r, 5 * n))
  const queue = serialWriter()
  const row = { value: null }
  const landed = []
  const send = (payload, delay) => queue(async () => { await tick(delay); row.value = payload; landed.push(payload.tag); return { error: null } })
  // A swap's record, slow; an exercise added straight after it, fast.
  await Promise.all([send({ tag: 'swap', plan: 'Front Squat', overrides: {} }, 3), send({ tag: 'added', plan: 'Front Squat', overrides: { added: ['Curls'] } }, 1)])
  assert(landed.join(',') === 'swap,added' && row.value.tag === 'added' && row.value.overrides.added?.[0] === 'Curls',
    `writes land strictly in the order they were asked for — the exercise added after a swap is not put back by the swap's slower write (got ${landed.join(',')})`)
  const q2 = serialWriter()
  const out = []
  const a = q2(async () => { throw new Error('down') }).then(() => 'ok', () => 'failed')
  // Settled here: a queue that stops on a failure rejects every write after it,
  // and that must fail this check by name, not take the suite down.
  const b = q2(async () => { out.push('second ran'); return 'second' }).then((v) => v, () => 'never ran')
  assert((await a) === 'failed' && (await b) === 'second' && out.length === 1, 'a failed write does not stop the queue, and each caller gets its own result')

  // Reattach keeps a swap's identity: a row from before the record, opened as
  // Back Squat, swapped to Front Squat and trained as Front Squat (Codex r3).
  const legacy = { dayNumber: 1, dayName: 'A', dayType: 'gym', sessionIntent: '', items: [{ kind: 'lift', slot: 'squat', name: 'Back Squat', sets: 5, reps: 5 }] }
  const buildNow = { ...legacy, items: [{ kind: 'lift', slot: 'squat', name: 'Front Squat', subbedFrom: 'Back Squat', sets: 5, reps: 5 }] }
  const drawnLegacy = sessionPlan(buildNow, legacy, [{ block_name: 'Front Squat', slot: 'squat' }], false).plan.items[0]
  assert(drawnLegacy.name === 'Front Squat' && drawnLegacy.subbedFrom === 'Back Squat',
    `a reattached card takes the swap's identity from the build — Front Squat stays a swap of Back Squat, so it can be reverted (got ${drawnLegacy.name} / ${drawnLegacy.subbedFrom})`)
  const buildNoSub = { ...legacy, items: [{ kind: 'lift', slot: 'squat', name: 'Goblet Squat', sets: 5, reps: 5 }] }
  assert(!('subbedFrom' in sessionPlan(buildNoSub, legacy, [{ block_name: 'Front Squat', slot: 'squat' }], false).plan.items[0]),
    'and a logged name the build does not carry is reattached as a name only — no identity is invented for it')
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
  assert(/basePlanRef\.current = drawn/.test(adopt) && /setPlan\(applyOverrides\(drawn, ovr\)\)/.test(adopt),
    'what it draws is the base the session overrides and swaps build on — not the build')

  // THE RECORD is written while the session loads, before any card exists to
  // log against — never around a log (Codex r2, r3).
  assert(/if \(!trained && \(!samePlan\(wd\.plan, built\) \|\| !isRecorded\(wd\)\)\) \{\s*workoutDataRef\.current = \{ \.\.\.wd, plan: built, \[RECORDED\]: true \}/.test(adopt),
    "an untrained session's stored plan is written to what its cards will show and marked as the record — whenever it differs or is unmarked")
  assert(/const synced = await queueRow\(/.test(adopt) && /if \(synced\.error\) throw new Error/.test(adopt),
    "that write goes through the row's one queue, and if it fails the session does not open — no training against a record that disagrees with the screen")
  assert(/const fresh = \{ plan: built, adjustments, \[RECORDED\]: true \}/.test(pg) && /workout_data: fresh,/.test(pg) && /workoutDataRef\.current = fresh/.test(pg),
    'a row created for a new session is born recorded, with the plan it shows')
  assert(pg.indexOf('if (loading) {') > 0 && /setLoading\(false\)/.test(pg),
    'cards render only once loading is done — the reason the record written in loadDay cannot race a log')
  // A re-run of the load on a LIVE page (Codex r4): the auth context replaces
  // the user object on every token refresh, so the load keys on the ID — and
  // nothing is shown or set until the session is decided, so even a re-run
  // never puts today's build on screen in place of what a session trained.
  const loadFn = (() => { const at = pg.indexOf('const loadDay = useCallback(async () => {'); return at < 0 ? '' : pg.slice(at, pg.indexOf('\n  }, [', at) + 80) })()
  assert(/\}, \[userId, program, slug, dayNumber, supabase, queueRow\]\)/.test(loadFn) && !/\buser\.id\b/.test(loadFn) && /if \(!userId \|\| !program\) return/.test(loadFn),
    'the load re-runs when the user CHANGES, not when the auth context hands back a new object for the same user (Codex r4)')
  const decidedAt = loadFn.indexOf('const { data: rows } = await supabase')
  // Every occurrence ahead of the row lookup, except inside adopt's own body —
  // adopt is DEFINED early and only RUNS once a row is found.
  const aStart = loadFn.indexOf('const adopt = async'), aEnd = aStart < 0 ? -1 : loadFn.indexOf('\n      }\n', aStart)
  const occurrences = (t) => { const out = []; for (let i = loadFn.indexOf(t); i >= 0; i = loadFn.indexOf(t, i + 1)) out.push(i); return out }
  const earlyShow = ['setPlan(', 'basePlanRef.current =', 'setOverrides(', 'workoutDataRef.current ='].flatMap((t) => occurrences(t).map((at) => ({ t, at })))
    .filter((x) => x.at < decidedAt && !(aStart >= 0 && x.at > aStart && x.at < aEnd))
  assert(decidedAt > 0 && earlyShow.length === 0,
    `nothing is shown and no row state is set before the session is decided — found ${earlyShow.map((x) => x.t).join(', ') || 'none'} ahead of the row lookup`)
  assert(/if \(!placed\) \{\s*workoutDataRef\.current = fresh\s*basePlanRef\.current = built\s*setOverrides\(\{\}\)\s*setPlan\(built\)/.test(loadFn),
    'a session no existing row decided — a new row, or none — is drawn from the build, once, at the end')
  assert(/setPlan\(applyOverrides\(drawn, ovr\)\)\s*placed = true/.test(adopt),
    'and an adopted row is marked decided, so that fallback never draws the build over what it adopted')
  const writers = ['const logLiftSets', 'const logPlyoSets', 'const logSimple', 'const completeSession'].map((name) => {
    const at = pg.indexOf(name); return at < 0 ? '' : pg.slice(at, pg.indexOf('await advanceWeekIfDone', at) > 0 && name === 'const completeSession' ? pg.indexOf('await advanceWeekIfDone', at) : pg.indexOf('\n  }\n', at))
  })
  assert(writers.every((w) => w.length > 0 && !/recordPlan|writePlan|sendRow|queueRow|RECORDED/.test(w)),
    'NO log writer touches the record — sets, jumps, metcons, outside work and the completion sentinel all save exactly as they did (the keystroke races of r2 and r3)')

  // One writer for the row (Codex r3).
  const sendFn = (() => { const at = pg.indexOf('const sendRow = (): Promise<SbRes | null> => {'); return at < 0 ? '' : pg.slice(at, pg.indexOf('\n  }\n', at)) })()
  assert(/const id = workoutIdRef\.current/.test(sendFn) && /const payload = workoutDataRef\.current/.test(sendFn) && /return queueRow\(async \(\) => supabase\.from\('generated_workouts'\)\.update\(\{ workout_data: payload \}\)\.eq\('id', id\)\)/.test(sendFn),
    'a row write captures its session and the row as it stands when the change is made, then queues — it can never land on another session\'s row')
  const writeFn = (() => { const at = pg.indexOf('const writePlan = async (next: DayPlan): Promise<SbRes | null> => {'); return at < 0 ? '' : pg.slice(at, pg.indexOf('\n  }\n', at)) })()
  assert(/workoutDataRef\.current = \{ \.\.\.before, plan: next, \[RECORDED\]: true \}/.test(writeFn) && /const res = await sendRow\(\)/.test(writeFn),
    'the plan recorded is the one about to be shown, marked as the record, through the one queue')
  assert(/if \(res\?\.error && workoutDataRef\.current\.plan === next\) workoutDataRef\.current = \{ \.\.\.workoutDataRef\.current, plan: before\.plan, \[RECORDED\]: before\[RECORDED\] \}/.test(writeFn),
    'a record that did not land is taken back off the row copy — so no later row write can carry a swap the screen never made')
  const overridesFn = (() => { const at = pg.indexOf('const updateOverrides = async'); return at < 0 ? '' : pg.slice(at, pg.indexOf('\n  }\n', at)) })()
  assert(/report\('session edit', await sendRow\(\)\)/.test(overridesFn) && !/\.update\(/.test(overridesFn),
    'session edits go through the same queue — an exercise added while a swap is being recorded is not put back by it')
  const rowWrites = (pg.match(/\.update\(\{ workout_data:/g) ?? []).length
  assert(rowWrites === 3,
    `the row's workout_data is written in exactly three places — the load-time adjustments backfill, the load-time record, and sendRow — found ${rowWrites}`)
  const swap = (() => { const at = pg.indexOf('if (basePlanRef.current) basePlanRef.current = patchItems(basePlanRef.current)'); return at < 0 ? '' : pg.slice(at, pg.indexOf('\n  }\n', at)) })()
  // The swap, in order (Codex r4, r5): the record, then the substitution, then
  // the screen — and a record that fails stops it before either.
  const swapFn = (() => { const at = pg.indexOf('const swapNow = async'); return at < 0 ? '' : pg.slice(at, pg.indexOf('\n  }\n', at)) })()
  const rec = swapFn.indexOf('const recorded = await writePlan(patchItems(basePlanRef.current))')
  const stop = swapFn.indexOf('if (recorded?.error) return')
  const sub = swapFn.indexOf("from('user_exercise_subs')")
  const screen = swapFn.indexOf('setPlan(p => p && patchItems(p))')
  const closed = swapFn.indexOf('setSwapTarget(null)')
  assert(rec > 0 && stop > rec && sub > stop && screen > sub && closed > screen,
    'every swap writes the record FIRST, stops if it fails, and only then saves the substitution and changes the card — the record is never behind what the athlete saw')
  assert(!/report\('session record', await writePlan\(\)\)/.test(swapFn) && (swapFn.match(/writePlan\(/g) ?? []).length === 1,
    'and it records exactly once, before — not again after the card has already changed')
  // A swap is EXCLUSIVE (Codex r6): two at once built both records on the same
  // plan, so the second erased the first; an edit queued during one captured a
  // swap that then failed.
  const guardFn = (() => { const at = pg.indexOf('const applySwap = async'); return at < 0 ? '' : pg.slice(at, pg.indexOf('\n  }\n', at)) })()
  assert(/if \(!user \|\| !swapTarget \|\| swapInFlight\.current\) return/.test(guardFn) && /swapInFlight\.current = run\s*setSwapping\(true\)/.test(guardFn) && /finally \{ swapInFlight\.current = null; setSwapping\(false\) \}/.test(guardFn),
    'a second swap cannot start while one is saving, and the lock is released however the first ends')
  assert(/if \(swapInFlight\.current\) await swapInFlight\.current\s*setOverrides\(next\)/.test(overridesFn),
    'a session edit made while a swap saves waits for it before reading the row — it never carries a swap that then fails')
  assert(/onClose=\{\(\) => \{ if \(!swapping\) setSwapTarget\(null\) \}\}\s*busy=\{swapping\}/.test(pg)
    && /onClick=\{busy \? undefined : onClose\}/.test(pg) && /<fieldset disabled=\{busy\} className="contents">/.test(pg),
    'and the sheet cannot be dismissed or picked from while its swap saves — the way a second swap got started')

  assert((pg.match(/await adopt\(/g) ?? []).length === 2 && /select\('id, workout_data'\)\s*\.eq\('user_id', userId\)\.eq\('program_slug', slug\)\s*\.eq\('week_number', weekNumber\)\.eq\('day_number', dayNumber\)\s*\.order\('id'/.test(pg),
    'BOTH ways a row is found — the run-scoped lookup and the unique-index fallback — draw through the same path')
  assert(/setSessionLogs\(logs\)/.test(pg) && !/if \(workoutId\) setSessionLogs\(await fetchSessionLogs/.test(pg),
    'the logs the rule decided on are the logs the cards show — read once')
  assert(/const liftNames = \[\.\.\.new Set\(drawn\.items/.test(pg), 'records are detected against the movements on screen, not the build')

  // Logs stay keyed by NAME: the database's unique index is, and a card keyed
  // by slot would write a second row the first time a set was edited.
  assert(/const UPSERT_CONFLICT = 'user_id,generated_workout_id,block_name,set_number'/.test(pg) && /const logsFor = \(name: string\) => sessionLogs\.filter\(l => l\.block_name === name\)/.test(pg),
    'logs attach to a card by name, matching the unique index they are written under')
  // Autoregulation reads what the card SHOWED from `adjustments`, not from the
  // plan; nothing here may start writing it.
  assert(!/adjustments/.test(readLF('src/lib/programs/sessionPlan.ts').split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n'))
    && !/adjustments/.test(writeFn) && !/adjustments/.test(sendFn),
    'recording the plan never touches the adjustments autoregulation reads')
}

if (failures) { console.log(`\nsession-plan: ${failures} of ${failures + passes} checks FAILED`); process.exit(1) }
console.log(`session-plan: ${passes} checks passed — a trained session shows what it was trained under, an untrained one takes the build`)
