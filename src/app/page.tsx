'use client';

import { createClient } from '../utils/supabase/client';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../contexts/ThemeContext';
import Image from 'next/image';

export default function Home() {
  const supabase = createClient();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [loading, setLoading] = useState(true);

  const authColors = resolvedTheme === 'light'
    ? {
        brand: '#C8820A',
        brandAccent: '#a86808',
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
          {/* PNG lockups — fonts baked in at export time */}
          <Image
            src="/logo-suite/ds_stacked_dark.png"
            alt="Dad Strength"
            width={224}
            height={112}
            className="dark:block hidden drop-shadow-2xl"
            draggable={false}
            priority
          />
          <Image
            src="/logo-suite/ds_stacked_light.png"
            alt="Dad Strength"
            width={224}
            height={112}
            className="dark:hidden block drop-shadow-2xl"
            draggable={false}
            priority
          />
        </div>

        {/* Auth card */}
        <div className="ds-card p-6 shadow-2xl">
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

        <p className="text-center text-[9px] font-semibold text-muted-foreground/40 uppercase tracking-[0.22em] font-display">
          Dad Strength · Built for the Long Haul
        </p>
      </div>
    </div>
  );
}
