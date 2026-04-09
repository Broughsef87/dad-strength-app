import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Use more robust check for missing environment variables
  const isMissing = !url || url === 'undefined' || !key || key === 'undefined';

  if (isMissing) {
    // Return a dummy client during build time or if env vars are missing
    // to avoid crashing the entire app during SSR.
    return {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        getSession: async () => ({ data: { session: null }, error: null }),
        signInWithOAuth: async () => ({ data: null, error: new Error('Supabase not configured') }),
        onAuthStateChange: () => ({ 
          data: { subscription: { unsubscribe: () => {} } },
          error: null 
        }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
            single: () => Promise.resolve({ data: null, error: null }),
          }),
          order: () => Promise.resolve({ data: [], error: null }),
          single: () => Promise.resolve({ data: null, error: null }),
        }),
        insert: () => Promise.resolve({ data: null, error: null }),
        update: () => Promise.resolve({ data: null, error: null }),
        delete: () => Promise.resolve({ data: null, error: null }),
      }),
    } as any;
  }

  return createBrowserClient(url, key);
}
