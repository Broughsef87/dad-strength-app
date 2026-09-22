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

/** A write that did not run because the account that made it is no longer signed in. */
export const ACCOUNT_CHANGED = { error: { message: 'the account that made this change is no longer signed in' } }

type Auth = { auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> } }

/**
 * Queue `job` for the account `owner` — captured when the change was made — and
 * run it only if that account is still the one signed in when its turn comes.
 */
export function runAs<T>(db: Auth, owner: string, job: () => Promise<T>): Promise<T | typeof ACCOUNT_CHANGED> {
  return checkinQueue(async () => {
    const { data: { user } } = await db.auth.getUser()
    if (!user || user.id !== owner) return ACCOUNT_CHANGED
    return job()
  })
}
