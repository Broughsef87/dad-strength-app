'use client';

import { createClient } from '../utils/supabase/client';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../contexts/ThemeContext';
import Logo from '../components/Logo';

export default function Home() {
  const supabase = createClient();
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
        {/* Brand lockup — stacked suite asset, dark/light aware */}
        <div className="flex flex-col items-center">
          <Logo className="w-24 h-24 drop-shadow-2xl" />
          <p className="font-display font-semibold text-2xl tracking-[0.2em] uppercase text-foreground mt-5">
            Dad Strength
          </p>
        </div>

        {/* Auth card — pilot authentication console */}
        <div className="panel-cut hud-frame relative bg-card border border-border p-6 pt-9 shadow-2xl">
          <span className="panel-id">ACCESS // PILOT.AUTH</span>
          <div className="flex items-center gap-2 mb-4">
            <span className="status-dot" />
            <span className="telemetry">Pilot Authentication</span>
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
