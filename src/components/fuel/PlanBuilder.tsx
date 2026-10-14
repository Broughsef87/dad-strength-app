'use client'

// ── Fuel step 1 — pick the menu (FOR-281, on FOR-241's nights planner) ──────
// The suggested menu is a CARD: its plain name, its one-line description and
// its dinners, with one volt control — use this menu. Another menu is one tap
// away as a card of its own, and "change a night" opens what FOR-241 built:
// both weeks on screen at once as named nights, prefilled from a rotation
// (FOR-238's builderStart, called by the page) and changed where they stand:
// swap, remove, servings, add a night. The meal library is a drawer below the
// nights, opened only to swap a night or add one. A plan that cannot be used
// as it stands — a flagged night, a missing night — opens on its nights, so
// the thing to fix is never behind a tap. Presentation plus prefill
// only: the entries model, servings semantics and every rule belong to the
// solver, validatePlan still decides whether the list can be built, and
// planner.ts places what it says on the night that causes it.
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { Household, MealRow, Plan, PlanEntry, RotationMealRow, RotationRow } from '../../lib/fuel/types'
import { cycleWeeks, defaultServings, validatePlan, type PlanContext } from '../../lib/fuel/solve'
import { chosenRotation, rotationEntries, sortedRotations } from '../../lib/fuel/rotation'
import { addNight, nightLine, nightSource, planIssues, reconcileDraft, removeNight, setServings, swapNight, withinCap } from '../../lib/fuel/planner'
import { isOwn, type OwnMealDraft } from '../../lib/fuel/ownMeal'
import { isRecorded, unrecordedSlugs } from '../../lib/fuel/record'
import MealForm from './MealForm'
import RecipeView from './RecipeView'

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
export function LibraryDrawer({ meals, household, heading, onPick, onClose, onAddOwn, onEditOwn, onRecipe }: {
  meals: MealRow[]; household: Household; heading: string; onPick: (meal: MealRow) => void; onClose: () => void
  /** Open a meal's recipe (FUEL-RECIPES). With it, a tap on the meal opens its recipe — as it does everywhere a meal is listed — and picking it for the night is the row's own "pick" control. Absent, a tap on the meal picks it, as it did before recipes. */
  onRecipe?: (meal: MealRow) => void
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
              <button type="button" data-recipe-opener={onRecipe ? `library-${m.slug}` : undefined} aria-label={onRecipe ? `recipe for ${m.name}` : undefined}
                className={`row-recessed flex-1 min-w-0 px-3.5 py-3 text-left disabled:text-muted-foreground ${onRecipe && !ok ? 'text-muted-foreground' : ''}`}
                disabled={!onRecipe && !ok} onClick={() => (onRecipe ? onRecipe(m) : onPick(m))}>
                <span className="block text-sm font-medium lowercase">
                  {m.name}
                  {mine && <span className="eyebrow-mono-sm ml-2">yours</span>}
                </span>
                <span className="block eyebrow-mono mt-1">{nightLine(m)}</span>
                <span className="block eyebrow-mono-sm mt-0.5">
                  {m.active_cook_minutes} min active{m.protein_g_per_person ? ` · ${m.protein_g_per_person} g protein` : ''}{ok ? '' : ` · over your ${household.cook_cap_minutes}-min cap`}
                </span>
              </button>
              {onRecipe && (
                <button type="button" disabled={!ok} onClick={() => onPick(m)} aria-label={`pick ${m.name}`}
                  className="pill-quiet shrink-0 px-3 text-[11px] lowercase font-semibold disabled:text-muted-foreground disabled:font-normal">pick</button>
              )}
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

export default function PlanBuilder({ household, meals, initial, building, onBuild, cycles, rotations = NO_ROTATIONS, members = NO_MEMBERS, onSaveMeal, onRetireMeal, libraryStale = false, savingMeal = false, startEditing = false }: {
  household: Household; meals: MealRow[]; initial: Plan | null; building: boolean
  /** Use this menu: the nights go on to step 2, where what is already in the kitchen is ticked off before the list is built (FOR-281). Whether what is on hand counts is decided there and at the build, never here. */
  onBuild: (plan: Plan) => void
  /** Open on the nights rather than on the card (FOR-281). The card is the default; a plan with something to fix opens on its nights whatever this says. */
  startEditing?: boolean
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
  // Nights dropped since the builder opened, because their meal left the
  // library under a draft that was set once, when it opened (FOR-247).
  const [droppedNow, setDroppedNow] = useState<Array<{ slug: string; name: string | null }>>([])
  // One name per MEAL, not per source: a saved night on a meal just retired
  // is in both, and is one meal gone.
  const retired = useMemo(() => {
    const names = new Map(retiredSaved)
    for (const d of droppedNow) names.set(d.slug, names.get(d.slug) ?? d.name)
    return [...names.values()]
  }, [retiredSaved, droppedNow])
  const [drawer, setDrawer] = useState<Drawer>(null)
  // The library this draft was last reconciled against. When a re-read loses a
  // meal — retired here, or in another tab and picked up by any later re-read —
  // its drafted nights are dropped and named from the library they left, and
  // the drawer closes: it may be open to swap a night BY INDEX, and the nights
  // just moved under it (Codex r1, r2). Adjusted during render, the way React
  // documents state from a previous render, so a dropped night never paints.
  const [reconciledFor, setReconciledFor] = useState(bySlug)
  if (reconciledFor !== bySlug) {
    setReconciledFor(bySlug)
    const r = reconcileDraft(entries, reconciledFor, bySlug)
    if (r.dropped.length) {
      setEntries(r.entries)
      setDroppedNow((d) => [...d, ...r.dropped])
      setDrawer(null)
    }
  }
  // The meal form takes over the drawer rather than opening beside it: one
  // thing on screen at a time, on a phone, in a kitchen (FOR-242).
  const [mealForm, setMealForm] = useState<{ meal: MealRow | null } | null>(null)
  // The recipe on screen (FUEL-RECIPES): a meal, at the servings of the night
  // it was opened from, or at none when it was opened from the library. It
  // takes the page over and gives it back exactly as it was — the draft, the
  // drawer and where the athlete had scrolled to — because opening a recipe is
  // looking something up, not leaving the plan. Read through the library, so a
  // meal that leaves it mid-read simply closes.
  const [recipe, setRecipe] = useState<{ slug: string; servings?: number } | null>(null)
  const recipeMeal = recipe ? bySlug.get(recipe.slug) : undefined
  // Where it was opened from: the scroll position, and the control that opened
  // it — by name, because the plan unmounts under the recipe and that button
  // is a new element when it comes back. Focus returns to it, so a keyboard or
  // a screen reader resumes on the meal and not at the top of the document.
  const cameFrom = useRef<{ scrollY: number; opener: string } | null>(null)
  const planRef = useRef<HTMLDivElement>(null)
  const openRecipe = (opener: string, slug: string, servings?: number) => { cameFrom.current = { scrollY: window.scrollY, opener }; setRecipe({ slug, servings }) }
  useEffect(() => {
    if (recipeMeal || !cameFrom.current) return
    const { scrollY, opener } = cameFrom.current
    cameFrom.current = null
    window.scrollTo(0, scrollY)
    planRef.current?.querySelector<HTMLElement>(`[data-recipe-opener="${opener}"]`)?.focus({ preventScroll: true })
  }, [recipeMeal])
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
  const warnings = useMemo(() => validatePlan({ entries }, meals, household, { cycles }), [entries, meals, household, cycles])
  // Every warning placed on the night, the week or the plan it belongs to —
  // the rule still gates the build; this only says where to look (FOR-241).
  const issues = useMemo(() => planIssues(warnings, entries, meals), [warnings, entries, meals])
  // FOR-279: which rotation the picks are is the one they were STARTED from —
  // the menu the builder opened on, or the one tapped since — for as long as
  // most of them are still its dinners (chosenRotation). It used to be read
  // from the picks alone (FOR-238), and the soup menus share too many dinners
  // with the everyday ones for that: a cook cap that leaves the soups out and
  // the picks say nothing. The start is held here and the picks still decide
  // whether it describes them, so the two cannot drift apart. Starting from a
  // rotation puts every night back to it, each meal at its usual week.
  const [started, setStarted] = useState<string | null>(initial?.rotation ?? null)
  const current = useMemo(() => chosenRotation(started, entries, rotations, members), [started, entries, rotations, members])
  const currentRow = current ? sortedRotations(rotations).find((r) => r.slug === current) ?? null : null
  const rotationName = currentRow?.name.toLowerCase() ?? null
  // FOR-281: the other menus, each as a card, and the nights behind "change a
  // night". Picking another menu puts every night back to it and closes both.
  const [choosing, setChoosing] = useState(false)
  const [editing, setEditing] = useState(startEditing)
  const startFrom = (slug: string) => { setStarted(slug); setEntries(rotationEntries(slug, members, meals, household)); setDrawer(null); setChoosing(false); setEditing(false) }
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

  // A plan that cannot be used as it stands opens on its nights: the night to
  // fix, or the gap to fill, is on screen without a tap (FOR-281).
  const showNights = editing || !complete || warnings.length > 0 || !!drawer
  const others = sortedRotations(rotations).filter((r) => r.slug !== current)
  const dinnersOf = (list: PlanEntry[], w: number) => list.filter((e) => e.week === w).map((e) => bySlug.get(e.slug)?.name.toLowerCase()).filter((n): n is string => !!n)

  if (recipe && recipeMeal) return <RecipeView meal={recipeMeal} household={household} servings={recipe.servings} onClose={() => setRecipe(null)} />

  return (
    <div className="space-y-3" ref={planRef}>
      <section className="tile p-5 space-y-3" aria-label="this menu">
        <div>
          <p className="eyebrow-mono">{weeks === 2 ? 'your dinners for the next two weeks' : 'your dinners for the week'}</p>
          <h2 className="text-[26px] lowercase mt-1">{rotationName ?? 'your own menu'}</h2>
          {currentRow?.note && <p className="text-sm text-muted-foreground mt-1">{currentRow.note}</p>}
        </div>
        {!showNights && weekList.map((w) => (
          <div key={w} className="space-y-1">
            {weeks === 2 && <p className="eyebrow-mono-sm">week {w}</p>}
            <ol className="space-y-1">
              {nightsIn(w).map(({ e, i }, n) => {
                const m = bySlug.get(e.slug)
                if (!m) return null
                return (
                  <li key={`${i}-${e.slug}`}>
                    <button type="button" className="row-recessed w-full px-3.5 py-2.5 text-left flex items-baseline gap-3" data-recipe-opener={`menu-${i}`} aria-label={`recipe for ${m.name.toLowerCase()}`} onClick={() => openRecipe(`menu-${i}`, e.slug, e.servings)}>
                      <span className="data-mono shrink-0">{n + 1}</span>
                      <span className="text-sm lowercase min-w-0">{m.name}</span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>
        ))}
        <p className="text-sm text-muted-foreground">
          {household.nights_per_week} nights a week. every dinner here goes on your shopping list.
        </p>
        <div className="flex flex-wrap gap-2">
          {others.length > 0 && (
            <button type="button" className="pill-quiet px-3 py-1.5 text-[12px] lowercase" aria-expanded={choosing} onClick={() => setChoosing((c) => !c)}>
              {choosing ? 'keep this menu' : 'choose a different menu'}
            </button>
          )}
          <button type="button" className="pill-quiet px-3 py-1.5 text-[12px] lowercase" aria-expanded={showNights} onClick={() => { setEditing(!showNights); if (showNights) setDrawer(null) }}>
            {showNights ? 'done changing nights' : 'change a night'}
          </button>
        </div>
      </section>

      {choosing && others.map((r) => {
        const theirs = rotationEntries(r.slug, members, meals, household)
        return (
          <section key={r.slug} className="tile p-5 space-y-2" aria-label={r.name.toLowerCase()}>
            <h3 className="text-xl lowercase">{r.name}</h3>
            {r.note && <p className="text-sm text-muted-foreground">{r.note}</p>}
            {weekList.map((w) => (
              <p key={w} className="text-[12px] text-muted-foreground lowercase">
                {weeks === 2 && <span className="eyebrow-mono-sm mr-2">week {w}</span>}{dinnersOf(theirs, w).join(' · ')}
              </p>
            ))}
            <button type="button" className="pill-quiet px-3 py-1.5 text-[12px] lowercase font-semibold" onClick={() => startFrom(r.slug)}>pick {r.name.toLowerCase()}</button>
          </section>
        )
      })}

      {retired.length > 0 && (
        <p className="status-msg text-[12px]" role="status">{droppedMessage(retired)}</p>
      )}

      {showNights && weekList.map((w) => (
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
                    <button type="button" className="min-w-0 text-left" data-recipe-opener={`night-${i}`} aria-label={`recipe for ${name}`} onClick={() => openRecipe(`night-${i}`, e.slug, e.servings)}>
                      <span className="block text-sm font-medium lowercase">
                        {m.name}<ChevronRight size={14} aria-hidden="true" className="inline-block ml-0.5 -mt-0.5 text-muted-foreground" />
                      </span>
                      <span className="block eyebrow-mono mt-1">{nightLine(m)}</span>
                    </button>
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
                // The drafted nights on it are the library's business, not
                // this callback's: the re-read that follows drops them.
                const e = await onRetireMeal(m.slug)
                if (!e) setMealForm(null)
                return e
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
              onRecipe={(m) => openRecipe(`library-${m.slug}`, m.slug)}
              onAddOwn={onSaveMeal ? () => setMealForm({ meal: null }) : undefined}
              onEditOwn={onSaveMeal ? (m) => setMealForm({ meal: m }) : undefined} />
          )}
        </div>
      )}

      {issues.plan.length > 0 && (
        <div className="status-msg danger text-[12px] space-y-1" role="status">
          {issues.plan.map((t) => <p key={t}>{t}</p>)}
        </div>
      )}

      <button type="button" className="pill-volt w-full py-3 text-sm" disabled={!complete || building || savingMeal || libraryStale || warnings.length > 0}
        onClick={() => onBuild({ entries, rotation: current })}>
        {building ? 'one moment…' : missing > 0 ? `add ${missing} more night${missing === 1 ? '' : 's'} to use this menu` : !complete || warnings.length > 0 ? 'fix the flagged nights to use this menu' : 'use this menu'}
      </button>
    </div>
  )
}
