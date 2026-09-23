// ── One queue for the day's check-in rows (FOR-231) ──────────────────────────
// MorningProtocol and DailyObjectivesCard both write daily_checkins — the
// protocol into spirit_state, the objectives into mind_state, and the Goals step
// of the one into the column the other shows. With a queue each, their writes
// could land in either order: a tick on the card, built from objectives the
// Goals step was replacing, landed after the replacement and put the old
// objectives back (Codex r2). So there is ONE queue, shared by every writer of
// these rows, and the card's reads of the row go through it too — a read runs
// after every write asked for before it, and reads it back.
//
// It is a module, so it outlives any one component, and a write queued before a
// sign-out would otherwise run under whoever signs in next. Every job carries
// the account it was made by, and runs only while that account is still the
// one signed in (runAs).
import { serialWriter } from './serialWriter'

export const checkinQueue = serialWriter()

/** A write that did not run: the account that made it is not the one signed in, or none was known. */
export const ACCOUNT_CHANGED = { error: { message: 'the account that made this change is no longer signed in' } }

/** A write the caller had already moved past by the time its turn came. Nothing was spent on it, and nothing is wrong. */
export const SUPERSEDED = { error: null, stale: true } as const

type Auth = { auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> } }

/**
 * Queue `job` for the account `owner` — fixed when the change was made — and
 * run it only if that account is still the one signed in when its turn comes.
 * The job is handed that account, so what it writes is filed under the account
 * that was checked, and no other.
 */
export function runAs<T>(
  db: Auth,
  owner: string | Promise<string | null>,
  job: (me: string) => Promise<T>,
  /** Asked when this job's turn comes: has the caller moved past it? */
  unless?: () => boolean,
): Promise<T | typeof ACCOUNT_CHANGED | typeof SUPERSEDED> {
  return checkinQueue(async () => {
    // Asked BEFORE anything is spent: gratitude saves on every keystroke, and
    // a job the caller has moved past should cost neither a round trip to ask
    // who is signed in nor the queue's time while everything else waits
    // (Codex r30). What does run is still checked, every time.
    if (unless?.()) return SUPERSEDED
    const me = await owner
    if (!me) return ACCOUNT_CHANGED
    const { data: { user } } = await db.auth.getUser()
    if (!user || user.id !== me) return ACCOUNT_CHANGED
    return job(me)
  })
}

/**
 * The account a change is made by, fixed AT the change: the one already known,
 * or — when the open-time check could not reach the server — asked for now
 * (Codex r3), so a failed open does not refuse every change until a reload.
 * Never later, inside the queue, where it would be whoever is signed in by then.
 */
export function accountAtChange(db: Auth, known: { current: string | null }): Promise<string | null> {
  if (known.current) return Promise.resolve(known.current)
  return db.auth.getUser().then(({ data: { user } }) => {
    if (user) known.current = user.id
    return user?.id ?? null
  }, () => null)
}
