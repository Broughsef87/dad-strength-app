// ── Fuel recipes (FUEL-RECIPES) — the standing check, its own file ───────────
// "For beef stew and stuff I need more than 2 or 3 lines." Every seeded meal
// carries a recipe, and this judges the recipes against the library they are
// written for — EVERY seeded meal, read off the generator's pairs rather than
// listed here:
//   1. every seeded slug has steps, and the steps fixture names no other slug
//   2. a step is { text, minutes? } and nothing else
//   3. a soup, stew or braise runs 8 to 12 steps; everything else 4 to 6
//   4. a recipe's minutes never add up past the meal's total_minutes, and it
//      gives at least one time and one doneness cue
//   5. a recipe uses what the meal's ingredients list holds: every ingredient
//      is named in the steps, and no OTHER ingredient the library cooks with
//      is — salt, pepper, oil and water aside
//   6. the recipe view's amounts are the shopping list's, meal by meal
//   7. what the column holds is never trusted, and an own meal's typed steps
//      round-trip
// Kept apart from fuel-solve.mjs on purpose: a revert of the recipe feature
// must not take the check that would catch the revert with it.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { buildShoppingList, cookQuantity, defaultServings } from '../../src/lib/fuel/solve.ts'
import { STEPS_MAX, STEP_MAX_LENGTH, formatQuantity, mealSteps, recipeLines, recipeServings, stepsFromText, stepsIssues, stepsToText } from '../../src/lib/fuel/recipe.ts'
import { ownMealFields, ownMealIssues } from '../../src/lib/fuel/ownMeal.ts'
import { DEFAULT_HOUSEHOLD, createOwnMeal, isMissingColumn, loadMeals, updateOwnMeal } from '../../src/lib/fuel/store.ts'
import { PAIRS, STEPS_FIXTURE, renderMealSteps, renderPair, stepIssue } from '../fuel-seed-sql.mjs'

let failures = 0, passes = 0
const assert = (cond, msg) => { if (cond) passes++; else { failures++; console.log('  ✗ ' + msg) } }
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const read = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'))

const library = PAIRS.flatMap((pair) => pair.meals(read(pair.fixture)))
const fixture = read(STEPS_FIXTURE)
const steps = fixture.fuel_meal_steps
const pair = PAIRS.find((p) => p.fixture === STEPS_FIXTURE)

// ── 1. the same set of slugs ─────────────────────────────────────────────────
assert(library.length > 0, `there is a seeded library to judge — ${library.length} meals`)
assert(!!pair && pair.migration === 'supabase/migrations/20261012_fuel_meal_steps.sql', 'the steps fixture is a pair of the one generator, rendering 20261012_fuel_meal_steps.sql')
for (const m of library) assert(Array.isArray(steps[m.slug]) && steps[m.slug].length > 0, `${m.slug} has steps`)
for (const slug of Object.keys(steps)) assert(library.some((m) => m.slug === slug), `${slug} has steps and is a seeded meal`)
assert(Object.keys(steps).length === library.length, `one recipe per seeded meal — ${Object.keys(steps).length} recipes, ${library.length} meals`)

// The soups and stews Andrew asked about by name, so none can be renamed out
// from under the check.
const NAMED = ['beef-barley-stew', 'chicken-tortilla-soup', 'white-chicken-chili', 'italian-wedding-soup', 'pork-green-chili', 'lentil-sausage-soup', 'turkey-chili', 'zuppa-toscana']
for (const slug of NAMED) assert((steps[slug] ?? []).length >= 8, `${slug} is one of the eight soups and stews, with a full recipe — ${(steps[slug] ?? []).length} steps`)

// ── 5's vocabulary: the words that name an ingredient ────────────────────────
// A word of an ingredient's name counts unless it only describes one — a
// colour, a cut, a state — or is also an ordinary kitchen verb ("brown",
// "chop", "snap") that would flag a step for cooking rather than for an
// ingredient. A plural is its singular.
const DESCRIBES = new Set(['and', 'or', 'in', 'di', 'all', 'purpose', 'low', 'sodium', 'nonfat', 'unsweetened', 'boneless', 'skinless',
  'fresh', 'dried', 'ground', 'raw', 'peeled', 'frozen', 'crushed', 'diced', 'shredded', 'smoked', 'toasted', 'roasted', 'fire',
  'baby', 'mini', 'sweet', 'pearl', 'english', 'cherry', 'greek', 'flat', 'leaf', 'bone', 'half',
  'green', 'white', 'red', 'black', 'yellow', 'brown',
  'powder', 'seasoning', 'paste', 'sauce', 'flake', 'steak', 'chop', 'snap', 'breadcrumb',
  // Allowed in every recipe (the ticket): salt, pepper, oil and water.
  'salt', 'pepper', 'oil', 'water'])
const singular = (w) => (w.length > 3 && w.endsWith('oes') ? w.slice(0, -2) : w.length > 3 && w.endsWith('ies') ? `${w.slice(0, -3)}y` : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)
const words = (text) => (text.toLowerCase().match(/[a-z]+/g) ?? []).map(singular)
const naming = (item) => words(item).filter((w) => !DESCRIBES.has(w))
const vocabulary = new Set(library.flatMap((m) => m.ingredients.flatMap((i) => naming(i.item))))
assert(vocabulary.has('garlic') && vocabulary.has('stock') && vocabulary.has('butter') && !vocabulary.has('salt'), 'the ingredient vocabulary is read off the library, salt, pepper, oil and water aside')

// A temperature a cook stops AT, as opposed to one an oven is set to.
const endpoints = (text) => (text.match(/\d{3}(?=F\b)/g) ?? []).map(Number).filter((t) => t < 250)
const safeFloorF = (cut) => (/chicken|turkey/.test(cut) ? 165 : /^(ribeye|flank|chuck)$/.test(cut) ? 130 : 145)
// Proved against recipes that break it: a scan that matches nothing passes everything (Codex r2).
assert(JSON.stringify(endpoints('Heat the oven to 425F. Cook to 125-130F, or 140F.')) === '[130,140]', `the scan reads the temperatures a step stops at and not the oven's — ${JSON.stringify(endpoints('Heat the oven to 425F. Cook to 125-130F, or 140F.'))}`)
assert(endpoints('until the salmon flakes at 130F').some((t) => t < safeFloorF('salmon')) && endpoints('until the thighs read 160F').some((t) => t < safeFloorF('chicken_thigh')) && !endpoints('to 145F').some((t) => t < safeFloorF('pork_chop')), 'salmon at 130F and chicken at 160F are below their floors, and pork at 145F is not')

for (const m of library) {
  const recipe = steps[m.slug] ?? []
  const text = recipe.map((s) => s.text).join(' ')
  const said = new Set(words(text))

  // ── 2. the shape ───────────────────────────────────────────────────────────
  recipe.forEach((s, i) => assert(stepIssue(s) === null, `${m.slug} step ${i + 1} is { text, minutes? } — it ${stepIssue(s)}`))
  recipe.forEach((s, i) => assert(s.text.length <= STEP_MAX_LENGTH, `${m.slug} step ${i + 1} fits a line — ${s.text.length} characters`))

  // ── 3. as long as the meal needs ───────────────────────────────────────────
  const long = m.format === 'soup' || m.format === 'braise'
  const [lo, hi] = long ? [8, 12] : [4, 6]
  assert(recipe.length >= lo && recipe.length <= hi, `${m.slug} (${m.format}) runs ${lo} to ${hi} steps — it has ${recipe.length}`)

  // ── 4. the clock, and something to cook to ─────────────────────────────────
  const minutes = recipe.reduce((n, s) => n + (s.minutes ?? 0), 0)
  assert(minutes > 0 && minutes <= m.total_minutes, `${m.slug}'s steps add up to no more than its ${m.total_minutes} minutes — ${minutes}`)
  assert(/\d\s*(to\s*\d+\s*)?(minutes?|hours?|seconds?)\b/.test(text), `${m.slug} gives a time`)
  assert(/\buntil\b|\d{3}(-\d{3})?F\b/.test(text), `${m.slug} gives a doneness cue or a temperature`)

  // Poultry and ground meat to 165F, pork and fish to 145F: no recipe tells
  // the cook to stop below the safe endpoint for what is in the pan. Whole
  // cuts of beef may name a rarer temperature beside it.
  const temps = endpoints(text)
  const floorF = safeFloorF(m.protein_cut)
  assert(temps.every((t) => t >= floorF), `${m.slug} (${m.protein_cut}) never stops below ${floorF}F — it names ${temps.join(', ')}`)

  // ── 5. its own ingredients, all of them, and nobody else's ─────────────────
  const own = new Set(m.ingredients.flatMap((i) => naming(i.item)))
  for (const ing of m.ingredients) {
    const names = naming(ing.item)
    const used = names.length ? names.some((w) => said.has(w)) : text.toLowerCase().includes(ing.item.toLowerCase())
    assert(used, `${m.slug} uses its ${ing.item}`)
  }
  const foreign = [...said].filter((w) => vocabulary.has(w) && !own.has(w))
  assert(foreign.length === 0, `${m.slug} names only what is on its ingredients list — also names: ${foreign.join(', ')}`)
}

// The scan itself, proved against a step that breaks it: a check that cannot
// fail is not a check.
{
  const stew = library.find((m) => m.slug === 'beef-barley-stew')
  const own = new Set(stew.ingredients.flatMap((i) => naming(i.item)))
  const planted = words('Add the garlic and a knob of butter with the onions.').filter((w) => vocabulary.has(w) && !own.has(w))
  assert(planted.includes('garlic') && planted.includes('butter') && !planted.includes('onion'), `the scan flags garlic and butter in the stew and leaves its onion alone — flagged: ${planted.join(', ')}`)
}

// ── 1 and 2 again, at the generator: it refuses what the check would fail ────
{
  const refuses = (mutate, pattern, what) => {
    const copy = structuredClone(fixture)
    mutate(copy.fuel_meal_steps)
    let threw = null
    try { renderMealSteps(copy, pair) } catch (e) { threw = e }
    assert(threw !== null && pattern.test(threw.message), `the generator refuses ${what} — ${threw?.message?.slice(0, 100) ?? 'it rendered'}`)
  }
  refuses((s) => { delete s['beef-barley-stew'] }, /beef-barley-stew: is a seeded meal with no steps/, 'a seeded meal with no steps')
  refuses((s) => { s['beef-stew'] = s['beef-barley-stew'] }, /beef-stew: has steps but is not a seeded meal/, 'steps for a slug that is not a meal')
  refuses((s) => { s['turkey-chili'] = [] }, /turkey-chili: steps must be a non-empty ordered list/, 'an empty recipe')
  refuses((s) => { s['turkey-chili'][0] = { text: '' } }, /turkey-chili: step 1 has no text/, 'a step with no text')
  refuses((s) => { s['turkey-chili'][0] = { text: 'Dice.', minutes: 0 } }, /turkey-chili: step 1 has minutes 0/, 'a step with zero minutes')
  refuses((s) => { s['turkey-chili'][0] = { text: 'Dice.', note: 'x' } }, /turkey-chili: step 1 carries note/, 'a step with a key the column does not hold')
  const sql = renderPair(pair)
  assert(/ADD COLUMN IF NOT EXISTS steps jsonb;/.test(sql) && !/\bDROP (TABLE|COLUMN)\b(?![^\n]*steps;)/.test(sql.replace(/--[^\n]*/g, '')), 'the migration adds one nullable column and drops no table or column')
  assert(/WHERE m\.slug = seeded\.slug AND m\.user_id IS NULL;/.test(sql), 'the update reaches seeded meals only — an own meal is never written by a migration')
  for (const m of library) assert(sql.includes(`('${m.slug}', '[`), `the migration carries ${m.slug}'s steps`)
}

// ── 6. the recipe's amounts are the shopping list's ──────────────────────────
// One night of one meal, nothing on hand and nothing diverted, so the list IS
// what the night cooks. Across the households the solver treats differently:
// two and five people, a protein floor below and above the meal's own figure.
{
  const households = [
    { ...DEFAULT_HOUSEHOLD, inventory: [], prep_diversion_pct: 0 },
    { ...DEFAULT_HOUSEHOLD, inventory: [], prep_diversion_pct: 0, people_count: 5, dietary_rules: { ...DEFAULT_HOUSEHOLD.dietary_rules, protein_floor_g_per_person: 60 } },
    { ...DEFAULT_HOUSEHOLD, inventory: [], prep_diversion_pct: 0, people_count: 1, dietary_rules: { ...DEFAULT_HOUSEHOLD.dietary_rules, protein_floor_g_per_person: 0 } },
  ]
  let compared = 0
  for (const h of households) for (const m of library) {
    const servings = recipeServings(m, h)
    assert(servings === defaultServings(m, h), `${m.slug}: opened from the library, it is printed at the servings a new night would cook`)
    const list = buildShoppingList(h, library, { entries: [{ slug: m.slug, week: 1, servings }] })
    const lines = recipeLines(m, h, servings)
    assert(lines.length === m.ingredients.length, `${m.slug}: one recipe line per ingredient`)
    for (const line of lines) {
      const bought = list.items.find((i) => i.item === line.item && i.unit === line.unit)
      compared++
      assert(!!bought && Math.abs(bought.qty - line.qty) < 0.011, `${m.slug} for ${h.people_count}: the recipe's ${line.item} is the list's — recipe ${line.qty} ${line.unit}, list ${bought?.qty}`)
    }
  }
  assert(compared > library.length * 3, `every ingredient of every meal was compared, for each household — ${compared} lines`)
  const stew = library.find((m) => m.slug === 'beef-barley-stew')
  assert(recipeServings(stew, households[0], 9) === 9, 'opened from a night, a recipe is printed at that night\'s servings')
  const chuck = stew.ingredients.find((i) => i.item === 'beef chuck')
  assert(cookQuantity(chuck, stew, 4, 0) === chuck.qty_per_person * 4, 'with no protein floor, what a night cooks is quantity per person × servings')
  assert(recipeLines(stew, households[1], 4).find((l) => l.item === 'beef chuck').qty > chuck.qty_per_person * 4, 'a protein floor above the meal\'s figure scales the cut up in the recipe, as it does on the list')
  assert(recipeLines(stew, households[1], 4).find((l) => l.item === 'carrot').qty === 6, 'and leaves everything that is not the protein alone')
  assert(formatQuantity(56, 'oz') === '56 oz · 3.5 lb' && formatQuantity(2.64, 'cup dry') === '2.64 cup dry' && formatQuantity(6, 'each') === '6 each' && formatQuantity(1.5, 'tsp') === '1.5 tsp', 'a quantity prints without trailing zeros, and ounces past a pound say pounds too')
}

// ── 7. the column is not trusted, and typed steps round-trip ─────────────────
{
  assert(mealSteps({}).length === 0 && mealSteps({ steps: null }).length === 0, 'a meal with no steps reads as an empty list — "no steps yet"')
  assert(mealSteps({ steps: 'boil it' }).length === 0 && mealSteps({ steps: { text: 'boil it' } }).length === 0, 'a string or an object in the column is not a recipe')
  const mixed = mealSteps({ steps: [{ text: '  Boil.  ', minutes: 5 }, null, 'stir', { text: '' }, { text: 'Rest.', minutes: -1 }, { minutes: 3 }, { text: 'Serve.', minutes: '4' }] })
  assert(JSON.stringify(mixed) === JSON.stringify([{ text: 'Boil.', minutes: 5 }, { text: 'Rest.' }, { text: 'Serve.' }]), `what is not a step is dropped, and minutes that are not a positive number come off — ${JSON.stringify(mixed)}`)

  assert(stepsFromText('') === null && stepsFromText('  \n \n') === null, 'nothing typed is null, not an empty list')
  const typed = stepsFromText('1. Brown the beef\n\n2) Add the stock\n- Simmer 2 hours\n  Serve  \n350F oven for 20 minutes')
  assert(JSON.stringify(typed) === JSON.stringify([{ text: 'Brown the beef' }, { text: 'Add the stock' }, { text: 'Simmer 2 hours' }, { text: 'Serve' }, { text: '350F oven for 20 minutes' }]),
    `one step per line, blank lines dropped, a typed number or dash taken off — and a step that starts with a temperature kept whole — ${JSON.stringify(typed)}`)
  assert(stepsToText({ steps: typed }) === 'Brown the beef\nAdd the stock\nSimmer 2 hours\nServe\n350F oven for 20 minutes', 'and the form gets them back, one per line')
  assert(JSON.stringify(stepsFromText(stepsToText({ steps: typed }))) === JSON.stringify(typed), 'typed steps survive an edit unchanged')

  const draft = (over = {}) => ({ name: 'Lisa\'s thing', servings: 3, protein_g_per_person: 40, protein_cut: 'chicken_thigh', ingredients: [{ item: 'chicken thigh', qty_per_person: 8, unit: 'oz', store_section: 'Meat & Seafood', inferred: false }], ...over })
  assert(ownMealFields(draft()).steps === null && 'steps' in ownMealFields(draft()), 'an own meal saved without steps writes null — so an edit that clears them clears them')
  assert(ownMealFields(draft({ steps: [] })).steps === null, 'and an empty list is the same null')
  assert(JSON.stringify(ownMealFields(draft({ steps: [{ text: ' Brown it. ', minutes: 9 }] })).steps) === JSON.stringify([{ text: 'Brown it.' }]), 'an own meal\'s steps are saved as text, trimmed')
  assert(ownMealIssues(draft()).length === 0 && ownMealIssues(draft({ steps: typed })).length === 0, 'steps are optional: a meal saves with or without them')
  assert(stepsIssues(null).length === 0 && stepsIssues([{ text: 'x'.repeat(STEP_MAX_LENGTH + 1) }]).length === 1, 'a step longer than a line is refused in words')
  assert(ownMealIssues(draft({ steps: Array.from({ length: STEPS_MAX + 1 }, () => ({ text: 'stir' })) })).some((i) => /keep the recipe to/.test(i)), 'and so is a recipe with too many steps')
}

// ── The library read, before and after the steps migration ───────────────────
// The recipes ride in the one read. Before the migration the column is not
// there: the read falls back, every meal reads as it did, and nothing errors.
{
  const fakeDb = (has) => {
    const asked = []
    const select = (columns) => {
      asked.push(columns)
      const missing = columns.split(',').map((c) => c.trim()).find((c) => !has.includes(c) && (c === 'steps' || c === 'user_id'))
      const result = missing
        ? { data: null, error: { code: '42703', message: `column fuel_meals.${missing} does not exist` } }
        : { data: [{ slug: 'beef-barley-stew', ...(columns.includes('steps') ? { steps: steps['beef-barley-stew'] } : {}) }], error: null }
      const chain = { eq: () => chain, order: () => chain, then: (resolve) => resolve(result) }
      return chain
    }
    return { asked, from: () => ({ select }) }
  }
  const after = fakeDb(['user_id', 'steps'])
  const a = await loadMeals(after)
  assert(a.error === null && after.asked.length === 1 && mealSteps(a.meals[0]).length === steps['beef-barley-stew'].length, 'with the migration applied, the library read brings each meal\'s steps in one query')
  const before = fakeDb(['user_id'])
  const b = await loadMeals(before)
  assert(b.error === null && b.meals.length === 1 && before.asked.length === 2 && /user_id/.test(before.asked[1]) && !/steps/.test(before.asked[1]) && mealSteps(b.meals[0]).length === 0,
    'before it, the read falls back to the columns that exist and the meal says "no steps yet"')
  const oldest = fakeDb([])
  const c = await loadMeals(oldest)
  assert(c.error === null && c.meals.length === 1 && oldest.asked.length === 3, 'and before own meals too, it still reads the library')
}

// ── An own meal still saves in the window before the migration ───────────────
// The app deploys on merge and the migration is applied separately. A meal
// saved without steps must save exactly as it did; one saved WITH steps must
// fail and say so, never succeed having dropped what was typed (Codex r1).
{
  const writeDb = (hasSteps) => {
    const sent = []
    const write = (row) => {
      sent.push(row)
      const builder = {
        eq: () => builder,
        select: (columns) => ({
          single: async () => (!hasSteps && ('steps' in row || /steps/.test(columns))
            ? { data: null, error: { code: 'PGRST204', message: "Could not find the 'steps' column of 'fuel_meals' in the schema cache" } }
            : { data: { ...row }, error: null }),
        }),
      }
      return builder
    }
    return { sent, from: () => ({ insert: write, update: write }) }
  }
  const user = '0f8fad5b-d9cb-469f-a165-70867728950e'
  const plain = { name: 'Chicken thing', servings: 3, protein_g_per_person: 40, protein_cut: 'chicken_thigh', ingredients: [{ item: 'chicken thigh', qty_per_person: 8, unit: 'oz', store_section: 'Meat & Seafood', inferred: false }] }
  const withSteps = { ...plain, steps: [{ text: 'Brown it.' }] }

  const before = writeDb(false)
  const made = await createOwnMeal(before, user, plain)
  assert(made.error === null && made.meal?.name === 'Chicken thing' && before.sent.length === 2 && 'steps' in before.sent[0] && !('steps' in before.sent[1]), 'before the migration, a new meal without steps saves as it always did — retried once without the column')
  const edited = await updateOwnMeal(writeDb(false), 'u0f8fad5bd9cb469fa16570867728950e~chicken-thing', plain)
  assert(edited.error === null && edited.meal?.name === 'Chicken thing', 'and so does an edit')
  const lost = writeDb(false)
  const refused = await createOwnMeal(lost, user, withSteps)
  assert(refused.meal === null && isMissingColumn(refused.error) && lost.sent.length === 1, 'a meal saved WITH steps is not retried without them — it fails rather than dropping what was typed')
  const after = writeDb(true)
  const saved = await createOwnMeal(after, user, withSteps)
  assert(saved.error === null && after.sent.length === 1 && JSON.stringify(saved.meal?.steps) === JSON.stringify([{ text: 'Brown it.' }]), 'with the migration applied, the steps are written in the one statement')
}

if (failures) { console.log(`\nfuel-steps: ${failures} of ${failures + passes} checks FAILED`); process.exit(1) }
console.log(`fuel-steps: ${passes} checks passed — every one of the ${library.length} seeded meals has a recipe written from its own ingredients`)
