'use client'

// ── Fuel nights planner — the rotation fills the fortnight, the athlete reviews it ──
// FOR-241. The plan is the page; the library is the tool. Both weeks are on
// screen at once as named nights, prefilled from a rotation (FOR-238's
// builderStart, called by the page) and changed where they stand: swap,
// remove, servings, add a night. The meal library is a drawer below the
// fortnight, opened only to swap a night or add one. Presentation plus prefill
// only: the entries model, servings semantics and every rule belong to the
// solver, validatePlan still decides whether the list can be built, and
// planner.ts places what it says on the night that causes it.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Household, MealRow, Plan, PlanEntry, RotationMealRow, RotationRow } from '../../lib/fuel/types'
import { cycleWeeks, defaultServings, validatePlan, type PlanContext } from '../../lib/fuel/solve'
import { rotationEntries, rotationOf, sortedRotations } from '../../lib/fuel/rotation'
import { addNight, nightLine, nightSource, planIssues, removeNight, setServings, swapNight, withinCap } from '../../lib/fuel/planner'
import { isOwn, type OwnMealDraft } from '../../lib/fuel/ownMeal'
import { isRecorded, unrecordedSlugs } from '../../lib/fuel/record'
import MealForm from './MealForm'

/** Cooked servings a night may be set to: three per person covers a leftover night, never fewer than eight. */
export const maxServings = (household: Pick<Household, 'people_count'>) => Math.max(8, household.people_count * 3)

const NO_ROTATIONS: RotationRow[] = []
const NO_MEMBERS: RotationMealRow[] = []

/**
 * Nights dropped because their meal left the library, said in words. A meal
 * the record names is named; a night built before records existed can only be
 * counted, in the words it always had (FOR-247).
 */
export function droppedMessage(names: Array<string | null>): string {
  const named = names.filter((n): n is string => !!n).map((n) => n.toLowerCase())
  const unnamed = names.length - named.length
  const parts: string[] = []
  if (named.length) {
    const list = named.length === 1 ? named[0] : `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`
    parts.push(`${list} ${named.length === 1 ? 'is' : 'are'} no longer in your library, so ${named.length === 1 ? 'its night was' : 'their nights were'} dropped`)
  }
  if (unnamed) parts.push(`${unnamed === 1 ? 'a night whose meal is' : `${unnamed} nights whose meals are`} no longer in the library ${unnamed === 1 ? 'was' : 'were'} dropped`)
  return `${parts.join('; ')} — pick again`
}

/** What the library drawer is open for: swapping one night, or adding a night to a week. Closed otherwise. */
type Drawer = { swap: number } | { add: 1 | 2 } | null

/**
 * The meal library, as a drawer under the fortnight — open only to swap a night
 * or add one. A meal over the cook cap is shown, and cannot be picked.
 *
 * The athlete's own meals (FOR-242) sit in this same list, in the same order,
 * because they come from the same read and nothing here knows the difference.
 * They carry a quiet "yours" marker and an edit control; the marker is concrete
 * ink, not volt — an own meal is not an earned accent.
 */
export function LibraryDrawer({ meals, household, heading, onPick, onClose, onAddOwn, onEditOwn }: {
  meals: MealRow[]; household: Household; heading: string; onPick: (meal: MealRow) => void; onClose: () => void
  /** Add a meal of your own. Absent when the page cannot write meals. */
  onAddOwn?: () => void
  /** Edit one of yours. Absent for a library meal, and when the page cannot write meals. */
  onEditOwn?: (meal: MealRow) => void
}) {
  return (
    <section className="tile p-5 space-y-3" aria-label="the library">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow-mono">the library</p>
          <p className="text-sm lowercase">{heading}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onAddOwn && <button type="button" className="pill-quiet px-3 py-1.5 text-[12px] lowercase" onClick={onAddOwn}>add your own</button>}
          <button type="button" className="pill-quiet px-3 py-1.5 text-[12px] lowercase" onClick={onClose}>close</button>
        </div>
      </div>
      <ul className="space-y-2">
        {meals.map((m) => {
          const ok = withinCap(m, household)
          const mine = isOwn(m)
          return (
            <li key={m.slug} className="flex items-stretch gap-2">
              <button type="button" className="row-recessed flex-1 min-w-0 px-3.5 py-3 text-left disabled:text-muted-foreground" disabled={!ok} onClick={() => onPick(m)}>
                <span className="block text-sm font-medium lowercase">
                  {m.name}
                  {mine && <span className="eyebrow-mono-sm ml-2">yours</span>}
                </span>
                <span className="block eyebrow-mono mt-1">{nightLine(m)}</span>
                <span className="block eyebrow-mono-sm mt-0.5">
                  {m.active_cook_minutes} min active{m.protein_g_per_person ? ` · ${m.protein_g_per_person} g protein` : ''}{ok ? '' : ` · over your ${household.cook_cap_minutes}-min cap`}
                </span>
              </button>
              {mine && onEditOwn && (
                <button type="button" onClick={() => onEditOwn(m)} aria-label={`edit ${m.name}`}
                  className="pill-quiet shrink-0 px-3 text-[11px] lowercase">edit</button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default function PlanBuilder({ household, meals, initial, building, onBuild, cycles, askInventory = false, countByDefault = false, rotations = NO_ROTATIONS, members = NO_MEMBERS, onSaveMeal, onRetireMeal, libraryStale = false, savingMeal = false }: {
  household: Household; meals: MealRow[]; initial: Plan | null; building: boolean
  /** `countInventory`: whether what is on hand is counted against this plan — asked only when it was not (a NEXT cycle, or a rebuild of a plan built without it), otherwise always (Codex, rounds 15 and 16). */
  onBuild: (plan: Plan, opts: { countInventory: boolean }) => void
  /** Ask whether to count what is on hand: anything but a rebuild of a plan that already counted it — the saved choice stands unless changed here. */
  askInventory?: boolean
  /** The ask's default: on when what is on hand was saved after the newest plan was built, off when a cycle has been eating it (Codex, round 17). */
  countByDefault?: boolean
  /** The cycles already planned and where this plan would land — the rules that look across cycles read it (Codex, rounds 10, 13, 14). */
  cycles?: PlanContext
  /** The rotations the picks can start from, and their membership (FOR-238). None before the rotations migration is applied: no rotation control. */
  rotations?: RotationRow[]
  members?: RotationMealRow[]
  /** Save a meal of the athlete's own: a new one when slug is null, otherwise an edit. Returns what went wrong, in words, or null. Absent when the page cannot write meals, and then the library offers no add or edit. */
  onSaveMeal?: (slug: string | null, draft: OwnMealDraft) => Promise<string | null>
  /** Retire one of the athlete's own meals (FOR-242 AC6, FOR-247). Returns what went wrong, in words, or null when it landed. */
  onRetireMeal?: (slug: string) => Promise<string | null>
  /** The library on screen is known to be out of date — a meal write landed but the re-read failed. A list built from it would use the old ingredients, so no list is built until it is reloaded (Codex r3). */
  libraryStale?: boolean
  /** A meal write, or its library re-read, is in flight. Owned by the PAGE: this component remounts when the step changes, and a guard that a remount clears is not a guard (Codex r4). */
  savingMeal?: boolean
}) {
  const weeks = cycleWeeks(household)
  const bySlug = useMemo(() => new Map(meals.map((m) => [m.slug, m])), [meals])
  // A saved plan is reconciled against the household it is being rebuilt
  // for: a fortnight's week-two nights do not ride along into a weekly shop,
  // and a night saved for two people is brought up to what four need. A
  // saved servings choice that still feeds everyone is KEPT as chosen — the
  // recipe default applies to new selections only (Codex, round 3). A night
  // whose meal has since left the library is dropped and named: it cannot be
  // shown, so it could never be removed, and its warning would hold the build
  // down for good (Codex, round 7). A rotation prefills only a plan with no
  // saved nights — the page decides that, in builderStart (FOR-238, FOR-241).
  const [entries, setEntries] = useState<PlanEntry[]>(() => (initial?.entries ?? [])
    .filter((e) => e.week <= weeks && bySlug.has(e.slug))
    .map((e) => { const m = bySlug.get(e.slug); return m && e.servings < household.people_count ? { ...e, servings: defaultServings(m, household) } : e }))
  // Named where the night says what it was (FOR-247): a retired meal has left
  // every library read, so its name survives only on a stored night's record.
  // A night built before records existed can only be counted, as before.
  const retiredSaved = useMemo(() => {
    const names = new Map<string, string | null>()
    for (const e of initial?.entries ?? []) if (!bySlug.has(e.slug)) names.set(e.slug, names.get(e.slug) ?? (isRecorded(e) ? e.as_planned.name : null))
    return names
  }, [initial, bySlug])
  // A meal retired from THIS screen while nights on it are drafted. The draft
  // is set once, when the builder opens, so those nights would stay in it —
  // and a night whose meal is not in the library is never drawn, so it could
  // not be removed while its warning held the build down for good (Codex r7).
  // Dropped the moment the retire lands, and named: the name is still known.
  const [droppedNow, setDroppedNow] = useState<Array<{ slug: string; name: string }>>([])
  // One name per MEAL, not per source: a saved night on a meal just retired
  // is in both, and is one meal gone.
  const retired = useMemo(() => {
    const names = new Map(retiredSaved)
    for (const d of droppedNow) names.set(d.slug, names.get(d.slug) ?? d.name)
    return [...names.values()]
  }, [retiredSaved, droppedNow])
  const [drawer, setDrawer] = useState<Drawer>(null)
  // The meal form takes over the drawer rather than opening beside it: one
  // thing on screen at a time, on a phone, in a kitchen (FOR-242).
  const [mealForm, setMealForm] = useState<{ meal: MealRow | null } | null>(null)
  // Every slug a stored night stands on WITHOUT A RECORD. Such a night has been
  // SHOPPED, and steakWindowWarnings still counts it by resolving the slug
  // against the library as it stands now — so changing its meal's cut, or
  // retiring the meal out of the library read, would rewrite what last month
  // allowed (Codex r5, r8). Both freeze; everything else stays editable. A
  // night WITH a record is counted on the record and freezes nothing, and this
  // is the predicate the database refuses on (FOR-247).
  const frozenSlugs = useMemo(() => unrecordedSlugs(cycles?.history ?? []), [cycles])
  const drawerRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (drawer) drawerRef.current?.scrollIntoView({ block: 'start' }) }, [drawer])
  const [countInventory, setCountInventory] = useState(countByDefault)
  const warnings = useMemo(() => validatePlan({ entries }, meals, household, { cycles }), [entries, meals, household, cycles])
  // Every warning placed on the night, the week or the plan it belongs to —
  // the rule still gates the build; this only says where to look (FOR-241).
  const issues = useMemo(() => planIssues(warnings, entries, meals), [warnings, entries, meals])
  // FOR-238: which rotation the picks are is read from the picks themselves —
  // there is no rotation state here to disagree with them. Starting from a
  // rotation puts every night back to it, each meal at its usual week.
  const current = useMemo(() => rotationOf(entries, rotations, members), [entries, rotations, members])
  const rotationName = current ? sortedRotations(rotations).find((r) => r.slug === current)?.name.toLowerCase() ?? null : null
  const startFrom = (slug: string) => { setEntries(rotationEntries(slug, members, meals, household)); setDrawer(null) }
  const cap = maxServings(household)
  const nightsIn = (w: number) => entries.flatMap((e, i) => (e.week === w ? [{ e, i }] : []))
  const roomIn = (w: number) => nightsIn(w).length < household.nights_per_week
  const weekList = Array.from({ length: weeks }, (_, k) => (k + 1) as 1 | 2)
  const complete = weekList.every((w) => nightsIn(w).length === household.nights_per_week)
  const missing = weekList.reduce((n, w) => n + Math.max(0, household.nights_per_week - nightsIn(w).length), 0)
  const swapping = drawer && 'swap' in drawer ? entries[drawer.swap] : undefined
  const drawerWeek: 1 | 2 = drawer && 'add' in drawer ? drawer.add : (swapping?.week ?? 1)
  const drawerHeading = swapping
    ? `swap ${bySlug.get(swapping.slug)?.name.toLowerCase() ?? 'this night'} for`
    : `add a night${weeks === 2 ? ` to week ${drawerWeek}` : ''}`
  const pick = (m: MealRow) => {
    if (!drawer) return
    setEntries('swap' in drawer ? swapNight(entries, drawer.swap, m, household, cap) : addNight(entries, m, drawer.add, household, cap))
    setDrawer(null)
  }

  return (
    <div className="space-y-3">
      <section className="tile p-5 space-y-2">
        <p className="eyebrow-mono">{weeks === 2 ? 'the fortnight' : 'the week'}</p>
        <h2 className="text-[26px] lowercase">{weeks === 2 ? 'your dinners for the next two weeks' : 'your dinners for the week'}</h2>
        <p className="text-sm text-muted-foreground">
          {household.nights_per_week} nights a week. every night below goes on your shopping list — swap or remove any of them, then build the list.
        </p>
        {rotations.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <p className="eyebrow-mono">{rotationName ? `started from ${rotationName}` : 'your own picks'}</p>
            {sortedRotations(rotations).filter((r) => r.slug !== current).map((r) => (
              <button key={r.slug} type="button" onClick={() => startFrom(r.slug)} className="pill-quiet px-3 py-1.5 text-[12px] lowercase">
                start from {r.name.toLowerCase()}
              </button>
            ))}
          </div>
        )}
      </section>

      {retired.length > 0 && (
        <p className="status-msg text-[12px]" role="status">{droppedMessage(retired)}</p>
      )}

      {weekList.map((w) => (
        <section key={w} className="tile p-5 space-y-3" aria-label={weeks === 2 ? `week ${w}` : 'this week'}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="eyebrow-mono">{weeks === 2 ? `week ${w}` : 'this week'}</p>
            <p className="data-mono"><b>{nightsIn(w).length}</b> of {household.nights_per_week} nights</p>
          </div>
          {(issues.weeks.get(w) ?? []).map((t) => <p key={t} className="status-msg danger text-[12px]" role="status">{t}</p>)}
          {nightsIn(w).length === 0 && <p className="text-sm text-muted-foreground">no nights yet — add one below</p>}
          <ul className="space-y-2">
            {nightsIn(w).map(({ e, i }) => {
              const m = bySlug.get(e.slug)
              if (!m) return null
              const name = m.name.toLowerCase()
              const repeats = nightsIn(w).filter((x) => x.e.slug === e.slug).length
              return (
                <li key={`${i}-${e.slug}`} className="row-recessed px-3.5 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium lowercase">{m.name}</p>
                      <p className="eyebrow-mono mt-1">{nightLine(m)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0" role="group" aria-label={`servings of ${name}`}>
                      <span className="eyebrow-mono-sm mr-0.5">servings</span>
                      <button type="button" aria-label={`fewer servings of ${name}`} className="pill-quiet w-7 h-7 text-sm" onClick={() => setEntries(setServings(entries, e.slug, w, Math.max(1, e.servings - 1)))}>−</button>
                      <span className="stat-num text-[20px] min-w-[2ch] text-center">{e.servings}</span>
                      <button type="button" aria-label={`more servings of ${name}`} className="pill-quiet w-7 h-7 text-sm" onClick={() => setEntries(setServings(entries, e.slug, w, Math.min(cap, e.servings + 1)))}>+</button>
                    </div>
                  </div>
                  <p className="eyebrow-mono-sm">
                    {nightSource(e, current, rotations, members)} · {m.active_cook_minutes} min active · {household.people_count} eating{m.servings > 2 ? ' · leftovers come free' : ''}{repeats > 1 ? ` · ${repeats} nights, each` : ''}
                  </p>
                  {(issues.nights.get(i) ?? []).map((t) => <p key={t} className="status-msg danger text-[12px]" role="status">{t}</p>)}
                  <div className="flex gap-2">
                    <button type="button" className="pill-quiet px-3 py-1.5 text-[12px] lowercase" aria-label={`swap ${name}`} onClick={() => setDrawer({ swap: i })}>swap</button>
                    <button type="button" className="pill-quiet px-3 py-1.5 text-[12px] lowercase" aria-label={`remove ${name}`} onClick={() => { setEntries(removeNight(entries, i)); setDrawer(null) }}>remove</button>
                  </div>
                </li>
              )
            })}
          </ul>
          {roomIn(w) && (
            <button type="button" className="pill-quiet w-full py-2 text-[12px] lowercase" onClick={() => setDrawer({ add: w })}>
              add a night{weeks === 2 ? ` to week ${w}` : ''}
            </button>
          )}
        </section>
      ))}

      {drawer && (
        <div ref={drawerRef}>
          {mealForm ? (
            <MealForm meal={mealForm.meal} meals={meals} sectionOrder={household.store_section_order} busy={savingMeal}
              cutLocked={!!mealForm.meal && frozenSlugs.has(mealForm.meal.slug)}
              onRetire={onRetireMeal && mealForm.meal ? async () => {
                const m = mealForm.meal
                if (!m) return 'nothing to retire'
                const e = await onRetireMeal(m.slug)
                if (e) return e
                if (entries.some((x) => x.slug === m.slug)) {
                  setEntries((es) => es.filter((x) => x.slug !== m.slug))
                  setDroppedNow((d) => [...d, { slug: m.slug, name: m.name }])
                }
                setMealForm(null)
                return null
              } : undefined}
              onSave={async (draft) => {
                if (!onSaveMeal) return 'meals cannot be saved from here'
                const e = await onSaveMeal(mealForm.meal?.slug ?? null, draft)
                if (!e) setMealForm(null)
                return e
              }}
              onCancel={() => setMealForm(null)} />
          ) : (
            <LibraryDrawer meals={meals} household={household} heading={drawerHeading} onPick={pick} onClose={() => setDrawer(null)}
              onAddOwn={onSaveMeal ? () => setMealForm({ meal: null }) : undefined}
              onEditOwn={onSaveMeal ? (m) => setMealForm({ meal: m }) : undefined} />
          )}
        </div>
      )}

      {askInventory && household.inventory.length > 0 && (
        <div className="tile p-3 space-y-2">
          <p className="text-[12px] text-muted-foreground">
            {countByDefault ? 'What is on hand was updated after the last plan was built, so it counts against this one unless you say otherwise.' : 'What is on hand has not been updated since the last plan was built — a cycle has been eating it. Count it only if it will still be there.'}
          </p>
          <button type="button" onClick={() => setCountInventory((c) => !c)} aria-pressed={countInventory}
            className={`pill-quiet px-3 py-1.5 text-[12px] lowercase ${countInventory ? 'font-semibold' : ''}`}>
            {countInventory ? 'counting what\'s on hand again' : 'count what\'s on hand again'}
          </button>
        </div>
      )}
      {issues.plan.length > 0 && (
        <div className="status-msg danger text-[12px] space-y-1" role="status">
          {issues.plan.map((t) => <p key={t}>{t}</p>)}
        </div>
      )}

      <button type="button" className="pill-volt w-full py-3 text-sm" disabled={!complete || building || savingMeal || libraryStale || warnings.length > 0}
        onClick={() => onBuild({ entries }, { countInventory: askInventory ? countInventory : true })}>
        {building ? 'building the list…' : missing > 0 ? `add ${missing} more night${missing === 1 ? '' : 's'} to build the list` : !complete || warnings.length > 0 ? 'fix the flagged nights to build the list' : 'build the shopping list'}
      </button>
    </div>
  )
}
