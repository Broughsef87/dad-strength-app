// ── Stripe webhook: no payment is lost, no stray subscription wins ───────────
// Runs the webhook's processEvent against an in-memory database with failures
// injected. Two ways a paying subscriber used to end up on the free tier:
//   1. a handler write failed and the claim could not be released (database
//      down): every Stripe retry was answered "duplicate" for good;
//   2. two checkouts at once made two subscriptions; ending the stray one
//      overwrote the live one;
// and a third: late, out-of-order or simultaneous deliveries could leave the
// account on a state Stripe had already moved past.
// Its own file, so a revert of the webhook cannot take the check with it.
//
//   npx tsx scripts/checks/stripe-webhook.mjs   (run-all does this)

let checks = 0
const fails = []
const assert = (cond, msg) => { checks++; if (!cond) fails.push(msg) }

let processEvent = null
let hasPro = null
try {
  processEvent = (await import('../../src/lib/stripeWebhook.ts')).processEvent
  hasPro = (await import('../../src/lib/proStatus.ts')).hasPro
} catch (e) {
  fails.push(`could not import src/lib/stripeWebhook.ts processEvent: ${e.message}`)
}

/** A tiny PostgREST-shaped fake: insert / upsert / update / delete / select, filtered by eq / is / lt. */
function fakeDb(tables, failing = () => null) {
  const keyOf = { stripe_webhook_events: 'event_id', user_profiles: 'id' }
  return {
    from(table) {
      const rows = (tables[table] ??= [])
      const q = { op: null, payload: null, filters: [], returning: false }
      const run = () => {
        const err = failing(table, q.op)
        if (err) return { data: null, error: err }
        const hit = rows.filter((r) => q.filters.every((f) => f(r)))
        if (q.op === 'insert') {
          const k = keyOf[table]
          if (rows.some((r) => r[k] === q.payload[k])) return { data: null, error: { code: '23505', message: 'duplicate key' } }
          rows.push({ processed_at: null, ...q.payload }); return { data: null, error: null }
        }
        if (q.op === 'upsert') {
          const k = keyOf[table]; const row = rows.find((r) => r[k] === q.payload[k])
          if (row) Object.assign(row, q.payload); else rows.push({ ...q.payload })
          return { data: null, error: null }
        }
        if (q.op === 'update') { hit.forEach((r) => Object.assign(r, q.payload)); return { data: q.returning ? hit.map((r) => ({ ...r })) : null, error: null } }
        if (q.op === 'delete') { hit.forEach((r) => rows.splice(rows.indexOf(r), 1)); return { data: null, error: null } }
        return { data: hit[0] ? { ...hit[0] } : null, error: null }
      }
      const b = {
        insert(p) { q.op = 'insert'; q.payload = p; return b },
        upsert(p) { q.op = 'upsert'; q.payload = p; return b },
        update(p) { q.op = 'update'; q.payload = p; return b },
        delete() { q.op = 'delete'; return b },
        select() { if (q.op) q.returning = true; else q.op = 'select'; return b },
        eq(k, v) { q.filters.push((r) => r[k] === v); return b },
        is(k, v) { q.filters.push((r) => (r[k] ?? null) === v); return b },
        lt(k, v) { q.filters.push((r) => r[k] < v); return b },
        // Only the shape the webhook uses: "col.is.null,col.lt.<value>".
        or(expr) {
          const [, col, val] = expr.match(/^(\w+)\.is\.null,\1\.lt\.(.+)$/) ?? []
          if (!col) throw new Error('fake or(): unsupported ' + expr)
          q.filters.push((r) => r[col] == null || r[col] < val); return b
        },
        maybeSingle() { return Promise.resolve(run()) },
        then(res, rej) { return Promise.resolve(run()).then(res, rej) },
      }
      return b
    },
  }
}

/** Stripe as it stands now: each customer's subscriptions. */
const fakeStripe = (byCustomer) => ({ subscriptions: { list: async ({ customer }) => ({ data: byCustomer[customer] ?? [] }) } })
const sub = (id, status, created = 1) => ({ id, status, created })

const quiet = () => { const o = { e: console.error, w: console.warn }; console.error = () => {}; console.warn = () => {}; return () => { console.error = o.e; console.warn = o.w } }
const subEvent = (id, type, object) => ({ id, type, data: { object: { object: 'subscription', customer: 'cus_1', metadata: { supabase_user_id: 'u1' }, ...object } } })
const profile = (over = {}) => ({ id: 'u1', stripe_customer_id: 'cus_1', founder_pass: false, subscription_tier: 'free', subscription_status: null, stripe_subscription_id: null, ...over })
const longAgo = new Date(Date.now() - 5 * 60_000).toISOString()

if (processEvent) {
  const restore = quiet()
  try {
    // 1. Database down mid-event: the write fails AND the claim cannot be handed back.
    {
      const t = { user_profiles: [profile()] }
      const stripe = fakeStripe({ cus_1: [sub('sub_A', 'active')] })
      let down = true
      const db = fakeDb(t, (table, op) => down && op === 'update' ? { message: 'db down' } : null)
      const ev = subEvent('evt_1', 'customer.subscription.created', { id: 'sub_A', status: 'active' })
      const first = await processEvent(db, stripe, ev)
      assert(first.status === 500, `a failed write answers 500 so Stripe retries (got ${first.status})`)
      assert(t.stripe_webhook_events.length === 1 && !t.stripe_webhook_events[0].processed_at, 'the claim is left unstamped')
      down = false
      t.stripe_webhook_events[0].created_at = longAgo // Stripe's retry comes minutes later
      const retry = await processEvent(db, stripe, ev)
      assert(retry.status === 200 && !retry.body.duplicate, `Stripe's retry is processed, not answered "duplicate" (got ${JSON.stringify(retry.body)})`)
      assert(t.user_profiles[0].subscription_tier === 'pro', 'and the subscriber ends up on Pro')
      assert(!!t.stripe_webhook_events[0].processed_at, 'and the claim is stamped processed')
      const again = await processEvent(db, stripe, ev)
      assert(again.body.duplicate === true, 'a redelivery after that is a duplicate')
    }

    // 2. A failed delivery hands its claim back, so the retry need not wait for the lease.
    {
      const t = { user_profiles: [profile()] }
      let down = true
      const db = fakeDb(t, (table, op) => down && table === 'user_profiles' && op === 'update' ? { message: 'db down' } : null)
      const ev = subEvent('evt_2', 'customer.subscription.created', { id: 'sub_A', status: 'active' })
      await processEvent(db, fakeStripe({ cus_1: [sub('sub_A', 'active')] }), ev)
      down = false
      const retry = await processEvent(db, fakeStripe({ cus_1: [sub('sub_A', 'active')] }), ev)
      assert(retry.status === 200 && t.user_profiles[0].subscription_tier === 'pro', `a handed-back claim is retried at once (got ${retry.status})`)
    }

    // 3. Two copies at once: while one holds a fresh claim, the other does not run.
    {
      const t = { user_profiles: [profile()], stripe_webhook_events: [{ event_id: 'evt_3', event_type: 'x', created_at: new Date().toISOString(), processed_at: null }] }
      const r = await processEvent(fakeDb(t), fakeStripe({ cus_1: [sub('sub_A', 'active')] }), subEvent('evt_3', 'customer.subscription.created', { id: 'sub_A', status: 'active' }))
      assert(r.status === 500 && t.user_profiles[0].subscription_tier === 'free', `a copy that finds a live claim answers 500 and writes nothing (got ${r.status})`)
    }

    // 4. The duplicate check itself cannot read the claim: retry later, never drop.
    {
      const t = { user_profiles: [profile()], stripe_webhook_events: [{ event_id: 'evt_4', event_type: 'x', created_at: longAgo, processed_at: null }] }
      const db = fakeDb(t, (table, op) => table === 'stripe_webhook_events' && op === 'select' ? { message: 'db down' } : null)
      const r = await processEvent(db, fakeStripe({}), subEvent('evt_4', 'customer.subscription.created', { id: 'sub_A', status: 'active' }))
      assert(r.status === 500, `an unreadable claim answers 500 (got ${r.status})`)
    }

    // 5. Late or out-of-order events: the account follows Stripe NOW, not the payload.
    {
      const t = { user_profiles: [profile()] }
      await processEvent(fakeDb(t), fakeStripe({ cus_1: [sub('sub_A', 'canceled')] }), subEvent('evt_5', 'customer.subscription.updated', { id: 'sub_A', status: 'active' }))
      assert(t.user_profiles[0].subscription_tier === 'free' && t.user_profiles[0].subscription_status === 'canceled', 'a stale "active" for a since-cancelled subscription does not bring Pro back')
    }

    // 6. Two subscriptions on one customer: the active one defines the account.
    {
      const t = { user_profiles: [profile({ subscription_tier: 'pro', subscription_status: 'active', stripe_subscription_id: 'sub_B' })] }
      const stripe = fakeStripe({ cus_1: [sub('sub_A', 'canceled', 1), sub('sub_B', 'active', 2)] })
      await processEvent(fakeDb(t), stripe, subEvent('evt_6', 'customer.subscription.deleted', { id: 'sub_A', status: 'canceled' }))
      assert(t.user_profiles[0].subscription_tier === 'pro' && t.user_profiles[0].stripe_subscription_id === 'sub_B', 'ending one subscription leaves the live one and Pro')
      const t2 = { user_profiles: [profile({ subscription_tier: 'pro', subscription_status: 'active', stripe_subscription_id: 'sub_B' })] }
      await processEvent(fakeDb(t2), fakeStripe({ cus_1: [sub('sub_B', 'canceled', 2)] }), subEvent('evt_7', 'customer.subscription.deleted', { id: 'sub_B', status: 'canceled' }))
      assert(t2.user_profiles[0].subscription_tier === 'free', 'ending the only subscription still ends Pro')
    }

    // 7. A stray second customer cannot overwrite the linked one.
    {
      const t = { user_profiles: [profile({ subscription_tier: 'pro', subscription_status: 'active', stripe_subscription_id: 'sub_B' })] }
      const stripe = fakeStripe({ cus_X: [sub('sub_A', 'canceled')] })
      await processEvent(fakeDb(t), stripe, { id: 'evt_8', type: 'customer.subscription.deleted', data: { object: { customer: 'cus_X', metadata: { supabase_user_id: 'u1' }, id: 'sub_A', status: 'canceled' } } })
      assert(t.user_profiles[0].subscription_tier === 'pro' && t.user_profiles[0].stripe_customer_id === 'cus_1' && t.user_profiles[0].stripe_subscription_id === 'sub_B', 'events on a customer not linked to the user change nothing')
    }

    // 8. A founder keeps Pro when a subscription ends.
    {
      const t = { user_profiles: [profile({ founder_pass: true, subscription_tier: 'pro' })] }
      await processEvent(fakeDb(t), fakeStripe({ cus_1: [] }), subEvent('evt_9', 'customer.subscription.deleted', { id: 'sub_A', status: 'canceled' }))
      assert(t.user_profiles[0].subscription_tier === 'pro', 'a Founder\'s Pass keeps Pro')
    }

    // 9. A slow delivery that read Stripe BEFORE a later one wrote cannot undo it.
    {
      const t = { user_profiles: [profile({ subscription_updated_at: new Date(Date.now() + 60_000).toISOString(), subscription_status: 'canceled' })] }
      await processEvent(fakeDb(t), fakeStripe({ cus_1: [sub('sub_A', 'active')] }), subEvent('evt_10', 'customer.subscription.updated', { id: 'sub_A', status: 'active' }))
      assert(t.user_profiles[0].subscription_tier === 'free' && t.user_profiles[0].subscription_status === 'canceled', 'an older read of Stripe does not overwrite a newer one')
    }

    // 10. A delivery that overran its lease cannot stamp the retry's work as done.
    {
      const t = { user_profiles: [profile()] }
      const db = fakeDb(t)
      const stripe = { subscriptions: { list: async () => {
        // While this delivery runs, its lease expires and a retry takes it over.
        t.stripe_webhook_events[0].created_at = 'taken-by-retry'
        return { data: [sub('sub_A', 'active')] }
      } } }
      await processEvent(db, stripe, subEvent('evt_11', 'customer.subscription.created', { id: 'sub_A', status: 'active' }))
      assert(!t.stripe_webhook_events[0].processed_at, 'a lease that was taken over is not stamped by its old holder')
    }

    // 11. A failed renewal keeps Pro for 7 days from the FIRST unpaid invoice,
    //     stored as grace_until so it ends even if Stripe goes quiet.
    {
      const DAY = 86_400_000
      const inv = (daysAgo) => ({ created: Math.floor((Date.now() - daysAgo * DAY) / 1000) })
      const pastDue = (daysAgo) => ({ ...sub('sub_A', 'past_due'), latest_invoice: inv(daysAgo) })
      const run = async (subs, evt, before = {}) => {
        const t = { user_profiles: [profile({ subscription_tier: 'pro', subscription_status: 'active', stripe_subscription_id: 'sub_A', ...before })] }
        let asked
        const stripe = { subscriptions: { list: async (params) => { asked = params; return { data: subs } } } }
        await processEvent(fakeDb(t), stripe, { id: evt, type: 'invoice.payment_failed', data: { object: { customer: 'cus_1' } } })
        return { row: t.user_profiles[0], asked }
      }
      const fresh = await run([pastDue(2)], 'evt_12')
      const end = Date.parse(fresh.row.grace_until)
      assert(fresh.row.subscription_tier === 'pro' && Math.abs(end - (Date.now() + 5 * DAY)) < 60_000, 'two days past due keeps Pro, grace ending in five days')
      assert(fresh.asked?.expand?.includes('data.latest_invoice'), 'the sync asks Stripe for the unpaid invoice date')
      assert(hasPro(fresh.row) && !hasPro(fresh.row, end + 1), 'the stored grace ends on its own: no Pro after grace_until, with no event')
      const late = await run([pastDue(8)], 'evt_13')
      assert(late.row.subscription_tier === 'free' && !hasPro(late.row), 'eight days past due drops to free')
      const undated = await run([{ ...sub('sub_A', 'past_due'), latest_invoice: 'in_1' }], 'evt_14')
      assert(undated.row.subscription_tier === 'free' && undated.row.grace_until === null, 'past due with no invoice date gets no grace')
      const firstEnd = new Date(Date.now() + 1 * DAY).toISOString()
      const renewed = await run([pastDue(0)], 'evt_15', { subscription_status: 'past_due', grace_until: firstEnd })
      assert(renewed.row.grace_until === firstEnd, 'a newer unpaid invoice cannot push the grace end out')
      const paidBack = await run([sub('sub_A', 'active')], 'evt_16', { subscription_status: 'past_due', grace_until: firstEnd })
      assert(paidBack.row.subscription_tier === 'pro' && paidBack.row.grace_until === null, 'paying clears the grace')
      const trial = await run([sub('sub_T', 'trialing', 3), pastDue(20)], 'evt_17')
      assert(trial.row.subscription_tier === 'pro' && hasPro(trial.row), 'a trial alongside an old past-due subscription keeps Pro')
    }
  } finally { restore() }
}

console.log('  ── stripe webhook ' + '─'.repeat(43))
for (const f of fails) console.log('    ✗ ' + f)
console.log(`    checks                    ${checks}`)
if (fails.length) { console.log(`\n✗ ${fails.length} of ${checks} checks failed`); process.exit(1) }
console.log('\n✓ all stripe webhook checks pass')
