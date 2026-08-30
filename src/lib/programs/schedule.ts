/**
 * Which completed days count toward the CURRENT week's progress.
 *
 * A program's shape can change under a user who is mid-macro. FOR-195 cut
 * Power Dad's Sunday: daysPerWeek went 7 to 6 and day 7 became a rest day. Every
 * surface derives from daysPerWeek and so followed along — but the completion
 * SENTINELS did not. A `session_complete` row for day 7 sits in
 * ares_session_logs forever, and the code that counts progress counted it.
 *
 * The concrete failure, found by Codex on the FOR-195 branch:
 *
 *     advanceWeekIfDone compares doneDays.length against daysPerWeek. With a
 *     legacy Sunday sentinel already in the current week, Mon/Tue/Wed/Fri/Sat
 *     is five real sessions plus one ghost = 6, and the week advances with
 *     Thursday never trained. Every following week is then off by one, which
 *     also shifts the macro position the whole percent engine reads.
 *
 * Same shape as the run-scoping bug in ./run.ts, one axis over: there the stale
 * evidence was from a previous RUN, here it is from a previous SCHEDULE. The
 * rows stay exactly where they are — they are real training and still feed
 * history and analytics. They just stop counting as this week's progress.
 *
 * Not a migration, deliberately. Deleting the sentinels would erase a session
 * the athlete actually did; this only changes what the number in front of him
 * means.
 */

/**
 * Filter completed day numbers to the days the program actually schedules.
 *
 * Use this anywhere a done-day list is COUNTED (`.length` against daysPerWeek).
 * Places that only test membership — `doneDays.includes(i + 1)` while rendering
 * `daysPerWeek` pills — are already safe, because they never look past the last
 * scheduled day.
 */
export function scheduledDoneDays(days: number[], daysPerWeek: number): number[] {
  return days.filter(d => Number.isFinite(d) && d >= 1 && d <= daysPerWeek)
}
