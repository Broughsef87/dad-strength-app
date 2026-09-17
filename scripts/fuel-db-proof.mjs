#!/usr/bin/env node
// ── Fuel database proof (FOR-240) ────────────────────────────────────────────
// A proof that lives in a scratchpad is not a check. This runs every Fuel
// migration, then scripts/checks/fuel-db-proof.sql, against a throwaway
// Postgres: the Supabase image, its own container, no published port, removed
// afterwards. Every migration is then applied a second time in order, so a
// second apply is proven harmless. Only when every case passes does it write
// scripts/checks/fuel-db-proof.lock.json, the fingerprint of exactly the SQL it
// proved. The standing check fuel-db-proof-lock.mjs (npm run checks) fails as
// soon as a Fuel migration or the proof changes without this being run again.
//
//   npm run proof:db        (needs Docker)
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { IMAGE, LOCK, PROOF, ROOT, fingerprint, readLF } from './fuel-db-proof-lib.mjs'

const NAME = `fuel-db-proof-${process.pid}`
const docker = (args, opts = {}) => spawnSync('docker', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts })
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
const q = (sql) => (docker(['exec', NAME, 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc', sql]).stdout || '').trim()
const apply = (sql, label) => {
  const r = docker(['exec', '-i', NAME, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q'], { input: sql })
  if (r.status !== 0) throw new Error(`${label} did not apply:\n${String(r.stderr || r.stdout).trim().slice(-800)}`)
}

let proven = false
try {
  if (docker(['version', '--format', '{{.Server.Version}}']).status !== 0) throw new Error('Docker is not running — the database proof needs it')
  docker(['rm', '-f', NAME])
  const started = docker(['run', '-d', '--name', NAME, '-e', 'POSTGRES_PASSWORD=local-throwaway-proof', IMAGE])
  if (started.status !== 0) throw new Error(`docker run failed: ${String(started.stderr).trim()}`)
  // The image initialises its schemas and restarts once: wait for auth.uid(), then for three steady answers.
  for (let i = 0; i < 90 && q("select to_regprocedure('auth.uid()') is not null") !== 't'; i++) sleep(2000)
  for (let steady = 0, i = 0; steady < 3 && i < 60; i++) { steady = q('select 1') === '1' ? steady + 1 : 0; sleep(2000) }
  if (q("select to_regprocedure('auth.uid()') is not null") !== 't') throw new Error('the database never became ready')
  console.log(`database ready: ${q('select version()').slice(0, 40)}`)

  apply('CREATE OR REPLACE FUNCTION public.is_premium(user_id uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;', 'the is_premium stub')
  const fp = fingerprint()
  for (const m of fp.migrations) { apply(readLF(m.file), m.file); console.log(`applied ${m.file}`) }
  // Every Fuel migration applies a second time, IN ORDER, and leaves the same
  // database: a second apply is proven harmless. The order is the point.
  // Replaying one migration on its own reinstates the body a later migration
  // replaced — 20260919 replaces the trigger function 20260918 defines — and the
  // proof would then run against SQL that no fresh database ever has. That is not
  // hypothetical: it silently reverted the fix and the proof stayed red (FOR-243).
  for (const m of fp.migrations) apply(readLF(m.file), `${m.file}, a second time`)
  console.log(`applied all ${fp.migrations.length} Fuel migrations a second time, in order: idempotent`)

  const rls = q("select relrowsecurity from pg_class where oid = 'public.fuel_staples'::regclass")
  const policies = q("select string_agg(cmd, ',' order by cmd) from pg_policies where tablename = 'fuel_staples'")
  const triggers = q("select string_agg(tgname, ',' order by tgname) from pg_trigger where tgrelid = 'public.fuel_lists'::regclass and not tgisinternal")
  console.log(`fuel_staples: rls ${rls}, policies ${policies}; fuel_lists triggers: ${triggers}`)
  if (rls !== 't' || policies !== 'INSERT,SELECT,UPDATE') throw new Error('fuel_staples is not owner-only with no delete policy')

  const run = docker(['exec', '-i', NAME, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], { input: readLF(PROOF) })
  const out = `${run.stdout || ''}\n${run.stderr || ''}`
  const passes = out.match(/NOTICE:\s+PASS [^\r\n]*/g) || []
  for (const p of passes) console.log(`  ${p.replace(/^NOTICE:\s+/, '')}`)
  const failure = out.match(/ERROR:\s+[^\r\n]*/)
  if (failure) console.log(`  ${failure[0].slice(0, 500)}`)
  proven = run.status === 0 && /proof-complete/.test(out) && !failure && passes.length === fp.proof.cases
  console.log(`proof: ${passes.length} of ${fp.proof.cases} cases pass${proven ? '' : ' — NOT PROVEN, lock not written'}`)
  if (proven) {
    writeFileSync(join(ROOT, LOCK), `${JSON.stringify({ ...fp, fuel_lists_triggers: triggers, provenAgainst: 'a throwaway Supabase Postgres: every Fuel migration in order, then every one of them again in order' }, null, 2)}\n`)
    console.log(`wrote ${LOCK}`)
  }
} catch (e) {
  console.log(String(e && e.message ? e.message : e))
} finally {
  docker(['rm', '-f', NAME])
  console.log(`container removed: ${String(docker(['ps', '-a', '--filter', `name=${NAME}`, '-q']).stdout || '').trim() === '' ? 'yes' : 'NO'}`)
}
process.exit(proven ? 0 : 1)
