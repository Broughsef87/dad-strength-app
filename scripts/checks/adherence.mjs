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
import { rollingDays, protocolCompleteDays, trainingAdherence, daysBetween } from '../../src/lib/adherence.ts'

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
// Each is the row keyed on its own protocol day — the record (FOR-231 v2).
const states = [
  { morning: { date: '2026-09-13', protocol: three, completed: [true, true, true] }, row: '2026-09-13' },   // done
  { morning: { date: '2026-09-12', protocol: three, completed: [true, true, false] }, row: '2026-09-12' },  // opened, not done
  { morning: { date: '2026-09-11', protocol: three, completed: [true, true] }, row: '2026-09-11' },         // short array: not done
  { morning: { date: '2026-09-10', completed: [true] }, row: '2026-09-10' },                                // no protocol shape: done
  { morning: { protocol: three, completed: [true, true, true] } },                                          // no date: skipped
  { morning: null }, null, undefined, {},
]
const doneKeys = protocolCompleteDays(states)
assert(doneKeys.join(',') === '2026-09-13,2026-09-10',
  `only fully completed protocols count, keyed on their own date — got [${doneKeys.join(',')}]`)

// The rest of what used to sit here pinned a NEGOTIATION between the local
// cache and the mirror — reconcileLocal, localMatchesMirror, the updated_at
// ranking and the canonical-row tier. FOR-231 v2 deleted the second copy, so
// there is nothing left to adjudicate. The single rule that replaced it (the
// record for a protocol day is the row keyed on that day) is asserted in its
// own suite, scripts/checks/checkin-record.mjs, and is deliberately NOT
// asserted a second time here.
// ── 3. the dashboard is wired, and the old loop is gone ─────────────────────
const dash = readLF('../../src/app/dashboard/page.tsx')
assert(!dash.includes('(i === 0 && diff <= 1)'), 'the consecutive-day loop is gone from the dashboard')
assert(!dash.includes("from('workout_logs')"), 'the dashboard no longer reads workout_logs for a streak')
assert(!/setStreak\(|const \[streak\b|\{streak\}/.test(dash), 'no streak state survives on the dashboard')
assert(dash.includes("from('daily_checkins')") && dash.includes('protocolCompleteDays('),
  'the daily number reads morning-protocol completion out of daily_checkins')
assert(/\.select\('spirit_state, date'\)/.test(dash) && /\{ morning: r\.spirit_state\?\.morning, row: r\.date \}/.test(dash),
  'each row carries its date, so the record row for a protocol day can be told from any other')
assert(dash.includes('rollingDays('), 'the dashboard computes the rolling number')
assert(/localDayWithCutoff\(4\)/.test(dash), 'the rolling window uses the protocol\'s 4am-cutoff day key')
// Codex, round 1 (FOR-228): the number was computed once, in the load effect,
// and a protocol finished on the same page stayed uncounted until a remount. It
// recomputes on the save signal — which now fires only once the row HOLDS the
// change, so one read answers and there is nothing to wait for.
assert((dash.match(/fetchProtocolDays\(/g) || []).length >= 3, 'one fetch function serves the load and the refresh')
assert(/if \(protocolTick === 0\) return[\s\S]{0,500}fetchProtocolDays\([\s\S]{0,500}\}, \[protocolTick, supabase\]\)/.test(dash),
  'the daily number recomputes on the save signal')
// FOR-231 v2: ONE signal. It used to be two, because the count trusted a
// local cache and had to know the cache specifically had been written. With
// no cache, a save that has landed in the row is the only thing to announce.
const mp = readLF('../../src/components/MorningProtocol.tsx')
assert(!mp.includes('onProtocolSaved') && !dash.includes('onProtocolSaved'),
  'the protocol-only signal is gone — it existed to time a cache read')
assert((mp.match(/onSaved\?\.\(\)/g) || []).length === 2,
  'MorningProtocol announces a landed write from both of its two write paths')
assert(/onSaved=\{\(\) => setProtocolTick\(t => t \+ 1\)\}/.test(dash),
  'the dashboard wires that one signal to its one tick')
assert(/<DailyObjectivesCard refreshKey=\{protocolTick\}/.test(dash) && /protocolTick=\{protocolTick\}/.test(dash),
  'the objectives card and the checklist follow the same signal')
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
