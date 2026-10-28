// Subscription statuses that can carry Pro. past_due only within the 7-day
// grace the Stripe webhook applies when it sets subscription_tier
// (paidUp in stripeWebhook.ts). The database's is_premium() keeps the same
// list (20261028_past_due_grace.sql); change both together.
export const PRO_STATUSES: ReadonlyArray<string | null | undefined> = ['active', 'past_due']
