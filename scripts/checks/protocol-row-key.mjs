// ── protocol row key (FOR-228, ruling 2) ─────────────────────────────────────
// MorningProtocol writes each save into daily_checkins.spirit_state. The row
// must be keyed on the protocol's OWN day — the 4am-cutoff key the entry
// carries — never the calendar day. Keyed on the calendar day, a protocol
// finished at 1am landed in the next day's row, and generating that day's
// protocol after 4am overwrote it: a completed protocol gone. Five Codex
// rounds flagged it before the ruling that fixed it.
//
// Its own file, so a revert of the writer cannot take the check with it.
//
//   node --import tsx scripts/checks/protocol-row-key.mjs   (run-all does this)
import { readFileSync } from 'node:fs'
import { localDay, localDayWithCutoff } from '../../src/utils/day.ts'

let checks = 0
const fails = []
const assert = (cond, msg) => { checks++; if (!cond) fails.push(msg) }
const readLF = (u) => readFileSync(new URL(u, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const mp = readLF('../../src/components/MorningProtocol.tsx')

// ── 1. the key is the 4am cutoff, and it differs from the calendar day exactly
//       when the bug bit ────────────────────────────────────────────────────
assert(/const todayKey = \(\) => localDayWithCutoff\(4\)/.test(mp), 'todayKey is the 4am-cutoff day')
const preDawn = new Date(2026, 8, 13, 1, 30)
assert(localDayWithCutoff(4, preDawn) === '2026-09-12' && localDay(preDawn) === '2026-09-13',
  'at 1:30am the cutoff day is yesterday and the calendar day is today — a row keyed on the calendar day is the wrong row')
assert(localDayWithCutoff(4, new Date(2026, 8, 13, 4, 0)) === '2026-09-13', 'at 4:00am the cutoff day rolls over')
assert(localDayWithCutoff(4, new Date(2026, 8, 13, 23, 59)) === '2026-09-13', 'late evening is still today')

// ── 2. the row is keyed on the same day the entry carries ──────────────────
// FOR-231 v2 r3 moved the write from an upsert of the whole column to
// `checkin_patch`, which merges by path. The KEY is unchanged and it is the
// thing this file exists for, so these assertions follow it to its new home
// rather than being struck: the date the client passes, the date the entry
// carries, and the one-row-per-day conflict target — now in the function.
// FOR-231 v3: the day is computed ONCE — by generation, or read off the entry
// the loader painted — and both the row and the entry it carries use that one
// value. Recomputing todayKey() per write is what moved a 3:50 protocol's
// 4:10 tick into the next day's row (Codex r4).
assert(/await patchCheckin\('spirit_state', day, patches\)/.test(mp),
  'the spirit write is keyed on the day it is given')
assert(/const morningEntry = \(day: string, p: Protocol, c: boolean\[\], g: string\[\]\) =>\s*\(\{ date: day,/.test(mp),
  'and the entry carries that same day — the same value as the row key')
assert(/const day = todayKey\(\)/.test(mp.slice(mp.indexOf('  const generate = async () => {'))),
  'and generation takes that day from todayKey(), the 4am-cutoff day')
assert(!/patchCheckin\('spirit_state', localDay\(\)/.test(mp), 'the spirit row is not keyed on the calendar day')
const fn = readLF('../../supabase/migrations/20261003_checkin_set_path.sql')
assert(/ON CONFLICT \(user_id, date\) DO UPDATE/.test(fn),
  'the merge function conflicts on (user_id, date) — one row per protocol day')
assert(/INSERT INTO public\.daily_checkins \(user_id, date, %1\$I, updated_at\)/.test(fn),
  'and it is ONE statement, so the date it inserts is the date it conflicts on')

// ── 3. the loader still finds a pre-dawn row ───────────────────────────────
// Before 4am the protocol's row is yesterday's calendar row; the loader
// reads today and yesterday and picks the entry stamped todayKey().
assert(/\.in\('date', \[localDay\(\), yesterday\]\)/.test(mp), 'the loader reads both today\'s and yesterday\'s rows')
assert(/const day = todayKey\(\)/.test(mp) && /m\.date !== day\) continue/.test(mp), 'the loader picks the entry stamped with todayKey()')

// ── 4. mind_state keeps its own day, and neither write reaches the other ───
// The objectives are NOT a morning-routine entry and are not subject to the
// 4am cutoff: they are keyed on the calendar day, and were before this ticket.
assert(/const today = localDay\(\)[\s\S]{0,1800}patchCheckin\('mind_state', today,/.test(mp),
  'objectives still write mind_state under the calendar day')
// Not vacuous: one call names one column, and the column is an argument now,
// so a writer reaching into the other one would read as plainly as this does.
const spiritFn = mp.slice(mp.indexOf('  const patchSpirit = async ('), mp.indexOf('  const generate = async () => {'))
assert(spiritFn.length > 0 && /'spirit_state'/.test(spiritFn) && !/mind_state/.test(spiritFn),
  'the spirit writer names spirit_state and never mind_state')
const goalsFn = mp.slice(mp.indexOf('  const saveMindState = async () => {'), mp.indexOf('  useEffect(() => {'))
assert(goalsFn.length > 0 && /'mind_state'/.test(goalsFn) && !/spirit_state/.test(goalsFn),
  'the Goals step names mind_state and never spirit_state')

// ── verdict ─────────────────────────────────────────────────────────────────
if (fails.length) {
  console.log(`\nprotocol row key: ${fails.length} of ${checks} checks FAILED`)
  for (const f of fails) console.log('  ✗ ' + f)
  process.exit(1)
}
console.log(`protocol row key: ${checks} checks passed — a protocol is filed under its own day`)
