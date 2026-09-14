'use client'

// ── Fuel plan builder — pick the nights from the library ────────────────────
// Deterministic: the picker enforces the frequency rules at selection time
// and the solver reports what slips through. Variety is surfaced as spice
// profile and format over the same cuts (L5), never as more ingredients.
import { useMemo, useState } from 'react'
import type { Household, MealRow, Plan, PlanEntry } from '../../lib/fuel/types'
import { cycleWeeks, defaultServings, validatePlan } from '../../lib/fuel/solve'

/** Cooked servings a night may be set to: three per person covers a leftover night, never fewer than eight. */
export const maxServings = (household: Pick<Household, 'people_count'>) => Math.max(8, household.people_count * 3)

export default function PlanBuilder({ household, meals, initial, building, onBuild }: {
  household: Household; meals: MealRow[]; initial: Plan | null; building: boolean; onBuild: (plan: Plan) => void
}) {
  const weeks = cycleWeeks(household)
  const bySlug = useMemo(() => new Map(meals.map((m) => [m.slug, m])), [meals])
  // A saved plan is reconciled against the household it is being rebuilt
  // for: a fortnight's week-two nights do not ride along into a weekly shop,
  // and a night saved for two people is brought up to what four need. A
  // saved servings choice that still feeds everyone is KEPT as chosen — the
  // recipe default applies to new selections only (Codex, round 3).
  const [entries, setEntries] = useState<PlanEntry[]>(() => (initial?.entries ?? [])
    .filter((e) => e.week <= weeks)
    .map((e) => { const m = bySlug.get(e.slug); return m && e.servings < household.people_count ? { ...e, servings: defaultServings(m, household) } : e }))
  const [week, setWeek] = useState<1 | 2>(1)
  const warnings = useMemo(() => validatePlan({ entries }, meals, household), [entries, meals, household])
  const inWeek = (w: number) => entries.filter((e) => e.week === w)
  const picked = (slug: string) => entries.find((e) => e.slug === slug && e.week === week)
  const cap = maxServings(household)

  const toggle = (m: MealRow) => {
    const existing = picked(m.slug)
    // Deselecting is always allowed — a meal that fell outside a lowered cap
    // must be removable, or the plan can never be made compliant.
    if (existing) { setEntries(entries.filter((e) => e !== existing)); return }
    if (!eligible(m)) return
    if (inWeek(week).length >= household.nights_per_week) return
    setEntries([...entries, { slug: m.slug, week, servings: Math.min(defaultServings(m, household), cap) }])
  }
  const setServings = (entry: PlanEntry, servings: number) => setEntries(entries.map((e) => (e === entry ? { ...e, servings } : e)))
  const eligible = (m: MealRow) => m.active_cook_minutes <= household.cook_cap_minutes
  const complete = Array.from({ length: weeks }, (_, i) => inWeek(i + 1).length === household.nights_per_week).every(Boolean)

  return (
    <div className="space-y-4">
      {weeks === 2 && (
        <div className="flex gap-2">
          {[1, 2].map((w) => (
            <button key={w} type="button" onClick={() => setWeek(w as 1 | 2)} aria-pressed={week === w}
              className={`${week === w ? 'pill-volt' : 'pill-quiet'} px-4 py-1.5 text-[12px] lowercase`}>
              week {w} · {inWeek(w).length}/{household.nights_per_week}
            </button>
          ))}
        </div>
      )}
      {weeks === 1 && <p className="eyebrow-mono">this week · {inWeek(1).length}/{household.nights_per_week} nights</p>}

      <ul className="space-y-2">
        {meals.map((m) => {
          const entry = picked(m.slug)
          const ok = eligible(m)
          return (
            <li key={m.slug} className={`tile p-3 ${entry ? 'border-brand' : ''}`}>
              <button type="button" className="w-full text-left" onClick={() => toggle(m)} aria-pressed={!!entry} disabled={!ok && !entry}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{m.name}</p>
                    <p className="data-mono mt-1">
                      <span className="chip-cat mr-1">{m.protein_cut.replace(/_/g, ' ')}</span>
                      <span className="chip-cat mr-1">{m.spice_profile}</span>
                      <span className="chip-cat">{m.format}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {m.active_cook_minutes} min active{m.total_minutes ? ` · ${m.total_minutes} total` : ''}
                      {m.protein_g_per_person ? ` · ${m.protein_g_per_person} g protein` : ''}
                      {m.perishable_within_days ? ` · fresh ${m.perishable_within_days} d` : ''}
                      {!ok ? ` · over your ${household.cook_cap_minutes}-min cap${entry ? ' — tap to remove' : ''}` : ''}
                    </p>
                  </div>
                  <span className={`day-pill shrink-0 mt-1 ${entry ? 'on' : ''}`} aria-hidden="true" />
                </div>
              </button>
              {entry && (
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                  <span className="text-[11px] text-muted-foreground lowercase">cook servings · {household.people_count} eating{m.servings > 2 ? ' · leftovers come free' : ''}</span>
                  <div className="flex items-center gap-2">
                    <button type="button" aria-label="fewer servings" className="pill-quiet w-7 h-7 text-sm" onClick={() => setServings(entry, Math.max(1, entry.servings - 1))}>−</button>
                    <span className="stat-num text-[18px] min-w-[2ch] text-center">{entry.servings}</span>
                    <button type="button" aria-label="more servings" className="pill-quiet w-7 h-7 text-sm" onClick={() => setServings(entry, Math.min(cap, entry.servings + 1))}>+</button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {warnings.length > 0 && (
        <div className="status-msg danger text-[12px]">
          {warnings.map((w) => <p key={w}>{w}</p>)}
        </div>
      )}

      <button type="button" className="pill-volt w-full py-3 text-sm" disabled={!complete || building || warnings.length > 0}
        onClick={() => onBuild({ entries })}>
        {building ? 'building the list…' : complete ? 'build the shopping list' : `pick ${household.nights_per_week} nights${weeks === 2 ? ' each week' : ''}`}
      </button>
    </div>
  )
}
