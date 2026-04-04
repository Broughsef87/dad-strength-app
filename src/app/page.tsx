'use client';

import { createClient } from '../utils/supabase/client';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '../components/Logo';

export default function Home() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) router.push('/dashboard');
      setLoading(false);
    };
    checkUser();
  }, [router, supabase.auth]);

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
        {/* Brand mark */}
        <div className="flex flex-col items-center space-y-5">
          <div className="relative">
            {/* Amber hairline halo — not a blob, just a ring */}
            <div className="absolute inset-0 rounded-2xl border border-brand/20 scale-110" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-surface-2 border border-border p-3 shadow-2xl">
              <Logo className="w-full h-full" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-4xl tracking-[0.1em] text-foreground uppercase font-display">
              Dad Strength
            </h1>
            <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-brand">
              Lift More · Miss Less
            </p>
            <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              The Operating System for Modern Fatherhood
            </p>
          </div>
        </div>

        {/* Auth card */}
        <div className="ds-card p-6 shadow-2xl">
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#C8820A',
                    brandAccent: '#a86808',
                    inputBackground: 'hsl(222 21% 7%)',
                    inputBorder: 'hsl(214 35% 18%)',
                    inputText: 'hsl(210 24% 80%)',
                    inputPlaceholder: 'hsl(213 22% 32%)',
                    inputLabelText: 'hsl(213 22% 52%)',
                    messageText: 'hsl(213 22% 52%)',
                    anchorTextColor: 'hsl(38 90% 41%)',
                    dividerBackground: 'hsl(214 35% 18%)',
                  },
                },
              },
            }}
            providers={['google']}
            redirectTo={typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined}
          />
        </div>

        <p className="text-center text-[9px] font-semibold text-muted-foreground/40 uppercase tracking-[0.22em] font-display">
          Dad Strength · Built for the Iron Path
        </p>
      </div>
    </div>
  );
}
