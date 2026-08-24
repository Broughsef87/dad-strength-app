// Double progression — the rules that make a hypertrophy program advance.
import { doubleProgression, loadTargets } from '../../src/lib/programs/progression.ts'

let fails = 0, checks = 0
const ok = (label, cond, got) => {
  checks++
  if (!cond) { fails++; console.log(`FAIL  ${label}  → got ${JSON.stringify(got)}`) }
  else console.log(`PASS  ${label}`)
}
const RANGES = { acc_row: [8, 12], acc_curl: [10, 15], acc_legpress: [10, 15] }
const OPTS = { ranges: RANGES, steps: { acc_legpress: 10 }, defaultStep: 5 }
const row = (slot, w, reps, week = 5, day = 2) =>
  ({ slot, block_name: slot, weight_lbs: w, reps, completed: true, week_number: week, day_number: day, log_type: 'strength_set' })

// 1. Cleared the top of the range on every set → add load
{
  const p = doubleProgression([row('acc_row', 100, 12), row('acc_row', 100, 12), row('acc_row', 100, 12)], OPTS)
  ok('all sets at top of range → add load', p.acc_row.action === 'add-load' && p.acc_row.suggested === 105, p.acc_row)
}
// 2. One set short of the top → hold, chase reps
{
  const p = doubleProgression([row('acc_row', 100, 12), row('acc_row', 100, 10), row('acc_row', 100, 12)], OPTS)
  ok('one set short → hold the load', p.acc_row.action === 'hold' && p.acc_row.suggested === 100, p.acc_row)
}
// 3. Fell under the floor → back off
{
  const p = doubleProgression([row('acc_row', 100, 12), row('acc_row', 100, 6)], OPTS)
  ok('a set under the floor → back off', p.acc_row.action === 'back-off' && p.acc_row.suggested === 95, p.acc_row)
}
// 4. Per-slot step size beats the default
{
  const p = doubleProgression([row('acc_legpress', 200, 15), row('acc_legpress', 200, 15)], OPTS)
  ok('per-slot step used (10 not 5)', p.acc_legpress.suggested === 210, p.acc_legpress)
}
// 5. No history → no invented number
{
  const p = doubleProgression([], OPTS)
  ok('no history → suggests nothing', p.acc_row.suggested === null && p.acc_row.action === 'no-history', p.acc_row)
}
// 6. ONLY the most recent session decides. A great week 5 must not keep
//    pushing load after a bad week 7.
{
  const p = doubleProgression([
    row('acc_row', 100, 12, 5), row('acc_row', 100, 12, 5),   // great
    row('acc_row', 105, 7, 7), row('acc_row', 105, 7, 7),     // bad, later
  ], OPTS)
  ok('latest session governs, not the best one', p.acc_row.action === 'back-off' && p.acc_row.lastWeek === 7, p.acc_row)
}
// 7. Warm-ups must not decide the prescription
{
  const p = doubleProgression([row('acc_row', 45, 15), row('acc_row', 100, 12), row('acc_row', 100, 12)], OPTS)
  ok('warm-up set ignored, top load governs', p.acc_row.action === 'add-load' && p.acc_row.lastLoad === 100, p.acc_row)
}
// 8. Uncompleted and junk rows rejected
{
  const p = doubleProgression([
    { ...row('acc_row', 999, 12), completed: false },
    { ...row('acc_row', 100, 12) }, { ...row('acc_row', 100, 12) },
    { ...row('acc_row', 1e9, 12) }, { ...row('acc_row', 100, null) },
  ], OPTS)
  ok('uncompleted + absurd + null-rep rows rejected', p.acc_row.lastLoad === 100, p.acc_row)
}
// 9. Bodyweight accessory (load 0) is legitimate, not junk
{
  const p = doubleProgression([row('acc_curl', 0, 15), row('acc_curl', 0, 15)], OPTS)
  ok('bodyweight (0 lb) still progresses', p.acc_curl.action === 'add-load' && p.acc_curl.suggested === 5, p.acc_curl)
}
// 10. Never suggest a negative load
{
  const p = doubleProgression([row('acc_curl', 0, 4), row('acc_curl', 0, 4)], OPTS)
  ok('back-off floors at 0, never negative', p.acc_curl.suggested === 0, p.acc_curl)
}
// 11. Slot with no configured range is not progressed at all
{
  const p = doubleProgression([row('sn_top', 200, 2)], OPTS)
  ok('unranged slot absent from output', p.sn_top === undefined, Object.keys(p))
}
// 12. loadTargets drops the nulls
{
  const p = doubleProgression([row('acc_row', 100, 12), row('acc_row', 100, 12)], OPTS)
  const t = loadTargets(p)
  ok('loadTargets omits no-history slots', t.acc_row === 105 && !('acc_curl' in t), t)
}
// 13. Purity — input untouched, repeatable
{
  const rows = Object.freeze([row('acc_row', 100, 12), row('acc_row', 100, 12)])
  const a = JSON.stringify(doubleProgression(rows, OPTS))
  const b = JSON.stringify(doubleProgression(rows, OPTS))
  ok('pure: same input, same output, no mutation', a === b, null)
}

console.log('\n' + '='.repeat(58))
console.log(fails ? `✗ ${fails} FAILED of ${checks}` : `✓ ALL GREEN — ${checks} checks`)
process.exit(fails ? 1 : 0)
