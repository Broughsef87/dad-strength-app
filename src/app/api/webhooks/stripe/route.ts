import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '../../../../utils/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Signature verification failed'
    console.error('Webhook signature error:', message)
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Idempotency: CLAIM the event, handle it, and only then is it processed.
  // The claim used to be permanent the moment it was inserted, while every
  // write after it ignored its own error — so one failed update returned 200,
  // Stripe never retried, and the retry it would have sent was dropped as a
  // duplicate anyway. A paying subscriber stayed on the free tier for good
  // (reproduced locally with one injected write failure). Now a failure
  // releases the claim and answers 500, and Stripe's retry does the work.
  const { error: dedupError } = await supabase
    .from('stripe_webhook_events')
    .insert({ event_id: event.id, event_type: event.type })
  if (dedupError?.code === '23505') {
    return NextResponse.json({ received: true, duplicate: true })
  }
  // Any other claim error: proceed without a claim (better to process twice
  // than drop), and there is nothing to release afterwards.
  const claimed = !dedupError
  if (dedupError) console.error('Webhook dedup check failed:', dedupError.message)

  try {
    await handle(supabase, event)
    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook handler error:', event.type, event.id, err)
    if (claimed) {
      const { error: releaseError } = await supabase.from('stripe_webhook_events').delete().eq('event_id', event.id)
      if (releaseError) console.error('Webhook: could not release claim, the retry will be skipped:', event.id, releaseError.message)
    }
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}

type Admin = ReturnType<typeof createAdminClient>
type Profile = { id: string; founder_pass: boolean | null }

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
    .select('id, founder_pass').eq('stripe_customer_id', customerId).maybeSingle(), 'profile by customer')
  if (byCustomer) return byCustomer as Profile
  if (!userId) {
    console.warn('Webhook: no profile for customer', customerId)
    return null
  }
  const { data: byUser } = must(await supabase.from('user_profiles')
    .select('id, founder_pass, stripe_customer_id').eq('id', userId).maybeSingle(), 'profile by user')
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

async function handle(supabase: Admin, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    // Subscription created or updated
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const profile = await profileFor(supabase, subscription.customer as string, subscription.metadata?.supabase_user_id)
      if (!profile) return
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
