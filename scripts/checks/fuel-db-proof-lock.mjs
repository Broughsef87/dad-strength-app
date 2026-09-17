// ── Fuel database proof lock (FOR-240, FOR-242, FOR-243) — a standing check, its own file ─
// The database proof (npm run proof:db) runs every Fuel migration and
// scripts/checks/fuel-db-proof.sql against a throwaway Postgres. Only when
// every case passes does it record the fingerprint of exactly the SQL it
// proved. This check fails the moment a Fuel migration or the proof changes
// without the proof being run again. A SQL change the text pins cannot see
// (two such mutations passed every other standing check) therefore cannot
// ship unproven.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CUSTOM_MIGRATION, IMAGE, LOCK, PROOF, ROOT, fingerprint } from '../fuel-db-proof-lib.mjs'

let failures = 0, passes = 0
const assert = (cond, msg) => { if (cond) passes++; else { failures++; console.log('  ✗ ' + msg) } }

const locked = existsSync(join(ROOT, LOCK))
assert(locked, `the database proof has been run and recorded: ${LOCK} (npm run proof:db)`)
const lock = locked ? JSON.parse(readFileSync(join(ROOT, LOCK), 'utf8')) : { migrations: [], proof: {} }
const now = fingerprint()

assert(lock.image === IMAGE, `the proof ran on the pinned image, ${IMAGE}`)
assert(lock.proof.file === PROOF && lock.proof.sha256 === now.proof.sha256 && lock.proof.cases === now.proof.cases,
  `the proof on disk is the proof that ran, all ${now.proof.cases} cases (changed since: run npm run proof:db)`)
const provenSha = new Map((lock.migrations || []).map((m) => [m.file, m.sha256]))
assert(now.migrations.length === provenSha.size && now.migrations.every((m) => provenSha.has(m.file)),
  `the proof ran against every Fuel migration there is: ${now.migrations.map((m) => m.file.replace('supabase/migrations/', '')).join(', ')}`)
for (const m of now.migrations) {
  assert(provenSha.get(m.file) === m.sha256, `the database proof ran against this exact ${m.file} (changed since: run npm run proof:db)`)
}
assert(now.migrations.some((m) => m.file === CUSTOM_MIGRATION), 'the custom-items migration is among the migrations proven')
assert(/fuel_lists_staples/.test(lock.fuel_lists_triggers || ''), 'the proven database carries the fuel_lists staple trigger')

// What FOR-240 and FOR-243 rest on is named in the proof, so a case cannot
// quietly go missing. Without this, deleting a case and re-running the proof
// would write a fresh lock and go green with the behaviour no longer covered.
const proof = readFileSync(join(ROOT, PROOF), 'utf8')
const MUST = [
  ['a staple stopped inside the gap', 'a staple stopped in the gap is not on a new version'],
  ['fuel_create_version directly', 'an old writer calling fuel_create_version directly still gets the staples'],
  ['a raw list row', 'a raw list insert is rebuilt too'],
  ['built from its staple row', "a rebuilt line's content (name, aisle, unticked) comes from the staple row"],
  ['named like a solver line is its own line on a rebuilt version', 'a staple named like a solver line keeps its own line'],
  ['superseded list refuses', 'a superseded list refuses custom writes'],
  ['cannot call any of', 'anon cannot call the functions'],
  // FOR-243: a tick survives a rebuild wherever the line's identity survives.
  ['keeps the ticks of every line whose key is unchanged', 'a rebuild keeps the ticks of lines whose key survives (FOR-243)'],
  ['a quantity change keeps the key', 'a quantity change is not an identity change, so the tick stays (FOR-243)'],
  ['inherits nothing from the line it replaced', 'a line whose key changed inherits no tick — the dangerous direction (FOR-243)'],
  ['the database decides a tick', 'the client cannot dictate a tick, and an untick survives (FOR-243)'],
  ['an old version keeps the ticks it had', 'old versions keep their own ticks (FOR-243, AC5)'],
  // FOR-242: an own meal is owned, and the library is nobody's to write.
  ['the slug namespace is a database constraint', "an own slug cannot be un-namespaced, another athlete's, or a seeded one (FOR-242)"],
  ['nobody writes the library', 'no owner-less insert, and a seeded row cannot be edited or taken over (FOR-242)'],
  ['another athlete cannot read, edit, retire, delete or plant an own meal', 'AC4 proved at the database, not asserted from the UI (FOR-242)'],
  ['cannot delete it — the row stays', 'retiring is the only removal, so a stored plan keeps resolving its slug (FOR-242)'],
  ['a slug never moves once a row exists', 'a rename is a migration, not an edit — it would orphan a plan already shopped (FOR-242)'],
  ['and their own meal at the database', 'own meals are behind the Pro gate, like every other Fuel write (FOR-242)'],
]
for (const [text, what] of MUST) assert(proof.includes(text), `the proof covers it: ${what}`)
assert(now.proof.cases >= 28, `the proof keeps all its cases (${now.proof.cases})`)
assert(/"proof:db": "node scripts\/fuel-db-proof\.mjs"/.test(readFileSync(join(ROOT, 'package.json'), 'utf8')), 'npm run proof:db runs the proof')

if (failures) { console.log(`\nfuel-db-proof-lock: ${failures} of ${failures + passes} checks FAILED`); process.exit(1) }
console.log(`fuel-db-proof-lock: ${passes} checks passed — the database proof ran against exactly this SQL, ${now.proof.cases} cases`)
