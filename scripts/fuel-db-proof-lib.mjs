// ── Fuel database proof: what was proven (FOR-240) ──────────────────────────
// Shared by the proof runner (scripts/fuel-db-proof.mjs) and its standing lock
// check (scripts/checks/fuel-db-proof-lock.mjs): the exact SQL a proof run is
// about, fingerprinted. Line endings are normalised, so a checkout's CRLF does
// not read as a change.
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

export const ROOT = fileURLToPath(new URL('../', import.meta.url))
export const IMAGE = 'public.ecr.aws/supabase/postgres:17.6.1.156'
export const PROOF = 'scripts/checks/fuel-db-proof.sql'
export const LOCK = 'scripts/checks/fuel-db-proof.lock.json'
export const CUSTOM_MIGRATION = 'supabase/migrations/20260918_fuel_custom_items.sql'

export const readLF = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')
export const sha256 = (text) => createHash('sha256').update(text).digest('hex')

/** Every Fuel migration, in the order they apply. */
/**
 * Every migration this proof applies: one whose NAME says fuel, or whose TEXT
 * touches a fuel_ table.
 *
 * It selected on the filename alone, and a migration named anything else could
 * write fuel_meals without the proof ever applying it — so the row comparison
 * that proves the library is what the fixtures say had a hole exactly the
 * shape of a file called something else. Found by planting one: a stray
 * `UPDATE ONLY(public.fuel_meals)` in 20261007_zzqx_stray.sql passed the whole
 * proof (FOR-257 r4). Content, not naming.
 */
export const fuelMigrations = () =>
  readdirSync(join(ROOT, 'supabase/migrations'))
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => /fuel/i.test(f) || /fuel_[a-z_]+/i.test(readLF(`supabase/migrations/${f}`)))
    .sort()
    .map((f) => `supabase/migrations/${f}`)

/** How many cases the proof holds: one PASS notice each. */
export const proofCases = (proofText) => (proofText.match(/RAISE NOTICE 'PASS /g) || []).length

/** The exact SQL a proof run is about. No clock, no host: the same inputs give the same fingerprint. */
export function fingerprint() {
  const proof = readLF(PROOF)
  return {
    image: IMAGE,
    proof: { file: PROOF, sha256: sha256(proof), cases: proofCases(proof) },
    migrations: fuelMigrations().map((file) => ({ file, sha256: sha256(readLF(file)) })),
  }
}
