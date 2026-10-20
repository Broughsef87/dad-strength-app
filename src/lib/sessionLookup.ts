// One find-or-create per session key at a time, shared across concurrent
// loads in this tab. Two loads of the train page in the same moment each
// found no generated_workouts row and each inserted one (the macrocycle
// programs have no unique index to stop it), splitting a session's sets
// across two rows. The second caller now gets the first one's result. The
// entry clears when it settles, so a later load looks again.
const lookups = new Map<string, Promise<unknown>>()

export function findOrCreateSession<T>(key: string, run: () => Promise<T>): Promise<T> {
  const pending = lookups.get(key)
  if (pending) return pending as Promise<T>
  const p = run().finally(() => lookups.delete(key))
  lookups.set(key, p)
  return p
}
