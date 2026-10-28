// When the program's week moves on. The ONE place that decides it, for both
// finishing a session (the day page) and skipping a day (the schedule page).

import { runStartedAt } from './run'
import { scheduledDoneDays, sessionsThisWeek } from './schedule'
import type { ProgramConfig } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

export interface SkippedDay { week: number; day: number }

/**
 * Days the athlete chose to skip, from user_programs.preferences.skipped_days.
 * A skip is not training: no session row is written, so history and analytics
 * never count it. It only lets the week move on without that day. A new run
 * starts with empty preferences, so skips never carry into it.
 */
export function skippedDays(prefs: unknown, week: number): number[] {
  const raw = (prefs as { skipped_days?: unknown } | null)?.skipped_days
  if (!Array.isArray(raw)) return []
  return raw
    .filter((s): s is SkippedDay => typeof s?.week === 'number' && typeof s?.day === 'number')
    .filter(s => s.week === week)
    .map(s => s.day)
}

/** Whether `week` is finished: every session it asks for is done or skipped. */
export function weekFinished(program: ProgramConfig, week: number, done: number[], skipped: number[]): boolean {
  const accounted = scheduledDoneDays([...new Set([...done, ...skipped])], program, week)
  // The THRESHOLD is what this week asks for, not the headline daysPerWeek.
  // They diverge in test week: Hybrid Dad schedules 5 sessions in W13 against
  // a daysPerWeek of 6, so measured against the headline it could never
  // advance out of week 13.
  return accounted.length >= sessionsThisWeek(program, week)
}

export async function fetchDoneDays(supabase: Db, userId: string, slug: string, weekNumber: number): Promise<number[]> {
  const { data: workouts } = await supabase
    .from('generated_workouts')
    .select('id')
    .eq('user_id', userId).eq('program_slug', slug).eq('week_number', weekNumber)
    // this run only — see src/lib/programs/run.ts
    .gte('created_at', await runStartedAt(supabase, userId, slug))
  const ids: string[] = (workouts ?? []).map((w: { id: string }) => w.id)
  if (!ids.length) return []

  const { data: rows } = await supabase
    .from('ares_session_logs')
    .select('day_number')
    .eq('user_id', userId).in('generated_workout_id', ids)
    .eq('log_type', 'session_complete')
  return [...new Set((rows ?? []).map((r: { day_number: number }) => r.day_number))].sort() as number[]
}

/**
 * Moves user_programs.current_week on when the CURRENT week is finished.
 * Completing a previewed future or past week never moves the pointer.
 *
 * Only days the program still SCHEDULES count (scheduledDoneDays). A legacy
 * day-7 sentinel from before Power Dad dropped Sunday would otherwise stand in
 * for a session never trained, and the week would advance a day early —
 * permanently, since current_week drives the macro position the whole percent
 * engine reads. See src/lib/programs/schedule.ts.
 *
 * The update is compare-and-set on the week it read, so two finishes at once
 * cannot move it two weeks.
 */
export async function advanceWeekIfDone(supabase: Db, userId: string, slug: string, program: ProgramConfig): Promise<void> {
  const { data: prog } = await supabase
    .from('user_programs')
    .select('current_week, preferences')
    .eq('user_id', userId).eq('program_slug', slug).eq('status', 'active')
    .maybeSingle()
  const week: number = prog?.current_week ?? 1
  const done = await fetchDoneDays(supabase, userId, slug, week)
  if (!weekFinished(program, week, done, skippedDays(prog?.preferences, week))) return
  await supabase
    .from('user_programs')
    .update({ current_week: week + 1 })
    .eq('user_id', userId).eq('program_slug', slug).eq('status', 'active').eq('current_week', week)
}
