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
      if (session) {
        router.push('/dashboard');
      }
      setLoading(false);
    };
    checkUser();
  }, [router, supabase.auth]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin opacity-40" />
          <p className="text-muted-foreground text-xs uppercase tracking-[0.2em]">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[hsl(240_10%_4%)] p-8">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[hsl(16_80%_54%/0.07)] blur-[120px]" />
        <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-[hsl(16_80%_54%/0.04)] blur-[80px]" />
      </div>

      {/* Subtle grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `linear-gradient(hsl(60 14% 97%) 1px, transparent 1px), linear-gradient(90deg, hsl(60 14% 97%) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-10 w-full max-w-sm space-y-10">
        {/* Brand mark */}
        <div className="flex flex-col items-center space-y-5">
          <div className="relative">
            <div className="absolute inset-0 rounded-3xl bg-[hsl(16_80%_54%/0.25)] blur-2xl scale-110" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-[hsl(220_30%_8%)] border border-[hsl(220_20%_18%)] p-3 shadow-2xl">
              <Logo className="w-full h-full" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h1
              className="text-3xl font-black tracking-[0.12em] text-[hsl(60_14%_97%)] uppercase"
              style={{ fontFamily: 'var(--font-orbitron, "Arial Black", sans-serif)' }}
            >
              Dad Strength
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[hsl(16_80%_54%)]">
              Lift More · Miss Less
            </p>
            <p className="text-[9px] uppercase tracking-[0.2em] text-[hsl(240_5%_40%)]">
              The Operating System for Modern Fatherhood
            </p>
          </div>
        </div>

        {/* Auth card */}
        <div className="rounded-2xl border border-[hsl(240_4%_16%)] bg-[hsl(240_4%_10%)] p-6 shadow-2xl">
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#E8572A',
                    brandAccent: '#c94a22',
                    inputBackground: 'hsl(240 10% 4%)',
                    inputBorder: 'hsl(240 4% 20%)',
                    inputText: 'hsl(60 14% 97%)',
                    inputPlaceholder: 'hsl(240 5% 45%)',
                    inputLabelText: 'hsl(240 5% 65%)',
                    messageText: 'hsl(240 5% 65%)',
                    anchorTextColor: 'hsl(16 80% 54%)',
                    dividerBackground: 'hsl(240 4% 16%)',
                  },
                },
              },
            }}
            providers={['google']}
            redirectTo={typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined}
          />
        </div>

        <p className="text-center text-[10px] font-medium text-[hsl(240_5%_35%)] uppercase tracking-[0.25em]">
          Forge OS · Dad Strength · Built for the Iron Path
        </p>
      </div>
    </div>
  );
}
