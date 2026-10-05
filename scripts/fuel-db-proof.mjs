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

  // ── THE LIBRARY IN THE DATABASE IS EXACTLY WHAT THE FIXTURES SAY ─────────
  // Four rounds of FOR-257 went on a regex hunting for a stray write to
  // fuel_meals in a migration no pair generated. Codex beat that regex every
  // round — `UPDATE ONLY(public.fuel_meals)`, a MERGE, a comment between the
  // keyword and the table, a quoted upper-case name — and it also made the
  // check fire on a commented-out example. Matching SQL text with a regular
  // expression is the wrong instrument, and this harness already holds the
  // right one: every Fuel migration has just been applied to a real Postgres,
  // twice.
  //
  // So the question stops being "does any file look like a write" and becomes
  // "after every migration, is the library what the fixtures declare". A stray
  // write cannot spell its way past this: it changes a row, and the row is
  // compared field by field.
  const compareLibrary = (when) => {
    const fixtures = [
      ['fixtures/fuel-seed.json', (j) => j.fuel_meals],
      ['fixtures/fuel-seed-rotation-b.json', (j) => j.fuel_meals_new],
      ['fixtures/fuel-seed-library-expansion.json', (j) => j.fuel_meals_new],
    ]
    const want = new Map()
    for (const [file, pick] of fixtures) {
      for (const m of pick(JSON.parse(readLF(file)))) want.set(m.slug, { ...m, _from: file })
    }
    // EVERY column the app reads, `active` included. The query used to omit
    // it and the three macro columns, so a write setting `active = false`
    // passed the comparison while loadMeals() dropped the meal from the
    // library — it filters on active = true (FOR-257 r5).
    const rows = q(`select jsonb_agg(to_jsonb(t) order by t.slug) from (
      select slug, name, protein_cut, spice_profile, format, active_cook_minutes,
             total_minutes, servings, protein_g_per_person, perishable_within_days,
             rotation_note, ingredients, active,
             carbs_g_per_person, fat_g_per_person, calories_per_person
      from public.fuel_meals) t`)
    const got = new Map((JSON.parse(rows || '[]')).map((r) => [r.slug, r]))

    const missing = [...want.keys()].filter((k) => !got.has(k))
    const extra = [...got.keys()].filter((k) => !want.has(k))
    if (missing.length || extra.length) {
      throw new Error(`fuel_meals is not the fixtures' library ${when} — missing: ${missing.join(', ') || 'none'}; unexpected: ${extra.join(', ') || 'none'}`)
    }

    const SCALARS = ['name', 'protein_cut', 'spice_profile', 'format', 'active_cook_minutes',
      'total_minutes', 'servings', 'protein_g_per_person', 'perishable_within_days', 'rotation_note']
    const diffs = []
    for (const [slug, w] of want) {
      const r = got.get(slug)
      for (const k of SCALARS) {
        const a = w[k] === undefined ? null : w[k]
        const b = r[k] === undefined ? null : r[k]
        if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push(`${slug}.${k}: fixture ${JSON.stringify(a)} vs row ${JSON.stringify(b)}`)
      }
      // CANONICAL IN KEY ORDER, NOT IN TYPE. jsonb does not keep an object's
      // key order, so the keys are listed; it does keep the type, so
      // String()/Number()/Boolean() were throwing away the difference between
      // 7 and "7", and between true and "false" (FOR-257 r5). The values go
      // through untouched.
      const canon = (list) => JSON.stringify((list ?? []).map((i) => [
        i.item, i.qty_per_person, i.unit, i.store_section, i.inferred,
      ]))
      if (canon(w.ingredients) !== canon(r.ingredients)) {
        diffs.push(`${slug}.ingredients differ — fixture ${canon(w.ingredients).slice(0, 120)} vs row ${canon(r.ingredients).slice(0, 120)}`)
      }
      // No seed migration carries macros (FOR-234), so the columns stay null
      // whatever a fixture says — and a fixture may only say null.
      // The ROW's macros, not only the fixture's: a write that set one passed
      // a loop that examined the fixture alone (FOR-257 r5).
      for (const k of ['carbs_g_per_person', 'fat_g_per_person', 'calories_per_person']) {
        if (w[k] !== null && w[k] !== undefined) diffs.push(`${slug}.${k} is ${JSON.stringify(w[k])} in ${w._from} — no seed migration carries macros`)
        if (r[k] !== null) diffs.push(`${slug}.${k} is ${JSON.stringify(r[k])} in the ROW — no seed migration carries macros`)
      }
      if (r.active !== true) diffs.push(`${slug}.active is ${JSON.stringify(r.active)} — an inactive meal is dropped from the library by loadMeals()`)
    }
    if (diffs.length) throw new Error(`fuel_meals rows disagree with their fixtures ${when}:\n  ${diffs.slice(0, 8).join('\n  ')}${diffs.length > 8 ? `\n  ... and ${diffs.length - 8} more` : ''}`)
    console.log(`  PASS (FOR-257) ${when}: the library is exactly the ${want.size} meals the fixtures declare, every column — a stray write cannot spell its way past a row comparison`)
  }

  for (const m of fp.migrations) { apply(readLF(m.file), m.file); console.log(`applied ${m.file}`) }
  // Every Fuel migration applies a second time, IN ORDER, and leaves the same
  // database: a second apply is proven harmless. The order is the point.
  // Replaying one migration on its own reinstates the body a later migration
  // replaced — 20260919 replaces the trigger function 20260918 defines — and the
  // proof would then run against SQL that no fresh database ever has. That is not
  // hypothetical: it silently reverted the fix and the proof stayed red (FOR-243).
  compareLibrary('after one apply of every migration, as production does it')

  for (const m of fp.migrations) apply(readLF(m.file), `${m.file}, a second time`)
  console.log(`applied all ${fp.migrations.length} Fuel migrations a second time, in order: idempotent`)

  // AFTER THE SECOND APPLY, and after the FIRST. A stray write that fires only
  // once — guarded by its own marker table — is undone by the second seed
  // replay, so comparing at the end alone declared the library correct while a
  // single production apply would have left it wrong (FOR-257 r5).
  compareLibrary('after every migration has been applied twice')

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
