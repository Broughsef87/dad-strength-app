// ── Closing the tab on a change the row does not have (FOR-231) ──────────────
// A change on its way to the row, or one that did not get there, lives in the
// tab and nowhere else: closing or reloading loses it, so closing asks first.
//
// The guard belongs to the STORE that holds those changes, not to a component
// (Codex r7): moving to another page in the app unmounts the card the change
// was made on, and the change stays. A listener that went with the component
// would leave it unprotected exactly where it is most likely to be lost.
const held = new Set<string>()

const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }

/** `who` has changes the row does not have, or no longer does. */
export function setUnloadGuard(who: string, on: boolean) {
  if (typeof window === 'undefined') return
  const had = held.size > 0
  if (on) held.add(who); else held.delete(who)
  const has = held.size > 0
  if (has === had) return
  if (has) window.addEventListener('beforeunload', warn)
  else window.removeEventListener('beforeunload', warn)
}

/** Only for checks: who is holding a change the row does not have. */
export const unloadGuards = (): string[] => [...held]
