'use client'

// ── Fuel intake — taps and numbers, no prose, no AI ─────────────────────────
// The ~8 questions from the FOR-177 spec. Prep diversion is a first-class
// question with its own explanation (L2); inventory is the first thing asked
// about after the household, because the subtraction is the feature (L1).
import { useMemo, useState } from 'react'
import type { Household, InventoryItem, MealRow } from '../../lib/fuel/types'
import { libraryUnits } from '../../lib/fuel/solve'

const NO_MEALS: MealRow[] = []

function Chip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`${on ? 'pill-volt' : 'pill-quiet'} px-3 py-1.5 text-[12px] lowercase`}>
      {label}
    </button>
  )
}

function NumberRow({ label, hint, value, min, max, step = 1, onChange }: { label: string; hint?: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void }) {
  return (
    <div className="row-recessed flex items-center justify-between gap-3 px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm lowercase">{label}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button type="button" aria-label={`less ${label}`} className="pill-quiet w-8 h-8 text-base" onClick={() => onChange(Math.max(min, value - step))}>−</button>
        <span className="stat-num text-[22px] min-w-[2.5ch] text-center">{value}</span>
        <button type="button" aria-label={`more ${label}`} className="pill-quiet w-8 h-8 text-base" onClick={() => onChange(Math.min(max, value + step))}>+</button>
      </div>
    </div>
  )
}

export default function IntakeForm({ initial, meals = NO_MEALS, saving, onSave }: { initial: Household; meals?: MealRow[]; saving: boolean; onSave: (h: Household) => void }) {
  const [h, setH] = useState<Household>(initial)
  // The saved household can change under the draft — another tab saved,
  // and the page re-read it. Untouched, the draft follows; touched, saving
  // it would overwrite the newer save with stale rules and stock, so the
  // conflict is shown and the athlete chooses: reload what was saved, or
  // keep working and decide later (Codex, round 18). A save of this very
  // draft coming back is no conflict.
  const [dirty, setDirty] = useState(false)
  const [conflict, setConflict] = useState(false)
  // Adjusted during render when the saved household changes (React's own
  // pattern for state that depends on a prop), not in an effect.
  const incomingKey = JSON.stringify(initial)
  const [seenKey, setSeenKey] = useState(incomingKey)
  if (incomingKey !== seenKey) {
    setSeenKey(incomingKey)
    if (!dirty || incomingKey === JSON.stringify(h)) { setH(initial); setDirty(false); setConflict(false) } else setConflict(true)
  }
  const reload = () => { setSeenKey(incomingKey); setH(initial); setDirty(false); setConflict(false) }
  // Every unit the library measures in is offered, or what is on hand in
  // cloves or teaspoons could never come off the list (Codex, round 7).
  const units = useMemo(() => libraryUnits(meals), [meals])
  const [newItem, setNewItem] = useState<InventoryItem>({ item: '', qty: 1, unit: 'lb' })
  const rules = h.dietary_rules
  const set = (patch: Partial<Household>) => { setH({ ...h, ...patch }); setDirty(true) }
  const setRule = (patch: Partial<Household['dietary_rules']>) => { setH({ ...h, dietary_rules: { ...rules, ...patch } }); setDirty(true) }

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSave(h) }}>
      <section className="tile p-4 space-y-2">
        <p className="eyebrow-mono">the household</p>
        <NumberRow label="people at dinner" value={h.people_count} min={1} max={12} onChange={(n) => set({ people_count: n })} />
        <NumberRow label="nights you cook a week" hint="the rest is leftovers or out" value={h.nights_per_week} min={1} max={7} onChange={(n) => set({ nights_per_week: n })} />
        <NumberRow label="weeknight active-cook cap" hint="minutes at the stove, not total time" value={h.cook_cap_minutes} min={10} max={90} step={5} onChange={(n) => set({ cook_cap_minutes: n })} />
        <div className="row-recessed flex items-center justify-between gap-3 px-3 py-2">
          <p className="text-sm lowercase">main shop every</p>
          <div className="flex gap-2">
            <Chip on={h.shop_cadence_days === 7} label="week" onClick={() => set({ shop_cadence_days: 7 })} />
            <Chip on={h.shop_cadence_days === 14} label="fortnight" onClick={() => set({ shop_cadence_days: 14 })} />
          </div>
        </div>
      </section>

      <section className="tile p-4 space-y-2">
        <p className="eyebrow-mono">meal prep diversion</p>
        <p className="text-[12px] text-muted-foreground">
          How much of the meat you buy gets cooked off for lunches and meal prep instead of dinner?
          At 50% every meat purchase is doubled and only half of what is in the freezer counts. Getting this wrong is how a plan runs out in week two.
        </p>
        <div className="flex flex-wrap gap-2">
          {[0, 25, 50, 75].map((p) => <Chip key={p} on={h.prep_diversion_pct === p} label={`${p}%`} onClick={() => set({ prep_diversion_pct: p })} />)}
        </div>
      </section>

      <section className="tile p-4 space-y-2">
        <p className="eyebrow-mono">rules</p>
        <NumberRow label="protein floor per person" hint="grams at dinner — drives raw weight per cut" value={rules.protein_floor_g_per_person} min={20} max={80} step={5} onChange={(n) => setRule({ protein_floor_g_per_person: n })} />
        <NumberRow label="fish nights a week" value={rules.fish_per_week} min={0} max={4} onChange={(n) => setRule({ fish_per_week: n })} />
        <NumberRow label="ground turkey nights a week" value={rules.ground_turkey_per_week} min={0} max={4} onChange={(n) => setRule({ ground_turkey_per_week: n })} />
        <NumberRow label="steak nights a month" value={rules.steak_per_month} min={0} max={8} onChange={(n) => setRule({ steak_per_month: n })} />
        <div className="flex flex-wrap gap-2 pt-1">
          <Chip on={rules.vegetable_every_night} label="veg every night" onClick={() => setRule({ vegetable_every_night: !rules.vegetable_every_night })} />
          <Chip on={rules.minimal_added_fat} label="minimal added fat" onClick={() => setRule({ minimal_added_fat: !rules.minimal_added_fat })} />
          <Chip on={rules.no_tilapia} label="no tilapia" onClick={() => setRule({ no_tilapia: !rules.no_tilapia })} />
          <Chip on={rules.frugal_reuse} label="reuse across meals" onClick={() => setRule({ frugal_reuse: !rules.frugal_reuse })} />
        </div>
      </section>

      <section className="tile p-4 space-y-2">
        <p className="eyebrow-mono">already on hand</p>
        <p className="text-[12px] text-muted-foreground">Freezer and pantry. What is here comes off the list before you shop.</p>
        {h.inventory.length > 0 && (
          <ul className="space-y-1">
            {h.inventory.map((inv, i) => (
              <li key={`${inv.item}-${i}`} className="row-recessed flex items-center justify-between px-3 py-2 text-sm">
                <span className="lowercase">{inv.item}</span>
                <span className="data-mono"><b>{inv.qty}</b> {inv.unit}
                  <button type="button" aria-label={`remove ${inv.item}`} className="ml-3 text-muted-foreground" onClick={() => set({ inventory: h.inventory.filter((_, j) => j !== i) })}>×</button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2">
          <input value={newItem.item} onChange={(e) => setNewItem({ ...newItem, item: e.target.value })} placeholder="item"
            className="row-recessed flex-1 min-w-0 px-3 py-2 text-sm bg-transparent outline-none" aria-label="inventory item" />
          <input type="number" inputMode="decimal" min={0} step={0.5} value={newItem.qty} onChange={(e) => setNewItem({ ...newItem, qty: Number(e.target.value) })}
            className="row-recessed w-16 px-2 py-2 text-sm bg-transparent outline-none stat-num" aria-label="inventory quantity" />
          <select value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} className="row-recessed px-2 py-2 text-sm bg-transparent" aria-label="inventory unit">
            {units.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <button type="button" className="pill-quiet px-3 py-2 text-sm" disabled={!newItem.item.trim() || newItem.qty <= 0}
            onClick={() => { set({ inventory: [...h.inventory, { ...newItem, item: newItem.item.trim() }] }); setNewItem({ item: '', qty: 1, unit: 'lb' }) }}>
            add
          </button>
        </div>
      </section>

      {conflict && (
        <div className="status-msg danger text-[12px] flex items-center justify-between gap-3" role="alert">
          <span>the household was changed elsewhere while you were editing — saving this would overwrite it</span>
          <button type="button" className="pill-quiet px-3 py-1.5 text-[12px] lowercase shrink-0" onClick={reload}>reload what was saved</button>
        </div>
      )}
      <button type="submit" disabled={saving || conflict} className="pill-volt w-full py-3 text-sm">
        {saving ? 'saving…' : conflict ? 'reload before saving' : 'save the household'}
      </button>
    </form>
  )
}
