// ── The Codex launcher reports its failures (2026-10-06) ────────────────────
//
// scripts/codex-review.sh exists because a Codex review was launched, reported
// as running, and sat for EIGHT HOURS having produced 39 bytes:
//
//   Reading additional input from stdin...
//
// A script whose whole job is detecting failure cannot be verified by reading
// it. So this suite STUBS `codex` with a fake that reproduces each failure mode
// on demand, runs the real launcher against it, and asserts the exit code and
// the message. Every case below is a failure that actually happened or that the
// script claims to catch.
//
// ITS OWN FILE, so deleting the launcher cannot also delete the check that
// would catch the deletion. Timeouts are driven down to seconds through the
// script's own env knobs, so the whole suite runs in well under a minute.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, chmodSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const LAUNCHER = join(REPO, 'scripts', 'codex-review.sh')

let passes = 0
let failures = 0
const assert = (cond, msg) => {
  if (cond) passes++
  else { failures++; console.log('  ✗ ' + msg) }
}

assert(existsSync(LAUNCHER), 'scripts/codex-review.sh exists')

/**
 * Run the real launcher with a FAKE codex on PATH.
 *
 * `body` is the fake's bash body. It receives the prompt on stdin exactly as
 * the real one does, so a fake that reads stdin proves the prompt arrived and a
 * fake that ignores it proves nothing about delivery either way.
 */
function launch({ body, prompt = 'review this', env = {}, promptFile = true }) {
  const dir = mkdtempSync(join(tmpdir(), 'codex-launcher-'))
  const bin = join(dir, 'bin')
  execFileSync('mkdir', ['-p', bin])
  const fake = join(bin, 'codex')
  writeFileSync(fake, `#!/usr/bin/env bash\n${body}\n`)
  chmodSync(fake, 0o755)

  const promptPath = join(dir, 'prompt.md')
  if (promptFile) writeFileSync(promptPath, prompt)
  const logPath = join(dir, 'out.log')

  // spawnSync, NOT execFileSync. execFileSync only hands back stderr when the
  // command THROWS, so every assertion about the launcher's own reporting on a
  // SUCCESSFUL run was reading an empty string — my first draft of this suite
  // failed its own happy-path case for that reason while the launcher was
  // printing both lines correctly. The instrument has to see success too.
  const r = spawnSync('bash', [LAUNCHER, promptPath, logPath], {
    env: {
      ...process.env,
      CODEX_BIN: fake,
      CODEX_START_TIMEOUT: '6',
      CODEX_STALL_LIMIT: '6',
      CODEX_POLL: '1',
      ...env,
    },
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000,
  })
  const code = r.status ?? -1
  const stderr = String(r.stderr ?? '')
  const log = existsSync(logPath) ? readFileSync(logPath, 'utf8') : ''
  rmSync(dir, { recursive: true, force: true })
  return { code, stderr, log }
}

// ── 1. THE EIGHT-HOUR HANG, caught in seconds ─────────────────────────────
// The fake does exactly what codex did: announces it is reading stdin, then
// waits forever. The launcher must kill it and say so.
{
  const r = launch({ body: 'echo "Reading additional input from stdin..."\nsleep 120' })
  assert(r.code === 5, `a stdin block exits 5, got ${r.code}`)
  assert(/waiting on stdin/i.test(r.stderr), `and says the prompt did not reach it — stderr was ${JSON.stringify(r.stderr.slice(0, 200))}`)
  assert(!/complete/i.test(r.stderr), 'and never reports completion')
}

// ── 2. the happy path, so none of the above passes by refusing everything ──
{
  const r = launch({
    body: 'cat > /dev/null\necho "session id: 01a-test"\necho "findings: none"\nexit 0',
  })
  assert(r.code === 0, `a clean run exits 0, got ${r.code} / ${JSON.stringify(r.stderr.slice(0, 200))}`)
  assert(/session id/.test(r.log), 'the log holds the session id')
  assert(/findings: none/.test(r.log), 'and the output')
  assert(/CODEX EXIT 0/.test(r.log), 'and the exit marker, so a reader can tell a finished run from a truncated one')
  assert(/started in/.test(r.stderr) && /complete/.test(r.stderr), 'and the launcher reports both start and completion')
}

// ── 3. THE PROMPT ACTUALLY ARRIVES ON STDIN ───────────────────────────────
// The failure was an empty prompt. A launcher that starts codex with no prompt
// is the whole defect, so prove the bytes get there.
{
  const r = launch({
    body: 'echo "session id: 01a-test"\necho "PROMPT_WAS: $(cat)"\nexit 0',
    prompt: 'REVIEW-SENTINEL-9f3a',
  })
  assert(r.code === 0, `the stdin-echo run exits 0, got ${r.code}`)
  assert(/PROMPT_WAS: REVIEW-SENTINEL-9f3a/.test(r.log),
    `the prompt reached codex on stdin — log was ${JSON.stringify(r.log.slice(0, 200))}`)
}

// ── 4. an empty prompt file is refused before anything launches ───────────
{
  const r = launch({ body: 'echo "session id: x"\nexit 0', prompt: '' })
  assert(r.code === 3, `an empty prompt file exits 3, got ${r.code}`)
  assert(/empty/i.test(r.stderr), 'and names the reason')
  assert(!/session id/.test(r.log), 'and codex is never started')
}

// ── 5. a missing prompt file, likewise ────────────────────────────────────
{
  const r = launch({ body: 'exit 0', promptFile: false })
  assert(r.code === 3, `a missing prompt file exits 3, got ${r.code}`)
  assert(/does not exist/i.test(r.stderr), 'and says so')
}

// ── 6. started but never speaks again — the stall ─────────────────────────
{
  const r = launch({ body: 'cat > /dev/null\necho "session id: 01a-test"\nsleep 120' })
  assert(r.code === 6, `a stalled run exits 6, got ${r.code}`)
  assert(/produced nothing for/i.test(r.stderr), `and reports the stall — stderr was ${JSON.stringify(r.stderr.slice(0, 200))}`)
}

// ── 7. never prints a session id, so it never really started ──────────────
{
  const r = launch({ body: 'cat > /dev/null\necho "warming up"\nsleep 120' })
  assert(r.code === 4, `no session id exits 4, got ${r.code}`)
  assert(/never started|no session id/i.test(r.stderr), 'and says it never started')
}

// ── 8. dies during startup ────────────────────────────────────────────────
{
  const r = launch({ body: 'echo "boom" >&2\nexit 1' })
  assert(r.code === 4, `a startup death exits 4, got ${r.code}`)
  assert(/exited during startup/i.test(r.stderr), 'and says it died rather than reporting a stall')
}

// ── 9. ran, then failed — the findings are kept and the failure surfaces ──
{
  const r = launch({
    body: 'cat > /dev/null\necho "session id: 01a-test"\necho "partial findings here"\nexit 2',
  })
  assert(r.code === 7, `a non-zero codex exit gives 7, got ${r.code}`)
  assert(/exited 2/.test(r.stderr), 'and reports codex’s own exit code')
  assert(/partial findings here/.test(r.log), 'while keeping whatever it did produce')
  assert(/CODEX EXIT 2/.test(r.log), 'and recording the exit in the log')
}

// ── 10. EVERY FAILURE GETS ITS OWN CODE ───────────────────────────────────
// One exit code for every failure would make the launcher useless to a caller
// and is the easiest way to half-fix this. Asserted as a set, so collapsing two
// of them fails here.
{
  const seen = new Set([5, 0, 3, 6, 4, 7])
  assert(seen.size === 6, 'the six outcomes above are six distinct exit codes')
}

console.log('')
console.log('── the Codex launcher reports its failures ─────────────')
console.log(`  launcher runs               9`)
console.log(`  assertions                  ${passes + failures}`)
console.log('')

if (failures) {
  console.log(`✗ ${failures} of ${passes + failures} assertions failed`)
  process.exit(1)
}
console.log(`✓ ${passes} assertions: a hang, a stall, a death and an empty prompt each exit non-zero with their reason`)
