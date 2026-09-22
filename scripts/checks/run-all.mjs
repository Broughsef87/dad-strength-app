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
  ['week shape', 'week-shape.mjs'],
  ['design system', 'design-system.mjs'],
  ['adherence (FOR-228)', 'adherence.mjs'],
  ['protocol row key (FOR-228)', 'protocol-row-key.mjs'],
  // The row is the record; localStorage only paints — its own suite, so a
  // revert of the ruling cannot take the check that would catch it (FOR-231).
  ['checkin record (FOR-231)', 'checkin-record.mjs'],
  ['program lineup (FOR-225)', 'program-lineup.mjs'],
  // The prep slot, the jump ramp and the ground-contact ceiling — its own suite,
  // so a revert of the prep cannot take the check that would catch it (FOR-244).
  ['ballistic load (FOR-244)', 'ballistic-load.mjs'],
  // A trained session shows what it was trained under, whatever buildDay now
  // returns — its own suite, so a revert of the rule cannot take its check (FOR-248).
  ['session plan (FOR-248)', 'session-plan.mjs'],
  // A dead hook and an empty queue used to look identical — its own suite, so a
  // revert of the logging cannot take the check that would catch it (FOR-246).
  ['bus observability (FOR-246)', 'bus-observability.mjs'],
  ['fuel solve (FOR-177)', 'fuel-solve.mjs'],
  // Its own suite, not a section of fuel-solve: a revert of the rotations
  // feature must not take the check that would catch the revert with it.
  ['fuel rotations (FOR-238)', 'fuel-rotations.mjs'],
  // The picker's grouping against the whole library, its own suite (FOR-239).
  ['fuel vocabulary (FOR-239)', 'fuel-vocabulary.mjs'],
  // No custom key is ever a solver key, over generated libraries — its own suite (FOR-240).
  ['fuel custom keys (FOR-240)', 'fuel-custom-keys.mjs'],
  // An own meal's slug can never be a seeded slug, over generated names — its own suite (FOR-242).
  ['fuel own meals (FOR-242)', 'fuel-own-meals.mjs'],
  // A past night is counted on what it WAS, and only the database writes that down — its own suite (FOR-247).
  ['fuel history record (FOR-247)', 'fuel-history-record.mjs'],
  // The database proof ran against exactly this SQL (npm run proof:db writes the lock) — its own suite (FOR-240).
  ['fuel db proof lock (FOR-240, FOR-242, FOR-243)', 'fuel-db-proof-lock.mjs'],
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
