// ── Exercise library (FOR-350) ───────────────────────────────────────────────
// Andrew, 2026-11-15: "make sure you're still adding the entire library of
// exercises." Every name each source lists (scripts/checks/exercise-sources/)
// must resolve to exactly one library entry, by its name or an aka. No two
// entries may read the same once normalized, the impact drills stay flagged,
// and search finds a movement by any word order a source uses.
//
// Its own file, so a revert of the import cannot take the check with it.
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { EXERCISE_LIBRARY, CATEGORY_LABELS, normalizeExerciseName, searchLibrary } from '../../src/lib/programs/exerciseLibrary.ts'

let checks = 0
const fails = []
const assert = (cond, msg) => { checks++; if (!cond) fails.push(msg) }

// 1. One entry per movement: no name or aka collides with another entry's.
const owner = new Map()
for (const e of EXERCISE_LIBRARY) {
  assert(e.cat in CATEGORY_LABELS, `${e.name}: unknown category ${e.cat}`)
  assert(Array.isArray(e.equip) && e.equip.length > 0, `${e.name}: no equipment`)
  // Owned by the ENTRY, not its name: two entries both named "Clean & Jerk"
  // must collide too (Codex r1, PR #90).
  for (const n of new Set([e.name, ...(e.aka ?? [])].map(normalizeExerciseName))) {
    const prev = owner.get(n)
    assert(!prev || prev === e, `"${n}" (${e.name}) reads the same as ${prev?.name}`)
    owner.set(n, e)
  }
}

// 2. Every source name resolves to an entry.
const here = dirname(fileURLToPath(import.meta.url))
const dir = join(here, 'exercise-sources')
let sourceNames = 0
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json') && x !== 'exrx-map.json')) {
  const { sources } = JSON.parse(readFileSync(join(dir, f), 'utf8'))
  for (const [src, names] of Object.entries(sources)) {
    for (const n of names) {
      sourceNames++
      assert(owner.has(normalizeExerciseName(n)), `${f} ${src}: "${n}" is not in the library`)
    }
  }
}
assert(sourceNames > 300, `read ${sourceNames} source names; the source files look empty`)

// 2b. ExRx: every page in the raw index maps to a library entry by name. The
//     index is read here, so a row added to it without a mapping fails.
{
  const tsv = readFileSync(join(here, '../../research/exercise-library/exrx-raw-2026-11-15.tsv'), 'utf8')
  const paths = tsv.trim().split('\n').slice(1).map((l) => l.split('\t')[4])
  const { pages } = JSON.parse(readFileSync(join(dir, 'exrx-map.json'), 'utf8'))
  const names = new Set(EXERCISE_LIBRARY.map((e) => e.name))
  assert(paths.length === 719, `ExRx index: ${paths.length} pages, expected 719`)
  for (const p of paths) {
    sourceNames++
    assert(pages[p] != null, `ExRx ${p}: no library entry mapped`)
    assert(pages[p] == null || names.has(pages[p]), `ExRx ${p}: maps to "${pages[p]}", which is not in the library`)
  }
  for (const [k, n] of [['Back Squat', 'barbell squat'], ['Lat Pulldown', 'cable pulldown'], ['Triceps Pressdown', 'cable pushdown']]) {
    assert(searchLibrary(n, null, 1000).items.some((e) => e.name === k), `search: ExRx name "${n}" finds ${k}`)
  }
  const knee = EXERCISE_LIBRARY.filter((e) => e.kneeLoad).map((e) => e.name)
  for (const n of ['DB Lunge', 'Single Leg Box Squat (pistol)', 'Machine Split Squat']) assert(knee.includes(n), `${n}: kneeLoad`)
  for (const n of ['Machine Seated Leg Curl', 'Cable Lateral Raise (one arm)']) assert(!knee.includes(n), `${n}: not kneeLoad`)
}

// 3. The drills that land or jump carry the flag; nothing Platform Dad
//    prescribes does.
for (const n of ['Jump To Split', 'Drop To Split', 'Rebound Jerk', 'Jumping Snatch Pull', 'Power Snatch Complex']) {
  assert(EXERCISE_LIBRARY.find((e) => e.name === n)?.impact === true, `${n}: impact flag`)
}
for (const n of ['Snatch', 'Clean & Jerk', 'Snatch With No Jump', 'Pause Split Jerk', 'Jerk with Paused Dip']) {
  assert(!EXERCISE_LIBRARY.find((e) => e.name === n)?.impact, `${n}: not an impact drill`)
}

// 4. Search: every word, any order, plural or not, names or aka.
const finds = (q, name, cat = null) => searchLibrary(q, cat, 1000).items.some((e) => e.name === name)
assert(finds('snatch pulls knee', 'Snatch Pull from Knee'), 'search: "snatch pulls knee"')
assert(finds('knee snatch pull', 'Snatch Pull from Knee'), 'search: word order')
assert(finds('sots', 'Sots Press'), 'search: "sots"')
assert(finds('press in snatch', 'Sots Press'), 'search: the Catalyst name finds Sots Press by its aka')
assert(finds('rdl', 'Romanian Deadlift'), 'search: "rdl"')
assert(finds('clean and jerk', 'Clean & Jerk'), 'search: "clean and jerk"')
assert(!finds('snatch', 'Clean & Jerk'), 'search: "snatch" does not find Clean & Jerk')
assert(!finds('jerk', 'Snatch', 'clean_jerk'), 'search: the category filter holds')
{
  const { items, total } = searchLibrary('', 'oly_pull', 40)
  assert(items.length === 40 && total > 40, `search: a big category is capped at 40 and says how many more (got ${items.length} of ${total})`)
}

// 5. Codex r2, PR #90: every ExRx alias lands on an entry, imports included,
//    and an exact name is never buried under the cap.
{
  const { EXRX_AKAS } = await import('../../src/lib/programs/exerciseImports/exrx.ts')
  for (const [n, akas] of Object.entries(EXRX_AKAS)) {
    const e = EXERCISE_LIBRARY.find((x) => x.name === n)
    assert(!!e, `EXRX_AKAS: "${n}" is not an entry`)
    for (const a of akas) assert(e?.aka?.includes(a), `EXRX_AKAS: "${a}" not attached to ${n}`)
  }
  assert(finds('db split squat', 'Split Squat'), 'search: "db split squat" finds Split Squat')
  for (const [q, cat] of [['squat', null], ['squat', 'squat'], ['deadlift', null], ['snatch', null]]) {
    const top = searchLibrary(q, cat, 40).items[0]?.name
    assert(normalizeExerciseName(top ?? '') === q, `search: "${q}" puts the exact match first (got ${top})`)
  }
}

if (fails.length) {
  console.error(fails.map((f) => '  ✗ ' + f).join('\n'))
  console.error(`exercise-library: ${fails.length} of ${checks} FAILED`)
  process.exit(1)
}
console.log(`exercise-library: ${checks} checks passed — ${EXERCISE_LIBRARY.length} exercises, all ${sourceNames} source names resolve, no duplicates`)
