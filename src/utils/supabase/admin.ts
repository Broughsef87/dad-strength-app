import { createClient } from '@supabase/supabase-js'

/**
 * Admin client — uses the service role key, bypasses RLS.
 * Only use in server-side API routes (webhooks, admin tasks).
 * NEVER expose to the client.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
