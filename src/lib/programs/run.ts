/**
 * A program RUN — one attempt at a program, starting the day you activate it.
 *
 * `user_programs` holds exactly one row per user (user_id is UNIQUE), so
 * switching programs overwrites it: `current_week` goes back to 1 and
 * `started_at` becomes now. That is already a restart, by construction.
 *
 * What was never scoped is the evidence. Completion is derived from
 * `generated_workouts` filtered on user + slug alone, and those rows outlive
 * the switch — so coming back to a program you had partly done, the app read
 * the old sentinels and dropped you back where you left off, while
 * `current_week` insisted you were on week 1. Two sources of truth eight weeks
 * apart, and the screen believed whichever it happened to read.
 *
 * Measured on the reporting account at the time of the fix:
 *
 *     program_slug        hybrid-power
 *     current_week        1        <- correctly reset
 *     workouts_this_run   0        <- genuinely a fresh start
 *     workouts_all_time   81       <- what the UI was counting
 *     max_week_all_time   9        <- so it showed week 9
 *
 * Scoping progress queries to `created_at >= started_at` makes the evidence
 * agree with the intent. Old rows are left exactly where they are: they are
 * real training history and still feed the history screen, PRs and analytics.
 * They simply stop counting toward THIS run.
 *
 * No migration was needed — `generated_workouts.created_at` and
 * `user_programs.started_at` both already exist, and the unique indexes on
 * generated_workouts are partial (legacy/zeus/ares only), so a new run is free
 * to create its own rows for a week/day another run already used.
 */

// Before any run existed, everything counts — used when the row is missing so
// a lookup failure never silently hides a user's whole history.
export const RUN_EPOCH = '1970-01-01T00:00:00.000Z'

/**
 * When the CURRENT run of `slug` began. Pass the result to `.gte('created_at', …)`
 * on any query that answers "how far along am I".
 */
export async function runStartedAt(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  slug: string,
): Promise<string> {
  const { data } = await supabase
    .from('user_programs')
    .select('started_at')
    .eq('user_id', userId)
    .eq('program_slug', slug)
    .maybeSingle()
  return (data?.started_at as string | undefined) ?? RUN_EPOCH
}
