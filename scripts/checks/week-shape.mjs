// ═══════════════════════════════════════════════════════════════════════════
// WEEK SHAPE — the days a program runs, the days the app shows, and the days
// that can be finished are the same three sets.
//
// Dad Strong disagreed with itself on all three. It is daysPerWeek: 5 and used
// to train days 1, 2, 4, 6, 7 — Mon, Tue, Thu, Sat, Sun. Every surface counted
// 1..daysPerWeek, so the app rendered Mon-Fri:
//
//   · Saturday and Sunday were UNREACHABLE — 40% of the program, undeliverable
//   · Wednesday and Friday rendered as rest days, and the finish button
//     completed them anyway, because nothing gated completion on dayType
//   · so its week advanced on two fake finishes, and FOR-195's day-count filter
//     had to grow an OR-rule specifically to keep that fiction working
//
// FOR-196 anchored the lifts to Mon/Wed/Fri/Sat, floated the easy aerobic day,
// pointed every surface at the schedule, and gated completion. This file is
// what stops the three sets drifting apart again.
//
// Its own file on purpose: the previous versions of the palette and orphan
// checks were built inside a design-specific suite and were deleted when that
// design was reverted (FOR-192 §7).
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs'
import { PROGRAMS } from '../../src/lib/programs/index.ts'
import {
  scheduledDayNumbers, sessionsThisWeek, scheduledDoneDays, dayLabel, isCompletable,
} from '../../src/lib/programs/schedule.ts'

const MAXES = {
  snatch: 205, clean_jerk: 260,
  back_squat: 365, front_squat: 315, bench: 250, deadlift: 465, ohp: 155,
}

let checks = 0
const fails = []
const assert = (cond, msg) => { checks++; if (!cond) fails.push(msg) }

const readLF = (u) => readFileSync(new URL(u, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
// Comments quote the code they replaced, and this file's own OR-rule assertion
// matched the doc block explaining that the OR was retired — a check failing on
// prose about the bug rather than the bug. Strip comments before pattern tests.
const codeOf = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

// ── 1. THE THREE-WAY AGREEMENT ─────────────────────────────────────────────
// A program's day numbers live in three places — the buildDay switch, the
// testDay plans map, and gymDayNumbers — and moving one without the others is
// silent. Dad Strong's move touched all three; had testDay been missed, week 13
// would have gone on scheduling the four 1RM tests on days 2 and 4 while the
// hub rendered 1/3/5/6/7, reintroducing this ticket's exact bug in the one week
// nobody looks at until they get there.
//
// gymDayNumbers ⊆ scheduled catches BOTH halves: miss gymDayNumbers and its
// stale entries stop being scheduled; miss testDay and the W13 schedule stops
// containing the gym days.
for (const [slug, p] of Object.entries(PROGRAMS)) {
  for (let wk = 1; wk <= 13; wk++) {
    const sched = scheduledDayNumbers(p, wk)
    const missing = p.gymDayNumbers.filter(d => !sched.includes(d))
    assert(missing.length === 0,
      `${slug} W${wk}: gymDayNumbers [${p.gymDayNumbers}] not scheduled: [${missing}] `
      + `(scheduled [${sched}]) — buildDay, testDay and gymDayNumbers must agree`)
    assert(sched.length > 0, `${slug} W${wk}: schedules nothing at all`)
    assert(sched.every(d => d >= 1 && d <= 7), `${slug} W${wk}: day out of range [${sched}]`)
  }
}

// The five-day program those assertions were written against (Dad Strong) was
// cut in FOR-225; the three-way agreement above now covers every program that
// exists, and program-lineup.mjs pins the lineup itself.

// ── 2. NO SURFACE COUNTS TO daysPerWeek ANY MORE ───────────────────────────
// "rendered == scheduled" is now true by construction — every surface maps over
// scheduledDayNumbers — so asserting it at runtime would be a tautology that
// can never fail. The thing that CAN fail is a future edit reintroducing a
// `1..daysPerWeek` day loop, so that is what this checks.
//
// daysPerWeek is a COUNT (a headline number on the program card), never a
// RANGE. Using it as a range is the whole bug.
const SURFACES = [
  ['hub week list', '../../src/app/train/[program]/page.tsx'],
  ['dashboard', '../../src/app/dashboard/page.tsx'],
  ['ActiveProgram', '../../src/components/ActiveProgram.tsx'],
  ['day page', '../../src/app/train/[program]/[day]/page.tsx'],
]
// daysPerWeek may still be DISPLAYED — ActiveProgram's "5 / WK" and the
// dashboard's daysCount are the headline count, which is what it is for. What
// it may never be again is a RANGE: sized into an array of days, walked as a
// loop bound, or compared against a day number.
//
// The Array.from pattern deliberately stops at `{ length:` rather than
// describing the callback. The first version of this check matched only the
// `.map((_, i) => … i + 1)` form and would have sailed past the exact code it
// replaced, which used `Array.from({ length: n }, (_, i) => …)` — the two-arg
// form. A mutation test caught that; the shape of the callback is not the
// claim, sizing an array of days by a count is.
const DAY_RANGE_PATTERNS = [
  [/Array\.from\(\s*\{\s*length:[^}]*\bdaysPerWeek\b/,
    'Array.from({ length: …daysPerWeek … }) — an array of days sized by a count'],
  [/for\s*\(\s*let\s+\w+\s*=\s*\d+\s*;\s*\w+\s*<=?\s*[^;]*\bdaysPerWeek\b/,
    'for (let i = 1; i <= …daysPerWeek …)'],
  [/\bdayNumber\s*<\s*[^)]*\bdaysPerWeek\b/,
    'dayNumber < …daysPerWeek'],
]
for (const [label, url] of SURFACES) {
  const src = codeOf(readLF(url))
  for (const [re, shape] of DAY_RANGE_PATTERNS) {
    assert(!re.test(src),
      `${label}: walks days as 1..daysPerWeek — "${shape}". daysPerWeek is a count, `
      + `not a range; iterate scheduledDayNumbers(program, week) instead`)
  }
}
// The hub must label by day NUMBER. It used to index a weekday array by array
// POSITION, which was accidentally right only while every week was contiguous —
// against Dad Strong's 1/3/5/6/7 it would have printed mon/tue/wed/thu/fri.
{
  const hub = readLF('../../src/app/train/[program]/page.tsx')
  assert(/dayLabel\(plan\)/.test(hub), 'the hub must label days with dayLabel(plan)')
  assert(!/DAY_LABELS\[/.test(hub), 'the hub still indexes a weekday array directly')
}

// Codex [P2]: converting a loop from a 0-based INDEX to a 1-based DAY NUMBER
// changes what a comparison means, and the progress bar carried its `<` over
// unchanged. `i < dayNumber` lit dayNumber cells — the current day included;
// `d < dayNumber` drops one, so finishing day 1 showed no progress and a
// finished Dad Strong week showed 4 of 5.
//
// Every other converted site tests set MEMBERSHIP (done.has(d), includes(d)),
// which is index-independent and was unaffected. This was the only ordinal
// comparison among them, which is exactly why it slipped through by hand.
{
  const day = readLF('../../src/app/train/[program]/[day]/page.tsx')
  assert(!/led-cell \$\{d < dayNumber/.test(day),
    'the progress bar must light the day just completed — `d <= dayNumber`, not `<`')
  assert(/led-cell \$\{d <= dayNumber/.test(day),
    'the progress bar should light days up to and including the current one')
}

// ── 3. THE FLEXIBLE DAY ────────────────────────────────────────────────────
// The only program that floated a day (Dad Strong's easy aerobic day) was cut
// in FOR-225. The flag stays in the type for the next program that means it;
// today NO program floats anything. Power Dad's Tuesday sprint and Thursday
// conditioning are 'outside' and genuinely pinned — which is why this is a
// flag rather than an inference from dayType.
for (const [slug, p] of Object.entries(PROGRAMS)) {
  for (let wk = 1; wk <= 13; wk++) {
    for (const d of scheduledDayNumbers(p, wk)) {
      const plan = p.buildDay(wk, d, MAXES)
      assert(!plan.flexible, `${slug} W${wk} D${d} is flagged flexible — no program floats a day`)
      assert(dayLabel(plan) !== 'anytime', `${slug} W${wk} D${d} reads "anytime" — no program floats a day`)
    }
  }
}

// ── 4. A REST DAY CANNOT BE FINISHED ───────────────────────────────────────
// The gate lives in the completion path, not on the button. Once rendered ==
// scheduled no rest day is listed anywhere, so a button-level guard would be UI
// for a state that cannot occur — but /train/<slug>/<a rest day> is still a URL anyone
// can type, and until this ticket it would have completed and counted.
for (const [slug, p] of Object.entries(PROGRAMS)) {
  for (const wk of [1, 13]) {
    const sched = scheduledDayNumbers(p, wk)
    for (let d = 1; d <= 7; d++) {
      const plan = p.buildDay(wk, d, MAXES)
      const shouldComplete = sched.includes(d)
      assert(isCompletable(plan) === shouldComplete,
        `${slug} W${wk} D${d}: isCompletable=${isCompletable(plan)} but scheduled=${shouldComplete}`)
    }
  }
}
{
  const day = readLF('../../src/app/train/[program]/[day]/page.tsx')
  const start = day.indexOf('const completeSession = async () => {')
  assert(start > 0, 'could not find completeSession')
  const body = day.slice(start, start + 1200)
  assert(/isCompletable\(/.test(body),
    'completeSession must refuse a rest day — the URL is reachable even when the day is not listed')
}

// ── 5. THE OR-RULE IS RETIRED ──────────────────────────────────────────────
// It read `scheduled.has(d) || d <= daysPerWeek`. The second half existed only
// to keep Dad Strong's fake rest-day completions counting; with rendered ==
// scheduled it is dead, and leaving it would mean an unscheduled day could
// still advance a week.
{
  const sched = codeOf(readLF('../../src/lib/programs/schedule.ts'))
  assert(!/scheduled\.has\(d\)\s*\|\|/.test(sched),
    "the OR-rule survives in scheduledDoneDays — an unscheduled day can still count")

  const hd = PROGRAMS['hybrid-dad']
  // Day 7 is Hybrid Dad's rest day; a sentinel written there is a session
  // that never happened — the shape the cut five-day program used to advance on.
  assert(scheduledDoneDays([1, 2, 7], hd, 1).join() === '1,2',
    `a rest-day completion must not count, got [${scheduledDoneDays([1, 2, 7], hd, 1)}]`)
  assert(scheduledDoneDays([1, 2, 3, 4, 5, 6], hd, 1).length === sessionsThisWeek(hd, 1),
    'a genuinely finished Hybrid Dad week must still complete')
  // The FOR-195 case this replaced: Power Dad's retired Sunday.
  assert(scheduledDoneDays([7], PROGRAMS['hybrid-power'], 1).length === 0,
    'a legacy Power Dad day-7 sentinel must still be ignored')
}

// ── 6. THE ADVANCEMENT THRESHOLD IS WHAT THE WEEK ASKS FOR ─────────────────
// Not daysPerWeek. They diverge in test week, in both directions.
{
  const expect = { 'hybrid-power': 6, 'hybrid-dad': 6, 'dad-built': 6 }
  for (const [slug, p] of Object.entries(PROGRAMS)) {
    assert(sessionsThisWeek(p, 1) === expect[slug],
      `${slug} W1 should ask for ${expect[slug]} sessions, got ${sessionsThisWeek(p, 1)}`)
  }
  // Power Dad is Andrew's live program: the threshold change must be a no-op
  // for it in EVERY week, test week included.
  const hp = PROGRAMS['hybrid-power']
  for (let wk = 1; wk <= 13; wk++) {
    assert(sessionsThisWeek(hp, wk) === hp.daysPerWeek,
      `hybrid-power W${wk}: threshold moved (${sessionsThisWeek(hp, wk)} vs daysPerWeek ${hp.daysPerWeek})`)
  }
  // The two test-week divergences, pinned so they are a decision and not a drift.
  assert(sessionsThisWeek(PROGRAMS['hybrid-dad'], 13) === 5,
    'hybrid-dad W13 schedules 5 — the reason the threshold stopped being daysPerWeek')
  assert(sessionsThisWeek(PROGRAMS['dad-built'], 13) === 7,
    'dad-built W13 schedules 7 — its threshold rises 6 -> 7, stated in the PR')

  const day = readLF('../../src/app/train/[program]/[day]/page.tsx')
  const start = day.indexOf('async function advanceWeekIfDone(')
  const body = day.slice(start, day.indexOf('\n}\n', start))
  assert(/sessionsThisWeek\(/.test(body),
    'advanceWeekIfDone must measure against sessionsThisWeek, not daysPerWeek')
}

// ── Report ─────────────────────────────────────────────────────────────────
console.log('')
console.log('  ── week shape ' + '─'.repeat(47))
for (const [slug, p] of Object.entries(PROGRAMS)) {
  const rows = new Map()
  for (let wk = 1; wk <= 13; wk++) {
    const days = scheduledDayNumbers(p, wk)
    const key = days.map(d => dayLabel(p.buildDay(wk, d, MAXES))).join(' ')
    if (!rows.has(key)) rows.set(key, [])
    rows.get(key).push(wk)
  }
  for (const [labels, wks] of rows) {
    const when = wks.length === 13 ? 'all weeks' : 'w' + wks.join('/')
    console.log(`    ${slug.padEnd(18)} ${when.padEnd(11)} ${labels}`)
  }
}
console.log('')

if (fails.length) {
  console.log(`✗ ${fails.length} FAILURES of ${checks} checks:`)
  for (const f of fails) console.log('  - ' + f)
  process.exit(1)
}
console.log(`✓ rendered == scheduled == completable — ${checks} checks across ${Object.keys(PROGRAMS).length} programs × 13 weeks`)
