// ── Fuel: the recipe (FUEL-RECIPES) ─────────────────────────────────────────
// "Most of them are easy enough, but for beef stew and stuff I need more than
// 2 or 3 lines." A meal's steps, and its ingredients in the amounts THIS
// household cooks. Pure: a meal row in, what the recipe view prints out.
//
// Two rules hold it together.
//
// THE AMOUNTS ARE THE SHOPPING LIST'S. Each line is solve.ts's cookQuantity —
// the expression buildShoppingList sums — at the servings the night cooks. A
// recipe that scaled its own way would ask for more chicken than the list
// bought, and nobody would know which one was wrong.
//
// THE COLUMN IS NOT TRUSTED. `steps` is jsonb an athlete can write for their
// own meal, and it is null on every meal before its recipe is written. Every
// reader goes through mealSteps, which returns a clean list or an empty one —
// "no steps yet" is an answer, never a crash.
import type { Household, MealIngredient, MealRow, MealStep } from './types'
import { cookQuantity, defaultServings } from './solve'

/** A step's text may not run longer than this — a step is a line, not a page. */
export const STEP_MAX_LENGTH = 600
/** And a recipe may not hold more steps than this. */
export const STEPS_MAX = 40

/**
 * A meal's steps as a clean, ordered list. Anything that is not a step — a
 * null column, a string, an entry with no text — is dropped rather than shown,
 * so an empty list means "no steps yet" whatever the row holds.
 */
export function mealSteps(meal: Pick<MealRow, 'steps'>): MealStep[] {
  if (!Array.isArray(meal.steps)) return []
  const out: MealStep[] = []
  for (const raw of meal.steps as unknown[]) {
    if (!raw || typeof raw !== 'object') continue
    const { text, minutes } = raw as { text?: unknown; minutes?: unknown }
    if (typeof text !== 'string' || !text.trim()) continue
    const step: MealStep = { text: text.trim() }
    if (typeof minutes === 'number' && Number.isFinite(minutes) && minutes > 0) step.minutes = minutes
    out.push(step)
  }
  return out
}

/**
 * What the athlete types for their own meal, one step per line, as the column
 * stores it. Blank lines are dropped, and a number they typed in front — "1.",
 * "2)", "-" — comes off, because the view numbers the steps itself and "1. 1."
 * is what pasting a recipe would otherwise produce. Nothing typed is NULL, not
 * an empty list: one way to say "no steps yet".
 */
export function stepsFromText(text: string): MealStep[] | null {
  const steps = text.split(/\r?\n/)
    .map((line) => line.trim().replace(/^(?:\d{1,2}[.):]|[-*•])\s+/, '').trim())
    .filter(Boolean)
    .map((line) => ({ text: line }))
  return steps.length ? steps : null
}

/** A meal's steps back as the text the form edits: one per line. */
export const stepsToText = (meal: Pick<MealRow, 'steps'>): string => mealSteps(meal).map((s) => s.text).join('\n')

/** Why these steps cannot be saved, in words, or an empty list. Own meals only — the seeded steps are judged by their fixture's check. */
export function stepsIssues(steps: MealStep[] | null | undefined): string[] {
  if (!steps) return []
  const issues: string[] = []
  if (steps.length > STEPS_MAX) issues.push(`that is ${steps.length} steps — keep the recipe to ${STEPS_MAX} or fewer`)
  const long = steps.findIndex((s) => s.text.length > STEP_MAX_LENGTH)
  if (long !== -1) issues.push(`step ${long + 1} is too long — keep each step under ${STEP_MAX_LENGTH} characters, or split it in two`)
  return issues
}

/** One ingredient line of a recipe, in the amount the night cooks. */
export interface RecipeLine {
  item: string
  qty: number
  unit: string
  /** The quantity is an estimate nobody has measured yet — said, as the shopping list says it. */
  inferred: boolean
}

/**
 * The servings a recipe is printed at: the night's own when it is opened from
 * a night, otherwise what a new night of this meal would cook for this
 * household — the same default the planner picks.
 */
export function recipeServings(meal: Pick<MealRow, 'servings'>, household: Pick<Household, 'people_count'>, nightServings?: number): number {
  return nightServings && nightServings > 0 ? nightServings : defaultServings(meal, household)
}

/** The ingredients at those servings — cookQuantity, line by line, in the meal's own order. */
export function recipeLines(meal: Pick<MealRow, 'ingredients' | 'protein_g_per_person'>, household: Pick<Household, 'dietary_rules'>, servings: number): RecipeLine[] {
  const floor = household.dietary_rules.protein_floor_g_per_person
  return meal.ingredients.map((ing: MealIngredient) => ({
    item: ing.item,
    qty: Math.round(cookQuantity(ing, meal, servings, floor) * 100) / 100,
    unit: ing.unit,
    inferred: !!ing.inferred,
  }))
}

/** A quantity as a cook reads it: no trailing zeros, and ounces past a pound said in pounds too. */
export function formatQuantity(qty: number, unit: string): string {
  const trim = (n: number, places: number) => n.toFixed(places).replace(/\.?0+$/, '')
  const q = trim(qty, 2)
  if (unit === 'oz' && qty >= 16) return `${q} oz · ${trim(qty / 16, 1)} lb`
  return `${q} ${unit}`
}
