// ── protocol row key (FOR-228, ruling 2) ─────────────────────────────────────
// MorningProtocol mirrors each save into daily_checkins.spirit_state. The row
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

// ── 2. the mirror row is keyed on the same day the entry carries ────────────
// The key is captured ONCE, when the change is made (FOR-231, Codex r1: read
// inside the queued write it could fall after 4am), and that one value is both
// the row's date and the entry's.
assert(/const saveCache = \(p: Protocol, c: boolean\[\], g: string\[\], day: string = todayKey\(\)\)/.test(mp) && /user_id: owner,\s*date: day,\s*spirit_state: \{ morning: \{ date: day, protocol: p, completed: c, gratitude: g \} \}/.test(mp),
  'the mirror row is keyed on todayKey() — the same value the entry carries, captured when the change was made')
assert(!/date: localDay\(\),\s*spirit_state:/.test(mp), 'the mirror row is not keyed on the calendar day')
assert(/onConflict: 'user_id,date'/.test(mp), 'the upsert conflicts on (user_id, date) — one row per protocol day')

// ── 3. the loader still finds a pre-dawn row ───────────────────────────────
// Before 4am the protocol's row is yesterday's calendar row. Since the row is
// keyed on todayKey() — the 4am-cutoff day, which before 4am IS yesterday —
// reading the row keyed todayKey() is that pre-dawn row exactly, and the only
// row a protocol for today has been written to since the fix (FOR-231: the
// loader reads the record, not a pair of calendar rows to choose between).
assert(/\.from\('daily_checkins'\)\s*\.select\('spirit_state'\)\s*\.eq\('user_id', who\)\s*\.eq\('date', day\)/.test(mp) && /const row = await readSpirit\(supabase, user\.id, todayKey\(\)\)/.test(mp),
  'the loader reads the row keyed on todayKey() — the pre-dawn row, before 4am')
assert(/n\?\.protocol && n\.date === day \? n\.protocol : null/.test(mp) && /const held = protocolOn\(row, todayKey\(\)\)/.test(mp) && /if \(held\) \{[\s\S]{0,200}setProtocol\(held\)/.test(mp),
  'the loader takes the entry only when it is stamped with the day it read — decided once, for any day, and what it shows is that decision')

// ── 4. mind_state keeps its own path, and the mirror names only its columns ─
const outbox = readLF('../../src/lib/objectivesOutbox.ts')
assert(/book\(\)\.turn\(localDay\(\)\)/.test(mp) && /date: day, mind_state: row/.test(outbox) && !/mind_state:/.test(mp),
  'objectives still write mind_state under the calendar day, on their own path — the outbox both writers share (FOR-231, Codex r7)')
assert(!/spirit_state: \{ morning[\s\S]{0,300}mind_state/.test(mp), 'the mirror upsert names only its own columns — mind_state is never in its payload')

// ── verdict ─────────────────────────────────────────────────────────────────
if (fails.length) {
  console.log(`\nprotocol row key: ${fails.length} of ${checks} checks FAILED`)
  for (const f of fails) console.log('  ✗ ' + f)
  process.exit(1)
}
console.log(`protocol row key: ${checks} checks passed — a protocol is filed under its own day`)
