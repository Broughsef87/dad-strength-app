'use client';

import { createClient } from '../utils/supabase/client';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../contexts/ThemeContext';

/**
 * The sign-in card on the public home page. Split out of src/app/page.tsx so
 * the page itself can server-render: crawlers and link previews used to get
 * nothing but "Loading". Signed-in visitors are redirected by middleware
 * before this mounts; the listener below handles an in-place sign-in.
 */
export default function AuthPanel() {
  // Memoize the client — a fresh instance each render would re-subscribe
  // the auth listener on every render and thrash the session check.
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [loading, setLoading] = useState(true);

  const authColors = resolvedTheme === 'light'
    ? {
        brand: '#CE0928',
        brandAccent: '#9C0720',
        inputBackground: 'hsl(214 18% 93%)',
        inputBorder: 'hsl(214 22% 80%)',
        inputText: 'hsl(222 32% 11%)',
        inputPlaceholder: 'hsl(215 18% 58%)',
        inputLabelText: 'hsl(215 18% 40%)',
        messageText: 'hsl(215 18% 40%)',
        anchorTextColor: 'hsl(38 90% 36%)',
        dividerBackground: 'hsl(214 22% 80%)',
      }
    : {
        brand: '#CE0928',
        brandAccent: '#9C0720',
        inputBackground: 'hsl(222 21% 7%)',
        inputBorder: 'hsl(214 35% 18%)',
        inputText: 'hsl(210 24% 80%)',
        inputPlaceholder: 'hsl(213 22% 32%)',
        inputLabelText: 'hsl(213 22% 52%)',
        messageText: 'hsl(213 22% 52%)',
        anchorTextColor: 'hsl(38 90% 41%)',
        dividerBackground: 'hsl(214 35% 18%)',
      };

  useEffect(() => {
    // Initial check — already-authenticated visitors skip the login screen.
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { router.replace('/dashboard'); return; }
      setLoading(false);
    };
    checkUser();

    // Live listener — THIS is what redirects after an in-place email/password
    // or OAuth sign-in. Without it, a successful login updates the session but
    // the page just sits there ("nothing happens on Sign In").
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: unknown) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        router.replace('/dashboard');
      }
    });
    return () => subscription.unsubscribe();
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center bg-card border border-border">
        <div className="w-5 h-5 border border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative bg-card border border-border p-6 pt-9 shadow-2xl">
      <div className="flex items-center gap-2 mb-4">
        <span className="status-dot" />
        <span className="eyebrow-mono">Pilot Authentication</span>
      </div>
      <Auth
        supabaseClient={supabase}
        appearance={{
          theme: ThemeSupa,
          variables: { default: { colors: authColors } },
        }}
        providers={['google']}
        redirectTo={typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined}
      />
    </div>
  );
}
