// ═══════════════════════════════════════════════════════════════════════════
// ADHERENCE (FOR-228) — the streak measured the wrong thing.
//
// The dashboard's only streak counted consecutive CALENDAR days with a
// completed row in workout_logs. The programs rest between sessions, so a
// compliant athlete could never hold it past 1 or 2 — and the morning
// protocol, the one thing that happens every day, counted for nothing.
//
// It is replaced by two numbers that are never blended:
//   · "N of the last 20 days" off morning-protocol completion (rolling —
//     it cannot reset)
//   · sessions completed vs sessions prescribed (weekly)
//
// This file proves three things, against the real program registry:
//   1. the reported bug: four weeks of Mon/Wed/Fri/Sat lifting reads 0 or 1
//      under the OLD algorithm (carried here verbatim, as the bug it catches)
//      and every session under the new one
//   2. the rolling number reads 14 of 20 for 14 done days, and reads the same
//      after a three-day gap — it must not reset
//   3. the dashboard is wired to the new numbers and the old loop is gone
//
// Its own file on purpose: a revert of the feature must not be able to delete
// the check that would have caught the revert (FOR-192 §7, week-shape.mjs).
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'
import { PROGRAMS } from '../../src/lib/programs/index.ts'
import { scheduledDayNumbers, sessionsThisWeek, scheduledDoneDays } from '../../src/lib/programs/schedule.ts'
import { rollingDays, protocolCompleteDays, isLegacyRow, trainingAdherence, daysBetween } from '../../src/lib/adherence.ts'

let checks = 0
const fails = []
const assert = (cond, msg) => { checks++; if (!cond) fails.push(msg) }
const readLF = (u) => readFileSync(new URL(u, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

// ── the old algorithm, verbatim ─────────────────────────────────────────────
// src/app/dashboard/page.tsx:248-255 before FOR-228. Kept HERE, not in src,
// so the bug it embodies stays reproducible without staying shippable.
function legacyStreak(logDates, today) {
  const uniqueDays = Array.from(new Set((logDates || []).map((l) => new Date(l.created_at).toDateString())))
  let s = 0
  today = new Date(today); today.setHours(0, 0, 0, 0)
  for (let i = 0; i < uniqueDays.length; i++) {
    const d = new Date(uniqueDays[i]); d.setHours(0, 0, 0, 0)
    const diff = Math.round((today.getTime() - d.getTime()) / 86400000)
    if (diff === i || (i === 0 && diff <= 1)) s++; else break
  }
  return s
}

// ── 1. the reported bug, and the fix ────────────────────────────────────────
// Andrew lifts Mon/Wed/Fri/Sat and fits the rest in when he can; the ticket's
// premise is the lifts. Measured against Hybrid Dad — the five-day program
// this section was first written against (Dad Strong) was cut in FOR-225, and
// every survivor prescribes six days.
const sixDay = PROGRAMS['hybrid-dad']
assert(!!sixDay, 'the registry has hybrid-dad')
const LIFT_DAYS = [1, 3, 5, 6]
const w1 = sixDay ? scheduledDayNumbers(sixDay, 1) : []
assert(LIFT_DAYS.every((d) => w1.includes(d)),
  `hybrid-dad schedules Mon/Wed/Fri/Sat — got [${w1.join(',')}]`)

// Four weeks of lifting, most recent first, as workout_logs rows. Week 1 is
// Mon 2026-08-17; the last lift is Sat 2026-09-12.
const MONDAY_W1 = new Date(2026, 7, 17)
const liftDates = []
for (let w = 0; w < 4; w++) {
  for (const d of LIFT_DAYS) {
    const day = new Date(MONDAY_W1); day.setDate(MONDAY_W1.getDate() + w * 7 + (d - 1)); day.setHours(18, 30)
    liftDates.push({ created_at: day.toISOString() })
  }
}
liftDates.reverse()
assert(liftDates.length === 16, 'sixteen lifts across four weeks')

// The old code: 1 on the Sunday after the last lift, 0 on the Monday. A
// compliant month reads as no streak at all.
const sunday = new Date(2026, 8, 13), monday = new Date(2026, 8, 14)
const oldSun = legacyStreak(liftDates, sunday), oldMon = legacyStreak(liftDates, monday)
assert(oldSun === 1, `old streak on the Sunday after four compliant weeks reads 1 — got ${oldSun}`)
assert(oldMon === 0, `old streak on the Monday after four compliant weeks reads 0 — got ${oldMon}`)

// The new number: every lift counted, against what the program asked for.
// The registry says a Hybrid Dad week asks for six sessions, so lifts-only
// reads 16 of 24 — two-thirds, a real number, honest about the days that were
// skipped, and nothing like the old streak's 0. Every scheduled day: 24 of 24.
const liftsOnly = trainingAdherence([1, 2, 3, 4].map((w) => ({
  done: scheduledDoneDays(LIFT_DAYS, sixDay, w).length,
  prescribed: sessionsThisWeek(sixDay, w),
})))
assert(liftsOnly.done === 16, `four weeks of Mon/Wed/Fri/Sat count 16 sessions done — got ${liftsOnly.done}`)
assert(liftsOnly.prescribed === 4 * sessionsThisWeek(sixDay, 1),
  `four weeks prescribe 4 × the registry's weekly count — got ${liftsOnly.prescribed}`)
assert(liftsOnly.done / liftsOnly.prescribed >= 0.6,
  `a lifts-only month reads as adherence, not failure — ${liftsOnly.done}/${liftsOnly.prescribed}`)
const everything = trainingAdherence([1, 2, 3, 4].map((w) => ({
  done: scheduledDoneDays(scheduledDayNumbers(sixDay, w), sixDay, w).length,
  prescribed: sessionsThisWeek(sixDay, w),
})))
assert(everything.done === everything.prescribed && everything.done === 24,
  `every scheduled session done reads 24 of 24 — got ${everything.done}/${everything.prescribed}`)
// A ghost day — a completion for a day the program does not schedule (day 7,
// Hybrid Dad's rest day) — does not count, the same rule the week strip applies.
const ghost = trainingAdherence([{ done: scheduledDoneDays([7], sixDay, 1).length, prescribed: sessionsThisWeek(sixDay, 1) }])
assert(ghost.done === 0, `unscheduled days do not count as sessions — got ${ghost.done}`)
// The weekly read the dashboard shows: one record, the current week.
const thisWeek = trainingAdherence([{ done: scheduledDoneDays([1, 3], sixDay, 2).length, prescribed: sessionsThisWeek(sixDay, 2) }])
assert(thisWeek.done === 2 && thisWeek.prescribed === 6, `mid-week reads 2 of 6 — got ${thisWeek.done}/${thisWeek.prescribed}`)

// ── 2. the rolling number cannot reset ──────────────────────────────────────
const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const shift = (k, days) => { const [y, m, d] = k.split('-').map(Number); return key(new Date(y, m - 1, d + days)) }
const TODAY = '2026-09-13'
// Fourteen done days, the most recent three days ago: T-3 … T-16.
const fourteen = Array.from({ length: 14 }, (_, i) => shift(TODAY, -(i + 3)))
const r0 = rollingDays(fourteen, TODAY)
assert(r0.done === 14 && r0.window === 20, `14 done days read 14 of 20 — got ${r0.done}/${r0.window}`)
// Three days pass with nothing done. A streak would read 0 here.
const afterGap = rollingDays(fourteen, shift(TODAY, 3))
assert(afterGap.done === 14, `after a three-day gap it still reads 14 — got ${afterGap.done}`)
assert(afterGap.done !== 0, 'the number did not reset on a gap')
// The only way down is a day rolling out of the window.
const afterFour = rollingDays(fourteen, shift(TODAY, 4))
assert(afterFour.done === 13, `a day older than the window rolls off — got ${afterFour.done}`)
// Duplicates, future days and days outside the window are ignored; today counts.
const noisy = [TODAY, TODAY, shift(TODAY, 1), shift(TODAY, -19), shift(TODAY, -20), 'garbage']
const rn = rollingDays(noisy, TODAY)
assert(rn.done === 2, `duplicates, future and out-of-window days are ignored — got ${rn.done}`)
assert(daysBetween('2026-03-07', '2026-03-09') === 2, 'daysBetween crosses the DST change as two days')

// Morning-protocol completion is every step ticked — the state the component
// itself stamps "morning done" — keyed on the protocol's 4am-cutoff date.
const three = { steps: [{}, {}, {}] }
const states = [
  { morning: { date: '2026-09-13', protocol: three, completed: [true, true, true] } },   // done
  { morning: { date: '2026-09-12', protocol: three, completed: [true, true, false] } },  // opened, not done
  { morning: { date: '2026-09-11', protocol: three, completed: [true, true] } },         // short array: not done
  { morning: { date: '2026-09-10', completed: [true] } },                                // no protocol shape: done
  { morning: { protocol: three, completed: [true, true, true] } },                       // no date: skipped
  { morning: null }, null, undefined, {},
]
const doneKeys = protocolCompleteDays(states)
assert(doneKeys.join(',') === '2026-09-13,2026-09-10',
  `only fully completed protocols count, keyed on their own date — got [${doneKeys.join(',')}]`)
// ONE RECORD PER PROTOCOL DAY (FOR-231). Since the row-key fix a day has one
// row, keyed on its own date, and that row is its record. Before the fix a
// pre-dawn write landed in the NEXT calendar day's row — a legacy row, row date
// ≠ entry date — and was, by the way that code wrote rows, the last write of
// its day. So a legacy row, where one survives, is the day's record; otherwise
// its own row is. No timestamp is read: updated_at moves on objectives writes.
const own = (date, completed, row = date) => ({ morning: { date, protocol: three, completed }, row })
const legacy = (date, completed) => ({ morning: { date, protocol: three, completed }, row: shift(date, 1) })
assert(isLegacyRow(legacy('2026-09-12', [true, true, true])) && !isLegacyRow(own('2026-09-12', [true])) && !isLegacyRow({ morning: { date: '2026-09-12' } }),
  'a legacy row is one keyed on a calendar day other than its entry\'s own day — an absent row date is the entry\'s own row')
// FOR-228 r7's finding, which the old rule got wrong: started on the 12th and
// left incomplete in the 12th's row, finished at 1am into the 13th's row.
assert(protocolCompleteDays([own('2026-09-12', [true, false, false]), legacy('2026-09-12', [true, true, true])]).join(',') === '2026-09-12'
  && protocolCompleteDays([legacy('2026-09-12', [true, true, true]), own('2026-09-12', [true, false, false])]).join(',') === '2026-09-12',
  'a pre-fix protocol finished after midnight counts — its legacy row is the last write of its day, in either order')
// FOR-228 r5's case, pre-fix: done before midnight in its own row, a step
// unticked at 1am into the legacy row. The later write is the record.
assert(protocolCompleteDays([own('2026-09-12', [true, true, true]), legacy('2026-09-12', [true, true, false])]).length === 0,
  'a pre-fix completion undone after midnight is not a completion — the legacy row is later')
assert(protocolCompleteDays([legacy('2026-09-11', [true, true, true])]).join(',') === '2026-09-11',
  'a legacy row alone is its day\'s record — history from before the fix is not thrown away')
assert(protocolCompleteDays([own('2026-09-15', [true, true, true])]).join(',') === '2026-09-15' && protocolCompleteDays([own('2026-09-15', [true, true, false])]).length === 0,
  'after the fix a day has one row, and that row is the record')
// No timestamp is consulted: rows carrying wildly different updated_at stamps
// resolve exactly as they do with none.
const stamped = (r, at) => ({ ...r, at })
assert(protocolCompleteDays([stamped(own('2026-09-12', [true, false, false]), '2099-01-01T00:00:00Z'), stamped(legacy('2026-09-12', [true, true, true]), '1970-01-01T00:00:00Z')]).join(',') === '2026-09-12',
  'the record is chosen by how the row is keyed, never by updated_at — which also moves when objectives are saved')

// ── 3. the dashboard is wired, and the old loop is gone ─────────────────────
const dash = readLF('../../src/app/dashboard/page.tsx')
assert(!dash.includes('(i === 0 && diff <= 1)'), 'the consecutive-day loop is gone from the dashboard')
assert(!dash.includes("from('workout_logs')"), 'the dashboard no longer reads workout_logs for a streak')
assert(!/setStreak\(|const \[streak\b|\{streak\}/.test(dash), 'no streak state survives on the dashboard')
assert(dash.includes("from('daily_checkins')") && dash.includes('protocolCompleteDays('),
  'the daily number reads morning-protocol completion out of daily_checkins')
assert(dash.includes('rollingDays('), 'the dashboard computes the rolling number')
assert(/localDayWithCutoff\(4\)/.test(dash), 'the rolling window uses the protocol\'s 4am-cutoff day key')
// FOR-231: the daily number reads daily_checkins and NOTHING ELSE. Every
// clause of the old negotiation — the local cache, reconcileLocal,
// localMatchesMirror, pendingLocalSave, settled, the bounded re-read — is gone,
// and a single signal, fired only once the row holds the change, is the only
// reason it re-reads.
const count = (() => { const at = dash.indexOf('async function fetchProtocolDays('); return at < 0 ? '' : dash.slice(at, dash.indexOf('\n}\n', at)) })()
assert(count.length > 0 && !/localStorage|reconcileLocal|localMatchesMirror|pendingLocalSave|settled/.test(count),
  'the count reads the row alone — no cache, no reconciliation, no settle')
assert(/\.select\('spirit_state, date'\)/.test(count) && /\{ morning: r\.spirit_state\?\.morning, row: r\.date \}/.test(count) && !/updated_at/.test(count),
  'each row carries its entry and its date — and no timestamp, because the record is chosen by how a row is keyed')
assert(!/reconcileLocal|localMatchesMirror|pendingLocalSave|PROTOCOL_CACHE_KEY|protocolSaveTick|onProtocolSaved/.test(dash),
  'no trace of the negotiation survives on the dashboard')
assert((dash.match(/fetchProtocolDays\(/g) || []).length >= 3, 'one fetch function serves the load and the refresh')
assert(/if \(recordTick === 0\) return[\s\S]{0,400}fetchProtocolDays\(supabase, user\.id\)[\s\S]{0,200}\}, \[recordTick, supabase\]\)/.test(dash),
  'the daily number re-reads the row on the record tick')
assert(!/for \(let attempt = 0/.test(dash) && !/setTimeout\(r, 1500\)/.test(dash), 'no re-read loop: the signal fires only once the row has the change')
assert(/<MorningProtocol onSaved=\{\(\) => setRecordTick\(t => t \+ 1\)\} \/>/.test(dash) && /<DailyObjectivesCard refreshKey=\{recordTick\}/.test(dash) && /protocolTick=\{recordTick\}/.test(dash),
  'one signal, one tick, every reader — the count, the checklist and the objectives card')
assert(dash.includes('trainingAdherence('), 'the dashboard computes the weekly training number')
assert(/training\.done\}\/\{training\.prescribed\}/.test(dash), 'the weekly number renders done/prescribed')
assert(/protocolDays\.done\}\/\{protocolDays\.window\}/.test(dash), 'the daily number renders done/window')
// Never blended: no expression combines the two numbers.
assert(!/protocolDays\.done\s*[+\-*/]\s*training|training\.done\s*[+\-*/]\s*protocolDays/.test(dash),
  'the two numbers are never combined')

// ── 4. StreakShield is gone, and stays gone (FOR-228 §5.3, ruling 1) ────────
// A shield for a streak that no longer exists. The search root is the
// repository — node_modules, .next and .git excluded, this file excluded —
// and the claim is zero files mentioning the component or its storage key.
// The ticket's original "mounted nowhere" was a grep over a staged subset;
// this one states its root.
const REPO = fileURLToPath(new URL('../../', import.meta.url))
const SKIP = new Set(['node_modules', '.next', '.git', '.claude'])
const SELF = fileURLToPath(import.meta.url)
const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (st.size < 2_000_000 && p !== SELF) out.push(p)
  }
  return out
}
const shieldRefs = walk(REPO).filter((p) => {
  let text
  try { text = readFileSync(p, 'utf8') } catch { return false }
  return /StreakShield|dad-strength-streak-shields/.test(text)
}).map((p) => relative(REPO, p))
assert(shieldRefs.length === 0, `no file in the repository mentions StreakShield or its storage key (root ${REPO}): ${shieldRefs.join(', ') || 'none'}`)

// ── verdict ─────────────────────────────────────────────────────────────────
if (fails.length) {
  console.log(`\nadherence: ${fails.length} of ${checks} checks FAILED`)
  for (const f of fails) console.log('  ✗ ' + f)
  process.exit(1)
}
console.log(`adherence: ${checks} checks passed — two honest numbers, neither can reset`)
