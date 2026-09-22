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
// "Trained under" is a RECORD the page writes, marked `plan_recorded`: the plan
// the cards are drawn from, written while an untrained session loads (before
// any card exists to log against), and on a swap BEFORE the card changes — so
// the record is never behind what the athlete saw. It is never written around a
// log: two rounds of doing that raced the per-keystroke set saves and lost what
// was typed (Codex r2, r3). A trained session is drawn from its record EXACTLY.
// Nothing outside the session — not its logs, not today's substitutions — is
// allowed to second-guess it (Codex r1, r5). A row stored before the record
// existed carries only the plan of its FIRST OPEN, which may predate what was
// trained — so that one, and only that one, is reconciled against its logs.
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
export function reattachLogged(plan: DayPlan, logs: readonly LoggedRow[], built?: DayPlan): DayPlan {
  let changed = false
  const items = plan.items.map((i) => {
    if (i.kind !== 'lift' && i.kind !== 'plyo') return i
    const names = [...new Set(logs.filter((l) => l.slot === i.slot).map((l) => l.block_name))]
    // Exactly one name at the slot, and not the card's own. No logs, the
    // card's own name, or a mix — the card stays as it is.
    if (names.length !== 1 || names[0] === i.name) return i
    const b = built?.items.find((x) => (x.kind === 'lift' || x.kind === 'plyo') && x.slot === i.slot && x.name === names[0])
    changed = true
    // A logged name the BUILD also carries at this slot is a swap the athlete
    // saved: take its identity with it, or the swap picker reads the swapped
    // movement as the original — nothing to revert, and the next swap filed
    // under the wrong original (Codex r3). Identity only: the build never
    // decides WHETHER a card moves.
    return b && (b.kind === 'lift' || b.kind === 'plyo') ? { ...i, name: names[0], subbedFrom: b.subbedFrom } : { ...i, name: names[0] }
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
  if (isStoredPlan(stored)) return { plan: recorded ? stored : reattachLogged(stored, logs, built), source: 'stored' }
  return { plan: reattachLogged(built, logs, built), source: 'built' }
}

// ── One writer for the row ──────────────────────────────────────────────────
// Every write of a session's workout_data — its record, its overrides — sends
// the WHOLE object, so they go through one queue (Codex r3). The queue itself
// lives in src/lib/serialWriter.ts, shared with the check-in writers (FOR-231).
export { serialWriter } from '../serialWriter'
import { canonical } from '../canonical'

/**
 * The same plan, whatever order its keys arrived in. Postgres jsonb reorders
 * object keys, so a plan read back from a row never compares equal to one built
 * fresh by string — and a comparison that always said "different" would write
 * the row on every open.
 */
export function samePlan(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b)
}
