// ── Fuel: the athlete's own meals (FOR-242) ─────────────────────────────────
// One fuel_meals table, one nullable user_id. NULL is the seeded library, a
// value is that athlete's own meal. There is no second table, no second read
// path and no solver branch — everything here is about the SLUG and about
// refusing a meal that cannot solve a list.
//
// SLUGS ARE FOREIGN KEYS: fuel_rotation_meals.meal_slug references
// fuel_meals(slug), and fuel_plans.meal_ids and stored list rows carry them.
// A collision corrupts someone's history, so an own slug is namespaced to its
// owner and the database enforces it with a CHECK — this module mints what that
// constraint already demands, it does not define the rule. The two must agree:
// 20260920_fuel_own_meals.sql checks left(slug, 34) = 'u' || <32 hex> || '~'.
import type { MealIngredient, MealRow } from './types'

/** 'u' + the owner's uuid with its dashes removed + '~'. 34 characters, always. */
export const OWN_PREFIX_LENGTH = 34

/** The namespace an athlete's slugs live in. The full 32 hex digits, never a prefix of them, so two athletes can never contend for a slug. */
export const ownNamespace = (userId: string): string => `u${userId.replace(/-/g, '')}~`

/** Is this a slug an athlete owns? Shape only — it says nothing about WHO owns it. */
export const isOwnSlug = (slug: string): boolean => /^u[0-9a-f]{32}~.+$/.test(slug)

/** Does this slug belong to this athlete? The question the database's CHECK asks. */
export const ownedBy = (slug: string, userId: string): boolean => slug.startsWith(ownNamespace(userId)) && slug.length > OWN_PREFIX_LENGTH

/** An own meal, as opposed to one from the seeded library. The row's owner is the truth; the slug is a consequence. */
export const isOwn = (meal: Pick<MealRow, 'user_id'>): boolean => !!meal.user_id

/**
 * A name reduced to slug characters. Lowercase, runs of anything else become
 * one dash, no leading or trailing dash. A name of nothing but punctuation
 * leaves an empty tail, which mintOwnSlug refuses rather than minting a slug
 * that is only a namespace.
 */
export const slugifyName = (name: string): string =>
  name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/**
 * The slug for an athlete's meal. Deterministic on (owner, name), so the same
 * name twice is the same slug — and the database's UNIQUE (slug) then refuses
 * the second one. That is the behaviour we want: "you already have a meal
 * called that" is a better answer than two meals nobody can tell apart.
 * Returns null when the name leaves nothing to slugify.
 */
export function mintOwnSlug(userId: string, name: string): string | null {
  const tail = slugifyName(name)
  if (!tail || !/^[0-9a-f]{32}$/.test(userId.replace(/-/g, ''))) return null
  return ownNamespace(userId) + tail
}

/** What the athlete types. Everything the solver needs and nothing it does not — the rest is defaulted, because a form asking fourteen questions does not get used (FOR-242 §7). */
export interface OwnMealDraft {
  name: string
  servings: number
  ingredients: MealIngredient[]
  /** Optional, and defaulted when left out. Shown on the meal but never used to solve a list. */
  protein_g_per_person?: number | null
  active_cook_minutes?: number
  total_minutes?: number | null
  perishable_within_days?: number | null
}

/** What an own meal is when the athlete did not say. These are shown and editable later; none of them changes a shopping list. */
export const OWN_MEAL_DEFAULTS = {
  protein_cut: 'own',
  spice_profile: 'own',
  format: 'own',
  active_cook_minutes: 20,
  total_minutes: null,
  protein_g_per_person: null,
  perishable_within_days: null,
} as const

/**
 * Why this meal cannot be saved, in words that name the field. Empty means it
 * can. A meal with no ingredients is refused rather than accepted: it would sit
 * in the library contributing nothing to any list, which is worse than a
 * refusal because nobody would know why the shop was short (FOR-242 §4).
 */
export function ownMealIssues(draft: OwnMealDraft): string[] {
  const issues: string[] = []
  const name = draft.name.trim()
  if (!name) issues.push('give the meal a name')
  else if (name.length > 120) issues.push('the name is too long — keep it under 120 characters')
  else if (!slugifyName(name)) issues.push('the name needs at least one letter or number')
  if (!Number.isInteger(draft.servings) || draft.servings < 1) issues.push('servings must be a whole number, at least 1')
  const rows = draft.ingredients.filter((i) => i.item.trim())
  if (!rows.length) issues.push('add at least one ingredient — a meal with none cannot put anything on the shopping list')
  for (const ing of rows) {
    if (!ing.store_section.trim()) issues.push(`${ing.item.trim()} needs an aisle`)
    if (!(ing.qty_per_person > 0)) issues.push(`${ing.item.trim()} needs a quantity per person above zero`)
    if (!ing.unit.trim()) issues.push(`${ing.item.trim()} needs a unit`)
  }
  const seen = new Set<string>()
  for (const ing of rows) {
    const k = `${ing.item.trim().toLowerCase()}|${ing.unit.trim().toLowerCase()}`
    if (seen.has(k)) issues.push(`${ing.item.trim()} is listed twice in the same unit — put it on one line`)
    seen.add(k)
  }
  return issues
}

/**
 * Everything a draft says, as columns — the slug and the owner aside. This is
 * what an EDIT writes: the slug is minted once at creation and never moves,
 * because it is a foreign key (see mintOwnSlug). Trimmed here so the database
 * never stores the spaces.
 */
export function ownMealFields(draft: OwnMealDraft): Omit<MealRow, 'slug' | 'user_id'> {
  return {
    name: draft.name.trim(),
    protein_cut: OWN_MEAL_DEFAULTS.protein_cut,
    spice_profile: OWN_MEAL_DEFAULTS.spice_profile,
    format: OWN_MEAL_DEFAULTS.format,
    active_cook_minutes: draft.active_cook_minutes ?? OWN_MEAL_DEFAULTS.active_cook_minutes,
    total_minutes: draft.total_minutes ?? OWN_MEAL_DEFAULTS.total_minutes,
    servings: draft.servings,
    protein_g_per_person: draft.protein_g_per_person ?? OWN_MEAL_DEFAULTS.protein_g_per_person,
    perishable_within_days: draft.perishable_within_days ?? OWN_MEAL_DEFAULTS.perishable_within_days,
    rotation_note: null,
    ingredients: draft.ingredients
      .filter((i) => i.item.trim())
      .map((i) => ({ item: i.item.trim(), qty_per_person: i.qty_per_person, unit: i.unit.trim(), store_section: i.store_section.trim(), inferred: i.inferred ?? false })),
  }
}

/** The row to INSERT for a new own meal: its fields, its owner, and the slug minted from its name. */
export function ownMealRow(userId: string, draft: OwnMealDraft): (Omit<MealRow, 'user_id'> & { user_id: string }) | null {
  const slug = mintOwnSlug(userId, draft.name.trim())
  if (!slug) return null
  return { ...ownMealFields(draft), slug, user_id: userId }
}
