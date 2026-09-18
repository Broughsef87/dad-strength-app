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
// What CAN tell them apart is the work itself: the hook must have SPOKEN SINCE
// THE WORK ARRIVED. Every queued doorbell has an mtime. If bus.log holds no
// entry at or after the newest doorbell's mtime, the hook has not run since
// that ticket was queued — whatever the wall clock says. No invented interval:
// the reference comes from the queue.
//
// The one number here is a GRACE, and only to stop the alarm flapping in the
// window between a doorbell landing and the next Stop hook firing. It is 300
// minutes, from the 270-minute legitimate wait measured above plus headroom. It
// errs LATE on purpose: this alarm is read on wake, not pushed to a phone, so a
// false one costs more attention than a late one. It is never auto-tuned from
// the log — a stall would raise its own ceiling, which is the FOR-244 mistake.
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

// Strip comments first — the header describes the very forms it bans, and a
// check that reads its own prose instead of its code proves nothing (the
// lesson from FOR-242's Pro gate, which matched a WHEN clause inside a comment).
const contCode = cont.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n')

// `finish` is the only way out but for the final `exit 2` that blocks the stop.
const bareExits = (contCode.match(/^\s*(\[.*\]\s*&&\s*)?exit\b[^\n]*/gm) ?? [])
  .filter((l) => !/exit "\$\{2:-0\}"|exit "\$\{3:-0\}"/.test(l))
  .filter((l) => !/^\s*exit 2\s*$/.test(l))
assert(bareExits.length === 0,
  `every exit from the Stop hook goes through finish(), which logs — ${bareExits.length ? `${bareExits.length} do not, first: ${JSON.stringify(bareExits[0].trim())}` : 'all of them'}`)

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
const finishBody = (() => {
  const at = contCode.indexOf('finish() {')
  if (at < 0) return null
  const end = contCode.indexOf('\n}', at)
  return end < 0 ? null : contCode.slice(at, end)
})()
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
let commands = []
try {
  commands = collectCommands(JSON.parse(existsSync(settingsPath) ? readFileSync(settingsPath, 'utf8') : '{}'))
} catch {
  assert(false, '.claude/settings.json does not parse — hooks cannot be registered by a file the host cannot read')
}
const busCommands = commands.filter((c) => /bus-(boot|continue)\.sh/.test(c))
assert(busCommands.length >= 2, `both bus hooks are registered in settings.json — found ${busCommands.length}`)
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
  const doorbells = readdirSync(queueDir).filter((f) => /^[0-9]{3}-FOR-[0-9]+\.json$/.test(f))
  const newest = doorbells
    .map((f) => ({ f, at: statSync(join(queueDir, f)).mtimeMs }))
    .sort((a, b) => b.at - a.at)[0]
  const lastLog = existsSync(logPath)
    ? [...readFileSync(logPath, 'utf8').matchAll(/^\[([0-9T:\-Z]+)\]/gm)].map((m) => Date.parse(m[1])).filter(Number.isFinite).sort((a, b) => b - a)[0]
    : undefined

  if (halted) {
    console.log('  · HALT is set — the bus is stopped on purpose, freshness not applicable')
    passes++
  } else if (!newest) {
    console.log('  · queue is empty — nothing is waiting, so nothing can be stalled')
    passes++
  } else {
    // ANY overdue ticket, not just the newest. Keying on the newest meant a
    // fresh doorbell reset the grace for the whole queue: with the hooks dead,
    // a ticket waiting ten hours passed because something arrived a minute ago,
    // and a steady trickle could suppress the alarm forever (Codex r1).
    //
    // Timestamps are floored to the second before comparing. Both hooks log
    // whole seconds, and mtimeMs carries fractions — a doorbell at 12:00:00.100
    // against a hook line at 12:00:00.500 parses as 12:00:00.000 and reads as
    // silence. That would have failed `npm run checks` on a deliberately capped
    // queue, which is the check crying wolf about its own rounding.
    const sec = (ms) => Math.floor(ms / 1000) * 1000
    const heardSince = (at) => lastLog != null && sec(lastLog) >= sec(at)
    const unheard = doorbells
      .map((f) => ({ f, at: statSync(join(queueDir, f)).mtimeMs }))
      .filter((d) => !heardSince(d.at))
      .map((d) => ({ ...d, waitedMin: (Date.now() - d.at) / 60000 }))
      .sort((a, b) => b.waitedMin - a.waitedMin)
    const overdue = unheard.filter((d) => d.waitedMin > GRACE_MINUTES)
    assert(overdue.length === 0,
      `the bus has spoken since every queued ticket arrived — ${overdue.length ? `${overdue[0].f} has waited ${overdue[0].waitedMin.toFixed(0)} min with no hook entry after it, past the ${GRACE_MINUTES} min grace. The hooks are not running.` : ''}`)
    const oldest = unheard[0]
    console.log(`  · ${doorbells.length} queued, ${unheard.length} with no hook entry since${oldest ? ` (oldest ${oldest.f}, ${oldest.waitedMin.toFixed(0)} min, grace ${GRACE_MINUTES})` : ' — none'}`)
  }
}

if (failures) { console.log(`\nbus-observability: ${failures} of ${failures + passes} checks FAILED`); process.exit(1) }
console.log(`bus-observability: ${passes} checks passed — every hook exit logs, and silence while work waits is an alarm`)
