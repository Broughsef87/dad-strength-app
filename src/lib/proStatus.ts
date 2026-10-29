// Whether a user_profiles row unlocks Pro right now. The ONE reader rule, used
// by entitlements.ts (server) and SubscriptionContext (client). The database's
// is_premium() holds the same rule (20261028_past_due_grace.sql); change both
// together.
//
// The Stripe webhook decides subscription_tier and stamps grace_until when a
// renewal fails (stripeWebhook.ts). past_due is Pro only until grace_until, so
// the grace ends on time even if Stripe never sends another event.

export interface ProFields {
  subscription_tier?: string | null
  subscription_status?: string | null
  grace_until?: string | null
  founder_pass?: boolean | null
}

export const PRO_FIELDS = 'subscription_tier, subscription_status, grace_until, founder_pass'

export function hasPro(p: ProFields | null | undefined, now: number = Date.now()): boolean {
  if (!p) return false
  if (p.founder_pass === true) return true
  if (p.subscription_tier !== 'pro') return false
  if (p.subscription_status === 'active') return true
  return p.subscription_status === 'past_due' && p.grace_until != null && Date.parse(p.grace_until) > now
}
