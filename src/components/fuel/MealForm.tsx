'use client'

// ── Fuel: your own meal (FOR-242) ────────────────────────────────────────────
// "We will still need to add meals as we go and maybe include some sauces and
// stuff as we do." One screen, on a phone, in a kitchen.
//
// THE MINIMUM THAT SOLVES AND VALIDATES A LIST, and nothing else on screen —
// which is a higher bar than the minimum that solves one. A meal needs a name,
// how many it cooks, its ingredients with a quantity per person, a unit and an
// aisle, AND the protein figure and cut. The last two are not decoration: a
// plan carrying any warning cannot be built, validatePlan warns on a missing
// protein figure, and the fish, turkey and steak rules are counted on the cut.
// Defaulting them made every own meal unbuildable and invisible to the rules
// (Codex r1). Spice profile, format, minutes and perishable days ARE defaulted
// in ownMeal.ts and never asked: a form asking fourteen questions does not get
// used, which is how the nights planner went wrong before FOR-241.
//
// The item and unit controls offer what the library already cooks with
// (FOR-239's vocabulary) without being limited to it — a new sauce is exactly
// the point, and typing one is how it joins the vocabulary for everyone's
// "already on hand" picker afterwards. The aisle is picked, never guessed from
// the name, the same rule AddItem follows.
import { useMemo, useState } from 'react'
import type { MealIngredient, MealRow } from '../../lib/fuel/types'
import { libraryItems, libraryUnits } from '../../lib/fuel/solve'
import { defaultSection } from '../../lib/fuel/custom'
import { cutOptions, ownMealIssues, type OwnMealDraft } from '../../lib/fuel/ownMeal'

const blankRow = (section: string): MealIngredient => ({ item: '', qty_per_person: 0, unit: '', store_section: section, inferred: false })

/** The draft a meal starts from: a new one, or the meal being edited. */
function draftFrom(meal: MealRow | null, sectionOrder: string[]): OwnMealDraft {
  if (!meal) return { name: '', servings: 3, protein_g_per_person: 0, protein_cut: '', ingredients: [blankRow(defaultSection(sectionOrder))] }
  return {
    name: meal.name,
    servings: meal.servings,
    ingredients: meal.ingredients.length ? meal.ingredients.map((i) => ({ ...i })) : [blankRow(defaultSection(sectionOrder))],
    protein_g_per_person: meal.protein_g_per_person ?? 0,
    protein_cut: meal.protein_cut,
    active_cook_minutes: meal.active_cook_minutes,
    total_minutes: meal.total_minutes,
    perishable_within_days: meal.perishable_within_days,
  }
}

export default function MealForm({ meal, meals, sectionOrder, busy, onSave, onCancel }: {
  /** The meal being edited, or null to add one. */
  meal: MealRow | null
  /** The library as it stands — the item and unit vocabulary comes from it (FOR-239). */
  meals: MealRow[]
  sectionOrder: string[]
  busy: boolean
  /** Returns what went wrong, in words, or null when it landed. */
  onSave: (draft: OwnMealDraft) => Promise<string | null>
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<OwnMealDraft>(() => draftFrom(meal, sectionOrder))
  const [error, setError] = useState<string | null>(null)
  const [tried, setTried] = useState(false)

  const items = useMemo(() => libraryItems(meals), [meals])
  const units = useMemo(() => libraryUnits(meals), [meals])
  const cuts = useMemo(() => cutOptions(meals), [meals])
  const issues = useMemo(() => ownMealIssues(draft), [draft])

  const set = (patch: Partial<OwnMealDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const setRow = (n: number, patch: Partial<MealIngredient>) =>
    setDraft((d) => ({ ...d, ingredients: d.ingredients.map((r, i) => (i === n ? { ...r, ...patch } : r)) }))
  const addRow = () => setDraft((d) => ({ ...d, ingredients: [...d.ingredients, blankRow(defaultSection(sectionOrder))] }))
  const dropRow = (n: number) => setDraft((d) => ({ ...d, ingredients: d.ingredients.filter((_, i) => i !== n) }))

  const submit = async () => {
    setTried(true)
    if (issues.length || busy) return
    const e = await onSave(draft)
    setError(e)
  }

  return (
    <section className="tile p-5 space-y-4" aria-label={meal ? 'edit your meal' : 'add your own meal'}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow-mono">{meal ? 'your meal' : 'add your own'}</p>
          <p className="text-sm lowercase">{meal ? 'change it — the shopping list follows next time you build' : 'it joins your library straight away'}</p>
        </div>
        <button type="button" className="pill-quiet px-3 py-1.5 text-[12px] lowercase shrink-0" onClick={onCancel}>close</button>
      </div>

      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit() }}>
        <div className="flex flex-wrap gap-2">
          <input value={draft.name} onChange={(e) => set({ name: e.target.value })} maxLength={120}
            placeholder="what you call it" aria-label="meal name"
            className="row-recessed flex-1 min-w-0 px-3 py-2 text-sm bg-transparent" />
          <label className="row-recessed flex items-center gap-2 px-3 py-2 text-sm">
            <span className="eyebrow-mono-sm">cooks</span>
            <input type="number" inputMode="numeric" min={1} max={24} value={draft.servings}
              onChange={(e) => set({ servings: Number(e.target.value) })} aria-label="servings this meal cooks"
              className="w-12 bg-transparent text-right stat-num text-base" />
          </label>
        </div>
        <p className="text-[11px] text-muted-foreground px-1">
          servings is what it COOKS, not what you eat — three covers a leftover night
        </p>

        <div className="flex flex-wrap gap-2">
          <label className="row-recessed flex items-center gap-2 px-3 py-2 text-sm">
            <span className="eyebrow-mono-sm">protein</span>
            <input type="number" inputMode="numeric" min={0} step="1" value={draft.protein_g_per_person || ''}
              onChange={(e) => set({ protein_g_per_person: Number(e.target.value) })}
              aria-label="protein per person in grams" className="w-14 bg-transparent text-right stat-num text-base" />
            <span className="eyebrow-mono-sm">g each</span>
          </label>
          <select value={draft.protein_cut} onChange={(e) => set({ protein_cut: e.target.value })}
            aria-label="what the protein is" className="row-recessed px-2 py-2 text-sm bg-transparent">
            <option value="">what is the protein?</option>
            {cuts.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <p className="text-[11px] text-muted-foreground px-1">
          both are counted: the protein floor needs the grams, and the fish, turkey and steak rules need to know what it is
        </p>

        <div className="space-y-2">
          <p className="eyebrow-mono-sm px-1">what goes in it, per person</p>
          <datalist id="fuel-known-items">{items.map((i) => <option key={i} value={i} />)}</datalist>
          <datalist id="fuel-known-units">{units.map((u) => <option key={u} value={u} />)}</datalist>
          <ul className="space-y-2">
            {draft.ingredients.map((row, n) => (
              <li key={n} className="row-recessed flex flex-wrap items-center gap-2 px-3 py-2">
                <input list="fuel-known-items" value={row.item} onChange={(e) => setRow(n, { item: e.target.value })} maxLength={80}
                  placeholder="ingredient" aria-label={`ingredient ${n + 1}`}
                  className="flex-1 min-w-[8rem] bg-transparent text-sm" />
                <input type="number" inputMode="decimal" min={0} step="any" value={row.qty_per_person || ''}
                  onChange={(e) => setRow(n, { qty_per_person: Number(e.target.value) })}
                  placeholder="qty" aria-label={`quantity per person for ingredient ${n + 1}`}
                  className="w-16 bg-transparent text-right stat-num text-base" />
                <input list="fuel-known-units" value={row.unit} onChange={(e) => setRow(n, { unit: e.target.value })} maxLength={20}
                  placeholder="unit" aria-label={`unit for ingredient ${n + 1}`}
                  className="w-20 bg-transparent text-sm" />
                <select value={row.store_section} onChange={(e) => setRow(n, { store_section: e.target.value })}
                  aria-label={`aisle for ingredient ${n + 1}`} className="bg-transparent text-sm">
                  {sectionOrder.map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
                </select>
                {draft.ingredients.length > 1 && (
                  <button type="button" onClick={() => dropRow(n)} aria-label={`remove ingredient ${n + 1}`}
                    className="pill-quiet shrink-0 px-3 py-1 text-[11px] lowercase">remove</button>
                )}
              </li>
            ))}
          </ul>
          <button type="button" onClick={addRow} className="pill-quiet px-3 py-1.5 text-[12px] lowercase">add an ingredient</button>
        </div>

        {tried && issues.length > 0 && (
          <ul className="space-y-1" role="status">
            {issues.map((i) => <li key={i} className="status-msg danger text-[12px]">{i}</li>)}
          </ul>
        )}
        {error && <p className="status-msg danger text-[12px]" role="status">{error}</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="pill-quiet px-4 py-2 text-[12px] lowercase font-semibold">
            {busy ? 'saving…' : meal ? 'save changes' : 'add it'}
          </button>
          <button type="button" onClick={onCancel} className="pill-quiet px-4 py-2 text-[12px] lowercase">cancel</button>
        </div>
      </form>
    </section>
  )
}
