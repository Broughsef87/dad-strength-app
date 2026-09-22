// ── Fuel: the nights planner's words and edits (FOR-241) ─────────────────────
// Presentation plus prefill. The solver, the entries model, servings semantics
// and the rules are settled. This module holds what the nights screen says —
// a meal's one quiet line, where a night came from, every rule warning placed
// on the night that causes it — and the edits a person makes to a night, as
// pure functions over entries so their semantics are checked, not assumed.
// Nothing here decides a rule: validatePlan does, and still gates the build.
// No I/O, no clock.
import type { Household, MealRow, PlanEntry, RotationMealRow, RotationRow } from './types'
import { FRESH_ONLY_CUTS, defaultServings } from './solve'
import { STEAK_CUT } from './record'

// ── words ────────────────────────────────────────────────────────────────────

/** A cut as a person says it. The solver's names carry underscores; nothing on screen does. */
const CUT_WORDS: Record<string, string> = { cod_halibut: 'cod or halibut' }
export const cutWords = (cut: string): string => CUT_WORDS[cut] ?? cut.replace(/_/g, ' ')

/** The one quiet line under a night — cut · profile · format — which answers "is this different from tuesday". */
export function nightLine(meal: Pick<MealRow, 'protein_cut' | 'spice_profile' | 'format'>): string {
  return [cutWords(meal.protein_cut), meal.spice_profile, meal.format].map((w) => w.replace(/_/g, ' ')).join(' · ')
}

/**
 * Where a night came from, read from the picks: the rotation's own night (its
 * meal, at the week the rotation gives it), or the athlete's. The screen never
 * implies he decided something he didn't, and never that the rotation did.
 */
export function nightSource(entry: Pick<PlanEntry, 'slug' | 'week'>, current: string | null, rotations: RotationRow[], members: RotationMealRow[]): string {
  const r = current ? rotations.find((x) => x.slug === current) : undefined
  if (r && members.some((x) => x.rotation_slug === r.slug && x.meal_slug === entry.slug && x.week === entry.week)) return `from ${r.name.toLowerCase()}`
  return 'your pick'
}

/** Every meal id in a sentence turned back into the meal's name, and no underscore left. */
export function namesFor(text: string, meals: Pick<MealRow, 'slug' | 'name'>[]): string {
  let out = text
  for (const m of [...meals].sort((a, b) => b.slug.length - a.slug.length)) out = out.split(m.slug).join(m.name.toLowerCase())
  return out.replace(/_/g, ' ')
}

// ── rule warnings, placed ────────────────────────────────────────────────────

export interface PlanIssues {
  /** By index into the entries: the nights a rule names. */
  nights: Map<number, string[]>
  /** By week: a rule about the week as a whole. */
  weeks: Map<number, string[]>
  /** About the plan as a whole, or a rule no night on screen can be blamed for. */
  plan: string[]
}

type Night = (entry: PlanEntry, meal: MealRow | undefined) => boolean
interface Placement { nights?: Night; week?: number; text: string }

const isFish = (meal?: MealRow) => !!meal && (FRESH_ONLY_CUTS as readonly string[]).includes(meal.protein_cut)

/**
 * The wordings validatePlan speaks, each with where its warning belongs. The
 * check drives every rule into violation and asserts each warning is one of
 * these, so a rule reworded in the solver fails a check instead of falling
 * through to the plan-level fallback unnoticed.
 */
// The slug class includes `~` because an athlete's own meal is namespaced
// (FOR-242): u<32 hex>~<name>. Without it a warning about an own meal stops
// matching its family and loses the night it belongs on, falling back to a
// plan-level line that does not say which night (Codex r4).
const FAMILIES: Array<{ re: RegExp; place: (m: RegExpMatchArray) => Placement }> = [
  { re: /^week (\d+): (\d+) fish nights, rule is (\d+)$/, place: (m) => ({ nights: (e, meal) => e.week === Number(m[1]) && isFish(meal), text: `${m[2]} fish nights in week ${m[1]} — the rule is ${m[3]} a week` }) },
  { re: /^week (\d+): (\d+) turkey nights, rule is (\d+)$/, place: (m) => ({ nights: (e, meal) => e.week === Number(m[1]) && meal?.protein_cut === 'ground_turkey', text: `${m[2]} ground turkey nights in week ${m[1]} — the rule is ${m[3]} a week` }) },
  { re: /^week (\d+): (\d+) nights planned, household cooks (\d+)$/, place: (m) => ({ week: Number(m[1]), text: `${m[2]} nights planned — you cook ${m[3]} a week` }) },
  { re: /^([a-z0-9~-]+): (\d+) active minutes, cap is (\d+)$/, place: (m) => ({ nights: (e) => e.slug === m[1], text: `${m[2]} minutes at the stove — your cap is ${m[3]}` }) },
  { re: /^([a-z0-9~-]+): no protein figure, so the (\d+) g floor cannot be applied to it$/, place: (m) => ({ nights: (e) => e.slug === m[1], text: `no protein figure, so your ${m[2]} g floor cannot be applied to it` }) },
  { re: /^([a-z0-9~-]+): cooks (\d+) for (\d+) people$/, place: (m) => ({ nights: (e) => e.slug === m[1] && e.servings === Number(m[2]), text: `cooks ${m[2]}, and ${m[3]} are eating` }) },
  { re: /^(\d+) nights? planned for week 2 on a weekly shop$/, place: () => ({ nights: (e) => e.week === 2, text: 'a weekly shop has no week 2 — remove this night' }) },
  { re: /^(\d+) steak nights? in the cycle, rule is (\d+) a month$/, place: (m) => ({ nights: (_e, meal) => meal?.protein_cut === STEAK_CUT, text: `${m[1]} steak nights this cycle — the rule is ${m[2]} a month` }) },
  { re: /^(\d+) steak nights in the four weeks ending in (.+), rule is (\d+) a month$/, place: (m) => ({ nights: (_e, meal) => meal?.protein_cut === STEAK_CUT, text: `${m[1]} steak nights in the four weeks ending in ${m[2]} — the rule is ${m[3]} a month` }) },
  { re: /^the cycle starting \d{4}-\d{2}-\d{2} is already planned and sits inside this fortnight/, place: (m) => ({ text: m.input ?? '' }) },
  { re: /^([a-z0-9~-]+): not in the library$/, place: () => ({ text: 'a night whose meal is no longer in the library — remove it and pick again' }) },
]

/** Is this one of the wordings the planner places? */
export const isKnownWarning = (warning: string): boolean => FAMILIES.some((f) => f.re.test(warning))

/**
 * Every validatePlan warning, placed where a person can act on it: on the
 * nights that cause it, on its week, or on the plan. A warning in a wording
 * the planner does not know is still shown — on the plan, with every meal id
 * turned back into its name — never dropped and never shown as an id. A night
 * rule that matches no night on screen is shown on the plan rather than lost.
 */
export function planIssues(warnings: string[], entries: PlanEntry[], meals: MealRow[]): PlanIssues {
  const bySlug = new Map(meals.map((m) => [m.slug, m]))
  const out: PlanIssues = { nights: new Map(), weeks: new Map(), plan: [] }
  for (const w of warnings) {
    const family = FAMILIES.find((f) => f.re.test(w))
    if (!family) { out.plan.push(namesFor(w, meals)); continue }
    const placed = family.place(w.match(family.re) as RegExpMatchArray)
    if (placed.week !== undefined) {
      out.weeks.set(placed.week, [...(out.weeks.get(placed.week) ?? []), placed.text])
    } else if (placed.nights) {
      const on = placed.nights
      const at = entries.flatMap((e, i) => (on(e, bySlug.get(e.slug)) ? [i] : []))
      if (!at.length) out.plan.push(placed.text)
      for (const i of at) out.nights.set(i, [...(out.nights.get(i) ?? []), placed.text])
    } else {
      out.plan.push(placed.text)
    }
  }
  return out
}

/** The same issues as flat sentences, each naming its night or week — for a message that is not beside the nights. */
export function planIssueSentences(warnings: string[], entries: PlanEntry[], meals: MealRow[]): string[] {
  const bySlug = new Map(meals.map((m) => [m.slug, m]))
  const issues = planIssues(warnings, entries, meals)
  const lines = new Set<string>()
  for (const [i, texts] of issues.nights) for (const t of texts) lines.add(`${(bySlug.get(entries[i].slug)?.name ?? 'a night').toLowerCase()}, week ${entries[i].week}: ${t}`)
  for (const [w, texts] of issues.weeks) for (const t of texts) lines.add(`week ${w}: ${t}`)
  for (const t of issues.plan) lines.add(t)
  return [...lines]
}

// ── edits to a night: the entries model and servings semantics, unchanged ────

/** A meal the household's cook cap allows. */
export const withinCap = (meal: Pick<MealRow, 'active_cook_minutes'>, household: Pick<Household, 'cook_cap_minutes'>): boolean => meal.active_cook_minutes <= household.cook_cap_minutes

/**
 * The servings a night of this meal starts at in this week: the figure the
 * recipe already has that week — one figure per recipe per week (Codex, round
 * 8) — otherwise what the household needs, within the cap.
 */
export function servingsFor(entries: PlanEntry[], meal: MealRow, week: number, household: Household, cap: number): number {
  const existing = entries.find((e) => e.slug === meal.slug && e.week === week)
  return existing ? existing.servings : Math.min(defaultServings(meal, household), cap)
}

/** A night added to a week. A recipe may fill more than one night (Codex, round 6); refused over the cook cap, or into a full week. */
export function addNight(entries: PlanEntry[], meal: MealRow, week: 1 | 2, household: Household, cap: number): PlanEntry[] {
  if (!withinCap(meal, household) || entries.filter((e) => e.week === week).length >= household.nights_per_week) return entries
  return [...entries, { slug: meal.slug, week, servings: servingsFor(entries, meal, week, household, cap) }]
}

/** One night swapped for another meal, in the same week, touching no other night. Refused over the cook cap; swapping a night for its own meal changes nothing. */
export function swapNight(entries: PlanEntry[], index: number, meal: MealRow, household: Household, cap: number): PlanEntry[] {
  const at = entries[index]
  if (!at || at.slug === meal.slug || !withinCap(meal, household)) return entries
  const others = entries.filter((_, i) => i !== index)
  return entries.map((e, i) => (i === index ? { slug: meal.slug, week: at.week, servings: servingsFor(others, meal, at.week, household, cap) } : e))
}

/** A night removed. Always allowed: a meal that fell outside a lowered cap must be removable, or the plan can never be made compliant (Codex, round 1). */
export const removeNight = (entries: PlanEntry[], index: number): PlanEntry[] => entries.filter((_, i) => i !== index)

/** Every night of a recipe in a week shares one servings figure; the control moves them together, and no other week's (Codex, round 8). */
export const setServings = (entries: PlanEntry[], slug: string, week: number, servings: number): PlanEntry[] => entries.map((e) => (e.slug === slug && e.week === week ? { ...e, servings } : e))
