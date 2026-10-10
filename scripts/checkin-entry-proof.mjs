#!/usr/bin/env node
// ── Check-in entry-guard proof (FOR-231 v3) ─────────────────────────────────
// 20261009_checkin_patch_requires_entry.sql changes what `checkin_patch`
// accepts, so it is proven on a throwaway database before anyone applies it:
// the Supabase image, its own container, no published port, removed afterwards.
//
// It applies 20261003_checkin_set_path.sql first (what production has), then
// the migration under proof, and checks the rule, the paths it leaves alone,
// the rule under a held row lock, RLS, grants, that nothing else moved, and
// that the revert in the header puts the 2026-10-03 body back exactly.
//
//   npm run proof:checkin-entry        (needs Docker)
//
// It is a separate file from scripts/checkin-db-proof.mjs on purpose: that one
// proves the 2026-10-03 migration on its own, and one of its cases (a tick on a
// missing row creates the row) is behaviour this migration deliberately ends.
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
// CHECKIN_PROOF_IMAGE runs it on another image, e.g. production's Postgres 17.
const IMAGE = process.env.CHECKIN_PROOF_IMAGE || 'supabase/postgres:15.8.1.060'
const NAME = `checkin-entry-proof-${process.pid}`
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

const BASE = 'supabase/migrations/20261003_checkin_set_path.sql'
// CHECKIN_ENTRY_MIG lets the red-first run point this at 20261003 alone.
const MIG = process.env.CHECKIN_ENTRY_MIG || 'supabase/migrations/20261009_checkin_patch_requires_entry.sql'

try {
  if (docker(['version', '--format', '{{.Server.Version}}']).status !== 0) throw new Error('Docker is not running')
  docker(['rm', '-f', NAME])
  const started = docker(['run', '-d', '--name', NAME, '-e', 'POSTGRES_PASSWORD=local-throwaway-proof', IMAGE])
  if (started.status !== 0) throw new Error(`docker run failed: ${String(started.stderr).trim()}`)
  for (let i = 0; i < 90 && q("select to_regprocedure('auth.uid()') is not null") !== 't'; i++) sleep(2000)
  for (let steady = 0, i = 0; steady < 3 && i < 60; i++) { steady = q('select 1') === '1' ? steady + 1 : 0; sleep(2000) }
  if (q("select to_regprocedure('auth.uid()') is not null") !== 't') throw new Error('database never became ready')
  console.log(`database ready: ${q('select version()').slice(0, 40)}\n`)

  // the table and policy exactly as migration-003 creates them
  apply(read('src/utils/supabase/migration-003.sql').replace(/ALTER TABLE user_profiles[\s\S]*?mission_data JSONB;/, '')
    .replace(/-- Also ensure user_profiles RLS exists[\s\S]*$/, ''), 'daily_checkins')
  apply('GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_checkins TO authenticated;', 'grants')

  const A = '11111111-1111-1111-1111-111111111111'
  const B = '22222222-2222-2222-2222-222222222222'
  const C = '33333333-3333-3333-3333-333333333333'
  apply(`INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
           ('${A}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','a@example.test'),
           ('${B}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','b@example.test'),
           ('${C}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','c@example.test')
         ON CONFLICT (id) DO NOTHING;`, 'the athletes')

  // What production has today.
  apply(read(BASE), BASE)
  const FN_BODY_Q = "select md5(pg_get_functiondef('public.checkin_patch(date,text,jsonb)'::regprocedure))"
  const baseBody = q(FN_BODY_Q)
  // Printed so the bodies can be compared with production's pg_proc.
  console.log(`20261003 body md5s: ${q("select string_agg(proname||'='||md5(pg_get_functiondef(oid)), ' ' order by proname) from pg_proc where proname like 'checkin%'")}`)
  const GRANTS_Q = `select coalesce(string_agg(routine_name||'>'||grantee, ',' order by routine_name, grantee), '') from information_schema.role_routine_grants
        where routine_schema='public' and routine_name like 'checkin%' and privilege_type='EXECUTE' and grantee <> 'postgres'`
  const baseGrants = q(GRANTS_Q)

  // A bystander row that never calls the function, fingerprinted before.
  apply(`INSERT INTO public.daily_checkins (user_id, date, mind_state, spirit_state)
         VALUES ('${C}','2026-09-01','{"objectives":["untouched"]}','{"morning":{"date":"2026-09-01","completed":[true]}}');`, 'the bystander row')
  const SCHEMA_Q = `select md5(string_agg(column_name||':'||data_type||':'||is_nullable||':'||coalesce(column_default,'-'), ',' order by column_name)) from information_schema.columns where table_name='daily_checkins'`
  const CONSTR_Q = `select md5(coalesce(string_agg(conname||':'||pg_get_constraintdef(oid), ',' order by conname),'-')) from pg_constraint where conrelid='public.daily_checkins'::regclass`
  const INDEX_Q = `select md5(coalesce(string_agg(indexname||':'||indexdef, ',' order by indexname),'-')) from pg_indexes where tablename='daily_checkins'`
  const POLICY_Q = "select md5(string_agg(policyname||':'||cmd||':'||coalesce(qual,'-')||':'||coalesce(with_check,'-')||':'||coalesce(array_to_string(roles,'+'),'-'), ',' order by policyname)) from pg_policies where tablename='daily_checkins'"
  const ROWS_Q = `select md5(coalesce(string_agg(user_id::text||date::text||coalesce(mind_state::text,'-')||coalesce(spirit_state::text,'-')||coalesce(updated_at::text,'-'), ',' order by user_id, date),'-')) from public.daily_checkins`
  // RLS ON/FORCED is part of the fingerprint (Codex draft pass 1): the policy
  // hash alone does not see `ALTER TABLE ... DISABLE ROW LEVEL SECURITY`.
  const RLS_Q = "select relrowsecurity::text||'/'||relforcerowsecurity::text from pg_class where oid='public.daily_checkins'::regclass"
  const before = { schema: q(SCHEMA_Q), constr: q(CONSTR_Q), index: q(INDEX_Q), policy: q(POLICY_Q), rls: q(RLS_Q), rows: q(ROWS_Q) }
  if (before.rls !== 'true/false') throw new Error(`the table under proof does not have RLS on as production does: ${before.rls}`)
  const fnsBefore = q("select string_agg(proname,',' order by proname) from pg_proc where proname like 'checkin%'")

  apply(read(MIG), MIG)
  ok('the migration applies on top of 20261003', true, 'applied')
  ok('it touched no row, and no schema, constraint, index or policy',
    q(SCHEMA_Q) === before.schema && q(CONSTR_Q) === before.constr && q(INDEX_Q) === before.index
    && q(POLICY_Q) === before.policy && q(RLS_Q) === before.rls && q(ROWS_Q) === before.rows, 'a fingerprint moved')
  apply(read(MIG), `${MIG} a second time`)
  ok('it applies a second time (idempotent)', true, 'applied twice')
  ok('it added exactly two functions',
    q("select string_agg(proname,',' order by proname) from pg_proc where proname like 'checkin%'")
      === 'checkin_jsonb_apply,checkin_jsonb_set_deep,checkin_patch,checkin_patch_needs_entry,checkin_require_entry,checkin_set_path'
    && fnsBefore === 'checkin_jsonb_apply,checkin_jsonb_set_deep,checkin_patch,checkin_set_path',
    q("select string_agg(proname,',' order by proname) from pg_proc where proname like 'checkin%'"))
  ok('checkin_patch is still SECURITY INVOKER',
    q("select prosecdef from pg_proc where oid='public.checkin_patch(date,text,jsonb)'::regprocedure") === 'f', 'definer')
  ok('and its body changed', q(FN_BODY_Q) !== baseBody, 'same body')

  // As the athlete: the authenticated role with a jwt sub, so RLS is live.
  // VERBOSITY verbose puts the SQLSTATE in front of every error message.
  const asUser = (uid, sql) => {
    const r = docker(['exec', '-i', NAME, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-tA'], {
      input: `\\set VERBOSITY verbose\nbegin; set local role authenticated; set local "request.jwt.claim.sub" = '${uid}';\n${sql}\ncommit;`,
    })
    return { out: (r.stdout || '').trim(), err: (r.stderr || '').trim(), status: r.status }
  }
  const refusedCK = (r) => r.status !== 0 && /ERROR:\s+CK001:/.test(r.err)
  const spirit = (uid, d) => q(`select coalesce(spirit_state::text,'(null)') from public.daily_checkins where user_id='${uid}' and date='${d}'`)
  const rowCount = (uid, d) => q(`select count(*) from public.daily_checkins where user_id='${uid}' and date='${d}'`)
  const entry = (d) => `{"date":"${d}","protocol":{"theme":"t","steps":[{},{}]},"completed":[false,false],"gratitude":["","",""]}`
  const tick = (d, flags = '[true,false]') => `select public.checkin_patch('${d}','spirit_state','[{"path":["morning","completed"],"value":${flags}}]'::jsonb);`

  // ── the paths the rule leaves alone ───────────────────────────────────────
  const gen = asUser(A, `select public.checkin_patch('2026-10-10','spirit_state','[{"path":["morning"],"value":${entry('2026-10-10')}}]'::jsonb);`)
  ok('{morning} whole on a missing row still inserts it (generation), with the entry it was given',
    // The WHOLE stored entry equals the one sent (Codex draft pass 2, P3): a
    // branch that dropped protocol.steps would pass a theme-and-date check.
    gen.status === 0 && q(`select (spirit_state -> 'morning') = '${entry('2026-10-10')}'::jsonb from public.daily_checkins where user_id='${A}' and date='2026-10-10'`) === 't',
    gen.err.slice(0, 120) || spirit(A, '2026-10-10'))
  const goals = asUser(A, `select public.checkin_patch('2026-10-11','mind_state','[{"path":["objectives"],"value":["x"]},{"path":["completedObjectives"],"value":[false]}]'::jsonb);`)
  ok('a mind_state write on a missing row still inserts it, with the values it was given',
    goals.status === 0 && q(`select mind_state::text from public.daily_checkins where user_id='${A}' and date='2026-10-11'`) === '{"objectives": ["x"], "completedObjectives": [false]}',
    goals.err.slice(0, 120) || q(`select mind_state::text from public.daily_checkins where user_id='${A}' and date='2026-10-11'`))
  const other = asUser(A, `select public.checkin_patch('2026-10-12','spirit_state','[{"path":["evening","rating"],"value":3}]'::jsonb);`)
  ok('a spirit_state sub-path outside morning still upserts, with its value',
    other.status === 0 && spirit(A, '2026-10-12') === '{"evening": {"rating": 3}}', other.err.slice(0, 120) || spirit(A, '2026-10-12'))
  // ...and on an EXISTING row, every untouched key survives each of them.
  const m2 = asUser(A, `select public.checkin_patch('2026-10-10','mind_state','[{"path":["objectives"],"value":["y"]},{"path":["completedObjectives"],"value":[true]}]'::jsonb);`)
  const e2 = asUser(A, `select public.checkin_patch('2026-10-10','spirit_state','[{"path":["evening","rating"],"value":5}]'::jsonb);`)
  ok('on an existing row, a mind_state write and a non-morning spirit write land and leave the morning entry whole',
    m2.status === 0 && e2.status === 0
    && q(`select mind_state::text from public.daily_checkins where user_id='${A}' and date='2026-10-10'`) === '{"objectives": ["y"], "completedObjectives": [true]}'
    && q(`select (spirit_state #>> '{evening,rating}') || ' ' || (spirit_state #>> '{morning,protocol,theme}') || ' ' || (spirit_state #>> '{morning,completed}') from public.daily_checkins where user_id='${A}' and date='2026-10-10'`) === '5 t [false, false]',
    `${m2.err.slice(0, 80)} ${e2.err.slice(0, 80)} ${spirit(A, '2026-10-10')}`)

  // ── the rule: a sub-path lands on that day's entry ────────────────────────
  const t1 = asUser(A, tick('2026-10-10'))
  ok('a tick onto the row\'s own entry lands', t1.status === 0
    && q(`select spirit_state #>> '{morning,completed}' from public.daily_checkins where user_id='${A}' and date='2026-10-10'`) === '[true, false]', t1.err.slice(0, 120))
  const g1 = asUser(A, `select public.checkin_patch('2026-10-10','spirit_state','[{"path":["morning","gratitude"],"value":["a","",""]}]'::jsonb);`)
  ok('a gratitude write onto it lands and keeps the tick', g1.status === 0
    && q(`select (spirit_state #>> '{morning,completed}') || ' | ' || (spirit_state #>> '{morning,gratitude}') || ' | ' || (spirit_state #>> '{morning,protocol,theme}') from public.daily_checkins where user_id='${A}' and date='2026-10-10'`)
       === '[true, false] | ["a", "", ""] | t', spirit(A, '2026-10-10'))

  const t2 = asUser(A, tick('2026-10-13'))
  ok('a tick on a MISSING row is refused with CK001', refusedCK(t2), t2.err.slice(0, 160) || 'no error')
  ok('and it created no row', rowCount(A, '2026-10-13') === '0', rowCount(A, '2026-10-13'))
  const gMissing = asUser(A, `select public.checkin_patch('2026-10-13','spirit_state','[{"path":["morning","gratitude"],"value":["lost?","",""]}]'::jsonb);`)
  ok('a gratitude write on a missing row is refused with CK001 — a failure the screen can report, not a silent return', refusedCK(gMissing), gMissing.err.slice(0, 160) || 'no error')
  const wrapper = asUser(A, `select public.checkin_set_path('2026-10-13','spirit_state','{morning,completed}','[true]'::jsonb);`)
  ok('the single-patch wrapper inherits the rule', refusedCK(wrapper) && rowCount(A, '2026-10-13') === '0', wrapper.err.slice(0, 160) || 'no error')

  const rowsNow = () => q(`select spirit_state::text from public.daily_checkins where user_id='${A}' and date='2026-10-11'`)
  const noMorning = rowsNow()
  const t3 = asUser(A, tick('2026-10-11'))
  ok('a tick on a row with no morning key is refused with CK001', refusedCK(t3), t3.err.slice(0, 160) || 'no error')
  ok('and the row is unchanged', rowsNow() === noMorning, rowsNow())

  apply(`UPDATE public.daily_checkins SET spirit_state='{"morning":{"date":"2026-10-11","completed":[false]}}' WHERE user_id='${A}' AND date='2026-10-11';`, 'an entry with no protocol')
  const t4 = asUser(A, tick('2026-10-11'))
  ok('a tick onto a morning with no protocol (the orphan shape) is refused', refusedCK(t4), t4.err.slice(0, 160) || 'no error')
  ok('and the orphan is not extended', spirit(A, '2026-10-11') === '{"morning": {"date": "2026-10-11", "completed": [false]}}', spirit(A, '2026-10-11'))

  // THE PRE-FIX ROW: keyed on the calendar day, carrying the cutoff day.
  apply(`INSERT INTO public.daily_checkins (user_id, date, spirit_state) VALUES ('${A}','2026-10-15','{"morning":${entry('2026-10-14')}}');`, 'a pre-fix row')
  const prefix = spirit(A, '2026-10-15')
  const t5 = asUser(A, tick('2026-10-15'))
  ok("a tick onto a row whose entry is ANOTHER day's is refused", refusedCK(t5), t5.err.slice(0, 160) || 'no error')
  ok('and the pre-fix row is unchanged', spirit(A, '2026-10-15') === prefix, spirit(A, '2026-10-15'))

  // THE 4AM CROSSING, at the database: the protocol is in day D's row; a tick
  // addressed to D+1 (todayKey recomputed after 4am) cannot land anywhere.
  apply(`INSERT INTO public.daily_checkins (user_id, date, mind_state) VALUES ('${A}','2026-10-17','{"objectives":["o"]}');`, 'the next day, objectives only')
  const d17 = q(`select coalesce(spirit_state::text,'(null)') from public.daily_checkins where user_id='${A}' and date='2026-10-17'`)
  apply(`INSERT INTO public.daily_checkins (user_id, date, spirit_state) VALUES ('${A}','2026-10-16','{"morning":${entry('2026-10-16')}}');`, 'day D')
  const cross = asUser(A, tick('2026-10-17'))
  ok('a tick addressed to the NEXT day after the cutoff is refused there', refusedCK(cross), cross.err.slice(0, 160) || 'no error')
  ok('the next day\'s row gains no orphan', q(`select coalesce(spirit_state::text,'(null)') from public.daily_checkins where user_id='${A}' and date='2026-10-17'`) === d17, q(`select coalesce(spirit_state::text,'(null)') from public.daily_checkins where user_id='${A}' and date='2026-10-17'`))
  const onD = asUser(A, tick('2026-10-16'))
  ok('and the same tick addressed to the protocol\'s own day lands', onD.status === 0
    && q(`select spirit_state #>> '{morning,completed}' from public.daily_checkins where user_id='${A}' and date='2026-10-16'`) === '[true, false]', onD.err.slice(0, 120))

  const mixed = asUser(A, `select public.checkin_patch('2026-10-18','spirit_state','[{"path":["morning"],"value":${entry('2026-10-18')}},{"path":["morning","completed"],"value":[true,true]}]'::jsonb);`)
  ok('a list mixing {morning} whole with a sub-path is judged before it applies, and refused on a row with no entry', refusedCK(mixed) && rowCount(A, '2026-10-18') === '0', mixed.err.slice(0, 160) || 'no error')

  const bad = asUser(A, `select public.checkin_patch('2026-10-16','spirit_state','[{"path":["morning",1],"value":2}]'::jsonb);`)
  ok('a malformed sub-path on a good entry is still refused by the 20261003 validation', bad.status !== 0 && /every key in a path must be a string/.test(bad.err), bad.err.slice(0, 160))

  // ── THE DATE COMPARISON (Codex draft pass 1) ──────────────────────────────
  // to_char() returned NULL for infinity (so a missing entry date matched),
  // dropped the BC era, and went through timestamptz. Each is a case now.
  apply(`INSERT INTO public.daily_checkins (user_id, date, spirit_state) VALUES ('${A}','infinity','{"morning":{"protocol":{"theme":"t"},"completed":[false]}}');`, 'an infinity row with no entry date')
  const inf = asUser(A, tick('infinity'))
  ok("an 'infinity' row whose entry has no date is refused", refusedCK(inf), inf.err.slice(0, 160) || 'landed')
  apply(`INSERT INTO public.daily_checkins (user_id, date, spirit_state) VALUES ('${A}','2026-10-22 BC','{"morning":${entry('2026-10-22')}}');`, 'a BC row')
  const bc = asUser(A, tick('2026-10-22 BC'))
  ok('a BC row is refused even though its entry says the AD day of the same digits', refusedCK(bc), bc.err.slice(0, 160) || 'landed')
  apply(`INSERT INTO public.daily_checkins (user_id, date, spirit_state) VALUES ('${A}','2026-10-23','{"morning":{"date":20261023,"protocol":{"theme":"t"},"completed":[false]}}');`, 'a numeric entry date')
  const numDate = asUser(A, tick('2026-10-23'))
  ok('an entry date that is a JSON number, not a string, is refused', refusedCK(numDate), numDate.err.slice(0, 160) || 'landed')
  apply(`INSERT INTO public.daily_checkins (user_id, date, spirit_state) VALUES ('${A}','2011-12-30','{"morning":${entry('2011-12-30')}}');`, 'the day Samoa skipped')
  const apia = asUser(A, `set local timezone = 'Pacific/Apia'; set local datestyle = 'German, DMY';
${tick('2011-12-30')}`)
  ok('a matching entry lands whatever the session time zone and DateStyle (Pacific/Apia on the day it skipped, German)',
    apia.status === 0 && q(`select spirit_state #>> '{morning,completed}' from public.daily_checkins where user_id='${A}' and date='2011-12-30'`) === '[true, false]',
    apia.err.slice(0, 160) || spirit(A, '2011-12-30'))
  ok('and the helper is still IMMUTABLE, which is now honest: it reads only the date\'s own fields',
    q("select provolatile from pg_proc where oid='public.checkin_require_entry(jsonb,date)'::regprocedure") === 'i', 'not immutable')

  // ── RLS ───────────────────────────────────────────────────────────────────
  const aRow = spirit(A, '2026-10-10')
  const bTick = asUser(B, tick('2026-10-10', '[false,false]'))
  ok("B's tick on a date where only A has an entry is refused — B has no row", refusedCK(bTick), bTick.err.slice(0, 160) || 'no error')
  ok("and A's row is untouched", spirit(A, '2026-10-10') === aRow, spirit(A, '2026-10-10'))
  // That case holds because the function addresses the row by auth.uid(),
  // whatever RLS does (Codex draft pass 1). RLS itself is checked directly:
  // still on, and B reaching for A's row by hand gets nothing.
  ok('row-level security is still ON for daily_checkins after the migration', q(RLS_Q) === 'true/false', q(RLS_Q))
  const bSees = asUser(B, `select count(*) from public.daily_checkins where user_id='${A}';`)
  ok("B cannot see A's rows", bSees.out.split(/\r?\n/).map((l) => l.trim()).includes('0'), bSees.out)
  const bUpd = asUser(B, `update public.daily_checkins set spirit_state='{"hacked":true}' where user_id='${A}';`)
  ok("B's direct UPDATE of A's rows touches none of them", /UPDATE 0/.test(bUpd.out) && !q(`select string_agg(coalesce(spirit_state::text,''), ',') from public.daily_checkins where user_id='${A}'`).includes('hacked'),
    bUpd.out || bUpd.err.slice(0, 120))

  // ── under a held row lock ─────────────────────────────────────────────────
  // The check sits in the UPDATE's SET. Session 1 removes the entry and HOLDS
  // the lock; session 2 ticks. Session 2 must wait, then judge the row as
  // session 1 left it — refused — not as it was when it started.
  const bg = (uid, sql) => {
    const c = spawn('docker', ['exec', '-i', NAME, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-tA'], { stdio: ['pipe', 'pipe', 'pipe'] })
    c.stdin.end(`\\set VERBOSITY verbose\nbegin; set local role authenticated; set local "request.jwt.claim.sub" = '${uid}';\n${sql}\ncommit;`)
    return new Promise((res) => { let e = ''; c.stderr.on('data', (d) => { e += d }); c.on('close', (code) => res({ code, e })) })
  }
  // Wait until the holder is ACTUALLY asleep inside its transaction, holding
  // the row lock — a fixed sleep raced docker exec start-up on the first run.
  // The tick is OBSERVED blocked by the holder's pid while the holder sleeps,
  // rather than inferred from elapsed time (Codex draft pass 1): elapsed time
  // includes docker start-up, so a tick that reached Postgres after the holder
  // released would also have "waited".
  const blockedByHolder = () => {
    for (let i = 0; i < 40; i++) {
      const n = q(`select count(*) from pg_stat_activity w
                    join pg_stat_activity h on h.pid = any(pg_blocking_pids(w.pid))
                   where w.query like '%"morning","completed"%'
                     and h.query like '%pg_sleep(3)%'`)
      if (Number(n) > 0) return true
      sleep(50)
    }
    return false
  }
  const holderAsleep = () => {
    for (let i = 0; i < 100; i++) {
      if (q("select count(*) from pg_stat_activity where query like '%pg_sleep(3)%' and wait_event = 'PgSleep'") === '1') return true
      sleep(100)
    }
    return false
  }
  apply(`INSERT INTO public.daily_checkins (user_id, date, spirit_state) VALUES ('${A}','2026-10-20','{"morning":${entry('2026-10-20')}}');`, 'lock case 1')
  const removing = bg(A, `select public.checkin_patch('2026-10-20','spirit_state','[{"path":["morning"],"value":null}]'::jsonb);\nselect pg_sleep(3);`)
  ok('the holder is asleep holding the lock before the tick starts', holderAsleep(), 'never seen asleep')
  let t0 = Date.now()
  const blockedTickP = bg(A, tick('2026-10-20'))
  ok('the tick is seen BLOCKED by the holder, by pid, while the holder still sleeps', blockedByHolder(), 'never seen blocked')
  const blockedTick = await blockedTickP
  let waited = Date.now() - t0
  const removed = await removing
  ok('the holding session succeeded', removed.code === 0, removed.e.slice(0, 120))
  ok('the tick WAITED on the lock', waited > 1000, `${waited}ms`)
  ok('and was then refused against the row as the holder left it', blockedTick.code !== 0 && /CK001/.test(blockedTick.e), blockedTick.e.slice(0, 160) || 'landed')
  ok('the row holds no orphan flags', q(`select spirit_state::text from public.daily_checkins where user_id='${A}' and date='2026-10-20'`) === '{"morning": null}',
    q(`select spirit_state::text from public.daily_checkins where user_id='${A}' and date='2026-10-20'`))

  // The converse: the row exists with no entry; session 1 writes the entry and
  // holds; the tick waits and then LANDS on it.
  apply(`INSERT INTO public.daily_checkins (user_id, date, mind_state) VALUES ('${A}','2026-10-21','{"objectives":["o"]}');`, 'lock case 2')
  const writing = bg(A, `select public.checkin_patch('2026-10-21','spirit_state','[{"path":["morning"],"value":${entry('2026-10-21')}}]'::jsonb);\nselect pg_sleep(3);`)
  ok('the holder is asleep holding the lock before the tick starts', holderAsleep(), 'never seen asleep')
  t0 = Date.now()
  const lateTickP = bg(A, tick('2026-10-21'))
  ok('the tick is seen BLOCKED by the holder, by pid, while the holder still sleeps', blockedByHolder(), 'never seen blocked')
  const lateTick = await lateTickP
  waited = Date.now() - t0
  const wrote = await writing
  ok('the entry-writing session succeeded', wrote.code === 0, wrote.e.slice(0, 120))
  ok('the tick WAITED on the lock', waited > 1000, `${waited}ms`)
  ok('and then landed on the entry the holder wrote', lateTick.code === 0
    && q(`select spirit_state #>> '{morning,completed}' from public.daily_checkins where user_id='${A}' and date='2026-10-21'`) === '[true, false]',
    lateTick.e.slice(0, 160) || spirit(A, '2026-10-21'))

  // ── grants ────────────────────────────────────────────────────────────────
  for (const fn of ['public.checkin_patch(date,text,jsonb)', 'public.checkin_patch_needs_entry(text,jsonb)', 'public.checkin_require_entry(jsonb,date)']) {
    ok(`anon cannot execute ${fn.split('(')[0].replace('public.', '')}`, q(`select has_function_privilege('anon', '${fn}', 'EXECUTE')`) === 'f', 'anon can')
    ok(`authenticated can execute ${fn.split('(')[0].replace('public.', '')}`, q(`select has_function_privilege('authenticated', '${fn}', 'EXECUTE')`) === 't', 'authenticated cannot')
  }
  const GRANTEES_Q = `select coalesce(string_agg(distinct grantee, ',' order by grantee), '') from information_schema.role_routine_grants
        where routine_schema='public' and routine_name like 'checkin%' and privilege_type='EXECUTE' and grantee <> 'postgres'`
  ok('the EXECUTE grantees are exactly authenticated and service_role', q(GRANTEES_Q) === 'authenticated,service_role', q(GRANTEES_Q))

  // ── nothing else moved ────────────────────────────────────────────────────
  ok('the schema, constraints, indexes and policies are unchanged',
    q(SCHEMA_Q) === before.schema && q(CONSTR_Q) === before.constr && q(INDEX_Q) === before.index && q(POLICY_Q) === before.policy && q(RLS_Q) === before.rls, 'a fingerprint moved')
  ok('the bystander row is unchanged',
    q(`select spirit_state::text from public.daily_checkins where user_id='${C}'`) === '{"morning": {"date": "2026-09-01", "completed": [true]}}',
    q(`select spirit_state::text from public.daily_checkins where user_id='${C}'`))

  // ── the revert in the header, exactly ─────────────────────────────────────
  apply(read(BASE), 'revert step 1: re-apply 20261003')
  apply(`DROP FUNCTION IF EXISTS public.checkin_require_entry(jsonb, date);
         DROP FUNCTION IF EXISTS public.checkin_patch_needs_entry(text, jsonb);`, 'revert step 2')
  ok('the revert puts checkin_patch back to the 2026-10-03 body, byte for byte', q(FN_BODY_Q) === baseBody, `${q(FN_BODY_Q)} vs ${baseBody}`)
  ok('and the 2026-10-03 function set and grants', q("select string_agg(proname,',' order by proname) from pg_proc where proname like 'checkin%'") === fnsBefore
    && q(GRANTS_Q) === baseGrants, q(GRANTS_Q))
  const old = asUser(A, tick('2026-10-30'))
  ok('and the old behaviour is back: a tick on a missing row inserts it', old.status === 0 && rowCount(A, '2026-10-30') === '1', old.err.slice(0, 120))
  ok('the revert moved no schema, constraint, index or policy',
    q(SCHEMA_Q) === before.schema && q(CONSTR_Q) === before.constr && q(INDEX_Q) === before.index && q(POLICY_Q) === before.policy && q(RLS_Q) === before.rls, 'a fingerprint moved')

  console.log(`\n${pass} passed, ${fails.length} failed`)
  if (fails.length) { for (const f of fails) console.log(`  ✗ ${f}`); process.exitCode = 1 }
  else console.log('the migration is proven on a throwaway database')
} catch (e) {
  console.log(`\nPROOF DID NOT RUN: ${e.message}`)
  process.exitCode = 1
} finally {
  docker(['rm', '-f', NAME])
}
