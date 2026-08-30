// ═══════════════════════════════════════════════════════════════════════════
// RUN SCOPE — "how far along am I" must mean THIS attempt at the program.
//
// user_programs holds one row per user, so switching programs overwrites it:
// current_week returns to 1 and started_at becomes now. That is already a
// restart. What was never scoped is the EVIDENCE — completion was derived from
// generated_workouts filtered on user + slug alone, and those rows outlive the
// switch. Come back to a program you had partly done and the app read the old
// sentinels and dropped you back where you left off, while current_week
// insisted you were on week 1.
//
// Measured on the reporting account when this was found:
//   current_week 1 · workouts_this_run 0 · workouts_all_time 81 · max_week 9
//
// So: any READ of generated_workouts that filters by program_slug must also
// carry .gte('created_at', <run start>). Writes are exempt. A couple of reads
// are exempt for stated reasons and are listed below, in code, not in a JSON
// file — there are two of them and the reason matters more than the path.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = new URL('../../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

const EXEMPT = [
  {
    file: 'app/history/page.tsx',
    why: 'the history screen is meant to show every session ever, across runs and programs',
  },
  {
    file: 'app/train/[program]/[day]/page.tsx',
    needs: '23505',
    why: 'the unique-violation retry. Those indexes are partial (legacy/zeus/ares only), so on '
       + 'those programs a second row cannot exist and reuse is the only option; scoping would '
       + 'return nothing and break log linkage',
  },
]

const walk = (d, out = []) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx|ts)$/.test(e)) out.push(p)
  }
  return out
}

const unscoped = []
let reads = 0
for (const p of walk(SRC)) {
  const rel = p.slice(p.indexOf('src') + 4).replace(/\\/g, '/')
  const lines = readFileSync(p, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes("from('generated_workouts')")) continue
    const window = lines.slice(Math.max(0, i - 14), i + 10).join('\n')
    if (/\.(insert|update|delete|upsert)\(/.test(window)) continue      // writes are exempt
    if (!/program_slug/.test(window)) continue                          // not a per-program read
    reads++
    if (/gte\('created_at'/.test(window)) continue
    const ex = EXEMPT.find((x) => x.file === rel && (!x.needs || window.includes(x.needs)))
    if (ex) continue
    unscoped.push(rel + ':' + (i + 1))
  }
}

console.log('')
console.log('  ── run scope ' + '─'.repeat(48))
console.log('    per-program reads of generated_workouts   ' + reads)
console.log('    documented exemptions                     ' + EXEMPT.length)
console.log('    unscoped                                  ' + unscoped.length)
console.log('')

if (unscoped.length) {
  console.log('  ✗ ' + unscoped.length + " read(s) count a previous attempt's sessions as this run's progress:")
  for (const u of unscoped) console.log('    - ' + u)
  console.log('')
  console.log("    Add .gte('created_at', <run start>) — runStartedAt() in")
  console.log('    src/lib/programs/run.ts, or started_at from a user_programs row.')
  process.exit(1)
}
console.log('  ✓ every per-program read is scoped to the current run')
