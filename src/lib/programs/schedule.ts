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
 * Filter completed day numbers to the days that still MEAN something.
 *
 * A program's shape can change under a user who is mid-macro. FOR-195 cut Power
 * Dad's Sunday: daysPerWeek went 7 to 6 and day 7 became a rest day. Every
 * surface derives from daysPerWeek and so followed along — but the completion
 * SENTINELS did not. A `session_complete` row for day 7 sits in
 * ares_session_logs forever, and the code that counts progress counted it.
 *
 * The concrete failure, found by Codex on the FOR-195 branch:
 *
 *     advanceWeekIfDone compares doneDays.length against daysPerWeek. With a
 *     legacy Sunday sentinel already in the current week, Mon/Tue/Wed/Fri/Sat
 *     is five real sessions plus one ghost = 6, and the week advances with
 *     Thursday never trained. That does not self-correct: current_week IS the
 *     macro position the whole percent engine reads.
 *
 * Same shape as the run-scoping bug in ./run.ts, one axis over — there the
 * stale evidence came from a previous RUN, here from a previous SCHEDULE. Same
 * resolution too: the rows are real training and stay exactly where they are,
 * still feeding history and analytics. They just stop counting as this week's
 * progress. Deleting them would erase a session the athlete actually did.
 *
 * ── the rule, and why it is an OR ──────────────────────────────────────────
 *
 * A day counts if the program SCHEDULES it, or if the app still RENDERS it.
 * A ghost is a day that is neither.
 *
 * The second half is not decoration, and two earlier versions of this function
 * were wrong without it:
 *
 *   `d <= daysPerWeek` alone      daysPerWeek is a COUNT, not a range. Dad
 *                                 Strong is 5 days on Mon/Tue/Thu/Sat/Sun, so
 *                                 this dropped its Saturday and Sunday and that
 *                                 program's week could never advance.
 *
 *   scheduled days alone          Dad Strong's hub renders days 1-5, so days 6
 *                                 and 7 are unreachable from the UI while days
 *                                 3 and 5 render as rest days that the finish
 *                                 button will still complete. Its week advances
 *                                 TODAY on those two fake completions. Dropping
 *                                 them strands the program just as badly, from
 *                                 the other direction.
 *
 * So the OR deliberately preserves a wart: Dad Strong's rendered-but-rest days
 * keep counting, exactly as they do now. That program's real problem is that
 * its scheduled days and its rendered days disagree at all, which is a
 * pre-existing bug in Dad Strong and wants its own ticket — not a silent
 * behaviour change smuggled in on a Power Dad revision.
 *
 * Measured across all four programs, this changes exactly one thing in the
 * codebase: Power Dad's day-7 sentinels stop counting. Everything else is
 * byte-for-byte the behaviour it had before.
 *
 * Use this anywhere a done-day list is COUNTED against daysPerWeek. Places that
 * only test membership — `doneDays.includes(i + 1)` while rendering daysPerWeek
 * pills — are already safe, because they never look past the last rendered day.
 */
export function scheduledDoneDays(
  days: number[], program: ProgramConfig, weekNumber: number,
): number[] {
  const scheduled = new Set(scheduledDayNumbers(program, weekNumber))
  return days.filter(d => scheduled.has(d) || (d >= 1 && d <= program.daysPerWeek))
}
