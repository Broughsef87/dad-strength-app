import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '../../../utils/supabase/server'
import { createAdminClient } from '../../../utils/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { priceId } = body ?? {}

    // Whitelist allowed price IDs server-side — never trust raw client input for billing
    const allowedPriceIds = new Set([
      process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID,
      process.env.NEXT_PUBLIC_STRIPE_YEARLY_PRICE_ID,
      process.env.NEXT_PUBLIC_STRIPE_FOUNDER_PRICE_ID,
    ].filter(Boolean))

    if (!priceId || !allowedPriceIds.has(priceId)) {
      return NextResponse.json({ error: 'Invalid price ID.' }, { status: 400 })
    }
    // The mode follows the price, never the request: the Founder's Pass is a
    // one-time payment, everything else is a subscription.
    const mode: 'payment' | 'subscription' =
      priceId === process.env.NEXT_PUBLIC_STRIPE_FOUNDER_PRICE_ID ? 'payment' : 'subscription'

    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('stripe_customer_id, subscription_tier, founder_pass')
      .eq('id', user.id)
      .maybeSingle()

    // Block if already premium
    if (profile?.founder_pass || profile?.subscription_tier === 'pro') {
      return NextResponse.json({ error: 'Already a premium member' }, { status: 400 })
    }

    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email!,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id

      // The link the webhook finds this user by. Billing columns are
      // server-written only (20261026_protect_billing_columns.sql), so this
      // goes through the service role — and it must land: a checkout whose
      // customer is not linked is a payment the webhook cannot credit.
      const { error: linkError } = await createAdminClient().from('user_profiles').upsert({
        id: user.id,
        stripe_customer_id: customerId,
      }, { onConflict: 'id' })
      if (linkError) {
        console.error('Checkout: could not link Stripe customer', linkError)
        return NextResponse.json({ error: 'Checkout is unavailable right now. You have not been charged.' }, { status: 503 })
      }
    }

    // Build redirect URLs from env var, not the spoofable Origin header
    const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode,
      success_url: `${origin}/dashboard?upgrade=success`,
      cancel_url: `${origin}/dashboard?upgrade=canceled`,
      metadata: {
        supabase_user_id: user.id,
        mode,
      },
      // Carried on the subscription itself, so its webhooks can still find
      // the user if the customer link is ever missing.
      ...(mode === 'subscription' ? { subscription_data: { metadata: { supabase_user_id: user.id } } } : {}),
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Checkout error:', err)
    return NextResponse.json({ error: 'Checkout failed. You have not been charged.' }, { status: 500 })
  }
}
