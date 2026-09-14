'use client'

// ── Fuel checklist — the deliverable (L8) ───────────────────────────────────
// Store-section order, tappable, progress visible, one-handed. Every tick
// shows whether it SAVED: the row is authoritative (ticks.ts), so a tick is
// pending until the database function returns the row, and it says so on
// the row itself. Offline, the outbox keeps the intent and the row shows it
// as queued; when the network is back, it flushes and the row takes over.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, CloudOff, Loader2, RefreshCw } from 'lucide-react'
import type { ListItem } from '../../lib/fuel/types'
import { SECOND_TRIP_SECTION, STOCKED_SECTION } from '../../lib/fuel/solve'
import { acknowledge, adopt, drop, enqueue, hold, nextExpiry, orphans, outboxKey, outboxPrefix, ORPHAN_AFTER_MS, outstanding, pendingFor, progress, reconcile, released, render, type StoredOutbox, type TickIntent } from '../../lib/fuel/ticks'

// Keys with a write in flight, PER LIST and shared across mounts: a checklist
// unmounted mid-write (the athlete switched steps) still has that write
// outstanding when the next instance mounts, and that instance's first
// reconciliation read must not prune the intent the write is about to
// overturn (Codex, round 4).
// A COUNT per key, not a set: two requests for one key can be outstanding
// across a remount, and the first to land must not clear the second's
// protection (Codex, round 12).
const inFlightByList = new Map<string, Map<string, number>>()
const inFlightFor = (listId: string) => { let s = inFlightByList.get(listId); if (!s) { s = new Map(); inFlightByList.set(listId, s) } return s }

// One write at a time PER LIST, across mounts. `flushing` is instance-local,
// so a remounted checklist could send a newer intent while the unmounted
// instance's older request was still outstanding — and if the older one
// committed last it would overwrite the newer (Codex, round 5). Every send
// is chained on the list's queue, so a newer intent waits for whatever is
// already in flight, whichever instance sent it.
const sendQueues = new Map<string, Promise<unknown>>()
function sendQueued<T>(listId: string, fn: () => Promise<T>): Promise<T> {
  const prev = sendQueues.get(listId) ?? Promise.resolve()
  const next = prev.catch(() => undefined).then(fn)
  sendQueues.set(listId, next.catch(() => undefined))
  return next
}

// One outbox PER LIST PER TAB (Codex, round 9). Two tabs on the same list
// used to write the same key, and the last writer erased the other's
// pending ticks. Each tab now writes its own key, stamped with when it was
// last alive; a tab that hides or closes stamps zero. A mount, or a tab
// coming back into view, adopts the outboxes of tabs that are gone —
// stamped zero, or silent past the orphan window — so a closed tab's ticks
// are flushed by the next tab on the list. The tab id is minted
// once per DOCUMENT: a remount within the same tab keeps its outbox (a
// sessionStorage id let a remount mistake its own fresh stamp for a
// duplicate's — Codex, round 10); a reload is a new document, and pagehide
// stamped the old outbox zero, so the new one adopts it at once; a
// duplicated tab is a new document too, with its own id. A hidden tab
// RELEASES its outbox — no heartbeat, no flush, and never a re-write of a
// key another tab has taken — and a tab that wakes to find its outbox
// taken drops those intents rather than sending them twice.
let tab: string | null = null
function tabId(): string { return tab ?? (tab = Math.random().toString(36).slice(2, 10)) }
function parseStored(raw: string | null): StoredOutbox | null {
  try { const s = raw ? (JSON.parse(raw) as StoredOutbox) : null; return s && Array.isArray(s.intents) ? s : null } catch { return null }
}
/** Every other tab's outbox for this list, as stored. */
function foreignOutboxes(listId: string): Array<{ key: string; stored: StoredOutbox }> {
  const others: Array<{ key: string; stored: StoredOutbox }> = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith(outboxPrefix(listId)) || k === outboxKey(listId, tabId())) continue
      const stored = parseStored(localStorage.getItem(k))
      if (stored) others.push({ key: k, stored })
    }
  } catch { /* storage unavailable */ }
  return others
}
/** Take over the outboxes of tabs that are gone: their intents come back, their keys go. A hidden tab takes nothing — it could not hold it. */
function adoptOrphans(listId: string): TickIntent[] {
  try {
    if (document.visibilityState === 'hidden') return []
    const others = foreignOutboxes(listId)
    const gone = orphans(others.map((o) => o.stored), tabId(), Date.now())
    for (const o of others) if (gone.includes(o.stored)) localStorage.removeItem(o.key)
    return gone.flatMap((s) => s.intents)
  } catch { return [] }
}
function readOutbox(listId: string): TickIntent[] {
  let mine: StoredOutbox | null = null
  try { mine = parseStored(localStorage.getItem(outboxKey(listId, tabId()))) } catch { mine = null }
  return adopt(mine?.intents ?? [], adoptOrphans(listId))
}
/**
 * Persist this tab's outbox under its own key; returns whether storage
 * works. Hidden, or leaving, the outbox is RELEASED — stamped zero for
 * another tab to take — and is re-written only while it is still ours:
 * never recreated after a take, or a replay on waking could overwrite the
 * taker's newer saves (Codex, round 10). Not released while one of this
 * tab's writes is in flight: the claim holds until it lands (round 11).
 */
function writeOutbox(listId: string, outbox: TickIntent[], leaving = false): boolean {
  try {
    const k = outboxKey(listId, tabId())
    if (!outbox.length) { localStorage.removeItem(k); return true }
    const rel = released(leaving || document.visibilityState === 'hidden', outstanding(inFlightFor(listId)))
    if (rel && localStorage.getItem(k) === null) return true
    localStorage.setItem(k, JSON.stringify({ tab: tabId(), alive: rel ? 0 : Date.now(), intents: outbox } satisfies StoredOutbox))
    return true
  } catch { return false /* storage unavailable: intents live in memory only */ }
}
/** Is this tab's outbox still on disk? Storage that cannot answer is taken as yes. */
function ownKeyPresent(listId: string): boolean {
  try { return localStorage.getItem(outboxKey(listId, tabId())) !== null } catch { return true }
}

const fmtQty = (i: ListItem) => {
  const q = Number.isInteger(i.qty) ? String(i.qty) : i.qty.toFixed(1).replace(/\.0$/, '')
  if (i.unit === 'oz' && i.qty >= 16) return `${q} oz · ${(i.qty / 16).toFixed(1).replace(/\.0$/, '')} lb`
  return `${q} ${i.unit}`
}

export default function Checklist({ listId, version, versions, items: rowItems, onRowItems, send, refetch, onRegenerate }: {
  listId: string
  version: number
  versions: number[]
  /** The row's items — the truth. */
  items: ListItem[]
  /** The row answered: replace the truth — for THIS list; the page ignores a stale list's answer. */
  onRowItems: (listId: string, items: ListItem[]) => void
  /** The one write path: returns the row's items, or null on failure. */
  send: (key: string, checked: boolean) => Promise<ListItem[] | null>
  /** A fresh read of the row. */
  refetch: () => Promise<ListItem[] | null>
  onRegenerate: () => void
}) {
  const [outbox, setOutbox] = useState<TickIntent[]>(() => (typeof window === 'undefined' ? [] : readOutbox(listId)))
  const [failed, setFailed] = useState<Set<string>>(new Set())
  const [online, setOnline] = useState(true)
  const [lastSaved, setLastSaved] = useState<number | null>(null)
  const flushing = useRef(false)
  const outboxRef = useRef(outbox)
  outboxRef.current = outbox
  // Every acknowledgement bumps this. A reconciliation read that started
  // before an acknowledgement and resolved after it is STALE — it would put
  // the older snapshot back over the row's newer answer — so it is discarded
  // and the next mount or reconnect reads again (Codex, round 2).
  const writes = useRef(0)
  // Keys with a write in flight. A reconciliation read that lands while one
  // is outstanding must not prune that key's newer intent (Codex, round 3).
  const inFlight = useRef<Map<string, number>>(inFlightFor(listId))
  // This instance's lifetime. An acknowledgement that arrives after unmount
  // belongs to nobody: the write committed, the next instance's reconcile
  // read will see it, and publishing it here would put an older snapshot
  // over what the new instance has since done (Codex, round 4).
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  const persisted = useRef(true)
  useEffect(() => { persisted.current = writeOutbox(listId, outbox) }, [listId, outbox])
  // While intents are pending and the tab is VISIBLE it stamps its outbox
  // alive, so no other tab adopts it; hidden, it stamps nothing (Codex,
  // round 10) — unless a write is still in flight, when the claim must hold
  // until it lands (round 11); on pagehide it releases, so the next tab can
  // take it at once.
  const holding = outbox.length > 0
  useEffect(() => {
    if (!holding) return
    const stamp = () => { if (document.visibilityState === 'visible' || outstanding(inFlight.current)) writeOutbox(listId, outboxRef.current) }
    const hide = () => writeOutbox(listId, outboxRef.current, true)
    const id = window.setInterval(stamp, ORPHAN_AFTER_MS / 3)
    window.addEventListener('pagehide', hide)
    return () => { window.clearInterval(id); window.removeEventListener('pagehide', hide) }
  }, [listId, holding])
  // Hidden: let the outbox go, so a visible tab can take the ticks. Shown
  // again (or restored from the back-forward cache): if another tab took
  // them meanwhile they are its to flush — dropped here, never sent twice;
  // otherwise the stamp is renewed. Then adopt what other tabs left, and
  // re-read the row. A visible tab also takes an outbox the moment another
  // tab releases it (the storage event), and re-reads the row only when it
  // took something (Codex, round 10).
  // A foreign claim still alive — a reload with a write in flight leaves
  // its old document's — lapses in time, and nothing else would look again
  // then: the next look is scheduled for when it does (Codex, round 12).
  const [wake, setWake] = useState(0)
  useEffect(() => {
    let timer: number | undefined
    const schedule = () => {
      window.clearTimeout(timer)
      const wait = nextExpiry(foreignOutboxes(listId).map((o) => o.stored), tabId(), Date.now())
      if (wait !== null) timer = window.setTimeout(() => { if (document.visibilityState === 'visible') wakeUp(false) }, wait + 250)
    }
    const wakeUp = (reread: boolean) => {
      let next = outboxRef.current
      if (next.length && persisted.current && !ownKeyPresent(listId)) next = []
      next = adopt(next, adoptOrphans(listId))
      const took = next !== outboxRef.current
      if (took) { outboxRef.current = next; setOutbox(next) } else writeOutbox(listId, next)
      if (reread || took) setWake((n) => n + 1)
      schedule()
    }
    schedule()
    const onVisibility = () => { if (document.visibilityState === 'hidden') writeOutbox(listId, outboxRef.current); else wakeUp(true) }
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) wakeUp(true) }
    const onStorage = (e: StorageEvent) => {
      if (!e.key || !e.key.startsWith(outboxPrefix(listId)) || e.key === outboxKey(listId, tabId()) || document.visibilityState !== 'visible') return
      const stored = parseStored(e.newValue)
      if (stored?.alive === 0) wakeUp(false)
    }
    document.addEventListener('visibilitychange', onVisibility); window.addEventListener('pageshow', onShow); window.addEventListener('storage', onStorage)
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('pageshow', onShow); window.removeEventListener('storage', onStorage) }
  }, [listId])
  useEffect(() => {
    setOnline(navigator.onLine)
    const up = () => setOnline(true), down = () => setOnline(false)
    window.addEventListener('online', up); window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])

  // Flush the outbox in order. Each acknowledgement REPLACES the render with
  // the row's items; a failure leaves the intent queued and marks it. A
  // HIDDEN tab does not flush: its outbox is released for a visible tab to
  // take, and sending meanwhile could replay what that tab has since
  // changed (Codex, round 10).
  const flush = useCallback(async () => {
    if (flushing.current) return
    flushing.current = true
    try {
      while (outboxRef.current.length > 0 && navigator.onLine && mounted.current && document.visibilityState !== 'hidden') {
        const intent = outboxRef.current[0]
        hold(inFlight.current, intent.key)
        let items: ListItem[] | null = null
        try { items = await sendQueued(listId, () => send(intent.key, intent.checked)) } finally { drop(inFlight.current, intent.key) }
        if (!mounted.current) break
        // A refusal leaves the intent queued; hidden by now, the claim held for
        // the write is let go so another tab can retry it (Codex, round 11).
        if (!items) { setFailed((f) => new Set(f).add(intent.key)); writeOutbox(listId, outboxRef.current); break }
        const next = acknowledge(items, outboxRef.current, intent)
        outboxRef.current = next.outbox
        setOutbox(next.outbox)
        setFailed((f) => { const n = new Set(f); n.delete(intent.key); return n })
        writes.current += 1
        onRowItems(listId, next.items)
        setLastSaved(Date.now())
      }
    } finally { flushing.current = false }
  }, [send, onRowItems, listId])

  // On mount and on reconnect: re-read the row (the truth), drop intents it
  // already satisfies, then flush what is left. The read goes through the
  // list's send queue, so it cannot overlap a write from ANY instance —
  // including one an unmounted checklist left outstanding (Codex, round 6).
  // The epoch guard below is belt to that brace.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const seen = writes.current
      const fresh = await sendQueued(listId, refetch)
      if (cancelled) return
      if (fresh && writes.current === seen) {
        const r = reconcile(fresh, outboxRef.current, new Set(inFlight.current.keys()))
        outboxRef.current = r.outbox; setOutbox(r.outbox); onRowItems(listId, r.items)
      }
      void flush()
    })()
    return () => { cancelled = true }
  }, [online, listId, refetch, onRowItems, flush, wake])

  const tap = (item: ListItem, shown: boolean) => {
    // A row that says "not saved · tap again" is retried AS ASKED: the tap
    // re-sends the failed intent's value rather than flipping the shown one
    // (Codex, round 4). Any other tap toggles what is shown.
    const failedIntent = failed.has(item.key) ? pendingFor(outboxRef.current, item.key) : undefined
    const intent: TickIntent = { key: item.key, checked: failedIntent ? failedIntent.checked : !shown, at: Date.now() }
    const next = enqueue(outboxRef.current, intent)
    outboxRef.current = next; setOutbox(next)
    setFailed((f) => { const n = new Set(f); n.delete(item.key); return n })
    void flush()
  }

  const rendered = useMemo(() => render(rowItems, outbox, failed), [rowItems, outbox, failed])
  const main = rendered.filter((i) => !i.second_trip && !i.stocked)
  const trip2 = rendered.filter((i) => i.second_trip && !i.stocked)
  const stocked = rendered.filter((i) => i.stocked)
  const sections: Array<{ title: string; items: typeof rendered; note?: string }> = []
  for (const i of main) {
    const s = sections[sections.length - 1]
    if (s && s.title === i.section) s.items.push(i); else sections.push({ title: i.section, items: [i] })
  }
  if (trip2.length) sections.push({ title: SECOND_TRIP_SECTION, items: trip2, note: 'mid-cycle top-up — fresh fish and produce for week two, bought closer to the night' })
  const p = progress(rowItems)
  const pending = outbox.length
  const estimates = rendered.some((i) => i.inferred)

  return (
    <div className="space-y-4">
      <div className="tile p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow-mono">the list · v{version}{versions.length > 1 ? ` · ${versions.length} versions kept` : ''}</p>
            <p className="stat-num text-[44px] mt-1">{p.done}<span className="text-muted-foreground">/{p.total}</span></p>
            <p className="text-[11px] text-muted-foreground lowercase">saved on the row · {p.total - p.done} to go</p>
          </div>
          <button type="button" onClick={onRegenerate} className="pill-quiet px-3 py-2 text-[12px] lowercase flex items-center gap-1.5">
            <RefreshCw size={12} aria-hidden="true" /> change the plan
          </button>
        </div>
        <div className={`status-msg ${online ? 'good' : 'danger'} mt-3 text-[12px]`} role="status" aria-live="polite">
          {!online && `offline · ${pending} tick${pending === 1 ? '' : 's'} queued — they save when you are back on signal`}
          {online && pending > 0 && `saving ${pending}…`}
          {online && pending === 0 && failed.size === 0 && (lastSaved ? `every tick saved · ${new Date(lastSaved).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'every tick saved')}
          {online && failed.size > 0 && pending === 0 && 'a tick did not save — tap it again'}
        </div>
        {estimates && <p className="text-[11px] text-muted-foreground mt-2">est. = a side quantity the docs never gave a number for. The proteins are exact.</p>}
      </div>

      {sections.map((s) => (
        <section key={s.title} className="tile p-3">
          <p className="eyebrow-mono px-1 mb-1">{s.title.toLowerCase()} · {s.items.filter((i) => i.shown).length}/{s.items.length}</p>
          {s.note && <p className="text-[11px] text-muted-foreground px-1 mb-2">{s.note}</p>}
          <ul className="space-y-1">
            {s.items.map((i) => (
              <li key={i.key}>
                <button type="button" onClick={() => tap(i, i.shown)} aria-pressed={i.shown}
                  className={`row-recessed w-full flex items-center gap-3 px-3 py-3 text-left ${i.shown ? 'text-muted-foreground' : ''}`}>
                  <span className={`day-pill shrink-0 ${i.shown ? 'on' : ''}`} aria-hidden="true" />
                  <span className={`flex-1 min-w-0 text-sm ${i.shown ? 'line-through' : ''}`}>
                    {i.item}
                    <span className="data-mono ml-2"><b>{fmtQty(i)}</b>{i.inferred && <span className="ml-1 text-muted-foreground">est.</span>}</span>
                  </span>
                  <span className="shrink-0 text-[10px] lowercase text-muted-foreground flex items-center gap-1" aria-label={`save state: ${i.save}`}>
                    {i.save === 'saved' && i.shown && <><Check size={12} aria-hidden="true" /> saved</>}
                    {i.save === 'pending' && (online ? <><Loader2 size={12} aria-hidden="true" /> saving</> : <><CloudOff size={12} aria-hidden="true" /> queued</>)}
                    {i.save === 'failed' && <span className="text-status-danger-ink">not saved · tap again</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {stocked.length > 0 && (
        <section className="tile p-3">
          <p className="eyebrow-mono px-1 mb-1">{STOCKED_SECTION.toLowerCase()} · no purchase needed</p>
          <ul className="space-y-1">
            {stocked.map((i) => (
              <li key={i.key} className="row-recessed flex items-center justify-between px-3 py-2 text-sm">
                <span className="lowercase">{i.item}</span>
                <span className="text-[11px] text-muted-foreground">{i.stocked_reason}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
