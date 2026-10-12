'use client'

// ── Fuel step 2 — what do you already have? (FOR-281) ───────────────────────
// The draft shopping list — everything the menu needs, staples included, in
// store order — and one tap on a line says "have it". A second tap puts it
// back. Meat and seafood carry a "have some" box up front, in pounds where the
// line is in ounces, because that is how a freezer is counted; every other line has the
// same box one tap away. There is no search and nothing is typed by name.
//
// This screen holds ROWS ON HAND and nothing else (onhand.ts). What each line
// looks like — covered, part covered, bought — is read back from the solver
// run on those rows, so the screen can never show a list the build would not
// produce. "Build my list" hands the rows to the page, which saves them as the
// household's inventory and builds through the one path there has ever been.
import { useMemo, useState } from 'react'
import type { Household, InventoryItem, ListItem, MealRow, Plan } from '../../lib/fuel/types'
import { MEAT_SECTION, SECOND_TRIP_SECTION } from '../../lib/fuel/solve'
import { isCustom, sectionsInOrder, type StapleRow } from '../../lib/fuel/custom'
import { clearLine, draftList, haveUnit, lastTime, lineStates, listWith, markHave, setSome, someQty, startRows, stapleLines } from '../../lib/fuel/onhand'
import { fmtQty } from './Checklist'

const NO_STAPLES: StapleRow[] = []
const qtyText = (qty: number, unit: string) => fmtQty({ qty, unit })

export default function HaveStep({ household, meals, plan, staples = NO_STAPLES, askInventory = false, countByDefault = false, building, onBack, onBuild }: {
  household: Household; meals: MealRow[]
  /** The nights step 1 settled on. */
  plan: Plan
  /** The items on every list, shown where they will land. Empty when the page cannot write custom lines. */
  staples?: StapleRow[]
  /** Whether saved stock needs asking about for this build: anything but a rebuild of a plan that already counted it (FOR-177, rounds 15 and 16). */
  askInventory?: boolean
  /** When it needs asking: does it count unless told otherwise — saved after the newest plan was built — or has a week been eating it (round 17)? */
  countByDefault?: boolean
  building: boolean
  onBack: () => void
  /** Build the list with these rows on hand; `skipStaples` are the keys of the staple lines ticked "have it", to come off this one list. */
  onBuild: (rows: InventoryItem[], skipStaples: string[]) => void
}) {
  // Saved stock counts on its own exactly when it always did: no ask, or an
  // ask whose default was yes. Otherwise it is offered back line by line.
  const counts = !askInventory || countByDefault
  const draft = useMemo(() => draftList(household, meals, plan), [household, meals, plan])
  const [rows, setRows] = useState<InventoryItem[]>(() => startRows(household.inventory, draft.items, counts, !askInventory))
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<Set<string>>(new Set())
  // What is being typed in a "have some" box, as typed: "1." is not yet a
  // number and must not be rewritten under the thumb.
  const [typed, setTyped] = useState<Record<string, string>>({})
  const states = useMemo(() => lineStates(draft.items, listWith(household, meals, plan, rows)), [draft, household, meals, plan, rows])
  const custom = useMemo(() => stapleLines(staples), [staples])

  const main = [...draft.items.filter((l) => !l.second_trip), ...custom]
  const sections: Array<{ title: string; items: ListItem[]; note?: string }> = sectionsInOrder(main, household.store_section_order).map((s) => ({ title: s.section, items: s.items }))
  const trip2 = draft.items.filter((l) => l.second_trip)
  if (trip2.length) sections.push({ title: SECOND_TRIP_SECTION, items: trip2, note: 'the second shop — fresh fish and produce for week two, bought closer to the night' })

  const haveLine = (l: ListItem) => (isCustom(l) ? skipped.has(l.key) : !!states.get(l.key)?.have)
  const all = [...draft.items, ...custom]
  const have = all.filter(haveLine).length
  const offered = !counts && draft.items.some((l) => lastTime(household.inventory, l) !== null)

  const tap = (l: ListItem) => {
    if (isCustom(l)) { setSkipped((s) => { const n = new Set(s); if (n.has(l.key)) n.delete(l.key); else n.add(l.key); return n }); return }
    setTyped((t) => { const n = { ...t }; delete n[l.key]; return n })
    setRows((r) => (states.get(l.key)?.have ? clearLine(r, l) : markHave(r, l)))
  }
  const type = (l: ListItem, text: string) => {
    setTyped((t) => ({ ...t, [l.key]: text }))
    setRows((r) => setSome(r, l, Number(text)))
  }

  return (
    <div className="space-y-3">
      <section className="tile p-5 space-y-2">
        <p className="eyebrow-mono">before you shop</p>
        <h2 className="text-[26px] lowercase">what do you already have?</h2>
        <p className="text-sm text-muted-foreground">everything this menu needs, in store order. tap what is already in the kitchen and it comes off the list — tap again to put it back.</p>
        {offered && <p className="status-msg text-[12px]" role="status">nothing is ticked from last time — a week has been eating it. tap what is still there.</p>}
      </section>

      {sections.map((s) => (
        <section key={s.title} className="tile p-3" aria-label={s.title.toLowerCase()}>
          <p className="eyebrow-mono px-1 mb-1">{s.title.toLowerCase()}</p>
          {s.note && <p className="text-[11px] text-muted-foreground px-1 mb-2">{s.note}</p>}
          <ul className="space-y-1">
            {s.items.map((l) => {
              const own = isCustom(l)
              const st = states.get(l.key)
              const got = haveLine(l)
              const some = own ? null : someQty(rows, l)
              const part = !own && !got && !!st && st.buying < l.qty
              const last = own || counts ? null : lastTime(household.inventory, l)
              const box = !own && (l.section === MEAT_SECTION || open.has(l.key) || part)
              return (
                <li key={l.key} className="space-y-1">
                  <div className="flex items-stretch gap-1">
                    <button type="button" onClick={() => tap(l)} aria-pressed={got} aria-label={`${l.item} — ${got ? 'you have it, tap to put it back on the list' : 'tap if you have it'}`}
                      className={`row-recessed w-full min-w-0 flex items-center gap-3 px-3 py-3 text-left ${got ? 'text-muted-foreground' : ''}`}>
                      <span className={`day-pill shrink-0 ${got ? 'on' : ''}`} aria-hidden="true" />
                      <span className={`flex-1 min-w-0 text-sm ${got ? 'line-through' : ''}`}>
                        {l.item}
                        {own
                          ? <span className="eyebrow-mono-sm ml-2">every list</span>
                          : <span className="data-mono ml-2"><b>{fmtQty(l)}</b>{l.inferred && <span className="ml-1 text-muted-foreground">est.</span>}</span>}
                      </span>
                      <span className="shrink-0 text-[10px] lowercase text-muted-foreground">
                        {got ? 'have it' : part && st ? `buying ${qtyText(st.buying, l.unit)}` : ''}
                      </span>
                    </button>
                    {!own && !box && (
                      <button type="button" className="pill-quiet shrink-0 px-3 text-[11px] lowercase" aria-label={`you have some ${l.item}`}
                        onClick={() => setOpen((o) => new Set(o).add(l.key))}>some</button>
                    )}
                  </div>
                  {box && (
                    <div className="flex items-center gap-2 pl-10 pr-1">
                      <label className="text-[11px] text-muted-foreground lowercase" htmlFor={`some-${l.key}`}>have some</label>
                      <input id={`some-${l.key}`} type="number" inputMode="decimal" min={0} step={0.5} placeholder="0"
                        value={typed[l.key] ?? (some === null ? '' : String(some))} onChange={(e) => type(l, e.target.value)}
                        className="row-recessed w-20 px-2 py-1.5 text-sm bg-transparent outline-none stat-num" aria-label={`how much ${l.item} you have, in ${haveUnit(l)}`} />
                      <span className="data-mono">{haveUnit(l)}</span>
                      {last !== null && some === null && !got && (
                        <button type="button" className="pill-quiet px-3 py-1.5 text-[11px] lowercase" onClick={() => type(l, String(last))}>
                          still have {qtyText(last, haveUnit(l))}
                        </button>
                      )}
                    </div>
                  )}
                  {!box && last !== null && !got && (
                    <div className="pl-10">
                      <button type="button" className="pill-quiet px-3 py-1.5 text-[11px] lowercase" onClick={() => type(l, String(last))}>
                        still have {qtyText(last, haveUnit(l))}
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <div className="tile p-4 space-y-3">
        <p className="data-mono"><b>{all.length - have}</b> to buy · <b>{have}</b> you have</p>
        <button type="button" className="pill-volt w-full py-3 text-sm" disabled={building} onClick={() => onBuild(rows, [...skipped])}>
          {building ? 'building the list…' : 'build my list'}
        </button>
        <button type="button" className="pill-quiet w-full py-2 text-[12px] lowercase" disabled={building} onClick={onBack}>back to the menu</button>
      </div>
    </div>
  )
}
