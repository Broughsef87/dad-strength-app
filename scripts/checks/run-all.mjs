#!/usr/bin/env node
// ── Check suites ──────────────────────────────────────────────────────────────
// Every deterministic suite in one run. These used to live in a scratchpad and
// get quoted as numbers in commit messages, which makes them claims rather than
// artifacts — anyone reviewing had to take the count on faith. Now they run.
//
//   npm run checks
//
// Each suite is a standalone .mjs that exits non-zero on failure, so this is
// just a runner: spawn them, surface the tail, fail loudly on the first break.
//
// --no-install is deliberate: without tsx in devDependencies, npx quietly
// reaches for a global copy or downloads one, so the suites passed on the
// machine that happened to have it and failed 5-of-6 everywhere else. Now they
// resolve the local dep or fail honestly.

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

const SUITES = [
  ['program rules — Power Dad', 'sweep.mjs'],
  ['program rules — Dad Built', 'dadbuilt-sweep.mjs'],
  ['double progression', 'progression-check.mjs'],
  ['autoreg behaviour', 'autoreg-behaviour.mjs'],
  ['autoreg ratchet', 'autoreg-ratchet.mjs'],
  ['training analytics', 'analytics-check.mjs'],
  ['onboarding reachability', 'onboarding-check.mjs'],
  ['the 4-set ceiling', 'set-ceiling.mjs'],
  ['orphaned components', 'orphans.mjs'],
  ['ink contrast', 'contrast.mjs'],
  ['raw palette', 'palette.mjs'],
  ['run scope', 'run-scope.mjs'],
]

const run = (file) => new Promise((resolve) => {
  const p = spawn('npx', ['--no-install', 'tsx', join(here, file)], { shell: true })
  let out = ''
  p.stdout.on('data', d => { out += d })
  p.stderr.on('data', d => { out += d })
  p.on('close', code => resolve({ code, out }))
})

let failed = 0
for (const [label, file] of SUITES) {
  const { code, out } = await run(file)
  const lines = out.trimEnd().split('\n')
  const verdict = lines[lines.length - 1] ?? '(no output)'
  if (code === 0) {
    console.log(`  PASS  ${label.padEnd(28)} ${verdict.trim()}`)
  } else {
    failed++
    console.log(`  FAIL  ${label.padEnd(28)} exit ${code}`)
    console.log(lines.slice(-20).map(l => '        ' + l).join('\n'))
  }
}

console.log('\n' + '='.repeat(64))
if (failed) {
  console.log(`${failed} of ${SUITES.length} suites FAILED`)
  process.exit(1)
}
console.log(`all ${SUITES.length} suites green`)
