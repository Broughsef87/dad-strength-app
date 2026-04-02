import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '../../../utils/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-03-25.dahlia' as any,
  })

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { priceId, mode } = body

    // Whitelist allowed price IDs server-side — never trust raw client input for billing
    const allowedPriceIds = new Set([
      process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID,
      process.env.NEXT_PUBLIC_STRIPE_YEARLY_PRICE_ID,
      process.env.NEXT_PUBLIC_STRIPE_FOUNDER_PRICE_ID,
    ].filter(Boolean))

    if (!priceId || !allowedPriceIds.has(priceId)) {
      return NextResponse.json({ error: 'Invalid price ID.' }, { status: 400 })
    }

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

      await supabase.from('user_profiles').upsert({
        id: user.id,
        stripe_customer_id: customerId,
      }, { onConflict: 'id' })
    }

    // Build redirect URLs from env var, not the spoofable Origin header
    const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: mode === 'payment' ? 'payment' : 'subscription',
      success_url: `${origin}/dashboard?upgrade=success`,
      cancel_url: `${origin}/dashboard?upgrade=canceled`,
      metadata: {
        supabase_user_id: user.id,
        mode,
      },
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('Checkout error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
