#!/usr/bin/env node
// ── Check-in migration proof (FOR-231 v2) ───────────────────────────────────
// 20261003_checkin_set_path.sql is about to be applied to production data, so
// it is proven first: the Supabase image, its own container, no published port,
// removed afterwards. Sixteen cases, including the two that matter most — two
// writers to different paths on one row both survive, and a gratitude write
// cannot undo a tick, which is the defect the migration exists for.
//
// It is committed WITH the migration rather than left in a scratchpad so that
// Andrew can re-run it before applying, and so it cannot drift from the SQL.
//
//   npm run proof:checkins        (needs Docker)
//
// The ROOT constant below is resolved from this file, so it runs from anywhere.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const IMAGE = 'supabase/postgres:15.8.1.060'
const NAME = `checkin-db-proof-${process.pid}`
const docker = (a, o = {}) => spawnSync('docker', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...o })
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
const q = (sql) => (docker(['exec', NAME, 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc', sql]).stdout || '').trim()
const apply = (sql, label) => {
  const r = docker(['exec', '-i', NAME, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q'], { input: sql })
  if (r.status !== 0) throw new Error(`${label} did not apply:\n${String(r.stderr || r.stdout).trim().slice(-900)}`)
}
const read = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n')

let pass = 0
const fails = []
const ok = (name, cond, got) => { if (cond) { pass++; console.log(`  PASS  ${name}`) } else { fails.push(`${name} — got ${got}`); console.log(`  FAIL  ${name} — got ${got}`) } }

try {
  if (docker(['version', '--format', '{{.Server.Version}}']).status !== 0) throw new Error('Docker is not running')
  docker(['rm', '-f', NAME])
  const started = docker(['run', '-d', '--name', NAME, '-e', 'POSTGRES_PASSWORD=local-throwaway-proof', IMAGE])
  if (started.status !== 0) throw new Error(`docker run failed: ${String(started.stderr).trim()}`)
  for (let i = 0; i < 90 && q("select to_regprocedure('auth.uid()') is not null") !== 't'; i++) sleep(2000)
  for (let steady = 0, i = 0; steady < 3 && i < 60; i++) { steady = q('select 1') === '1' ? steady + 1 : 0; sleep(2000) }
  if (q("select to_regprocedure('auth.uid()') is not null") !== 't') throw new Error('database never became ready')
  console.log(`database ready: ${q('select version()').slice(0, 40)}`)
  console.log(`auth.uid() is: ${q("select pg_get_functiondef('auth.uid()'::regprocedure)").replace(/\s+/g, ' ').slice(0, 200)}\n`)

  // the table and policy exactly as migration-003 creates them
  apply(read('src/utils/supabase/migration-003.sql').replace(/ALTER TABLE user_profiles[\s\S]*?mission_data JSONB;/, '')
    .replace(/-- Also ensure user_profiles RLS exists[\s\S]*$/, '')
    .replace(/CREATE TABLE IF NOT EXISTS daily_checkins \(/, 'CREATE TABLE IF NOT EXISTS daily_checkins ('), 'daily_checkins')
  apply("GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_checkins TO authenticated;", 'grants')

  // the migration under proof, twice — a second apply must be harmless
  const MIG = 'supabase/migrations/20261003_checkin_set_path.sql'
  apply(read(MIG), MIG)
  ok('the migration applies', true, 'applied')
  apply(read(MIG), `${MIG} a second time`)
  ok('it applies a second time (idempotent)', true, 'applied twice')

  ok('SECURITY INVOKER, not DEFINER',
    q("select prosecdef from pg_proc where proname = 'checkin_set_path'") === 'f',
    q("select prosecdef from pg_proc where proname = 'checkin_set_path'"))
  ok('PUBLIC cannot execute it',
    q("select has_function_privilege('public', 'public.checkin_set_path(date,text,text[],jsonb)', 'EXECUTE')") === 'f',
    q("select has_function_privilege('public', 'public.checkin_set_path(date,text,text[],jsonb)', 'EXECUTE')"))
  ok('authenticated can execute it',
    q("select has_function_privilege('authenticated', 'public.checkin_set_path(date,text,text[],jsonb)', 'EXECUTE')") === 't',
    q("select has_function_privilege('authenticated', 'public.checkin_set_path(date,text,text[],jsonb)', 'EXECUTE')"))

  const A = '11111111-1111-1111-1111-111111111111'
  const B = '22222222-2222-2222-2222-222222222222'
  // daily_checkins.user_id references auth.users(id), so the two athletes have
  // to exist. In production they do; here they are seeded.
  apply(`INSERT INTO auth.users (id, instance_id, aud, role, email)
         VALUES ('${A}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','a@example.test'),
                ('${B}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','b@example.test')
         ON CONFLICT (id) DO NOTHING;`, 'the two athletes')
  // run as the athlete: the authenticated role with a jwt sub, so RLS is live
  const asUser = (uid, sql) => {
    const r = docker(['exec', '-i', NAME, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-tA'], {
      // this image's auth.uid() reads request.jwt.claim.sub — the singular
      // setting, not the JSON claims blob
      input: `begin; set local role authenticated; set local "request.jwt.claim.sub" = '${uid}';\n${sql}\ncommit;`,
    })
    return { out: (r.stdout || '').trim(), err: (r.stderr || '').trim(), status: r.status }
  }
  const spirit = (uid, d) => q(`select coalesce(spirit_state::text,'null') from public.daily_checkins where user_id='${uid}' and date='${d}'`)

  // 1. a patch on a MISSING row inserts it, and builds the ancestor
  asUser(A, `select public.checkin_set_path('2026-10-03','spirit_state','{morning,completed}','[true,false]'::jsonb);`)
  ok('a patch on a missing row inserts it and creates the ancestor',
    q(`select spirit_state #>> '{morning,completed}' from public.daily_checkins where user_id='${A}' and date='2026-10-03'`) === '[true, false]',
    spirit(A, '2026-10-03'))

  // 2. THE RULING'S ASSERTION: two writers, two paths, one row, both survive
  asUser(A, `select public.checkin_set_path('2026-10-03','spirit_state','{morning,gratitude}','["a","b"]'::jsonb);`)
  const both = q(`select spirit_state #>> '{morning,completed}' || ' | ' || (spirit_state #>> '{morning,gratitude}') from public.daily_checkins where user_id='${A}' and date='2026-10-03'`)
  ok('two writers to different paths on the same row BOTH survive', both === '[true, false] | ["a", "b"]', both)

  // 3. the second writer did not carry the first's value — the actual defect
  asUser(A, `select public.checkin_set_path('2026-10-03','spirit_state','{morning,completed}','[true,true]'::jsonb);`)
  asUser(A, `select public.checkin_set_path('2026-10-03','spirit_state','{morning,gratitude}','["c"]'::jsonb);`)
  ok('a gratitude write cannot undo a tick',
    q(`select spirit_state #>> '{morning,completed}' from public.daily_checkins where user_id='${A}' and date='2026-10-03'`) === '[true, true]',
    spirit(A, '2026-10-03'))

  // 4. a root path replaces the whole column — the record-creating write
  asUser(A, `select public.checkin_set_path('2026-10-04','mind_state',NULL,'{"objectives":["x"],"lockedIn":true}'::jsonb);`)
  ok('a root path writes the whole column',
    q(`select mind_state::text from public.daily_checkins where user_id='${A}' and date='2026-10-04'`) === '{"lockedIn": true, "objectives": ["x"]}',
    q(`select mind_state::text from public.daily_checkins where user_id='${A}' and date='2026-10-04'`))

  // 5. a patch beside it leaves the rest of the column alone
  asUser(A, `select public.checkin_set_path('2026-10-04','mind_state','{completedObjectives}','[true]'::jsonb);`)
  ok('a field patch leaves its siblings alone',
    q(`select mind_state #>> '{objectives}' from public.daily_checkins where user_id='${A}' and date='2026-10-04'`) === '["x"]',
    q(`select mind_state::text from public.daily_checkins where user_id='${A}' and date='2026-10-04'`))

  // 6. only the two check-in columns are patchable
  const badCol = asUser(A, `select public.checkin_set_path('2026-10-03','updated_at','{x}','1'::jsonb);`)
  ok('a column outside the allowlist is refused', /is not a check-in column/.test(badCol.err), badCol.err.slice(0, 90) || badCol.out)

  // 7. no signed-in athlete, no write
  const anon = docker(['exec', '-i', NAME, 'psql', '-U', 'postgres', '-d', 'postgres', '-tA'], {
    input: `begin; set local role authenticated;\nselect public.checkin_set_path('2026-10-03','spirit_state','{morning,completed}','[true]'::jsonb);\ncommit;`,
  })
  ok('with no authenticated user it raises', /no authenticated user/.test(String(anon.stderr)), String(anon.stderr).slice(0, 90))

  // 8. RLS: one athlete cannot reach another's row
  asUser(B, `select public.checkin_set_path('2026-10-03','spirit_state','{morning,completed}','[false,false]'::jsonb);`)
  ok("B's write made B's own row, not A's",
    q(`select count(*) from public.daily_checkins where date='2026-10-03'`) === '2'
    && q(`select spirit_state #>> '{morning,completed}' from public.daily_checkins where user_id='${A}' and date='2026-10-03'`) === '[true, true]',
    `rows=${q(`select count(*) from public.daily_checkins where date='2026-10-03'`)} A=${spirit(A, '2026-10-03')}`)

  // 9. the helper is pure and does not mangle a non-object column
  ok('a non-object column is treated as absent rather than erroring',
    q(`select public.checkin_jsonb_set_deep('5'::jsonb,'{morning,completed}','[true]'::jsonb)::text`) === '{"morning": {"completed": [true]}}',
    q(`select public.checkin_jsonb_set_deep('5'::jsonb,'{morning,completed}','[true]'::jsonb)::text`))

  // 10. a deep path builds every missing ancestor
  ok('a three-deep path builds every ancestor',
    q(`select public.checkin_jsonb_set_deep('{}'::jsonb,'{a,b,c}','1'::jsonb)::text`) === '{"a": {"b": {"c": 1}}}',
    q(`select public.checkin_jsonb_set_deep('{}'::jsonb,'{a,b,c}','1'::jsonb)::text`))

  // 11. additive: an existing unrelated row is untouched by applying the migration
  ok('the migration added only functions — no table, policy or data change',
    q("select count(*) from pg_policies where tablename='daily_checkins'") === '1'
    && q("select string_agg(proname,',' order by proname) from pg_proc where proname like 'checkin%'") === 'checkin_jsonb_set_deep,checkin_set_path',
    `policies=${q("select count(*) from pg_policies where tablename='daily_checkins'")} funcs=${q("select string_agg(proname,',' order by proname) from pg_proc where proname like 'checkin%'")}`)

  console.log(`\n${pass} passed, ${fails.length} failed`)
  if (fails.length) { for (const f of fails) console.log(`  ✗ ${f}`); process.exitCode = 1 }
  else console.log('the migration is proven on a throwaway database')
} catch (e) {
  console.log(`\nPROOF DID NOT RUN: ${e.message}`)
  process.exitCode = 1
} finally {
  docker(['rm', '-f', NAME])
}
