import type Stripe from 'stripe'
import type { createAdminClient } from '../utils/supabase/admin'

// The Stripe webhook's work once the signature is verified. Lives outside the
// route file because a route may only export its handlers.

type Reply = { status: number; body: Record<string, unknown> }

/**
 * Claim, handle and stamp one verified event. The database is passed in, so scripts/checks/stripe-webhook.mjs can run it against an
 * in-memory table with failures injected.
 */
export async function processEvent(supabase: Admin, event: Stripe.Event): Promise<Reply> {
  // Idempotency: CLAIM the event, handle it, then stamp it processed. Only a
  // stamped claim makes a redelivery a duplicate. A failure releases the claim
  // and answers 500 so Stripe retries; if even the release fails (database
  // down), the unstamped claim still lets the retry through. Before, one failed
  // write left a permanent claim and a paying subscriber on the free tier.
  const { error: dedupError } = await supabase
    .from('stripe_webhook_events')
    .insert({ event_id: event.id, event_type: event.type })
  if (dedupError?.code === '23505') {
    const { data: prior, error: priorError } = await supabase
      .from('stripe_webhook_events').select('processed_at').eq('event_id', event.id).maybeSingle()
    if (priorError) {
      console.error('Webhook: could not read prior claim, asking Stripe to retry:', event.id, priorError.message)
      return { status: 500, body: { error: 'Webhook dedup check failed' } }
    }
    if (prior?.processed_at) return { status: 200, body: { received: true, duplicate: true } }
    // Claimed but never finished: handle it now. Every handler writes absolute
    // state, so running one twice is harmless.
  }
  // Any other claim error: proceed without a claim (better to process twice
  // than drop), and there is nothing to release afterwards.
  const claimed = !dedupError || dedupError.code === '23505'
  if (dedupError && dedupError.code !== '23505') console.error('Webhook dedup check failed:', dedupError.message)

  try {
    await handle(supabase, event)
  } catch (err) {
    console.error('Webhook handler error:', event.type, event.id, err)
    if (claimed) {
      const { error: releaseError } = await supabase.from('stripe_webhook_events').delete().eq('event_id', event.id)
      if (releaseError) console.error('Webhook: could not release claim; it stays unstamped, so the retry still runs:', event.id, releaseError.message)
    }
    return { status: 500, body: { error: 'Webhook handler failed' } }
  }
  if (claimed) {
    const { error: stampError } = await supabase.from('stripe_webhook_events')
      .update({ processed_at: new Date().toISOString() }).eq('event_id', event.id)
    // The work is done; an unstamped claim only means a redelivery would redo it.
    if (stampError) console.error('Webhook: could not stamp processed:', event.id, stampError.message)
  }
  return { status: 200, body: { received: true } }
}

type Admin = ReturnType<typeof createAdminClient>
type Profile = { id: string; founder_pass: boolean | null; stripe_subscription_id: string | null; subscription_status: string | null }

/** Throws on a database error, so the event is retried rather than lost. */
function must<T extends { error: { message: string } | null }>(res: T, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`)
  return res
}

/**
 * The profile a Stripe customer belongs to. By the customer link first; if the
 * link is missing (checkout's write never landed), by the user id checkout put
 * on the subscription's metadata — and the link is repaired. Null when the
 * customer belongs to no account here (a deleted account): nothing to update.
 */
async function profileFor(supabase: Admin, customerId: string, userId?: string | null): Promise<Profile | null> {
  const { data: byCustomer } = must(await supabase.from('user_profiles')
    .select('id, founder_pass, stripe_subscription_id, subscription_status').eq('stripe_customer_id', customerId).maybeSingle(), 'profile by customer')
  if (byCustomer) return byCustomer as Profile
  if (!userId) {
    console.warn('Webhook: no profile for customer', customerId)
    return null
  }
  const { data: byUser } = must(await supabase.from('user_profiles')
    .select('id, founder_pass, stripe_subscription_id, subscription_status, stripe_customer_id').eq('id', userId).maybeSingle(), 'profile by user')
  if (!byUser) {
    console.warn('Webhook: subscription metadata names a user with no profile', userId, customerId)
    return null
  }
  if (!byUser.stripe_customer_id) {
    must(await supabase.from('user_profiles').update({ stripe_customer_id: customerId }).eq('id', userId), 'link customer')
  } else {
    console.warn('Webhook: user', userId, 'is linked to', byUser.stripe_customer_id, 'but paid as', customerId)
  }
  return byUser as Profile
}

/**
 * A different subscription is already active on this profile, and this one is
 * not active: it is a stray (two checkouts at once) and must not overwrite the
 * live one. An active subscription always wins, so a real switch still lands.
 */
function supersededBy(profile: Profile, subscription: Stripe.Subscription): boolean {
  const other = profile.stripe_subscription_id && profile.stripe_subscription_id !== subscription.id
  if (other && profile.subscription_status === 'active' && subscription.status !== 'active') {
    console.warn('Webhook: ignoring', subscription.status, 'subscription', subscription.id, 'while', profile.stripe_subscription_id, 'is active for', profile.id)
    return true
  }
  return false
}

async function handle(supabase: Admin, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    // Subscription created or updated
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const profile = await profileFor(supabase, subscription.customer as string, subscription.metadata?.supabase_user_id)
      if (!profile) return
      if (supersededBy(profile, subscription)) return
      must(await supabase.from('user_profiles').update({
        subscription_tier: subscription.status === 'active' ? 'pro' : 'free',
        subscription_status: subscription.status,
        stripe_subscription_id: subscription.id,
        subscription_updated_at: new Date().toISOString(),
      }).eq('id', profile.id), 'subscription update')
      return
    }

    // Subscription cancelled/expired
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const profile = await profileFor(supabase, subscription.customer as string, subscription.metadata?.supabase_user_id)
      if (!profile) return
      // Ending a subscription that is not the one on the profile (a duplicate
      // from two checkouts at once) must not take Pro off the live one.
      if (profile.stripe_subscription_id && profile.stripe_subscription_id !== subscription.id) {
        console.warn('Webhook: ignoring deletion of non-current subscription', subscription.id, 'for', profile.id)
        return
      }
      must(await supabase.from('user_profiles').update({
        // Keep pro if they have founder pass
        subscription_tier: profile.founder_pass ? 'pro' : 'free',
        subscription_status: 'canceled',
        stripe_subscription_id: null,
        subscription_updated_at: new Date().toISOString(),
      }).eq('id', profile.id), 'subscription cancel')
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

    // Payment failed. NOTE: entitlements require status 'active', so this
    // removes Pro immediately — there is no grace period while Stripe retries.
    // That is a product decision recorded in REVIEW.md, not changed here.
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const profile = await profileFor(supabase, invoice.customer as string)
      if (!profile) return
      must(await supabase.from('user_profiles').update({
        subscription_status: 'past_due',
        subscription_updated_at: new Date().toISOString(),
      }).eq('id', profile.id), 'payment failed')
      return
    }
  }
}
