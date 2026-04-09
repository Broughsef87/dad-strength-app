import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase-backed per-user rate limiter.
 *
 * Unlike an in-memory Map, this works correctly across serverless instances
 * and survives cold starts. Each allowed request inserts a row into
 * ai_request_logs; the count of rows in the sliding window determines
 * whether the request is allowed.
 *
 * Fails open (allows the request) if the DB call errors, so a DB outage
 * doesn't block legitimate users.
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  route: string,
  limit = 10,
  windowMs = 60_000,
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const windowStart = new Date(Date.now() - windowMs).toISOString()

    const { count, error: countError } = await supabase
      .from('ai_request_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('route', route)
      .gte('created_at', windowStart)

    if (countError) {
      // Fail open — don't block users because of a DB error
      return { allowed: true, remaining: limit }
    }

    const used = count ?? 0
    if (used >= limit) {
      return { allowed: false, remaining: 0 }
    }

    // Log this request
    await supabase.from('ai_request_logs').insert({ user_id: userId, route })

    return { allowed: true, remaining: limit - used - 1 }
  } catch {
    // Fail open
    return { allowed: true, remaining: limit }
  }
}
