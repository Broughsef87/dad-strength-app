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
import { acknowledge, enqueue, outboxKey, pendingFor, progress, reconcile, render, type TickIntent } from '../../lib/fuel/ticks'

// Keys with a write in flight, PER LIST and shared across mounts: a checklist
// unmounted mid-write (the athlete switched steps) still has that write
// outstanding when the next instance mounts, and that instance's first
// reconciliation read must not prune the intent the write is about to
// overturn (Codex, round 4).
const inFlightByList = new Map<string, Set<string>>()
const inFlightFor = (listId: string) => { let s = inFlightByList.get(listId); if (!s) { s = new Set(); inFlightByList.set(listId, s) } return s }

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

function readOutbox(listId: string): TickIntent[] {
  try { const raw = localStorage.getItem(outboxKey(listId)); return raw ? (JSON.parse(raw) as TickIntent[]) : [] } catch { return [] }
}
function writeOutbox(listId: string, outbox: TickIntent[]) {
  try { if (outbox.length) localStorage.setItem(outboxKey(listId), JSON.stringify(outbox)); else localStorage.removeItem(outboxKey(listId)) } catch { /* storage unavailable: intents live in memory only */ }
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
  const inFlight = useRef<Set<string>>(inFlightFor(listId))
  // This instance's lifetime. An acknowledgement that arrives after unmount
  // belongs to nobody: the write committed, the next instance's reconcile
  // read will see it, and publishing it here would put an older snapshot
  // over what the new instance has since done (Codex, round 4).
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  useEffect(() => { writeOutbox(listId, outbox) }, [listId, outbox])
  useEffect(() => {
    setOnline(navigator.onLine)
    const up = () => setOnline(true), down = () => setOnline(false)
    window.addEventListener('online', up); window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])

  // Flush the outbox in order. Each acknowledgement REPLACES the render with
  // the row's items; a failure leaves the intent queued and marks it.
  const flush = useCallback(async () => {
    if (flushing.current) return
    flushing.current = true
    try {
      while (outboxRef.current.length > 0 && navigator.onLine && mounted.current) {
        const intent = outboxRef.current[0]
        inFlight.current.add(intent.key)
        let items: ListItem[] | null = null
        try { items = await sendQueued(listId, () => send(intent.key, intent.checked)) } finally { inFlight.current.delete(intent.key) }
        if (!mounted.current) break
        if (!items) { setFailed((f) => new Set(f).add(intent.key)); break }
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
        const r = reconcile(fresh, outboxRef.current, inFlight.current)
        outboxRef.current = r.outbox; setOutbox(r.outbox); onRowItems(listId, r.items)
      }
      void flush()
    })()
    return () => { cancelled = true }
  }, [online, listId, refetch, onRowItems, flush])

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
