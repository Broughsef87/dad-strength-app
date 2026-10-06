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
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs'
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
function runHook({ queue = [], claimed = [], halt = false }) {
  const root = mkdtempSync(join(tmpdir(), 'bus-one-at-a-time-'))
  const bus = join(root, '.claude', 'bus')
  mkdirSync(join(bus, 'queue'), { recursive: true })
  mkdirSync(join(bus, 'claimed'), { recursive: true })
  for (const f of queue) writeFileSync(join(bus, 'queue', f), '{}')
  for (const f of claimed) writeFileSync(join(bus, 'claimed', f), '{}')
  if (halt) writeFileSync(join(bus, 'HALT'), '')

  let code = 0
  let stderr = ''
  try {
    // BOTH the env var and the cwd point at the throwaway root. The hook reads
    // `${CLAUDE_PROJECT_DIR:-$(pwd)}`, so the env var alone leaves a fallback
    // that lands on the REAL bus — my own mutation run did exactly that and
    // ran the live dispatcher. Setting cwd too makes this suite incapable of
    // touching the project's own queue, rather than merely careful not to.
    execFileSync('bash', [HOOK], {
      cwd: root,
      env: { ...process.env, CLAUDE_PROJECT_DIR: root },
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    code = e.status ?? -1
    stderr = String(e.stderr ?? '')
  }
  const ls = (d) => readdirSync(join(bus, d)).sort()
  const log = existsSync(join(bus, 'bus.log'))
    ? execFileSync('cat', [join(bus, 'bus.log')], { encoding: 'utf8' })
    : ''
  const out = { code, stderr, log, queue: ls('queue'), claimed: ls('claimed') }
  rmSync(root, { recursive: true, force: true })
  return out
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
  assert(!/Next item on the bus/.test(r.stderr),
    'nothing is dispatched into the prompt')
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

// ── 5. HALT still outranks everything ─────────────────────────────────────
{
  const r = runHook({ queue: ['014-FOR-999.json'], claimed: [], halt: true })
  assert(r.queue.includes('014-FOR-999.json') && r.claimed.length === 0,
    'HALT stops a dispatch that would otherwise have gone ahead')
  assert(/outcome=halted/.test(r.log), 'and says so')
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
  assert(/CLAUDE\.md section Gates/.test(m),
    'the message points at CLAUDE.md section Gates rather than listing gates itself')
  for (const stale of [/database migration/i, /Stripe/i, /production deploy/i, /program\/training content/i]) {
    assert(!stale.test(m),
      `the message no longer carries its own copy of the gate list (${stale})`)
  }
  assert(/## Ruling \(Blaine\)/.test(m),
    "the message tells CC the newest '## Ruling (Blaine)' comment is part of the spec")
  assert(/Small \/ Normal \/ High/.test(m), 'and that the ticket sizes its own work')
  assert(/doorbell/.test(m), 'the doorbell-is-not-a-spec rule survives')
  assert(/never force-push/.test(m) && /tsc --noEmit/.test(m),
    'and so do the branch and gate rules')
}

console.log('')
console.log('── the bus deals one ticket at a time (FOR-262) ────────')
console.log(`  hook invocations            7`)
console.log(`  assertions                  ${passes + failures}`)
console.log('')

if (failures) {
  console.log(`✗ ${failures} of ${passes + failures} assertions failed`)
  process.exit(1)
}
console.log(`✓ ${passes} assertions: a ticket in flight holds the bus, an empty claimed/ releases it`)
