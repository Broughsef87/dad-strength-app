import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Return a dummy client during build time to avoid prerendering errors
    // but only if we are in a build environment
    if (typeof window === 'undefined') {
       return {} as any;
    }
    throw new Error('Missing Supabase Environment Variables');
  }

  return createBrowserClient(url, key);
}
