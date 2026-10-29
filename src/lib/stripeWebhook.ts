import type Stripe from 'stripe'
import type { createAdminClient } from '../utils/supabase/admin'

// The Stripe webhook's work once the signature is verified. Lives outside the
// route file because a route may only export its handlers.
//
// Subscription events are treated as a NUDGE, not as data: Stripe delivers
// them late, out of order and sometimes twice at once, so the handler re-reads
// the customer's subscriptions from Stripe and writes what is true now. Any
// interleaving of deliveries then ends on the same, current state.

type Reply = { status: number; body: Record<string, unknown> }
type Admin = ReturnType<typeof createAdminClient>
/** The part of the Stripe client the webhook uses, so the check can fake it. */
export type StripeReader = {
  subscriptions: { list(params: Stripe.SubscriptionListParams): Promise<{ data: Stripe.Subscription[] }> }
  invoices: { list(params: Stripe.InvoiceListParams): Promise<{ data: Stripe.Invoice[]; has_more: boolean }> }
}

/** A claim older than this is presumed abandoned (its delivery died mid-run). */
const LEASE_MS = 60_000
const EPOCH = new Date(0).toISOString()

/**
 * Claim, handle and stamp one verified event. The database and Stripe are
 * passed in, so scripts/checks/stripe-webhook.mjs can run it against
 * in-memory fakes with failures injected.
 */
export async function processEvent(supabase: Admin, stripe: StripeReader, event: Stripe.Event): Promise<Reply> {
  // Idempotency: one delivery at a time holds a claim (a lease stamped with
  // its own claim time), handles the event, then stamps it processed. Only a
  // stamped claim makes a redelivery a duplicate. A delivery that finds a live
  // claim held by another answers 500, and Stripe retries it later. A failed
  // delivery hands its lease back (by its own claim time, never anyone
  // else's) so the retry can take it at once; if even that fails, the lease
  // simply expires.
  const mine = new Date().toISOString()
  const { error: insertError } = await supabase
    .from('stripe_webhook_events')
    .insert({ event_id: event.id, event_type: event.type, created_at: mine })
  let claimed = !insertError
  if (insertError?.code === '23505') {
    const { data: prior, error: priorError } = await supabase
      .from('stripe_webhook_events').select('processed_at').eq('event_id', event.id).maybeSingle()
    if (priorError) {
      console.error('Webhook: could not read prior claim, asking Stripe to retry:', event.id, priorError.message)
      return { status: 500, body: { error: 'Webhook dedup check failed' } }
    }
    if (prior?.processed_at) return { status: 200, body: { received: true, duplicate: true } }
    // Unfinished: take the lease only if it has expired or was handed back.
    const { data: taken, error: takeError } = await supabase.from('stripe_webhook_events')
      .update({ created_at: mine }).eq('event_id', event.id).is('processed_at', null)
      .lt('created_at', new Date(Date.parse(mine) - LEASE_MS).toISOString()).select('event_id')
    if (takeError || !taken?.length) {
      return { status: 500, body: { error: 'Event is being processed by another delivery' } }
    }
    claimed = true
  } else if (insertError) {
    // Any other claim error: proceed without a claim (better to process twice
    // than drop; handlers write current Stripe state, so a second run is safe).
    console.error('Webhook dedup check failed:', insertError.message)
  }

  try {
    await handle(supabase, stripe, event)
  } catch (err) {
    console.error('Webhook handler error:', event.type, event.id, err)
    if (claimed) {
      const { error: releaseError } = await supabase.from('stripe_webhook_events')
        .update({ created_at: EPOCH }).eq('event_id', event.id).eq('created_at', mine).is('processed_at', null)
      if (releaseError) console.error('Webhook: could not hand back the claim; it expires on its own:', event.id, releaseError.message)
    }
    return { status: 500, body: { error: 'Webhook handler failed' } }
  }
  if (claimed) {
    // Only while the lease is still ours: a delivery that overran it must not
    // mark done the work of the retry that took it over.
    const { error: stampError } = await supabase.from('stripe_webhook_events')
      .update({ processed_at: new Date().toISOString() }).eq('event_id', event.id).eq('created_at', mine)
    // The work is done; an unstamped claim only means a redelivery would redo it.
    if (stampError) console.error('Webhook: could not stamp processed:', event.id, stampError.message)
  }
  return { status: 200, body: { received: true } }
}

type Profile = {
  id: string; founder_pass: boolean | null
  subscription_status: string | null; stripe_subscription_id: string | null; grace_until: string | null
}
const PROFILE_COLUMNS = 'id, founder_pass, subscription_status, stripe_subscription_id, grace_until'

/** Throws on a database error, so the event is retried rather than lost. */
function must<T extends { error: { message: string } | null }>(res: T, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res
}

/**
 * The profile a Stripe customer belongs to. By the customer link first; if the
 * link is empty (checkout's write never landed), by the user id checkout put
 * on the subscription's metadata, filling the link only while it is still
 * empty. Null when the customer is not the one linked to any account here (a
 * deleted account, or a stray second customer): nothing to update.
 */
async function profileFor(supabase: Admin, customerId: string, userId?: string | null): Promise<Profile | null> {
  const { data: byCustomer } = must(await supabase.from('user_profiles')
    .select(PROFILE_COLUMNS).eq('stripe_customer_id', customerId).maybeSingle(), 'profile by customer')
  if (byCustomer) return byCustomer as Profile
  if (!userId) {
    console.warn('Webhook: no profile for customer', customerId)
    return null
  }
  must(await supabase.from('user_profiles').update({ stripe_customer_id: customerId })
    .eq('id', userId).is('stripe_customer_id', null), 'link customer')
  const { data: byUser } = must(await supabase.from('user_profiles')
    .select(`${PROFILE_COLUMNS}, stripe_customer_id`).eq('id', userId).maybeSingle(), 'profile by user')
  if (!byUser) {
    console.warn('Webhook: subscription metadata names a user with no profile', userId, customerId)
    return null
  }
  if (byUser.stripe_customer_id !== customerId) {
    // Money on a customer that is not this user's linked one. Applying it
    // would let the stray customer overwrite the real subscription; leave the
    // profile alone and make it loud so it can be refunded.
    console.error('Webhook: user', userId, 'is linked to', byUser.stripe_customer_id, 'but has a subscription on', customerId, '(not applied)')
    return null
  }
  return byUser as Profile
}

/** Best first: the subscription that should define the account now, or null. */
const RANK: Record<string, number> = { active: 0, trialing: 1, past_due: 2, unpaid: 3, incomplete: 4, paused: 5 }
function liveSubscription(subs: Stripe.Subscription[]): Stripe.Subscription | null {
  const live = subs.filter((s) => s.status in RANK)
  live.sort((a, b) => RANK[a.status] - RANK[b.status] || b.created - a.created)
  return live[0] ?? null
}

/** A failed renewal keeps Pro this long, while Stripe retries the card. */
export const PAST_DUE_GRACE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * When a past-due subscription's grace ends (ms), or null for no grace.
 * Counted from its OLDEST unpaid invoice (open, or written off as
 * uncollectible, with money still owed), the first renewal that went unpaid,
 * read from Stripe on every sync. Written-off invoices count so that Stripe
 * giving up on an old bill cannot restart the clock on the next failure.
 * Nothing here depends on what the profile held before, so two deliveries
 * racing, a later unpaid cycle, or a customer who was already past due when
 * grace shipped all land on the same end. Stored as grace_until; every reader
 * compares against it (src/lib/proStatus.ts), so the grace ends on time even
 * if Stripe goes quiet.
 */
async function graceEnd(stripe: StripeReader, sub: Stripe.Subscription): Promise<number | null> {
  let oldest: number | null = null
  for (const status of ['open', 'uncollectible'] as const) {
    let after: string | undefined
    for (;;) {
      const page = await stripe.invoices.list({ subscription: sub.id, status, limit: 100, ...(after ? { starting_after: after } : {}) })
      for (const i of page.data) {
        if (i.amount_remaining > 0 && (oldest == null || i.created < oldest)) oldest = i.created
      }
      if (!page.has_more || !page.data.length) break
      after = page.data[page.data.length - 1].id
    }
  }
  return oldest == null ? null : oldest * 1000 + PAST_DUE_GRACE_MS
}

/** Write the customer's subscription state as Stripe has it right now. */
async function syncCustomer(supabase: Admin, stripe: StripeReader, customerId: string, userId?: string | null): Promise<void> {
  const profile = await profileFor(supabase, customerId, userId)
  if (!profile) return
  // The time of THIS read of Stripe. Two deliveries for one customer can
  // overlap; the write below lands only if nothing read later has already
  // been written, so a slow delivery cannot put back a state Stripe has left.
  const readAt = new Date().toISOString()
  const { data: subs } = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })
  let live = liveSubscription(subs)
  let graceMs: number | null = null
  if (live && live.status !== 'active') {
    // No active subscription: a past-due one still in grace keeps Pro. With
    // two, the account follows the one whose grace runs longest, so the other
    // cannot drop a customer who is still covered. A trial or other non-Pro
    // subscription ranks above past_due but gives way to a running grace.
    let best: Stripe.Subscription | null = null
    for (const s of subs.filter((x) => x.status === 'past_due')) {
      const end = await graceEnd(stripe, s)
      if (end != null && (graceMs == null || end > graceMs)) { graceMs = end; best = s }
    }
    if (best && (live.status === 'past_due' || graceMs! > Date.parse(readAt))) live = best
    else if (live.status !== 'past_due') graceMs = null
  }
  const grace = graceMs == null ? null : new Date(graceMs).toISOString()
  const paid = live?.status === 'active' || (graceMs != null && graceMs > Date.parse(readAt))
  must(await supabase.from('user_profiles').update({
    // A Founder's Pass keeps Pro whatever its subscriptions do.
    subscription_tier: paid || profile.founder_pass ? 'pro' : 'free',
    subscription_status: live?.status ?? 'canceled',
    grace_until: grace,
    stripe_subscription_id: live?.id ?? null,
    subscription_updated_at: readAt,
  }).eq('id', profile.id).or(`subscription_updated_at.is.null,subscription_updated_at.lt.${readAt}`), 'subscription sync')
}

async function handle(supabase: Admin, stripe: StripeReader, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      await syncCustomer(supabase, stripe, subscription.customer as string, subscription.metadata?.supabase_user_id)
      return
    }

    // One-time payment (Founder's Pass)
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode !== 'payment' || session.payment_status !== 'paid') return
      const userId = session.metadata?.supabase_user_id
      if (!userId) {
        // A paid Founder's Pass with no user is money taken for nothing. Make
        // it loud in the logs; retrying cannot supply the missing id.
        console.error('Webhook: paid checkout without supabase_user_id', session.id)
        return
      }
      // Upsert, so a buyer whose profile row was never created is still credited.
      must(await supabase.from('user_profiles').upsert({
        id: userId,
        founder_pass: true,
        subscription_tier: 'pro',
        subscription_status: 'active',
        subscription_updated_at: new Date().toISOString(),
      }, { onConflict: 'id' }), 'founder pass')
      return
    }

    // Payment failed: Stripe has moved the subscription to past_due; sync it.
    // Pro stays until grace_until (graceEnd), which every reader checks.
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      await syncCustomer(supabase, stripe, invoice.customer as string)
      return
    }
  }
}
