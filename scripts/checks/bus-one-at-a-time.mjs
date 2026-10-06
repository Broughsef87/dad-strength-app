// ── The Stop hook deals one ticket at a time (FOR-262) ──────────────────────
//
// The hook fires at the end of EVERY turn, mid-ticket included, and used to
// claim the next queued ticket regardless of what was already in flight. On
// 2026-10-05 it claimed FOR-263 and FOR-250 while FOR-257 sat in Codex review,
// then claimed FOR-262 while FOR-263 was in review — three tickets in
// claimed/, one being reviewed and two unstarted.
//
// ITS OWN FILE, and it RUNS THE HOOK rather than reading it. A regex over the
// script would assert that a line of shell exists; this asserts what the shell
// does to a directory. Every case below builds a throwaway bus under the OS
// temp dir, invokes the real hook against it with CLAUDE_PROJECT_DIR, and
// checks where the files ended up.
//
// This repo has no test runner (FOR-256), so the cases are a list and the
// failures are counted.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync, rmSync, existsSync, chmodSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const HOOK = join(REPO, '.claude', 'hooks', 'bus-continue.sh')

let passes = 0
let failures = 0
const assert = (cond, msg) => {
  if (cond) passes++
  else { failures++; console.log('  ✗ ' + msg) }
}

/**
 * Build a throwaway bus, run the real hook against it, and report what moved.
 *
 * The hook is invoked through `bash` with CLAUDE_PROJECT_DIR pointing at the
 * throwaway root, which is exactly how Claude Code invokes it (shell form, see
 * .claude/settings.json). Nothing here touches the project's own bus.
 */
let invocations = 0
function runHook({ queue = [], claimed = [], halt = false, claimedMode = null }) {
  invocations++
  const root = mkdtempSync(join(tmpdir(), 'bus-one-at-a-time-'))
  // EVERYTHING after mkdtempSync is inside try/finally. Setup used to sit
  // outside it and the log was read by spawning `cat`, so a setup failure or a
  // missing `cat` skipped rmSync and left a throwaway bus on disk every run
  // (Codex r1 P2).
  try {
    const bus = join(root, '.claude', 'bus')
    mkdirSync(join(bus, 'queue'), { recursive: true })
    mkdirSync(join(bus, 'claimed'), { recursive: true })
    for (const f of queue) writeFileSync(join(bus, 'queue', f), '{}')
    for (const f of claimed) writeFileSync(join(bus, 'claimed', f), '{}')
    if (halt) writeFileSync(join(bus, 'HALT'), '')
    if (claimedMode != null) chmodSync(join(bus, 'claimed'), claimedMode)

    // spawnSync, NOT execFileSync. execFileSync hands back stderr only when the
    // command THROWS, so every assertion about a SUCCESSFUL run's message was
    // reading an empty string — "nothing is dispatched into the prompt" passed
    // even if the busy path had printed a dispatch (Codex r1 P2). The same
    // defect was in scripts/checks/codex-review-launcher.mjs and got fixed
    // there first; this is the other half of it.
    //
    // BOTH the env var and the cwd point at the throwaway root. The hook reads
    // `${CLAUDE_PROJECT_DIR:-$(pwd)}`, so the env var alone leaves a fallback
    // that lands on the REAL bus — my own mutation run did exactly that and
    // ran the live dispatcher. Setting cwd too makes this suite incapable of
    // touching the project's own queue, rather than merely careful not to.
    const r = spawnSync('bash', [HOOK], {
      cwd: root,
      env: { ...process.env, CLAUDE_PROJECT_DIR: root },
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    })
    if (claimedMode != null) chmodSync(join(bus, 'claimed'), 0o700)
    const ls = (d) => readdirSync(join(bus, d)).sort()
    // readFileSync, so the log read cannot fail on a missing external binary.
    const log = existsSync(join(bus, 'bus.log')) ? readFileSync(join(bus, 'bus.log'), 'utf8') : ''
    return {
      code: r.status ?? -1,
      stderr: String(r.stderr ?? ''),
      log,
      queue: ls('queue'),
      claimed: ls('claimed'),
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

// ── 1. THE DEFECT: a ticket in flight must stop the next dispatch ─────────
{
  const r = runHook({ queue: ['014-FOR-999.json'], claimed: ['012-FOR-263.json'] })
  assert(r.queue.includes('014-FOR-999.json'),
    `a queued ticket stays queued while one is in flight — queue is ${JSON.stringify(r.queue)}`)
  assert(r.claimed.length === 1 && r.claimed[0] === '012-FOR-263.json',
    `claimed/ still holds exactly the ticket in flight — ${JSON.stringify(r.claimed)}`)
  assert(r.code === 0,
    `and the turn is ALLOWED to end (exit 0, not the blocking exit 2) — got ${r.code}`)
  // Load-bearing only since spawnSync: on exit 0 the old harness always saw an
  // empty stderr, so this passed whatever the hook printed (Codex r1 P2).
  assert(!/Next item on the bus/.test(r.stderr),
    `nothing is dispatched into the prompt — stderr was ${JSON.stringify(r.stderr.slice(0, 120))}`)
  assert(/outcome=busy/.test(r.log), `the refusal is logged as outcome=busy — log was ${JSON.stringify(r.log)}`)
  assert(/012-FOR-263\.json/.test(r.log),
    'and the log NAMES the ticket holding the bus, so a wedge is readable')
}

// ── 2. …and it deals the next one the moment claimed/ is empty ────────────
//
// Without this the first case could pass on a hook that never dispatches at
// all, which is the shape of defect this repo keeps producing.
{
  const r = runHook({ queue: ['014-FOR-999.json'], claimed: [] })
  assert(r.claimed.includes('014-FOR-999.json'),
    `an empty claimed/ gets the next ticket — claimed is ${JSON.stringify(r.claimed)}`)
  assert(r.queue.length === 0, `and it leaves the queue — ${JSON.stringify(r.queue)}`)
  assert(r.code === 2, `blocking the stop with exit 2 — got ${r.code}`)
  assert(/Next item on the bus: FOR-999/.test(r.stderr),
    'and the ticket id reaches the prompt')
  assert(/outcome=claimed ticket=FOR-999/.test(r.log), 'logged as a claim with its ticket')
}

// ── 3. several in flight are all counted, and the count is reported ───────
{
  const r = runHook({
    queue: ['014-FOR-999.json'],
    claimed: ['008-FOR-231.json', '009-FOR-229.json', '012-FOR-263.json'],
  })
  assert(r.claimed.length === 3 && r.queue.includes('014-FOR-999.json'),
    'three in flight still blocks the dispatch')
  assert(/3 ticket\(s\) still claimed/.test(r.log),
    `the log says how many are holding it — ${JSON.stringify(r.log)}`)
  assert(/008-FOR-231\.json/.test(r.log),
    'and names the first in filename order, which is the oldest')
}

// ── 4. A STRAY FILE IN claimed/ MUST NOT WEDGE THE BUS ────────────────────
//
// Counting every file would turn one stray write into a dead dispatcher for
// good. Only doorbell-shaped names count as work in flight.
{
  const r = runHook({ queue: ['014-FOR-999.json'], claimed: ['notes.txt', '.DS_Store'] })
  assert(r.claimed.includes('014-FOR-999.json'),
    `a stray file in claimed/ does not block a dispatch — claimed is ${JSON.stringify(r.claimed)}`)
  assert(r.code === 2, `and the stop is still blocked — got ${r.code}`)
}

// ── 4b. A NEWLINE INSIDE A FILENAME IS NOT TWO FILES (Codex r1 P1) ───────
//
// The gate parsed newline-delimited `ls` output, so ONE file called
// $'notes\n012-FOR-263.json' produced a line matching the doorbell pattern.
// The hook refused and named 012-FOR-263.json — a ticket that does not exist,
// in a wedge whose own log told you to move a file you could not find.
// NTFS forbids a newline in a filename, so this case cannot be CONSTRUCTED on
// Windows. The glob fix is structural — a glob hands back whole names and never
// splits one — but structural is not demonstrated, so the skip is REPORTED
// rather than quietly counted as a pass.
try {
  const r = runHook({ queue: ['014-FOR-999.json'], claimed: ['notes\n012-FOR-263.json'] })
  assert(r.claimed.includes('014-FOR-999.json'),
    `a newline inside one stray filename does not read as a doorbell — claimed is ${JSON.stringify(r.claimed)}`)
  assert(r.code === 2, `and the dispatch goes ahead — got ${r.code}`)
  assert(!/012-FOR-263/.test(r.log),
    `and the log never names a phantom ticket — log was ${JSON.stringify(r.log)}`)
} catch (e) {
  if (e?.code === 'ENOENT' || e?.code === 'EINVAL') {
    console.log('  · this filesystem forbids a newline in a filename — the phantom-ticket case could not be constructed, so the glob fix is unexercised here')
  } else {
    failures++
    console.log('  ✗ the newline-filename case threw unexpectedly: ' + (e?.message ?? e))
  }
}

// What CAN be exercised anywhere: a stray name that merely CONTAINS a doorbell
// name must not count as one.
{
  const r = runHook({ queue: ['014-FOR-999.json'], claimed: ['notes-012-FOR-263.json.bak'] })
  assert(r.claimed.includes('014-FOR-999.json'),
    `a stray name containing a doorbell name is not a doorbell — claimed is ${JSON.stringify(r.claimed)}`)
  assert(!/012-FOR-263/.test(r.log), 'and no phantom ticket reaches the log')
}
// …and FOR- followed by a non-number is not a doorbell either, which is the
// case the glob's character classes cannot express on their own.
{
  const r = runHook({ queue: ['014-FOR-999.json'], claimed: ['012-FOR-26x.json'] })
  assert(r.claimed.includes('014-FOR-999.json'),
    `FOR- followed by a non-number is not a doorbell — claimed is ${JSON.stringify(r.claimed)}`)
}

// ── 4c. AN UNREADABLE claimed/ IS NOT AN EMPTY ONE (Codex r1 P2) ─────────
//
// `ls 2>/dev/null | grep -c` printed 0 when the listing failed, so an
// unreadable directory read as "nothing in flight" and the hook dispatched on
// top of occupancy it could not see.
//
// POSIX mode bits do not restrict the owner on Windows, so this case can only
// run where chmod actually bites. It reports which way it went rather than
// passing silently either way.
{
  const r = runHook({ queue: ['014-FOR-999.json'], claimed: ['012-FOR-263.json'], claimedMode: 0o000 })
  if (/outcome=claimed/.test(r.log)) {
    console.log('  \u00b7 chmod 000 did not restrict the owner here (Windows) — the unreadable case could not be exercised')
  } else {
    assert(/outcome=(claimed-unreadable|busy)/.test(r.log),
      `an unreadable claimed/ refuses rather than dispatching — log was ${JSON.stringify(r.log)}`)
    assert(r.queue.includes('014-FOR-999.json'), 'and the queued ticket stays queued')
  }
}

// ── 5. HALT still outranks everything ─────────────────────────────────────
{
  const r = runHook({ queue: ['014-FOR-999.json'], claimed: [], halt: true })
  assert(r.queue.includes('014-FOR-999.json') && r.claimed.length === 0,
    'HALT stops a dispatch that would otherwise have gone ahead')
  assert(/outcome=halted/.test(r.log), 'and says so')
}
// …and HALT OUTRANKS the busy gate. With claimed/ empty the case above cannot
// tell which guard fired, so it established nothing about precedence (Codex
// r1). With a doorbell in flight AND a HALT, the log must say halted.
{
  const r = runHook({ queue: ['014-FOR-999.json'], claimed: ['012-FOR-263.json'], halt: true })
  assert(/outcome=halted/.test(r.log),
    `HALT is reported ahead of busy, so the stronger hold is the one named — log was ${JSON.stringify(r.log)}`)
  assert(!/outcome=busy/.test(r.log), 'and busy is not also logged')
}

// ── 6. an empty queue with an empty claimed/ is still just empty ──────────
{
  const r = runHook({ queue: [], claimed: [] })
  assert(r.code === 0 && /outcome=empty/.test(r.log),
    `nothing queued is reported as empty, not as busy — ${JSON.stringify(r.log)}`)
}

// ── 7. the message carries the SPEC rules, not its own gate list ──────────
//
// §2 of FOR-262: the hook must stop naming gates, because a second copy of
// the gate list drifts from CLAUDE.md the moment either is edited. Asserted
// against the dispatched message, which is what CC actually reads.
{
  const r = runHook({ queue: ['014-FOR-999.json'], claimed: [] })
  const m = r.stderr
  // THE POINTER HAS TO RESOLVE. Replacing the hook's copy of the gate list with
  // a reference to CLAUDE.md trades a drifting duplicate for a link that can
  // dangle — and it dangled within the hour: while this change sat in review,
  // the heading was renamed to "## Stop and hand back" and back again, and
  // nothing failed either way. So the heading the message names is read back
  // out of CLAUDE.md here. Rename one side and this goes red until both agree.
  const HEADING = 'Gates'
  assert(m.includes(`"${HEADING}" in CLAUDE.md`),
    `the message points at CLAUDE.md's "${HEADING}" section rather than listing gates itself`)
  const claudeMd = readFileSync(join(REPO, 'CLAUDE.md'), 'utf8')
  assert(new RegExp(`^## ${HEADING}`, 'm').test(claudeMd),
    `and CLAUDE.md actually HAS a "## ${HEADING}" heading — a reference nothing resolves is worse than the duplicate it replaced`)
  // The section it points at has to carry the gates, or the pointer resolves to
  // prose that says nothing.
  const section = claudeMd.split(new RegExp(`^## ${HEADING}[^
]*
`, 'm'))[1]?.split(/^## /m)[0] ?? ''
  assert(/migration/i.test(section) && /Stripe|billing|auth|secrets/i.test(section),
    'and that section names the two gates, so the reference lands on the list')
  for (const stale of [/database migration/i, /Stripe/i, /production deploy/i, /program\/training content/i]) {
    assert(!stale.test(m),
      `the message no longer carries its own copy of the gate list (${stale})`)
  }
  assert(/## Ruling \(Blaine\)/.test(m),
    "the message tells CC the newest '## Ruling (Blaine)' comment is part of the spec")
  // THE SIZING TABLE IS NOT COPIED HERE EITHER. The message used to repeat the
  // three size names and the Normal default, which made it a second copy — and
  // this check a third (Codex r1 P3). It points at CLAUDE.md's section now, and
  // that pointer is verified the same way the Gates one is.
  assert(/first line sizes the work/i.test(m), 'the message says the ticket\'s first line sizes the work')
  assert(/"Size every ticket" in CLAUDE\.md/.test(m),
    'and points at CLAUDE.md\'s sizing section rather than repeating the table')
  assert(/^## Size every ticket/m.test(claudeMd),
    'and CLAUDE.md actually HAS that heading')
  const sizing = claudeMd.split(/^## Size every ticket[^\n]*\n/m)[1]?.split(/^## /m)[0] ?? ''
  for (const tier of ['Small', 'Normal', 'High']) {
    assert(sizing.includes(tier), `and that section names the ${tier} tier, so the reference lands on the table`)
  }
  assert(!/Small \/ Normal \/ High/.test(m),
    'while the message itself no longer carries the size list')
  assert(/doorbell/.test(m), 'the doorbell-is-not-a-spec rule survives')
  assert(/never force-push/.test(m) && /tsc --noEmit/.test(m),
    'and so do the branch and gate rules')
}

console.log('')
console.log('── the bus deals one ticket at a time (FOR-262) ────────')
console.log(`  hook invocations            ${invocations}`)
console.log(`  assertions                  ${passes + failures}`)
console.log('')

if (failures) {
  console.log(`✗ ${failures} of ${passes + failures} assertions failed`)
  process.exit(1)
}
console.log(`✓ ${passes} assertions: a ticket in flight holds the bus, an empty claimed/ releases it`)
