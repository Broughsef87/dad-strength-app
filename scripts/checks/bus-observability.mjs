// ── Agent bus observability (FOR-246) — a standing invariant, its own file ──
// A dead hook and an empty queue used to be indistinguishable. bus-continue.sh
// wrote to bus.log on exactly one path — a successful claim — so HALT, an empty
// queue, the chain cap and a bad filename all exited in silence, and so did a
// hook that never ran. The natural reading of silence is "it drained".
//
// On 2026-09-17 the hooks genuinely did not run for several hours: the exec form
// "command": "bash" resolved to C:\Windows\System32\bash.exe (WSL), failed with
// execvpe(/bin/bash) failed, and exited non-2, which does not block. It was
// caught because CC went looking, not because anything reported it.
//
// This file is deliberately NOT one of the hooks: a revert of the logging must
// not take the check that would catch the revert with it.
//
// ── THE ALARM CONDITION, and why it is not a wall clock ─────────────────────
// The ticket proposed "no hook entry within N minutes". I measured the bus's
// real cadence from bus.log before picking N, and the measurement says a bare
// time window is the wrong instrument:
//
//   gaps between hook invocations, 2026-09-17..18:  24, 43, 279, 107 minutes
//
// The 279-minute gap is LEGITIMATE. FOR-244 was queued at 21:12 and claimed at
// 01:42, four and a half hours later, because CC was working FOR-242 the whole
// time. Any N small enough to catch a dead hook quickly would have screamed
// through that, and any N large enough to stay quiet is too slow to be worth
// reading. A clock cannot tell "the hook is dead" from "the turn is long".
//
// What CAN tell them apart is the work itself: the DISPATCHER must have spoken
// since a dispatch was owed. Every queued doorbell has an mtime. If bus.log
// holds no hook=stop entry at or after the moment a Stop line became due, the
// dispatcher has not run since that ticket was queued — whatever the wall clock
// says. No invented interval: the reference comes from the queue.
//
// "Became due" is the FIRST hook=boot line at or after the doorbell, falling
// back to the doorbell itself when no session has started since. A Stop hook
// can only speak once a session exists to end a turn, so work queued overnight
// is owed nothing until Claude Code is opened in the morning; without that,
// every morning would start with a false alarm.
//
// The first boot, never the newest: once a dispatch is due it stays due until a
// hook=stop line acknowledges it. Keying on the newest let every session start
// reset the grace for the whole queue, so a live boot hook and a dead Stop hook
// hid the stall indefinitely — which is the very failure this file is for.
//
// The one number here is a GRACE, and only to stop the alarm flapping in the
// window between a dispatch falling due and the next Stop hook firing. It is
// 300 minutes, from the 270-minute legitimate wait measured above plus
// headroom. It errs LATE on purpose: this alarm is read on wake, not pushed to
// a phone, so a false one costs more attention than a late one. It is never
// auto-tuned from the log — a stall would raise its own ceiling, which is the
// FOR-244 mistake.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

let failures = 0, passes = 0
const assert = (cond, msg) => { if (cond) passes++; else { failures++; console.log('  ✗ ' + msg) } }
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const BUS = join(ROOT, '.claude', 'bus')
const HOOKS = join(ROOT, '.claude', 'hooks')

/** Derived above from measured gaps. Never computed from the log at run time. */
export const GRACE_MINUTES = 300

// ── 1. every exit path of the Stop hook logs ───────────────────────────────
const contPath = join(HOOKS, 'bus-continue.sh')
assert(existsSync(contPath), 'the Stop hook exists at .claude/hooks/bus-continue.sh')
const cont = existsSync(contPath) ? readFileSync(contPath, 'utf8') : ''

// Strip comments AND the heredoc message first. The header describes the very
// forms it bans, and the dispatch message is prose, not code — a check that
// reads its own documentation instead of its source proves nothing (the lesson
// from FOR-242's Pro gate, which matched a WHEN clause inside a comment).
const contCode = cont
  .split('\n').filter((l) => !/^\s*#/.test(l)).join('\n')
  .replace(/<<(\w+)\n[\s\S]*?\n\1\n/g, '<<$1\n$1\n')

// finish()'s span, computed once: both the silent-exit sweep and the logging
// assertion have to tell "inside finish()" from "somewhere after it".
const finishAt = contCode.indexOf('finish() {')
const finishEnd = finishAt < 0 ? -1 : contCode.indexOf('\n}', finishAt)

// EVERY `exit` token, wherever it sits on the line. The first version anchored
// at ^\s*(\[...\]\s*&&\s*)? and so could not see `... || exit 0`, or an exit
// after a pipeline: restoring the ticket-id guard's original `|| exit 0` left
// all fifteen checks green, because the OTHER `finish bad-filename` call site
// still satisfied the outcome assertion below. An early `[ -d ... ] || exit 0`
// passed too (Codex r2). The only exits allowed are finish()'s own and the
// final `exit 2` that blocks the stop.
const trimmedCode = contCode.trimEnd()
const blockingExitAt = trimmedCode.endsWith('exit 2') ? trimmedCode.length - 'exit 2'.length : -1
const silentExits = [...contCode.matchAll(/\bexit\b[^\n]*/g)]
  .filter((m) => !(finishAt >= 0 && m.index > finishAt && m.index < finishEnd))
  .filter((m) => m.index !== blockingExitAt)
  .map((m) => m[0].trim())
assert(silentExits.length === 0,
  `every exit from the Stop hook goes through finish(), which logs — ${silentExits.length ? `${silentExits.length} do not, first: ${JSON.stringify(silentExits[0])}` : 'all of them'}`)

// The outcomes the ticket names, plus the two this found while writing it. A
// successful claim is NOT in this list: it has to exit 2 to block the stop, so
// it cannot route through finish() — it logs on its own line and is asserted
// separately below. Listing it here would have been a check that could only
// pass by making the hook stop blocking.
const FINISH_OUTCOMES = ['halted', 'empty', 'cap-reached', 'bad-filename', 'no-queue-dir', 'claim-failed']
for (const o of FINISH_OUTCOMES) {
  // The CALL SITE, not the word. `finish halted "..."` is what routes an exit
  // through the logger; grepping for the outcome string alone would pass on a
  // script that merely mentions it somewhere.
  assert(new RegExp(`finish\\s+${o}\\b`).test(contCode), `the Stop hook exits through finish ${o}`)
}
assert(/outcome=claimed[^\n]*ticket=/.test(contCode) && /\nexit 2\s*$/.test(contCode.trimEnd() + '\n'),
  'the claim path logs outcome=claimed with its ticket, and still exits 2 so the turn is blocked')
// The BODY, isolated. The first version of this was
// /finish\(\)\s*\{[\s\S]*?bus\.log/, and `[\s\S]*?` walked straight past the
// closing brace to the successful-claim path's own bus.log write — so deleting
// the logger out of finish() left all fifteen checks green while every non-claim
// exit went silent again. The check for silence, silently broken (Codex r1).
const finishBody = finishAt < 0 || finishEnd < 0 ? null : contCode.slice(finishAt, finishEnd)
assert(finishBody != null && /bus\.log/.test(finishBody),
  'finish() itself appends to bus.log — asserted against its body, not against anything that happens to follow it')

// ── 2. the boot hook logs every session start, before any early return ─────
const bootPath = join(HOOKS, 'bus-boot.sh')
assert(existsSync(bootPath), 'the SessionStart hook exists at .claude/hooks/bus-boot.sh')
const boot = existsSync(bootPath) ? readFileSync(bootPath, 'utf8') : ''
const bootCode = boot.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n')
const bootLogAt = bootCode.indexOf('hook=boot')
const firstBootExit = bootCode.search(/^\s*(\[.*\]\s*&&\s*)?exit\b/m)
assert(bootLogAt > 0 && (firstBootExit === -1 || bootLogAt < firstBootExit),
  'the boot line is written BEFORE any exit — a boot that returns early in silence is the thing this ticket is about')

// ── 3. the hooks are invoked in SHELL form ─────────────────────────────────
// The historical defect exactly: an exec-form "bash" resolved to WSL's
// bash.exe on this host and died without blocking. The script path is the
// command; nothing interposes an interpreter by bare name.
const settingsPath = join(ROOT, '.claude', 'settings.json')
// PARSED, not pattern-matched. The registered command carries escaped quotes,
// and a regex that mis-read them would report "no hooks registered" on a
// perfectly good settings file — a false alarm inside the check whose whole job
// is to stop false silence.
const collectCommands = (node, out = []) => {
  if (Array.isArray(node)) { for (const n of node) collectCommands(n, out); return out }
  if (node && typeof node === 'object') {
    if (typeof node.command === 'string') out.push(node.command)
    for (const v of Object.values(node)) collectCommands(v, out)
  }
  return out
}
let settings = {}
try {
  settings = JSON.parse(existsSync(settingsPath) ? readFileSync(settingsPath, 'utf8') : '{}')
} catch {
  assert(false, '.claude/settings.json does not parse — hooks cannot be registered by a file the host cannot read')
}
const commands = collectCommands(settings)

// PER EVENT. Counting how many commands mention a bus script established
// nothing about which event fires them: replacing the Stop command with a
// second copy of bus-boot.sh passed, and so did moving the dispatcher off Stop
// onto another event — both of which delete the dispatcher outright while every
// check stays green (Codex r2). A hook registered under the wrong event is a
// hook that never runs, which is the silence this file is about.
const REQUIRED = [
  ['SessionStart', /bus-boot\.sh/, 'the boot heartbeat'],
  ['Stop', /bus-continue\.sh/, 'the dispatcher'],
]
for (const [event, script, what] of REQUIRED) {
  const forEvent = collectCommands(settings?.hooks?.[event] ?? [])
  assert(forEvent.some((c) => script.test(c)),
    `${what} is registered under ${event} — found ${forEvent.length} command(s) there, none matching ${script.source}`)
}
const interpreterForm = commands.filter((c) => /^(bash|sh|\/bin\/bash|\/bin\/sh)$/.test(c.trim()))
assert(interpreterForm.length === 0,
  `no hook is invoked as a bare interpreter — that form resolved to WSL on this host and died silently (${JSON.stringify(interpreterForm[0] ?? '')})`)

// ── 4. THE FRESHNESS CHECK ─────────────────────────────────────────────────
// Runtime, and only when a bus exists on disk: .claude/bus/ is git-ignored, so
// a fresh clone has none and there is nothing to be stale.
const logPath = join(BUS, 'bus.log')
const queueDir = join(BUS, 'queue')
if (!existsSync(BUS) || !existsSync(queueDir)) {
  console.log('  · no bus on this checkout — freshness not applicable')
  passes++
} else {
  const halted = existsSync(join(BUS, 'HALT'))
  // ONE metadata pass, and a doorbell may vanish under it: the Stop hook moves
  // files out of queue/ into claimed/, and it can fire while this is running.
  // Two statSync passes over a readdirSync list threw ENOENT and reddened the
  // whole gate on a perfectly healthy dispatch (Codex r3). A ticket that left
  // the queue mid-read is a ticket that was dispatched — the best possible
  // outcome, and never something to fail the build over.
  const queued = readdirSync(queueDir)
    .filter((f) => /^[0-9]{3}-FOR-[0-9]+\.json$/.test(f))
    .map((f) => { try { return { f, at: statSync(join(queueDir, f)).mtimeMs } } catch { return null } })
    .filter((d) => d != null)

  // Split by WHICH hook spoke. Only a hook=stop line is evidence the DISPATCHER
  // is alive; hook=boot proves a session started and nothing more. Lines with
  // neither marker are hand-written notes from CC and count as evidence of
  // nothing — a human writing in the log does not make a dead hook live.
  const logLines = existsSync(logPath) ? readFileSync(logPath, 'utf8').split('\n') : []
  const stampsWhere = (marker) => logLines
    .map((l) => (l.includes(marker) ? Date.parse(/^\[([0-9T:\-Z]+)\]/.exec(l)?.[1] ?? '') : NaN))
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
  const stopStamps = stampsWhere('hook=stop')
  const bootStamps = stampsWhere('hook=boot')
  const lastStop = stopStamps[stopStamps.length - 1]

  if (halted) {
    console.log('  · HALT is set — the bus is stopped on purpose, freshness not applicable')
    passes++
  } else if (queued.length === 0) {
    console.log('  · queue is empty — nothing is waiting, so nothing can be stalled')
    passes++
  } else {
    // ── when a dispatch falls DUE ───────────────────────────────────────────
    // A Stop line is owed from the FIRST session start at or after the doorbell
    // landed — the first moment a session existed to end a turn with that work
    // queued. If no session has started since, the doorbell arrived mid-session
    // and the dispatch is owed immediately.
    //
    // The first, not the newest. Keying on the newest boot meant every session
    // start reset the grace for the entire queue, so a working boot hook and a
    // dead Stop hook hid the stall forever — open Claude Code once every few
    // hours and the alarm never fires (Codex r3). Once a dispatch is due it
    // stays due until a hook=stop line acknowledges it.
    //
    // Taking the first boot AFTER the doorbell (rather than the doorbell
    // itself) is what keeps work queued overnight from alarming the instant
    // the morning's session opens.
    //
    // Timestamps are floored to the second before comparing. Both hooks log
    // whole seconds, and mtimeMs carries fractions — a doorbell at 12:00:00.100
    // against a hook line at 12:00:00.500 parses as 12:00:00.000 and reads as
    // silence. That would have failed `npm run checks` on a deliberately capped
    // queue, which is the check crying wolf about its own rounding.
    const sec = (ms) => Math.floor(ms / 1000) * 1000
    const dueAt = (at) => bootStamps.find((t) => sec(t) >= sec(at)) ?? at
    const unheard = queued
      .map((d) => ({ ...d, due: dueAt(d.at) }))
      .filter((d) => !(lastStop != null && sec(lastStop) >= sec(d.due)))
      .map((d) => ({ ...d, waitedMin: (Date.now() - d.due) / 60000 }))
      .sort((a, b) => b.waitedMin - a.waitedMin)
    const overdue = unheard.filter((d) => d.waitedMin > GRACE_MINUTES)
    assert(overdue.length === 0,
      `the Stop hook has spoken since every queued ticket fell due — ${overdue.length ? `${overdue[0].f} has waited ${overdue[0].waitedMin.toFixed(0)} min with no hook=stop entry after it, past the ${GRACE_MINUTES} min grace. The dispatcher is not running.` : ''}`)
    const oldest = unheard[0]
    console.log(`  · ${queued.length} queued, ${unheard.length} undispatched since due${oldest ? ` (oldest ${oldest.f}, ${oldest.waitedMin.toFixed(0)} min, grace ${GRACE_MINUTES})` : ' — none'}`)
  }
}

if (failures) { console.log(`\nbus-observability: ${failures} of ${failures + passes} checks FAILED`); process.exit(1) }
console.log(`bus-observability: ${passes} checks passed — every hook exit logs, and silence while work waits is an alarm`)
