'use client'

// ── Fuel plan builder — pick the nights from the library ────────────────────
// Deterministic: the picker enforces the frequency rules at selection time
// and the solver reports what slips through. Variety is surfaced as spice
// profile and format over the same cuts (L5), never as more ingredients.
import { useMemo, useState } from 'react'
import type { Household, MealRow, Plan, PlanEntry } from '../../lib/fuel/types'
import { cycleWeeks, defaultServings, validatePlan, type PlanContext } from '../../lib/fuel/solve'

/** Cooked servings a night may be set to: three per person covers a leftover night, never fewer than eight. */
export const maxServings = (household: Pick<Household, 'people_count'>) => Math.max(8, household.people_count * 3)

export default function PlanBuilder({ household, meals, initial, building, onBuild, cycles, askInventory = false, countByDefault = false }: {
  household: Household; meals: MealRow[]; initial: Plan | null; building: boolean
  /** `countInventory`: whether what is on hand is counted against this plan — asked only when it was not (a NEXT cycle, or a rebuild of a plan built without it), otherwise always (Codex, rounds 15 and 16). */
  onBuild: (plan: Plan, opts: { countInventory: boolean }) => void
  /** Ask whether to count what is on hand: anything but a rebuild of a plan that already counted it — the saved choice stands unless changed here. */
  askInventory?: boolean
  /** The ask's default: on when what is on hand was saved after the newest plan was built, off when a cycle has been eating it (Codex, round 17). */
  countByDefault?: boolean
  /** The cycles already planned and where this plan would land — the rules that look across cycles read it (Codex, rounds 10, 13, 14). */
  cycles?: PlanContext
}) {
  const weeks = cycleWeeks(household)
  const bySlug = useMemo(() => new Map(meals.map((m) => [m.slug, m])), [meals])
  // A saved plan is reconciled against the household it is being rebuilt
  // for: a fortnight's week-two nights do not ride along into a weekly shop,
  // and a night saved for two people is brought up to what four need. A
  // saved servings choice that still feeds everyone is KEPT as chosen — the
  // recipe default applies to new selections only (Codex, round 3). A night
  // whose meal has since left the library is dropped and named: the picker
  // cannot show it, so it could never be removed, and its warning would hold
  // the build button down for good (Codex, round 7).
  const [entries, setEntries] = useState<PlanEntry[]>(() => (initial?.entries ?? [])
    .filter((e) => e.week <= weeks && bySlug.has(e.slug))
    .map((e) => { const m = bySlug.get(e.slug); return m && e.servings < household.people_count ? { ...e, servings: defaultServings(m, household) } : e }))
  const retired = useMemo(() => [...new Set((initial?.entries ?? []).filter((e) => !bySlug.has(e.slug)).map((e) => e.slug))], [initial, bySlug])
  const [week, setWeek] = useState<1 | 2>(1)
  const [countInventory, setCountInventory] = useState(countByDefault)
  const warnings = useMemo(() => validatePlan({ entries }, meals, household, { cycles }), [entries, meals, household, cycles])
  const inWeek = (w: number) => entries.filter((e) => e.week === w)
  const picked = (slug: string) => entries.find((e) => e.slug === slug && e.week === week)
  const nightsOf = (slug: string) => entries.filter((e) => e.slug === slug && e.week === week).length
  const cap = maxServings(household)
  const roomThisWeek = () => inWeek(week).length < household.nights_per_week

  const add = (m: MealRow) => {
    if (!eligible(m) || !roomThisWeek()) return
    const existing = picked(m.slug)
    setEntries([...entries, { slug: m.slug, week, servings: existing ? existing.servings : Math.min(defaultServings(m, household), cap) }])
  }
  const toggle = (m: MealRow) => {
    const existing = picked(m.slug)
    // Deselecting is always allowed — a meal that fell outside a lowered cap
    // must be removable, or the plan can never be made compliant.
    if (existing) { setEntries(entries.filter((e) => e !== existing)); return }
    add(m)
  }
  // A recipe can fill more than one night — a seven-night household with an
  // eight-meal library and the frequency rules could otherwise never fill
  // its week (Codex, round 6). Each night is its own entry; the solver sums.
  const removeOne = (slug: string) => {
    const last = [...entries].reverse().find((e) => e.slug === slug && e.week === week)
    if (last) setEntries(entries.filter((e) => e !== last))
  }
  // One servings figure per recipe per week: every night of a repeated
  // recipe cooks the same batch, another night copies it, and the control
  // moves them together — what the card shows is what the solver sums
  // (Codex, round 8). The entries stay one per night.
  const setServings = (slug: string, servings: number) => setEntries(entries.map((e) => (e.slug === slug && e.week === week ? { ...e, servings } : e)))
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
      {retired.length > 0 && (
        <p className="status-msg text-[12px]" role="status">
          {retired.join(', ')} {retired.length === 1 ? 'is' : 'are'} no longer in the library — {retired.length === 1 ? 'that night was' : 'those nights were'} dropped, pick again
        </p>
      )}

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
                  <span className="text-[11px] text-muted-foreground lowercase">
                    cook servings · {household.people_count} eating{m.servings > 2 ? ' · leftovers come free' : ''}
                    {nightsOf(m.slug) > 1 ? ` · ${nightsOf(m.slug)} nights, each` : ''}
                  </span>
                  <div className="flex items-center gap-1 mr-2">
                    {nightsOf(m.slug) > 1 && <button type="button" aria-label={`one night fewer of ${m.name}`} className="pill-quiet px-2 h-7 text-[11px] lowercase" onClick={() => removeOne(m.slug)}>− night</button>}
                    {roomThisWeek() && eligible(m) && <button type="button" aria-label={`another night of ${m.name}`} className="pill-quiet px-2 h-7 text-[11px] lowercase" onClick={() => add(m)}>another night</button>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" aria-label="fewer servings" className="pill-quiet w-7 h-7 text-sm" onClick={() => setServings(m.slug, Math.max(1, entry.servings - 1))}>−</button>
                    <span className="stat-num text-[18px] min-w-[2ch] text-center">{entry.servings}</span>
                    <button type="button" aria-label="more servings" className="pill-quiet w-7 h-7 text-sm" onClick={() => setServings(m.slug, Math.min(cap, entry.servings + 1))}>+</button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {askInventory && household.inventory.length > 0 && (
        <div className="tile p-3 space-y-2">
          <p className="text-[12px] text-muted-foreground">
            {countByDefault ? 'What is on hand was updated after the last plan was built, so it counts against this one unless you say otherwise.' : 'What is on hand has not been updated since the last plan was built — a cycle has been eating it. Count it only if it will still be there.'}
          </p>
          <button type="button" onClick={() => setCountInventory((c) => !c)} aria-pressed={countInventory}
            className={`${countInventory ? 'pill-volt' : 'pill-quiet'} px-3 py-1.5 text-[12px] lowercase`}>
            {countInventory ? 'counting what\'s on hand again' : 'count what\'s on hand again'}
          </button>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="status-msg danger text-[12px]">
          {warnings.map((w) => <p key={w}>{w}</p>)}
        </div>
      )}

      <button type="button" className="pill-volt w-full py-3 text-sm" disabled={!complete || building || warnings.length > 0}
        onClick={() => onBuild({ entries }, { countInventory: askInventory ? countInventory : true })}>
        {building ? 'building the list…' : complete ? 'build the shopping list' : `pick ${household.nights_per_week} nights${weeks === 2 ? ' each week' : ''}`}
      </button>
    </div>
  )
}
