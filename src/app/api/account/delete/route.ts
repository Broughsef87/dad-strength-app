import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '../../../../utils/supabase/server'
import { createAdminClient } from '../../../../utils/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Account deletion — the real thing, not a mailto link.
 *
 * Order matters:
 *   1. verify the caller and their typed confirmation
 *   2. settle Stripe first (cancel subscription, delete customer) — if that
 *      fails we STOP rather than orphan a paying subscription on a deleted
 *      account
 *   3. auth.admin.deleteUser — every user table cascades from auth.users
 *      (see migration 20260823_account_lifecycle), so this wipes workout
 *      logs, profile, checkins, everything.
 *
 * GDPR/CCPA + app-store policies require in-product deletion; this is it.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    if (body?.confirm !== 'delete') {
      return NextResponse.json(
        { error: 'Confirmation phrase missing.' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // Look up billing state with the admin client — deletion must work even
    // if something is off with the user's own session-scoped reads.
    const { data: profile } = await admin
      .from('user_profiles')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('id', user.id)
      .maybeSingle()

    // ── 1. Settle Stripe ────────────────────────────────────────────────
    if (profile?.stripe_customer_id && process.env.STRIPE_SECRET_KEY) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
      try {
        if (profile.stripe_subscription_id) {
          // Cancel immediately — no further charges for an account that is
          // about to stop existing.
          await stripe.subscriptions
            .cancel(profile.stripe_subscription_id)
            .catch((err: unknown) => {
              // Already-canceled subscriptions throw; that's fine.
              const msg = err instanceof Error ? err.message : ''
              if (!/canceled|No such subscription/i.test(msg)) throw err
            })
        }
        // Deleting the customer removes stored payment methods and personal
        // details from Stripe, and cancels anything still attached.
        await stripe.customers.del(profile.stripe_customer_id)
      } catch (err) {
        console.error('Account deletion: Stripe cleanup failed', err)
        return NextResponse.json(
          {
            error:
              'Could not settle your billing account. Your account was NOT deleted — contact support and we will finish this for you.',
          },
          { status: 502 }
        )
      }
    }

    // ── 2. Delete the auth user — cascades wipe all app data ───────────
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id)
    if (delErr) {
      console.error('Account deletion: deleteUser failed', delErr)
      return NextResponse.json(
        { error: 'Deletion failed. Nothing was removed — try again or contact support.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Account deletion error:', err)
    return NextResponse.json({ error: 'Deletion failed.' }, { status: 500 })
  }
}
