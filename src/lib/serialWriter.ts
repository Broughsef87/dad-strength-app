// ── One writer for a record ──────────────────────────────────────────────────
// A write that sends a WHOLE value — a session's workout_data, a day's check-in
// state — can land out of order with another in flight, and the older then
// puts back what the newer changed: an exercise added while a swap's record was
// being written, gone (FOR-248, Codex r3); gratitude typed a letter at a time,
// the record left holding an earlier letter (FOR-231). So they queue: each
// starts only when the one before it has finished, and whatever is sent last
// carries every change made before it.
//
// One definition, shared — FOR-248's training page and FOR-231's check-in
// writers both use this, and neither keeps a copy.

/** A queue of writes that run strictly one at a time, in the order asked for. A failed write does not stop the queue. */
export function serialWriter(): <T>(write: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve()
  return <T>(write: () => Promise<T>): Promise<T> => {
    const run = tail.then(() => write(), () => write())
    tail = run.then(() => undefined, () => undefined)
    return run
  }
}
