'use client'

// ── Fuel: the recipe view (FUEL-RECIPES) ─────────────────────────────────────
// "Do the meals in the app have a clickable recipe? Most of them are easy
// enough, but for beef stew and stuff I need more than 2 or 3 lines."
//
// One meal, read at the stove: what it is, how long it takes, what goes in it
// for THIS household, and the steps in order. It takes the page over rather
// than opening beside the plan — one thing on screen at a time, on a phone, in
// a kitchen, the same rule MealForm follows.
//
// Display only. The amounts come from recipe.ts, which prints the shopping
// list's own arithmetic; nothing here scales, saves or decides anything. A
// meal with no steps still opens and says so.
import { useEffect, useRef } from 'react'
import type { Household, MealRow } from '../../lib/fuel/types'
import { isOwn } from '../../lib/fuel/ownMeal'
import { formatQuantity, mealSteps, recipeLines, recipeServings } from '../../lib/fuel/recipe'

export default function RecipeView({ meal, household, servings, onClose }: {
  meal: MealRow
  household: Household
  /** The servings of the night it was opened from. Absent when opened from the library: what a new night of it would cook. */
  servings?: number
  onClose: () => void
}) {
  const cooked = recipeServings(meal, household, servings)
  const lines = recipeLines(meal, household, cooked)
  const steps = mealSteps(meal)
  const estimates = lines.some((l) => l.inferred)
  // Opened from somewhere down the page: bring the recipe to the top and hand
  // it the focus, so a screen reader starts at the name and not at the nav.
  const top = useRef<HTMLHeadingElement>(null)
  useEffect(() => { top.current?.scrollIntoView({ block: 'start' }); top.current?.focus({ preventScroll: true }) }, [])

  return (
    <section className="tile p-5 space-y-4" aria-label={`recipe for ${meal.name.toLowerCase()}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow-mono">the recipe</p>
          <h2 ref={top} tabIndex={-1} className="text-[22px] lowercase mt-1 outline-none scroll-mt-4">{meal.name}</h2>
        </div>
        <button type="button" className="pill-quiet px-3 py-1.5 text-[12px] lowercase shrink-0" onClick={onClose}>back</button>
      </div>

      <p className="data-mono">
        <b>{meal.active_cook_minutes}</b> min active{meal.total_minutes ? <> · <b>{meal.total_minutes}</b> min total</> : null} · <b>{cooked}</b> serving{cooked === 1 ? '' : 's'}
      </p>
      {meal.rotation_note && <p className="text-sm text-muted-foreground">{meal.rotation_note}</p>}

      <div className="space-y-2">
        <p className="eyebrow-mono-sm px-1">what goes in · for {cooked} serving{cooked === 1 ? '' : 's'}, {household.people_count} eating</p>
        <ul className="space-y-1.5">
          {lines.map((l) => (
            <li key={`${l.item}|${l.unit}`} className="row-recessed flex items-baseline justify-between gap-3 px-3.5 py-2.5">
              <span className="text-sm lowercase min-w-0">{l.item}</span>
              <span className="data-mono shrink-0"><b>{formatQuantity(l.qty, l.unit)}</b>{l.inferred && <span className="ml-1 text-muted-foreground">est.</span>}</span>
            </li>
          ))}
        </ul>
        {estimates && <p className="text-[11px] text-muted-foreground px-1">est. = a quantity nobody has measured yet. The first time you cook it is the measurement.</p>}
      </div>

      <div className="space-y-2">
        <p className="eyebrow-mono-sm px-1">how to cook it</p>
        {steps.length === 0 ? (
          <p className="row-recessed px-3.5 py-3 text-sm text-muted-foreground">
            No steps yet{isOwn(meal) ? ' — edit this meal in the library to add them.' : '.'}
          </p>
        ) : (
          <ol className="space-y-2">
            {steps.map((s, n) => (
              <li key={n} className="row-recessed flex gap-3 px-3.5 py-3">
                <span className="stat-num text-[20px] min-w-[2ch] text-right shrink-0 pt-0.5" aria-hidden="true">{n + 1}</span>
                <div className="min-w-0 space-y-1">
                  <p className="text-sm leading-relaxed">{s.text}</p>
                  {s.minutes ? <p className="eyebrow-mono-sm">{s.minutes} min</p> : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <button type="button" className="pill-quiet w-full py-2 text-[12px] lowercase" onClick={onClose}>back to the nights</button>
    </section>
  )
}
