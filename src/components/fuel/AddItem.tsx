'use client'

// ── Fuel: add your own (FOR-240) ─────────────────────────────────────────────
// Free text, on purpose. What is on hand is picked from the library (FOR-239)
// because it must match an ingredient; these are things the solver has never
// heard of, so nothing tries to match them. The aisle is picked, never guessed
// from the name. A one-off goes on this list only; "every list" also makes it
// a staple, on this list and every list built after, until stopped.
import { useState } from 'react'
import { defaultSection, type StapleRow } from '../../lib/fuel/custom'

export default function AddItem({ sectionOrder, staples, busy, onAdd, onStopStaple }: {
  sectionOrder: string[]
  /** What is on every list, as the store holds it now. */
  staples: StapleRow[]
  busy: boolean
  /** Returns what went wrong, in words, or null when it landed. */
  onAdd: (item: string, section: string, everyList: boolean) => Promise<string | null>
  /** Stop a staple on lists built from now on. */
  onStopStaple: (id: string) => void
}) {
  const [item, setItem] = useState('')
  const [section, setSection] = useState(() => defaultSection(sectionOrder))
  const [everyList, setEveryList] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const name = item.trim()

  const submit = async () => {
    if (!name || busy) return
    const e = await onAdd(name, section, everyList)
    setError(e)
    if (!e) { setItem(''); setEveryList(false) }
  }

  return (
    <section className="tile p-3 space-y-2" aria-label="add your own">
      <p className="eyebrow-mono px-1">add your own · snacks, coffee, anything</p>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void submit() }}>
        <input value={item} onChange={(e) => setItem(e.target.value)} maxLength={80} placeholder="what to buy" aria-label="what to buy"
          className="row-recessed flex-1 min-w-0 px-3 py-2 text-sm bg-transparent" />
        <select value={section} onChange={(e) => setSection(e.target.value)} aria-label="aisle" className="row-recessed px-2 py-2 text-sm bg-transparent">
          {sectionOrder.map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
        </select>
        <button type="button" aria-pressed={everyList} onClick={() => setEveryList((v) => !v)}
          className={`pill-quiet px-3 py-2 text-[12px] lowercase ${everyList ? 'font-semibold' : 'text-muted-foreground'}`}>every list</button>
        <button type="submit" disabled={!name || busy} className="pill-quiet px-4 py-2 text-[12px] lowercase font-semibold">{busy ? 'adding…' : 'add'}</button>
      </form>
      <p className="text-[11px] text-muted-foreground px-1">
        {everyList ? 'on this list and every list you build, until you stop it' : 'on this list only — a rebuilt list starts without it'}
      </p>
      {error && <p className="status-msg danger text-[12px]" role="status">{error}</p>}
      {staples.length > 0 && (
        <div className="pt-1">
          <p className="eyebrow-mono-sm px-1 mb-1">on every list</p>
          <ul className="space-y-1">
            {staples.map((s) => (
              <li key={s.id} className="row-recessed flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="min-w-0">{s.item} <span className="text-[11px] text-muted-foreground">· {s.store_section.toLowerCase()}</span></span>
                <button type="button" onClick={() => onStopStaple(s.id)} aria-label={`stop putting ${s.item} on new lists`}
                  className="pill-quiet shrink-0 px-3 py-1 text-[11px] lowercase">stop</button>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground px-1 mt-1">stopping keeps it on lists already built</p>
        </div>
      )}
    </section>
  )
}
