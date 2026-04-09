/**
 * Supabase-backed rate limiter for AI routes.
 *
 * Replaces in-memory Maps which are reset on every serverless cold start
 * and don't shared state across Vercel function instances.
 *
 * Usage:
 *   const { allowed, remaining } = await checkRateLimit(supabase, userId, 'workout', 10, 60_000)
 *   if (!allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
}

/**
 * Check and record a rate-limited request.
 *
 * @param supabase   Server-side Supabase client (has auth context)
 * @param userId     Authenticated user's ID
 * @param route      Stable identifier for the route (e.g. 'workout', 'debrief')
 * @param limit      Max requests allowed within the window (default 10)
 * @param windowMs   Window duration in milliseconds (default 60_000 = 1 minute)
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  route: string,
  limit: number = 10,
  windowMs: number = 60_000,
): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - windowMs).toISOString()

  // Count existing requests in the window
  const { count, error } = await supabase
    .from('ai_request_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('route', route)
    .gte('created_at', windowStart)

  if (error) {
    // If the DB check fails, allow the request rather than block legitimate users.
    // Log the error but don't hard-fail.
    console.error('[rateLimit] DB check failed:', error.message)
    return { allowed: true, remaining: limit }
  }

  const current = count ?? 0

  if (current >= limit) {
    return { allowed: false, remaining: 0 }
  }

  // Record this request
  await supabase
    .from('ai_request_logs')
    .insert({ user_id: userId, route })

  return { allowed: true, remaining: limit - current - 1 }
}
