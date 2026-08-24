import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '../../../utils/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * Stripe Customer Portal session.
 *
 * Subscribers manage their own billing here — update card, view invoices,
 * cancel. Stripe requires self-serve cancellation to be reachable; this is
 * that path. The portal itself is configured in the Stripe dashboard
 * (Settings → Billing → Customer portal).
 */
export async function POST() {
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

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing account found. If you believe this is a mistake, contact support.' },
        { status: 404 }
      )
    }

    // Build return URL from env var, not the spoofable Origin header
    const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/profile/settings`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Billing portal error:', err)
    return NextResponse.json({ error: 'Could not open billing portal' }, { status: 500 })
  }
}
