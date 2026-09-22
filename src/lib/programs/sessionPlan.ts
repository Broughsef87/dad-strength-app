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
// trained. The page records the plan at that moment (the first log), so "stored"
// means "trained under", not "first opened".
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

/**
 * The plan this session's cards are drawn from, before its session overrides.
 *
 * Trained → what it was trained under: the stored plan when the row has one,
 * with logged names reattached. Not trained → `built`, untouched, so a day not
 * yet started still picks up a correction.
 */
export function sessionPlan(built: DayPlan, stored: unknown, logs: readonly LoggedRow[]): { plan: DayPlan; source: 'stored' | 'built' } {
  if (!isTrained(logs)) return { plan: built, source: 'built' }
  if (isStoredPlan(stored)) return { plan: reattachLogged(stored, logs), source: 'stored' }
  return { plan: reattachLogged(built, logs), source: 'built' }
}
