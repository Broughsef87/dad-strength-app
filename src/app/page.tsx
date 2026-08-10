'use client';

import { createClient } from '../utils/supabase/client';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../contexts/ThemeContext';
import Logo from '../components/Logo';

export default function Home() {
  // Memoize the client — a fresh instance each render would re-subscribe
  // the auth listener on every render and thrash the session check.
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [loading, setLoading] = useState(true);

  // AS BUILT: checker's-amber sign-in button. Auth-UI renders white button
  // text, so brand uses the darker amber rung for contrast; hover goes darker
  // still rather than lighter — ink deepens, drawings don't glow.
  const authColors = resolvedTheme === 'light'
    ? {
        brand: '#B87400',
        brandAccent: '#8F5A00',
        brandButtonText: '#FFFFFF',
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
        brand: '#FFB020',
        brandAccent: '#D68A00',
        brandButtonText: '#0A1B2C',
        inputBackground: 'hsl(210 60% 11%)',
        inputBorder: 'hsl(209 40% 26%)',
        inputText: 'hsl(210 56% 91%)',
        inputPlaceholder: 'hsl(209 30% 38%)',
        inputLabelText: 'hsl(209 30% 57%)',
        messageText: 'hsl(209 30% 57%)',
        anchorTextColor: 'hsl(39 100% 56%)',
        dividerBackground: 'hsl(209 40% 26%)',
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
          <p className="text-muted-foreground text-[9px] uppercase tracking-[0.2em] font-display">Loading</p>
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
          <p className="font-display font-semibold text-2xl tracking-[0.2em] uppercase text-foreground mt-5">
            Dad Strength
          </p>
        </div>

        {/* Auth card — signing the title block. You are not the pilot;
            you are the drawing, and the drawing knows who drew it. */}
        <div className="panel-cut hud-frame relative bg-card border border-border p-6 pt-9 shadow-2xl">
          <span className="panel-id">ACCESS // TITLE.BLOCK</span>
          <div className="flex items-center gap-2 mb-4">
            <span className="status-dot" />
            <span className="telemetry">Drawn By — Sign In</span>
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

        <p className="telemetry-dim text-center">
          DS-01 // BUILT FOR THE LONG HAUL
        </p>
      </div>
    </div>
  );
}
