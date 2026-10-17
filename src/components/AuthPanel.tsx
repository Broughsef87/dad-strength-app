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
 * nothing but "Loading". A visitor who is already signed in sees a way into
 * the app instead of the form, so the public site stays browsable; only a
 * sign-in that happens here sends him to the dashboard.
 */
export default function AuthPanel() {
  // Memoize the client — a fresh instance each render would re-subscribe
  // the auth listener on every render and thrash the session check.
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

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
    // Set once the initial check has seen no session. Supabase can emit
    // SIGNED_IN for a session it merely restored (e.g. on tab refocus), so
    // only an event after a signed-out start counts as signing in here.
    let startedSignedOut = false;

    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSignedIn(!!session);
      startedSignedOut = !session;
      setLoading(false);
    };
    checkUser();

    // Live listener — THIS is what redirects after an in-place email/password
    // sign-in. Without it, a successful login updates the session but the
    // page just sits there ("nothing happens on Sign In"). Google sign-in
    // returns straight to /dashboard via redirectTo.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: unknown) => {
      if (session && event === 'SIGNED_IN' && startedSignedOut) {
        router.replace('/dashboard');
      }
      if (!session && event === 'SIGNED_OUT') setSignedIn(false);
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

  if (signedIn) {
    return (
      <div className="relative bg-card border border-border p-6">
        <p className="eyebrow-mono">signed in</p>
        <p className="mt-2 mb-5 text-[15px] font-light leading-[1.65] text-muted-foreground">
          you are already signed in.
        </p>
        <a href="/dashboard" className="pill-volt inline-block px-6 py-3.5 text-base font-semibold">
          open the app
        </a>
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
