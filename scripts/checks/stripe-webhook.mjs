// ── Stripe webhook: no payment is lost, no stray subscription wins ───────────
// Runs the webhook's processEvent against an in-memory database with failures
// injected. Two ways a paying subscriber used to end up on the free tier:
//   1. a handler write failed and the claim could not be released (database
//      down): every Stripe retry was answered "duplicate" for good;
//   2. two checkouts at once made two subscriptions; ending the stray one
//      overwrote the live one.
// Its own file, so a revert of the webhook cannot take the check with it.
//
//   npx tsx scripts/checks/stripe-webhook.mjs   (run-all does this)

let checks = 0
const fails = []
const assert = (cond, msg) => { checks++; if (!cond) fails.push(msg) }

let processEvent = null
try {
  processEvent = (await import('../../src/lib/stripeWebhook.ts')).processEvent
} catch (e) {
  fails.push(`could not import src/lib/stripeWebhook.ts processEvent: ${e.message}`)
}

/** A tiny PostgREST-shaped fake: insert / select…maybeSingle / update / delete / upsert, filtered by eq. */
function fakeDb(tables, failing = () => null) {
  const keyOf = { stripe_webhook_events: 'event_id', user_profiles: 'id' }
  return {
    from(table) {
      const rows = (tables[table] ??= [])
      const q = { op: null, payload: null, filters: [] }
      const run = () => {
        const err = failing(table, q.op)
        if (err) return { data: null, error: err }
        const hit = rows.filter((r) => q.filters.every(([k, v]) => r[k] === v))
        if (q.op === 'insert') {
          const k = keyOf[table]
          if (rows.some((r) => r[k] === q.payload[k])) return { data: null, error: { code: '23505', message: 'duplicate key' } }
          rows.push({ ...q.payload }); return { data: null, error: null }
        }
        if (q.op === 'upsert') {
          const k = keyOf[table]; const row = rows.find((r) => r[k] === q.payload[k])
          if (row) Object.assign(row, q.payload); else rows.push({ ...q.payload })
          return { data: null, error: null }
        }
        if (q.op === 'update') { hit.forEach((r) => Object.assign(r, q.payload)); return { data: null, error: null } }
        if (q.op === 'delete') { hit.forEach((r) => rows.splice(rows.indexOf(r), 1)); return { data: null, error: null } }
        return { data: hit[0] ? { ...hit[0] } : null, error: null }
      }
      const b = {
        insert(p) { q.op = 'insert'; q.payload = p; return b },
        upsert(p) { q.op = 'upsert'; q.payload = p; return b },
        update(p) { q.op = 'update'; q.payload = p; return b },
        delete() { q.op = 'delete'; return b },
        select() { q.op ??= 'select'; return b },
        eq(k, v) { q.filters.push([k, v]); return b },
        maybeSingle() { return Promise.resolve(run()) },
        then(res, rej) { return Promise.resolve(run()).then(res, rej) },
      }
      return b
    },
  }
}

const quiet = () => { const o = { e: console.error, w: console.warn }; console.error = () => {}; console.warn = () => {}; return () => { console.error = o.e; console.warn = o.w } }
const subEvent = (id, type, sub) => ({ id, type, data: { object: { object: 'subscription', customer: 'cus_1', metadata: { supabase_user_id: 'u1' }, ...sub } } })
const profile = (over = {}) => ({ id: 'u1', stripe_customer_id: 'cus_1', founder_pass: false, subscription_tier: 'free', subscription_status: null, stripe_subscription_id: null, ...over })

if (processEvent) {
  const restore = quiet()
  try {
    // 1. Database down mid-event: the write fails AND the claim cannot be released.
    {
      const t = { user_profiles: [profile()] }
      let down = true
      const db = fakeDb(t, (table, op) => (down && table === 'user_profiles' && op === 'update') || (down && table === 'stripe_webhook_events' && op === 'delete') ? { message: 'db down' } : null)
      const ev = subEvent('evt_1', 'customer.subscription.created', { id: 'sub_A', status: 'active' })
      const first = await processEvent(db, ev)
      assert(first.status === 500, `a failed write answers 500 so Stripe retries (got ${first.status})`)
      assert(t.stripe_webhook_events.length === 1 && !t.stripe_webhook_events[0].processed_at, 'the unreleased claim is left unstamped')
      down = false
      const retry = await processEvent(db, ev)
      assert(retry.status === 200 && !retry.body.duplicate, `Stripe's retry is processed, not answered "duplicate" (got ${JSON.stringify(retry.body)})`)
      assert(t.user_profiles[0].subscription_tier === 'pro', 'and the subscriber ends up on Pro')
      assert(!!t.stripe_webhook_events[0].processed_at, 'and the claim is stamped processed')
      const again = await processEvent(db, ev)
      assert(again.body.duplicate === true, 'a redelivery after that is a duplicate')
    }

    // 2. The duplicate check itself cannot read the claim: retry later, never drop.
    {
      const t = { user_profiles: [profile()], stripe_webhook_events: [{ event_id: 'evt_2', event_type: 'x', processed_at: null }] }
      const db = fakeDb(t, (table, op) => table === 'stripe_webhook_events' && op === 'select' ? { message: 'db down' } : null)
      const r = await processEvent(db, subEvent('evt_2', 'customer.subscription.created', { id: 'sub_A', status: 'active' }))
      assert(r.status === 500, `an unreadable claim answers 500 (got ${r.status})`)
    }

    // 3. Two subscriptions for one user: the stray one cannot take Pro off the live one.
    {
      const live = () => ({ user_profiles: [profile({ subscription_tier: 'pro', subscription_status: 'active', stripe_subscription_id: 'sub_B' })] })
      let t = live()
      await processEvent(fakeDb(t), subEvent('evt_3', 'customer.subscription.deleted', { id: 'sub_A', status: 'canceled' }))
      assert(t.user_profiles[0].subscription_tier === 'pro' && t.user_profiles[0].stripe_subscription_id === 'sub_B', 'deleting a non-current subscription leaves the live one and Pro')
      t = live()
      await processEvent(fakeDb(t), subEvent('evt_4', 'customer.subscription.updated', { id: 'sub_A', status: 'incomplete_expired' }))
      assert(t.user_profiles[0].subscription_tier === 'pro' && t.user_profiles[0].stripe_subscription_id === 'sub_B', 'a stray subscription expiring leaves the live one and Pro')
      t = live()
      await processEvent(fakeDb(t), subEvent('evt_5', 'customer.subscription.deleted', { id: 'sub_B', status: 'canceled' }))
      assert(t.user_profiles[0].subscription_tier === 'free', 'deleting the CURRENT subscription still ends Pro')
      t = live()
      await processEvent(fakeDb(t), subEvent('evt_6', 'customer.subscription.updated', { id: 'sub_A', status: 'active' }))
      assert(t.user_profiles[0].stripe_subscription_id === 'sub_A', 'an active new subscription still takes over (a real switch lands)')
    }
  } finally { restore() }
}

console.log('  ── stripe webhook ' + '─'.repeat(43))
for (const f of fails) console.log('    ✗ ' + f)
console.log(`    checks                    ${checks}`)
if (fails.length) { console.log(`\n✗ ${fails.length} of ${checks} checks failed`); process.exit(1) }
console.log('\n✓ all stripe webhook checks pass')
