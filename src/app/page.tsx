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
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8 text-foreground">
      <div className="w-full max-w-sm space-y-8">

        {/* Brand mark */}
        <div className="flex flex-col items-center space-y-4">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-foreground p-3">
            <Logo className="w-full h-full" color="hsl(var(--background))" />
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-light tracking-tight text-foreground">Dad Strength</h1>
            <p className="text-sm text-muted-foreground font-light">
              The Operating System for Modern Fatherhood.
            </p>
          </div>
        </div>

        {/* Auth card */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#E8572A',
                    brandAccent: '#c94a22',
                  },
                },
              },
            }}
            providers={['google']}
            redirectTo={typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined}
          />
        </div>

        <p className="text-center text-xs text-muted-foreground uppercase tracking-[0.2em]">
          Forge OS · Dad Strength
        </p>
      </div>
    </div>
  );
}
