// ── The day's objectives: the record, and the changes made against it (FOR-231) ──
// daily_checkins.mind_state is the record of the day's objectives. A change made
// on the objectives card is an INTENT against that record — "these are the
// day's objectives", "objective i is done" — made against the objective set
// that was on screen. The card keeps every intent until the row has it
// (Codex r3):
//
//   - a change that failed to save is not forgotten: the next write carries it,
//     and so does Retry;
//   - the card shows the record with its intents on top, so an older write's
//     answer landing never takes back a newer change;
//   - an intent made against an objective set the record no longer holds — the
//     Goals step, or another device, replaced it — is dead, and is dropped.
//
// Pure: no React, no Supabase. The check suite drives it directly.

export type Mind = { objectives: string[]; completed: boolean[]; lockedIn: boolean }

export type Intent =
  | { kind: 'set'; day: string; basis: string[]; objectives: string[] }
  | { kind: 'tick'; day: string; basis: string[]; index: number; done: boolean }

/** The shape stored in daily_checkins.mind_state. */
export type MindRow = { date: string; objectives: string[]; completedObjectives: boolean[]; lockedIn: boolean }

export const EMPTY: Mind = { objectives: [], completed: [], lockedIn: false }

// Rows written before objectives were stored dense can still be sparse, and the
// render path pairs objective i with completed i. Compact them TOGETHER so each
// flag keeps the objective it belongs to; compacting the strings alone is what
// silently shifts a completion onto the wrong line.
export function normalise(
  objs: readonly unknown[] | undefined,
  done: readonly unknown[] | undefined,
): { objectives: string[]; completed: boolean[] } {
  const pairs: Array<[string, boolean]> = (objs ?? [])
    .map((o, i): [string, boolean] => [String(o ?? ''), Boolean((done ?? [])[i])])
    .filter(([o]) => o.trim().length > 0)
  return { objectives: pairs.map((p) => p[0]), completed: pairs.map((p) => p[1]) }
}

/** A stored mind_state — or none — as the record it says. */
export function fromRow(ms: unknown): Mind {
  const m = (ms && typeof ms === 'object' ? ms : {}) as { objectives?: unknown; completedObjectives?: unknown; lockedIn?: unknown }
  const n = normalise(
    Array.isArray(m.objectives) ? m.objectives : undefined,
    Array.isArray(m.completedObjectives) ? m.completedObjectives : undefined,
  )
  return { ...n, lockedIn: !!m.lockedIn }
}

export function toRow(day: string, m: Mind): MindRow {
  return { date: day, objectives: m.objectives, completedObjectives: m.completed, lockedIn: m.lockedIn }
}

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((v, i) => v === b[i])

/**
 * The record with `intents` applied in the order they were made. Each one
 * applies only if the objectives it was made against are the ones the record
 * holds at that point; otherwise it is dead. A set replaces the objectives and
 * clears every flag; a tick changes its own flag and nothing else.
 */
export function applyIntents<I extends Intent>(record: Mind, intents: readonly I[]): { state: Mind; applied: I[]; dead: I[] } {
  let state = record
  const applied: I[] = [], dead: I[] = []
  for (const it of intents) {
    if (!sameSet(state.objectives, it.basis)) { dead.push(it); continue }
    state = it.kind === 'set'
      ? { objectives: [...it.objectives], completed: it.objectives.map(() => false), lockedIn: true }
      : { ...state, completed: state.completed.map((v, j) => (j === it.index ? it.done : v)) }
    applied.push(it)
  }
  return { state, applied, dead }
}

/**
 * One card's view of the record: the last row it read, in queue order, and the
 * changes made on it that the row does not have yet.
 */
export function objectivesBook<I extends Intent>(day: string) {
  let record: { day: string; mind: Mind; seq: number } = { day, mind: EMPTY, seq: 0 }
  let pending: I[] = []
  let reads = 0
  const onDay = (d: string) => pending.filter((p) => p.day === d)
  const settle = (done: readonly I[]) => { const s = new Set(done); pending = pending.filter((p) => !s.has(p)) }
  return {
    /** The day on screen. Every change made on the card belongs to it. */
    day: () => record.day,
    /** What the card shows: the record, with every change made here that the row does not have yet on top. */
    shown: (): Mind => applyIntents(record.mind, onDay(record.day)).state,
    /** Changes made here that the row does not have yet. */
    pending: (): readonly I[] => pending,
    /** Days holding such changes, oldest change first. */
    days: (): string[] => [...new Set(pending.map((p) => p.day))],
    /**
     * The day on screen moves forward to `d`. A lock-in is for the day it is
     * typed on, and a card left open across midnight still shows yesterday
     * (Codex r4). Nothing is known of `d` until its row is read, so its record
     * is empty until then; changes pending for earlier days keep their days.
     */
    turn(d: string) { if (d > record.day) record = { day: d, mind: EMPTY, seq: record.seq } },
    /** The first-frame paint. Only until a row has been read; it never outranks one. */
    paint(d: string, ms: unknown) { if (record.seq === 0) record = { day: d, mind: fromRow(ms), seq: 0 } },
    intend(i: I) { pending = [...pending, i] },
    /** Called INSIDE the queue, as a read of the row lands: its place in queue order. */
    nextRead: () => ++reads,
    /**
     * A row read landed. It becomes the record only if no read later in the
     * queue already has — an older answer arriving last is dropped. `load`: an
     * open or a refresh, which decides the day on screen; any other read only
     * updates the day already there, and nothing takes the card back a day.
     * Changes dead against the new record go.
     */
    adopt(d: string, ms: unknown, seq: number, load = false): boolean {
      if (seq <= record.seq || d < record.day) return false
      if (!load && d !== record.day) return false
      record = { day: d, mind: fromRow(ms), seq }
      settle(applyIntents(record.mind, onDay(d)).dead)
      return true
    },
    /**
     * Inside the queue, having just read day `d`'s row: that row with the day's
     * changes applied — what to write, if any applied — and the changes that
     * writing it settles, dead ones included.
     */
    plan(d: string, ms: unknown): { write: Mind | null; settles: I[] } {
      const { state, applied, dead } = applyIntents(fromRow(ms), onDay(d))
      return { write: applied.length ? state : null, settles: [...applied, ...dead] }
    },
    /** The row has these now — written, or dead against it. They are no longer pending. */
    settle,
  }
}
