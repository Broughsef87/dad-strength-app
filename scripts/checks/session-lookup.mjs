// Two loads of one session at once must share one find-or-create, or each
// inserts its own generated_workouts row (Andrew's week 6/7 Mondays, 2026-10).
import { findOrCreateSession } from '../../src/lib/sessionLookup.ts'

let fails = 0
const check = (label, ok, got) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${JSON.stringify(got)}`)
  if (!ok) fails++
}

let inserts = 0
const run = async () => { await new Promise(r => setTimeout(r, 20)); inserts++; return { id: `row-${inserts}` } }

const [a, b] = await Promise.all([findOrCreateSession('k', run), findOrCreateSession('k', run)])
check('concurrent loads insert once', inserts === 1, { inserts })
check('both get the same row', a.value.id === b.value.id, [a.value.id, b.value.id])
check('only the waiter is told the row was shared, so it adopts', !a.shared && b.shared, [a.shared, b.shared])

const { value: c } = await findOrCreateSession('k', run)
check('a later load looks again', inserts === 2 && c.id === 'row-2', { inserts, id: c.id })

await Promise.all([findOrCreateSession('x', run), findOrCreateSession('y', run)])
check('different sessions do not share', inserts === 4, { inserts })

const boom = () => Promise.reject(new Error('net'))
await findOrCreateSession('e', boom).catch(() => {})
const { value: d } = await findOrCreateSession('e', run)
check('a failed lookup does not stick', !!d.id, d)

if (fails) { console.error(`\n${fails} failing`); process.exit(1) }
