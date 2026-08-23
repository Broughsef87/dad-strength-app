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
 * Stripe-first is the right order, but it is not atomic, so the two ways it
 * can half-finish are handled explicitly:
 *
 *   · Stripe settled, then deleteUser failed. The customer is GONE and the
 *     account is not. Two consequences: the response must not claim "nothing
 *     was removed" (it lied), and a retry must still be able to finish —
 *     which it can't if deleting an already-deleted customer is treated as
 *     fatal. Both are handled below; without the tolerant catch a user whose
 *     first attempt half-failed could never delete their account at all.
 *
 *   · Billing exists but STRIPE_SECRET_KEY is missing/misconfigured. The old
 *     code skipped settlement and deleted the account anyway, leaving a live
 *     subscription billing a person who can no longer log in to cancel it.
 *     That is the exact failure the ordering exists to prevent, so this now
 *     fails closed.
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

    const hasBilling = Boolean(profile?.stripe_customer_id)

    // ── 0. Refuse to delete an account we cannot un-bill ────────────────
    if (hasBilling && !process.env.STRIPE_SECRET_KEY) {
      console.error('Account deletion: billing present but STRIPE_SECRET_KEY missing')
      return NextResponse.json(
        {
          error:
            'Billing cannot be reached right now, so your account was NOT deleted — deleting it would leave your subscription running with no way for you to cancel it. Please try again shortly or contact support.',
        },
        { status: 503 }
      )
    }

    // ── 1. Settle Stripe ────────────────────────────────────────────────
    let billingSettled = false
    if (hasBilling) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string)
      try {
        if (profile!.stripe_subscription_id) {
          // Cancel immediately — no further charges for an account that is
          // about to stop existing.
          await stripe.subscriptions
            .cancel(profile!.stripe_subscription_id)
            .catch((err: unknown) => {
              // Already-canceled subscriptions throw; that's fine.
              const msg = err instanceof Error ? err.message : ''
              if (!/canceled|No such subscription/i.test(msg)) throw err
            })
        }
        // Deleting the customer removes stored payment methods and personal
        // details from Stripe, and cancels anything still attached.
        await stripe.customers
          .del(profile!.stripe_customer_id as string)
          .catch((err: unknown) => {
            // Already deleted — true when a previous attempt settled Stripe
            // and then failed at deleteUser. Treating this as fatal would
            // permanently trap the account: every retry would 502 here.
            const msg = err instanceof Error ? err.message : ''
            if (!/No such customer|resource_missing|already been deleted/i.test(msg)) throw err
          })
        billingSettled = true
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
      // Be honest about what is already gone. If Stripe was settled above,
      // the subscription really is cancelled — telling the user "nothing was
      // removed" would send them off believing they are still subscribed.
      return NextResponse.json(
        {
          error: billingSettled
            ? 'Your subscription was cancelled, but the account itself could not be deleted. You will not be charged again. Contact support to finish removing your data — do not re-subscribe.'
            : 'Deletion failed. Nothing was removed — try again or contact support.',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Account deletion error:', err)
    return NextResponse.json({ error: 'Deletion failed.' }, { status: 500 })
  }
}
