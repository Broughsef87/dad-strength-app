// ── Evening review + on awakening (FOR-332) ─────────────────────────────────
// Executes src/lib/evening.ts: the form's completeness rule, the saved shape,
// the day boundaries, and what last night carries into the morning.
// Its own file, so a revert of the feature cannot take the check with it.
import {
  SHORTFALLS, emptyAnswers, isComplete, toEntry, readEntry, toAnswers, eveningDay, inEveningWindow,
  lastNightDay, carryOver, firstObjective, inMorningWindow, morningDay, readAwakening, trainingAhead, LINE_MAX,
} from '../../src/lib/evening.ts'

let checks = 0
const fails = []
const eq = (a, b, msg) => { checks++; if (JSON.stringify(a) !== JSON.stringify(b)) fails.push(`${msg}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`) }
const at = (h, m = 0) => new Date(2026, 10, 3, h, m) // Tue Nov 3 2026, local

// Completeness: the three yes/no taps, plus the one thing when there is one.
const a = emptyAnswers()
eq(isComplete(a, false), false, 'empty form is not complete')
const tapped = { ...a, apology: false, holding: false, gaveMore: true }
eq(isComplete(tapped, false), true, 'three taps complete it with no one thing')
eq(isComplete(tapped, true), false, 'with a one thing it must be answered')
eq(isComplete({ ...tapped, oneThing: 'partly' }, true), true, 'answered one thing completes it')
checks++; try { toEntry(a, '2026-11-03', null); fails.push('toEntry accepted an incomplete form') } catch {}

// Saved shape: ordered shortfalls, trimmed/clipped lines, apologyTo only with yes.
const e = toEntry({
  shortfalls: ['afraid', 'resentful', 'bogus'], apology: false, apologyTo: 'my wife', holding: true,
  gaveMore: false, better: '  slow  down ' + 'x'.repeat(300), oneThing: 'no',
}, '2026-11-03', 'Call Dad', at(21))
eq(e.shortfalls, ['resentful', 'afraid'], 'shortfalls kept in list order, unknowns dropped')
eq(e.apologyTo, null, 'no apology means no apologyTo')
eq(e.better.length, LINE_MAX, 'the line is clipped')
eq(e.better.startsWith('slow down x'), true, 'the line is trimmed and squeezed')
eq(e.oneThing, 'no', 'one thing kept')
eq(readEntry(e, '2026-11-03'), e, 'a saved entry reads back unchanged')
eq(readEntry(e, '2026-11-04'), null, 'another day reads nothing')
eq(readEntry({ day: '2026-11-03' }, '2026-11-03'), null, 'a partial entry reads nothing')
eq(toEntry({ ...toAnswers(e), oneThing: 'no' }, '2026-11-03', 'Call Dad', at(21)), e, 'edit round-trips')
const noThing = toEntry({ ...tapped, oneThing: 'yes' }, '2026-11-03', null)
eq(noThing.oneThing, null, 'no objective means no one-thing answer is stored')

// Day boundaries: the evening window 5pm-4am, a 1am review belongs to the day before.
eq([16, 17, 23, 1, 3, 4].map((h) => inEveningWindow(at(h))), [false, true, true, true, true, false], 'evening window')
eq(eveningDay(at(23)), '2026-11-03', '11pm review is today')
eq(eveningDay(at(1)), '2026-11-02', '1am review is the night before')
eq([3, 4, 11, 12].map((h) => inMorningWindow(at(h))), [false, true, true, false], 'morning window')
eq(morningDay(at(7)), '2026-11-03', 'morning day')
eq(lastNightDay(at(7)), '2026-11-02', 'the morning reads yesterday')
eq(lastNightDay(at(2)), null, 'before 4am there is no last night yet')

// Carry-over: a slipped or partial one thing, an apology, something held.
const mind = (ev) => ({ objectives: ['Call Dad'], evening: ev })
eq(carryOver(mind(e), '2026-11-03'), { oneThing: 'Call Dad', apology: null, holding: true }, 'slipped + holding carry')
const hit = toEntry({ ...tapped, oneThing: 'yes' }, '2026-11-03', 'Call Dad')
eq(carryOver(mind(hit), '2026-11-03'), null, 'a clean night carries nothing')
const sorry = toEntry({ ...tapped, apology: true, apologyTo: ' Sarah ', oneThing: 'partly' }, '2026-11-03', 'Call Dad')
eq(carryOver(mind(sorry), '2026-11-03'), { oneThing: 'Call Dad', apology: { to: 'Sarah' }, holding: false }, 'apology and partial carry')
eq(carryOver(mind(sorry), '2026-11-04'), null, 'a review from another day carries nothing')
eq(carryOver(null, '2026-11-03'), null, 'no row carries nothing')

const long = 'Finish the quote for the canopy job and send it before lunch, then call the supplier about the steel and confirm the delivery window for the crew on site today'
const longE = toEntry({ ...tapped, oneThing: 'no' }, '2026-11-03', long)
eq(carryOver(mind(longE), '2026-11-03')?.oneThing, long, 'a long objective carries over whole (Codex r1)')

eq(firstObjective({ objectives: ['', '  Call Dad ', 'Lift'] }), 'Call Dad', 'first filled objective')
eq(firstObjective({}), null, 'no objectives')
eq(readAwakening({ day: '2026-11-03', at: 'x' }, '2026-11-03'), { day: '2026-11-03', at: 'x' }, 'awakening reads')
eq(readAwakening({ day: '2026-11-02', at: 'x' }, '2026-11-03'), null, 'yesterday\'s awakening is not today\'s')
eq(trainingAhead('Platform Dad', 1, 4), 'Platform Dad: session 2 of 4 this week.', 'training ahead')
eq(trainingAhead('Platform Dad', 4, 4), "Platform Dad: this week's sessions are done.", 'week done')
eq(SHORTFALLS, ['resentful', 'selfish', 'dishonest', 'afraid'], 'the four from the review')

if (fails.length) {
  console.error(fails.map((f) => '  ✗ ' + f).join('\n'))
  console.error(`evening: ${fails.length} of ${checks} FAILED`)
  process.exit(1)
}
console.log(`evening: ${checks} checks passed — review saves, carries over, and keeps its day`)
