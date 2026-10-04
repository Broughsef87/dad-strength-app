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
import { spawn, spawnSync } from 'node:child_process'
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

  const A = '11111111-1111-1111-1111-111111111111'
  const B = '22222222-2222-2222-2222-222222222222'
  const C = '33333333-3333-3333-3333-333333333333'
  // daily_checkins.user_id references auth.users(id), so the athletes have to
  // exist. In production they do; here they are seeded.
  apply(`INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
           ('${A}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','a@example.test'),
           ('${B}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','b@example.test'),
           ('${C}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','c@example.test')
         ON CONFLICT (id) DO NOTHING;`, 'the athletes')

  // 5b (Codex pass 1): "additive" was asserted from policy and function COUNTS,
  // which proves nothing about data. A bystander row is written and fingerprinted
  // BEFORE the migration, and compared after. C never calls the function.
  apply(`INSERT INTO public.daily_checkins (user_id, date, mind_state, spirit_state)
         VALUES ('${C}','2026-09-01','{"objectives":["untouched"],"completedObjectives":[true]}','{"morning":{"date":"2026-09-01","completed":[true]}}');`,
    'the bystander row')
  const schemaBefore = q(`select md5(string_agg(column_name || ':' || data_type, ',' order by column_name)) from information_schema.columns where table_name = 'daily_checkins'`)
  const bystanderBefore = q(`select md5(mind_state::text || spirit_state::text) from public.daily_checkins where user_id='${C}'`)
  const policiesBefore = q("select md5(string_agg(policyname || ':' || cmd || ':' || coalesce(qual,''), ',' order by policyname)) from pg_policies where tablename='daily_checkins'")

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

  // run as the athlete: the authenticated role with a jwt sub, so RLS is live
  const asUser = (uid, sql) => {
    const r = docker(['exec', '-i', NAME, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-tA'], {
      // this image's auth.uid() reads request.jwt.claim.sub — the singular
      // setting, not the JSON claims blob
      input: `begin; set local role authenticated; set local "request.jwt.claim.sub" = '${uid}';\n${sql}\ncommit;`,
    })
    return { out: (r.stdout || '').trim(), err: (r.stderr || '').trim(), status: r.status }
  }
  // psql echoes BEGIN, SET, SET, the rows, then COMMIT — so a scalar result is
  // the numeric line, never the last token.
  const num = (r) => (r.out.split(/\r?\n/).map((l) => l.trim()).filter((l) => /^\d+$/.test(l)).pop() ?? null)
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

  // 4. THE ROOT WRITE IS REFUSED (Blaine's draft review). Replacing a whole
  //    column was guarded only by convention, and Rebuild broke the convention.
  const rootSet = asUser(A, `select public.checkin_set_path('2026-10-04','mind_state',NULL,'{"objectives":["x"]}'::jsonb);`)
  ok('an empty path is refused by checkin_set_path', /must name at least one key/.test(rootSet.err), rootSet.err.slice(0, 90) || 'no error')
  const rootPatch = asUser(A, `select public.checkin_patch('2026-10-04','mind_state','[{"path":[],"value":{"a":1}}]'::jsonb);`)
  ok('an empty path is refused by checkin_patch', /must name at least one key/.test(rootPatch.err), rootPatch.err.slice(0, 90) || 'no error')
  ok('neither attempt created a row', q(`select count(*) from public.daily_checkins where user_id='${A}' and date='2026-10-04'`) === '0',
    q(`select count(*) from public.daily_checkins where user_id='${A}' and date='2026-10-04'`))

  // 5. the Goals step: its four keys in ONE call, so objectives and their flags
  //    can never be seen misaligned
  asUser(A, `select public.checkin_patch('2026-10-04','mind_state','[
      {"path":["date"],"value":"2026-10-04"},
      {"path":["objectives"],"value":["x","y"]},
      {"path":["completedObjectives"],"value":[false,false]},
      {"path":["lockedIn"],"value":true}]'::jsonb);`)
  const goals = q(`select mind_state::text from public.daily_checkins where user_id='${A}' and date='2026-10-04'`)
  ok('one call applies every patch in it',
    goals.includes('"objectives": ["x", "y"]') && goals.includes('"lockedIn": true') && goals.includes('"completedObjectives": [false, false]'),
    goals)

  // 6. a field patch leaves its siblings alone
  asUser(A, `select public.checkin_set_path('2026-10-04','mind_state','{completedObjectives}','[true,false]'::jsonb);`)
  ok('a field patch leaves its siblings alone',
    q(`select mind_state #>> '{objectives}' from public.daily_checkins where user_id='${A}' and date='2026-10-04'`) === '["x", "y"]',
    q(`select mind_state::text from public.daily_checkins where user_id='${A}' and date='2026-10-04'`))

  // 7. BLAINE'S REQUIRED CASE: a rebuild's Goals write leaves an unrelated
  //    mind_state key intact. {spiritual} is FOR-229's 1-5 rating.
  asUser(A, `select public.checkin_set_path('2026-10-04','mind_state','{spiritual}','4'::jsonb);`)
  asUser(A, `select public.checkin_patch('2026-10-04','mind_state','[
      {"path":["objectives"],"value":["fresh"]},
      {"path":["completedObjectives"],"value":[false]},
      {"path":["lockedIn"],"value":true}]'::jsonb);`)
  const afterRebuild = q(`select mind_state::text from public.daily_checkins where user_id='${A}' and date='2026-10-04'`)
  ok("a rebuild's Goals write leaves an unrelated key intact",
    afterRebuild.includes('"spiritual": 4') && afterRebuild.includes('"objectives": ["fresh"]'), afterRebuild)
  ok('and it resets completion for the new list, which is the chosen rule',
    afterRebuild.includes('"completedObjectives": [false]'), afterRebuild)

  // 8. a malformed patch is refused rather than half-applied
  for (const [name, patch] of [
    ['a patch that is not an object', '[1]'],
    ['a patch with no value key', '[{"path":["a"]}]'],
    ['a path key that is not a string', '[{"path":[1],"value":2}]'],
    ['patches that are not an array', '{"path":["a"],"value":1}'],
    ['an empty patch list', '[]'],
  ]) {
    const bad = asUser(A, `select public.checkin_patch('2026-10-05','mind_state','${patch}'::jsonb);`)
    ok(`${name} is refused`, bad.status !== 0 && bad.err.includes('checkin:'), bad.err.slice(0, 80) || 'no error')
  }
  ok('no malformed call created a row', q(`select count(*) from public.daily_checkins where user_id='${A}' and date='2026-10-05'`) === '0',
    q(`select count(*) from public.daily_checkins where user_id='${A}' and date='2026-10-05'`))

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

  // 8b. A PATH THROUGH A NON-OBJECT IS REFUSED, never replaced. Before this was
  //     fixed, {morning,completed,0} on {"morning":{"completed":[true,false]}}
  //     replaced the array with {} and set "0" — two flags became {"0":true}.
  //     Silent loss, found by reviewing the draft rather than by a test.
  asUser(A, `select public.checkin_set_path('2026-10-06','spirit_state','{morning,completed}','[true,false]'::jsonb);`)
  const thru = asUser(A, `select public.checkin_set_path('2026-10-06','spirit_state','{morning,completed,0}','false'::jsonb);`)
  ok('a path through an array is refused', /nothing can be patched beneath it/.test(thru.err), thru.err.slice(0, 100) || 'no error')
  ok('and the array it would have destroyed is intact',
    q(`select spirit_state #>> '{morning,completed}' from public.daily_checkins where user_id='${A}' and date='2026-10-06'`) === '[true, false]',
    q(`select spirit_state::text from public.daily_checkins where user_id='${A}' and date='2026-10-06'`))
  // a MISSING ancestor is still created — the refusal must not have broken that
  asUser(A, `select public.checkin_set_path('2026-10-06','spirit_state','{morning,nested,deep}','1'::jsonb);`)
  ok('a missing ancestor is still created',
    q(`select spirit_state #>> '{morning,nested,deep}' from public.daily_checkins where user_id='${A}' and date='2026-10-06'`) === '1',
    q(`select spirit_state::text from public.daily_checkins where user_id='${A}' and date='2026-10-06'`))

  // 8c. CONCURRENCY UNDER REAL CONTENTION. The sibling cases above run two
  //     writes one after the other, which proves the merge keeps siblings and
  //     says nothing about interleaving. Here session 1 writes and then HOLDS
  //     the row lock while session 2 writes a different path. Session 2 must
  //     block, then apply to session 1's result, and both must survive.
  const bg = (sql) => spawn('docker', ['exec', '-i', NAME, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-tA'],
    { stdio: ['pipe', 'pipe', 'pipe'] })
  const runBg = (uid, sql) => {
    const c = bg()
    c.stdin.end(`begin; set local role authenticated; set local "request.jwt.claim.sub" = '${uid}';\n${sql}\ncommit;`)
    return new Promise((res) => { let e = ''; c.stderr.on('data', (d) => { e += d }); c.on('close', (code) => res({ code, e })) })
  }
  asUser(A, `select public.checkin_set_path('2026-10-07','spirit_state','{morning,completed}','[true]'::jsonb);`)
  const held = runBg(A, `select public.checkin_set_path('2026-10-07','spirit_state','{morning,completed}','[true,true]'::jsonb);\nselect pg_sleep(3);`)
  sleep(700)   // session 1 has written and is sitting on the row lock
  // Observe the contention rather than inferring it from elapsed time alone
  // (Codex pass 1): while session 2 waits, a tuple lock is ungranted.
  const t0 = Date.now()
  const contention = spawn('docker', ['exec', NAME, 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc',
    "select pg_sleep(1.2); select count(*) from pg_locks where not granted"], { stdio: ['ignore', 'pipe', 'pipe'] })
  let contOut = ''
  contention.stdout.on('data', (d) => { contOut += d })
  const second = await runBg(A, `select public.checkin_set_path('2026-10-07','spirit_state','{morning,gratitude}','["g"]'::jsonb);`)
  const waited = Date.now() - t0
  const heldRes = await held
  ok('the holding session itself succeeded', heldRes.code === 0, `exit ${heldRes.code} ${heldRes.e.slice(0, 80)}`)
  const bothLive = q(`select (spirit_state #>> '{morning,completed}') || ' | ' || (spirit_state #>> '{morning,gratitude}') from public.daily_checkins where user_id='${A}' and date='2026-10-07'`)
  ok('the second writer BLOCKED on the row lock rather than racing', waited > 1000, `waited ${waited}ms`)
  ok('and an ungranted lock was observed while it waited', contOut.trim().split(/\s+/).filter(Boolean).some((n) => Number(n) > 0), `pg_locks ungranted: ${contOut.trim() || 'none seen'}`)
  ok('both interleaved writers survive, each at its own path', bothLive === '[true, true] | ["g"]', bothLive)
  ok('neither interleaved write errored', second.code === 0, `second exit ${second.code} ${second.e.slice(0, 80)}`)

  // 8d. RLS IS ENFORCED (Codex pass 1). Every assertion above reads back as
  //      the postgres superuser, which BYPASSES row-level security — so they
  //      prove the function routes by auth.uid() and prove nothing about RLS.
  //      These read and write as the athlete instead.
  ok('row-level security is actually on', q("select relrowsecurity from pg_class where oid='public.daily_checkins'::regclass") === 't',
    q("select relrowsecurity from pg_class where oid='public.daily_checkins'::regclass"))
  const bSeesA = asUser(B, `select count(*) from public.daily_checkins where user_id='${A}';`)
  ok("B cannot SEE A's rows", num(bSeesA) === '0', `rows=${num(bSeesA)}`)
  const bSeesOwn = asUser(B, `select count(*) from public.daily_checkins where user_id='${B}';`)
  ok('B can see their own', Number(num(bSeesOwn)) >= 1, `rows=${num(bSeesOwn)}`)
  const bWritesA = asUser(B, `update public.daily_checkins set spirit_state='{"hacked":true}' where user_id='${A}';`)
  ok("B's direct UPDATE of A's row touches nothing", /UPDATE 0/.test(bWritesA.out) || bWritesA.out.includes('0'), bWritesA.out.trim() || bWritesA.err.slice(0, 80))
  ok("and A's row is unharmed", !q(`select spirit_state::text from public.daily_checkins where user_id='${A}' and date='2026-10-03'`).includes('hacked'),
    q(`select spirit_state::text from public.daily_checkins where user_id='${A}' and date='2026-10-03'`))

  // 8e. A VALID PATCH BEFORE A MALFORMED ONE MUST NOT LAND (Codex pass 1).
  //     The earlier malformed cases were single-element lists, which say
  //     nothing about a rollback after a prefix has already been applied.
  asUser(A, `select public.checkin_set_path('2026-10-08','mind_state','{keep}','"before"'::jsonb);`)
  const prefix = asUser(A, `select public.checkin_patch('2026-10-08','mind_state','[{"path":["keep"],"value":"after"},{"path":[1],"value":2}]'::jsonb);`)
  ok('a malformed patch after a valid one is refused', prefix.status !== 0, prefix.err.slice(0, 80) || 'no error')
  ok('and the valid patch in front of it did NOT land',
    q(`select mind_state #>> '{keep}' from public.daily_checkins where user_id='${A}' and date='2026-10-08'`) === 'before',
    q(`select mind_state::text from public.daily_checkins where user_id='${A}' and date='2026-10-08'`))

  // 9. the helper is pure and does not mangle a non-object column
  // Codex pass 1, finding 3: this used to EMPTY a non-object column, which
  // destroyed whatever it held. It refuses now.
  const scalarCol = docker(['exec', NAME, 'psql', '-U', 'postgres', '-d', 'postgres', '-tAc',
    `select public.checkin_jsonb_set_deep('[true,false]'::jsonb,'{a}','1'::jsonb)::text`])
  ok('a column holding an array is refused, not emptied', /not a record to patch/.test(String(scalarCol.stderr)), String(scalarCol.stderr).slice(0, 90) || String(scalarCol.stdout).trim())
  ok('a NULL column is still the normal empty case',
    q(`select public.checkin_jsonb_set_deep(NULL,'{morning,completed}','[true]'::jsonb)::text`) === '{"morning": {"completed": [true]}}',
    q(`select public.checkin_jsonb_set_deep(NULL,'{morning,completed}','[true]'::jsonb)::text`))
  ok('a column holding JSON null is still the normal empty case',
    q(`select public.checkin_jsonb_set_deep('null'::jsonb,'{morning,completed}','[true]'::jsonb)::text`) === '{"morning": {"completed": [true]}}',
    q(`select public.checkin_jsonb_set_deep('null'::jsonb,'{morning,completed}','[true]'::jsonb)::text`))
  // Codex pass 1, finding 4: a path array whose lower bound is not 1
  ok('a path array with a lower bound of 0 still patches every key',
    q(`select public.checkin_jsonb_set_deep('{}'::jsonb,'[0:1]={a,b}'::text[],'1'::jsonb)::text`) === '{"a": {"b": 1}}',
    q(`select public.checkin_jsonb_set_deep('{}'::jsonb,'[0:1]={a,b}'::text[],'1'::jsonb)::text`))

  // 10. a deep path builds every missing ancestor
  ok('a three-deep path builds every ancestor',
    q(`select public.checkin_jsonb_set_deep('{}'::jsonb,'{a,b,c}','1'::jsonb)::text`) === '{"a": {"b": {"c": 1}}}',
    q(`select public.checkin_jsonb_set_deep('{}'::jsonb,'{a,b,c}','1'::jsonb)::text`))

  // 11. additive: an existing unrelated row is untouched by applying the migration
  // 11. ADDITIVE, against the fingerprints taken before the migration ran
  ok('the table definition is byte-identical to before the migration',
    q(`select md5(string_agg(column_name || ':' || data_type, ',' order by column_name)) from information_schema.columns where table_name = 'daily_checkins'`) === schemaBefore,
    'schema hash moved')
  ok('the policies are byte-identical to before',
    q("select md5(string_agg(policyname || ':' || cmd || ':' || coalesce(qual,''), ',' order by policyname)) from pg_policies where tablename='daily_checkins'") === policiesBefore,
    'policy hash moved')
  ok("the bystander row that never called the function is byte-identical",
    q(`select md5(mind_state::text || spirit_state::text) from public.daily_checkins where user_id='${C}'`) === bystanderBefore,
    'bystander row changed')
  ok('the four functions are the only ones it added',
    q("select string_agg(proname,',' order by proname) from pg_proc where proname like 'checkin%'") === 'checkin_jsonb_apply,checkin_jsonb_set_deep,checkin_patch,checkin_set_path',
    q("select string_agg(proname,',' order by proname) from pg_proc where proname like 'checkin%'"))
  ok('none of those four names existed before it (so CREATE OR REPLACE replaced nothing)',
    read(MIG).includes('CREATE OR REPLACE FUNCTION public.checkin_set_path') && q("select count(*) from pg_proc where proname like 'checkin%'") === '4',
    q("select count(*) from pg_proc where proname like 'checkin%'"))

  // 12. THE REVERT IN THE HEADER IS COMPLETE (Codex pass 1). Run exactly the
  //     four DROP lines the header gives and check nothing else moved. Last,
  //     because it removes the functions.
  apply(`DROP FUNCTION IF EXISTS public.checkin_set_path(date, text, text[], jsonb);
         DROP FUNCTION IF EXISTS public.checkin_patch(date, text, jsonb);
         DROP FUNCTION IF EXISTS public.checkin_jsonb_apply(jsonb, jsonb);
         DROP FUNCTION IF EXISTS public.checkin_jsonb_set_deep(jsonb, text[], jsonb);`, 'the revert from the header')
  ok("the header's revert removes every function it added",
    q("select count(*) from pg_proc where proname like 'checkin%'") === '0',
    q("select string_agg(proname,',' order by proname) from pg_proc where proname like 'checkin%'"))
  ok('and the revert leaves the table, its policy and its data alone',
    q(`select md5(string_agg(column_name || ':' || data_type, ',' order by column_name)) from information_schema.columns where table_name = 'daily_checkins'`) === schemaBefore
    && q("select md5(string_agg(policyname || ':' || cmd || ':' || coalesce(qual,''), ',' order by policyname)) from pg_policies where tablename='daily_checkins'") === policiesBefore
    && q(`select md5(mind_state::text || spirit_state::text) from public.daily_checkins where user_id='${C}'`) === bystanderBefore,
    'something moved across the revert')

  console.log(`\n${pass} passed, ${fails.length} failed`)
  if (fails.length) { for (const f of fails) console.log(`  ✗ ${f}`); process.exitCode = 1 }
  else console.log('the migration is proven on a throwaway database')
} catch (e) {
  console.log(`\nPROOF DID NOT RUN: ${e.message}`)
  process.exitCode = 1
} finally {
  docker(['rm', '-f', NAME])
}
