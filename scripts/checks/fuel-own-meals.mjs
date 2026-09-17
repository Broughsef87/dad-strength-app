// ── Fuel own meals (FOR-242) — a standing invariant, its own file ───────────
// An own meal's slug can never equal a slug the seeded library uses — for ANY
// library and ANY name, not one example. Slugs are foreign keys:
// fuel_rotation_meals.meal_slug REFERENCES fuel_meals(slug), and fuel_plans and
// stored list rows carry them. A collision corrupts someone's history.
//
// The slugs are minted for real, over both seeded fixtures and generated
// libraries with hostile names — names that are already namespaced, names made
// of punctuation, unicode, empty strings. A fixed seed, so a failure reproduces.
//
// It also pins the ONE fact this rests on that lives in two places: the
// namespace TypeScript mints and the CHECK constraint the database enforces
// must be the same rule. If someone widens one, this goes red rather than
// letting a row exist that only one of them believes in.
//
// This file is deliberately NOT the migration and NOT ownMeal.ts: a revert of
// the feature must not take the check that would catch the revert with it.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { OTHER_CUT, OWN_PREFIX_LENGTH, RULE_CUTS, cutOptions, isOwn, isOwnSlug, mintOwnSlug, ownMealFields, ownMealIssues, ownNamespace, ownedBy, slugifyName } from '../../src/lib/fuel/ownMeal.ts'

let failures = 0, passes = 0
const assert = (cond, msg) => { if (cond) passes++; else { failures++; console.log('  ✗ ' + msg) } }
const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const MIGRATION = 'supabase/migrations/20260920_fuel_own_meals.sql'

const seeded = new Set()
for (const f of ['fixtures/fuel-seed.json', 'fixtures/fuel-seed-rotation-b.json']) {
  const j = JSON.parse(readFileSync(join(ROOT, f), 'utf8'))
  for (const m of [...(j.fuel_meals ?? []), ...(j.fuel_meals_new ?? [])]) seeded.add(m.slug)
}

// mulberry32: small, deterministic
function rng(s) {
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const R = rng(242)
const int = (n) => Math.floor(R() * n)
const pick = (xs) => xs[int(xs.length)]
const hex = (n) => Array.from({ length: n }, () => '0123456789abcdef'[int(16)]).join('')
const uuid = () => `${hex(8)}-${hex(4)}-4${hex(3)}-8${hex(3)}-${hex(12)}`
const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789 -~:&/'.split('')
// Hostile on purpose: every seeded slug, names already shaped like a namespace,
// names that slugify to nothing, unicode, and the empty string.
const HOSTILE = [...seeded, 'u' + 'f'.repeat(32) + '~thing', 'u~', '~', '', ' ', '---', ':::', 'tröt', '🥫', 'Cast-Iron Ribeye', 'jerk thighs', 'JERK-THIGHS']
const name = () => (R() < 0.4 ? pick(HOSTILE) : Array.from({ length: 1 + int(18) }, () => pick(CHARS)).join(''))

const CASES = 500
let minted = 0, skipped = 0
let collision = null, badNamespace = null, wrongOwner = null, seededReadsOwn = null, notOwn = null, lengthWrong = null

const owners = Array.from({ length: 12 }, uuid)
for (let c = 0; c < CASES; c++) {
  const owner = pick(owners)
  const other = pick(owners.filter((o) => o !== owner))
  const n = name()
  const slug = mintOwnSlug(owner, n)
  if (slug === null) {
    // Only ever for a name that slugifies to nothing — never for a real name.
    if (slugifyName(n) !== '') { badNamespace = { owner, n, why: 'refused a name that slugifies fine' } }
    skipped++
    continue
  }
  minted++
  if (!collision && seeded.has(slug)) collision = { owner, n, slug }
  if (!badNamespace && !slug.startsWith(ownNamespace(owner))) badNamespace = { owner, n, slug }
  if (!lengthWrong && slug.slice(0, OWN_PREFIX_LENGTH) !== ownNamespace(owner)) lengthWrong = { owner, slug }
  if (!wrongOwner && (ownedBy(slug, other) || !ownedBy(slug, owner))) wrongOwner = { owner, other, slug }
  if (!notOwn && !isOwnSlug(slug)) notOwn = { owner, n, slug }
}
for (const s of seeded) if (!seededReadsOwn && isOwnSlug(s)) seededReadsOwn = s

assert(minted > CASES / 2 && skipped > 0, `${minted} slugs minted over ${CASES} generated names, ${skipped} names refused for slugifying to nothing`)
assert(!collision, `no own slug equals a seeded slug, for any owner and any name — ${collision ? JSON.stringify(collision) : `none across ${seeded.size} seeded slugs`}`)
assert(!badNamespace, `every own slug sits in its owner's namespace — ${badNamespace ? JSON.stringify(badNamespace) : 'all'}`)
assert(!lengthWrong, `the namespace is exactly ${OWN_PREFIX_LENGTH} characters, the prefix the database CHECK compares — ${lengthWrong ? JSON.stringify(lengthWrong) : 'all'}`)
assert(!wrongOwner, `a slug is owned by exactly the athlete it was minted for, and by nobody else — ${wrongOwner ? JSON.stringify(wrongOwner) : 'all'}`)
assert(!notOwn, `every minted slug reads as an own slug — ${notOwn ? JSON.stringify(notOwn) : 'all'}`)
assert(!seededReadsOwn, `no seeded slug reads as an own slug — ${seededReadsOwn ? JSON.stringify(seededReadsOwn) : `none of ${seeded.size}`}`)

// ── The two places the namespace rule lives must agree ──────────────────────
// Comments are stripped FIRST. Every one of these describes itself in the
// migration's header, so matching the raw file would pass on the prose while
// the statement underneath said something else — a mutation that removed the
// Pro gate's WHEN clause left the comment behind and this went green.
const sql = readFileSync(join(ROOT, MIGRATION), 'utf8').replace(/--[^\n]*/g, '')
assert(sql.includes(`left(slug, ${OWN_PREFIX_LENGTH})`),
  `the database CHECK compares the same ${OWN_PREFIX_LENGTH} characters ownMeal.ts mints (${MIGRATION})`)
assert(/replace\(user_id::text, '-', ''\)/.test(sql) && /'u' \|\|/.test(sql),
  `the database CHECK builds the namespace the same way ownNamespace does: 'u' + the uuid's hex`)
assert(/CREATE TRIGGER[\s\S]*?WHEN \(NEW\.user_id IS NOT NULL\)[\s\S]*?enforce_fuel_pro/.test(sql),
  'the Pro gate skips library rows, so replaying the seed migrations cannot fail on a missing auth.uid()')
// `ON DELETE CASCADE` on the owner reference is not a policy — what must not
// exist is a DELETE policy, which is what would let a row leave the table.
assert(!/FOR\s+DELETE/i.test(sql),
  'the migration creates no DELETE policy — retiring is the only removal, so a stored plan keeps resolving its slug')
// A policy cannot see OLD, so the slug has to be frozen by a trigger. Without
// it an owner can rename one of their own slugs straight through PostgREST and
// orphan every plan that references it (Codex r1).
assert(/CREATE TRIGGER[\s\S]*?BEFORE UPDATE ON public\.fuel_meals[\s\S]*?fuel_meals_slug_is_immutable/.test(sql)
  && /NEW\.slug IS DISTINCT FROM OLD\.slug/.test(sql),
  'a slug is frozen by a BEFORE UPDATE trigger — renaming one is a migration, not an edit')

// ── A meal that cannot put anything on a list is refused, not accepted ──────
const ing = (over = {}) => ({ item: 'gochujang', qty_per_person: 1, unit: 'tbsp', store_section: 'Pantry', inferred: false, ...over })
const draft = (over = {}) => ({ name: 'Lisa\'s chicken thing', servings: 3, protein_g_per_person: 42, protein_cut: 'chicken_thigh', ingredients: [ing()], ...over })
assert(ownMealIssues(draft()).length === 0, 'a meal with a name, servings and one ingredient is accepted')
assert(ownMealIssues(draft({ ingredients: [] })).some((i) => /at least one ingredient/.test(i)),
  'a meal with no ingredients is refused — it would contribute nothing to any list')
assert(ownMealIssues(draft({ ingredients: [ing({ item: '   ' })] })).some((i) => /at least one ingredient/.test(i)),
  'ingredient rows that are only spaces do not count as ingredients')
assert(ownMealIssues(draft({ name: '   ' })).some((i) => /name/.test(i)), 'a meal with no name is refused')
assert(ownMealIssues(draft({ name: '---' })).some((i) => /letter or number/.test(i)), 'a name that slugifies to nothing is refused')
assert(ownMealIssues(draft({ servings: 0 })).some((i) => /servings/.test(i)), 'servings below one is refused')
// The two the solver actually gates on. Defaulting either made every own meal
// unbuildable, or invisible to the frequency rules (Codex r1, P1 and P2).
assert(ownMealIssues(draft({ protein_g_per_person: 0 })).some((i) => /protein per person/.test(i)),
  'a meal with no protein figure is refused — validatePlan warns on it, and a plan carrying a warning cannot be built')
assert(ownMealIssues(draft({ protein_cut: '' })).some((i) => /what the protein is/.test(i)),
  'a meal with no protein cut is refused — the fish, turkey and steak rules are counted on it')
assert(ownMealFields(draft({ protein_cut: 'salmon' })).protein_cut === 'salmon',
  'the cut the athlete chose is what gets written, not an ownership marker the rules would ignore')
for (const cut of RULE_CUTS) assert(cutOptions([]).includes(cut), `the form offers ${cut}, which carries a frequency rule, even for an empty library`)
assert(cutOptions([{ protein_cut: 'chicken_thigh' }]).includes('chicken_thigh'), 'the form also offers the cuts the library already cooks')
assert(cutOptions([]).at(-1) === OTHER_CUT && !RULE_CUTS.includes(OTHER_CUT),
  'the escape hatch is last and carries no rule — picking it cannot silently satisfy a fish or steak limit')
// RULE_CUTS repeats two cut names that validatePlan spells inline. Pinned to the
// source so the form cannot stop offering a cut that still carries a rule.
const solveSrc = readFileSync(join(ROOT, 'src/lib/fuel/solve.ts'), 'utf8')
for (const cut of RULE_CUTS) assert(solveSrc.includes(`'${cut}'`), `solve.ts still keys a rule on ${cut} — RULE_CUTS has not drifted from it`)
assert(ownMealIssues(draft({ ingredients: [ing({ qty_per_person: 0 })] })).some((i) => /quantity/.test(i)), 'a quantity of zero is refused')
assert(ownMealIssues(draft({ ingredients: [ing({ store_section: '' })] })).some((i) => /aisle/.test(i)), 'an ingredient with no aisle is refused')
assert(ownMealIssues(draft({ ingredients: [ing(), ing()] })).some((i) => /twice/.test(i)), 'the same item twice in one unit is refused')
assert(ownMealIssues(draft({ ingredients: [ing(), ing({ unit: 'tsp' })] })).length === 0, 'the same item in two different units is fine')

const fields = ownMealFields(draft({ name: '  Lisa\'s thing  ', ingredients: [ing({ item: '  gochujang ', unit: ' tbsp ', store_section: ' Pantry ' })] }))
assert(fields.name === "Lisa's thing", 'the name is trimmed before it is written')
assert(fields.ingredients[0].item === 'gochujang' && fields.ingredients[0].unit === 'tbsp' && fields.ingredients[0].store_section === 'Pantry',
  'every ingredient field is trimmed before it is written')
assert(isOwn({ user_id: 'x' }) && !isOwn({ user_id: null }) && !isOwn({}),
  'an own meal is known by its owner, not by its slug — a library row has none')

if (failures) { console.log(`\nfuel-own-meals: ${failures} of ${failures + passes} checks FAILED`); process.exit(1) }
console.log(`fuel-own-meals: ${passes} checks passed — ${minted} slugs over ${CASES} generated names, none collides with the ${seeded.size} seeded slugs`)
