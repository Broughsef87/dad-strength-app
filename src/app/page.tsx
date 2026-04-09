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
    <div className="relative min-h-screen bg-background overflow-hidden">

      {/* ── Background architectural lines ──────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {/* Vertical rule — right side */}
        <div className="absolute top-0 bottom-0 right-[22%] w-px bg-border/40" />
        {/* Horizontal rule — upper third */}
        <div className="absolute left-0 right-0 top-[30%] h-px bg-border/30" />
        {/* Red accent dot — intersection */}
        <div
          className="absolute w-1.5 h-1.5 rounded-full bg-brand"
          style={{ top: 'calc(30% - 3px)', right: 'calc(22% - 3px)' }}
        />
      </div>

      {/* ── Main layout: split at large, stacked at mobile ──────────────── */}
      <div className="relative z-10 flex min-h-screen flex-col lg:flex-row">

        {/* LEFT — brand statement */}
        <div className="flex flex-col justify-between px-8 pt-16 pb-8 lg:w-[52%] lg:px-16 lg:pt-20 lg:pb-16">

          {/* Wordmark */}
          <div>
            <div className="flex items-center gap-3 mb-16 lg:mb-24">
              <div className="w-1 h-8 bg-brand" />
              <span
                className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground"
              >
                Dad Strength
              </span>
            </div>

            {/* Hero headline */}
            <div className="space-y-0">
              <h1
                className="font-display text-[clamp(4rem,12vw,9rem)] leading-none text-foreground tracking-tight"
                style={{ letterSpacing: '0.02em' }}
              >
                IRON
              </h1>
              <h1
                className="font-display text-[clamp(4rem,12vw,9rem)] leading-none tracking-tight"
                style={{
                  letterSpacing: '0.02em',
                  WebkitTextStroke: isDark ? '1px rgba(240,240,240,0.15)' : '1px rgba(29,29,31,0.12)',
                  color: 'transparent',
                }}
              >
                PATH
              </h1>
            </div>

            <div className="mt-8 flex items-center gap-4">
              <div className="divider-brand-lg" />
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                The training OS built for fathers who refuse to disappear.
              </p>
            </div>

            {/* Feature callouts */}
            <div className="mt-12 grid grid-cols-3 gap-4 hidden lg:grid">
              {[
                { num: '6', label: 'Programs' },
                { num: '4×', label: 'Days / Week' },
                { num: '∞', label: 'Variation' },
              ].map((item) => (
                <div key={item.label} className="border-t border-border pt-4">
                  <div className="stat-num text-2xl text-foreground">{item.num}</div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mt-1">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom left — fine print */}
          <div className="hidden lg:block">
            <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground/50">
              Built for the iron path · {new Date().getFullYear()}
            </p>
          </div>
        </div>

        {/* RIGHT — auth panel */}
        <div className={`
          flex flex-col justify-center
          px-8 py-12
          lg:w-[48%] lg:px-16 lg:py-0
          ${isDark
            ? 'lg:bg-[#0D0D0D] lg:border-l lg:border-[#1E1E1E]'
            : 'lg:bg-white lg:border-l lg:border-[#D2D2D7]'
          }
        `}>
          <div className="w-full max-w-sm mx-auto lg:mx-0">

            {/* Panel header */}
            <div className="mb-8">
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-3">
                Enter
              </p>
              <h2 className="font-display text-4xl text-foreground tracking-wide">
                BEGIN TRAINING
              </h2>
              <div className="divider-brand mt-3" />
            </div>

            {/* Auth form */}
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

            {/* Reassurance */}
            <div className="mt-8 flex items-start gap-3 p-4 rounded-xl bg-muted/50 border border-border">
              <div className="w-1 h-full min-h-[2rem] bg-brand/50 rounded-full shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Your training data is private and encrypted. No spam. Cancel anytime.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
