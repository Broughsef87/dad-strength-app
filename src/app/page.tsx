'use client';

import { createClient } from '../utils/supabase/client';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
        {/* Brand lockup — stacked suite asset, dark/light aware */}
        <div className="flex flex-col items-center">
          {/* PNG lockups — fonts baked in at export time */}
          <img
            src="/logo-suite/ds_stacked_dark.png"
            alt="Dad Strength"
            className="w-56 h-auto dark:block hidden drop-shadow-2xl"
            draggable={false}
          />
          <img
            src="/logo-suite/ds_stacked_light.png"
            alt="Dad Strength"
            className="w-56 h-auto dark:hidden block drop-shadow-2xl"
            draggable={false}
          />
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
