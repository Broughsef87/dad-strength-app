import { DayPlan, Prescription, ProgramConfig } from './types'

/**
 * The SHAPE of a training week: which days it runs, and what counts as a block.
 *
 * Both questions were being answered in more than one place, and both answers
 * had drifted. This module is the single source for them.
 */

// ── What counts as a block ───────────────────────────────────────────────────

/**
 * Cards that cost no extra STATION.
 *
 * The 6-block session budget is about the clock — "I have a kid, I can't spend
 * 2+ hours" — so it counts stations you set up, not cards you tick:
 *
 *   *_back   the back-off. Same bar, same rack, immediately after the top set.
 *   plyo_2   the second jump variation, back to back with the first at the same
 *            box. One trip to the corner, two movements.
 *
 * plyo_2 became load-bearing in FOR-195: Saturday gained the relocated core
 * slot, and saturdayPlyo returns a PAIR in mesos 2 and 3. Counted as two
 * stations that reads 7 and the day is over its own budget; counted as the one
 * station it is, Saturday sits at 6 in every meso.
 */
export function isStationFree(item: Prescription): boolean {
  return item.slot.endsWith('_back') || item.slot === 'plyo_2'
}

/**
 * Stations in a day — what the athlete actually sets up.
 *
 * The schedule screen and the program sweep each had their own copy of this,
 * and only the sweep learned about plyo_2, so the app would have printed
 * "7 blocks" on a Saturday the program's own budget calls 6. Both call this now.
 */
export function blockCount(plan: DayPlan): number {
  return plan.items.filter(i => !isStationFree(i)).length
}

// ── Which days the week runs ─────────────────────────────────────────────────

/**
 * The day numbers this program actually programs in a given week.
 *
 * Derived from buildDay rather than assumed, because `daysPerWeek` is a COUNT,
 * not a range: Dad Strong is `daysPerWeek: 5` and trains days 1, 2, 4, 6 and 7
 * — Mon, Tue, Thu, Sat, Sun. Anything that treats the count as `1..n` silently
 * drops that program's Saturday and Sunday.
 *
 * Maxes are irrelevant to whether a day is a rest day, so it probes with none —
 * the same call autoreg already makes to map slot rotations.
 */
export function scheduledDayNumbers(program: ProgramConfig, weekNumber: number): number[] {
  const out: number[] = []
  for (let d = 1; d <= 7; d++) {
    if (program.buildDay(weekNumber, d, {}).dayType !== 'rest') out.push(d)
  }
  return out
}

/**
 * How many sessions this week actually asks for.
 *
 * NOT daysPerWeek. That is a headline number on the program card; this is the
 * count the week is finished at, and the two diverge in test week — Hybrid
 * Endurance schedules 5 sessions in W13 against a daysPerWeek of 6, so it could
 * never advance out of week 13 at all. Dad Built schedules 7 there.
 */
export function sessionsThisWeek(program: ProgramConfig, weekNumber: number): number {
  return scheduledDayNumbers(program, weekNumber).length
}

/**
 * Filter completed day numbers to the days the program actually schedules.
 *
 * A program's shape can change under a user who is mid-macro. FOR-195 cut Power
 * Dad's Sunday: daysPerWeek went 7 to 6 and day 7 became a rest day. Every
 * surface derives from the schedule and so followed along — but the completion
 * SENTINELS did not. A `session_complete` row for day 7 sits in
 * ares_session_logs forever, and the code that counts progress counted it:
 * Mon/Tue/Wed/Fri/Sat is five real sessions plus one ghost = 6, and the week
 * advanced with Thursday never trained. current_week IS the macro position the
 * whole percent engine reads, so that never self-corrects.
 *
 * The rows are real training and stay exactly where they are, still feeding
 * history and analytics. They just stop counting as this week's progress —
 * deleting them would erase a session the athlete actually did.
 *
 * ── this used to be an OR, and FOR-196 retired the second half ─────────────
 *
 * It read `scheduled.has(d) || d <= daysPerWeek`, because Dad Strong's rendered
 * days and scheduled days disagreed: the hub showed Mon-Fri while the program
 * trained Mon/Tue/Thu/Sat/Sun, so its Saturday and Sunday were unreachable and
 * its Wednesday and Friday rendered as rest days the finish button completed
 * anyway. Its week advanced on those two fake completions, and dropping them
 * would have stranded the program.
 *
 * FOR-196 fixed the disagreement at the source — every surface now iterates
 * scheduledDayNumbers, so rendered == scheduled for every program in every
 * week, and the rendered half of the OR became dead weight. A day that is not
 * scheduled is not reachable and cannot be completed.
 */
export function scheduledDoneDays(
  days: number[], program: ProgramConfig, weekNumber: number,
): number[] {
  const scheduled = new Set(scheduledDayNumbers(program, weekNumber))
  return days.filter(d => scheduled.has(d))
}

// ── What a day is called, and whether it can be finished ─────────────────────

const WEEKDAY = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/**
 * The label a day carries in a week list.
 *
 * Keyed off the day NUMBER, not the array position. The hub used to index its
 * label array by position, which was accidentally correct only while every
 * rendered week was contiguous — the moment Dad Strong's week became
 * Mon/Wed/Fri/Sat it would have printed mon/tue/wed/thu against days 1/3/5/6.
 *
 * A flexible day has no weekday to print. See DayPlan.flexible.
 */
export function dayLabel(plan: DayPlan): string {
  if (plan.flexible) return 'anytime'
  return WEEKDAY[plan.dayNumber - 1] ?? ''
}

/**
 * Can this day be finished?
 *
 * A rest day cannot. It prescribes nothing, so "completing" it writes a
 * session_complete sentinel for a session that does not exist — which is
 * precisely how Dad Strong's week used to advance.
 *
 * This has to live in the COMPLETION path, not the button. Once rendered ==
 * scheduled no rest day is listed anywhere, but /train/dad-strong/2 is still a
 * URL anyone can type, and until FOR-196 it would have completed.
 */
export function isCompletable(plan: DayPlan): boolean {
  return plan.dayType !== 'rest'
}
