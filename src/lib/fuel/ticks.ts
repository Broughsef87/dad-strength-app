// ── Fuel: check state, and who owns it ───────────────────────────────────────
//
// THE ROW IS AUTHORITATIVE. fuel_lists.items[].checked is the truth; the
// phone renders it and proposes changes to it. Local state is an optimistic
// render plus an OUTBOX of intents — never a second copy of the truth, never
// merged with the row. This is decided here, before any UI, because the
// morning protocol left the same question open and it cost nine Codex
// findings across seven rounds (FOR-231). Fuel decides it once:
//
//   1. A tap enqueues an intent {key, checked, at} in the outbox and renders
//      it immediately as PENDING — visibly not yet saved.
//   2. The outbox flushes in order through one atomic database function per
//      intent. Each acknowledgement returns the WHOLE row's items, and that
//      replaces the local render. The row won; the intent is discarded.
//   3. Offline, the outbox persists (localStorage) and flushes when the
//      network returns or the page mounts. Reload with a full outbox, and the
//      pending ticks are still pending — shown as such — until the row takes
//      them.
//   4. On any conflict — the row says something the outbox does not — the row
//      wins. There is no merge rule because there is nothing to merge: the
//      outbox holds intents, not state.
//
// Everything in this file is pure so the check can prove each of those.
import type { ListItem } from './types'

export interface TickIntent {
  key: string
  checked: boolean
  /** ms since epoch, from the caller — this module has no clock. */
  at: number
}

export type SaveState = 'saved' | 'pending' | 'failed'

export interface RenderedItem extends ListItem {
  /** What the phone shows: the row's value, or the newest pending intent. */
  shown: boolean
  save: SaveState
}

/** Append an intent, collapsing earlier intents for the same item — only the newest matters. */
export function enqueue(outbox: TickIntent[], intent: TickIntent): TickIntent[] {
  return [...outbox.filter((i) => i.key !== intent.key), intent]
}

/** The intent for a key, if one is pending. */
export function pendingFor(outbox: TickIntent[], key: string): TickIntent | undefined {
  return outbox.find((i) => i.key === key)
}

/**
 * What to render: the row's items, with pending intents overlaid AS PENDING.
 * The overlay never writes back into the row; it is a badge on top of it.
 */
export function render(rowItems: ListItem[], outbox: TickIntent[], failed: Set<string> = new Set()): RenderedItem[] {
  return rowItems.map((item) => {
    const p = pendingFor(outbox, item.key)
    if (!p) return { ...item, shown: item.checked, save: 'saved' }
    return { ...item, shown: p.checked, save: failed.has(item.key) ? 'failed' : 'pending' }
  })
}

/**
 * The row answered an intent. The row's items REPLACE the local render, and
 * the intent leaves the outbox — whatever the row says, even if it disagrees
 * with the intent. A second writer (Phase 2) or a stale tab loses nothing
 * here, because the truth was never local.
 */
export function acknowledge(rowItemsFromRow: ListItem[], outbox: TickIntent[], acked: TickIntent): { items: ListItem[]; outbox: TickIntent[] } {
  const remaining = outbox.filter((i) => !(i.key === acked.key && i.at === acked.at))
  return { items: rowItemsFromRow, outbox: remaining }
}

/**
 * A fresh read of the row while intents are pending: the row replaces local
 * state; intents that the row already satisfies are dropped; the rest stay
 * pending and will be sent. Nothing is merged INTO the row from here.
 *
 * An intent whose item has a write IN FLIGHT is kept whatever the read says:
 * the read may predate that write, so "the row already says unchecked" can
 * be the state the in-flight check is about to overturn, and dropping the
 * newer uncheck would leave the item checked and reported saved (Codex,
 * round 3).
 */
export function reconcile(rowItemsFromRow: ListItem[], outbox: TickIntent[], inFlight: Set<string> = new Set()): { items: ListItem[]; outbox: TickIntent[] } {
  const byKey = new Map(rowItemsFromRow.map((i) => [i.key, i.checked]))
  const remaining = outbox.filter((i) => inFlight.has(i.key) || (byKey.has(i.key) && byKey.get(i.key) !== i.checked))
  return { items: rowItemsFromRow, outbox: remaining }
}

/** Progress, counted from the ROW — pending ticks do not count until saved. */
export function progress(rowItems: ListItem[]): { done: number; total: number } {
  const buyable = rowItems.filter((i) => !i.stocked)
  return { done: buyable.filter((i) => i.checked).length, total: buyable.length }
}

/** localStorage key for a list's outbox — one per list, so lists never share intents. */
export const outboxKey = (listId: string) => `dad-strength-fuel-outbox:${listId}`
