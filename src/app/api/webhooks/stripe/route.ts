import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '../../../../utils/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-03-25.dahlia' as any,
  })

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err: any) {
    console.error('Webhook signature error:', err.message)
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
  }

  const supabase = createAdminClient()

  try {
    switch (event.type) {

      // Subscription created or updated
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()

        if (profile) {
          await supabase.from('user_profiles').update({
            subscription_tier: subscription.status === 'active' ? 'pro' : 'free',
            subscription_status: subscription.status,
            stripe_subscription_id: subscription.id,
            subscription_updated_at: new Date().toISOString(),
          }).eq('id', profile.id)
        }
        break
      }

      // Subscription cancelled/expired
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = subscription.customer as string

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id, founder_pass')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()

        if (profile) {
          await supabase.from('user_profiles').update({
            // Keep pro if they have founder pass
            subscription_tier: profile.founder_pass ? 'pro' : 'free',
            subscription_status: 'canceled',
            stripe_subscription_id: null,
            subscription_updated_at: new Date().toISOString(),
          }).eq('id', profile.id)
        }
        break
      }

      // One-time payment (Founder's Pass)
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        if (session.mode === 'payment' && session.payment_status === 'paid') {
          const userId = session.metadata?.supabase_user_id

          if (userId) {
            await supabase.from('user_profiles').update({
              founder_pass: true,
              subscription_tier: 'pro',
              subscription_status: 'active',
              subscription_updated_at: new Date().toISOString(),
            }).eq('id', userId)
          }
        }
        break
      }

      // Payment failed — downgrade after grace period handled by subscription.updated
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()

        if (profile) {
          await supabase.from('user_profiles').update({
            subscription_status: 'past_due',
            subscription_updated_at: new Date().toISOString(),
          }).eq('id', profile.id)
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
