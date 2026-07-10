import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { checkRateLimit } from './rateLimit'

// ═══════════════════════════════════════════════════════════════════════════════
// ENTITLEMENTS — the single server-side source of truth for what a tier unlocks.
//
// IMPORTANT: this is the ENFORCEMENT layer. The client (SubscriptionContext,
// PremiumGate, UpgradeModal) only *presents* the paywall — a determined user can
// bypass any client check. Access to paid features must be gated here, server-side.
//
// Free tier:  1 program · Dad Score · a metered taste of the AI
// Pro tier:   all 3 programs · unlimited AI · weekly AI debriefs
//   (pro = active subscription OR founder_pass lifetime)
// ═══════════════════════════════════════════════════════════════════════════════

export type Tier = 'free' | 'pro'

export interface Entitlement {
  tier: Tier
  isPro: boolean
  isFounder: boolean
}

// Coach-grade AI — Pro only. These are the "weekly debrief" class of features.
export const PRO_ONLY_AI = new Set<string>([
  'debrief-personalized',
  'quarterly-review',
  'mission-brief',
  'program-generate',
])

// Metered AI — free users get a daily taste, pro gets a high ceiling ("unlimited"
// in practice). Keyed by route → per-day request cap for each tier.
// 'squeeze-generate' has no route on this branch yet; the entry is inert
// (requireAiQuota no-ops on unknown routes) and ready for when it lands.
export const AI_DAILY_LIMITS: Record<string, { free: number; pro: number }> = {
  'morning-protocol': { free: 1, pro: 30 },
  'workout':          { free: 1, pro: 60 },
  'squeeze-generate': { free: 2, pro: 60 },
}

const DAY_MS = 24 * 60 * 60 * 1000

export async function getEntitlement(supabase: SupabaseClient, userId: string): Promise<Entitlement> {
  const { data } = await supabase
    .from('user_profiles')
    .select('subscription_tier, subscription_status, founder_pass')
    .eq('id', userId)
    .maybeSingle()

  const isFounder = data?.founder_pass === true
  const isActivePro = data?.subscription_tier === 'pro' && data?.subscription_status === 'active'
  const isPro = isFounder || isActivePro
  return { tier: isPro ? 'pro' : 'free', isPro, isFounder }
}

/**
 * Guard for Pro-only routes. Returns a 402 NextResponse if the user isn't
 * entitled, or null if they may proceed. Usage:
 *   const gate = await requirePro(supabase, user.id)
 *   if (gate) return gate
 */
export async function requirePro(supabase: SupabaseClient, userId: string): Promise<NextResponse | null> {
  const ent = await getEntitlement(supabase, userId)
  if (ent.isPro) return null
  return NextResponse.json(
    { error: 'This feature requires Dad Strong+.', code: 'upgrade_required' },
    { status: 402 },
  )
}

/**
 * The user's one program. `user_programs.user_id` is UNIQUE, so a user has
 * exactly one row — `program_slug` IS their program. Returns null if they
 * haven't claimed one yet.
 *
 * The tier rule rides on this shape: FREE claims a program once and is stuck
 * with it; PRO may change the slug (switch programs). The switch itself is
 * enforced in the DB by the user_programs_tier_gate trigger, so it holds even
 * if a client writes to Supabase directly.
 */
export async function getActiveProgramSlug(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('user_programs')
    .select('program_slug')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.program_slug ?? null
}

/**
 * Guard for metered AI routes. Enforces a per-day cap that scales with tier.
 * Free users who hit their cap get a 402 (upgrade), pro users who somehow hit
 * the high ceiling get a 429 (slow down). Returns null if allowed.
 */
export async function requireAiQuota(
  supabase: SupabaseClient,
  userId: string,
  route: string,
): Promise<NextResponse | null> {
  const limits = AI_DAILY_LIMITS[route]
  if (!limits) return null // unmetered route — nothing to enforce here
  const ent = await getEntitlement(supabase, userId)
  const cap = limits[ent.tier]
  // Distinct log key (":day") so the daily cap doesn't collide with any
  // short-window burst limiter on the same route.
  const { allowed } = await checkRateLimit(supabase, userId, `${route}:day`, cap, DAY_MS)
  if (allowed) return null
  return ent.isPro
    ? NextResponse.json({ error: 'Daily AI limit reached. Try again tomorrow.', code: 'rate_limited' }, { status: 429 })
    : NextResponse.json(
        { error: `Free plan includes ${cap} of this per day. Upgrade for unlimited.`, code: 'upgrade_required' },
        { status: 402 },
      )
}
