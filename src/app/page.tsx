'use client';

import { createClient } from '../utils/supabase/client';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '../components/Logo';

export default function Home() {
  // Memoize the client — a fresh instance each render would re-subscribe
  // the auth listener on every render and thrash the session check.
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // The sign-in screen is the one surface the reskin could not reach with a
  // class. <Auth> is a third-party widget that takes its palette as VALUES, so
  // it kept whatever it was last handed — which was the retired cockpit
  // palette. Measured on the running page before this change:
  //
  //   primary "Sign in" button   #CE0928   Ferrari red, from an era the
  //                                        design memory records as RETIRED
  //   "Sign in with Google"      #FFFFFF   pure white, which the paper
  //                                        contract bans outright, grey label
  //                                        on it at 3.95:1
  //   field labels               4.11:1    under the 4.5:1 floor
  //
  // This is the app's front door: the first screen anyone sees, and the only
  // one an unauthenticated visitor CAN see. It was a whole design system behind.
  //
  // Handing it hsl(var(--token)) instead of hex is the actual fix. These are
  // used as CSS values, so the cascade resolves them per theme exactly like
  // every other surface — the widget follows paper and lamplight for free. It
  // also deletes the hand-maintained light/dark duplicate, which is precisely
  // what let this drift unnoticed through two redesigns: two lists of literals
  // that nobody re-derives when the tokens move.
  const authColors = {
    brand: 'hsl(var(--brand))',
    brandAccent: 'hsl(var(--brand-deep))',
    brandButtonText: 'hsl(var(--brand-ink))',
    defaultButtonBackground: 'hsl(var(--card))',
    defaultButtonBackgroundHover: 'hsl(var(--surface-2))',
    defaultButtonBorder: 'hsl(var(--border))',
    defaultButtonText: 'hsl(var(--foreground))',
    inputBackground: 'hsl(var(--surface-2))',
    inputBorder: 'hsl(var(--border))',
    inputBorderHover: 'hsl(var(--muted-foreground))',
    // focus must not resolve to the resting border, or the ring is invisible
    inputBorderFocus: 'hsl(var(--foreground))',
    inputText: 'hsl(var(--foreground))',
    inputPlaceholder: 'hsl(var(--muted-foreground))',
    inputLabelText: 'hsl(var(--muted-foreground))',
    messageText: 'hsl(var(--muted-foreground))',
    messageTextDanger: 'hsl(var(--destructive))',
    anchorTextColor: 'hsl(var(--foreground))',
    anchorTextHoverColor: 'hsl(var(--brand-text))',
    dividerBackground: 'hsl(var(--border))',
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
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-5 h-5 border border-brand border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-[9px] uppercase font-display tracking-[0.08em]">Loading</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background p-8">

      <div className="relative z-10 w-full max-w-sm space-y-10">
        {/* Brand lockup — stacked suite asset, dark/light aware */}
        <div className="flex flex-col items-center">
          <Logo className="w-24 h-24 drop-shadow-2xl" />
          <p className="font-display font-semibold text-2xl uppercase text-foreground mt-5 tracking-[0.08em]">
            Dad Strength
          </p>
        </div>

        {/* Auth card — pilot authentication console */}
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

        <p className="eyebrow-mono text-center">
          DS-01 // BUILT FOR THE LONG HAUL
        </p>

        {/* Legal footer */}
        <div className="flex items-center justify-center gap-4 -mt-4">
          <a href="/terms" className="text-[10px] uppercase text-muted-foreground hover:text-foreground transition-colors tracking-[0.08em]">terms</a>
          <a href="/privacy" className="text-[10px] uppercase text-muted-foreground hover:text-foreground transition-colors tracking-[0.08em]">privacy</a>
          <a href="/disclaimer" className="text-[10px] uppercase text-muted-foreground hover:text-foreground transition-colors tracking-[0.08em]">disclaimer</a>
        </div>
      </div>
    </div>
  );
}
