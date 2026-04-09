'use client';

import { createClient } from '../utils/supabase/client';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '../contexts/ThemeContext';

export default function Home() {
  const supabase = createClient();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const isDark = resolvedTheme === 'dark';

  const authColors = isDark
    ? {
        brand: '#E61A1A',
        brandAccent: '#c41515',
        inputBackground: '#141414',
        inputBorder: '#2B2B2B',
        inputText: '#F0F0F0',
        inputPlaceholder: '#555555',
        inputLabelText: '#8F8F8F',
        messageText: '#8F8F8F',
        anchorTextColor: '#E61A1A',
        dividerBackground: '#2B2B2B',
        defaultButtonBackground: '#1A1A1A',
        defaultButtonBackgroundHover: '#242424',
        defaultButtonBorder: '#2B2B2B',
        defaultButtonText: '#F0F0F0',
      }
    : {
        brand: '#E61A1A',
        brandAccent: '#c41515',
        inputBackground: '#FFFFFF',
        inputBorder: '#D2D2D7',
        inputText: '#1D1D1F',
        inputPlaceholder: '#AEAEB2',
        inputLabelText: '#6E6E73',
        messageText: '#6E6E73',
        anchorTextColor: '#E61A1A',
        dividerBackground: '#D2D2D7',
        defaultButtonBackground: '#F5F5F7',
        defaultButtonBackgroundHover: '#E8E8ED',
        defaultButtonBorder: '#D2D2D7',
        defaultButtonText: '#1D1D1F',
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
        <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Thin header */}
      <header className="flex items-center justify-between px-6 py-5">
        <span className="text-[10px] font-semibold tracking-[0.3em] text-muted-foreground/40 uppercase">Dad Strength</span>
        <span className="font-mono text-[10px] text-muted-foreground/30 tracking-widest">2026</span>
      </header>
      <div className="h-px bg-brand" />

      {/* Content */}
      <div className="flex-1 flex flex-col justify-between px-6 pt-10 pb-10 max-w-3xl">

        {/* Hero headline */}
        <div>
          <h1 className="font-display text-[clamp(5rem,20vw,14rem)] leading-[0.82] text-foreground tracking-tight">
            DAD<br />STRENGTH
          </h1>
          <div className="mt-6 flex items-center gap-6 max-w-lg">
            <div className="h-px flex-1 bg-border/30" />
            <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.2em] shrink-0">
              The training OS for fathers who refuse to disappear
            </p>
          </div>

          {/* Stats row */}
          <div className="mt-10 flex items-center gap-10">
            {[
              { num: '6', label: 'Programs' },
              { num: '4×', label: 'Days / Week' },
              { num: '∞', label: 'Variation' },
            ].map((s) => (
              <div key={s.label} className="border-t border-border/30 pt-3">
                <p className="font-mono text-2xl text-foreground">{s.num}</p>
                <p className="text-[9px] text-muted-foreground/40 uppercase tracking-[0.2em] mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Auth section — minimal */}
        <div className="mt-14 max-w-xs">
          <p className="text-[9px] tracking-[0.3em] text-muted-foreground/40 uppercase mb-5">Enter</p>
          <div className="auth-container">
            <Auth
              supabaseClient={supabase}
              appearance={{
                theme: ThemeSupa,
                variables: {
                  default: {
                    colors: authColors,
                    borderWidths: { buttonBorderWidth: '1px', inputBorderWidth: '1px' },
                    radii: {
                      borderRadiusButton: '12px',
                      buttonBorderRadius: '12px',
                      inputBorderRadius: '12px',
                    },
                    fontSizes: { baseBodySize: '14px', baseLabelSize: '11px' },
                    fonts: { bodyFontFamily: 'var(--font-inter, sans-serif)' },
                    space: { inputPadding: '14px 16px', buttonPadding: '14px 16px' },
                  },
                },
                style: {
                  button: {
                    fontWeight: '600',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase' as const,
                    fontSize: '12px',
                  },
                  label: {
                    fontSize: '10px',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase' as const,
                    fontWeight: '600',
                  },
                  anchor: { fontWeight: '500' },
                },
              }}
              providers={['google']}
              redirectTo={typeof window !== 'undefined' ? `${window.location.origin}/dashboard` : undefined}
            />
          </div>
          <p className="mt-6 text-[10px] text-muted-foreground/30 leading-relaxed max-w-xs">
            Your training data is private and encrypted. No spam. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
