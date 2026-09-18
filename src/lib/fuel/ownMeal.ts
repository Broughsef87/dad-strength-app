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
import { FRESH_ONLY_CUTS } from './solve'

/**
 * The cuts validatePlan and the second-trip rule key on. Taken from the
 * solver's own list where there is one, so a cut cannot carry a rule the form
 * never offers. 'ground_turkey' and 'ribeye' are named in validatePlan itself
 * rather than in a list, so they are repeated here — the fuel-own-meals suite
 * pins them against solve.ts so this copy cannot drift.
 */
export const RULE_CUTS: readonly string[] = [...FRESH_ONLY_CUTS, 'ground_turkey', 'ribeye']

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

/**
 * What the athlete types. The minimum that SOLVES AND VALIDATES a list, which
 * is a higher bar than the minimum that solves one — a plan cannot be built
 * while it carries a warning (PlanBuilder's build control), so a field
 * validatePlan warns about is not optional however little the solver needs it.
 *
 * Everything else — spice profile, format, minutes, perishable days — is
 * defaulted and never asked, because a form asking fourteen questions does not
 * get used (FOR-242 §7).
 */
export interface OwnMealDraft {
  name: string
  servings: number
  ingredients: MealIngredient[]
  /**
   * REQUIRED. validatePlan warns when a meal has no protein figure, and a plan
   * with any warning cannot be built — so defaulting this to null made every
   * own meal unusable (Codex r1, P1).
   */
  protein_g_per_person: number
  /**
   * REQUIRED. The solver keys the fish, turkey and steak frequency rules on the
   * cut, and second-trip placement too. A meal marked with an ownership word
   * instead of its real cut is invisible to all of them, which is exactly the
   * bug FOR-242 §4 says must not exist: the rules apply to whatever is picked,
   * seeded or own (Codex r1, P2).
   */
  protein_cut: string
  active_cook_minutes?: number
  total_minutes?: number | null
  perishable_within_days?: number | null
}

/** What an own meal is when the athlete did not say. None of these changes a shopping list or a rule. */
export const OWN_MEAL_DEFAULTS = {
  spice_profile: 'own',
  format: 'own',
  active_cook_minutes: 20,
  total_minutes: null,
  perishable_within_days: null,
} as const

/** The cut an athlete picks when none of the named ones fit. Deliberately not a cut any rule keys on. */
export const OTHER_CUT = 'other'

/**
 * The cuts to offer, from the library itself plus the ones the rules key on —
 * so the cuts that carry a frequency rule can always be chosen even if the
 * library happens not to cook one this fortnight. One source: no hand-kept list
 * to drift from what the solver reads.
 */
export function cutOptions(meals: Pick<MealRow, 'protein_cut'>[]): string[] {
  const cuts = new Set<string>(RULE_CUTS)
  for (const m of meals) if (m.protein_cut && m.protein_cut !== OTHER_CUT) cuts.add(m.protein_cut)
  return [...cuts].sort((a, b) => a.localeCompare(b)).concat(OTHER_CUT)
}

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
  // Not optional: a plan carrying a warning cannot be built, and validatePlan
  // warns on a missing protein figure (Codex r1, P1).
  // Whole grams: fuel_meals.protein_g_per_person is an int, so 42.5 is refused
  // here rather than failing on the way into the database (Codex r2).
  if (!Number.isInteger(draft.protein_g_per_person) || draft.protein_g_per_person <= 0) issues.push('give the protein per person in whole grams — without it the plan cannot be built')
  if (!draft.protein_cut?.trim()) issues.push('say what the protein is — the fish, turkey and steak rules are counted on it')
  // Gates selection: LibraryDrawer refuses a meal over the household's cook cap,
  // so a defaulted 20 minutes made every own meal unpickable for a household
  // capped at 10 or 15 (Codex r5).
  if (draft.active_cook_minutes !== undefined && (!Number.isInteger(draft.active_cook_minutes) || draft.active_cook_minutes <= 0)) {
    issues.push('active minutes must be a whole number above zero — it is what your cook cap is measured against')
  }
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
    protein_cut: draft.protein_cut.trim(),
    spice_profile: OWN_MEAL_DEFAULTS.spice_profile,
    format: OWN_MEAL_DEFAULTS.format,
    active_cook_minutes: draft.active_cook_minutes ?? OWN_MEAL_DEFAULTS.active_cook_minutes,
    total_minutes: draft.total_minutes ?? OWN_MEAL_DEFAULTS.total_minutes,
    servings: draft.servings,
    protein_g_per_person: draft.protein_g_per_person,
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
