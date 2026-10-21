// One find-or-create per session key at a time, shared across concurrent
// loads in this tab. Two loads of the train page in the same moment each
// found no generated_workouts row and each inserted one (the macrocycle
// programs have no unique index to stop it), splitting a session's sets
// across two rows. The second caller now gets the first one's result, with
// `shared: true` so it knows the row it got was made by someone else and
// must be adopted like any existing row, not drawn from its own build. The
// entry clears when it settles, so a later load looks again.
const lookups = new Map<string, Promise<unknown>>()

export async function findOrCreateSession<T>(key: string, run: () => Promise<T>): Promise<{ value: T; shared: boolean }> {
  const pending = lookups.get(key)
  if (pending) return { value: (await pending) as T, shared: true }
  const p = run().finally(() => lookups.delete(key))
  lookups.set(key, p)
  return { value: await p, shared: false }
}
