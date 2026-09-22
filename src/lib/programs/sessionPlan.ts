// ── The plan a session is drawn from (FOR-248) ───────────────────────────────
// The training-day page rebuilt every session from buildDay each time it was
// opened — a session trained months ago included. The plan it was trained under
// was already on its row (generated_workouts.workout_data.plan), and nothing
// read it, so any change to a program silently rewrote what every past session
// appeared to prescribe. FOR-244's jump ramp made it visible: a week-one Broad
// Jump logged before the ramp shipped reopened as Box Jumps, and because logs
// are matched to cards by movement NAME, the sets recorded on it stopped
// appearing on any card at all.
//
// THE RULE: a session that has been trained — any log row on it, the completion
// sentinel included — is drawn from what it was trained under. One that has not
// is built fresh, so it still picks up every correction until the moment it is
// trained.
//
// "Trained under" is a RECORD the page writes, marked `plan_recorded`: before
// the first log lands, and again when a swap changes a trained session. A row
// stored before that record existed carries only the plan of its FIRST OPEN,
// which may predate what was actually trained — so that one, and only that one,
// is reconciled against its logs. A recorded plan is drawn exactly as recorded:
// a swap the athlete made is an explicit choice, and logs never overrule it
// (Codex r1).
//
// Deterministic and pure: no clock, no I/O, no AI. buildDay stays the only
// source of a prescription; this decides only which prescription a card shows.
import type { DayPlan } from './types'

/** What the rule reads off a log row: the name it was written under, and the card slot. */
export interface LoggedRow {
  block_name: string
  slot: string | null
}

/** A stored plan the page can draw — anything else on the row is ignored, never trusted into a render. */
export function isStoredPlan(v: unknown): v is DayPlan {
  return !!v && typeof v === 'object' && Array.isArray((v as { items?: unknown }).items)
}

/** Has this session been trained? Any log row at all — a set, a note, or the completion sentinel. */
export function isTrained(logs: readonly LoggedRow[]): boolean {
  return logs.length > 0
}

/**
 * Put the logged name back on a card whose stored name has no logs.
 *
 * Logs are keyed to a card by NAME, and that key is a unique index in the
 * database, so it cannot be re-keyed by slot here. A session stored at its
 * first open and trained after a program change carries the old name while
 * its sets were written under the new one — attached to nothing on screen.
 * What was logged at a slot is the strongest evidence of what was trained
 * there, so a card whose own name has NO logs at its slot, where the logs at
 * that slot all carry ONE other name, is shown under that name. Its sets
 * reattach, and editing one updates the same row instead of writing a second.
 *
 * Never a guess: two different names at one slot, none of them the card's,
 * and the card is left exactly as it was.
 */
export function reattachLogged(plan: DayPlan, logs: readonly LoggedRow[]): DayPlan {
  let changed = false
  const items = plan.items.map((i) => {
    if (i.kind !== 'lift' && i.kind !== 'plyo') return i
    const names = [...new Set(logs.filter((l) => l.slot === i.slot).map((l) => l.block_name))]
    // Exactly one name at the slot, and not the card's own. No logs, the
    // card's own name, or a mix — the card stays as it is.
    if (names.length !== 1 || names[0] === i.name) return i
    changed = true
    return { ...i, name: names[0] }
  })
  return changed ? { ...plan, items } : plan
}

/** The marker the page writes beside a plan that is the record of what was trained. */
export const RECORDED = 'plan_recorded'

/** Is this row's stored plan the page's record, rather than a first-open snapshot? */
export function isRecorded(workoutData: Record<string, unknown> | null | undefined): boolean {
  return workoutData?.[RECORDED] === true
}

/**
 * The plan this session's cards are drawn from, before its session overrides.
 *
 * Not trained → `built`, untouched, so a day not yet started still picks up a
 * correction. Trained → what it was trained under: a RECORDED plan exactly as
 * recorded; an unrecorded one (a row from before the record) reconciled against
 * its logs; no stored plan at all, the build reconciled against its logs.
 */
export function sessionPlan(built: DayPlan, stored: unknown, logs: readonly LoggedRow[], recorded = false): { plan: DayPlan; source: 'stored' | 'built' } {
  if (!isTrained(logs)) return { plan: built, source: 'built' }
  if (isStoredPlan(stored)) return { plan: recorded ? stored : reattachLogged(stored, logs), source: 'stored' }
  return { plan: reattachLogged(built, logs), source: 'built' }
}

// ── Writing the record: one at a time, and everyone waits for it ────────────
// A log is written on every keystroke of a set, and each one asks for the
// record first. Marking the session recorded BEFORE the write finished let the
// second keystroke skip the wait and save "225" while the first — still
// waiting — saved "2" over it when the record landed (Codex r2, P1). So the
// record in flight is SHARED: every log asked for while it is pending waits on
// that same write and is then issued in the order it was asked for, and the
// session counts as recorded only once the write has succeeded.

/** Where a session's record stands. `pending` is the write in flight, if any. */
export interface RecordState {
  recorded: boolean
  pending: Promise<unknown> | null
}

/** A write's outcome, in the shape the database client returns it. */
export type WriteResult = { error?: { code?: string; message?: string } | null } | null | undefined
/** A write that THREW, reported like one that returned an error. */
const thrown = (e: unknown): WriteResult => ({ error: { message: e instanceof Error ? e.message : String(e) } })

/**
 * Record the plan, once. Already recorded → nothing to do. A record in flight →
 * wait on THAT one. Otherwise write, and count as recorded only if it landed;
 * a failed record leaves the session unrecorded, so the next log tries again.
 * Never throws: a log must never be lost to its record.
 */
export function recordOnce(state: RecordState, write: () => Promise<WriteResult>): Promise<WriteResult> {
  if (state.recorded) return Promise.resolve(null)
  if (state.pending) return state.pending as Promise<WriteResult>
  const p: Promise<WriteResult> = write()
    .then((res) => { if (res && !res.error) state.recorded = true; return res }, thrown)
    .finally(() => { if (state.pending === p) state.pending = null })
  state.pending = p
  return p
}

/**
 * Write the record AGAIN because the plan changed under a trained session (a
 * swap). Waits for any record already in flight, holds every log asked for
 * meanwhile behind this one, and leaves the session UNRECORDED if it fails, so
 * the next log writes the current plan instead of saving sets under a name the
 * stored record does not have (Codex r2).
 */
export function rewriteRecord(state: RecordState, write: () => Promise<WriteResult>): Promise<WriteResult> {
  const before = state.pending ?? Promise.resolve()
  state.recorded = false
  const p: Promise<WriteResult> = before
    .then(() => write(), () => write())
    .then((res) => { state.recorded = !!res && !res.error; return res }, (e: unknown) => { state.recorded = false; return thrown(e) })
    .finally(() => { if (state.pending === p) state.pending = null })
  state.pending = p
  return p
}

/**
 * The same plan, whatever order its keys arrived in. Postgres jsonb reorders
 * object keys, so a plan read back from a row never compares equal to one built
 * fresh by string — and a comparison that always said "different" would write
 * the row on every open.
 */
export function samePlan(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b)
}
function canonical(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']'
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return '{' + Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + canonical(o[k])).join(',') + '}'
  }
  return JSON.stringify(v)
}
